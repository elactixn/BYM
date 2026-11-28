/**
 * beatScheduler.js
 * True Instrument-Distinct Offline Audio Chart Generators:
 *  - ZERO guitar-biased charts when playing Drums or Bass!
 *  - Runs dedicated OfflineAudioContext filter passes for each instrument:
 *
 *    1. DRUMS (Percussive Transient & Kit-Piece Separation):
 *       - Pass A: Sub-Kick (45Hz–105Hz sharp transient spikes) -> strictly Lane 0 (D)
 *       - Pass B: Snare Crack (180Hz–350Hz body + 2.5kHz–6kHz noise snap) -> strictly Lane 1 (F)
 *       - Pass C: Hi-Hat / Cymbal (> 7kHz high-frequency bursts) -> Lane 2 (G/J) for steady
 *                 hi-hat/toms pulse, and top Lane (J/K) for loud chorus downbeats & crash accents.
 *       - Strictly enforces ZERO long sustain bars (sustainDuration = 0) on Drums.
 *       - Generates authentic kick+snare / kick+crash 2-note flams and rapid tom rolls on fills.
 *
 *    2. BASS (Sub-Harmonic Root Groove & Octave Jumps):
 *       - Strict low-pass filter below 240Hz (40Hz–240Hz cascaded 24dB/oct OfflineAudioContext).
 *       - Time-domain autocorrelation (41Hz–240Hz) + zero-crossing verification on each onset
 *         to track true fundamental bass root notes (Hz -> MIDI pitch).
 *       - Generates locked-in rhythmic pocket grooves (steady eighth-note root pumping,
 *         syncopated slap hits, octave jumps, and clean sustains on held bass roots)
 *         mapped left-to-right across fret positions (D = low open string -> K = high octave).
 *
 *    3. LEAD GUITAR (Harmonic Riffs, Pitch Contour, Bends & Power Chords):
 *       - Band-pass 300Hz–4.5kHz + STFT Harmonic-Percussive Source Separation (HPSS).
 *       - Tracks rising/falling melodic pitch contours, sustained ring-out bends,
 *         and 2-note power chords during loud choruses.
 *
 *  - All generators use a local 2.0s rolling adaptive threshold so quiet solo intros
 *    starting right at 0.08s+ always generate crisp, beat-locked notes!
 */

import {
  analyzeAudioInWorker,
  parseMidiArrayBuffer,
  parseCloneHeroChart,
  timeToTick,
  tickToTime,
  STANDARD_PPQ,
} from './audioEngine.js';

const FFT_SIZE = 512;
const HOP_SIZE = 256;
const ANALYSIS_RATE = 22050;
const BASS_ANALYSIS_RATE = 11025;

// Precomputed Hann window for STFT
const HANN_WINDOW = new Float32Array(FFT_SIZE);
for (let i = 0; i < FFT_SIZE; i += 1) {
  HANN_WINDOW[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)));
}

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fast in-place iterative Cooley-Tukey radix-2 FFT.
 */
function fftRadix2(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) {
      j ^= bit;
    }
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let j = 0; j < half; j += 1) {
        const uRe = re[i + j];
        const uIm = im[i + j];
        const vRe = re[i + j + half] * curRe - im[i + j + half] * curIm;
        const vIm = re[i + j + half] * curIm + im[i + j + half] * curRe;
        re[i + j] = uRe + vRe;
        im[i + j] = uIm + vIm;
        re[i + j + half] = uRe - vRe;
        im[i + j + half] = uIm - vIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
}

function median3(a, b, c) {
  if (a > b) {
    if (b > c) return b;
    return a > c ? c : a;
  }
  if (a > c) return a;
  return b > c ? c : b;
}

function median5(a, b, c, d, e) {
  const arr = [a, b, c, d, e];
  arr.sort((x, y) => x - y);
  return arr[2];
}

function mixToMonoBuffer(audioBuffer, targetRate = ANALYSIS_RATE) {
  const srcRate = audioBuffer.sampleRate;
  const srcLen = audioBuffer.length;
  const numCh = audioBuffer.numberOfChannels;
  const ch0 = audioBuffer.getChannelData(0);
  const ch1 = numCh > 1 ? audioBuffer.getChannelData(1) : null;

  const step = srcRate / targetRate;
  const outLen = Math.max(FFT_SIZE, Math.floor(srcLen / step));
  const mono = new Float32Array(outLen);

  for (let i = 0; i < outLen; i += 1) {
    const idx = Math.min(srcLen - 1, Math.floor(i * step));
    mono[i] = ch1 ? (ch0[idx] + ch1[idx]) * 0.5 : ch0[idx];
  }
  return { mono, sampleRate: targetRate };
}

/**
 * Renders an offline frequency-filtered mono Float32Array via OfflineAudioContext.
 * @param {AudioBuffer} audioBuffer
 * @param {Array<{type: BiquadFilterType, frequency: number, Q?: number}>} filterSpecs
 * @param {number} targetRate
 * @returns {Promise<Float32Array>}
 */
async function renderFilteredMono(audioBuffer, filterSpecs, targetRate = ANALYSIS_RATE) {
  const duration = Math.max(0.5, audioBuffer.duration);
  const length = Math.max(FFT_SIZE, Math.ceil(duration * targetRate));
  const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;

  if (!OfflineCtx) {
    return mixToMonoBuffer(audioBuffer, targetRate).mono;
  }

  try {
    const off = new OfflineCtx(1, length, targetRate);
    const src = off.createBufferSource();
    src.buffer = audioBuffer;

    let node = src;
    for (let i = 0; i < filterSpecs.length; i += 1) {
      const spec = filterSpecs[i];
      const f = off.createBiquadFilter();
      f.type = spec.type;
      f.frequency.value = Math.min(targetRate * 0.46, Math.max(20, spec.frequency));
      if (spec.Q !== undefined) f.Q.value = spec.Q;
      node.connect(f);
      node = f;
    }
    node.connect(off.destination);
    src.start(0);
    const rendered = await off.startRendering();
    return rendered.getChannelData(0);
  } catch {
    return mixToMonoBuffer(audioBuffer, targetRate).mono;
  }
}

/**
 * Computes frame-by-frame RMS envelope & positive half-wave onset flux from a mono waveform.
 */
function computeEnvelopeAndFlux(mono, sampleRate, frameMs = 12) {
  const hop = Math.max(64, Math.floor((sampleRate * frameMs) / 1000));
  const win = hop * 2;
  const frameCount = Math.max(1, Math.floor((mono.length - win) / hop));
  const rms = new Float32Array(frameCount);
  const flux = new Float32Array(frameCount);
  const hopSec = hop / sampleRate;

  let prevRms = 0;
  let maxRms = 1e-6;
  for (let f = 0; f < frameCount; f += 1) {
    const start = f * hop;
    let sumSq = 0;
    for (let i = 0; i < win; i += 1) {
      const s = mono[start + i];
      sumSq += s * s;
    }
    const r = Math.sqrt(sumSq / win);
    rms[f] = r;
    if (r > maxRms) maxRms = r;
    const diff = r - prevRms * 0.86;
    flux[f] = diff > 0 ? diff : 0;
    prevRms = r;
  }

  // Normalize to 0..1 relative to track band peak (with safe noise floor)
  const inv = 1 / Math.max(maxRms, 0.008);
  for (let f = 0; f < frameCount; f += 1) {
    rms[f] *= inv;
    flux[f] *= inv;
  }

  return { rms, flux, hop, hopSec, frameCount, maxRms };
}

/**
 * Computes rolling local adaptive mean over a 2.0s window (used for section energy tracking).
 */
function computeLocalAdaptiveMean(signal, hopSec, windowSec = 2.0) {
  const n = signal.length;
  const halfWin = Math.max(4, Math.round((windowSec * 0.5) / hopSec));
  const prefix = new Float64Array(n + 1);
  for (let i = 0; i < n; i += 1) {
    prefix[i + 1] = prefix[i] + signal[i];
  }
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const lo = Math.max(0, i - halfWin);
    const hi = Math.min(n, i + halfWin + 1);
    out[i] = (prefix[hi] - prefix[lo]) / Math.max(1, hi - lo);
  }
  return out;
}

/**
 * Computes fast sliding Adaptive Local Median over a ~2.0s window for half-wave rectified
 * Spectral Flux onset picking (far more resilient to loud outliers than mean!).
 */
function computeLocalAdaptiveMedian(signal, hopSec, windowSec = 2.0) {
  const n = signal.length;
  const halfWin = Math.max(4, Math.round((windowSec * 0.5) / hopSec));
  const out = new Float32Array(n);
  const stride = Math.max(1, Math.floor(halfWin / 12));
  const scratch = [];

  for (let i = 0; i < n; i += 1) {
    const lo = Math.max(0, i - halfWin);
    const hi = Math.min(n - 1, i + halfWin);
    scratch.length = 0;
    for (let j = lo; j <= hi; j += stride) {
      scratch.push(signal[j]);
    }
    scratch.sort((a, b) => a - b);
    const mid = scratch.length >> 1;
    out[i] = scratch.length > 0 ? scratch[mid] : 0;
  }
  return out;
}

/**
 * Checks whether a stem is audible above its active song entry gate at timestamp `timeSec`.
 */
function isStemActiveAt(stemActivity, role, timeSec) {
  if (!stemActivity || !stemActivity[role] || !stemActivity.hopSec) return true;
  const arr = stemActivity[role];
  const idx = Math.max(0, Math.min(arr.length - 1, Math.floor(timeSec / stemActivity.hopSec)));
  return arr[idx] === 1;
}

/**
 * Estimates BPM & beat-grid phase from an onset strength curve via autocorrelation.
 */
function estimateTempoAndPhase(flux, hopSec, bpmHint = null) {
  const n = flux.length;
  const maxFrames = Math.min(n, Math.floor(75 / hopSec));

  let bestBpm = bpmHint || 120;
  if (!bpmHint || bpmHint < 60 || bpmHint > 210) {
    const minLag = Math.max(4, Math.round(60 / (178 * hopSec)));
    const maxLag = Math.min(maxFrames - 4, Math.round(60 / (76 * hopSec)));
    let bestScore = -1;
    let bestLag = Math.round(60 / (120 * hopSec));

    for (let lag = minLag; lag <= maxLag; lag += 1) {
      let sum = 0;
      const limit = maxFrames - lag;
      for (let i = 0; i < limit; i += 1) {
        sum += flux[i] * flux[i + lag];
      }
      const bpmCand = 60 / (lag * hopSec);
      const popBias = 1 + 0.16 * Math.exp(-Math.pow((bpmCand - 122) / 28, 2));
      const score = (sum / Math.max(1, limit)) * popBias;
      if (score > bestScore) {
        bestScore = score;
        bestLag = lag;
      }
    }
    bestBpm = Math.round(60 / (bestLag * hopSec));
    while (bestBpm < 80) bestBpm *= 2;
    while (bestBpm > 176) bestBpm = Math.round(bestBpm / 2);
  }

  const beatSec = 60 / bestBpm;
  const phaseSteps = 32;
  let bestPhase = 0;
  let bestPhaseScore = -1;
  const scanLimitSec = Math.min(n * hopSec, 60);

  for (let p = 0; p < phaseSteps; p += 1) {
    const phase = (p / phaseSteps) * beatSec;
    let score = 0;
    for (let t = phase; t < scanLimitSec; t += beatSec) {
      const idx = Math.min(n - 1, Math.round(t / hopSec));
      score += flux[idx] + (idx > 0 ? flux[idx - 1] * 0.45 : 0) + (idx < n - 1 ? flux[idx + 1] * 0.45 : 0);
    }
    if (score > bestPhaseScore) {
      bestPhaseScore = score;
      bestPhase = phase;
    }
  }

  return { bpm: bestBpm, beatSec, beatPhaseSec: bestPhase };
}

function buildBeatGrid(durationSec, beatSec, beatPhaseSec, syncTrack = null, resolution = STANDARD_PPQ) {
  const grid = [];
  if (Array.isArray(syncTrack) && syncTrack.length > 0) {
    let beatIdx = 0;
    let segIdx = 0;
    while (beatIdx < 4000) {
      const tick = beatIdx * resolution;
      while (segIdx + 1 < syncTrack.length && Number(syncTrack[segIdx + 1].tick || 0) <= tick) {
        segIdx += 1;
      }
      const t = tickToTime(tick, syncTrack, resolution);
      if (t > durationSec + 0.5) break;
      if (t >= 0) {
        const tFixed = Number(t.toFixed(4));
        const localBpm = Number((Number(syncTrack[segIdx]?.bpm) || (60 / Math.max(0.25, beatSec))).toFixed(3));
        grid.push({
          tick,
          time: tFixed,
          timeSec: tFixed,
          isMeasure: tick % (resolution * 4) === 0,
          beatIndex: beatIdx,
          localBpm,
        });
      }
      beatIdx += 1;
    }
    return grid;
  }

  let idx = 0;
  let t = beatPhaseSec;
  while (t > beatSec) t -= beatSec;
  while (t < durationSec) {
    if (t >= 0) {
      const tFixed = Number(t.toFixed(4));
      const tick = idx * resolution;
      grid.push({ tick, time: tFixed, timeSec: tFixed, isMeasure: idx % 4 === 0, beatIndex: idx });
      idx += 1;
    }
    t += beatSec;
  }
  return grid;
}

function quantizeTickTo192Subdiv(rawTick) {
  const t = Math.max(0, rawTick);
  const q48 = Math.round(t / 48) * 48;
  const q64 = Math.round(t / 64) * 64;
  return Math.abs(t - q48) <= Math.abs(t - q64) ? q48 : q64;
}

function quantizeToSubdivision(rawTime, beatPhaseSec, subdivSec, maxPullSec = 0.036) {
  const nearest = beatPhaseSec + Math.round((rawTime - beatPhaseSec) / subdivSec) * subdivSec;
  if (Math.abs(nearest - rawTime) <= maxPullSec && nearest >= 0.06) {
    return nearest;
  }
  return rawTime;
}

/**
 * Marks golden Fever star phrases cleanly across any chart.
 */
function markFeverNotes(notes) {
  if (!notes.length) return;
  let phraseStart = -99;
  for (let i = 0; i < notes.length; i += 1) {
    const n = notes[i];
    const hitSec = n.hitTimeSec ?? n.timeSec ?? 0;
    if (hitSec >= 10 && hitSec - phraseStart >= 18) {
      phraseStart = hitSec;
    }
    if (hitSec >= phraseStart && hitSec <= phraseStart + 4.2) {
      n.isFever = true;
      n.isStar = true;
    }
  }
}

/* ==========================================================================
   1. DRUMS CHART GENERATOR (Percussive Transient & Kit-Piece Separation)
      - Strictly maps Kick -> Lane 0, Snare -> Lane 1, Hi-Hat/Toms -> Lane 2,
        Crash/Ride -> top Lane (3 or 4).
      - ZERO long sustain bars on Drums (sustainDuration = 0 strictly enforced).
      - Double-kick / kick+snare / kick+crash flams & rapid tom rolls on fills!
   ========================================================================== */

async function buildDrumsChart({ audioBuffer, stemActivity, trackId, laneCount, difficultyConfig, bpmHint }) {
  const duration = audioBuffer.duration;
  const diffId = difficultyConfig?.id || 'normal';
  const minGapSec = (difficultyConfig?.minNoteGapMs || 200) / 1000;
  const sensitivity = difficultyConfig?.scanSensitivity || 1.38;
  const rng = createRng(hashSeed(`${trackId}_drums_${laneCount}_${diffId}`));

  // Run 4 parallel band-isolated OfflineAudioContext passes on the Virtual Drum Stem!
  const [kickMono, snareBodyMono, snareSnapMono, hatMono] = await Promise.all([
    // Sub-Kick: 45Hz – 105Hz
    renderFilteredMono(audioBuffer, [
      { type: 'highpass', frequency: 45, Q: 0.9 },
      { type: 'lowpass', frequency: 105, Q: 1.0 },
    ]),
    // Snare Body: 180Hz – 350Hz
    renderFilteredMono(audioBuffer, [
      { type: 'highpass', frequency: 180, Q: 0.9 },
      { type: 'lowpass', frequency: 350, Q: 1.0 },
    ]),
    // Snare Crack / Noise Snap: 2.5kHz – 6kHz
    renderFilteredMono(audioBuffer, [
      { type: 'highpass', frequency: 2500, Q: 0.85 },
      { type: 'lowpass', frequency: 6000, Q: 0.9 },
    ]),
    // Hi-Hat / Cymbal: > 6.5kHz
    renderFilteredMono(audioBuffer, [
      { type: 'highpass', frequency: 6500, Q: 0.8 },
    ]),
  ]);

  const kickEnv = computeEnvelopeAndFlux(kickMono, ANALYSIS_RATE, 11);
  const snareBodyEnv = computeEnvelopeAndFlux(snareBodyMono, ANALYSIS_RATE, 11);
  const snareSnapEnv = computeEnvelopeAndFlux(snareSnapMono, ANALYSIS_RATE, 11);
  const hatEnv = computeEnvelopeAndFlux(hatMono, ANALYSIS_RATE, 11);

  const frameCount = Math.min(kickEnv.frameCount, snareBodyEnv.frameCount, snareSnapEnv.frameCount, hatEnv.frameCount);
  const hopSec = kickEnv.hopSec;

  // Combine Snare Body + Snare Snap coincident transient energy for crisp snare crack detection
  const snareFlux = new Float32Array(frameCount);
  const combinedPulse = new Float32Array(frameCount);
  for (let f = 0; f < frameCount; f += 1) {
    const bodyBoost = Math.sqrt(Math.max(0, snareBodyEnv.flux[f] * snareSnapEnv.flux[f])) * 1.45;
    const linearCrack = snareSnapEnv.flux[f] * 0.55 + snareBodyEnv.flux[f] * 0.45;
    snareFlux[f] = Math.max(bodyBoost, linearCrack);
    combinedPulse[f] = kickEnv.flux[f] * 1.25 + snareFlux[f] * 1.0 + hatEnv.flux[f] * 0.4;
  }

  const { bpm, beatSec, beatPhaseSec } = estimateTempoAndPhase(combinedPulse, hopSec, bpmHint);
  const beatGrid = buildBeatGrid(duration, beatSec, beatPhaseSec);

  // Adaptive Local Median thresholding over 2.0s window for crisp transient peak picking!
  const kickLocal = computeLocalAdaptiveMedian(kickEnv.flux, hopSec, 2.0);
  const snareLocal = computeLocalAdaptiveMedian(snareFlux, hopSec, 2.0);
  const hatLocal = computeLocalAdaptiveMedian(hatEnv.flux, hopSec, 2.0);
  const globalOverallLocal = computeLocalAdaptiveMean(combinedPulse, hopSec, 2.2);

  // Drum kit lane assignments (strictly NOT pitch contour!)
  const LANE_KICK = 0; // D: Kick Drum
  const LANE_SNARE = 1; // F: Snare Drum
  const LANE_HIHAT_TOM = 2; // G (5-lane) or J (4-lane): Hi-Hat / Toms
  const LANE_CRASH = laneCount === 5 ? 4 : 3; // K: Crash / Ride Cymbal
  const LANE_RIDE_OR_TOM = laneCount === 5 ? 3 : 2; // J on 5-lane (Toms / Ride)

  const subdiv = diffId === 'hard' ? beatSec / 4 : beatSec / 2;

  // Helper to detect sharp local transient peaks per kit band — strictly gated by stemActivity.drums!
  const detectKitPeaks = (fluxArr, rmsArr, localArr, threshMult, minBandGap, minFloor) => {
    const peaks = [];
    let lastT = -1;
    for (let f = 2; f < frameCount - 2; f += 1) {
      const t = f * hopSec;
      if (t < 0.08 || t > duration - 0.12) continue;
      // Step 2 Per-Stem Silence Gate: output ZERO drum notes while drums are silent (e.g. solo guitar intro!)
      if (!isStemActiveAt(stemActivity, 'drums', t)) continue;
      const v = fluxArr[f];
      if (v <= minFloor || rmsArr[f] < 0.032) continue;
      if (v < fluxArr[f - 1] || v < fluxArr[f + 1]) continue;
      const adaptive = Math.max(minFloor, localArr[f] * threshMult + 0.014);
      if (v >= adaptive && t - lastT >= minBandGap) {
        peaks.push({
          time: quantizeToSubdivision(t, beatPhaseSec, subdiv, 0.032),
          strength: v / Math.max(0.02, localArr[f] + 0.01),
          rms: rmsArr[f],
          frame: f,
        });
        lastT = t;
      }
    }
    return peaks;
  };

  const kickPeaks = detectKitPeaks(
    kickEnv.flux,
    kickEnv.rms,
    kickLocal,
    sensitivity * 1.12,
    diffId === 'hard' ? 0.115 : diffId === 'normal' ? 0.19 : 0.34,
    0.032
  );
  const snarePeaks = detectKitPeaks(
    snareFlux,
    snareSnapEnv.rms,
    snareLocal,
    sensitivity * 1.18,
    diffId === 'hard' ? 0.115 : diffId === 'normal' ? 0.21 : 0.38,
    0.03
  );
  const hatPeaks = detectKitPeaks(
    hatEnv.flux,
    hatEnv.rms,
    hatLocal,
    sensitivity * (diffId === 'hard' ? 1.05 : diffId === 'normal' ? 1.24 : 1.55),
    diffId === 'hard' ? 0.11 : diffId === 'normal' ? 0.19 : 0.38,
    0.028
  );

  // Merge kit hits into quantized time buckets so simultaneous kick+snare or kick+crash become real flams/chords!
  const bucketMap = new Map();
  const addToBucket = (timeSec, piece, strength, rms, frame) => {
    const key = Math.round(timeSec / 0.035);
    let bucket = bucketMap.get(key);
    if (!bucket) {
      bucket = { time: timeSec, kick: 0, snare: 0, hat: 0, hatRms: 0, frame };
      bucketMap.set(key, bucket);
    }
    if (piece === 'kick' && strength > bucket.kick) bucket.kick = strength;
    if (piece === 'snare' && strength > bucket.snare) bucket.snare = strength;
    if (piece === 'hat' && strength > bucket.hat) {
      bucket.hat = strength;
      bucket.hatRms = Math.max(bucket.hatRms, rms);
    }
  };

  kickPeaks.forEach((p) => addToBucket(p.time, 'kick', p.strength, p.rms, p.frame));
  snarePeaks.forEach((p) => addToBucket(p.time, 'snare', p.strength, p.rms, p.frame));
  hatPeaks.forEach((p) => addToBucket(p.time, 'hat', p.strength, p.rms, p.frame));

  const buckets = Array.from(bucketMap.values()).sort((a, b) => a.time - b.time);

  const notes = [];
  let lastEmitTime = -1;
  let lastTomStep = 0;

  for (let i = 0; i < buckets.length; i += 1) {
    const b = buckets[i];
    if (b.time - lastEmitTime < minGapSec * 0.92) continue;

    // Position inside 4/4 measure (0 = beat 1 downbeat, 1 = beat 2 backbeat, 2 = beat 3, 3 = beat 4 backbeat)
    const beatFloat = (b.time - beatPhaseSec) / beatSec;
    const beatInBar = ((Math.round(beatFloat * 2) / 2) % 4 + 4) % 4;
    const isDownbeat = Math.abs(beatInBar) < 0.18 || Math.abs(beatInBar - 4) < 0.18;
    const isBackbeat = Math.abs(beatInBar - 1) < 0.2 || Math.abs(beatInBar - 3) < 0.2;
    const isEndOfBarFill = beatInBar >= 3.2;

    const sectionEnergy = globalOverallLocal[Math.min(frameCount - 1, b.frame)] || 0.1;
    const isLoudChorus = sectionEnergy > 0.12 && (b.hatRms > 0.28 || b.kick > 2.2);

    // Score each kit piece (boosts authentic backbeat snare on 2 & 4 and downbeat kick/crash on 1)
    const kickScore = b.kick * (isDownbeat || Math.abs(beatInBar - 2) < 0.2 ? 1.25 : 1.0);
    const snareScore = b.snare * (isBackbeat ? 1.35 : 0.96);
    const hatScore = b.hat;

    const emitHit = (lane, drumPart, isChord = false) => {
      const hitSec = Number(b.time.toFixed(4));
      notes.push({
        id: `${trackId}_d_${notes.length}`,
        lane,
        timeSec: hitSec,
        hitTimeSec: hitSec,
        sustainSec: 0,
        sustainDuration: 0, // STRICTLY ZERO long sustain bars on Drums!
        isChord,
        isFever: false,
        isStar: false,
        pitchNorm: lane / Math.max(1, laneCount - 1),
        drumPart,
        hit: false,
        holding: false,
        holdCompleted: false,
        missed: false,
      });
    };

    // Rapid pre-chorus / end-of-bar tom roll pattern on Normal & Hard!
    if (isEndOfBarFill && diffId !== 'easy' && (snareScore > 1.35 || hatScore > 1.35) && kickScore < snareScore * 1.1) {
      const tomLanes = laneCount === 5 ? [1, 2, 3] : [1, 2, 3];
      const tomLane = tomLanes[lastTomStep % tomLanes.length];
      lastTomStep += 1;
      emitHit(tomLane, tomLane === 1 ? 'snare' : 'hihat', false);
      lastEmitTime = b.time;
      continue;
    }

    // Decide primary & optional flam/chord drum hit
    const allowChords = diffId !== 'easy' && (difficultyConfig?.chordChance || 0.16) > 0;
    const isCrashAccent = isDownbeat && (isLoudChorus || b.hatRms > 0.36) && hatScore > 1.2;

    if (isCrashAccent && kickScore > 1.1 && allowChords) {
      // Classic Rock/Pop Chorus Downbeat: Kick (Lane 0) + Crash Cymbal (Top Lane)
      emitHit(LANE_KICK, 'kick', true);
      emitHit(LANE_CRASH, 'crash', true);
      lastEmitTime = b.time;
    } else if (kickScore > 1.45 && snareScore > 1.55 && allowChords && rng() < (diffId === 'hard' ? 0.55 : 0.28)) {
      // Punchy Kick + Snare flam chord!
      emitHit(LANE_KICK, 'kick', true);
      emitHit(LANE_SNARE, 'snare', true);
      lastEmitTime = b.time;
    } else if (isCrashAccent) {
      emitHit(LANE_CRASH, 'crash', false);
      lastEmitTime = b.time;
    } else if (snareScore >= kickScore && snareScore >= hatScore * 0.9 && snareScore > 0) {
      // Snare backbeat (Lane 1)
      if (allowChords && hatScore > 1.75 && diffId === 'hard' && rng() < 0.25) {
        emitHit(LANE_SNARE, 'snare', true);
        emitHit(LANE_HIHAT_TOM, 'hihat', true);
      } else {
        emitHit(LANE_SNARE, 'snare', false);
      }
      lastEmitTime = b.time;
    } else if (kickScore >= hatScore * 0.85 && kickScore > 0) {
      // Heavy Kick Drum anchor (Lane 0)
      emitHit(LANE_KICK, 'kick', false);
      lastEmitTime = b.time;
    } else if (hatScore > 0) {
      // Steady Hi-Hat / Ride pulse (Lane 2 or 3 on 5-lane)
      const useRide = laneCount === 5 && isLoudChorus && rng() < 0.45;
      emitHit(useRide ? LANE_RIDE_OR_TOM : LANE_HIHAT_TOM, useRide ? 'crash' : 'hihat', false);
      lastEmitTime = b.time;
    }
  }

  markFeverNotes(notes);
  return { bpm, beatGrid, notes };
}

/* ==========================================================================
   2. BASS CHART GENERATOR (Sub-Harmonic Root Groove & Octave Jumps)
      - Strictly low-pass filters audio below 240Hz (40Hz–240Hz 24dB/oct).
      - Runs time-domain autocorrelation + zero-crossing pitch tracking on
        the filtered 40Hz–240Hz waveform at each bass onset to find the true
        fundamental bass root note (Hz -> MIDI).
      - Maps root fret positions left-to-right (D = low open string -> K = high
        octave), preserving locked eighth-note root grooves, octave jumps,
        and smooth sustain holds on sustained bass roots.
   ========================================================================== */

function detectFundamentalBassHz(mono, sampleRate, startSample, winSamples) {
  const end = Math.min(mono.length, startSample + winSamples);
  const len = end - startSample;
  if (len < 128) return null;

  // Remove DC offset and measure RMS
  let mean = 0;
  for (let i = 0; i < len; i += 1) mean += mono[startSample + i];
  mean /= len;

  let energy = 0;
  let zeroCrossings = 0;
  let prev = mono[startSample] - mean;
  for (let i = 0; i < len; i += 1) {
    const v = mono[startSample + i] - mean;
    energy += v * v;
    if ((prev <= 0 && v > 0) || (prev >= 0 && v < 0)) {
      zeroCrossings += 1;
    }
    prev = v;
  }
  const rms = Math.sqrt(energy / len);
  if (rms < 0.006) return null;

  // Zero-crossing rough estimate (Hz) for octave sanity confirmation
  const zcrHz = (zeroCrossings * sampleRate) / (2 * len);

  // Time-domain normalized autocorrelation over 41Hz (E1) to 240Hz (B3)
  const minLag = Math.max(16, Math.floor(sampleRate / 242));
  const maxLag = Math.min(Math.floor(len * 0.65), Math.ceil(sampleRate / 41));
  if (maxLag <= minLag) return zcrHz >= 41 && zcrHz <= 240 ? zcrHz : null;

  let bestLag = -1;
  let bestCorr = -1;

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let num = 0;
    let denA = 0;
    let denB = 0;
    const count = len - lag;
    for (let i = 0; i < count; i += 2) {
      const a = mono[startSample + i] - mean;
      const b = mono[startSample + i + lag] - mean;
      num += a * b;
      denA += a * a;
      denB += b * b;
    }
    const corr = num / (Math.sqrt(denA * denB) + 1e-9);
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  if (bestLag > 0 && bestCorr >= 0.34) {
    let acfHz = sampleRate / bestLag;
    // If autocorrelation locked onto a sub-octave while ZCR clearly sees 2x, refine cleanly
    if (zcrHz > 50 && zcrHz < 235 && Math.abs(acfHz * 2 - zcrHz) < zcrHz * 0.16) {
      acfHz *= 2;
    }
    return Math.max(41, Math.min(240, acfHz));
  }

  if (zcrHz >= 41 && zcrHz <= 240) return zcrHz;
  return null;
}

async function buildBassChart({ audioBuffer, stemActivity, trackId, laneCount, difficultyConfig, bpmHint }) {
  const duration = audioBuffer.duration;
  const diffId = difficultyConfig?.id || 'normal';
  const minGapSec = (difficultyConfig?.minNoteGapMs || 200) / 1000;
  const sensitivity = difficultyConfig?.scanSensitivity || 1.38;

  // Strict 45Hz–210Hz cascaded low-pass on the kick-rejected Virtual Bass Stem!
  const bassMono = await renderFilteredMono(
    audioBuffer,
    [
      { type: 'highpass', frequency: 45, Q: 0.78 },
      { type: 'lowpass', frequency: 210, Q: 0.85 },
      { type: 'lowpass', frequency: 210, Q: 0.85 },
    ],
    BASS_ANALYSIS_RATE
  );

  const env = computeEnvelopeAndFlux(bassMono, BASS_ANALYSIS_RATE, 14);
  const { bpm, beatSec, beatPhaseSec } = estimateTempoAndPhase(env.flux, env.hopSec, bpmHint);
  const beatGrid = buildBeatGrid(duration, beatSec, beatPhaseSec);
  const localFluxMedian = computeLocalAdaptiveMedian(env.flux, env.hopSec, 2.0);
  const localRmsMean = computeLocalAdaptiveMean(env.rms, env.hopSec, 2.0);

  // Detect bass groove onsets gated strictly by stemActivity.bass!
  const subdiv = diffId === 'hard' ? beatSec / 4 : beatSec / 2;
  const rawEvents = [];
  let lastT = -1;
  const acfWinSamples = Math.floor(BASS_ANALYSIS_RATE * 0.056); // 56ms window for sub-45Hz stability

  for (let f = 2; f < env.frameCount - 2; f += 1) {
    const t = f * env.hopSec;
    if (t < 0.08 || t > duration - 0.14) continue;
    // Step 2 Per-Stem Silence Gate: output ZERO bass notes while bassline hasn't entered!
    if (!isStemActiveAt(stemActivity, 'bass', t)) continue;
    const v = env.flux[f];
    const r = env.rms[f];
    if (r < 0.045) continue;

    // Trigger on either sharp transient onset (adaptive local median) OR locked eighth-note root pulse
    const isPeak =
      v >= env.flux[f - 1] &&
      v >= env.flux[f + 1] &&
      v >= Math.max(0.02, localFluxMedian[f] * (sensitivity * 1.15) + 0.012);

    const gridPos = (t - beatPhaseSec) / (beatSec * 0.5);
    const nearEighth = Math.abs(gridPos - Math.round(gridPos)) < 0.09;
    const isGroovePump =
      diffId !== 'easy' &&
      nearEighth &&
      r > Math.max(0.16, localRmsMean[f] * 0.9) &&
      t - lastT >= Math.max(minGapSec, beatSec * 0.45);

    if ((isPeak || isGroovePump) && t - lastT >= minGapSec) {
      const snappedT = quantizeToSubdivision(t, beatPhaseSec, subdiv, 0.036);
      const startSample = Math.min(bassMono.length - acfWinSamples - 1, Math.floor((t + 0.012) * BASS_ANALYSIS_RATE));
      const hz = detectFundamentalBassHz(bassMono, BASS_ANALYSIS_RATE, Math.max(0, startSample), acfWinSamples);
      const midi = hz ? 69 + 12 * Math.log2(hz / 440) : null;

      rawEvents.push({
        time: snappedT,
        frame: f,
        rms: r,
        hz,
        midi,
      });
      lastT = t;
    }
  }

  // Gather pitch distribution (10th to 90th percentile MIDI) to map low open strings -> high octaves cleanly!
  const validMidis = rawEvents.filter((e) => e.midi !== null).map((e) => e.midi).sort((a, b) => a - b);
  const lowMidi = validMidis.length >= 6 ? validMidis[Math.floor(validMidis.length * 0.1)] : 33; // ~A1
  const highMidi = validMidis.length >= 6 ? validMidis[Math.floor(validMidis.length * 0.9)] : 52; // ~E3
  const midiSpan = Math.max(7, highMidi - lowMidi);

  const notes = [];
  let prevLane = 0;
  let prevMidi = lowMidi;

  for (let i = 0; i < rawEvents.length; i += 1) {
    const ev = rawEvents[i];
    const nextEv = rawEvents[i + 1];
    const gapToNext = nextEv ? nextEv.time - ev.time : duration - ev.time;

    let lane = prevLane;
    let pitchNorm = 0.25;

    if (ev.midi !== null) {
      const deltaSemis = ev.midi - prevMidi;
      pitchNorm = Math.max(0, Math.min(1, (ev.midi - lowMidi) / midiSpan));

      // Lock steady repeated bass root notes to the exact same fret!
      if (Math.abs(deltaSemis) <= 1.2) {
        lane = prevLane;
      } else if (deltaSemis >= 8.5) {
        // Explicit octave jump up!
        lane = Math.min(laneCount - 1, Math.max(prevLane + 2, laneCount - 1));
      } else if (deltaSemis <= -8.5) {
        // Explicit octave drop back down to open string root!
        lane = Math.max(0, Math.min(prevLane - 2, 0));
      } else {
        // Smooth left-to-right fret position mapping
        lane = Math.min(laneCount - 1, Math.max(0, Math.floor(pitchNorm * laneCount)));
      }
      prevMidi = ev.midi;
    } else {
      // Unpitched percussive bass mute/slap stays locked in the current pocket
      lane = prevLane;
      pitchNorm = lane / Math.max(1, laneCount - 1);
    }

    // Measure true sustained bass root duration when there is open breathing room
    let sustainDuration = 0;
    if (gapToNext >= 0.44) {
      const startF = ev.frame;
      const peakRms = Math.max(0.08, ev.rms);
      const maxEndF = Math.min(
        env.frameCount - 1,
        Math.floor((ev.time + Math.min(2.6, gapToNext - 0.16)) / env.hopSec)
      );
      let holdFrames = 0;
      for (let f = startF + 2; f <= maxEndF; f += 1) {
        if (env.rms[f] >= peakRms * 0.42) {
          holdFrames = f - startF;
        } else {
          break;
        }
      }
      const measuredSec = holdFrames * env.hopSec;
      if (measuredSec >= 0.28) {
        sustainDuration = Number(Math.min(measuredSec, gapToNext - 0.15).toFixed(3));
      }
    }

    const hitSec = Number(ev.time.toFixed(4));
    notes.push({
      id: `${trackId}_b_${notes.length}`,
      lane,
      timeSec: hitSec,
      hitTimeSec: hitSec,
      sustainSec: sustainDuration,
      sustainDuration,
      isChord: false, // Authentic basslines play single root/octave grooves rather than guitar chords!
      isFever: false,
      isStar: false,
      pitchNorm,
      drumPart: null,
      hit: false,
      holding: false,
      holdCompleted: false,
      missed: false,
    });
    prevLane = lane;
  }

  markFeverNotes(notes);
  return { bpm, beatGrid, notes };
}

/* ==========================================================================
   3. LEAD GUITAR CHART GENERATOR (Harmonic Riffs, Pitch Contour & Power Chords)
      - Band-pass 300Hz–4.5kHz via OfflineAudioContext + STFT HPSS separation.
      - Tracks melodic riff contours, sustained bends, and loud chorus power chords.
   ========================================================================== */

async function buildGuitarChart({ audioBuffer, stemActivity, trackId, laneCount, difficultyConfig, bpmHint }) {
  const duration = audioBuffer.duration;
  const diffId = difficultyConfig?.id || 'normal';
  const minGapSec = (difficultyConfig?.minNoteGapMs || 200) / 1000;
  const sensitivity = difficultyConfig?.scanSensitivity || 1.38;
  const chordChance = difficultyConfig?.chordChance ?? 0.16;
  const rng = createRng(hashSeed(`${trackId}_guitar_${laneCount}_${diffId}`));

  // Band-pass isolate harmonic lead guitar / melody range (320Hz – 4.2kHz) on the side-isolated Virtual Guitar Stem
  const guitarMono = await renderFilteredMono(
    audioBuffer,
    [
      { type: 'highpass', frequency: 320, Q: 0.72 },
      { type: 'lowpass', frequency: 4200, Q: 0.72 },
    ],
    ANALYSIS_RATE
  );

  // Compute STFT + HPSS harmonic spectrogram (half-wave rectified Spectral Flux!)
  const numFrames = Math.max(1, Math.floor((guitarMono.length - FFT_SIZE) / HOP_SIZE));
  const halfBins = FFT_SIZE >> 1;
  const binHz = ANALYSIS_RATE / FFT_SIZE;
  const hopSec = HOP_SIZE / ANALYSIS_RATE;
  const loBin = Math.max(2, Math.floor(320 / binHz));
  const hiBin = Math.min(halfBins - 1, Math.ceil(4200 / binHz));

  const mag = new Float32Array(numFrames * halfBins);
  const re = new Float32Array(FFT_SIZE);
  const im = new Float32Array(FFT_SIZE);

  for (let f = 0; f < numFrames; f += 1) {
    const base = f * HOP_SIZE;
    for (let i = 0; i < FFT_SIZE; i += 1) {
      re[i] = guitarMono[base + i] * HANN_WINDOW[i];
      im[i] = 0;
    }
    fftRadix2(re, im);
    const rowOff = f * halfBins;
    for (let b = 0; b < halfBins; b += 1) {
      mag[rowOff + b] = Math.hypot(re[b], im[b]);
    }
  }

  // HPSS harmonic extraction + Half-Wave Rectified Spectral Flux
  const harmFlux = new Float32Array(numFrames);
  const harmEnergy = new Float32Array(numFrames);
  const pitchCentroid = new Float32Array(numFrames);
  const prevH = new Float32Array(halfBins);

  let maxEnergy = 1e-6;
  for (let f = 0; f < numFrames; f += 1) {
    const fM2 = Math.max(0, f - 2) * halfBins;
    const fM1 = Math.max(0, f - 1) * halfBins;
    const f0 = f * halfBins;
    const fP1 = Math.min(numFrames - 1, f + 1) * halfBins;
    const fP2 = Math.min(numFrames - 1, f + 2) * halfBins;

    let eSum = 0;
    let fluxSum = 0;
    let weightedFreq = 0;

    for (let b = loBin; b <= hiBin; b += 1) {
      const cur = mag[f0 + b];
      const hEst = median5(mag[fM2 + b], mag[fM1 + b], cur, mag[fP1 + b], mag[fP2 + b]);
      const pEst = median3(mag[f0 + Math.max(0, b - 1)], cur, mag[f0 + Math.min(halfBins - 1, b + 1)]);
      const mask = (hEst * hEst) / (hEst * hEst + pEst * pEst + 1e-10);
      const hVal = cur * mask;

      eSum += hVal;
      weightedFreq += hVal * (b * binHz);
      const diff = hVal - prevH[b] * 0.85;
      if (diff > 0) fluxSum += diff;
      prevH[b] = hVal;
    }

    harmEnergy[f] = eSum;
    harmFlux[f] = fluxSum;
    pitchCentroid[f] = eSum > 1e-5 ? weightedFreq / eSum : 850;
    if (eSum > maxEnergy) maxEnergy = eSum;
  }

  const invE = 1 / Math.max(maxEnergy, 1e-4);
  for (let f = 0; f < numFrames; f += 1) {
    harmEnergy[f] *= invE;
    harmFlux[f] *= invE;
  }

  const { bpm, beatSec, beatPhaseSec } = estimateTempoAndPhase(harmFlux, hopSec, bpmHint);
  const beatGrid = buildBeatGrid(duration, beatSec, beatPhaseSec);
  const localFluxMedian = computeLocalAdaptiveMedian(harmFlux, hopSec, 2.0);
  const localEnergy = computeLocalAdaptiveMean(harmEnergy, hopSec, 2.4);

  // Song-wide active energy median to accurately identify high-energy Chorus / Solo sections!
  const activeEnergies = [];
  for (let f = 0; f < numFrames; f += 4) {
    if (harmEnergy[f] > 0.04) activeEnergies.push(harmEnergy[f]);
  }
  activeEnergies.sort((a, b) => a - b);
  const chorusEnergyFloor = activeEnergies.length >= 8
    ? activeEnergies[Math.floor(activeEnergies.length * 0.64)]
    : 0.28;

  // Detect melodic guitar onsets gated by stemActivity.guitar + Adaptive Local Median Thresholding!
  const subdiv = diffId === 'hard' || diffId === 'expert' ? beatSec / 4 : beatSec / 2;
  const rawOnsets = [];
  let lastT = -1;

  for (let f = 2; f < numFrames - 2; f += 1) {
    const t = f * hopSec;
    if (t < 0.08 || t > duration - 0.12) continue;
    // Step 2 Per-Stem Silence Gate: zero notes when guitar is resting!
    if (!isStemActiveAt(stemActivity, 'guitar', t)) continue;
    const v = harmFlux[f];
    if (v <= 0.014 || harmEnergy[f] < 0.02) continue;
    if (v < harmFlux[f - 1] || v < harmFlux[f + 1]) continue;

    const threshold = Math.max(0.015, localFluxMedian[f] * (sensitivity * 1.18) + 0.011);
    if (v >= threshold && t - lastT >= minGapSec) {
      const pFrame = Math.min(numFrames - 1, f + 2);
      rawOnsets.push({
        time: quantizeToSubdivision(t, beatPhaseSec, subdiv, 0.036),
        frame: f,
        energy: harmEnergy[f],
        sectionEnergy: localEnergy[f],
        pitchHz: pitchCentroid[pFrame],
      });
      lastT = t;
    }
  }

  // Pitch normalization across 10th..90th percentile of song's guitar range
  const pitches = rawOnsets.map((o) => o.pitchHz).sort((a, b) => a - b);
  const loHz = pitches.length >= 6 ? pitches[Math.floor(pitches.length * 0.1)] : 420;
  const hiHz = pitches.length >= 6 ? pitches[Math.floor(pitches.length * 0.9)] : 2400;
  const logLo = Math.log2(Math.max(150, loHz));
  const logSpan = Math.max(1.0, Math.log2(Math.max(loHz + 120, hiHz)) - logLo);

  const notes = [];
  let prevLane = Math.floor(laneCount / 2);
  let prevLogPitch = logLo + logSpan * 0.5;

  for (let i = 0; i < rawOnsets.length; i += 1) {
    const ev = rawOnsets[i];
    const nextEv = rawOnsets[i + 1];
    const gapToNext = nextEv ? nextEv.time - ev.time : duration - ev.time;

    const logPitch = Math.log2(Math.max(150, ev.pitchHz));
    const pitchNorm = Math.max(0, Math.min(1, (logPitch - logLo) / logSpan));
    const deltaLog = logPitch - prevLogPitch;

    // Follow rising/falling melodic contour naturally without erratic cross-fret jumps
    let lane = Math.min(laneCount - 1, Math.max(0, Math.floor(pitchNorm * laneCount)));
    if (Math.abs(deltaLog) < 0.06) {
      lane = prevLane;
    } else if (deltaLog > 0.08 && lane <= prevLane && prevLane < laneCount - 1) {
      lane = prevLane + 1;
    } else if (deltaLog < -0.08 && lane >= prevLane && prevLane > 0) {
      lane = prevLane - 1;
    }
    prevLogPitch = logPitch;

    // Smart sustained guitar bends when melodic energy rings out across empty space
    let sustainDuration = 0;
    if (gapToNext >= 0.45) {
      const startF = ev.frame;
      const peakE = Math.max(0.05, ev.energy);
      const maxEndF = Math.min(
        numFrames - 1,
        Math.floor((ev.time + Math.min(2.4, gapToNext - 0.16)) / hopSec)
      );
      let holdFrames = 0;
      for (let f = startF + 2; f <= maxEndF; f += 1) {
        if (harmEnergy[f] >= peakE * 0.4) {
          holdFrames = f - startF;
        } else {
          break;
        }
      }
      const holdSec = holdFrames * hopSec;
      if (holdSec >= 0.28) {
        sustainDuration = Number(Math.min(holdSec, gapToNext - 0.15).toFixed(3));
      }
    }

    // 2-note Power Chords ONLY on strong downbeats (Beat 1 or Beat 3) during high-energy Chorus / Solo sections!
    const beatFloat = (ev.time - beatPhaseSec) / beatSec;
    const beatInBar = ((Math.round(beatFloat * 2) / 2) % 4 + 4) % 4;
    const isStrongDownbeat =
      Math.abs(beatInBar) < 0.16 ||
      Math.abs(beatInBar - 4) < 0.16 ||
      Math.abs(beatInBar - 2) < 0.16;
    const isHighEnergyChorusOrSolo =
      ev.sectionEnergy >= chorusEnergyFloor && ev.energy >= chorusEnergyFloor * 1.05;

    const makePowerChord =
      chordChance > 0 &&
      isStrongDownbeat &&
      isHighEnergyChorusOrSolo &&
      sustainDuration === 0 &&
      rng() < Math.min(0.85, chordChance * (diffId === 'hard' ? 1.55 : 1.15));

    if (makePowerChord) {
      const partnerLane = lane <= laneCount - 3 ? lane + 2 : Math.max(0, lane - 2);
      const lowL = Math.min(lane, partnerLane);
      const highL = Math.max(lane, partnerLane);
      const hitSec = Number(ev.time.toFixed(4));
      notes.push({
        id: `${trackId}_g_${notes.length}`,
        lane: lowL,
        timeSec: hitSec,
        hitTimeSec: hitSec,
        sustainSec: 0,
        sustainDuration: 0,
        isChord: true,
        isFever: false,
        isStar: false,
        pitchNorm,
        drumPart: null,
        hit: false,
        holding: false,
        holdCompleted: false,
        missed: false,
      });
      notes.push({
        id: `${trackId}_g_${notes.length}`,
        lane: highL,
        timeSec: hitSec,
        hitTimeSec: hitSec,
        sustainSec: 0,
        sustainDuration: 0,
        isChord: true,
        isFever: false,
        isStar: false,
        pitchNorm,
        drumPart: null,
        hit: false,
        holding: false,
        holdCompleted: false,
        missed: false,
      });
    } else {
      const hitSec = Number(ev.time.toFixed(4));
      notes.push({
        id: `${trackId}_g_${notes.length}`,
        lane,
        timeSec: hitSec,
        hitTimeSec: hitSec,
        sustainSec: sustainDuration,
        sustainDuration,
        isChord: false,
        isFever: false,
        isStar: false,
        pitchNorm,
        drumPart: null,
        hit: false,
        holding: false,
        holdCompleted: false,
        missed: false,
      });
    }
    prevLane = lane;
  }

  markFeverNotes(notes);
  return { bpm, beatGrid, notes };
}

/**
 * Converts neural Basic Pitch MIDI events or parsed .mid note events into a clean,
 * BPM-quantized, silence-gated rhythm chart tailored to Instrument & Difficulty:
 *  - Lead Guitar: MIDI 52–88, preserves sustains, groups simultaneous hits into 2-note chords (Hard/Expert).
 *  - Bass:        MIDI 28–51, clean groove holds, zero notes during bass-silent sections.
 *  - Drums (.mid): General MIDI drum map (Kick -> Lane 0, Snare -> Lane 1, Hat/Tom -> Lane 2, Crash -> Top).
 */
function buildChartFromMidiEvents({
  midiEvents,
  duration,
  bpm = 120,
  beatPhaseSec = 0,
  stemActivity = null,
  trackId = 'track',
  instrument = 'guitar',
  laneCount = 4,
  difficultyConfig,
}) {
  const diffId = difficultyConfig?.id || 'medium';
  const allowChords = Boolean(difficultyConfig?.allowChords || diffId === 'hard' || diffId === 'expert');
  const minGapSec = Math.max(0.085, (difficultyConfig?.minNoteGapMs || 210) / 1000);
  const beatSec = 60 / Math.max(68, Math.min(200, bpm || 120));
  const subdiv = diffId === 'hard' || diffId === 'expert' ? beatSec / 4 : beatSec / 2;
  const beatGrid = buildBeatGrid(duration, beatSec, beatPhaseSec);
  const maxLane = Math.max(2, laneCount - 1);

  // Filter strictly by instrument MIDI register + Per-Stem Silence Gate!
  const filtered = [];
  for (let i = 0; i < midiEvents.length; i += 1) {
    const ev = midiEvents[i];
    const t = ev.startTimeSeconds;
    if (t < 0.08 || t > duration - 0.14) continue;
    if (stemActivity && !isStemActiveAt(stemActivity, instrument, t)) continue;
    if ((ev.amplitude ?? 0.6) < 0.18) continue;

    if (instrument === 'guitar') {
      if (ev.pitchMidi < 52 || ev.pitchMidi > 88) continue;
    } else if (instrument === 'bass') {
      if (ev.pitchMidi < 28 || ev.pitchMidi > 51) continue;
    }
    filtered.push(ev);
  }

  if (filtered.length < 10) return null;

  filtered.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);

  // Group simultaneous hits within 38ms so chords are detected cleanly
  const clusters = [];
  for (let i = 0; i < filtered.length; i += 1) {
    const ev = filtered[i];
    const qTime = quantizeToSubdivision(ev.startTimeSeconds, beatPhaseSec, subdiv, 0.042);
    const prevCluster = clusters[clusters.length - 1];
    if (prevCluster && Math.abs(qTime - prevCluster.time) <= 0.038) {
      prevCluster.items.push(ev);
    } else {
      clusters.push({ time: qTime, items: [ev] });
    }
  }

  // Compute dynamic pitch span (10th..90th percentile) for comfortable fret mapping
  const allPitches = filtered.map((e) => e.pitchMidi).sort((a, b) => a - b);
  const loMidi = allPitches[Math.floor(allPitches.length * 0.1)] ?? (instrument === 'bass' ? 32 : 55);
  const hiMidi = allPitches[Math.floor(allPitches.length * 0.9)] ?? (instrument === 'bass' ? 48 : 79);
  const spanMidi = Math.max(5, hiMidi - loMidi);

  const mapMidiToLane = (midi) => {
    if (instrument === 'drums') {
      // General MIDI Percussion Mapping
      if (midi === 35 || midi === 36) return 0; // Kick
      if (midi === 38 || midi === 40 || midi === 37) return 1; // Snare
      if (midi === 49 || midi === 51 || midi === 52 || midi === 55 || midi === 57) return maxLane; // Crash/Ride
      return Math.min(maxLane, 2); // Hi-Hat / Toms
    }
    const norm = Math.max(0, Math.min(0.999, (midi - loMidi) / spanMidi));
    return Math.min(maxLane, Math.floor(norm * laneCount));
  };

  const notes = [];
  let lastTime = -1;

  for (let c = 0; c < clusters.length; c += 1) {
    const cl = clusters[c];
    if (cl.time - lastTime < minGapSec) continue;

    const nextCl = clusters[c + 1];
    const gapToNext = nextCl ? nextCl.time - cl.time : duration - cl.time;

    // Sort cluster items by amplitude descending
    const sorted = cl.items.slice().sort((a, b) => (b.amplitude || 0) - (a.amplitude || 0));
    const chosenLanes = [];
    const chosenItems = [];

    for (let k = 0; k < sorted.length; k += 1) {
      const lane = mapMidiToLane(sorted[k].pitchMidi);
      if (!chosenLanes.includes(lane)) {
        chosenLanes.push(lane);
        chosenItems.push({ item: sorted[k], lane });
      }
      const maxSimultaneous = instrument === 'bass' ? 1 : allowChords ? 2 : 1;
      if (chosenLanes.length >= maxSimultaneous) break;
    }

    const isChord = chosenItems.length > 1;
    for (let k = 0; k < chosenItems.length; k += 1) {
      const { item, lane } = chosenItems[k];
      let sustainDuration = 0;
      if (instrument !== 'drums' && !isChord && item.durationSeconds >= 0.3 && gapToNext >= 0.42) {
        sustainDuration = Number(Math.min(2.6, item.durationSeconds, gapToNext - 0.14).toFixed(3));
        if (sustainDuration < 0.28) sustainDuration = 0;
      }

      const hitSec = Number(cl.time.toFixed(4));
      notes.push({
        id: `${trackId}_m_${notes.length}`,
        lane,
        timeSec: hitSec,
        hitTimeSec: hitSec,
        sustainSec: sustainDuration,
        sustainDuration,
        isChord,
        isFever: false,
        isStar: false,
        pitchNorm: (item.pitchMidi - loMidi) / spanMidi,
        drumPart: instrument === 'drums' ? (lane === 0 ? 'kick' : lane === 1 ? 'snare' : lane === maxLane ? 'crash' : 'hat') : null,
        hit: false,
        holding: false,
        holdCompleted: false,
        missed: false,
      });
    }

    lastTime = cl.time;
  }

  if (notes.length < 12) return null;
  markFeverNotes(notes);
  return { bpm, beatGrid, notes };
}

/**
 * Returns the active song section object (`INTRO`, `VERSE`, `PRE_CHORUS`, `CHORUS`,
 * `GUITAR_SOLO`, `BRIDGE`, `OUTRO`) for a given timestamp.
 */
export function getSongSectionAt(sections, songTime) {
  if (!Array.isArray(sections) || sections.length === 0) {
    return { id: 'default', type: 'VERSE', label: 'Verse', startSec: 0, endSec: 999, energy: 0.65 };
  }
  const t = Math.max(0, songTime || 0);
  for (let i = 0; i < sections.length; i += 1) {
    const s = sections[i];
    if (t >= s.startSec && t < s.endSec) return s;
  }
  return sections[sections.length - 1];
}

/**
 * Builds an arcade-precision chart directly from a parsed Clone Hero `.chart` object,
 * preserving native tempo maps, sustains, Star Power phrases, and song sections!
 */
function buildChartFromCloneHeroChart({ parsedChart, trackId, instrument, laneCount, difficultyConfig }) {
  if (!parsedChart?.tracks) return null;
  const diffId = difficultyConfig?.id || 'medium';
  const roleMap = parsedChart.tracks[instrument] || parsedChart.tracks.guitar;
  if (!roleMap) return null;

  // Prefer exact difficulty tier, falling back cleanly to the closest authored chart
  const prefOrder =
    diffId === 'expert'
      ? ['expert', 'hard', 'medium', 'easy']
      : diffId === 'hard'
        ? ['hard', 'expert', 'medium', 'easy']
        : diffId === 'medium'
          ? ['medium', 'hard', 'easy', 'expert']
          : ['easy', 'medium', 'hard', 'expert'];

  let chosenBlock = null;
  for (let i = 0; i < prefOrder.length; i += 1) {
    if (roleMap[prefOrder[i]]?.notes?.length >= 10) {
      chosenBlock = roleMap[prefOrder[i]];
      break;
    }
  }
  if (!chosenBlock) return null;

  const maxLane = Math.max(2, laneCount - 1);
  const rawNotes = chosenBlock.notes;
  const starPowers = chosenBlock.starPowers || [];

  const isInStarPower = (t) => {
    for (let i = 0; i < starPowers.length; i += 1) {
      if (t >= starPowers[i].startSec - 0.02 && t <= starPowers[i].endSec + 0.02) return true;
    }
    return false;
  };

  // Group simultaneous frets at the same timestamp to detect chords
  const byTime = new Map();
  for (let i = 0; i < rawNotes.length; i += 1) {
    const n = rawNotes[i];
    const key = Math.round(n.timeSec * 100);
    if (!byTime.has(key)) byTime.set(key, []);
    byTime.get(key).push(n);
  }

  const notes = [];
  const allowChords = diffId === 'hard' || diffId === 'expert';

  for (const group of byTime.values()) {
    const usedLanes = [];
    const mapped = [];
    for (let i = 0; i < group.length; i += 1) {
      const n = group[i];
      // Compress 5-fret Clone Hero lanes cleanly onto 3, 4, or 5 lanes
      const lane =
        laneCount >= 5
          ? Math.min(4, n.fret)
          : Math.min(maxLane, Math.floor((n.fret / 5) * laneCount));
      if (!usedLanes.includes(lane)) {
        usedLanes.push(lane);
        mapped.push({ ...n, lane });
      }
      if (mapped.length >= (allowChords ? 2 : 1)) break;
    }

    const isChord = mapped.length > 1;
    for (let i = 0; i < mapped.length; i += 1) {
      const m = mapped[i];
      const inStar = isInStarPower(m.timeSec);
      const sus = instrument === 'drums' || isChord ? 0 : m.sustainSec;
      notes.push({
        id: `${trackId}_ch_${notes.length}`,
        tick: Number.isFinite(m.tick) ? m.tick : undefined,
        lane: m.lane,
        timeSec: m.timeSec,
        hitTimeSec: m.timeSec,
        sustainSec: sus,
        sustainDuration: sus,
        isChord,
        isFever: inStar,
        isStar: inStar,
        pitchNorm: m.lane / Math.max(1, maxLane),
        drumPart:
          instrument === 'drums'
            ? m.lane === 0
              ? 'kick'
              : m.lane === 1
                ? 'snare'
                : m.lane === maxLane
                  ? 'crash'
                  : 'hihat'
            : null,
        hit: false,
        holding: false,
        holdCompleted: false,
        missed: false,
      });
    }
  }

  notes.sort((a, b) => a.hitTimeSec - b.hitTimeSec || a.lane - b.lane);
  if (starPowers.length === 0) markFeverNotes(notes);

  return {
    bpm: parsedChart.bpm || 120,
    beatGrid: parsedChart.dynamicBeatGrid || [],
    sections: parsedChart.sections || null,
    notes,
  };
}

/**
 * Maps sub-second Web Worker guitar onsets (local 2.5s floor + HNR clean-intro detection)
 * quantized to the Dynamic Programming 16th/triplet beat grid!
 */
function buildGuitarChartFromWorker({
  workerAnalysis,
  trackId,
  laneCount,
  difficultyConfig,
}) {
  const {
    bpm,
    beatSec,
    beatPhaseSec,
    syncTrack,
    dynamicBeatGrid,
    sections,
    duration,
    chorusEnergyFloor,
    guitarOnsets,
  } = workerAnalysis;
  const resolvedSync = syncTrack?.length
    ? syncTrack
    : [{ tick: 0, bpm: bpm || 120, timeSec: beatPhaseSec || 0, timeSeconds: beatPhaseSec || 0 }];
  const beatGrid = dynamicBeatGrid?.length
    ? dynamicBeatGrid
    : buildBeatGrid(duration, beatSec, beatPhaseSec, resolvedSync, STANDARD_PPQ);
  const diffId = difficultyConfig?.id || 'medium';
  const minGapSec = Math.max(0.08, (difficultyConfig?.minNoteGapMs || 195) / 1000);
  const strengthFloor = diffId === 'easy' ? 1.28 : diffId === 'medium' ? 1.08 : diffId === 'hard' ? 0.94 : 0.84;
  const chordChance =
    diffId === 'expert' ? 0.44 : diffId === 'hard' ? 0.32 : diffId === 'medium' ? 0.12 : 0;
  const rng = createRng(hashSeed(`${trackId}_wguitar_${diffId}`));

  const filtered = [];
  let lastT = -1;
  for (let i = 0; i < (guitarOnsets || []).length; i += 1) {
    const ev = guitarOnsets[i];
    if (!ev.isDensityFallback) {
      const isQuietSection = chorusEnergyFloor > 0 && ev.sectionEnergy < chorusEnergyFloor * 0.72;
      const isCleanIntro = isQuietSection && ev.hnr >= 2.8;
      const reqStrength = isCleanIntro
        ? strengthFloor * 0.72
        : isQuietSection
          ? strengthFloor * 0.78
          : strengthFloor;
      if (ev.strength < reqStrength) continue;
    }

    const tick = Number.isFinite(ev.tick)
      ? Math.max(0, Math.round(ev.tick))
      : quantizeTickTo192Subdiv(timeToTick(ev.exactTimeSec ?? ev.time ?? 0, resolvedSync, STANDARD_PPQ));
    const exactTime = Number(tickToTime(tick, resolvedSync, STANDARD_PPQ).toFixed(4));
    if (exactTime < 0.04 || exactTime > duration - 0.12) continue;
    if (exactTime - lastT < minGapSec) continue;
    filtered.push({ ...ev, tick, time: exactTime, exactTimeSec: exactTime });
    lastT = exactTime;
  }

  // Dynamic pitch span (10th..90th percentile) across the guitar's true melodic range
  const pitches = filtered.map((o) => o.pitchHz).sort((a, b) => a - b);
  const loHz = pitches.length >= 6 ? pitches[Math.floor(pitches.length * 0.1)] : 220;
  const hiHz = pitches.length >= 6 ? pitches[Math.floor(pitches.length * 0.9)] : 1650;
  const logLo = Math.log2(Math.max(120, loHz));
  const logSpan = Math.max(1.0, Math.log2(Math.max(loHz + 100, hiHz)) - logLo);

  const notes = [];
  let prevLane = Math.floor(laneCount / 2);
  let prevHz = 0;
  let lastSingleTick = -9999;

  for (let i = 0; i < filtered.length; i += 1) {
    const ev = filtered[i];
    const nextEv = filtered[i + 1];
    const tick = ev.tick;
    const hitSec = ev.exactTimeSec;
    const nextTick = nextEv ? nextEv.tick : tick + 768;
    const gapTicks = Math.max(0, nextTick - tick);

    const hz = Math.max(120, ev.pitchHz || (loHz + hiHz) * 0.5);
    const logPitch = Math.log2(hz);
    const pitchNorm = Math.max(0, Math.min(1, (logPitch - logLo) / logSpan));

    let lane = Math.min(laneCount - 1, Math.max(0, Math.round(pitchNorm * (laneCount - 1))));
    if (prevHz > 0) {
      const semitones = 12 * Math.log2(hz / prevHz);
      if (Math.abs(semitones) < 0.85) {
        lane = prevLane;
      } else if (semitones >= 0.85 && lane <= prevLane && prevLane < laneCount - 1) {
        lane = Math.min(laneCount - 1, prevLane + (semitones > 4.5 && laneCount >= 4 ? 2 : 1));
      } else if (semitones <= -0.85 && lane >= prevLane && prevLane > 0) {
        lane = Math.max(0, prevLane - (semitones < -4.5 && laneCount >= 4 ? 2 : 1));
      } else if (Math.abs(lane - prevLane) > 2 && tick - lastSingleTick < 96) {
        lane = prevLane + Math.sign(lane - prevLane) * 2;
      }
    }
    prevHz = hz;

    const rawSusTicks =
      ev.sustainSec > 0
        ? Math.round((Math.min(2.6, ev.sustainSec) / Math.max(0.25, beatSec)) * STANDARD_PPQ)
        : 0;
    const clampedSusTicks = Math.min(rawSusTicks, Math.max(0, gapTicks - 48));
    const sustainTicks = clampedSusTicks > 240 ? Math.round(clampedSusTicks / 48) * 48 : 0;
    const sustainDuration =
      sustainTicks > 0
        ? Number(Math.max(0, tickToTime(tick + sustainTicks, resolvedSync, STANDARD_PPQ) - hitSec).toFixed(4))
        : 0;

    const sec = getSongSectionAt(sections, hitSec);
    const isStrongDownbeat = tick % 384 === 0;
    const isHighEnergyChorus =
      sec.type === 'CHORUS' || ev.sectionEnergy >= chorusEnergyFloor * 0.85;

    const makeChord =
      chordChance > 0 &&
      laneCount >= 4 &&
      isStrongDownbeat &&
      isHighEnergyChorus &&
      sec.type !== 'GUITAR_SOLO' &&
      sustainTicks === 0 &&
      rng() < chordChance;

    if (makeChord) {
      // Authentic Clone Hero 2-note Power Chords: [0,2] Green+Yellow or [1,3] Red+Blue
      const pair = lane <= 1 ? [0, 2] : [1, Math.min(laneCount - 1, 3)];
      const lowL = pair[0];
      const highL = pair[1];
      [lowL, highL].forEach((l) => {
        notes.push({
          id: `${trackId}_wg_${notes.length}`,
          tick,
          lane: l,
          timeSec: hitSec,
          hitTimeSec: hitSec,
          sustainTicks: 0,
          sustainSec: 0,
          sustainDuration: 0,
          isChord: true,
          isFever: false,
          isStar: false,
          pitchNorm,
          drumPart: null,
          hit: false,
          holding: false,
          holdCompleted: false,
          missed: false,
        });
      });
      lastSingleTick = -9999;
    } else {
      notes.push({
        id: `${trackId}_wg_${notes.length}`,
        tick,
        lane,
        timeSec: hitSec,
        hitTimeSec: hitSec,
        sustainTicks,
        sustainSec: sustainDuration,
        sustainDuration,
        isChord: false,
        isFever: false,
        isStar: false,
        pitchNorm,
        drumPart: null,
        hit: false,
        holding: false,
        holdCompleted: false,
        missed: false,
      });
      lastSingleTick = tick;
    }

    prevLane = lane;
  }

  notes.sort((a, b) => a.tick - b.tick || a.hitTimeSec - b.hitTimeSec || a.lane - b.lane);
  markFeverNotes(notes);
  return { bpm, beatGrid, sections, notes };
}

/**
 * Maps sub-second Web Worker bass onsets (45–210Hz fundamental pitch + autocorrelation)
 * locked strictly to the 192 PPQ beat grid with quantized >240-tick sustain holds.
 */
function buildBassChartFromWorker({
  workerAnalysis,
  trackId,
  laneCount,
  difficultyConfig,
}) {
  const { bpm, beatSec, beatPhaseSec, syncTrack, dynamicBeatGrid, sections, duration, chorusEnergyFloor, bassOnsets } = workerAnalysis;
  const resolvedSync = syncTrack?.length
    ? syncTrack
    : [{ tick: 0, bpm: bpm || 120, timeSec: beatPhaseSec || 0, timeSeconds: beatPhaseSec || 0 }];
  const beatGrid = dynamicBeatGrid?.length
    ? dynamicBeatGrid
    : buildBeatGrid(duration, beatSec, beatPhaseSec, resolvedSync, STANDARD_PPQ);
  const diffId = difficultyConfig?.id || 'medium';
  const minGapSec = Math.max(0.11, (difficultyConfig?.minNoteGapMs || 220) / 1000);
  const strengthFloor = diffId === 'easy' ? 1.32 : diffId === 'medium' ? 1.12 : diffId === 'hard' ? 0.98 : 0.88;

  const filtered = [];
  let lastT = -1;
  for (let i = 0; i < (bassOnsets || []).length; i += 1) {
    const ev = bassOnsets[i];
    if (!ev.isDensityFallback) {
      const isQuietBridge = chorusEnergyFloor > 0 && ev.sectionEnergy < chorusEnergyFloor * 0.72;
      if (ev.strength < (isQuietBridge ? strengthFloor * 0.72 : strengthFloor)) continue;
    }
    const tick = Number.isFinite(ev.tick)
      ? Math.max(0, Math.round(ev.tick))
      : quantizeTickTo192Subdiv(timeToTick(ev.exactTimeSec ?? ev.time ?? 0, resolvedSync, STANDARD_PPQ));
    const exactTime = Number(tickToTime(tick, resolvedSync, STANDARD_PPQ).toFixed(4));
    if (exactTime < 0.04 || exactTime > duration - 0.12) continue;
    if (exactTime - lastT < minGapSec) continue;
    filtered.push({ ...ev, tick, time: exactTime, exactTimeSec: exactTime });
    lastT = exactTime;
  }

  const pitches = filtered.map((o) => o.pitchHz).sort((a, b) => a - b);
  const loHz = pitches.length >= 6 ? pitches[Math.floor(pitches.length * 0.1)] : 55;
  const hiHz = pitches.length >= 6 ? pitches[Math.floor(pitches.length * 0.9)] : 165;
  const logLo = Math.log2(Math.max(40, loHz));
  const logSpan = Math.max(0.75, Math.log2(Math.max(loHz + 25, hiHz)) - logLo);

  const notes = [];
  let prevLane = 0;
  let prevHz = 0;

  for (let i = 0; i < filtered.length; i += 1) {
    const ev = filtered[i];
    const nextEv = filtered[i + 1];
    const tick = ev.tick;
    const hitSec = ev.exactTimeSec;
    const nextTick = nextEv ? nextEv.tick : tick + 768;
    const gapTicks = Math.max(0, nextTick - tick);

    const hz = Math.max(40, ev.pitchHz || 82);
    const logPitch = Math.log2(hz);
    const pitchNorm = Math.max(0, Math.min(1, (logPitch - logLo) / logSpan));

    let lane = Math.min(laneCount - 1, Math.max(0, Math.round(pitchNorm * (laneCount - 1))));
    if (prevHz > 0) {
      const semitones = 12 * Math.log2(hz / prevHz);
      if (Math.abs(semitones) < 0.85) {
        lane = prevLane;
      } else if (semitones >= 0.85 && lane <= prevLane && prevLane < laneCount - 1) {
        lane = prevLane + 1;
      } else if (semitones <= -0.85 && lane >= prevLane && prevLane > 0) {
        lane = prevLane - 1;
      }
    }
    prevHz = hz;

    const rawSusTicks =
      ev.sustainSec > 0
        ? Math.round((Math.min(2.6, ev.sustainSec) / Math.max(0.25, beatSec)) * STANDARD_PPQ)
        : 0;
    const clampedSusTicks = Math.min(rawSusTicks, Math.max(0, gapTicks - 48));
    const sustainTicks = clampedSusTicks > 240 ? Math.round(clampedSusTicks / 48) * 48 : 0;
    const sustainDuration =
      sustainTicks > 0
        ? Number(Math.max(0, tickToTime(tick + sustainTicks, resolvedSync, STANDARD_PPQ) - hitSec).toFixed(4))
        : 0;

    notes.push({
      id: `${trackId}_wb_${notes.length}`,
      tick,
      lane,
      timeSec: hitSec,
      hitTimeSec: hitSec,
      sustainTicks,
      sustainSec: sustainDuration,
      sustainDuration,
      isChord: false,
      isFever: false,
      isStar: false,
      pitchNorm,
      drumPart: null,
      hit: false,
      holding: false,
      holdCompleted: false,
      missed: false,
    });
    prevLane = lane;
  }

  notes.sort((a, b) => a.tick - b.tick || a.hitTimeSec - b.hitTimeSec || a.lane - b.lane);
  markFeverNotes(notes);
  return { bpm, beatGrid, sections, notes };
}

/**
 * Maps sub-second Web Worker percussive drum events locked strictly to 192 PPQ
 * subdivisions of the master beat grid (strictly ZERO drum notes during drumless intros).
 */
function buildDrumsChartFromWorker({
  workerAnalysis,
  trackId,
  laneCount,
  difficultyConfig,
}) {
  const { bpm, beatSec, beatPhaseSec, syncTrack, dynamicBeatGrid, sections, duration, drumEvents } = workerAnalysis;
  const resolvedSync = syncTrack?.length
    ? syncTrack
    : [{ tick: 0, bpm: bpm || 120, timeSec: beatPhaseSec || 0, timeSeconds: beatPhaseSec || 0 }];
  const beatGrid = dynamicBeatGrid?.length
    ? dynamicBeatGrid
    : buildBeatGrid(duration, beatSec, beatPhaseSec, resolvedSync, STANDARD_PPQ);
  const diffId = difficultyConfig?.id || 'medium';
  const maxLane = Math.max(2, laneCount - 1);
  const minGapSec = Math.max(0.085, (difficultyConfig?.minNoteGapMs || 195) / 1000);
  const allowFlams = diffId === 'hard' || diffId === 'expert';

  const clusters = [];
  for (let i = 0; i < (drumEvents || []).length; i += 1) {
    const ev = drumEvents[i];
    if (!ev.isDensityFallback && diffId === 'easy' && ev.part === 'hihat' && ev.strength < 0.015) continue;

    const tick = Number.isFinite(ev.tick)
      ? Math.max(0, Math.round(ev.tick))
      : quantizeTickTo192Subdiv(timeToTick(ev.exactTimeSec ?? ev.time ?? 0, resolvedSync, STANDARD_PPQ));
    const exactTime = Number(tickToTime(tick, resolvedSync, STANDARD_PPQ).toFixed(4));
    if (exactTime < 0.04 || exactTime > duration - 0.12) continue;

    const prev = clusters[clusters.length - 1];
    if (prev && Math.abs(tick - prev.tick) <= 12) {
      prev.items.push({ ...ev, tick });
    } else {
      clusters.push({ tick, time: exactTime, items: [{ ...ev, tick }] });
    }
  }

  const partPriority = { crash: 5, kick: 4, snare: 3, tom: 2, hihat: 1 };
  const partToLane = (part) => {
    if (part === 'kick') return 0;
    if (part === 'snare') return 1;
    if (part === 'tom') return laneCount >= 4 ? Math.min(maxLane, 3) : Math.min(maxLane, 2);
    if (part === 'crash') return maxLane;
    return Math.min(maxLane, 2);
  };

  const notes = [];
  let lastT = -1;

  for (let c = 0; c < clusters.length; c += 1) {
    const cl = clusters[c];
    if (cl.time - lastT < minGapSec) continue;

    const sorted = cl.items.slice().sort((a, b) => {
      const pDiff = (partPriority[b.part] || 0) - (partPriority[a.part] || 0);
      if (pDiff !== 0) return pDiff;
      return (b.strength || 0) - (a.strength || 0);
    });

    const chosen = [];
    const usedLanes = [];
    const maxHits = allowFlams ? 2 : 1;

    for (let k = 0; k < sorted.length; k += 1) {
      const ev = sorted[k];
      const lane = partToLane(ev.part);
      if (!usedLanes.includes(lane)) {
        usedLanes.push(lane);
        chosen.push({ lane, part: ev.part, tick: cl.tick, strength: ev.strength || 0 });
      }
      if (chosen.length >= maxHits) break;
    }

    const isChord = chosen.length > 1;
    const hitSec = cl.time;
    for (let k = 0; k < chosen.length; k += 1) {
      const item = chosen[k];
      notes.push({
        id: `${trackId}_wd_${notes.length}`,
        tick: item.tick,
        lane: item.lane,
        timeSec: hitSec,
        hitTimeSec: hitSec,
        sustainTicks: 0,
        sustainSec: 0,
        sustainDuration: 0,
        isChord,
        isFever: false,
        isStar: false,
        isAccent: item.part === 'crash' || item.strength >= 2.1,
        pitchNorm: item.lane / Math.max(1, laneCount - 1),
        drumPart: item.part,
        hit: false,
        holding: false,
        holdCompleted: false,
        missed: false,
      });
    }
    lastT = cl.time;
  }

  notes.sort((a, b) => a.tick - b.tick || a.hitTimeSec - b.hitTimeSec || a.lane - b.lane);
  markFeverNotes(notes);
  return { bpm, beatGrid, sections, notes };
}

/**
 * Maps sub-second Web Worker Piano/Keys harmonic onsets (130Hz–2.2kHz / MIDI 48–84)
 * locked strictly to the 192 PPQ beat grid with quantized chord voicings & arpeggio runs!
 */
function buildPianoChartFromWorker({
  workerAnalysis,
  trackId,
  laneCount,
  difficultyConfig,
}) {
  const {
    bpm,
    beatSec,
    beatPhaseSec,
    syncTrack,
    dynamicBeatGrid,
    sections,
    duration,
    chorusEnergyFloor,
    pianoOnsets,
    guitarOnsets,
  } = workerAnalysis;
  const resolvedSync = syncTrack?.length
    ? syncTrack
    : [{ tick: 0, bpm: bpm || 120, timeSec: beatPhaseSec || 0, timeSeconds: beatPhaseSec || 0 }];
  const sourceOnsets = workerAnalysis?.analysisEngine
    ? (pianoOnsets || [])
    : (pianoOnsets?.length >= 10 ? pianoOnsets : guitarOnsets || []);
  const beatGrid = dynamicBeatGrid?.length
    ? dynamicBeatGrid
    : buildBeatGrid(duration, beatSec, beatPhaseSec, resolvedSync, STANDARD_PPQ);
  const diffId = difficultyConfig?.id || 'medium';
  const minGapSec = Math.max(0.09, (difficultyConfig?.minNoteGapMs || 205) / 1000);
  const strengthFloor = diffId === 'easy' ? 1.28 : diffId === 'medium' ? 1.08 : diffId === 'hard' ? 0.94 : 0.84;
  const chordChance =
    diffId === 'expert' ? 0.56 : diffId === 'hard' ? 0.42 : diffId === 'medium' ? 0.24 : 0;
  const rng = createRng(hashSeed(`${trackId}_wpiano_${diffId}`));

  const filtered = [];
  let lastT = -1;
  for (let i = 0; i < sourceOnsets.length; i += 1) {
    const ev = sourceOnsets[i];
    if (!ev.isDensityFallback) {
      const isIntroPiano = chorusEnergyFloor > 0 && ev.sectionEnergy < chorusEnergyFloor * 0.72;
      const reqStrength = isIntroPiano ? strengthFloor * 0.72 : strengthFloor;
      if (ev.strength < reqStrength) continue;
    }

    const tick = Number.isFinite(ev.tick)
      ? Math.max(0, Math.round(ev.tick))
      : quantizeTickTo192Subdiv(timeToTick(ev.exactTimeSec ?? ev.time ?? 0, resolvedSync, STANDARD_PPQ));
    const exactTime = Number(tickToTime(tick, resolvedSync, STANDARD_PPQ).toFixed(4));
    if (exactTime < 0.04 || exactTime > duration - 0.12) continue;
    if (exactTime - lastT < minGapSec) continue;
    filtered.push({ ...ev, tick, time: exactTime, exactTimeSec: exactTime });
    lastT = exactTime;
  }

  const pitches = filtered.map((o) => o.pitchHz).sort((a, b) => a - b);
  const loHz = pitches.length >= 6 ? pitches[Math.floor(pitches.length * 0.08)] : 165;
  const hiHz = pitches.length >= 6 ? pitches[Math.floor(pitches.length * 0.92)] : 1450;
  const logLo = Math.log2(Math.max(120, loHz));
  const logSpan = Math.max(1.1, Math.log2(Math.max(loHz + 120, hiHz)) - logLo);

  const notes = [];
  let prevLane = Math.floor(laneCount / 2);
  let arpeggioDir = 1;

  for (let i = 0; i < filtered.length; i += 1) {
    const ev = filtered[i];
    const nextEv = filtered[i + 1];
    const tick = ev.tick;
    const hitSec = ev.exactTimeSec;
    const nextTick = nextEv ? nextEv.tick : tick + 768;
    const gapTicks = Math.max(0, nextTick - tick);

    const logPitch = Math.log2(Math.max(120, ev.pitchHz));
    const pitchNorm = Math.max(0, Math.min(1, (logPitch - logLo) / logSpan));
    let lane = Math.min(laneCount - 1, Math.max(0, Math.round(pitchNorm * (laneCount - 1))));

    // Cascading piano arpeggio runs when consecutive notes flow quickly!
    if (gapTicks <= 144 && lane === prevLane) {
      if (prevLane + arpeggioDir < 0 || prevLane + arpeggioDir >= laneCount) {
        arpeggioDir = -arpeggioDir;
      }
      lane = Math.max(0, Math.min(laneCount - 1, prevLane + arpeggioDir));
    }

    const rawSusTicks =
      ev.sustainSec > 0
        ? Math.round((Math.min(2.8, ev.sustainSec) / Math.max(0.25, beatSec)) * STANDARD_PPQ)
        : 0;
    const clampedSusTicks = Math.min(rawSusTicks, Math.max(0, gapTicks - 48));
    const sustainTicks = clampedSusTicks > 240 ? Math.round(clampedSusTicks / 48) * 48 : 0;
    const sustainDuration =
      sustainTicks > 0
        ? Number(Math.max(0, tickToTime(tick + sustainTicks, resolvedSync, STANDARD_PPQ) - hitSec).toFixed(4))
        : 0;

    const isStrongBeat = tick % 384 === 0;
    const makeChord =
      chordChance > 0 &&
      (ev.isPolyphonic || isStrongBeat) &&
      rng() < (ev.isPolyphonic ? chordChance : chordChance * 0.68);

    if (makeChord && laneCount >= 3) {
      const isTriad = laneCount >= 4 && ev.chromaVoices?.length >= 3 && (diffId === 'hard' || diffId === 'expert');
      let chordLanes;
      if (isTriad) {
        const l0 = Math.max(0, Math.min(laneCount - 3, lane - 1));
        chordLanes = [l0, l0 + 1, l0 + 2];
      } else {
        const partner = lane <= laneCount - 3 ? lane + 2 : Math.max(0, lane - 2);
        chordLanes = [Math.min(lane, partner), Math.max(lane, partner)];
      }
      const leftSusTicks =
        sustainTicks > 240 ? sustainTicks : gapTicks >= 336 ? 288 : 0;
      const leftSustain =
        leftSusTicks > 0
          ? Number(Math.max(0, tickToTime(tick + leftSusTicks, resolvedSync, STANDARD_PPQ) - hitSec).toFixed(4))
          : 0;
      chordLanes.forEach((l, chordIdx) => {
        const hand = chordIdx === 0 ? 'left' : 'right';
        const noteSusTicks = hand === 'left' ? leftSusTicks : sustainTicks > 240 ? sustainTicks : 0;
        const noteSus = hand === 'left' ? leftSustain : sustainTicks > 240 ? sustainDuration : 0;
        notes.push({
          id: `${trackId}_wp_${notes.length}`,
          tick,
          lane: l,
          timeSec: hitSec,
          hitTimeSec: hitSec,
          sustainTicks: noteSusTicks,
          sustainSec: noteSus,
          sustainDuration: noteSus,
          isChord: true,
          isFever: false,
          isStar: false,
          isAccent: Boolean(isStrongBeat || ev.strength >= 2.1),
          pianoHand: hand,
          pitchNorm,
          drumPart: null,
          hit: false,
          holding: false,
          holdCompleted: false,
          missed: false,
        });
      });
    } else {
      const hand = ev.pianoHand || (ev.pitchHz < 270 || lane <= 1 ? 'left' : 'right');
      notes.push({
        id: `${trackId}_wp_${notes.length}`,
        tick,
        lane,
        timeSec: hitSec,
        hitTimeSec: hitSec,
        sustainTicks,
        sustainSec: sustainDuration,
        sustainDuration,
        isChord: false,
        isFever: false,
        isStar: false,
        isAccent: Boolean(isStrongBeat || ev.strength >= 2.15),
        pianoHand: hand,
        pitchNorm,
        drumPart: null,
        hit: false,
        holding: false,
        holdCompleted: false,
        missed: false,
      });
    }

    prevLane = lane;
  }

  notes.sort((a, b) => a.tick - b.tick || a.hitTimeSec - b.hitTimeSec || a.lane - b.lane);
  markFeverNotes(notes);
  return { bpm, beatGrid, sections, notes };
}

/**
 * Public entry point:
 *  1. Runs our Sub-Second Web Worker DP Beat-Grid + Song-Section Segmentation + Multi-Cue FFT engine
 *     (reusing cached workerAnalysis for instant 0ms switches!).
 *  2. If a `.chart` (Clone Hero) or `.mid` file is attached, loads exact arcade notes & native song sections!
 *  3. Otherwise maps the worker's dynamic-beat-locked Guitar, Bass, or Drum detections to the chosen difficulty.
 */
export async function analyzeAndBuildChart({
  audioBuffer,
  cachedWorkerAnalysis = null,
  stemActivity = null,
  midiBytes = null,
  chartText = null,
  onProgress = () => {},
  trackId = 'track',
  instrument = 'guitar',
  laneCount = 4,
  difficultyConfig,
  bpmHint = null,
  jobId = null,
}) {
  // 1. Sub-second Web Worker DP Beat Tracker + Song-Section + FFT pass (runs once per song!)
  let workerAnalysis = cachedWorkerAnalysis;
  if (!workerAnalysis) {
    workerAnalysis = await analyzeAudioInWorker(audioBuffer, {
      bpmHint,
      jobId,
      onProgress,
    });
  } else {
    onProgress(0.85, 'Building chart from cached analysis…');
  }

  const activity = stemActivity || workerAnalysis.stemActivity;
  let estimatedBpm = workerAnalysis.bpm || bpmHint || 120;
  let resolvedSections = workerAnalysis.sections || [];

  // 2A. Direct Clone Hero `.chart` file support (100% arcade precision + native section markers!)
  if (chartText) {
    onProgress(0.88, 'Reading Clone Hero .chart notes & sections…');
    const parsedCh = parseCloneHeroChart(chartText, audioBuffer.duration);
    if (parsedCh) {
      if (parsedCh.sections?.length) resolvedSections = parsedCh.sections;
      const chChart = buildChartFromCloneHeroChart({
        parsedChart: parsedCh,
        trackId,
        instrument,
        laneCount,
        difficultyConfig,
      });
      if (chChart && chChart.notes.length >= 10) {
        const chSyncTrack = parsedCh.syncTrack?.length
          ? parsedCh.syncTrack
          : [{ tick: 0, bpm: chChart.bpm || estimatedBpm, timeSec: 0, timeSeconds: 0 }];
        stamp192TicksAndHopos(chChart.notes, {
          syncTrack: chSyncTrack,
          resolution: STANDARD_PPQ,
          instrument,
          bpm: chChart.bpm || estimatedBpm,
          minSustainTicks: 48,
        });
        const chBre = computeBigRockEndingWindow(chChart.notes, audioBuffer.duration, resolvedSections);
        injectPangguloHazards(chChart.notes, {
          difficultyId: difficultyConfig?.id || 'medium',
          laneCount,
          sections: resolvedSections,
          beatGrid: chChart.beatGrid,
          syncTrack: chSyncTrack,
          resolution: STANDARD_PPQ,
          trackId,
          excludeAfterSec: chBre ? chBre.startSec - 1.2 : Infinity,
        });
        onProgress(1, 'Clone Hero chart ready!');
        return {
          ...chChart,
          resolution: STANDARD_PPQ,
          syncTrack: chSyncTrack,
          breWindow: chBre,
          sections: resolvedSections,
          stemActivity: activity,
          workerAnalysis,
          chartSource: 'clone-hero-chart',
        };
      }
    }
  }

  // 2B. Direct `.mid` file support (@tonejs/midi + pure-JS SMF fallback + native section markers)
  if (midiBytes) {
    onProgress(0.88, 'Reading attached MIDI chart…');
    const parsedMidi = await parseMidiArrayBuffer(midiBytes);
    if (parsedMidi) {
      estimatedBpm = parsedMidi.bpm || estimatedBpm;
      if (parsedMidi.sections?.length) resolvedSections = parsedMidi.sections;
      const roleNotes = parsedMidi.notes[instrument];
      if (roleNotes && roleNotes.length >= 12) {
        const midiChart = buildChartFromMidiEvents({
          midiEvents: roleNotes,
          duration: audioBuffer.duration,
          bpm: estimatedBpm,
          beatPhaseSec: workerAnalysis.beatPhaseSec || 0,
          stemActivity: activity,
          trackId,
          instrument,
          laneCount,
          difficultyConfig,
        });
        if (midiChart) {
          const finalBeatGrid = workerAnalysis.dynamicBeatGrid?.length
            ? workerAnalysis.dynamicBeatGrid
            : midiChart.beatGrid;
          const phaseSec = workerAnalysis?.beatPhaseSec || 0;
          const midiSyncTrack = workerAnalysis?.syncTrack?.length
            ? workerAnalysis.syncTrack
            : [{ tick: 0, bpm: estimatedBpm, timeSec: phaseSec, timeSeconds: phaseSec }];
          stamp192TicksAndHopos(midiChart.notes, {
            syncTrack: midiSyncTrack,
            resolution: STANDARD_PPQ,
            instrument,
            bpm: estimatedBpm,
            minSustainTicks: 48,
          });
          const midiBre = computeBigRockEndingWindow(midiChart.notes, audioBuffer.duration, resolvedSections);
          injectPangguloHazards(midiChart.notes, {
            difficultyId: difficultyConfig?.id || 'medium',
            laneCount,
            sections: resolvedSections,
            beatGrid: finalBeatGrid,
            syncTrack: midiSyncTrack,
            resolution: STANDARD_PPQ,
            trackId,
            excludeAfterSec: midiBre ? midiBre.startSec - 1.2 : Infinity,
          });
          onProgress(1, 'MIDI chart ready!');
          return {
            ...midiChart,
            resolution: STANDARD_PPQ,
            syncTrack: midiSyncTrack,
            breWindow: midiBre,
            beatGrid: finalBeatGrid,
            sections: resolvedSections,
            stemActivity: activity,
            workerAnalysis,
            chartSource: 'midi',
          };
        }
      }
    }
  }

  // 3. Build Instrument-Distinct Chart directly from Offline 4-Stem + Stem-Locked 192 PPQ Worker Analysis
  onProgress(
    0.96,
    instrument === 'drums'
      ? 'Stage 5/5: Mapping Kick, Snare, Tom & Cymbal hits to 192 PPQ (96%)...'
      : instrument === 'piano'
        ? 'Stage 5/5: Voicing 12-TET Piano chords & arpeggios (96%)...'
        : 'Stage 5/5: Mapping sample-accurate 192 PPQ stems to highway (96%)...'
  );
  let result;
  if (instrument === 'drums') {
    result = buildDrumsChartFromWorker({
      workerAnalysis,
      trackId,
      laneCount,
      difficultyConfig,
    });
  } else if (instrument === 'bass') {
    result = buildBassChartFromWorker({
      workerAnalysis,
      trackId,
      laneCount,
      difficultyConfig,
    });
  } else if (instrument === 'piano') {
    result = buildPianoChartFromWorker({
      workerAnalysis,
      trackId,
      laneCount,
      difficultyConfig,
    });
  } else {
    result = buildGuitarChartFromWorker({
      workerAnalysis,
      trackId,
      laneCount,
      difficultyConfig,
    });
  }

  // Graceful fallback to legacy offline pass only if the 4-stem worker did not run
  if (!workerAnalysis?.analysisEngine && (!result || result.notes.length < 8)) {
    if (instrument === 'drums') {
      result = await buildDrumsChart({
        audioBuffer,
        stemActivity: activity,
        trackId,
        laneCount,
        difficultyConfig,
        bpmHint: estimatedBpm,
      });
    } else if (instrument === 'bass') {
      result = await buildBassChart({
        audioBuffer,
        stemActivity: activity,
        trackId,
        laneCount,
        difficultyConfig,
        bpmHint: estimatedBpm,
      });
    } else {
      result = await buildGuitarChart({
        audioBuffer,
        stemActivity: activity,
        trackId,
        laneCount,
        difficultyConfig,
        bpmHint: estimatedBpm,
      });
    }
  }

  const finalSections = result.sections?.length ? result.sections : resolvedSections;
  const phaseSec = workerAnalysis?.firstBeatSec ?? workerAnalysis?.beatPhaseSec ?? 0;
  const resolvedSyncTrack =
    workerAnalysis?.syncTrack?.length
      ? workerAnalysis.syncTrack
      : [{ tick: 0, bpm: estimatedBpm, timeSec: phaseSec, timeSeconds: phaseSec }];

  stamp192TicksAndHopos(result.notes, {
    syncTrack: resolvedSyncTrack,
    resolution: STANDARD_PPQ,
    instrument,
    bpm: result.bpm || estimatedBpm,
  });

  const breWindow = computeBigRockEndingWindow(result.notes, audioBuffer.duration, finalSections);
  if (breWindow) {
    // Clear regular notes inside the final Big Rock Ending freestyle zone so the player gets a pure BRE lane blast!
    for (let i = result.notes.length - 1; i >= 0; i -= 1) {
      if (result.notes[i].hitTimeSec >= breWindow.startSec && result.notes[i].hitTimeSec <= breWindow.endSec) {
        result.notes.splice(i, 1);
      }
    }
  }

  injectPangguloHazards(result.notes, {
    difficultyId: difficultyConfig?.id || 'medium',
    laneCount,
    sections: finalSections,
    beatGrid: result.beatGrid,
    syncTrack: resolvedSyncTrack,
    resolution: STANDARD_PPQ,
    trackId,
    excludeAfterSec: breWindow ? breWindow.startSec - 1.2 : Infinity,
  });

  result.notes.sort((a, b) => (a.tick ?? 0) - (b.tick ?? 0) || a.hitTimeSec - b.hitTimeSec || a.lane - b.lane);
  onProgress(1, 'Ready — Cached to IndexedDB!');
  return {
    ...result,
    resolution: STANDARD_PPQ,
    firstBeatSec: phaseSec,
    syncTrack: resolvedSyncTrack,
    breWindow,
    sections: finalSections,
    trackMeta: workerAnalysis?.trackMeta || null,
    stemActivity: activity,
    workerAnalysis,
    chartSource: workerAnalysis?.analysisEngine || 'cpu-dsp-4stem-hpss-192ppq',
  };
}

/**
 * Stamps unified 192 PPQ integer tick positions, recomputes hitTimeSec/timeSec EXCLUSIVELY from
 * [SyncTrack] via tickToTime(tick), sets sustainTicks (>240 ticks on DSP charts), accent flags,
 * and automatic Clone Hero-style HOPO flags (dtTicks > 0 && dtTicks <= 48 on different lanes).
 */
function stamp192TicksAndHopos(
  notes,
  { syncTrack = [], resolution = STANDARD_PPQ, instrument = 'guitar', bpm = 120, minSustainTicks = 240 } = {}
) {
  if (!Array.isArray(notes) || notes.length === 0) return;
  const allowHopos = instrument !== 'drums';
  const hasSync = Array.isArray(syncTrack) && syncTrack.length > 0;
  const secPerTick = 60 / (Math.max(55, bpm) * resolution);

  // First pass: lock every note strictly onto a 192-PPQ integer tick & tickToTime() timestamp
  for (let i = 0; i < notes.length; i += 1) {
    const n = notes[i];
    const rawHitSec = Number(n.hitTimeSec ?? n.timeSec ?? 0);
    const tick =
      Number.isFinite(n.tick) && n.tick >= 0
        ? Math.round(n.tick)
        : quantizeTickTo192Subdiv(Math.max(0, timeToTick(rawHitSec, syncTrack, resolution)));
    n.tick = tick;
    const exactSec = hasSync
      ? Number(tickToTime(tick, syncTrack, resolution).toFixed(4))
      : Number(rawHitSec.toFixed(4));
    n.hitTimeSec = exactSec;
    n.timeSec = exactSec;
  }

  // Group simultaneous ticks to identify chords reliably
  const tickCounts = new Map();
  for (let i = 0; i < notes.length; i += 1) {
    const tk = notes[i].tick;
    tickCounts.set(tk, (tickCounts.get(tk) || 0) + 1);
  }

  let prevSingleTick = -9999;
  let prevSingleLane = -1;

  for (let i = 0; i < notes.length; i += 1) {
    const n = notes[i];
    const tick = n.tick;
    const exactSec = n.hitTimeSec;
    const rawSusDur = Number(n.sustainDuration ?? n.sustainSec ?? 0);
    let susTicks = 0;
    if (instrument !== 'drums' && !n.isHazard && rawSusDur > 0.08) {
      susTicks =
        Number.isFinite(n.sustainTicks) && n.sustainTicks > 0
          ? Math.round(n.sustainTicks)
          : Math.round(rawSusDur / secPerTick);
      if (susTicks <= minSustainTicks) {
        susTicks = 0;
      }
    }
    const susDur =
      susTicks > 0
        ? hasSync
          ? Number(Math.max(0, tickToTime(tick + susTicks, syncTrack, resolution) - exactSec).toFixed(4))
          : Number((susTicks * secPerTick).toFixed(4))
        : 0;
    n.sustainTicks = susTicks;
    n.sustainDuration = susDur;
    n.sustainSec = susDur;

    n.isStar = Boolean(n.isStar || n.isFever);
    n.isFever = n.isStar;

    const isSimultaneous = n.isChord || (tickCounts.get(tick) || 0) > 1;
    if (!n.isHazard && n.isAccent === undefined) {
      n.isAccent = Boolean(tick % 768 === 0 || (isSimultaneous && tick % 384 === 0));
    }
    if (instrument === 'piano' && !n.isHazard && !n.pianoHand) {
      n.pianoHand = (n.pitchNorm ?? 0.5) < 0.38 || n.lane <= 1 ? 'left' : 'right';
    }
    if (allowHopos && !isSimultaneous && !n.isHazard) {
      const dtTicks = tick - prevSingleTick;
      n.isHopo = dtTicks > 0 && dtTicks <= 48 && n.lane !== prevSingleLane;
      prevSingleTick = tick;
      prevSingleLane = n.lane;
    } else {
      n.isHopo = false;
      if (isSimultaneous) {
        prevSingleTick = -9999;
        prevSingleLane = -1;
      }
    }
  }
}

/**
 * Computes a classic 4.2s–5.2s "Big Rock Ending" (BRE) freestyle finale window near the end of
 * energetic songs (> 32s duration with active outro notes).
 */
function computeBigRockEndingWindow(notes, durationSec, sections = []) {
  if (!Array.isArray(notes) || notes.length < 30 || !Number.isFinite(durationSec) || durationSec < 32) {
    return null;
  }
  const lastNote = notes[notes.length - 1];
  const lastActiveSec = Math.min(durationSec - 0.6, lastNote.hitTimeSec + (lastNote.sustainDuration || 0));
  if (lastActiveSec < 22) return null;

  const breDur = Math.min(5.2, Math.max(4.0, durationSec * 0.032));
  const endSec = Number(Math.min(durationSec - 0.45, lastActiveSec + 0.35).toFixed(3));
  const startSec = Number(Math.max(12, endSec - breDur).toFixed(3));

  // Verify the outro region has real musical energy (at least 4 notes in the final 10s)
  let tailNotes = 0;
  for (let i = notes.length - 1; i >= 0; i -= 1) {
    if (notes[i].hitTimeSec < startSec - 4.0) break;
    tailNotes += 1;
  }
  if (tailNotes < 4) return null;

  const outroSec = sections.find((s) => s.type === 'OUTRO');
  return {
    startSec,
    endSec,
    label: outroSec?.label || 'BIG ROCK ENDING!',
  };
}

/**
 * Strategically injects "Panggulo" Hazard / Dodge Notes (`isHazard: true`) into Medium, Hard & Expert charts
 * (strictly disabled on Easy!) during high-energy Chorus / Guitar Solo / peak moments.
 * Hazards only spawn in guaranteed-clear neighboring lanes so players can cleanly dodge them!
 */
export function injectPangguloHazards(
  notes,
  {
    difficultyId = 'medium',
    laneCount = 4,
    sections = [],
    beatGrid = [],
    syncTrack = null,
    resolution = STANDARD_PPQ,
    trackId = 'track',
    excludeAfterSec = Infinity,
  } = {}
) {
  if (!Array.isArray(notes) || notes.length < 18) return notes;
  if (difficultyId === 'easy' || laneCount < 3) return notes;

  const hasSync = Array.isArray(syncTrack) && syncTrack.length > 0;

  // Deterministic pseudo-random seed from trackId so hazards feel handcrafted & repeatable per song
  let seed = 2166136261;
  const keyStr = `${trackId}:${difficultyId}:${laneCount}`;
  for (let i = 0; i < keyStr.length; i += 1) {
    seed ^= keyStr.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  const nextRand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const spacingSec = difficultyId === 'expert' ? 4.4 : difficultyId === 'hard' ? 6.2 : 8.5;
  const maxHazards = difficultyId === 'expert' ? 20 : difficultyId === 'hard' ? 13 : 8;
  const firstNoteTime = notes[0].hitTimeSec;
  const lastNoteTime = Math.min(excludeAfterSec, notes[notes.length - 1].hitTimeSec);
  const span = Math.max(10, lastNoteTime - firstNoteTime);

  // Build candidate off-beat / energetic timestamps locked to 192-PPQ half-beats (tick + 96)
  const candidates = [];
  if (Array.isArray(beatGrid) && beatGrid.length >= 8) {
    for (let i = 3; i < beatGrid.length - 2; i += 1) {
      const b0 = beatGrid[i];
      const b1 = beatGrid[i + 1];
      const t0 = typeof b0 === 'number' ? b0 : (b0?.timeSec ?? b0?.time);
      const t1 = typeof b1 === 'number' ? b1 : (b1?.timeSec ?? b1?.time);
      if (!Number.isFinite(t0) || !Number.isFinite(t1)) continue;
      const tick =
        Number.isFinite(b0?.tick) && hasSync
          ? Math.round(b0.tick) + 96
          : hasSync
            ? Math.round(timeToTick((t0 + t1) * 0.5, syncTrack, resolution) / 96) * 96
            : undefined;
      const midOffBeat =
        hasSync && Number.isFinite(tick)
          ? tickToTime(tick, syncTrack, resolution)
          : (t0 + t1) * 0.5;
      if (midOffBeat < firstNoteTime + 5.0 || midOffBeat > lastNoteTime - 3.0) continue;
      const sec = getSongSectionAt(sections, midOffBeat);
      const secType = sec?.type || '';
      const isHotSection =
        secType === 'CHORUS' ||
        secType === 'GUITAR_SOLO' ||
        secType === 'OUTRO' ||
        (!secType && midOffBeat > firstNoteTime + span * 0.22 && midOffBeat < lastNoteTime - span * 0.12);
      if (isHotSection) {
        candidates.push({ timeSec: midOffBeat, tick });
      }
    }
  }

  // Fallback candidate timestamps derived from note gaps if beatGrid was sparse
  if (candidates.length < 4) {
    for (let i = 4; i < notes.length - 4; i += 3) {
      const t = notes[i].hitTimeSec;
      if (t > firstNoteTime + 5.0 && t < lastNoteTime - 3.0) {
        candidates.push({ timeSec: t, tick: notes[i].tick });
      }
    }
  }

  const hazards = [];
  let lastHazardTime = -99;

  for (let c = 0; c < candidates.length && hazards.length < maxHazards; c += 1) {
    const cand = candidates[c];
    const t = cand.timeSec;
    if (t - lastHazardTime < spacingSec) continue;

    // Inspect nearby normal notes to find lanes that are 100% clear (including sustains!)
    const busyLanes = new Set();
    let nearChord = false;
    let nearbyNoteCount = 0;

    for (let i = 0; i < notes.length; i += 1) {
      const n = notes[i];
      const nEnd = n.hitTimeSec + (n.sustainDuration || 0);
      if (n.hitTimeSec > t + 0.42) break;
      if (nEnd < t - 0.36) continue;
      nearbyNoteCount += 1;
      if (Math.abs(n.hitTimeSec - t) < 0.22 && n.isChord) nearChord = true;
      if (n.hitTimeSec <= t + 0.34 && nEnd >= t - 0.3) {
        busyLanes.add(n.lane);
      }
    }

    if (nearChord || nearbyNoteCount === 0) continue;

    // Prefer a free lane directly adjacent to an active lane so the dodge feels exciting & readable
    const freeLanes = [];
    for (let l = 0; l < laneCount; l += 1) {
      if (!busyLanes.has(l)) freeLanes.push(l);
    }
    if (freeLanes.length === 0) continue;

    const adjFree = freeLanes.filter((l) => busyLanes.has(l - 1) || busyLanes.has(l + 1));
    const pool = adjFree.length > 0 ? adjFree : freeLanes;
    const lane = pool[Math.floor(nextRand() * pool.length)];
    const tick = Number.isFinite(cand.tick)
      ? Math.round(cand.tick)
      : hasSync
        ? Math.round(timeToTick(t, syncTrack, resolution) / 48) * 48
        : undefined;
    const hitSec =
      hasSync && Number.isFinite(tick)
        ? Number(tickToTime(tick, syncTrack, resolution).toFixed(4))
        : Number(t.toFixed(4));

    hazards.push({
      id: `${trackId}_haz_${hazards.length}`,
      tick,
      lane,
      timeSec: hitSec,
      hitTimeSec: hitSec,
      sustainTicks: 0,
      sustainSec: 0,
      sustainDuration: 0,
      isChord: false,
      isHopo: false,
      isFever: false,
      isStar: false,
      isAccent: false,
      isHazard: true,
      pitchNorm: lane / Math.max(1, laneCount - 1),
      drumPart: null,
      hit: false,
      holding: false,
      holdCompleted: false,
      missed: false,
      dodged: false,
    });
    lastHazardTime = hitSec;
  }

  if (hazards.length > 0) {
    for (let i = 0; i < hazards.length; i += 1) notes.push(hazards[i]);
    notes.sort((a, b) => (a.tick ?? 0) - (b.tick ?? 0) || a.hitTimeSec - b.hitTimeSec || a.lane - b.lane);
  }

  return notes;
}

export function cloneFreshNotes(notes) {
  return (notes || []).map((n) => ({
    ...n,
    hit: false,
    holding: false,
    holdCompleted: false,
    missed: false,
    dodged: false,
  }));
}

/**
 * Pure helper evaluating 192-PPQ rhythmic phases (beatPhase, eighthPhase, sixteenthPhase, barPhase,
 * phraseProgress, isDownbeat, isSnareHit, isPhraseBoundary) from exactAudioTimeSec + dynamic [SyncTrack].
 */
export function evaluateBeatSyncState(songTimeSec, syncTrack, fallbackBpm = 120, resolution = STANDARD_PPQ) {
  const safeRes = Math.max(48, Number(resolution) || STANDARD_PPQ);
  const safeBpm = Math.max(55, Math.min(220, Number(fallbackBpm) || 120));
  const hasTrack = Array.isArray(syncTrack) && syncTrack.length > 0;

  let currentTick = 0;
  let currentBpm = safeBpm;

  if (hasTrack) {
    currentTick = timeToTick(songTimeSec, syncTrack, safeRes);
    // Locate active [SyncTrack] segment via binary search
    let lo = 0;
    let hi = syncTrack.length - 1;
    let segIdx = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const segT = Number(syncTrack[mid].timeSec ?? syncTrack[mid].timeSeconds ?? 0);
      if (segT <= songTimeSec) {
        segIdx = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    currentBpm = Math.max(55, Math.min(220, Number(syncTrack[segIdx]?.bpm) || safeBpm));
  } else {
    currentTick = songTimeSec * (safeBpm / 60) * safeRes;
  }

  const beatsFloat = currentTick / safeRes;
  const beatIndex = Math.floor(beatsFloat);
  const barIndex = Math.floor(beatsFloat / 4);
  const beatPhase = ((beatsFloat % 1) + 1) % 1;
  const eighthPhase = (((beatsFloat * 2) % 1) + 1) % 1;
  const sixteenthPhase = (((beatsFloat * 4) % 1) + 1) % 1;
  const barPhase = (((beatsFloat / 4) % 1) + 1) % 1;
  const phraseProgress = (((beatsFloat / 32) % 1) + 1) % 1; // 8-bar concert phrase
  const beatInBar = ((beatIndex % 4) + 4) % 4;
  const barInPhrase4 = ((barIndex % 4) + 4) % 4;
  const barInPhrase8 = ((barIndex % 8) + 8) % 8;
  const tickRounded = Math.round(currentTick);

  const isDownbeat = beatInBar === 0 && beatPhase < 0.22;
  const isSnareHit = (beatInBar === 1 || beatInBar === 3) && beatPhase < 0.24;
  const isPhraseBoundary = barInPhrase4 === 0 && beatInBar === 0 && beatPhase < 0.25;
  const isMajorPhraseBoundary = barInPhrase8 === 0 && beatInBar === 0 && beatPhase < 0.25;

  return {
    tick: tickRounded,
    currentTick: tickRounded,
    beatIndex,
    barIndex,
    beatInBar,
    beatPhase,
    eighthPhase,
    sixteenthPhase,
    barPhase,
    phraseProgress,
    isDownbeat,
    isSnareHit,
    isPhraseBoundary,
    isMajorPhraseBoundary,
    currentBpm,
  };
}

function resolveOverallIntensityLabel(currentSection, overallNorm, playing, encore = false) {
  if (encore) return 'ENCORE';
  const secType = currentSection?.type;
  if (secType === 'GUITAR_SOLO') return 'GUITAR SOLO';
  if (secType === 'CHORUS') return 'CHORUS';
  if (secType === 'BREAKDOWN' || secType === 'BRIDGE') return 'BREAKDOWN';
  if (secType === 'OUTRO') return overallNorm > 0.42 ? 'ENCORE' : 'BREAKDOWN';
  if (secType === 'INTRO') return 'INTRO';
  if (secType === 'VERSE' || secType === 'PRE_CHORUS') return 'VERSE';
  if (!playing || overallNorm < 0.16) return 'INTRO';
  if (overallNorm > 0.62) return 'CHORUS';
  return 'VERSE';
}

/**
 * Zero-Allocation Real-Time Beat-Sync Lock & Smoothed-Attack / Natural-Decay Per-Stem Telemetry Clock.
 * Drives the highway pulse, 3D audio-locked musician kinematics, articulated moving-head lights,
 * camera director downbeat cuts + lens punches, and 4-tier Engrande pyromusical fireworks in lockstep.
 */
export function createBeatSyncClock() {
  const state = {
    tick: 0,
    currentTick: 0,
    beatIndex: 0,
    barIndex: 0,
    beatInBar: 0,
    beatPhase: 0,
    eighthPhase: 0,
    sixteenthPhase: 0,
    barPhase: 0,
    phraseProgress: 0,
    isDownbeat: false,
    isSnareHit: false,
    isPhraseBoundary: false,
    isMajorPhraseBoundary: false,
    currentBpm: 120,
    songAmbiance: 'ROCK_ANTHEM',
    currentSection: null,
    syncLocked: false,
    outputLatencyMs: 0,
    dynamicOffsetMs: 0,
    sampleCount: 0,
    // Smoothed-attack / natural-decay per-stem real-time audio telemetry (0.0 -> 1.0)
    kickImpulse: 0,
    snareImpulse: 0,
    bassGroove: 0,
    guitarRiffEnergy: 0,
    guitarBendPulse: 0,
    vocalKeysEnergy: 0,
    overallIntensity: 'INTRO',
    overallIntensityNorm: 0,
    transientEnergy: {
      drums: 0,
      bass: 0,
      guitar: 0,
      piano: 0,
      kick: 0,
      snare: 0,
      harmonic: 0,
      combined: 0,
      // Mirrored per-stem & rhythmic channels for zero-GC downstream consumption
      kickImpulse: 0,
      snareImpulse: 0,
      bassGroove: 0,
      guitarRiffEnergy: 0,
      guitarBendPulse: 0,
      vocalKeysEnergy: 0,
      eighthPhase: 0,
      sixteenthPhase: 0,
      beatInBar: 0,
      isDownbeat: false,
      isSnareHit: false,
      isPhraseBoundary: false,
      isMajorPhraseBoundary: false,
      overallIntensity: 'INTRO',
      overallIntensityNorm: 0,
    },
  };

  let emaDeviationMs = 0;
  let lastSongTime = -999;
  let prevKickRaw = 0;
  let prevSnareRaw = 0;
  let prevGuitarRaw = 0;
  let prevVocalKeysRaw = 0;
  let guitarSustainAccum = 0;

  const smoothAttackDecay = (current, target, dt, attackSec, decaySec) => {
    const tau = target > current ? attackSec : decaySec;
    const alpha = 1 - Math.exp(-dt / Math.max(0.004, tau));
    return current + (target - current) * alpha;
  };

  return {
    reset() {
      state.tick = 0;
      state.currentTick = 0;
      state.beatIndex = 0;
      state.barIndex = 0;
      state.beatInBar = 0;
      state.beatPhase = 0;
      state.eighthPhase = 0;
      state.sixteenthPhase = 0;
      state.barPhase = 0;
      state.phraseProgress = 0;
      state.isDownbeat = false;
      state.isSnareHit = false;
      state.isPhraseBoundary = false;
      state.isMajorPhraseBoundary = false;
      state.currentSection = null;
      state.syncLocked = false;
      state.dynamicOffsetMs = 0;
      state.sampleCount = 0;
      state.kickImpulse = 0;
      state.snareImpulse = 0;
      state.bassGroove = 0;
      state.guitarRiffEnergy = 0;
      state.guitarBendPulse = 0;
      state.vocalKeysEnergy = 0;
      state.overallIntensity = 'INTRO';
      state.overallIntensityNorm = 0;

      const te = state.transientEnergy;
      te.drums = 0;
      te.bass = 0;
      te.guitar = 0;
      te.piano = 0;
      te.kick = 0;
      te.snare = 0;
      te.harmonic = 0;
      te.combined = 0;
      te.kickImpulse = 0;
      te.snareImpulse = 0;
      te.bassGroove = 0;
      te.guitarRiffEnergy = 0;
      te.guitarBendPulse = 0;
      te.vocalKeysEnergy = 0;
      te.eighthPhase = 0;
      te.sixteenthPhase = 0;
      te.beatInBar = 0;
      te.isDownbeat = false;
      te.isSnareHit = false;
      te.isPhraseBoundary = false;
      te.isMajorPhraseBoundary = false;
      te.overallIntensity = 'INTRO';
      te.overallIntensityNorm = 0;

      emaDeviationMs = 0;
      lastSongTime = -999;
      prevKickRaw = 0;
      prevSnareRaw = 0;
      prevGuitarRaw = 0;
      prevVocalKeysRaw = 0;
      guitarSustainAccum = 0;
    },

    recordHitDeviation(deltaMs) {
      if (!Number.isFinite(deltaMs) || Math.abs(deltaMs) > 135) return state.dynamicOffsetMs;
      state.sampleCount += 1;
      const alpha = state.sampleCount <= 8 ? 0.25 : 0.1;
      emaDeviationMs += (deltaMs - emaDeviationMs) * alpha;
      state.dynamicOffsetMs = Math.max(-35, Math.min(35, Math.round(emaDeviationMs * 10) / 10));
      return state.dynamicOffsetMs;
    },

    update({
      songTime = 0,
      syncTrack = null,
      fallbackBpm = 120,
      resolution = STANDARD_PPQ,
      outputLatencySec = 0,
      playing = false,
      telemetry = null,
      sections = null,
      trackMeta = null,
      isEncore = false,
    }) {
      const evaluated = evaluateBeatSyncState(songTime, syncTrack, fallbackBpm, resolution);
      state.tick = evaluated.tick;
      state.currentTick = evaluated.currentTick;
      state.beatIndex = evaluated.beatIndex;
      state.barIndex = evaluated.barIndex;
      state.beatInBar = evaluated.beatInBar;
      state.beatPhase = evaluated.beatPhase;
      state.eighthPhase = evaluated.eighthPhase;
      state.sixteenthPhase = evaluated.sixteenthPhase;
      state.barPhase = evaluated.barPhase;
      state.phraseProgress = evaluated.phraseProgress;
      state.isDownbeat = evaluated.isDownbeat;
      state.isSnareHit = evaluated.isSnareHit;
      state.isPhraseBoundary = evaluated.isPhraseBoundary;
      state.isMajorPhraseBoundary = evaluated.isMajorPhraseBoundary;
      state.currentBpm = evaluated.currentBpm;

      if (Array.isArray(sections) && sections.length > 0) {
        state.currentSection = getSongSectionAt(sections, songTime);
      }
      if (trackMeta?.ambianceType) {
        state.songAmbiance = trackMeta.ambianceType;
      }

      const rawLatency = Number(outputLatencySec);
      state.outputLatencyMs = Number.isFinite(rawLatency) && rawLatency >= 0 ? Math.round(rawLatency * 1000) : 0;

      const rawDt = lastSongTime === -999 ? 0.016 : songTime - lastSongTime;
      const dt = Math.max(0.004, Math.min(0.06, Number.isFinite(rawDt) && rawDt > 0 ? rawDt : 0.016));
      const monotonic = lastSongTime === -999 || (songTime >= lastSongTime - 0.025 && songTime - lastSongTime < 0.25);
      lastSongTime = songTime;
      state.syncLocked = Boolean(playing && songTime >= -0.05 && monotonic);

      // Extract raw 4-stem energies & transient flux from live WebAudio stem analysers
      const rawKickE = Math.min(1, Math.max(0, Number(telemetry?.kickEnergy ?? telemetry?.bassEnergy ?? 0)));
      const rawKickT = Math.min(1, Math.max(0, Number(telemetry?.kickTransient ?? 0)));
      const rawSnareE = Math.min(1, Math.max(0, Number(telemetry?.snareEnergy ?? telemetry?.drumEnergy ?? 0)));
      const rawSnareT = Math.min(1, Math.max(0, Number(telemetry?.snareTransient ?? 0)));
      const rawDrumE = Math.min(1, Math.max(0, Number(telemetry?.drumEnergy ?? 0)));
      const rawDrumT = Math.min(1, Math.max(0, Number(telemetry?.drumTransient ?? 0)));
      const rawBassE = Math.min(1, Math.max(0, Number(telemetry?.bassEnergy ?? 0)));
      const rawBassT = Math.min(1, Math.max(0, Number(telemetry?.bassTransient ?? 0)));
      const rawGuitarE = Math.min(1, Math.max(0, Number(telemetry?.guitarEnergy ?? 0)));
      const rawGuitarT = Math.min(1, Math.max(0, Number(telemetry?.guitarTransient ?? 0)));
      const rawPianoE = Math.min(1, Math.max(0, Number(telemetry?.pianoEnergy ?? 0)));
      const rawPianoT = Math.min(1, Math.max(0, Number(telemetry?.pianoTransient ?? 0)));
      const rawVocalE = Math.min(1, Math.max(0, Number(telemetry?.vocalEnergy ?? 0)));
      const rawOverallE = Math.min(1, Math.max(0, Number(telemetry?.overallEnergy ?? 0)));

      // Half-wave rectified per-stem transient derivatives for sharp audio-locked attacks
      const kickFlux = Math.max(0, rawKickE - prevKickRaw * 0.88) * 3.2;
      const snareFlux = Math.max(0, rawSnareE - prevSnareRaw * 0.86) * 3.4;
      const guitarFlux = Math.max(0, rawGuitarE - prevGuitarRaw * 0.85) * 3.0;
      const vocalKeysRaw = Math.min(1, Math.max(rawPianoE, rawVocalE * 0.95, rawPianoT * 0.9));
      const vocalKeysFlux = Math.max(0, vocalKeysRaw - prevVocalKeysRaw * 0.86) * 2.8;

      prevKickRaw = rawKickE;
      prevSnareRaw = rawSnareE;
      prevGuitarRaw = rawGuitarE;
      prevVocalKeysRaw = vocalKeysRaw;

      // Subtle beat-phase lock boost so downbeats & backbeats feel tight even on compressed mixes
      const downbeatPulse = playing && evaluated.isDownbeat ? (1 - evaluated.beatPhase / 0.22) * 0.28 : 0;
      const backbeatPulse = playing && evaluated.isSnareHit ? (1 - evaluated.beatPhase / 0.24) * 0.28 : 0;

      const kickTarget = playing
        ? Math.min(1, Math.max(rawKickT, kickFlux, rawKickE * 0.82 + downbeatPulse * rawDrumE))
        : 0;
      const snareTarget = playing
        ? Math.min(1, Math.max(rawSnareT, snareFlux, rawSnareE * 0.72 + backbeatPulse * Math.max(rawDrumE, 0.35)))
        : 0;
      const bassGrooveTarget = playing
        ? Math.min(1, Math.max(rawBassT * 0.95, rawBassE * 1.15))
        : 0;
      const guitarRiffTarget = playing
        ? Math.min(1, Math.max(rawGuitarT * 1.1, guitarFlux, rawGuitarE * 1.12))
        : 0;

      // Guitar Bend Pulse tracks sustained high-energy guitar notes / solo vibrato ring-out
      if (playing && rawGuitarE > 0.26) {
        guitarSustainAccum = Math.min(1, guitarSustainAccum + dt * (rawGuitarE > 0.45 ? 1.85 : 0.95));
      } else {
        guitarSustainAccum = Math.max(0, guitarSustainAccum - dt * 2.4);
      }
      const isSoloSection = state.currentSection?.type === 'GUITAR_SOLO';
      const guitarBendTarget = playing
        ? Math.min(1, guitarSustainAccum * (isSoloSection ? 1.0 : 0.72) * (0.45 + rawGuitarE * 0.75))
        : 0;
      const vocalKeysTarget = playing
        ? Math.min(1, Math.max(vocalKeysRaw * 1.12, vocalKeysFlux, rawPianoT))
        : 0;

      // Crisp fast attack (12–28ms), natural musical decay (110–260ms)
      state.kickImpulse = smoothAttackDecay(state.kickImpulse, kickTarget, dt, 0.012, 0.135);
      state.snareImpulse = smoothAttackDecay(state.snareImpulse, snareTarget, dt, 0.01, 0.125);
      state.bassGroove = smoothAttackDecay(state.bassGroove, bassGrooveTarget, dt, 0.022, 0.19);
      state.guitarRiffEnergy = smoothAttackDecay(state.guitarRiffEnergy, guitarRiffTarget, dt, 0.016, 0.165);
      state.guitarBendPulse = smoothAttackDecay(state.guitarBendPulse, guitarBendTarget, dt, 0.055, 0.28);
      state.vocalKeysEnergy = smoothAttackDecay(state.vocalKeysEnergy, vocalKeysTarget, dt, 0.024, 0.21);

      const overallTarget = playing
        ? Math.min(1, Math.max(rawOverallE, state.kickImpulse * 0.32 + state.snareImpulse * 0.24 + state.guitarRiffEnergy * 0.26 + state.vocalKeysEnergy * 0.18))
        : 0;
      state.overallIntensityNorm = smoothAttackDecay(state.overallIntensityNorm, overallTarget, dt, 0.08, 0.42);
      state.overallIntensity = resolveOverallIntensityLabel(
        state.currentSection,
        state.overallIntensityNorm,
        playing,
        Boolean(isEncore)
      );

      const drums = Math.min(1, Math.max(rawDrumT, state.kickImpulse * 0.92, state.snareImpulse * 0.9, rawDrumE * 0.8));
      const harmonic = Math.min(1, Number(telemetry?.harmonicEnergy ?? Math.max(state.guitarRiffEnergy, state.vocalKeysEnergy)));

      const te = state.transientEnergy;
      te.drums = drums;
      te.bass = state.bassGroove;
      te.guitar = state.guitarRiffEnergy;
      te.piano = state.vocalKeysEnergy;
      te.kick = state.kickImpulse;
      te.snare = state.snareImpulse;
      te.harmonic = harmonic;
      te.combined = Math.min(1, drums * 0.42 + state.snareImpulse * 0.25 + state.guitarRiffEnergy * 0.18 + state.vocalKeysEnergy * 0.15);

      te.kickImpulse = state.kickImpulse;
      te.snareImpulse = state.snareImpulse;
      te.bassGroove = state.bassGroove;
      te.guitarRiffEnergy = state.guitarRiffEnergy;
      te.guitarBendPulse = state.guitarBendPulse;
      te.vocalKeysEnergy = state.vocalKeysEnergy;
      te.eighthPhase = state.eighthPhase;
      te.sixteenthPhase = state.sixteenthPhase;
      te.beatInBar = state.beatInBar;
      te.isDownbeat = state.isDownbeat;
      te.isSnareHit = state.isSnareHit;
      te.isPhraseBoundary = state.isPhraseBoundary;
      te.isMajorPhraseBoundary = state.isMajorPhraseBoundary;
      te.overallIntensity = state.overallIntensity;
      te.overallIntensityNorm = state.overallIntensityNorm;

      return state;
    },

    getState() {
      return state;
    },
  };
}




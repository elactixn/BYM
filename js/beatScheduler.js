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

import { analyzeAudioInWorker, parseMidiArrayBuffer, parseCloneHeroChart } from './audioEngine.js';

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

function buildBeatGrid(durationSec, beatSec, beatPhaseSec) {
  const grid = [];
  let idx = 0;
  let t = beatPhaseSec;
  while (t > beatSec) t -= beatSec;
  while (t < durationSec) {
    if (t >= 0) {
      grid.push({ time: Number(t.toFixed(4)), isMeasure: idx % 4 === 0 });
      idx += 1;
    }
    t += beatSec;
  }
  return grid;
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
    if (n.hitTimeSec >= 10 && n.hitTimeSec - phraseStart >= 18) {
      phraseStart = n.hitTimeSec;
    }
    if (n.hitTimeSec >= phraseStart && n.hitTimeSec <= phraseStart + 4.2) {
      n.isFever = true;
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
      notes.push({
        id: `${trackId}_d_${notes.length}`,
        lane,
        hitTimeSec: Number(b.time.toFixed(4)),
        sustainDuration: 0, // STRICTLY ZERO long sustain bars on Drums!
        isChord,
        isFever: false,
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

    notes.push({
      id: `${trackId}_b_${notes.length}`,
      lane,
      hitTimeSec: Number(ev.time.toFixed(4)),
      sustainDuration,
      isChord: false, // Authentic basslines play single root/octave grooves rather than guitar chords!
      isFever: false,
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
      notes.push({
        id: `${trackId}_g_${notes.length}`,
        lane: lowL,
        hitTimeSec: Number(ev.time.toFixed(4)),
        sustainDuration: 0,
        isChord: true,
        isFever: false,
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
        hitTimeSec: Number(ev.time.toFixed(4)),
        sustainDuration: 0,
        isChord: true,
        isFever: false,
        pitchNorm,
        drumPart: null,
        hit: false,
        holding: false,
        holdCompleted: false,
        missed: false,
      });
    } else {
      notes.push({
        id: `${trackId}_g_${notes.length}`,
        lane,
        hitTimeSec: Number(ev.time.toFixed(4)),
        sustainDuration,
        isChord: false,
        isFever: false,
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

      notes.push({
        id: `${trackId}_m_${notes.length}`,
        lane,
        hitTimeSec: Number(cl.time.toFixed(4)),
        sustainDuration,
        isChord,
        isFever: false,
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
 * Quantizes an onset timestamp to the local Dynamic Programming beat interval [beats[i], beats[i+1]]
 * supporting both 16th-note (1/4 beat) and triplet (1/3 beat) subdivisions without static-BPM drift!
 */
function quantizeToDynamicBeatGrid(timeSec, beats, { allowSixteenths = true, allowTriplets = true, maxSnapSec = 0.044 } = {}) {
  if (!Array.isArray(beats) || beats.length < 2) return timeSec;

  // Binary search enclosing beat interval [beats[lo], beats[lo+1]]
  let lo = 0;
  let hi = beats.length - 2;
  if (timeSec <= beats[0]) {
    const dt = Math.max(0.25, beats[1] - beats[0]);
    const steps = Math.round((timeSec - beats[0]) / (dt * 0.25));
    const cand = beats[0] + steps * dt * 0.25;
    return Math.abs(cand - timeSec) <= maxSnapSec ? cand : timeSec;
  }
  if (timeSec >= beats[beats.length - 1]) {
    const last = beats[beats.length - 1];
    const dt = Math.max(0.25, last - beats[beats.length - 2]);
    const steps = Math.round((timeSec - last) / (dt * 0.25));
    const cand = last + steps * dt * 0.25;
    return Math.abs(cand - timeSec) <= maxSnapSec ? cand : timeSec;
  }

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (beats[mid] <= timeSec && timeSec < beats[mid + 1]) {
      lo = mid;
      break;
    }
    if (beats[mid] < timeSec) lo = mid + 1;
    else hi = mid - 1;
  }

  const b0 = beats[lo];
  const b1 = beats[Math.min(beats.length - 1, lo + 1)];
  const beatDur = Math.max(0.24, Math.min(1.25, b1 - b0));
  const frac = (timeSec - b0) / beatDur;

  // Candidate grid positions: straight 8th/16th + optional triplets
  const divs = allowSixteenths ? [0, 0.25, 0.5, 0.75, 1.0] : [0, 0.5, 1.0];
  if (allowTriplets) {
    divs.push(1 / 3, 2 / 3);
  }

  let bestT = timeSec;
  let bestErr = maxSnapSec + 1e-4;
  for (let i = 0; i < divs.length; i += 1) {
    const cand = b0 + divs[i] * beatDur;
    const err = Math.abs(cand - timeSec);
    // Slight preference for straight subdivisions over triplets when equidistant
    const penalty = i >= (allowSixteenths ? 5 : 3) ? 0.006 : 0;
    if (err + penalty < bestErr) {
      bestErr = err + penalty;
      bestT = cand;
    }
  }

  return Math.abs(bestT - timeSec) <= maxSnapSec ? bestT : timeSec;
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
      notes.push({
        id: `${trackId}_ch_${notes.length}`,
        lane: m.lane,
        hitTimeSec: m.timeSec,
        sustainDuration: instrument === 'drums' || isChord ? 0 : m.sustainSec,
        isChord,
        isFever: isInStarPower(m.timeSec),
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
  const { bpm, beatSec, beatPhaseSec, beats, dynamicBeatGrid, sections, duration, chorusEnergyFloor, guitarOnsets } = workerAnalysis;
  const beatGrid = dynamicBeatGrid?.length ? dynamicBeatGrid : buildBeatGrid(duration, beatSec, beatPhaseSec);
  const diffId = difficultyConfig?.id || 'medium';
  const minGapSec = Math.max(0.09, (difficultyConfig?.minNoteGapMs || 210) / 1000);
  const allowSixteenths = diffId === 'expert' || diffId === 'hard';
  const subdiv = allowSixteenths ? beatSec / 4 : beatSec / 2;
  const strengthFloor = diffId === 'easy' ? 1.32 : diffId === 'medium' ? 1.12 : diffId === 'hard' ? 0.96 : 0.85;
  const chordChance =
    diffId === 'expert' ? 0.42 : diffId === 'hard' ? 0.3 : diffId === 'medium' ? 0.1 : 0;
  const rng = createRng(hashSeed(`${trackId}_wguitar_${diffId}`));

  // Keep clean intro notes even if their raw RMS is lower, quantizing to the dynamic beat grid!
  const filtered = [];
  let lastT = -1;
  for (let i = 0; i < (guitarOnsets || []).length; i += 1) {
    const ev = guitarOnsets[i];
    const isCleanIntro = ev.sectionEnergy < chorusEnergyFloor * 0.72 && ev.hnr >= 2.8;
    const reqStrength = isCleanIntro ? strengthFloor * 0.84 : strengthFloor;
    if (ev.strength < reqStrength) continue;

    const qTime = beats?.length >= 2
      ? quantizeToDynamicBeatGrid(ev.time, beats, { allowSixteenths, allowTriplets: true, maxSnapSec: 0.044 })
      : quantizeToSubdivision(ev.time, beatPhaseSec, subdiv, 0.038);

    if (qTime < 0.06 || qTime > duration - 0.12) continue;
    if (qTime - lastT < minGapSec) continue;
    filtered.push({ ...ev, time: qTime });
    lastT = qTime;
  }

  // Dynamic pitch span (10th..90th percentile) across the guitar's true melodic range
  const pitches = filtered.map((o) => o.pitchHz).sort((a, b) => a - b);
  const loHz = pitches.length >= 6 ? pitches[Math.floor(pitches.length * 0.1)] : 280;
  const hiHz = pitches.length >= 6 ? pitches[Math.floor(pitches.length * 0.9)] : 1850;
  const logLo = Math.log2(Math.max(140, loHz));
  const logSpan = Math.max(1.0, Math.log2(Math.max(loHz + 100, hiHz)) - logLo);

  const notes = [];
  let prevLane = Math.floor(laneCount / 2);
  let prevLogPitch = logLo + logSpan * 0.5;

  for (let i = 0; i < filtered.length; i += 1) {
    const ev = filtered[i];
    const nextEv = filtered[i + 1];
    const gapToNext = nextEv ? nextEv.time - ev.time : duration - ev.time;

    const logPitch = Math.log2(Math.max(140, ev.pitchHz));
    const pitchNorm = Math.max(0, Math.min(1, (logPitch - logLo) / logSpan));
    const deltaLog = logPitch - prevLogPitch;

    let lane = Math.min(laneCount - 1, Math.max(0, Math.floor(pitchNorm * laneCount)));
    if (Math.abs(deltaLog) < 0.055) {
      lane = prevLane;
    } else if (deltaLog > 0.075 && lane <= prevLane && prevLane < laneCount - 1) {
      lane = prevLane + 1;
    } else if (deltaLog < -0.075 && lane >= prevLane && prevLane > 0) {
      lane = prevLane - 1;
    }
    prevLogPitch = logPitch;

    let sustainDuration = 0;
    if (ev.sustainSec >= 0.28 && gapToNext >= 0.42) {
      sustainDuration = Number(Math.min(2.4, ev.sustainSec, gapToNext - 0.15).toFixed(3));
      if (sustainDuration < 0.26) sustainDuration = 0;
    }

    const sec = getSongSectionAt(sections, ev.time);
    const beatFloat = (ev.time - beatPhaseSec) / beatSec;
    const beatInBar = ((Math.round(beatFloat * 2) / 2) % 4 + 4) % 4;
    const isStrongDownbeat =
      Math.abs(beatInBar) < 0.18 ||
      Math.abs(beatInBar - 4) < 0.18 ||
      Math.abs(beatInBar - 2) < 0.18;
    const isHighEnergyChorus =
      sec.type === 'CHORUS' || ev.sectionEnergy >= chorusEnergyFloor * 0.92;

    const makeChord =
      chordChance > 0 &&
      isStrongDownbeat &&
      isHighEnergyChorus &&
      sec.type !== 'GUITAR_SOLO' &&
      sustainDuration === 0 &&
      rng() < chordChance;

    if (makeChord) {
      const partner = lane <= laneCount - 3 ? lane + 2 : Math.max(0, lane - 2);
      const lowL = Math.min(lane, partner);
      const highL = Math.max(lane, partner);
      [lowL, highL].forEach((l) => {
        notes.push({
          id: `${trackId}_wg_${notes.length}`,
          lane: l,
          hitTimeSec: Number(ev.time.toFixed(4)),
          sustainDuration: 0,
          isChord: true,
          isFever: false,
          pitchNorm,
          drumPart: null,
          hit: false,
          holding: false,
          holdCompleted: false,
          missed: false,
        });
      });
    } else {
      notes.push({
        id: `${trackId}_wg_${notes.length}`,
        lane,
        hitTimeSec: Number(ev.time.toFixed(4)),
        sustainDuration,
        isChord: false,
        isFever: false,
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
  return { bpm, beatGrid, sections, notes };
}

/**
 * Maps sub-second Web Worker bass onsets (40–220Hz fundamental pitch + autocorrelation)
 * locked to the Dynamic Programming beat grid with sustain holds.
 */
function buildBassChartFromWorker({
  workerAnalysis,
  trackId,
  laneCount,
  difficultyConfig,
}) {
  const { bpm, beatSec, beatPhaseSec, beats, dynamicBeatGrid, sections, duration, bassOnsets } = workerAnalysis;
  const beatGrid = dynamicBeatGrid?.length ? dynamicBeatGrid : buildBeatGrid(duration, beatSec, beatPhaseSec);
  const diffId = difficultyConfig?.id || 'medium';
  const minGapSec = Math.max(0.11, (difficultyConfig?.minNoteGapMs || 220) / 1000);
  const allowSixteenths = diffId === 'expert' || diffId === 'hard';
  const subdiv = allowSixteenths ? beatSec / 4 : beatSec / 2;
  const strengthFloor = diffId === 'easy' ? 1.32 : diffId === 'medium' ? 1.12 : diffId === 'hard' ? 0.98 : 0.88;

  const filtered = [];
  let lastT = -1;
  for (let i = 0; i < (bassOnsets || []).length; i += 1) {
    const ev = bassOnsets[i];
    if (ev.strength < strengthFloor) continue;
    const qTime = beats?.length >= 2
      ? quantizeToDynamicBeatGrid(ev.time, beats, { allowSixteenths, allowTriplets: true, maxSnapSec: 0.046 })
      : quantizeToSubdivision(ev.time, beatPhaseSec, subdiv, 0.042);

    if (qTime < 0.06 || qTime > duration - 0.12) continue;
    if (qTime - lastT < minGapSec) continue;
    filtered.push({ ...ev, time: qTime });
    lastT = qTime;
  }

  const pitches = filtered.map((o) => o.pitchHz).sort((a, b) => a - b);
  const loHz = pitches.length >= 6 ? pitches[Math.floor(pitches.length * 0.1)] : 55;
  const hiHz = pitches.length >= 6 ? pitches[Math.floor(pitches.length * 0.9)] : 165;
  const logLo = Math.log2(Math.max(40, loHz));
  const logSpan = Math.max(0.75, Math.log2(Math.max(loHz + 25, hiHz)) - logLo);

  const notes = [];
  let prevLane = 0;
  let prevLogPitch = logLo;

  for (let i = 0; i < filtered.length; i += 1) {
    const ev = filtered[i];
    const nextEv = filtered[i + 1];
    const gapToNext = nextEv ? nextEv.time - ev.time : duration - ev.time;

    const logPitch = Math.log2(Math.max(40, ev.pitchHz));
    const pitchNorm = Math.max(0, Math.min(1, (logPitch - logLo) / logSpan));
    const deltaLog = logPitch - prevLogPitch;

    let lane = Math.min(laneCount - 1, Math.max(0, Math.floor(pitchNorm * laneCount)));
    if (Math.abs(deltaLog) < 0.06) {
      lane = prevLane;
    } else if (deltaLog > 0.09 && lane <= prevLane && prevLane < laneCount - 1) {
      lane = prevLane + 1;
    } else if (deltaLog < -0.09 && lane >= prevLane && prevLane > 0) {
      lane = prevLane - 1;
    }
    prevLogPitch = logPitch;

    let sustainDuration = 0;
    if (ev.sustainSec >= 0.3 && gapToNext >= 0.44) {
      sustainDuration = Number(Math.min(2.6, ev.sustainSec, gapToNext - 0.15).toFixed(3));
      if (sustainDuration < 0.28) sustainDuration = 0;
    }

    notes.push({
      id: `${trackId}_wb_${notes.length}`,
      lane,
      hitTimeSec: Number(ev.time.toFixed(4)),
      sustainDuration,
      isChord: false,
      isFever: false,
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
  return { bpm, beatGrid, sections, notes };
}

/**
 * Maps sub-second Web Worker percussive drum events locked to the Dynamic Programming
 * beat grid (strictly ZERO drum notes during drumless intros, ZERO drum sustains).
 */
function buildDrumsChartFromWorker({
  workerAnalysis,
  trackId,
  laneCount,
  difficultyConfig,
}) {
  const { bpm, beatSec, beatPhaseSec, beats, dynamicBeatGrid, sections, duration, drumEvents } = workerAnalysis;
  const beatGrid = dynamicBeatGrid?.length ? dynamicBeatGrid : buildBeatGrid(duration, beatSec, beatPhaseSec);
  const diffId = difficultyConfig?.id || 'medium';
  const maxLane = Math.max(2, laneCount - 1);
  const minGapSec = Math.max(0.085, (difficultyConfig?.minNoteGapMs || 195) / 1000);
  const allowSixteenths = diffId === 'expert' || diffId === 'hard';
  const subdiv = allowSixteenths ? beatSec / 4 : beatSec / 2;
  const allowFlams = diffId === 'hard' || diffId === 'expert';

  const clusters = [];
  for (let i = 0; i < (drumEvents || []).length; i += 1) {
    const ev = drumEvents[i];
    if (diffId === 'easy' && ev.part === 'hihat' && ev.strength < 0.015) continue;

    const qTime = beats?.length >= 2
      ? quantizeToDynamicBeatGrid(ev.time, beats, { allowSixteenths, allowTriplets: true, maxSnapSec: 0.042 })
      : quantizeToSubdivision(ev.time, beatPhaseSec, subdiv, 0.038);

    if (qTime < 0.06 || qTime > duration - 0.12) continue;

    const prev = clusters[clusters.length - 1];
    if (prev && Math.abs(qTime - prev.time) <= 0.036) {
      prev.items.push(ev);
    } else {
      clusters.push({ time: qTime, items: [ev] });
    }
  }

  const partPriority = { crash: 4, kick: 3, snare: 2, hihat: 1 };
  const partToLane = (part) => {
    if (part === 'kick') return 0;
    if (part === 'snare') return 1;
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
        chosen.push({ lane, part: ev.part });
      }
      if (chosen.length >= maxHits) break;
    }

    const isChord = chosen.length > 1;
    for (let k = 0; k < chosen.length; k += 1) {
      const item = chosen[k];
      notes.push({
        id: `${trackId}_wd_${notes.length}`,
        lane: item.lane,
        hitTimeSec: Number(cl.time.toFixed(4)),
        sustainDuration: 0,
        isChord,
        isFever: false,
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
}) {
  // 1. Sub-second Web Worker DP Beat Tracker + Song-Section + FFT pass (runs once per song!)
  let workerAnalysis = cachedWorkerAnalysis;
  if (!workerAnalysis) {
    workerAnalysis = await analyzeAudioInWorker(audioBuffer, {
      bpmHint,
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
        onProgress(1, 'Clone Hero chart ready!');
        return {
          ...chChart,
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
          onProgress(1, 'MIDI chart ready!');
          return {
            ...midiChart,
            beatGrid: workerAnalysis.dynamicBeatGrid?.length ? workerAnalysis.dynamicBeatGrid : midiChart.beatGrid,
            sections: resolvedSections,
            stemActivity: activity,
            workerAnalysis,
            chartSource: 'midi',
          };
        }
      }
    }
  }

  // 3. Build Instrument-Distinct Chart directly from Sub-Second Web Worker Dynamic Beat & FFT Analysis
  onProgress(0.92, instrument === 'drums' ? 'Mapping Kick, Snare & Cymbal hits…' : 'Quantizing to dynamic beat grid…');
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
  } else {
    result = buildGuitarChartFromWorker({
      workerAnalysis,
      trackId,
      laneCount,
      difficultyConfig,
    });
  }

  // Graceful fallback to legacy offline pass only if a song had virtually zero worker detections
  if (!result || result.notes.length < 8) {
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

  onProgress(1, 'Ready to take the stage!');
  return {
    ...result,
    sections: result.sections?.length ? result.sections : resolvedSections,
    stemActivity: activity,
    workerAnalysis,
    chartSource: 'worker-dp-fft',
  };
}

export function cloneFreshNotes(notes) {
  return (notes || []).map((n) => ({
    ...n,
    hit: false,
    holding: false,
    holdCompleted: false,
    missed: false,
  }));
}

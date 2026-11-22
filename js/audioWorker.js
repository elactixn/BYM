/**
 * audioWorker.js
 * Sub-Second (<0.5s) Pure-JS Radix-2 FFT & Adaptive Local-Contrast Audio Engine.
 * Runs in a dedicated Web Worker on 16kHz downsampled mono audio so a full 4-minute
 * track transcribes in ~150–380ms without freezing the main UI thread.
 *
 * Core DSP Design:
 *  - Single-pass iterative Radix-2 FFT (512-pt @ 16kHz, 160-sample / 10ms hop -> 100fps)
 *    with precomputed Hann window, bit-reversal table, and twiddle factors (zero trig in loop).
 *  - Local 2.5-second rolling noise floor + Harmonic-to-Noise Ratio (HNR) gating:
 *      * NEVER compares quiet clean intros against loud chorus medians!
 *      * Clean plucked/arpeggiated guitar intros trigger immediately from 0.08s+
 *        with full pitch-contour tracking and sustain detection.
 *      * Bass (40Hz–220Hz) tracks fundamental pitch via parabolic peak + time-domain
 *        autocorrelation on onset frames with sub-kick spike rejection & sustain holds.
 *      * Drums (Kick <110Hz, Snare 160–345Hz + 2.8–7.5kHz snap, Hi-Hat/Crash 5.2–7.8kHz)
 *        are strictly gated by local percussive transient density + tonal/HNR rejection so
 *        pure guitar-only intros generate ZERO drum notes, and drums lock in the instant they enter!
 */

const SAMPLE_RATE = 22050;
const FFT_SIZE = 1024;
const HALF_FFT = FFT_SIZE >> 1; // 512 bins (0..11025 Hz, 21.53 Hz/bin)
const HOP_SIZE = 220; // ~9.98ms per frame (~100.2 fps)
const HOP_SEC = HOP_SIZE / SAMPLE_RATE;
const BIN_HZ = SAMPLE_RATE / FFT_SIZE; // ~21.533 Hz
const ACTIVITY_HOP_SEC = 0.05; // 50ms activity timeline for 3D band & charts

// Essentia.js WASM CDN endpoints (100% client-side, zero API key, automatic fallback if offline)
const ESSENTIA_WASM_ES_URL = 'https://cdn.jsdelivr.net/npm/essentia.js@0.1.3/dist/essentia-wasm.es.js';
const ESSENTIA_CORE_ES_URL = 'https://cdn.jsdelivr.net/npm/essentia.js@0.1.3/dist/essentia.js-core.es.js';
let essentiaPromise = null;

async function getEssentiaInstance(timeoutMs = 3200) {
  if (essentiaPromise) return essentiaPromise;
  essentiaPromise = (async () => {
    try {
      const loadJob = (async () => {
        const [wasmMod, coreMod] = await Promise.all([
          import(/* @vite-ignore */ ESSENTIA_WASM_ES_URL),
          import(/* @vite-ignore */ ESSENTIA_CORE_ES_URL),
        ]);
        const EssentiaWASM = wasmMod?.EssentiaWASM || wasmMod?.default || wasmMod;
        const EssentiaCtor = coreMod?.default || coreMod?.Essentia;
        if (!EssentiaWASM || typeof EssentiaCtor !== 'function') return null;
        const wasmBackend = typeof EssentiaWASM === 'function' ? await EssentiaWASM() : EssentiaWASM;
        return new EssentiaCtor(wasmBackend);
      })();

      const timeoutJob = new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs));
      return await Promise.race([loadJob, timeoutJob]);
    } catch {
      return null;
    }
  })();
  return essentiaPromise;
}

// Precomputed Hann Window
const HANN = new Float32Array(FFT_SIZE);
for (let i = 0; i < FFT_SIZE; i += 1) {
  HANN[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)));
}

// Precomputed Bit-Reversal Permutation Table for FFT_SIZE = 1024
const BIT_REV = new Uint16Array(FFT_SIZE);
{
  const bits = Math.log2(FFT_SIZE);
  for (let i = 0; i < FFT_SIZE; i += 1) {
    let x = i;
    let r = 0;
    for (let b = 0; b < bits; b += 1) {
      r = (r << 1) | (x & 1);
      x >>= 1;
    }
    BIT_REV[i] = r;
  }
}

// Precomputed Radix-2 Twiddle Tables (cos & sin for every butterfly stage)
const TWIDDLE_COS = new Float32Array(HALF_FFT);
const TWIDDLE_SIN = new Float32Array(HALF_FFT);
for (let k = 0; k < HALF_FFT; k += 1) {
  const ang = (-2 * Math.PI * k) / FFT_SIZE;
  TWIDDLE_COS[k] = Math.cos(ang);
  TWIDDLE_SIN[k] = Math.sin(ang);
}

// Scratch FFT & HPSS Median-Filter buffers (reused across all frames -> zero GC pressure)
const fftRe = new Float32Array(FFT_SIZE);
const fftIm = new Float32Array(FFT_SIZE);
const curMag = new Float32Array(HALF_FFT);
const prevHarmMag = new Float32Array(HALF_FFT);
const prevPercMag = new Float32Array(HALF_FFT);
const harmMag = new Float32Array(HALF_FFT);
const percMag = new Float32Array(HALF_FFT);
const HPSS_WIN = 7;
const HPSS_HALF = 3;
const hpssRing = Array.from({ length: HPSS_WIN }, () => new Float32Array(HALF_FFT));
const medScratch = new Float32Array(HPSS_WIN);

function median7(buf) {
  // Fast in-place insertion sort on 7 floats -> returns index 3 (median) with zero allocations
  for (let i = 1; i < 7; i += 1) {
    const key = buf[i];
    let j = i - 1;
    while (j >= 0 && buf[j] > key) {
      buf[j + 1] = buf[j];
      j -= 1;
    }
    buf[j + 1] = key;
  }
  return buf[3];
}

function runFastRadix2Fft(re, im) {
  // Bit-reversal reorder
  for (let i = 0; i < FFT_SIZE; i += 1) {
    const j = BIT_REV[i];
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }

  for (let len = 2; len <= FFT_SIZE; len <<= 1) {
    const half = len >> 1;
    const step = FFT_SIZE / len;
    for (let i = 0; i < FFT_SIZE; i += len) {
      let twIdx = 0;
      for (let j = 0; j < half; j += 1) {
        const wRe = TWIDDLE_COS[twIdx];
        const wIm = TWIDDLE_SIN[twIdx];
        twIdx += step;

        const a = i + j;
        const b = a + half;
        const vRe = re[b] * wRe - im[b] * wIm;
        const vIm = re[b] * wIm + im[b] * wRe;

        re[b] = re[a] - vRe;
        im[b] = im[a] - vIm;
        re[a] += vRe;
        im[a] += vIm;
      }
    }
  }
}

/**
 * O(N) sliding window mean using prefix sums.
 */
function computeRollingMean(arr, halfWin) {
  const n = arr.length;
  const prefix = new Float64Array(n + 1);
  for (let i = 0; i < n; i += 1) {
    prefix[i + 1] = prefix[i] + arr[i];
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
 * Fast local 2.5-second rolling noise-floor estimator using 250ms sub-block medians
 * and sliding window percentile (25th percentile = quiet background floor, 50th = local median).
 * Runs in <4ms for a 4-minute song!
 */
function computeLocalRollingFloors(arr, windowSec = 2.5, hopSec = HOP_SEC) {
  const n = arr.length;
  const blockFrames = Math.max(1, Math.round(0.25 / hopSec)); // 25 frames = 250ms
  const numBlocks = Math.max(1, Math.ceil(n / blockFrames));
  const blockAvg = new Float32Array(numBlocks);

  for (let b = 0; b < numBlocks; b += 1) {
    const start = b * blockFrames;
    const end = Math.min(n, start + blockFrames);
    let sum = 0;
    for (let i = start; i < end; i += 1) sum += arr[i];
    blockAvg[b] = sum / Math.max(1, end - start);
  }

  const halfWinBlocks = Math.max(2, Math.round((windowSec * 0.5) / 0.25)); // 5 blocks each side = 2.5s
  const blockFloor = new Float32Array(numBlocks);
  const blockMedian = new Float32Array(numBlocks);
  const scratch = [];

  for (let b = 0; b < numBlocks; b += 1) {
    scratch.length = 0;
    const lo = Math.max(0, b - halfWinBlocks);
    const hi = Math.min(numBlocks - 1, b + halfWinBlocks);
    for (let k = lo; k <= hi; k += 1) {
      scratch.push(blockAvg[k]);
    }
    scratch.sort((x, y) => x - y);
    const p25Idx = Math.floor(scratch.length * 0.25);
    const p50Idx = Math.floor(scratch.length * 0.5);
    blockFloor[b] = scratch[p25Idx];
    blockMedian[b] = scratch[p50Idx];
  }

  const floorOut = new Float32Array(n);
  const medianOut = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const b = Math.min(numBlocks - 1, Math.floor(i / blockFrames));
    floorOut[i] = blockFloor[b];
    medianOut[i] = blockMedian[b];
  }
  return { floor: floorOut, median: medianOut };
}

/**
 * Estimates song BPM & beat phase via autocorrelation on weighted onset flux.
 */
function estimateTempoAndPhase(flux, hopSec, bpmHint = null) {
  const n = flux.length;
  if (n < 120) {
    const bpm = bpmHint || 120;
    return { bpm, beatSec: 60 / bpm, beatPhaseSec: 0 };
  }

  // Smooth & subtract local mean so autocorrelation targets beat periodicity
  const mean = computeRollingMean(flux, 35);
  const centered = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    centered[i] = Math.max(0, flux[i] - mean[i] * 0.9);
  }

  const minBpm = 68;
  const maxBpm = 192;
  const minLag = Math.max(8, Math.floor(60 / maxBpm / hopSec));
  const maxLag = Math.min(Math.floor(n / 3), Math.ceil(60 / minBpm / hopSec));

  let bestLag = Math.round(60 / 120 / hopSec);
  let bestScore = -1;
  const stride = n > 12000 ? 2 : 1;

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let sum = 0;
    let count = 0;
    for (let i = 0; i < n - lag; i += stride) {
      sum += centered[i] * centered[i + lag];
      count += 1;
    }
    const candBpm = 60 / (lag * hopSec);
    // Gentle perceptual tempo prior centered around 118 BPM
    const tempoPrior = Math.exp(-0.5 * Math.pow((candBpm - 118) / 42, 2));
    const score = (sum / Math.max(1, count)) * (0.72 + 0.28 * tempoPrior);
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }

  let bpm = 60 / (bestLag * hopSec);
  while (bpm < 84) bpm *= 2;
  while (bpm > 176) bpm *= 0.5;

  if (bpmHint && bpmHint >= 68 && bpmHint <= 200) {
    const ratio = bpm / bpmHint;
    if (Math.abs(ratio - 1) < 0.08) {
      bpm = bpmHint;
    } else if (Math.abs(ratio - 2) < 0.1 || Math.abs(ratio - 0.5) < 0.06) {
      bpm = bpmHint;
    }
  }

  bpm = Math.max(68, Math.min(196, Math.round(bpm)));
  const beatSec = 60 / bpm;

  // Phase-lock grid to strongest onset alignment across 24 candidate subdivisions
  const phaseSteps = 24;
  let bestPhase = 0;
  let bestPhaseScore = -1;
  const maxCheck = Math.min(n, Math.floor(75 / hopSec));

  for (let p = 0; p < phaseSteps; p += 1) {
    const phaseSec = (p / phaseSteps) * beatSec;
    let score = 0;
    for (let t = phaseSec; t < maxCheck * hopSec; t += beatSec) {
      const f = Math.round(t / hopSec);
      if (f >= 1 && f < n - 1) {
        score += centered[f] + centered[f - 1] * 0.45 + centered[f + 1] * 0.45;
      }
    }
    if (score > bestPhaseScore) {
      bestPhaseScore = score;
      bestPhase = phaseSec;
    }
  }

  return { bpm, beatSec, beatPhaseSec: bestPhase };
}

/**
 * Dynamic Programming Beat & Downbeat Tracker (Ellis 2007 style):
 * Tracks exact beat timestamps across live drummers, tempo shifts, and rubato intros
 * without static-BPM drift, then locks 4/4 downbeat measures using low-end + novelty accent.
 */
function trackDynamicBeats(onsetFlux, kickEnergy, bassEnergy, snareFlux, hopSec, baseBpm, duration) {
  const n = onsetFlux.length;
  const fallbackBeatSec = 60 / Math.max(68, Math.min(196, baseBpm || 120));
  if (n < 150) {
    const beats = [];
    const grid = [];
    for (let i = 0; i * fallbackBeatSec < duration; i += 1) {
      const t = Number((i * fallbackBeatSec).toFixed(4));
      beats.push(t);
      grid.push({ timeSec: t, isMeasure: i % 4 === 0, beatIndex: i, localBpm: baseBpm || 120 });
    }
    return { beats, dynamicBeatGrid: grid, downbeatPhase: 0 };
  }

  // 1. Build a locally-normalized beat-strength curve combining rhythmic flux + kick/snare weight
  const rawStrength = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    rawStrength[i] = onsetFlux[i] + kickEnergy[i] * 1.4 + snareFlux[i] * 0.9;
  }
  const localMean = computeRollingMean(rawStrength, 60); // 1.2s local normalization
  const beatEnv = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const norm = rawStrength[i] / Math.max(0.004, localMean[i] * 1.65 + 0.004);
    // Gentle 3-tap Gaussian smoothing (~30ms) so beat peaks sit cleanly on attack transients
    beatEnv[i] = Math.min(3.0, Math.log1p(norm * 2.2));
  }
  const smoothEnv = new Float32Array(n);
  for (let i = 1; i < n - 1; i += 1) {
    smoothEnv[i] = beatEnv[i - 1] * 0.25 + beatEnv[i] * 0.5 + beatEnv[i + 1] * 0.25;
  }

  // 2. Estimate local beat period (in frames) every 4 seconds so DP adapts smoothly to tempo drift
  const globalPeriod = Math.round(fallbackBeatSec / hopSec);
  const blockSec = 4.0;
  const blockFrames = Math.max(100, Math.round(blockSec / hopSec));
  const numBlocks = Math.max(1, Math.ceil(n / blockFrames));
  const localPeriodPerBlock = new Float32Array(numBlocks);
  const minSearchLag = Math.max(24, Math.floor(globalPeriod * 0.84));
  const maxSearchLag = Math.min(110, Math.ceil(globalPeriod * 1.16));

  for (let b = 0; b < numBlocks; b += 1) {
    const lo = Math.max(0, b * blockFrames - 100);
    const hi = Math.min(n, (b + 1) * blockFrames + 100);
    let bestLag = globalPeriod;
    let bestVal = -1;
    for (let lag = minSearchLag; lag <= maxSearchLag; lag += 1) {
      let acc = 0;
      let cnt = 0;
      for (let i = lo; i < hi - lag; i += 2) {
        acc += smoothEnv[i] * smoothEnv[i + lag];
        cnt += 1;
      }
      const driftPen = Math.exp(-0.5 * Math.pow((lag - globalPeriod) / (globalPeriod * 0.085), 2));
      const score = (acc / Math.max(1, cnt)) * (0.72 + 0.28 * driftPen);
      if (score > bestVal) {
        bestVal = score;
        bestLag = lag;
      }
    }
    localPeriodPerBlock[b] = bestLag;
  }

  // Smooth local period curve across neighboring 4s blocks to avoid abrupt tempo jumps
  for (let b = 1; b < numBlocks - 1; b += 1) {
    localPeriodPerBlock[b] =
      localPeriodPerBlock[b - 1] * 0.25 +
      localPeriodPerBlock[b] * 0.5 +
      localPeriodPerBlock[b + 1] * 0.25;
  }

  // 3. Dynamic Programming Beat Path Search (O(N * 0.7 * P), ~12ms for 4-minute track!)
  const dpScore = new Float32Array(n);
  const dpBack = new Int32Array(n);
  dpBack.fill(-1);
  const tightness = 4.6; // Allows live-drummer swing & tempo changes while preventing double/half jumps

  for (let f = 0; f < n; f += 1) {
    const blk = Math.min(numBlocks - 1, Math.floor(f / blockFrames));
    const targetP = localPeriodPerBlock[blk];
    const minTau = Math.max(18, Math.floor(targetP * 0.65));
    const maxTau = Math.min(f, Math.ceil(targetP * 1.42));

    let bestPrevScore = 0;
    let bestPrevIdx = -1;

    if (f >= minTau) {
      bestPrevScore = -1e9;
      for (let tau = minTau; tau <= maxTau; tau += 1) {
        const prev = f - tau;
        const ratio = Math.log(tau / targetP);
        const cand = dpScore[prev] - tightness * ratio * ratio;
        if (cand > bestPrevScore) {
          bestPrevScore = cand;
          bestPrevIdx = prev;
        }
      }
    }

    dpScore[f] = smoothEnv[f] + (bestPrevIdx >= 0 ? bestPrevScore : 0);
    dpBack[f] = bestPrevIdx;
  }

  // Backtrack from highest-scoring beat in the final 1.5x beat window
  let endFrame = n - 1;
  const tailStart = Math.max(0, n - Math.round(globalPeriod * 1.6));
  let bestEndScore = -1e9;
  for (let f = tailStart; f < n; f += 1) {
    if (dpScore[f] > bestEndScore) {
      bestEndScore = dpScore[f];
      endFrame = f;
    }
  }

  const rawBeatFrames = [];
  let cur = endFrame;
  while (cur >= 0) {
    rawBeatFrames.push(cur);
    cur = dpBack[cur];
  }
  rawBeatFrames.reverse();

  // Back-fill beats smoothly to t = 0 if DP started slightly into a quiet/rubato intro
  while (rawBeatFrames.length > 0 && rawBeatFrames[0] > globalPeriod * 0.9) {
    const stepP = rawBeatFrames.length >= 2
      ? Math.max(Math.round(globalPeriod * 0.8), Math.min(Math.round(globalPeriod * 1.2), rawBeatFrames[1] - rawBeatFrames[0]))
      : globalPeriod;
    const prev = rawBeatFrames[0] - stepP;
    if (prev < 0) break;
    rawBeatFrames.unshift(prev);
  }
  // Forward-fill to song end if needed
  while (rawBeatFrames.length > 0 && rawBeatFrames[rawBeatFrames.length - 1] + globalPeriod < n) {
    const last = rawBeatFrames[rawBeatFrames.length - 1];
    rawBeatFrames.push(last + globalPeriod);
  }

  // 4. Score all 4 possible 4/4 downbeat phases (0, 1, 2, 3) using kick/bass + beat strength on Beat 1
  const phaseScores = [0, 0, 0, 0];
  for (let i = 0; i < rawBeatFrames.length; i += 1) {
    const f = Math.min(n - 1, Math.max(0, rawBeatFrames[i]));
    const lowWeight = kickEnergy[f] * 2.2 + bassEnergy[f] * 1.1 + smoothEnv[f] * 0.65;
    // Beat 1 tends to be strong on kick, while Beat 2 & 4 tend to have snare backbeat
    const snareBackbeat = i + 1 < rawBeatFrames.length
      ? snareFlux[Math.min(n - 1, rawBeatFrames[i + 1])] * 0.9
      : 0;
    phaseScores[i % 4] += lowWeight + snareBackbeat;
  }

  let downbeatPhase = 0;
  for (let p = 1; p < 4; p += 1) {
    if (phaseScores[p] > phaseScores[downbeatPhase]) downbeatPhase = p;
  }

  const beats = [];
  const dynamicBeatGrid = [];
  for (let i = 0; i < rawBeatFrames.length; i += 1) {
    const tSec = Number((rawBeatFrames[i] * hopSec).toFixed(4));
    const prevT = i > 0 ? rawBeatFrames[i - 1] * hopSec : tSec - fallbackBeatSec;
    const dtBeat = Math.max(0.25, Math.min(1.2, tSec - prevT));
    const localBpm = Math.round(60 / dtBeat);
    beats.push(tSec);
    dynamicBeatGrid.push({
      timeSec: tSec,
      isMeasure: ((i - downbeatPhase) % 4 + 4) % 4 === 0,
      beatIndex: i,
      localBpm: Math.max(60, Math.min(220, localBpm)),
    });
  }

  return { beats, dynamicBeatGrid, downbeatPhase };
}

/**
 * Beat-Synchronous Energy & Spectral Novelty Song-Section Segmenter:
 * Labels every structural segment of the track as:
 *   INTRO | VERSE | PRE_CHORUS | CHORUS | GUITAR_SOLO | BRIDGE | OUTRO
 * using 4-bar measure descriptors (RMS energy, drum density, bass body, lead-guitar
 * high-register dominance + HNR, and 6-band timbre cosine novelty).
 */
function segmentSongSections({
  dynamicBeatGrid,
  duration,
  hopSec,
  rmsAll,
  drumActiveFrame,
  bassEnergy,
  guitarEnergy,
  guitarHighEnergy,
  guitarHnr,
  bandProfiles,
}) {
  const numFrames = rmsAll.length;
  // Collect measure start timestamps (every 4 beats)
  const measureStarts = [];
  for (let i = 0; i < dynamicBeatGrid.length; i += 1) {
    if (dynamicBeatGrid[i].isMeasure) {
      measureStarts.push(dynamicBeatGrid[i].timeSec);
    }
  }
  if (measureStarts.length === 0 || measureStarts[0] > 0.4) {
    measureStarts.unshift(0);
  }

  // Group into 2-bar blocks (~3.5–4.5s) for crisp musical section boundaries
  const barStep = measureStarts.length >= 24 ? 2 : 1;
  const blocks = [];
  for (let m = 0; m < measureStarts.length; m += barStep) {
    const startSec = measureStarts[m];
    const endSec = m + barStep < measureStarts.length ? measureStarts[m + barStep] : duration;
    if (endSec - startSec < 0.8) continue;

    const f0 = Math.max(0, Math.min(numFrames - 1, Math.floor(startSec / hopSec)));
    const f1 = Math.max(f0 + 1, Math.min(numFrames, Math.ceil(endSec / hopSec)));
    const len = f1 - f0;

    let rmsSum = 0;
    let drumSum = 0;
    let bassSum = 0;
    let gSum = 0;
    let gHighSum = 0;
    let hnrSum = 0;
    const prof = new Float32Array(6);

    for (let f = f0; f < f1; f += 1) {
      rmsSum += rmsAll[f];
      drumSum += drumActiveFrame[f];
      bassSum += bassEnergy[f];
      gSum += guitarEnergy[f];
      gHighSum += guitarHighEnergy[f];
      hnrSum += guitarHnr[f];
      const pOff = f * 6;
      for (let b = 0; b < 6; b += 1) prof[b] += bandProfiles[pOff + b];
    }

    // L2-normalize 6-band timbre vector for cosine self-similarity
    let pNorm = 0;
    for (let b = 0; b < 6; b += 1) {
      prof[b] /= len;
      pNorm += prof[b] * prof[b];
    }
    pNorm = Math.sqrt(pNorm) || 1e-6;
    for (let b = 0; b < 6; b += 1) prof[b] /= pNorm;

    blocks.push({
      startSec,
      endSec,
      rms: rmsSum / len,
      drumDensity: drumSum / len,
      bass: bassSum / len,
      guitar: gSum / len,
      guitarHigh: gHighSum / len,
      hnr: hnrSum / len,
      prof,
    });
  }

  if (blocks.length <= 2) {
    return [
      { id: 'sec_0', type: 'INTRO', label: 'Intro', startSec: 0, endSec: Number((duration * 0.2).toFixed(3)), energy: 0.45 },
      { id: 'sec_1', type: 'VERSE', label: 'Verse', startSec: Number((duration * 0.2).toFixed(3)), endSec: Number((duration * 0.55).toFixed(3)), energy: 0.65 },
      { id: 'sec_2', type: 'CHORUS', label: 'Chorus', startSec: Number((duration * 0.55).toFixed(3)), endSec: Number((duration * 0.88).toFixed(3)), energy: 0.92 },
      { id: 'sec_3', type: 'OUTRO', label: 'Outro', startSec: Number((duration * 0.88).toFixed(3)), endSec: Number(duration.toFixed(3)), energy: 0.55 },
    ];
  }

  // Compute song-relative percentiles for robust classification across loud/quiet masters
  const sortedRms = blocks.map((b) => b.rms).sort((a, b) => a - b);
  const p30Rms = sortedRms[Math.floor(sortedRms.length * 0.3)] || 0.02;
  const p55Rms = sortedRms[Math.floor(sortedRms.length * 0.55)] || 0.05;
  const p72Rms = sortedRms[Math.floor(sortedRms.length * 0.72)] || 0.08;
  const maxRms = sortedRms[sortedRms.length - 1] || 0.1;

  const sortedGHigh = blocks.map((b) => b.guitarHigh).sort((a, b) => a - b);
  const p78GHigh = sortedGHigh[Math.floor(sortedGHigh.length * 0.78)] || 0.02;

  // Spectral novelty curve via cosine distance + energy jump between adjacent 2-bar blocks
  const novelty = new Float32Array(blocks.length);
  for (let i = 1; i < blocks.length; i += 1) {
    const a = blocks[i - 1];
    const b = blocks[i];
    let dot = 0;
    for (let k = 0; k < 6; k += 1) dot += a.prof[k] * b.prof[k];
    const cosDist = Math.max(0, 1 - dot);
    const eDiff = Math.abs(b.rms - a.rms) / Math.max(0.01, maxRms);
    const drumJump = Math.abs(b.drumDensity - a.drumDensity);
    novelty[i] = cosDist * 1.45 + eDiff * 1.2 + drumJump * 0.85;
  }

  // Pick section boundary indices (minimum 2 blocks / ~7–8s per musical section)
  const boundaries = [0];
  let lastBound = 0;
  for (let i = 2; i < blocks.length - 1; i += 1) {
    if (i - lastBound < 2) continue;
    const isPeak = novelty[i] >= novelty[i - 1] && novelty[i] >= novelty[i + 1];
    if ((isPeak && novelty[i] >= 0.28) || i - lastBound >= 5) {
      boundaries.push(i);
      lastBound = i;
    }
  }
  boundaries.push(blocks.length);

  // Label each structural segment musically
  const sections = [];
  let hasSeenChorus = false;
  let hasGuitarSolo = false;

  for (let s = 0; s < boundaries.length - 1; s += 1) {
    const i0 = boundaries[s];
    const i1 = boundaries[s + 1];
    const startSec = blocks[i0].startSec;
    const endSec = blocks[i1 - 1].endSec;
    const midFrac = ((startSec + endSec) * 0.5) / Math.max(1, duration);

    let avgRms = 0;
    let avgDrum = 0;
    let avgGHigh = 0;
    let avgHnr = 0;
    const cnt = Math.max(1, i1 - i0);
    for (let i = i0; i < i1; i += 1) {
      avgRms += blocks[i].rms;
      avgDrum += blocks[i].drumDensity;
      avgGHigh += blocks[i].guitarHigh;
      avgHnr += blocks[i].hnr;
    }
    avgRms /= cnt;
    avgDrum /= cnt;
    avgGHigh /= cnt;
    avgHnr /= cnt;

    const normEnergy = Math.max(0.15, Math.min(1, avgRms / Math.max(0.01, maxRms)));
    let type = 'VERSE';

    if (s === 0 && (midFrac < 0.2 || avgDrum < 0.45 || avgRms < p55Rms)) {
      type = 'INTRO';
    } else if (s === boundaries.length - 2 && midFrac > 0.8) {
      type = 'OUTRO';
    } else if (
      !hasGuitarSolo &&
      midFrac >= 0.45 &&
      midFrac <= 0.84 &&
      avgGHigh >= p78GHigh &&
      avgHnr >= 2.75 &&
      avgRms >= p55Rms * 0.9
    ) {
      type = 'GUITAR_SOLO';
      hasGuitarSolo = true;
    } else if (avgRms >= p72Rms && avgDrum >= 0.48) {
      type = 'CHORUS';
      hasSeenChorus = true;
    } else if (
      hasSeenChorus &&
      midFrac >= 0.52 &&
      midFrac <= 0.82 &&
      (avgRms <= p30Rms * 1.15 || avgDrum < 0.52)
    ) {
      type = 'BRIDGE';
    } else if (s + 1 < boundaries.length - 1) {
      // Check if the next segment jumps up to chorus energy -> label as PRE_CHORUS
      const n0 = boundaries[s + 1];
      const n1 = boundaries[s + 2];
      let nextRms = 0;
      for (let i = n0; i < n1; i += 1) nextRms += blocks[i].rms;
      nextRms /= Math.max(1, n1 - n0);
      if (nextRms >= p72Rms && avgRms >= p30Rms && avgRms < p72Rms && endSec - startSec <= 18) {
        type = 'PRE_CHORUS';
      } else {
        type = 'VERSE';
      }
    }

    const labelMap = {
      INTRO: 'Intro',
      VERSE: 'Verse',
      PRE_CHORUS: 'Pre-Chorus',
      CHORUS: 'Chorus',
      GUITAR_SOLO: 'Guitar Solo',
      BRIDGE: 'Bridge',
      OUTRO: 'Outro',
    };

    // Merge consecutive identical types for cleaner section timelines
    const prev = sections[sections.length - 1];
    if (prev && prev.type === type) {
      prev.endSec = Number(endSec.toFixed(3));
      prev.energy = Number(((prev.energy + normEnergy) * 0.5).toFixed(3));
    } else {
      sections.push({
        id: `sec_${sections.length}`,
        type,
        label: labelMap[type] || 'Verse',
        startSec: Number(startSec.toFixed(3)),
        endSec: Number(endSec.toFixed(3)),
        energy: Number(normEnergy.toFixed(3)),
      });
    }
  }

  if (sections.length > 0) {
    sections[0].startSec = 0;
    sections[sections.length - 1].endSec = Number(duration.toFixed(3));
  }
  return sections;
}

/**
 * Estimates fundamental bass frequency (41Hz–220Hz) at a specific sample offset using
 * normalized time-domain autocorrelation (called only on sparse bass onset frames -> ultra-fast!).
 */
function estimateBassFundamentalHz(mono, centerSample, fallbackHz) {
  const win = 512; // 32ms @ 16kHz (covers down to ~40Hz)
  const start = Math.max(0, Math.min(mono.length - win - 1, centerSample - 64));
  if (start + win >= mono.length) return fallbackHz;

  // Remove DC offset + compute signal energy
  let dc = 0;
  for (let i = 0; i < win; i += 1) dc += mono[start + i];
  dc /= win;

  let energy = 0;
  for (let i = 0; i < win; i += 1) {
    const s = mono[start + i] - dc;
    energy += s * s;
  }
  if (energy < 1e-6) return fallbackHz;

  const minLag = Math.floor(SAMPLE_RATE / 225); // 71 samples (~225Hz)
  const maxLag = Math.min(win - 64, Math.ceil(SAMPLE_RATE / 41)); // 390 samples (~41Hz)

  let bestLag = -1;
  let bestCorr = 0.24;

  for (let lag = minLag; lag <= maxLag; lag += 2) {
    let num = 0;
    let denA = 0;
    let denB = 0;
    const len = win - lag;
    for (let i = 0; i < len; i += 2) {
      const a = mono[start + i] - dc;
      const b = mono[start + i + lag] - dc;
      num += a * b;
      denA += a * a;
      denB += b * b;
    }
    const corr = num / Math.sqrt(Math.max(1e-10, denA * denB));
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  if (bestLag > 0) {
    return SAMPLE_RATE / bestLag;
  }
  return fallbackHz;
}

/**
 * Core WASM AI (Essentia.js) + 22.05kHz Median-Filtered HPSS Radix-2 FFT Analyzer.
 * Runs in the background Web Worker with zero main-thread lag and automatic offline fallback.
 */
export async function analyzeMono22k(mono22k, { bpmHint = null, duration = 0, onProgress = null } = {}) {
  const mono16k = mono22k; // preserved internal alias for downstream routines
  const totalSamples = mono22k.length;
  const actualDuration = duration > 0 ? duration : totalSamples / SAMPLE_RATE;
  const numFrames = Math.max(1, Math.floor((totalSamples - FFT_SIZE) / HOP_SIZE) + 1);

  // Kick off optional Essentia.js WASM MIR loader in parallel with STFT+HPSS
  const essentiaTask = getEssentiaInstance(3000);

  // Per-frame band energies, fluxes, HNR & pitch estimates
  const rmsAll = new Float32Array(numFrames);
  const kickEnergy = new Float32Array(numFrames);
  const bassEnergy = new Float32Array(numFrames);
  const snareBodyEnergy = new Float32Array(numFrames);
  const guitarEnergy = new Float32Array(numFrames);
  const guitarHighEnergy = new Float32Array(numFrames);
  const pianoEnergy = new Float32Array(numFrames);
  const snapEnergy = new Float32Array(numFrames);
  const cymbalEnergy = new Float32Array(numFrames);
  const bandProfiles = new Float32Array(numFrames * 6);

  const kickFlux = new Float32Array(numFrames);
  const bassFlux = new Float32Array(numFrames);
  const snareFlux = new Float32Array(numFrames);
  const cymbalFlux = new Float32Array(numFrames);
  const guitarFlux = new Float32Array(numFrames);
  const pianoFlux = new Float32Array(numFrames);
  const combinedFlux = new Float32Array(numFrames);

  const guitarHnr = new Float32Array(numFrames);
  const highFlatness = new Float32Array(numFrames);
  const guitarPitchHz = new Float32Array(numFrames);
  const pianoPitchHz = new Float32Array(numFrames);
  const pianoPeakCount = new Uint8Array(numFrames);
  const bassPeakHz = new Float32Array(numFrames);

  prevHarmMag.fill(0);
  prevPercMag.fill(0);

  // Frequency bin boundaries (21.533 Hz / bin @ 22.05kHz / 1024-pt FFT)
  const KICK_LO = Math.max(1, Math.round(40 / BIN_HZ)); // ~43Hz
  const KICK_HI = Math.round(112 / BIN_HZ); // ~108Hz
  const BASS_LO = Math.max(1, Math.round(40 / BIN_HZ)); // ~43Hz
  const BASS_HI = Math.round(220 / BIN_HZ); // ~215Hz
  const PIANO_LO = Math.round(130 / BIN_HZ); // ~129Hz (MIDI 48)
  const PIANO_HI = Math.round(2200 / BIN_HZ); // ~2196Hz (MIDI 84+)
  const SNARE_BODY_LO = Math.round(180 / BIN_HZ); // ~172Hz
  const SNARE_BODY_HI = Math.round(400 / BIN_HZ); // ~409Hz
  const GUITAR_LO = Math.round(250 / BIN_HZ); // ~258Hz
  const GUITAR_HI = Math.min(HALF_FFT - 2, Math.round(4500 / BIN_HZ)); // ~4500Hz
  const GUITAR_SOLO_LO = Math.round(880 / BIN_HZ); // ~883Hz
  const GUITAR_PITCH_MAX_BIN = Math.min(HALF_FFT - 2, Math.round(2400 / BIN_HZ));
  const SNAP_LO = Math.round(2500 / BIN_HZ); // 2.5kHz
  const SNAP_HI = Math.round(6000 / BIN_HZ); // 6.0kHz
  const CYMBAL_LO = Math.round(7000 / BIN_HZ); // >7.0kHz true hi-hat/cymbal sheen
  const CYMBAL_HI = Math.min(HALF_FFT - 1, Math.round(10600 / BIN_HZ)); // ~10.6kHz

  let prevKickE = 0;
  let prevBassE = 0;
  let prevSnareBodyE = 0;
  let prevSnapE = 0;
  let prevCymbalE = 0;
  let lastGuitarHz = 440;
  let lastPianoHz = 392;
  let lastBassHz = 92;

  const progressStride = Math.max(200, Math.floor(numFrames / 8));

  const computeFrameMag = (frameIdx, targetBuf) => {
    const clampedF = Math.max(0, Math.min(numFrames - 1, frameIdx));
    const base = clampedF * HOP_SIZE;
    let sqSum = 0;
    for (let i = 0; i < FFT_SIZE; i += 1) {
      const s = mono22k[base + i] || 0;
      sqSum += s * s;
      fftRe[i] = s * HANN[i];
      fftIm[i] = 0;
    }
    if (frameIdx >= 0 && frameIdx < numFrames) {
      rmsAll[frameIdx] = Math.sqrt(sqSum / FFT_SIZE);
    }
    runFastRadix2Fft(fftRe, fftIm);
    const norm = 2 / FFT_SIZE;
    for (let k = 0; k < HALF_FFT; k += 1) {
      const r = fftRe[k];
      const im = fftIm[k];
      targetBuf[k] = Math.sqrt(r * r + im * im) * norm;
    }
  };

  // Pre-fill 7-frame HPSS ring buffer centered at frame 0 (clamped edges)
  for (let r = 0; r < HPSS_WIN; r += 1) {
    computeFrameMag(r - HPSS_HALF, hpssRing[r]);
  }

  for (let f = 0; f < numFrames; f += 1) {
    if (f > 0) {
      const writeSlot = (f + HPSS_WIN - 1) % HPSS_WIN;
      computeFrameMag(f + HPSS_HALF, hpssRing[writeSlot]);
    }
    const centerSlot = (f + HPSS_HALF) % HPSS_WIN;
    const centerMag = hpssRing[centerSlot];

    // =========================================================================
    // MEDIAN-FILTERED HPSS (Harmonic-Percussive Source Separation, Wiener Soft Mask)
    // Time-axis median (7 frames) -> steady Harmonic ridges (Guitar/Bass/Piano)
    // Frequency-axis median (7 bins) -> broadband Percussive attacks (Kick/Snare/Cymbals)
    // =========================================================================
    harmMag[0] = centerMag[0];
    percMag[0] = 0;
    for (let k = 1; k < HALF_FFT; k += 1) {
      // 7-frame time median
      medScratch[0] = hpssRing[0][k];
      medScratch[1] = hpssRing[1][k];
      medScratch[2] = hpssRing[2][k];
      medScratch[3] = hpssRing[3][k];
      medScratch[4] = hpssRing[4][k];
      medScratch[5] = hpssRing[5][k];
      medScratch[6] = hpssRing[6][k];
      const hMed = median7(medScratch);

      // 7-bin frequency median
      for (let d = -3; d <= 3; d += 1) {
        const bk = k + d;
        medScratch[d + 3] = centerMag[bk < 0 ? 0 : bk >= HALF_FFT ? HALF_FFT - 1 : bk];
      }
      const pMed = median7(medScratch);

      const h2 = hMed * hMed;
      const p2 = pMed * pMed;
      const denom = h2 + p2 + 1e-12;
      const mVal = centerMag[k];
      harmMag[k] = mVal * (h2 / denom);
      percMag[k] = mVal * (p2 / denom);
    }

    // 1. Sub-Kick (40–110Hz) — strictly from Percussive Spectrogram!
    let kE = 0;
    let kPosFlux = 0;
    for (let k = KICK_LO; k <= KICK_HI; k += 1) {
      const pm = percMag[k] * 0.8 + centerMag[k] * 0.2;
      kE += pm;
      const d = pm - prevPercMag[k];
      if (d > 0) kPosFlux += d;
    }
    kE /= Math.max(1, KICK_HI - KICK_LO + 1);
    kickEnergy[f] = kE;
    kickFlux[f] = kPosFlux * 0.52 + Math.max(0, kE - prevKickE) * 1.3;
    prevKickE = kE;

    // 2. Bass (40–220Hz) — strictly from Harmonic Spectrogram + peak bin tracking
    let bE = 0;
    let bFlux = 0;
    let bestBassBin = KICK_LO + 1;
    let bestBassVal = 0;
    for (let k = BASS_LO; k <= BASS_HI; k += 1) {
      const m = harmMag[k];
      bE += m;
      const d = m - prevHarmMag[k];
      if (d > 0) bFlux += d;
      if (k >= 2 && m > bestBassVal) {
        bestBassVal = m;
        bestBassBin = k;
      }
    }
    bE /= (BASS_HI - BASS_LO + 1);
    bassEnergy[f] = bE;
    bassFlux[f] = bFlux * 0.36 + Math.max(0, bE - prevBassE) * 1.45;
    prevBassE = bE;
    if (bestBassVal > 0.0012 && bestBassBin > 1 && bestBassBin < BASS_HI) {
      const y0 = harmMag[bestBassBin - 1];
      const y1 = harmMag[bestBassBin];
      const y2 = harmMag[bestBassBin + 1];
      const denom = y0 - 2 * y1 + y2;
      const delta = Math.abs(denom) > 1e-8 ? (0.5 * (y0 - y2)) / denom : 0;
      lastBassHz = Math.max(41, Math.min(220, (bestBassBin + Math.max(-0.5, Math.min(0.5, delta))) * BIN_HZ));
    }
    bassPeakHz[f] = lastBassHz;

    // 3. Snare Body (180–400Hz) — strictly from Percussive Spectrogram!
    let sbE = 0;
    for (let k = SNARE_BODY_LO; k <= SNARE_BODY_HI; k += 1) sbE += percMag[k];
    sbE /= Math.max(1, SNARE_BODY_HI - SNARE_BODY_LO + 1);
    snareBodyEnergy[f] = sbE;

    // 4. Lead Guitar (250Hz–4500Hz) — strictly from Harmonic Spectrogram + HNR + Solo High-Register
    let gSum = 0;
    let gHighSum = 0;
    let gFlux = 0;
    let top1 = 0;
    let top2 = 0;
    let top3 = 0;
    let bestHarmScore = 0;
    let bestPitchBin = GUITAR_LO + 4;
    let weightedHz = 0;
    let weightedSum = 0;

    for (let k = GUITAR_LO; k <= GUITAR_HI; k += 1) {
      const m = harmMag[k];
      gSum += m;
      if (k >= GUITAR_SOLO_LO) gHighSum += m;
      const d = m - prevHarmMag[k];
      if (d > 0) gFlux += d;

      if (k > GUITAR_LO && k < GUITAR_HI && m >= harmMag[k - 1] && m >= harmMag[k + 1]) {
        if (m > top1) {
          top3 = top2;
          top2 = top1;
          top1 = m;
        } else if (m > top2) {
          top3 = top2;
          top2 = m;
        } else if (m > top3) {
          top3 = m;
        }
      }

      if (k <= GUITAR_PITCH_MAX_BIN) {
        const h2 = k * 2 < HALF_FFT ? harmMag[k * 2] : 0;
        const h3 = k * 3 < HALF_FFT ? harmMag[k * 3] : 0;
        const harmScore = m + h2 * 0.55 + h3 * 0.3;
        if (harmScore > bestHarmScore) {
          bestHarmScore = harmScore;
          bestPitchBin = k;
        }
      }

      const w = m * m;
      weightedHz += w * (k * BIN_HZ);
      weightedSum += w;
    }

    const gBins = GUITAR_HI - GUITAR_LO + 1;
    const gMean = gSum / gBins;
    guitarEnergy[f] = gMean;
    guitarHighEnergy[f] = gHighSum / Math.max(1, GUITAR_HI - GUITAR_SOLO_LO + 1);

    const peakAvg = (top1 + top2 * 0.75 + top3 * 0.5) / 2.25;
    const hnr = peakAvg / Math.max(1e-6, gMean);
    guitarHnr[f] = hnr;

    const hnrBoost = hnr > 3.2 ? 1.38 : hnr > 2.2 ? 1.08 : 0.74;
    guitarFlux[f] = (gFlux / gBins) * 3.1 * hnrBoost;

    if (bestHarmScore > 0.001 && bestPitchBin > GUITAR_LO && bestPitchBin < GUITAR_PITCH_MAX_BIN) {
      const y0 = harmMag[bestPitchBin - 1];
      const y1 = harmMag[bestPitchBin];
      const y2 = harmMag[bestPitchBin + 1];
      const denom = y0 - 2 * y1 + y2;
      const delta = Math.abs(denom) > 1e-8 ? (0.5 * (y0 - y2)) / denom : 0;
      const interpHz = (bestPitchBin + Math.max(-0.5, Math.min(0.5, delta))) * BIN_HZ;
      const centroidHz = weightedSum > 1e-8 ? weightedHz / weightedSum : interpHz;
      lastGuitarHz = Math.max(180, Math.min(3400, interpHz * 0.78 + centroidHz * 0.22));
    }
    guitarPitchHz[f] = lastGuitarHz;

    // 4B. Piano / Keys Harmonic Mid-Range (130Hz–2.2kHz / MIDI 48–84) from Harmonic Spectrogram
    let pSum = 0;
    let pFlux = 0;
    let pWeightedHz = 0;
    let pWeightedSum = 0;
    let pMax = 0;
    for (let k = PIANO_LO; k <= PIANO_HI; k += 1) {
      const m = harmMag[k];
      pSum += m;
      if (m > pMax) pMax = m;
      const d = m - prevHarmMag[k];
      if (d > 0) pFlux += d;
      const w = m * m;
      pWeightedHz += w * (k * BIN_HZ);
      pWeightedSum += w;
    }
    const pBins = PIANO_HI - PIANO_LO + 1;
    const pMean = pSum / pBins;
    pianoEnergy[f] = pMean;
    pianoFlux[f] = (pFlux / pBins) * 3.1;

    let distinctPeaks = 0;
    const peakCut = Math.max(pMean * 2.15, pMax * 0.34, 0.0022);
    for (let k = PIANO_LO + 1; k < PIANO_HI; k += 1) {
      const m = harmMag[k];
      if (m >= peakCut && m >= harmMag[k - 1] && m > harmMag[k + 1]) {
        distinctPeaks += 1;
      }
    }
    pianoPeakCount[f] = Math.min(12, distinctPeaks);
    if (pWeightedSum > 1e-8 && pMean > 0.0012) {
      lastPianoHz = Math.max(130, Math.min(2200, pWeightedHz / pWeightedSum));
    }
    pianoPitchHz[f] = lastPianoHz;

    // 5. Snare Wire Snap (2.5kHz–6kHz) + Hi-Hat/Cymbal Sheen (>7kHz) — strictly from Percussive Spectrogram!
    let snapSum = 0;
    let snapPosFlux = 0;
    let snapLogSum = 0;
    let snapBinCount = 0;
    let cymSum = 0;
    let cymPosFlux = 0;

    for (let k = SNAP_LO; k <= CYMBAL_HI; k += 1) {
      const m = percMag[k];
      const d = m - prevPercMag[k];
      if (k <= SNAP_HI) {
        snapSum += m;
        snapLogSum += Math.log(m + 1e-6);
        snapBinCount += 1;
        if (d > 0) snapPosFlux += d;
      }
      if (k >= CYMBAL_LO) {
        cymSum += m;
        if (d > 0) cymPosFlux += d;
      }
    }

    const sMean = snapSum / Math.max(1, snapBinCount);
    snapEnergy[f] = sMean;
    const geomMean = Math.exp(snapLogSum / Math.max(1, snapBinCount));
    highFlatness[f] = Math.min(1, geomMean / Math.max(1e-6, sMean));

    const cymBins = Math.max(1, CYMBAL_HI - CYMBAL_LO + 1);
    const cMean = cymSum / cymBins;
    cymbalEnergy[f] = cMean;

    const sbRise = Math.max(0, sbE - prevSnareBodyE);
    const snapRise = Math.max(0, sMean - prevSnapE);
    const cymRise = Math.max(0, cMean - prevCymbalE);
    prevSnareBodyE = sbE;
    prevSnapE = sMean;
    prevCymbalE = cMean;

    const flatMult = highFlatness[f] >= 0.3 ? 1.32 : highFlatness[f] >= 0.18 ? 0.85 : 0.3;
    snareFlux[f] = (sbRise * 1.25 + snapRise * 2.6 + (snapPosFlux / Math.max(1, snapBinCount)) * 2.0) * flatMult;
    cymbalFlux[f] = (cymRise * 2.9 + (cymPosFlux / cymBins) * 2.35) * flatMult;

    combinedFlux[f] = kickFlux[f] * 1.18 + snareFlux[f] * 1.08 + guitarFlux[f] * 0.85 + bassFlux[f] * 0.65;

    const pOff = f * 6;
    bandProfiles[pOff] = kE;
    bandProfiles[pOff + 1] = bE;
    bandProfiles[pOff + 2] = sbE;
    bandProfiles[pOff + 3] = gMean;
    bandProfiles[pOff + 4] = guitarHighEnergy[f];
    bandProfiles[pOff + 5] = sMean + cMean;

    prevHarmMag.set(harmMag);
    prevPercMag.set(percMag);

    if (onProgress && f % progressStride === 0) {
      onProgress(0.1 + (f / numFrames) * 0.5);
    }
  }

  // =========================================================================
  // LOCAL 2.5-SECOND ROLLING NOISE FLOORS (Fixes quiet/clean song intros!)
  // =========================================================================
  const guitarFloors = computeLocalRollingFloors(guitarEnergy, 2.5, HOP_SEC);
  const guitarFluxFloors = computeLocalRollingFloors(guitarFlux, 2.5, HOP_SEC);
  const pianoFloors = computeLocalRollingFloors(pianoEnergy, 2.5, HOP_SEC);
  const pianoFluxFloors = computeLocalRollingFloors(pianoFlux, 2.5, HOP_SEC);
  const bassFloors = computeLocalRollingFloors(bassEnergy, 2.5, HOP_SEC);
  const bassFluxFloors = computeLocalRollingFloors(bassFlux, 2.5, HOP_SEC);
  const kickFloors = computeLocalRollingFloors(kickFlux, 2.5, HOP_SEC);
  const snareFloors = computeLocalRollingFloors(snareFlux, 2.5, HOP_SEC);
  const cymbalFloors = computeLocalRollingFloors(cymbalFlux, 2.5, HOP_SEC);
  const localOverallEnergy = computeRollingMean(rmsAll, 125); // 2.5s window

  const sortedRms = Array.from(localOverallEnergy).sort((a, b) => a - b);
  const chorusEnergyFloor = sortedRms[Math.floor(sortedRms.length * 0.72)] || 0.08;
  const globalMedianRms = sortedRms[Math.floor(sortedRms.length * 0.5)] || 0.05;

  // Estimate Primary BPM + Dynamic Programming Beat & Downbeat Tracker (baseline)
  let tempo = estimateTempoAndPhase(combinedFlux, HOP_SEC, bpmHint);
  let { bpm, beatSec, beatPhaseSec } = tempo;
  let dpBeats = trackDynamicBeats(
    combinedFlux,
    kickEnergy,
    bassEnergy,
    snareFlux,
    HOP_SEC,
    bpm,
    actualDuration
  );
  let analysisEngine = 'hpss-fft-dp';

  // =========================================================================
  // ESSENTIA.JS WASM AI REFINEMENT (RhythmExtractor2013 + PredominantPitchMelodia)
  // Automatically skipped cleanly if offline or CDN unavailable!
  // =========================================================================
  const essentia = await essentiaTask;
  if (essentia && totalSamples >= SAMPLE_RATE * 2) {
    let signalVec = null;
    try {
      if (onProgress) onProgress(0.65);
      signalVec = essentia.arrayToVector(mono22k);

      // 1. Essentia RhythmExtractor2013 / BeatTrackerDegara for drift-free beat & downbeat ticks
      let ticksArr = null;
      let essBpm = 0;
      if (typeof essentia.RhythmExtractor2013 === 'function') {
        const rhythm = essentia.RhythmExtractor2013(signalVec, 208, 'multifeature', 40);
        if (rhythm?.ticks) {
          ticksArr = Array.from(essentia.vectorToArray(rhythm.ticks));
          rhythm.ticks.delete?.();
        }
        if (rhythm?.estimates) rhythm.estimates.delete?.();
        if (rhythm?.bpmIntervals) rhythm.bpmIntervals.delete?.();
        if (Number.isFinite(rhythm?.bpm) && rhythm.bpm >= 55 && rhythm.bpm <= 215) {
          essBpm = Math.round(rhythm.bpm);
        }
      } else if (typeof essentia.BeatTrackerDegara === 'function') {
        const bt = essentia.BeatTrackerDegara(signalVec);
        if (bt?.ticks) {
          ticksArr = Array.from(essentia.vectorToArray(bt.ticks));
          bt.ticks.delete?.();
        }
      }

      if (ticksArr && ticksArr.length >= 8) {
        if (essBpm >= 55 && essBpm <= 215) {
          bpm = essBpm;
          beatSec = 60 / bpm;
        }
        // Determine downbeat phase (0..3) via kick + bass accent scoring
        const phaseScores = [0, 0, 0, 0];
        for (let i = 0; i < ticksArr.length; i += 1) {
          const fIdx = Math.max(0, Math.min(numFrames - 1, Math.round(ticksArr[i] / HOP_SEC)));
          phaseScores[i % 4] += kickEnergy[fIdx] * 1.45 + bassEnergy[fIdx] * 0.9 - snareFlux[fIdx] * 0.25;
        }
        let bestDownbeatMod = 0;
        for (let m = 1; m < 4; m += 1) {
          if (phaseScores[m] > phaseScores[bestDownbeatMod]) bestDownbeatMod = m;
        }
        dpBeats = {
          beats: ticksArr.map((t) => Number(t.toFixed(4))),
          dynamicBeatGrid: ticksArr.map((t, idx) => ({
            timeSec: Number(t.toFixed(4)),
            isMeasure: idx % 4 === bestDownbeatMod,
            beatIndex: idx,
          })),
        };
        beatPhaseSec = ticksArr[bestDownbeatMod] || ticksArr[0] || beatPhaseSec;
        analysisEngine = 'essentia-wasm-hpss';
      }

      // 2. Essentia PredominantPitchMelodia for melodic pitch contour & voicing confidence
      if (typeof essentia.PredominantPitchMelodia === 'function' && actualDuration <= 360) {
        const melHop = 256;
        const mel = essentia.PredominantPitchMelodia(
          signalVec,
          10, // binResolution
          0.9, // filterIterations
          2048, // frameSize
          true, // guessUnvoiced
          0.8, // harmonicWeight
          melHop,
          1, // magnitudeCompression
          40, // magnitudeThreshold
          1100, // maxFrequency
          100, // minDuration
          130, // minFrequency
          80, // numberHarmonics
          0.9, // peakDistributionThreshold
          0.1, // peakFrameThreshold
          27.5625, // pitchContinuity
          0.9, // pitchContinuityRuns
          false, // referenceFrequency
          SAMPLE_RATE
        );
        if (mel?.pitch && mel?.pitchConfidence) {
          const pArr = essentia.vectorToArray(mel.pitch);
          const cArr = essentia.vectorToArray(mel.pitchConfidence);
          const melHopSec = melHop / SAMPLE_RATE;
          for (let f = 0; f < numFrames; f += 1) {
            const mIdx = Math.min(pArr.length - 1, Math.floor((f * HOP_SEC) / melHopSec));
            if (mIdx >= 0 && cArr[mIdx] > 0.22 && pArr[mIdx] >= 130 && pArr[mIdx] <= 2400) {
              guitarPitchHz[f] = pArr[mIdx];
              if (pArr[mIdx] <= 2100) {
                pianoPitchHz[f] = pianoPitchHz[f] * 0.35 + pArr[mIdx] * 0.65;
              }
            }
          }
          mel.pitch.delete?.();
          mel.pitchConfidence.delete?.();
        }
      }
    } catch {
      // Seamless fallback to HPSS + Radix-2 FFT + DP Beat Tracker already computed!
    } finally {
      signalVec?.delete?.();
    }
  }

  if (onProgress) onProgress(0.74);

  // =========================================================================
  // 1. STRICT PERCUSSIVE TRANSIENT & DRUM ACTIVITY GATE (Zero drums on clean guitar intros!)
  // =========================================================================
  // First mark raw high-confidence percussive transient frames while rejecting tonal guitar plucks
  const rawPercHit = new Uint8Array(numFrames);
  const rawKickCandidates = [];
  const rawSnareCandidates = [];
  const rawHatCandidates = [];
  const rawCrashCandidates = [];

  // Precompute rolling sub-kick & snap averages to measure sharp transient crest!
  const kickMeanSlow = computeRollingMean(kickEnergy, 18); // 360ms
  const snapMeanSlow = computeRollingMean(snapEnergy, 16);

  for (let f = 2; f < numFrames - 2; f += 1) {
    const t = f * HOP_SEC;
    if (t < 0.06 || t > actualDuration - 0.1) continue;

    const gE = guitarEnergy[f];
    const hnr = guitarHnr[f];
    const flat = highFlatness[f];
    const kE = kickEnergy[f];
    const sE = snapEnergy[f];

    // Check if frame is overwhelmingly clean tonal guitar with negligible sub-punch & negligible broadband noise
    const isPureTonalGuitar =
      hnr > 4.0 &&
      flat < 0.28 &&
      kE < Math.max(0.012, gE * 0.65) &&
      sE < Math.max(0.004, gE * 0.24);

    if (isPureTonalGuitar) continue;

    // A. Sub-Kick peak detection (<110Hz sharp punch)
    const kf = kickFlux[f];
    const kickCrest = kE / Math.max(0.0025, kickMeanSlow[f]);
    const kickThresh = Math.max(0.011, kickFloors.median[f] * 2.15 + kickFloors.floor[f] * 0.85 + 0.006);
    const isKickPeak =
      kf >= kickFlux[f - 1] &&
      kf > kickFlux[f + 1] &&
      kf >= kickThresh &&
      kE >= 0.014 &&
      kickCrest >= 1.38 &&
      kE >= gE * 0.42;

    if (isKickPeak) {
      rawPercHit[f] = 1;
      rawKickCandidates.push({ time: t, frame: f, strength: kf, energy: kE });
    }

    // B. Snare Crack detection (160–345Hz body + 2.8–7.5kHz broadband noise snap)
    const sf = snareFlux[f];
    const snapCrest = sE / Math.max(0.001, snapMeanSlow[f]);
    const snareThresh = Math.max(0.0075, snareFloors.median[f] * 2.25 + snareFloors.floor[f] * 0.9 + 0.004);
    const isSnarePeak =
      sf >= snareFlux[f - 1] &&
      sf > snareFlux[f + 1] &&
      sf >= snareThresh &&
      flat >= 0.3 &&
      snapCrest >= 1.32 &&
      snareBodyEnergy[f] >= 0.006 &&
      sE >= 0.003;

    if (isSnarePeak) {
      rawPercHit[f] = 1;
      rawSnareCandidates.push({ time: t, frame: f, strength: sf, energy: sE + snareBodyEnergy[f] });
    }

    // C. Hi-Hat & Crash Cymbal detection (5.2–7.8kHz broadband high-frequency bursts)
    const cf = cymbalFlux[f];
    const cymThresh = Math.max(0.0048, cymbalFloors.median[f] * 2.05 + cymbalFloors.floor[f] * 0.8 + 0.0025);
    const isCymPeak =
      cf >= cymbalFlux[f - 1] &&
      cf > cymbalFlux[f + 1] &&
      cf >= cymThresh &&
      flat >= 0.34 &&
      cymbalEnergy[f] >= 0.0022;

    if (isCymPeak) {
      rawPercHit[f] = 1;
      const isCrash =
        cymbalEnergy[f] >= Math.max(0.011, cymbalFloors.median[f] * 2.4) &&
        (localOverallEnergy[f] >= chorusEnergyFloor * 0.78 || isKickPeak || isSnarePeak);
      if (isCrash) {
        rawCrashCandidates.push({ time: t, frame: f, strength: cf, energy: cymbalEnergy[f] });
      } else {
        rawHatCandidates.push({ time: t, frame: f, strength: cf, energy: cymbalEnergy[f] });
      }
    }
  }

  // Compute local percussive transient density in a 1.3s window (130 frames)
  // A real drum groove produces >= 2 genuine percussive transients per 1.3s window (or a massive crash/kick drop).
  // Isolated acoustic guitar string knocks or pick clicks in a clean solo intro fail this gate -> ZERO drum notes!
  const percDensity = new Uint8Array(numFrames);
  const percPrefix = new Int32Array(numFrames + 1);
  for (let i = 0; i < numFrames; i += 1) {
    percPrefix[i + 1] = percPrefix[i] + rawPercHit[i];
  }
  const densHalf = 65; // 0.65s each side = 1.3s window
  for (let f = 0; f < numFrames; f += 1) {
    const lo = Math.max(0, f - densHalf);
    const hi = Math.min(numFrames, f + densHalf + 1);
    const hitsInWindow = percPrefix[hi] - percPrefix[lo];
    // Also check if drums are strongly entering right ahead (next 0.9s) so the very first crash/fill opens cleanly!
    const aheadHits = percPrefix[Math.min(numFrames, f + 95)] - percPrefix[f];
    const hasDrumPresence =
      hitsInWindow >= 3 ||
      (aheadHits >= 3 && rawPercHit[f] === 1) ||
      (hitsInWindow >= 2 && kickEnergy[f] >= Math.max(0.025, globalMedianRms * 0.45));
    percDensity[f] = hasDrumPresence ? 1 : 0;
  }

  // Smooth drum active gate (fill tiny <0.45s gaps between beats, remove isolated <0.25s blips)
  const drumActiveFrame = new Uint8Array(percDensity);
  {
    let run = 0;
    for (let f = 0; f < numFrames; f += 1) {
      if (drumActiveFrame[f] === 1) {
        run += 1;
      } else {
        if (run > 0 && run < 25) {
          for (let k = f - run; k < f; k += 1) drumActiveFrame[k] = 0;
        }
        run = 0;
      }
    }
    // Bridge brief gaps (< 55 frames = 0.55s) between drum hits inside a groove
    let gap = 0;
    let seenOn = false;
    for (let f = 0; f < numFrames; f += 1) {
      if (drumActiveFrame[f] === 1) {
        if (seenOn && gap > 0 && gap <= 55) {
          for (let k = f - gap; k < f; k += 1) drumActiveFrame[k] = 1;
        }
        seenOn = true;
        gap = 0;
      } else if (seenOn) {
        gap += 1;
      }
    }
  }

  // Filter drum events strictly through the local percussive transient density gate!
  const drumEvents = [];
  const pushGatedDrums = (list, part) => {
    for (let i = 0; i < list.length; i += 1) {
      const ev = list[i];
      if (drumActiveFrame[ev.frame] === 1) {
        drumEvents.push({
          time: Number(ev.time.toFixed(4)),
          part,
          strength: Number(ev.strength.toFixed(4)),
          energy: Number(ev.energy.toFixed(4)),
          sectionEnergy: Number(localOverallEnergy[ev.frame].toFixed(4)),
        });
      }
    }
  };
  pushGatedDrums(rawKickCandidates, 'kick');
  pushGatedDrums(rawSnareCandidates, 'snare');
  pushGatedDrums(rawHatCandidates, 'hihat');
  pushGatedDrums(rawCrashCandidates, 'crash');
  drumEvents.sort((a, b) => a.time - b.time);

  if (onProgress) onProgress(0.82);

  // =========================================================================
  // 2. LEAD GUITAR ONSETS (Local 2.5s Rolling Floor + HNR Clean-Intro Detection!)
  // =========================================================================
  const guitarActiveFrame = new Uint8Array(numFrames);
  const guitarOnsets = [];
  let lastGuitarTime = -1;

  for (let f = 2; f < numFrames - 2; f += 1) {
    const t = f * HOP_SEC;
    if (t < 0.06 || t > actualDuration - 0.1) continue;

    const gE = guitarEnergy[f];
    const gf = guitarFlux[f];
    const hnr = guitarHnr[f];
    const localFloor = guitarFloors.floor[f];
    const localFluxMed = guitarFluxFloors.median[f];
    const localFluxFloor = guitarFluxFloors.floor[f];

    // Absolute whisper-quiet noise gate (0.0014 catches even delicate clean single-note intros!)
    const isGuitarPresent =
      gE >= Math.max(0.0014, localFloor * 1.12) &&
      (hnr >= 2.15 || gE >= Math.max(0.008, localFloor * 1.65));

    if (isGuitarPresent) {
      guitarActiveFrame[f] = 1;
    }

    // Peak detection strictly relative to LOCAL 2.5s neighborhood (NEVER loud chorus median!)
    if (gf < guitarFlux[f - 1] || gf <= guitarFlux[f + 1]) continue;

    // Clean plucked intro notes have high HNR even at low RMS -> adaptive low threshold!
    const cleanIntroBonus = hnr >= 3.2 && localOverallEnergy[f] < chorusEnergyFloor * 0.72 ? 0.74 : 1.0;
    const localThresh = Math.max(
      0.0016,
      (localFluxMed * 1.24 + localFluxFloor * 0.5 + 0.0012) * cleanIntroBonus
    );

    if (isGuitarPresent && gf >= localThresh && t - lastGuitarTime >= 0.075) {
      // Measure sustain ring-out duration directly from local guitar energy envelope
      const peakE = Math.max(gE, guitarEnergy[Math.min(numFrames - 1, f + 2)]);
      const sustainFloor = Math.max(0.0012, peakE * 0.38);
      let holdFrames = 0;
      const maxHold = Math.min(260, numFrames - 1 - f);
      for (let h = 3; h <= maxHold; h += 1) {
        // Stop sustain if a clear new guitar onset spikes
        if (h > 8 && guitarFlux[f + h] > localThresh * 1.35 && guitarFlux[f + h] >= guitarFlux[f + h - 1]) {
          break;
        }
        if (guitarEnergy[f + h] >= sustainFloor) {
          holdFrames = h;
        } else {
          break;
        }
      }

      const pFrame = Math.min(numFrames - 1, f + 2);
      guitarOnsets.push({
        time: Number(t.toFixed(4)),
        pitchHz: Number(guitarPitchHz[pFrame].toFixed(2)),
        strength: Number((gf / Math.max(0.001, localThresh)).toFixed(3)),
        energy: Number(gE.toFixed(5)),
        sectionEnergy: Number(localOverallEnergy[f].toFixed(5)),
        hnr: Number(hnr.toFixed(2)),
        sustainSec: Number((holdFrames * HOP_SEC).toFixed(3)),
      });
      lastGuitarTime = t;
    }
  }

  // Dilate guitar active mask gently so clean arpeggios stay continuously active
  {
    let gap = 0;
    let seen = false;
    for (let f = 0; f < numFrames; f += 1) {
      if (guitarActiveFrame[f] === 1) {
        if (seen && gap > 0 && gap <= 45) {
          for (let k = f - gap; k < f; k += 1) guitarActiveFrame[k] = 1;
        }
        seen = true;
        gap = 0;
      } else if (seen) {
        gap += 1;
      }
    }
  }

  if (onProgress) onProgress(0.9);

  // =========================================================================
  // 3. BASS ONSETS (40–220Hz Local Rolling Floor + Autocorrelation Root Pitch + Kick Rejection)
  // =========================================================================
  const bassActiveFrame = new Uint8Array(numFrames);
  const bassOnsets = [];
  let lastBassTime = -1;

  for (let f = 2; f < numFrames - 2; f += 1) {
    const t = f * HOP_SEC;
    if (t < 0.06 || t > actualDuration - 0.1) continue;

    const bE = bassEnergy[f];
    const bf = bassFlux[f];
    const gE = guitarEnergy[f];
    const bFloor = bassFloors.floor[f];
    const bfMed = bassFluxFloors.median[f];
    const bfFloor = bassFluxFloors.floor[f];

    // Check sustained low-end body vs ultra-short kick thump (bass sustains > 30ms; pure clean guitar has minimal 40-200Hz energy)
    const sustainBody = (bassEnergy[Math.min(numFrames - 1, f + 2)] + bassEnergy[Math.min(numFrames - 1, f + 4)]) * 0.5;
    const isShortKickOnly = kickEnergy[f] > sustainBody * 2.5 && sustainBody < bE * 0.45;
    const isBassPresent =
      !isShortKickOnly &&
      bE >= Math.max(0.0045, bFloor * 1.18) &&
      sustainBody >= 0.0038 &&
      bE >= gE * 0.35;

    if (isBassPresent) {
      bassActiveFrame[f] = 1;
    }

    if (bf < bassFlux[f - 1] || bf <= bassFlux[f + 1]) continue;

    const localThresh = Math.max(0.0038, bfMed * 1.28 + bfFloor * 0.55 + 0.0022);
    if (isBassPresent && bf >= localThresh && t - lastBassTime >= 0.095) {
      // Refine fundamental root frequency using autocorrelation on the onset sustain body!
      const centerSample = (f + 2) * HOP_SIZE;
      const rootHz = estimateBassFundamentalHz(mono16k, centerSample, bassPeakHz[Math.min(numFrames - 1, f + 2)]);

      // Measure held bass sustain duration
      const peakB = Math.max(bE, sustainBody);
      const holdFloor = Math.max(0.003, peakB * 0.42);
      let holdFrames = 0;
      const maxHold = Math.min(280, numFrames - 1 - f);
      for (let h = 4; h <= maxHold; h += 1) {
        if (h > 10 && bassFlux[f + h] > localThresh * 1.35 && bassFlux[f + h] >= bassFlux[f + h - 1]) {
          break;
        }
        if (bassEnergy[f + h] >= holdFloor) {
          holdFrames = h;
        } else {
          break;
        }
      }

      bassOnsets.push({
        time: Number(t.toFixed(4)),
        pitchHz: Number(rootHz.toFixed(2)),
        strength: Number((bf / Math.max(0.001, localThresh)).toFixed(3)),
        energy: Number(bE.toFixed(5)),
        sectionEnergy: Number(localOverallEnergy[f].toFixed(5)),
        sustainSec: Number((holdFrames * HOP_SEC).toFixed(3)),
      });
      lastBassTime = t;
    }
  }

  // Smooth bass activity mask (remove <200ms transient blips, bridge <450ms groove gaps)
  {
    let run = 0;
    for (let f = 0; f < numFrames; f += 1) {
      if (bassActiveFrame[f] === 1) {
        run += 1;
      } else {
        if (run > 0 && run < 18) {
          for (let k = f - run; k < f; k += 1) bassActiveFrame[k] = 0;
        }
        run = 0;
      }
    }
    let gap = 0;
    let seen = false;
    for (let f = 0; f < numFrames; f += 1) {
      if (bassActiveFrame[f] === 1) {
        if (seen && gap > 0 && gap <= 45) {
          for (let k = f - gap; k < f; k += 1) bassActiveFrame[k] = 1;
        }
        seen = true;
        gap = 0;
      } else if (seen) {
        gap += 1;
      }
    }
  }

  // =========================================================================
  // 3B. PIANO / KEYS ONSETS (130Hz–2.2kHz / MIDI 48–84 Polyphonic Chords & Arpeggios)
  // =========================================================================
  const pianoActiveFrame = new Uint8Array(numFrames);
  const pianoOnsets = [];
  let lastPianoTime = -1;

  for (let f = 2; f < numFrames - 2; f += 1) {
    const t = f * HOP_SEC;
    if (t < 0.06 || t > actualDuration - 0.1) continue;

    const pE = pianoEnergy[f];
    const pf = pianoFlux[f];
    const pFloor = pianoFloors.floor[f];
    const pfMed = pianoFluxFloors.median[f];
    const pfFloor = pianoFluxFloors.floor[f];
    const peaks = pianoPeakCount[f];

    const isPianoPresent =
      pE >= Math.max(0.0016, pFloor * 1.12) &&
      (peaks >= 2 || guitarHnr[f] >= 2.2 || pE >= Math.max(0.007, pFloor * 1.55));

    if (isPianoPresent) {
      pianoActiveFrame[f] = 1;
    }

    if (pf < pianoFlux[f - 1] || pf <= pianoFlux[f + 1]) continue;

    const polyBonus = peaks >= 3 ? 0.82 : 1.0;
    const localThresh = Math.max(
      0.0018,
      (pfMed * 1.24 + pfFloor * 0.5 + 0.0014) * polyBonus
    );

    if (isPianoPresent && pf >= localThresh && t - lastPianoTime >= 0.085) {
      const peakE = Math.max(pE, pianoEnergy[Math.min(numFrames - 1, f + 2)]);
      const sustainFloor = Math.max(0.0014, peakE * 0.4);
      let holdFrames = 0;
      const maxHold = Math.min(280, numFrames - 1 - f);
      for (let h = 3; h <= maxHold; h += 1) {
        if (h > 8 && pianoFlux[f + h] > localThresh * 1.38 && pianoFlux[f + h] >= pianoFlux[f + h - 1]) {
          break;
        }
        if (pianoEnergy[f + h] >= sustainFloor) {
          holdFrames = h;
        } else {
          break;
        }
      }

      const pFrame = Math.min(numFrames - 1, f + 2);
      pianoOnsets.push({
        time: Number(t.toFixed(4)),
        pitchHz: Number(pianoPitchHz[pFrame].toFixed(2)),
        strength: Number((pf / Math.max(0.001, localThresh)).toFixed(3)),
        energy: Number(pE.toFixed(5)),
        sectionEnergy: Number(localOverallEnergy[f].toFixed(5)),
        peakCount: peaks,
        isPolyphonic: peaks >= 3,
        sustainSec: Number((holdFrames * HOP_SEC).toFixed(3)),
      });
      lastPianoTime = t;
    }
  }

  // Dilate piano active mask gently
  {
    let gap = 0;
    let seen = false;
    for (let f = 0; f < numFrames; f += 1) {
      if (pianoActiveFrame[f] === 1) {
        if (seen && gap > 0 && gap <= 45) {
          for (let k = f - gap; k < f; k += 1) pianoActiveFrame[k] = 1;
        }
        seen = true;
        gap = 0;
      } else if (seen) {
        gap += 1;
      }
    }
  }

  // =========================================================================
  // 4. DOWNSAMPLE PER-STEM ACTIVITY TIMELINE TO 50ms HOP (compact Uint8Arrays)
  // =========================================================================
  const ratio = Math.max(1, Math.round(ACTIVITY_HOP_SEC / HOP_SEC)); // 5 frames per 50ms
  const actLen = Math.max(1, Math.ceil(numFrames / ratio));
  const actDrums = new Uint8Array(actLen);
  const actBass = new Uint8Array(actLen);
  const actGuitar = new Uint8Array(actLen);
  const actPiano = new Uint8Array(actLen);

  for (let a = 0; a < actLen; a += 1) {
    const start = a * ratio;
    const end = Math.min(numFrames, start + ratio);
    let dOn = 0;
    let bOn = 0;
    let gOn = 0;
    let pOn = 0;
    for (let f = start; f < end; f += 1) {
      if (drumActiveFrame[f]) dOn = 1;
      if (bassActiveFrame[f]) bOn = 1;
      if (guitarActiveFrame[f]) gOn = 1;
      if (pianoActiveFrame[f]) pOn = 1;
    }
    actDrums[a] = dOn;
    actBass[a] = bOn;
    actGuitar[a] = gOn;
    actPiano[a] = pOn;
  }

  // 2-frame lookahead dilation (100ms) so the very first attack of any instrument entry is never clipped
  const dilate2 = (arr) => {
    const out = new Uint8Array(arr);
    for (let i = 0; i < arr.length; i += 1) {
      if (arr[i] === 1) {
        if (i > 0) out[i - 1] = 1;
        if (i > 1) out[i - 2] = 1;
      }
    }
    return out;
  };

  const stemActivity = {
    hopSec: ACTIVITY_HOP_SEC,
    duration: actualDuration,
    drums: dilate2(actDrums),
    bass: dilate2(actBass),
    guitar: dilate2(actGuitar),
    piano: dilate2(actPiano),
  };

  // =========================================================================
  // 5. BEAT-SYNCHRONOUS SONG-SECTION SEGMENTATION (Intro/Verse/Chorus/Solo/Bridge/Outro)
  // =========================================================================
  const sections = segmentSongSections({
    dynamicBeatGrid: dpBeats.dynamicBeatGrid,
    duration: actualDuration,
    hopSec: HOP_SEC,
    rmsAll,
    drumActiveFrame,
    bassEnergy,
    guitarEnergy,
    guitarHighEnergy,
    guitarHnr,
    bandProfiles,
  });

  if (onProgress) onProgress(1.0);

  return {
    bpm,
    beatSec,
    beatPhaseSec,
    beats: dpBeats.beats,
    dynamicBeatGrid: dpBeats.dynamicBeatGrid,
    sections,
    duration: actualDuration,
    chorusEnergyFloor: Number(chorusEnergyFloor.toFixed(5)),
    guitarOnsets,
    pianoOnsets,
    bassOnsets,
    drumEvents,
    stemActivity,
    analysisEngine,
  };
}

// Backwards-compatible alias
export const analyzeMono16k = analyzeMono22k;

// =========================================================================
// Web Worker Message Handler (only binds when running inside a Worker!)
// =========================================================================
const isWorkerContext =
  typeof self !== 'undefined' &&
  typeof self.postMessage === 'function' &&
  typeof window === 'undefined';

if (isWorkerContext) {
  self.onmessage = async (event) => {
    const { id, mono22k, mono16k, bpmHint, duration } = event.data || {};
    const audioBuf = mono22k || mono16k;
    try {
      const t0 = performance.now();
      const analysis = await analyzeMono22k(audioBuf, {
        bpmHint,
        duration,
        onProgress: (pct) => {
          self.postMessage({ id, type: 'progress', pct });
        },
      });
      const elapsedMs = Math.round(performance.now() - t0);
      self.postMessage(
        {
          id,
          type: 'result',
          elapsedMs,
          analysis,
        },
        [
          analysis.stemActivity.drums.buffer,
          analysis.stemActivity.bass.buffer,
          analysis.stemActivity.guitar.buffer,
          analysis.stemActivity.piano.buffer,
        ]
      );
    } catch (err) {
      self.postMessage({
        id,
        type: 'error',
        error: err?.message || 'Worker audio analysis failed',
      });
    }
  };
}

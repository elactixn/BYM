/**
 * audioWorker.js
 * Offline 5-Stage MIR & 4-Stem Audio-Transcription Engine (192 PPQ).
 * 100% client-side pure JavaScript — ZERO external WASM, API keys, or cloud calls.
 *
 * Pipeline Architecture:
 *  - Stage 1: Stereo 22.05kHz Decimation, 2048-pt Hann STFT (hop = 128 samples -> 5.80ms native resolution),
 *             6 Log-Spaced Psychoacoustic Sub-Bands (30–110Hz, 110–250Hz, 250–900Hz, 900–3200Hz,
 *             3200–6500Hz, 6500–11025Hz), SuperFlux vibrato-immune max-filtering + Complex-Domain Phase
 *             Deviation + exact First-Onset Sample Anchoring (-38 dBFS).
 *  - Stage 2: Stereo Mid/Side + 21-frame Temporal × 17-bin Frequency 2D Median HPSS soft-masking,
 *             OLA iSTFT reconstruction of isolated 22.05kHz stems (drums, bass, guitar, piano), and
 *             strict -38 dBFS / 18% peak RMS + spectral dominance anti-bleed gates.
 *  - Stage 3: 8-second Sliding-Window Resonator Comb-Filter Tempogram (65.000–195.000 BPM at 0.025 BPM
 *             effective resolution) + Viterbi DP Beat Tracker + 4-Bar Kick/Snare Phase Histogram Voting.
 *  - Stage 4: Downbeat-Locked Tick 0 [SyncTrack] & 1/4-Beat / 1/1-Measure Grid Generation.
 *  - Stage 5: Strict 192 PPQ Quantization (1/4=192, 1/8=96, 1/8t=64, 1/16=48) integrating [SyncTrack]
 *             exclusively for exact tick-to-seconds timing, Clone Hero 5-lane contour, [0,2]/[1,3] Power Chords,
 *             1/16 HOPO runs (<= 48 ticks), and > 240-tick Sustain Tails.
 */

export const SCHEMA_VERSION = 'v16_multiAnchor192';

const AGC_NOISE_FLOOR = 1e-4;
const ACTIVE_RMS_FLOOR_NEG42DB = 0.007943; // 10^(-42/20)
const STRICT_STEM_GATE_RMS_FLOOR = 0.012589; // 10^(-38/20) = -38 dBFS strict gate
const DEFAULT_SAMPLE_RATE = 22050;
const FFT_SIZE = 2048;
const HALF_FFT = FFT_SIZE >> 1; // 1024 bins
const HOP_SIZE = 128; // 5.805ms @ 22.05kHz (16x overlap)
const ACTIVITY_HOP_SEC = 0.05;
const RESOLUTION_PPQ = 192;
const HOPO_MAX_TICKS = 48;
const MIN_SUSTAIN_TICKS = 240;

const HPSS_TIME_WIN = 21; // ~122ms temporal median window
const HPSS_TIME_HALF = 10;
const HPSS_FREQ_WIN = 17; // ~183Hz spectral median window
const HPSS_FREQ_HALF = 8;
const PI2 = Math.PI * 2;

// Precomputed Periodic Hann Window
const HANN = new Float32Array(FFT_SIZE);
for (let i = 0; i < FFT_SIZE; i += 1) {
  HANN[i] = 0.5 * (1 - Math.cos((PI2 * i) / FFT_SIZE));
}

// Constant Overlap-Add normalization sum for HANN^2 with HOP_SIZE = 128 (16x overlap => 6.0 steady state)
const COLA_NORM_STEADY = (() => {
  let sum = 0;
  for (let m = 0; m < FFT_SIZE; m += HOP_SIZE) {
    const w = HANN[m];
    sum += w * w;
  }
  return sum || 6.0;
})();

// Precomputed Bit-Reversal Permutation Table for FFT_SIZE = 2048
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

// Precomputed Radix-2 Twiddle Tables
const TWIDDLE_COS = new Float32Array(HALF_FFT);
const TWIDDLE_SIN = new Float32Array(HALF_FFT);
for (let k = 0; k < HALF_FFT; k += 1) {
  const ang = (-PI2 * k) / FFT_SIZE;
  TWIDDLE_COS[k] = Math.cos(ang);
  TWIDDLE_SIN[k] = Math.sin(ang);
}

// Zero-Allocation Pre-Buffered STFT, OLA iSTFT & 2D HPSS Scratch Arrays
const fftRe = new Float32Array(FFT_SIZE);
const fftIm = new Float32Array(FFT_SIZE);
const ifftReA = new Float32Array(FFT_SIZE);
const ifftImA = new Float32Array(FFT_SIZE);
const ifftReB = new Float32Array(FFT_SIZE);
const ifftImB = new Float32Array(FFT_SIZE);

const midReBuf = new Float32Array(HALF_FFT);
const midImBuf = new Float32Array(HALF_FFT);
const sideReBuf = new Float32Array(HALF_FFT);
const sideImBuf = new Float32Array(HALF_FFT);

const prevHarmMag = new Float32Array(HALF_FFT);
const prevPercMag = new Float32Array(HALF_FFT);
const prevMidMag = new Float32Array(HALF_FFT);
const prevPhase = new Float32Array(HALF_FFT);
const prevPhase2 = new Float32Array(HALF_FFT);
const harmMag = new Float32Array(HALF_FFT);
const percMag = new Float32Array(HALF_FFT);
const guitarCombWeights = new Float32Array(HALF_FFT);
const pianoTransientBuf = new Float32Array(HALF_FFT);

const binToChroma = new Int8Array(HALF_FFT);
let binToChromaRate = 0;

// 21-frame circular HPSS magnitude + phase rings (zero per-frame allocations)
const hpssRing = Array.from({ length: HPSS_TIME_WIN }, () => new Float32Array(HALF_FFT));
const hpssSideRing = Array.from({ length: HPSS_TIME_WIN }, () => new Float32Array(HALF_FFT));
const hpssPhaseRing = Array.from({ length: HPSS_TIME_WIN }, () => new Float32Array(HALF_FFT));
const medTimeScratch = new Float32Array(HPSS_TIME_WIN);
const medFreqScratch = new Float32Array(HPSS_FREQ_WIN);
const floorSortScratch = new Float32Array(64);
const chromaPeakScratch = new Float32Array(12);

// Coarse-to-fine comb-filter scratch (65.000–195.000 BPM @ 0.25 coarse -> 0.025 fine)
const COARSE_BPM_COUNT = Math.round((195 - 65) / 0.25) + 1; // 521
const coarseCombScores = new Float32Array(COARSE_BPM_COUNT);

function ensureBinToChromaLut(sampleRate) {
  if (binToChromaRate === sampleRate) return;
  binToChromaRate = sampleRate;
  const binHz = sampleRate / FFT_SIZE;
  binToChroma.fill(-1);
  for (let k = 1; k < HALF_FFT; k += 1) {
    const hz = k * binHz;
    if (hz < 65 || hz > 3200) continue;
    const midi = Math.round(69 + 12 * Math.log2(hz / 440));
    binToChroma[k] = ((midi % 12) + 12) % 12;
  }
}

// Growable Single-Pass 22.05kHz Stereo Decimation & Per-Song Descriptor Pool
let decimStereoCap = 0;
let decimLeftBuf = null;
let decimRightBuf = null;
let decimMonoBuf = null;

let maskStoreCap = 0;
let maskPercStore = null;

let workerPoolCap = 0;
let workerPool = null;

function ensureDecimStereoBufs(len) {
  if (len <= decimStereoCap && decimLeftBuf && decimRightBuf && decimMonoBuf) {
    return {
      left: decimLeftBuf.subarray(0, len),
      right: decimRightBuf.subarray(0, len),
      mono: decimMonoBuf.subarray(0, len),
    };
  }
  decimStereoCap = Math.max(len, 1 << 20);
  decimLeftBuf = new Float32Array(decimStereoCap);
  decimRightBuf = new Float32Array(decimStereoCap);
  decimMonoBuf = new Float32Array(decimStereoCap);
  return {
    left: decimLeftBuf.subarray(0, len),
    right: decimRightBuf.subarray(0, len),
    mono: decimMonoBuf.subarray(0, len),
  };
}

function ensureMaskStore(numFrames) {
  const needed = numFrames * HALF_FFT;
  if (needed <= maskStoreCap && maskPercStore) {
    return maskPercStore.subarray(0, needed);
  }
  maskStoreCap = needed;
  maskPercStore = new Uint8Array(maskStoreCap);
  return maskPercStore.subarray(0, needed);
}

/**
 * Single-pass typed-array stereo decimation from 44.1kHz/48kHz down to 22.05kHz
 * preserving both Left and Right channels + Mono folddown in reusable Float32Arrays.
 */
export function decimateTo22050Stereo(ch0, ch1 = null, srcRate = 44100) {
  const len = ch0?.length || 0;
  if (!len) {
    const bufs = ensureDecimStereoBufs(2048);
    bufs.left.fill(0);
    bufs.right.fill(0);
    bufs.mono.fill(0);
    return { ...bufs, sampleRate: DEFAULT_SAMPLE_RATE };
  }
  const safeRate = Number(srcRate) || 44100;
  const rightSrc = ch1 || ch0;

  if (Math.abs(safeRate - DEFAULT_SAMPLE_RATE) <= 400) {
    const bufs = ensureDecimStereoBufs(len);
    bufs.left.set(ch0);
    bufs.right.set(rightSrc);
    for (let i = 0; i < len; i += 1) {
      bufs.mono[i] = (bufs.left[i] + bufs.right[i]) * 0.5;
    }
    return { ...bufs, sampleRate: DEFAULT_SAMPLE_RATE };
  }

  const ratio = safeRate / DEFAULT_SAMPLE_RATE;
  const outLen = Math.max(2048, Math.floor(len / ratio));
  const bufs = ensureDecimStereoBufs(outLen);
  const { left, right, mono } = bufs;

  if (Math.abs(ratio - 2.0) < 0.02) {
    const pairs = Math.min(outLen, len >> 1);
    for (let i = 0; i < pairs; i += 1) {
      const j = i << 1;
      const l = (ch0[j] + ch0[j + 1]) * 0.5;
      const r = (rightSrc[j] + rightSrc[j + 1]) * 0.5;
      left[i] = l;
      right[i] = r;
      mono[i] = (l + r) * 0.5;
    }
    for (let i = pairs; i < outLen; i += 1) {
      left[i] = 0;
      right[i] = 0;
      mono[i] = 0;
    }
    return { ...bufs, sampleRate: DEFAULT_SAMPLE_RATE };
  }

  const winHalf = Math.max(1, Math.floor(ratio * 0.5));
  for (let i = 0; i < outLen; i += 1) {
    const center = Math.floor(i * ratio);
    const lo = center > winHalf ? center - winHalf : 0;
    const hi = center + winHalf < len ? center + winHalf : len - 1;
    const count = hi - lo + 1;
    let sumL = 0;
    let sumR = 0;
    for (let j = lo; j <= hi; j += 1) {
      sumL += ch0[j];
      sumR += rightSrc[j];
    }
    const l = sumL / count;
    const r = sumR / count;
    left[i] = l;
    right[i] = r;
    mono[i] = (l + r) * 0.5;
  }
  return { ...bufs, sampleRate: DEFAULT_SAMPLE_RATE };
}

export function decimateTo22050Mono(ch0, ch1 = null, srcRate = 44100) {
  const { mono, sampleRate } = decimateTo22050Stereo(ch0, ch1, srcRate);
  return { mono, sampleRate };
}

function ensureWorkerPool(numFrames) {
  const cap = Math.max(numFrames + 16, 49152);
  if (!workerPool || cap > workerPoolCap) {
    workerPoolCap = cap;
    const makeFloorSlot = () => ({
      floor: new Float32Array(cap),
      median: new Float32Array(cap),
    });
    workerPool = {
      rmsAll: new Float32Array(cap),
      framePeakAbs: new Float32Array(cap),
      percMeanPower: new Float32Array(cap),
      harmMeanPower: new Float32Array(cap),
      subBassMeanPower: new Float32Array(cap),
      midVocalMeanPower: new Float32Array(cap),
      sideGuitarSq: new Float32Array(cap),
      midGuitarCenterSq: new Float32Array(cap),
      guitarOvertoneRatio: new Float32Array(cap),
      guitarAttackRatio: new Float32Array(cap),
      pianoAttackRatio: new Float32Array(cap),
      stemDrumsSq: new Float32Array(cap),
      stemBassSq: new Float32Array(cap),
      stemGuitarSq: new Float32Array(cap),
      stemPianoSq: new Float32Array(cap),
      stemDrumsRms150: new Float32Array(cap),
      stemBassRms150: new Float32Array(cap),
      stemGuitarRms150: new Float32Array(cap),
      stemPianoRms150: new Float32Array(cap),
      kickEnergy: new Float32Array(cap),
      bassEnergy: new Float32Array(cap),
      snareBodyEnergy: new Float32Array(cap),
      tomEnergy: new Float32Array(cap),
      guitarEnergy: new Float32Array(cap),
      guitarHighEnergy: new Float32Array(cap),
      pianoEnergy: new Float32Array(cap),
      snapEnergy: new Float32Array(cap),
      cymbalEnergy: new Float32Array(cap),
      bandProfiles: new Float32Array(cap * 6),
      subBandSuperFlux: new Float32Array(cap * 6),
      kickFlux: new Float32Array(cap),
      bassFlux: new Float32Array(cap),
      bassRootChange: new Float32Array(cap),
      snareFlux: new Float32Array(cap),
      tomFlux: new Float32Array(cap),
      cymbalFlux: new Float32Array(cap),
      guitarFlux: new Float32Array(cap),
      guitarPluckFlux: new Float32Array(cap),
      pianoFlux: new Float32Array(cap),
      phaseDevFlux: new Float32Array(cap),
      complexDomainFlux: new Float32Array(cap),
      stemLockedFlux: new Float32Array(cap),
      chromaFrames: new Float32Array(cap * 12),
      guitarHnr: new Float32Array(cap),
      highFlatness: new Float32Array(cap),
      guitarPitchHz: new Float32Array(cap),
      pianoPitchHz: new Float32Array(cap),
      pianoPeakCount: new Uint8Array(cap),
      pianoChords: new Uint8Array(cap * 3),
      bassPeakHz: new Float32Array(cap),
      prefixF64: new Float64Array(cap + 2),
      rollingMeanOut: new Float32Array(cap),
      centered: new Float32Array(cap),
      blockAvg: new Float32Array(cap),
      blockFloor: new Float32Array(cap),
      blockMedian: new Float32Array(cap),
      rawStrength: new Float32Array(cap),
      beatEnv: new Float32Array(cap),
      smoothEnv: new Float32Array(cap),
      localBpmPerBlock: new Float32Array(cap),
      localPeriodPerBlock: new Float32Array(cap),
      dpScore: new Float32Array(cap),
      dpBack: new Int32Array(cap),
      kickMeanSlow: new Float32Array(cap),
      snapMeanSlow: new Float32Array(cap),
      tomMeanSlow: new Float32Array(cap),
      localOverallEnergy: new Float32Array(cap),
      sortedRms: new Float32Array(cap),
      rawPercHit: new Uint8Array(cap),
      percDensity: new Uint8Array(cap),
      percPrefix: new Int32Array(cap + 2),
      drumActiveFrame: new Uint8Array(cap),
      guitarActiveFrame: new Uint8Array(cap),
      bassActiveFrame: new Uint8Array(cap),
      pianoActiveFrame: new Uint8Array(cap),
      localRmsPeak: new Float32Array(cap),
      localRmsMean: new Float32Array(cap),
      agcPeakDeque: new Int32Array(cap),
      guitarNormFlux: new Float32Array(cap),
      bassNormFlux: new Float32Array(cap),
      pianoNormFlux: new Float32Array(cap),
      kickNormFlux: new Float32Array(cap),
      snareNormFlux: new Float32Array(cap),
      tomNormFlux: new Float32Array(cap),
      cymbalNormFlux: new Float32Array(cap),
      floors: Array.from({ length: 14 }, makeFloorSlot),
    };
  }
  return workerPool;
}

// Fast Quickselect for odd window medians (17 or 21 elements) — zero allocations
function quickSelectMedian(arr, len, kTarget) {
  let left = 0;
  let right = len - 1;
  while (left < right) {
    const mid = (left + right) >> 1;
    const pivot = arr[mid];
    arr[mid] = arr[right];
    arr[right] = pivot;
    let store = left;
    for (let i = left; i < right; i += 1) {
      if (arr[i] < pivot) {
        const tmp = arr[store];
        arr[store] = arr[i];
        arr[i] = tmp;
        store += 1;
      }
    }
    arr[right] = arr[store];
    arr[store] = pivot;
    if (store === kTarget) return arr[kTarget];
    if (store < kTarget) left = store + 1;
    else right = store - 1;
  }
  return arr[kTarget];
}

function sortSliceInPlace(buf, len) {
  for (let i = 1; i < len; i += 1) {
    const key = buf[i];
    let j = i - 1;
    while (j >= 0 && buf[j] > key) {
      buf[j + 1] = buf[j];
      j -= 1;
    }
    buf[j + 1] = key;
  }
}

function runFastRadix2Fft(re, im) {
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

function computeRollingMean(arr, halfWin, outTarget = null) {
  const n = arr.length;
  const p = ensureWorkerPool(n);
  const prefix = p.prefixF64;
  prefix[0] = 0;
  for (let i = 0; i < n; i += 1) {
    prefix[i + 1] = prefix[i] + arr[i];
  }
  const out = outTarget || p.rollingMeanOut.subarray(0, n);
  for (let i = 0; i < n; i += 1) {
    const lo = Math.max(0, i - halfWin);
    const hi = Math.min(n, i + halfWin + 1);
    out[i] = (prefix[hi] - prefix[lo]) / Math.max(1, hi - lo);
  }
  return out;
}

function computeSlidingRmsPeakAndMean(rmsAll, windowSec = 1.5, hopSec = HOP_SIZE / DEFAULT_SAMPLE_RATE) {
  const n = rmsAll.length;
  const p = ensureWorkerPool(n);
  const halfWin = Math.max(4, Math.round((windowSec * 0.5) / hopSec));
  const localPeak = p.localRmsPeak.subarray(0, n);
  const localMean = computeRollingMean(rmsAll, halfWin, p.localRmsMean.subarray(0, n));
  const deque = p.agcPeakDeque;

  let head = 0;
  let tail = 0;
  for (let i = 0; i < Math.min(n, halfWin); i += 1) {
    const val = rmsAll[i];
    while (tail > head && rmsAll[deque[tail - 1]] <= val) tail -= 1;
    deque[tail++] = i;
  }

  for (let i = 0; i < n; i += 1) {
    const right = i + halfWin;
    if (right < n) {
      const val = rmsAll[right];
      while (tail > head && rmsAll[deque[tail - 1]] <= val) tail -= 1;
      deque[tail++] = right;
    }
    const leftBound = i - halfWin;
    while (head < tail && deque[head] < leftBound) head += 1;
    localPeak[i] = head < tail ? rmsAll[deque[head]] : rmsAll[i];
  }

  return { localPeak, localMean };
}

function computeLocalRollingFloors(arr, windowSec = 1.5, hopSec = HOP_SIZE / DEFAULT_SAMPLE_RATE, slotIdx = 0) {
  const n = arr.length;
  const p = ensureWorkerPool(n);
  const blockFrames = Math.max(1, Math.round(0.25 / hopSec));
  const numBlocks = Math.max(1, Math.ceil(n / blockFrames));
  const blockAvg = p.blockAvg;

  for (let b = 0; b < numBlocks; b += 1) {
    const start = b * blockFrames;
    const end = Math.min(n, start + blockFrames);
    let sum = 0;
    for (let i = start; i < end; i += 1) sum += arr[i];
    blockAvg[b] = sum / Math.max(1, end - start);
  }

  const halfWinBlocks = Math.min(24, Math.max(2, Math.round((windowSec * 0.5) / 0.25)));
  const blockFloor = p.blockFloor;
  const blockMedian = p.blockMedian;

  for (let b = 0; b < numBlocks; b += 1) {
    const lo = Math.max(0, b - halfWinBlocks);
    const hi = Math.min(numBlocks - 1, b + halfWinBlocks);
    let sLen = 0;
    for (let k = lo; k <= hi && sLen < floorSortScratch.length; k += 1) {
      floorSortScratch[sLen++] = blockAvg[k];
    }
    sortSliceInPlace(floorSortScratch, sLen);
    blockFloor[b] = floorSortScratch[Math.floor(sLen * 0.25)];
    blockMedian[b] = floorSortScratch[Math.floor(sLen * 0.5)];
  }

  const slot = p.floors[slotIdx] || p.floors[0];
  const floorOut = slot.floor.subarray(0, n);
  const medianOut = slot.median.subarray(0, n);
  for (let i = 0; i < n; i += 1) {
    const b = Math.min(numBlocks - 1, Math.floor(i / blockFrames));
    floorOut[i] = blockFloor[b];
    medianOut[i] = blockMedian[b];
  }
  return { floor: floorOut, median: medianOut };
}

/**
 * Evaluates a fractional-lag Harmonic Comb-Filter Resonator score over signal[lo..hi)
 * combining 1x, 2x, 3x, and 4x beat harmonics with linear interpolation!
 */
function evalCombResonatorScore(signal, lo, hi, periodFrames) {
  const span = hi - lo;
  if (span < periodFrames * 2.2) return 0;

  const stride = span > 2000 ? 3 : span > 900 ? 2 : 1;
  let num1 = 0;
  let sqA = 0;
  let sqB = 0;
  const max1 = hi - Math.ceil(periodFrames) - 1;
  for (let i = lo; i < max1; i += stride) {
    const pos = i + periodFrames;
    const i0 = pos | 0;
    const frac = pos - i0;
    const b = signal[i0] * (1 - frac) + signal[i0 + 1] * frac;
    const a = signal[i];
    num1 += a * b;
    sqA += a * a;
    sqB += b * b;
  }
  const c1 = num1 / Math.sqrt(Math.max(1e-10, sqA * sqB));

  let c2 = 0;
  const p2 = periodFrames * 2;
  if (span > p2 + 24) {
    let n2 = 0;
    let cnt2 = 0;
    const max2 = hi - Math.ceil(p2) - 1;
    for (let i = lo; i < max2; i += stride * 2) {
      const pos = i + p2;
      const i0 = pos | 0;
      const frac = pos - i0;
      const b = signal[i0] * (1 - frac) + signal[i0 + 1] * frac;
      n2 += signal[i] * b;
      cnt2 += 1;
    }
    const normDen = Math.max(1e-8, (sqA / Math.max(1, max1 - lo)) * (max2 - lo));
    c2 = cnt2 > 0 ? Math.min(1, n2 / Math.max(1e-6, cnt2 * (sqA / Math.max(1, (max1 - lo) / stride)))) : 0;
    void normDen;
  }

  let c3 = 0;
  const p3 = periodFrames * 3;
  if (span > p3 + 24) {
    let n3 = 0;
    let cnt3 = 0;
    const max3 = hi - Math.ceil(p3) - 1;
    const meanSq = sqA / Math.max(1, (max1 - lo) / stride);
    for (let i = lo; i < max3; i += stride * 3) {
      const pos = i + p3;
      const i0 = pos | 0;
      const frac = pos - i0;
      const b = signal[i0] * (1 - frac) + signal[i0 + 1] * frac;
      n3 += signal[i] * b;
      cnt3 += 1;
    }
    c3 = cnt3 > 0 ? Math.min(1, n3 / Math.max(1e-6, cnt3 * meanSq)) : 0;
  }

  let c4 = 0;
  const p4 = periodFrames * 4;
  if (span > p4 + 24) {
    let n4 = 0;
    let cnt4 = 0;
    const max4 = hi - Math.ceil(p4) - 1;
    const meanSq = sqA / Math.max(1, (max1 - lo) / stride);
    for (let i = lo; i < max4; i += stride * 4) {
      const pos = i + p4;
      const i0 = pos | 0;
      const frac = pos - i0;
      const b = signal[i0] * (1 - frac) + signal[i0 + 1] * frac;
      n4 += signal[i] * b;
      cnt4 += 1;
    }
    c4 = cnt4 > 0 ? Math.min(1, n4 / Math.max(1e-6, cnt4 * meanSq)) : 0;
  }

  return c1 * 0.56 + c2 * 0.26 + c3 * 0.11 + c4 * 0.07;
}

/**
 * Coarse-to-Fine Resonator Comb-Filter Tempogram (65.000–195.000 BPM @ 0.025 BPM effective resolution)
 * driven by stem-locked onset strength.
 */
function solveCombFilterBpm(
  signal,
  lo,
  hi,
  hopSec,
  { minBpm = 65, maxBpm = 195, priorBpm = null, priorSigma = 18, contBpm = null } = {}
) {
  const coarseStep = 0.25;
  const fineStep = 0.025;
  const numCoarse = Math.min(COARSE_BPM_COUNT, Math.floor((maxBpm - minBpm) / coarseStep) + 1);

  let bestCoarseIdx = 0;
  let bestScore = -1e9;
  const topCandidates = [];

  for (let idx = 0; idx < numCoarse; idx += 1) {
    const bpm = minBpm + idx * coarseStep;
    const periodFrames = 60 / (bpm * hopSec);
    const rawComb = evalCombResonatorScore(signal, lo, hi, periodFrames);

    // Perceptual tempo prior centered ~120 BPM favoring practical rhythm-game groove zone (85–158 BPM)
    const popPrior = Math.exp(-0.5 * Math.pow((bpm - 120) / 38, 2));
    const coreWeight = bpm >= 84 && bpm <= 162 ? 1.14 : 0.9;
    let w = rawComb * coreWeight * (0.76 + 0.24 * popPrior);

    if (priorBpm) {
      const pPen = Math.exp(-0.5 * Math.pow((bpm - priorBpm) / priorSigma, 2));
      w *= 0.65 + 0.35 * pPen;
    }
    if (contBpm) {
      const cPen = Math.exp(-0.5 * Math.pow((bpm - contBpm) / Math.max(4, contBpm * 0.06), 2));
      w *= 0.8 + 0.2 * cPen;
    }

    coarseCombScores[idx] = w;
    if (w > bestScore) {
      bestScore = w;
      bestCoarseIdx = idx;
    }
  }

  // Gather local coarse peaks + octave partners (0.5x / 2x) for 0.025 BPM fine comb refinement
  topCandidates.push(minBpm + bestCoarseIdx * coarseStep);
  const bestBpmCoarse = topCandidates[0];
  if (bestBpmCoarse * 0.5 >= minBpm) topCandidates.push(bestBpmCoarse * 0.5);
  if (bestBpmCoarse * 2.0 <= maxBpm) topCandidates.push(bestBpmCoarse * 2.0);
  for (let idx = 1; idx < numCoarse - 1; idx += 1) {
    const s = coarseCombScores[idx];
    if (s >= bestScore * 0.91 && s >= coarseCombScores[idx - 1] && s >= coarseCombScores[idx + 1]) {
      const b = minBpm + idx * coarseStep;
      if (topCandidates.every((c) => Math.abs(c - b) > 1.0)) {
        topCandidates.push(b);
      }
    }
  }

  let bestFineBpm = bestBpmCoarse;
  let bestFineScore = -1e9;

  for (let c = 0; c < topCandidates.length; c += 1) {
    const center = topCandidates[c];
    const startBpm = Math.max(minBpm, center - 0.5);
    const endBpm = Math.min(maxBpm, center + 0.5);
    for (let bpm = startBpm; bpm <= endBpm + 1e-6; bpm += fineStep) {
      const periodFrames = 60 / (bpm * hopSec);
      const rawComb = evalCombResonatorScore(signal, lo, hi, periodFrames);
      const popPrior = Math.exp(-0.5 * Math.pow((bpm - 120) / 38, 2));
      const coreWeight = bpm >= 84 && bpm <= 162 ? 1.14 : 0.9;
      let score = rawComb * coreWeight * (0.76 + 0.24 * popPrior);
      if (priorBpm) {
        score *= 0.65 + 0.35 * Math.exp(-0.5 * Math.pow((bpm - priorBpm) / priorSigma, 2));
      }
      if (contBpm) {
        score *= 0.8 + 0.2 * Math.exp(-0.5 * Math.pow((bpm - contBpm) / Math.max(4, contBpm * 0.06), 2));
      }
      if (score > bestFineScore) {
        bestFineScore = score;
        bestFineBpm = bpm;
      }
    }
  }

  return {
    bpm: Number(bestFineBpm.toFixed(3)),
    score: bestFineScore,
  };
}

/**
 * Stage 3A: Global Resonator Comb-Filter Tempo & Phase Estimator (65.000–195.000 BPM @ 0.025 BPM).
 */
function estimateTempoAndPhase(flux, hopSec, bpmHint = null) {
  const n = flux.length;
  if (n < 240) {
    const bpm = Number((bpmHint || 120).toFixed(3));
    return { bpm, beatSec: 60 / bpm, beatPhaseSec: 0 };
  }

  const p = ensureWorkerPool(n);
  const mean = computeRollingMean(flux, Math.round(0.8 / hopSec), p.rollingMeanOut.subarray(0, n));
  const centered = p.centered;
  for (let i = 0; i < n; i += 1) {
    centered[i] = Math.max(0, flux[i] - mean[i] * 0.85);
  }

  // Evaluate comb resonator over up to 90s of active audio for crisp tempo lock
  const evalEnd = Math.min(n, Math.round(95 / hopSec));
  const combRes = solveCombFilterBpm(centered, 0, evalEnd, hopSec, {
    minBpm: 65,
    maxBpm: 195,
  });

  let bpm = combRes.bpm;
  // Octave disambiguation keeping musical tempo centered in [80, 178] unless strong hint overrides
  while (bpm < 78 && bpm * 2 <= 195) bpm *= 2;
  while (bpm > 178 && bpm * 0.5 >= 65) bpm *= 0.5;

  if (bpmHint && bpmHint >= 65 && bpmHint <= 195) {
    const ratio = bpm / bpmHint;
    if (Math.abs(ratio - 1) < 0.05 || Math.abs(ratio - 2) < 0.08 || Math.abs(ratio - 0.5) < 0.05) {
      const hintRefine = solveCombFilterBpm(centered, 0, evalEnd, hopSec, {
        minBpm: Math.max(65, bpmHint - 2.5),
        maxBpm: Math.min(195, bpmHint + 2.5),
        priorBpm: bpmHint,
        priorSigma: 1.5,
      });
      bpm = hintRefine.bpm;
    }
  }

  bpm = Math.max(65, Math.min(195, Number(bpm.toFixed(3))));
  const beatSec = 60 / bpm;

  // High-resolution phase-lock across 64 subdivisions (~7-14ms)
  const phaseSteps = 64;
  let bestPhase = 0;
  let bestPhaseScore = -1;
  const maxCheckSec = Math.min((n - 2) * hopSec, 90);

  for (let pIdx = 0; pIdx < phaseSteps; pIdx += 1) {
    const phaseSec = (pIdx / phaseSteps) * beatSec;
    let score = 0;
    for (let t = phaseSec; t < maxCheckSec; t += beatSec) {
      const f = Math.round(t / hopSec);
      if (f >= 1 && f < n - 1) {
        score += centered[f] + centered[f - 1] * 0.5 + centered[f + 1] * 0.5;
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
 * Stage 3B & Stage 4:
 *  - 8-second Sliding-Window Resonator Comb-Filter Tempogram (0.025 BPM effective resolution)
 *  - Viterbi Dynamic Programming Beat Tracker: score = onsetStrength[t] - lambda * (deltaIBI)^2
 *  - 4-Phase Chromagram + Sub-Kick Downbeat (Beat 1) Alignment across 4-bar windows
 */
function trackStemLockedDynamicBeats(
  stemLockedFlux,
  kickFlux,
  bassRootChange,
  snareFlux,
  hopSec,
  baseBpm,
  duration,
  chromaFrames = null
) {
  const n = stemLockedFlux.length;
  const safeBaseBpm = Math.max(65, Math.min(195, baseBpm || 120));
  const fallbackBeatSec = 60 / safeBaseBpm;
  if (n < 240) {
    const beats = [];
    const grid = [];
    for (let i = 0; i * fallbackBeatSec < duration; i += 1) {
      const t = Number((i * fallbackBeatSec).toFixed(4));
      beats.push(t);
      grid.push({
        timeSec: t,
        time: t,
        isMeasure: i % 4 === 0,
        beatIndex: i,
        localBpm: Number(safeBaseBpm.toFixed(3)),
      });
    }
    return { beats, dynamicBeatGrid: grid, downbeatPhase: 0 };
  }

  const p = ensureWorkerPool(n);
  const rawStrength = p.rawStrength;
  for (let i = 0; i < n; i += 1) {
    rawStrength[i] = stemLockedFlux[i] + kickFlux[i] * 0.92 + snareFlux[i] * 1.05 + bassRootChange[i] * 0.58;
  }
  const localMean = computeRollingMean(
    rawStrength.subarray(0, n),
    Math.round(1.2 / hopSec),
    p.rollingMeanOut.subarray(0, n)
  );
  const beatEnv = p.beatEnv;
  for (let i = 0; i < n; i += 1) {
    const norm = rawStrength[i] / Math.max(0.015, localMean[i] * 1.42 + 0.015);
    beatEnv[i] = Math.min(3.6, Math.log1p(norm * 2.5));
  }

  const smoothEnv = p.smoothEnv;
  smoothEnv[0] = beatEnv[0] * 0.55;
  smoothEnv[n - 1] = beatEnv[n - 1] * 0.55;
  for (let i = 1; i < n - 1; i += 1) {
    smoothEnv[i] = beatEnv[i - 1] * 0.16 + beatEnv[i] * 0.68 + beatEnv[i + 1] * 0.16;
  }

  // 8.0-second sliding-window resonator comb-filter tempogram (step = 2.0s)
  const globalPeriod = Math.max(24, fallbackBeatSec / hopSec);
  const winFrames = Math.max(400, Math.round(8.0 / hopSec));
  const hopStepFrames = Math.max(120, Math.round(2.0 / hopSec));
  const halfWin = winFrames >> 1;
  const numWindows = Math.max(1, Math.ceil(n / hopStepFrames));
  const localBpmPerBlock = p.localBpmPerBlock;
  const localPeriodPerBlock = p.localPeriodPerBlock;
  const minWinBpm = Math.max(65, safeBaseBpm * 0.78);
  const maxWinBpm = Math.min(195, safeBaseBpm * 1.24);

  for (let w = 0; w < numWindows; w += 1) {
    const center = Math.min(n - 1, w * hopStepFrames + (hopStepFrames >> 1));
    const lo = Math.max(0, center - halfWin);
    const hi = Math.min(n, center + halfWin);
    const prevBpm = w > 0 ? localBpmPerBlock[w - 1] : safeBaseBpm;
    const res = solveCombFilterBpm(smoothEnv, lo, hi, hopSec, {
      minBpm: minWinBpm,
      maxBpm: maxWinBpm,
      priorBpm: safeBaseBpm,
      priorSigma: safeBaseBpm * 0.12,
      contBpm: prevBpm,
    });
    localBpmPerBlock[w] = res.bpm;
    localPeriodPerBlock[w] = 60 / (res.bpm * hopSec);
  }

  for (let w = 1; w < numWindows - 1; w += 1) {
    localPeriodPerBlock[w] =
      localPeriodPerBlock[w - 1] * 0.22 +
      localPeriodPerBlock[w] * 0.56 +
      localPeriodPerBlock[w + 1] * 0.22;
  }

  // Viterbi Dynamic Programming Beat Path: score[f] = smoothEnv[f] + max(score[prev] - lambda * deltaIBI^2)
  const dpScore = p.dpScore;
  const dpBack = p.dpBack;
  dpBack.fill(-1, 0, n);
  const lambda = 6.2;

  for (let f = 0; f < n; f += 1) {
    const wPos = f / hopStepFrames;
    const w0 = Math.min(numWindows - 1, Math.floor(wPos));
    const w1 = Math.min(numWindows - 1, w0 + 1);
    const frac = wPos - w0;
    const targetP = localPeriodPerBlock[w0] * (1 - frac) + localPeriodPerBlock[w1] * frac;

    const minTau = Math.max(24, Math.floor(targetP * 0.68));
    const maxTau = Math.min(f, Math.ceil(targetP * 1.38));

    let bestPrevScore = 0;
    let bestPrevIdx = -1;

    if (f >= minTau) {
      bestPrevScore = -1e9;
      for (let tau = minTau; tau <= maxTau; tau += 1) {
        const prev = f - tau;
        const deltaIbi = Math.log(tau / targetP);
        const cand = dpScore[prev] - lambda * deltaIbi * deltaIbi;
        if (cand > bestPrevScore) {
          bestPrevScore = cand;
          bestPrevIdx = prev;
        }
      }
    }

    dpScore[f] = smoothEnv[f] + (bestPrevIdx >= 0 ? bestPrevScore : 0);
    dpBack[f] = bestPrevIdx;
  }

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

  while (rawBeatFrames.length > 0 && rawBeatFrames[0] > globalPeriod * 0.9) {
    const stepP =
      rawBeatFrames.length >= 2
        ? Math.max(
            Math.round(globalPeriod * 0.8),
            Math.min(Math.round(globalPeriod * 1.2), rawBeatFrames[1] - rawBeatFrames[0])
          )
        : Math.round(globalPeriod);
    const prev = rawBeatFrames[0] - stepP;
    if (prev < 0) break;
    rawBeatFrames.unshift(prev);
  }
  while (rawBeatFrames.length > 0 && rawBeatFrames[rawBeatFrames.length - 1] + globalPeriod < n) {
    rawBeatFrames.push(rawBeatFrames[rawBeatFrames.length - 1] + Math.round(globalPeriod));
  }

  // Stage 3C: 4-Bar Drum-Anchored Beat-Phase Histogram Voting (Kick + Snare)
  // Snaps each 4-bar window's phase offset dead-center onto the Kick+Snare pulse!
  const refinedBeatTimes = new Float32Array(rawBeatFrames.length);
  const frameTimeSec = (f) => (f * HOP_SIZE + HALF_FFT) / (HOP_SIZE / hopSec);
  for (let i = 0; i < rawBeatFrames.length; i += 1) {
    const f = Math.min(n - 1, Math.max(0, rawBeatFrames[i]));
    refinedBeatTimes[i] = Math.max(0, frameTimeSec(f));
  }

  const HIST_BINS = 64;
  const phaseHist = new Float32Array(HIST_BINS);
  const barBlockBeats = 16; // 4 bars of 4/4
  for (let bStart = 0; bStart < rawBeatFrames.length; bStart += barBlockBeats) {
    const bEnd = Math.min(rawBeatFrames.length, bStart + barBlockBeats);
    if (bEnd - bStart < 4) continue;
    const t0 = refinedBeatTimes[bStart];
    const t1 = refinedBeatTimes[bEnd - 1];
    const localBeatSec = Math.max(0.28, Math.min(1.15, (t1 - t0) / Math.max(1, bEnd - bStart - 1)));
    const fLo = Math.max(0, Math.floor((t0 - localBeatSec * 0.5) / hopSec));
    const fHi = Math.min(n - 1, Math.ceil((t1 + localBeatSec * 0.5) / hopSec));

    phaseHist.fill(0);
    for (let f = fLo; f <= fHi; f += 1) {
      const drumPulse = kickFlux[f] * 1.4 + snareFlux[f] * 1.35 + smoothEnv[f] * 0.35;
      if (drumPulse <= 0.02) continue;
      const tF = frameTimeSec(f);
      const relPhase = (((tF - t0) / localBeatSec) % 1 + 1) % 1;
      const centerBin = Math.floor(relPhase * HIST_BINS) % HIST_BINS;
      const prevBin = (centerBin - 1 + HIST_BINS) % HIST_BINS;
      const nextBin = (centerBin + 1) % HIST_BINS;
      phaseHist[centerBin] += drumPulse;
      phaseHist[prevBin] += drumPulse * 0.45;
      phaseHist[nextBin] += drumPulse * 0.45;
    }

    let bestBin = 0;
    let bestBinVal = -1;
    for (let b = 0; b < HIST_BINS; b += 1) {
      if (phaseHist[b] > bestBinVal) {
        bestBinVal = phaseHist[b];
        bestBin = b;
      }
    }

    // Wrap histogram offset to [-0.25, +0.25] beat so we lock precisely onto the beat center without phase jump
    let phaseFrac = bestBin / HIST_BINS;
    if (phaseFrac > 0.5) phaseFrac -= 1;
    if (Math.abs(phaseFrac) <= 0.25) {
      const shiftSec = phaseFrac * localBeatSec;
      for (let i = bStart; i < bEnd; i += 1) {
        refinedBeatTimes[i] = Math.max(0, refinedBeatTimes[i] + shiftSec);
      }
    }
  }

  // Ensure strictly monotonic, smooth inter-beat spacing after histogram phase snap
  for (let i = 1; i < refinedBeatTimes.length; i += 1) {
    if (refinedBeatTimes[i] <= refinedBeatTimes[i - 1] + 0.22) {
      refinedBeatTimes[i] = refinedBeatTimes[i - 1] + fallbackBeatSec;
    }
  }

  // Stage 4: 4-Phase Chromagram + Kick/Snare Downbeat Alignment across 4-bar (16-beat) windows
  const hasChroma = Boolean(chromaFrames && chromaFrames.length >= n * 12);
  const beatScores = new Float32Array(rawBeatFrames.length);
  const phaseScores = [0, 0, 0, 0];

  for (let i = 0; i < rawBeatFrames.length; i += 1) {
    const f = Math.min(n - 1, Math.max(0, Math.round((refinedBeatTimes[i] / hopSec) - HALF_FFT / HOP_SIZE)));
    const fLo = Math.max(0, f - 4);
    const fHi = Math.min(n - 1, f + 4);
    let kickPeak = 0;
    let bassChangePeak = 0;
    for (let k = fLo; k <= fHi; k += 1) {
      if (kickFlux[k] > kickPeak) kickPeak = kickFlux[k];
      if (bassRootChange[k] > bassChangePeak) bassChangePeak = bassRootChange[k];
    }

    const snare2 = i + 1 < rawBeatFrames.length ? snareFlux[Math.min(n - 1, rawBeatFrames[i + 1])] : 0;
    const snare4 = i + 3 < rawBeatFrames.length ? snareFlux[Math.min(n - 1, rawBeatFrames[i + 3])] : 0;

    // 12-TET Harmonic Chroma Change Flux comparing bar-ahead average vs previous beat average
    let chromaChange = 0;
    if (hasChroma && i > 0) {
      const prevF = Math.min(n - 1, Math.max(0, rawBeatFrames[i - 1]));
      const nextF = i + 1 < rawBeatFrames.length ? Math.min(n - 1, rawBeatFrames[i + 1]) : f;
      const curOff = f * 12;
      const nextOff = nextF * 12;
      const prevOff = prevF * 12;
      let dot = 0;
      let normA = 0;
      let normB = 0;
      for (let c = 0; c < 12; c += 1) {
        const a = (chromaFrames[curOff + c] + chromaFrames[nextOff + c]) * 0.5;
        const b = chromaFrames[prevOff + c];
        dot += a * b;
        normA += a * a;
        normB += b * b;
      }
      const cosSim = dot / Math.sqrt(Math.max(1e-8, normA * normB));
      chromaChange = Math.max(0, 1 - Math.min(1, cosSim));
    }

    const downbeatStrength =
      kickPeak * 2.1 +
      bassChangePeak * 1.45 +
      chromaChange * 1.65 +
      (snare2 + snare4) * 0.95 +
      smoothEnv[f] * 0.45;
    beatScores[i] = downbeatStrength;
    phaseScores[i % 4] += downbeatStrength;
  }

  let globalDownbeatPhase = 0;
  for (let ph = 1; ph < 4; ph += 1) {
    if (phaseScores[ph] > phaseScores[globalDownbeatPhase]) globalDownbeatPhase = ph;
  }

  // Evaluate 4-bar (16-beat) sliding-window downbeat phase consensus
  const barWinBeats = 16;
  const isMeasureFlags = new Uint8Array(rawBeatFrames.length);
  for (let bStart = 0; bStart < rawBeatFrames.length; bStart += barWinBeats) {
    const bEnd = Math.min(rawBeatFrames.length, bStart + barWinBeats);
    const localPh = [0, 0, 0, 0];
    for (let i = bStart; i < bEnd; i += 1) {
      localPh[i % 4] += beatScores[i];
    }
    let winPh = globalDownbeatPhase;
    const globalRefScore = localPh[globalDownbeatPhase];
    for (let ph = 0; ph < 4; ph += 1) {
      if (localPh[ph] > globalRefScore * 1.24 && localPh[ph] >= localPh[winPh]) {
        winPh = ph;
      }
    }
    for (let i = bStart; i < bEnd; i += 1) {
      if (((i - winPh) % 4 + 4) % 4 === 0) {
        isMeasureFlags[i] = 1;
      }
    }
  }

  const beats = [];
  const dynamicBeatGrid = [];
  for (let i = 0; i < refinedBeatTimes.length; i += 1) {
    const tSec = Math.max(0, Number(refinedBeatTimes[i].toFixed(4)));
    const prevT = i > 0 ? beats[i - 1] : tSec - fallbackBeatSec;
    const dtBeat = Math.max(0.28, Math.min(1.15, tSec - prevT));
    const localBpm = Number(Math.max(65, Math.min(200, 60 / dtBeat)).toFixed(3));
    beats.push(tSec);
    dynamicBeatGrid.push({
      tick: i * RESOLUTION_PPQ,
      timeSec: tSec,
      time: tSec,
      isMeasure: isMeasureFlags[i] === 1,
      beatIndex: i,
      localBpm,
    });
  }

  return { beats, dynamicBeatGrid, downbeatPhase: globalDownbeatPhase };
}

/**
 * Beat-Synchronous Energy & Spectral Novelty Song-Section Segmenter.
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
  const measureStarts = [];
  for (let i = 0; i < dynamicBeatGrid.length; i += 1) {
    if (dynamicBeatGrid[i].isMeasure) {
      measureStarts.push(dynamicBeatGrid[i].timeSec);
    }
  }
  if (measureStarts.length === 0 || measureStarts[0] > 0.4) {
    measureStarts.unshift(0);
  }

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

  const sortedRms = blocks.map((b) => b.rms).sort((a, b) => a - b);
  const p30Rms = sortedRms[Math.floor(sortedRms.length * 0.3)] || 0.02;
  const p55Rms = sortedRms[Math.floor(sortedRms.length * 0.55)] || 0.05;
  const p72Rms = sortedRms[Math.floor(sortedRms.length * 0.72)] || 0.08;
  const maxRms = sortedRms[sortedRms.length - 1] || 0.1;

  const sortedGHigh = blocks.map((b) => b.guitarHigh).sort((a, b) => a - b);
  const p78GHigh = sortedGHigh[Math.floor(sortedGHigh.length * 0.78)] || 0.1;

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
      avgHnr >= 1.6 &&
      avgRms >= p55Rms * 0.9
    ) {
      type = 'GUITAR_SOLO';
      hasGuitarSolo = true;
    } else if (avgRms >= p72Rms && avgDrum >= 0.48) {
      type = 'CHORUS';
      hasSeenChorus = true;
    } else if (
      hasSeenChorus &&
      midFrac >= 0.42 &&
      midFrac <= 0.84 &&
      (avgRms <= p30Rms * 1.15 || avgDrum < 0.52)
    ) {
      type = avgRms <= p30Rms * 1.12 ? 'BREAKDOWN' : 'BRIDGE';
    } else if (s + 1 < boundaries.length - 1) {
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
      BREAKDOWN: 'Breakdown',
      BRIDGE: 'Bridge',
      OUTRO: 'Outro',
    };

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
 * Estimates fundamental bass frequency (38Hz–225Hz) via normalized autocorrelation.
 */
function estimateBassFundamentalHz(mono, centerSample, sampleRate, fallbackHz) {
  const win = Math.min(1024, Math.max(512, Math.round(sampleRate * 0.036)));
  const start = Math.max(0, Math.min(mono.length - win - 1, centerSample - Math.round(win * 0.15)));
  if (start + win >= mono.length) return fallbackHz;

  let dc = 0;
  for (let i = 0; i < win; i += 1) dc += mono[start + i];
  dc /= win;

  let energy = 0;
  for (let i = 0; i < win; i += 1) {
    const s = mono[start + i] - dc;
    energy += s * s;
  }
  if (energy < 1e-6) return fallbackHz;

  const minLag = Math.max(12, Math.floor(sampleRate / 230));
  const maxLag = Math.min(win - 48, Math.ceil(sampleRate / 38));

  let bestLag = -1;
  let bestCorr = 0.24;
  const lagStep = sampleRate > 30000 ? 3 : 2;

  for (let lag = minLag; lag <= maxLag; lag += lagStep) {
    let num = 0;
    let denA = 0;
    let denB = 0;
    const len = win - lag;
    for (let i = 0; i < len; i += lagStep) {
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

  return bestLag > 0 ? sampleRate / bestLag : fallbackHz;
}

/**
 * Locates the physical waveform onset sample (35%-of-peak attack knee) inside frame window
 * centered at frameIdx * hopSize + HALF_FFT on the time-aligned OLA stem PCM.
 */
function findStemOnsetSample(stemPcm, fallbackL, frameIdx, hopSize, fftSize, totalSamples) {
  const src = stemPcm || fallbackL;
  const halfWin = fftSize >> 1;
  const center = Math.min(totalSamples - 1, Math.max(0, Math.floor(frameIdx * hopSize + halfWin)));
  const searchHalf = Math.min(halfWin, 512);
  const base = Math.max(0, center - searchHalf);
  const end = Math.min(totalSamples - 1, center + searchHalf);
  if (!src || end <= base) return center;

  let peakAbs = 0;
  let peakSample = center;
  for (let i = base; i <= end; i += 1) {
    const v = src[i];
    const av = v < 0 ? -v : v;
    if (av > peakAbs) {
      peakAbs = av;
      peakSample = i;
    }
  }
  if (peakAbs <= 1e-6) return center;

  const kneeFloor = peakAbs * 0.35;
  const backLimit = Math.max(base, peakSample - 220);
  let onsetSample = peakSample;
  for (let i = peakSample; i >= backLimit; i -= 1) {
    const v = src[i];
    const av = v < 0 ? -v : v;
    if (av >= kneeFloor) onsetSample = i;
    else break;
  }
  return onsetSample;
}

/**
 * Paired Real-Signal FFT: packs L + i*R into (fftRe, fftIm), executes ONE Radix-2 FFT,
 * and unpacks Mid = 0.5*(L+R) and Side = 0.5*(L-R) spectra into midReBuf/Im & sideReBuf/Im.
 */
function computeStereoMidSideSpectrum(leftPcm, rightPcm, baseSample, totalSamples) {
  for (let i = 0; i < FFT_SIZE; i += 1) {
    const idx = baseSample + i;
    const w = HANN[i];
    if (idx >= 0 && idx < totalSamples) {
      fftRe[i] = leftPcm[idx] * w;
      fftIm[i] = rightPcm[idx] * w;
    } else {
      fftRe[i] = 0;
      fftIm[i] = 0;
    }
  }

  runFastRadix2Fft(fftRe, fftIm);

  const dcL = fftRe[0];
  const dcR = fftIm[0];
  midReBuf[0] = (dcL + dcR) * 0.5;
  midImBuf[0] = 0;
  sideReBuf[0] = (dcL - dcR) * 0.5;
  sideImBuf[0] = 0;

  for (let k = 1; k < HALF_FFT; k += 1) {
    const mk = FFT_SIZE - k;
    const rk = fftRe[k];
    const ik = fftIm[k];
    const rmk = fftRe[mk];
    const imk = fftIm[mk];

    const lRe = 0.5 * (rk + rmk);
    const lIm = 0.5 * (ik - imk);
    const rRe = 0.5 * (ik + imk);
    const rIm = -0.5 * (rk - rmk);

    midReBuf[k] = 0.5 * (lRe + rRe);
    midImBuf[k] = 0.5 * (lIm + rIm);
    sideReBuf[k] = 0.5 * (lRe - rRe);
    sideImBuf[k] = 0.5 * (lIm - rIm);
  }
}

/**
 * Packs two Hermitian-symmetric real spectra (A, B) into complex conjugate input (A + i*B)*
 * so a single Radix-2 FFT call reconstructs both time-domain frames into (reOut, -imOut).
 */
function runPairedRealIfft(reOut, imOut) {
  reOut[0] = ifftReA[0];
  imOut[0] = -ifftReB[0];
  reOut[HALF_FFT] = 0;
  imOut[HALF_FFT] = 0;

  for (let k = 1; k < HALF_FFT; k += 1) {
    const aRe = ifftReA[k];
    const aIm = ifftImA[k];
    const bRe = ifftReB[k];
    const bIm = ifftImB[k];

    const wkRe = aRe - bIm;
    const wkIm = aIm + bRe;
    reOut[k] = wkRe;
    imOut[k] = -wkIm;

    const wmkRe = aRe + bIm;
    const wmkIm = bRe - aIm;
    const mk = FFT_SIZE - k;
    reOut[mk] = wmkRe;
    imOut[mk] = -wmkIm;
  }

  runFastRadix2Fft(reOut, imOut);
}

/**
 * 5-Stage Offline 4-Stem Audio Separation & Stem-Locked 192 PPQ [SyncTrack] Engine.
 */
export async function analyzeStereo(
  leftAudio,
  rightAudio = null,
  {
    sampleRate = DEFAULT_SAMPLE_RATE,
    bpmHint = null,
    duration = 0,
    onProgress = null,
    shouldCancel = null,
    synthesizeStemAudio = true,
  } = {}
) {
  let leftPcm = leftAudio;
  let rightPcm = rightAudio || leftAudio;
  let resolvedRate = Number(sampleRate) || DEFAULT_SAMPLE_RATE;

  if (resolvedRate > 24500 || !rightAudio) {
    const dec = decimateTo22050Stereo(leftAudio, rightAudio, resolvedRate);
    leftPcm = dec.left;
    rightPcm = dec.right;
    resolvedRate = dec.sampleRate;
  }

  const safeSampleRate = Math.max(16000, Math.min(48000, resolvedRate));
  const hopSec = HOP_SIZE / safeSampleRate;
  const binHz = safeSampleRate / FFT_SIZE;

  const totalSamples = leftPcm.length;
  const actualDuration = duration > 0 ? duration : totalSamples / safeSampleRate;
  const numFrames = Math.max(1, Math.floor((totalSamples - FFT_SIZE) / HOP_SIZE) + 1);

  if (shouldCancel?.()) throw new Error('JOB_CANCELLED');

  const emitProgress = (stage, stagePct, globalPct, message) => {
    if (!onProgress) return;
    const pctRounded = Math.max(0, Math.min(100, Math.round(stagePct)));
    onProgress({
      stage,
      percent: pctRounded,
      pct: Math.max(0, Math.min(1, globalPct)),
      message: message || `Stage ${stage}/5 (${pctRounded}%)…`,
    });
  };

  emitProgress(1, 2, 0.02, 'Stage 1/5: 5.8ms Multi-Band SuperFlux & Complex Phase STFT (2%)...');

  const pool = ensureWorkerPool(numFrames);
  const maskPercQ = ensureMaskStore(numFrames);

  const rmsAll = pool.rmsAll.subarray(0, numFrames);
  const framePeakAbs = pool.framePeakAbs.subarray(0, numFrames);
  const percMeanPower = pool.percMeanPower.subarray(0, numFrames);
  const harmMeanPower = pool.harmMeanPower.subarray(0, numFrames);
  const subBassMeanPower = pool.subBassMeanPower.subarray(0, numFrames);
  const midVocalMeanPower = pool.midVocalMeanPower.subarray(0, numFrames);
  const sideGuitarSq = pool.sideGuitarSq.subarray(0, numFrames);
  const midGuitarCenterSq = pool.midGuitarCenterSq.subarray(0, numFrames);
  const guitarOvertoneRatio = pool.guitarOvertoneRatio.subarray(0, numFrames);
  const guitarAttackRatio = pool.guitarAttackRatio.subarray(0, numFrames);
  const pianoAttackRatio = pool.pianoAttackRatio.subarray(0, numFrames);
  const stemDrumsSq = pool.stemDrumsSq.subarray(0, numFrames);
  const stemBassSq = pool.stemBassSq.subarray(0, numFrames);
  const stemGuitarSq = pool.stemGuitarSq.subarray(0, numFrames);
  const stemPianoSq = pool.stemPianoSq.subarray(0, numFrames);
  const stemDrumsRms150 = pool.stemDrumsRms150.subarray(0, numFrames);
  const stemBassRms150 = pool.stemBassRms150.subarray(0, numFrames);
  const stemGuitarRms150 = pool.stemGuitarRms150.subarray(0, numFrames);
  const stemPianoRms150 = pool.stemPianoRms150.subarray(0, numFrames);

  const kickEnergy = pool.kickEnergy.subarray(0, numFrames);
  const bassEnergy = pool.bassEnergy.subarray(0, numFrames);
  const snareBodyEnergy = pool.snareBodyEnergy.subarray(0, numFrames);
  const tomEnergy = pool.tomEnergy.subarray(0, numFrames);
  const guitarEnergy = pool.guitarEnergy.subarray(0, numFrames);
  const guitarHighEnergy = pool.guitarHighEnergy.subarray(0, numFrames);
  const pianoEnergy = pool.pianoEnergy.subarray(0, numFrames);
  const snapEnergy = pool.snapEnergy.subarray(0, numFrames);
  const cymbalEnergy = pool.cymbalEnergy.subarray(0, numFrames);
  const bandProfiles = pool.bandProfiles.subarray(0, numFrames * 6);
  const subBandSuperFlux = pool.subBandSuperFlux.subarray(0, numFrames * 6);

  const kickFlux = pool.kickFlux.subarray(0, numFrames);
  const bassFlux = pool.bassFlux.subarray(0, numFrames);
  const bassRootChange = pool.bassRootChange.subarray(0, numFrames);
  const snareFlux = pool.snareFlux.subarray(0, numFrames);
  const tomFlux = pool.tomFlux.subarray(0, numFrames);
  const cymbalFlux = pool.cymbalFlux.subarray(0, numFrames);
  const guitarFlux = pool.guitarFlux.subarray(0, numFrames);
  const guitarPluckFlux = pool.guitarPluckFlux.subarray(0, numFrames);
  const pianoFlux = pool.pianoFlux.subarray(0, numFrames);
  const phaseDevFlux = pool.phaseDevFlux.subarray(0, numFrames);
  const complexDomainFlux = pool.complexDomainFlux.subarray(0, numFrames);
  const stemLockedFlux = pool.stemLockedFlux.subarray(0, numFrames);

  const guitarHnr = pool.guitarHnr.subarray(0, numFrames);
  const highFlatness = pool.highFlatness.subarray(0, numFrames);
  const guitarPitchHz = pool.guitarPitchHz.subarray(0, numFrames);
  const pianoPitchHz = pool.pianoPitchHz.subarray(0, numFrames);
  const pianoPeakCount = pool.pianoPeakCount.subarray(0, numFrames);
  const pianoChords = pool.pianoChords.subarray(0, numFrames * 3);
  const bassPeakHz = pool.bassPeakHz.subarray(0, numFrames);
  const chromaFrames = pool.chromaFrames.subarray(0, numFrames * 12);
  chromaFrames.fill(0);

  ensureBinToChromaLut(safeSampleRate);
  prevHarmMag.fill(0);
  prevPercMag.fill(0);
  prevMidMag.fill(0);
  prevPhase.fill(0);
  prevPhase2.fill(0);

  // 6 Log-Spaced Psychoacoustic Sub-Band Bin Boundaries
  const B0_LO = Math.max(1, Math.round(30 / binHz)); // Sub-Kick: 30-110Hz
  const B0_HI = Math.min(HALF_FFT - 2, Math.round(110 / binHz));
  const B1_LO = B0_HI + 1; // Low-Bass: 110-250Hz
  const B1_HI = Math.min(HALF_FFT - 2, Math.round(250 / binHz));
  const B2_LO = B1_HI + 1; // Snare/Body: 250-900Hz
  const B2_HI = Math.min(HALF_FFT - 2, Math.round(900 / binHz));
  const B3_LO = B2_HI + 1; // Guitar/Vocal: 900-3200Hz
  const B3_HI = Math.min(HALF_FFT - 2, Math.round(3200 / binHz));
  const B4_LO = B3_HI + 1; // Presence/Attack: 3200-6500Hz
  const B4_HI = Math.min(HALF_FFT - 2, Math.round(6500 / binHz));
  const B5_LO = B4_HI + 1; // Air/Cymbals: 6500-11025Hz
  const B5_HI = Math.min(HALF_FFT - 1, Math.round(Math.min(11025, safeSampleRate * 0.49) / binHz));

  // Detailed Instrument Stem Spectral Boundaries
  const KICK_LO = Math.max(1, Math.round(40 / binHz));
  const KICK_HI = Math.min(HALF_FFT - 2, Math.round(120 / binHz));
  const SUB_BASS_LO = Math.max(1, Math.round(45 / binHz));
  const SUB_BASS_HI = Math.min(HALF_FFT - 2, Math.round(225 / binHz));
  const BASS_LO = Math.max(1, Math.round(38 / binHz));
  const BASS_HI = Math.min(HALF_FFT - 2, Math.round(240 / binHz));
  const MID_VOCAL_LO = Math.max(2, Math.round(250 / binHz));
  const MID_VOCAL_HI = Math.min(HALF_FFT - 2, Math.round(2500 / binHz));
  const PIANO_LO = Math.max(2, Math.round(110 / binHz));
  const PIANO_HI = Math.min(HALF_FFT - 2, Math.round(3200 / binHz));
  const SNARE_BODY_LO = Math.max(2, Math.round(180 / binHz));
  const SNARE_BODY_HI = Math.min(HALF_FFT - 2, Math.round(500 / binHz));
  const TOM_LO = Math.max(2, Math.round(480 / binHz));
  const TOM_HI = Math.min(HALF_FFT - 2, Math.round(1600 / binHz));
  const GUITAR_LO = Math.max(3, Math.round(180 / binHz));
  const GUITAR_HI = Math.min(HALF_FFT - 2, Math.round(4500 / binHz));
  const GUITAR_PLUCK_LO = Math.min(GUITAR_HI - 1, Math.round(1200 / binHz));
  const GUITAR_PLUCK_HI = Math.min(HALF_FFT - 2, Math.round(5500 / binHz));
  const GUITAR_SOLO_LO = Math.min(GUITAR_HI - 1, Math.round(880 / binHz));
  const GUITAR_COMB_MAX_BIN = Math.min(HALF_FFT - 4, Math.round(1400 / binHz));
  const SNAP_LO = Math.min(HALF_FFT - 4, Math.round(2500 / binHz));
  const SNAP_HI = Math.min(HALF_FFT - 2, Math.round(6000 / binHz));
  const CYMBAL_LO = Math.min(HALF_FFT - 2, Math.round(6500 / binHz));
  const CYMBAL_HI = B5_HI;

  const normScale = 2 / FFT_SIZE;

  const computeStereoFrameMagsAndPhase = (frameIdx, targetMidMag, targetSideMag, targetPhase) => {
    const clampedF = frameIdx < 0 ? 0 : frameIdx >= numFrames ? numFrames - 1 : frameIdx;
    const base = clampedF * HOP_SIZE;
    if (frameIdx >= 0 && frameIdx < numFrames) {
      let sqSum = 0;
      let peakAbs = 0;
      for (let i = 0; i < FFT_SIZE; i += 1) {
        const idx = base + i;
        if (idx < totalSamples) {
          const s = (leftPcm[idx] + rightPcm[idx]) * 0.5;
          const absS = s < 0 ? -s : s;
          if (absS > peakAbs) peakAbs = absS;
          if ((i & 1) === 0) sqSum += s * s;
        }
      }
      rmsAll[frameIdx] = Math.sqrt(sqSum / (FFT_SIZE >> 1));
      framePeakAbs[frameIdx] = peakAbs;
    }

    computeStereoMidSideSpectrum(leftPcm, rightPcm, base, totalSamples);
    for (let k = 0; k < HALF_FFT; k += 1) {
      const mr = midReBuf[k];
      const mi = midImBuf[k];
      const sr = sideReBuf[k];
      const si = sideImBuf[k];
      const mMag = Math.sqrt(mr * mr + mi * mi) * normScale;
      const sMag = Math.sqrt(sr * sr + si * si) * normScale;
      targetMidMag[k] = Math.log1p(1000 * mMag);
      targetSideMag[k] = Math.log1p(1000 * sMag);
      targetPhase[k] = Math.atan2(mi, mr);
    }
  };

  // =========================================================================
  // PASS 1 (Stage 1/5 & 2A/5): 21x17 Stereo 2D HPSS + 6-Band SuperFlux + Complex Phase
  // =========================================================================
  for (let r = 0; r < HPSS_TIME_WIN; r += 1) {
    computeStereoFrameMagsAndPhase(r - HPSS_TIME_HALF, hpssRing[r], hpssSideRing[r], hpssPhaseRing[r]);
  }

  let prevKickE = 0;
  let prevBassE = 0;
  let prevSnareBodyE = 0;
  let prevTomE = 0;
  let prevSnapE = 0;
  let prevCymbalE = 0;
  let prevBassHz = 92;
  let lastGuitarHz = 440;
  let lastPianoHz = 392;
  let lastBassHz = 92;

  const progressStride1 = Math.max(128, Math.floor(numFrames / 22));

  for (let f = 0; f < numFrames; f += 1) {
    if (f > 0) {
      const writeSlot = (f + HPSS_TIME_WIN - 1) % HPSS_TIME_WIN;
      computeStereoFrameMagsAndPhase(
        f + HPSS_TIME_HALF,
        hpssRing[writeSlot],
        hpssSideRing[writeSlot],
        hpssPhaseRing[writeSlot]
      );
    }

    const centerSlot = (f + HPSS_TIME_HALF) % HPSS_TIME_WIN;
    const centerMidMag = hpssRing[centerSlot];
    const centerSideMag = hpssSideRing[centerSlot];
    const centerPhase = hpssPhaseRing[centerSlot];

    const maskRowOffset = f * HALF_FFT;
    maskPercQ[maskRowOffset] = 0;
    harmMag[0] = centerMidMag[0];
    percMag[0] = 0;

    let phaseDevWeightedSum = 0;
    let phaseMagSum = 0;
    let complexDevSum = 0;
    let drumSqSum = 0;
    let percPowerSum = 0;
    let percBinCount = 0;
    let harmPowerSum = 0;
    let harmBinCount = 0;
    let bassSqSum = 0;
    let subBassPowerSum = 0;
    let subBassBinCount = 0;
    let midVocalPowerSum = 0;
    let midVocalBinCount = 0;
    let guitarSqSum = 0;
    let sideGuitarSqSum = 0;
    let midGuitarSqSum = 0;

    let sf0 = 0;
    let sf1 = 0;
    let sf2 = 0;
    let sf3 = 0;
    let sf4 = 0;
    let sf5 = 0;

    for (let k = 1; k < HALF_FFT; k += 1) {
      // 21-frame temporal median (harmonic continuity)
      for (let t = 0; t < HPSS_TIME_WIN; t += 1) {
        medTimeScratch[t] = hpssRing[t][k];
      }
      const hMed = quickSelectMedian(medTimeScratch, HPSS_TIME_WIN, HPSS_TIME_HALF);

      // 17-bin frequency median (percussive broadband impulse)
      for (let df = -HPSS_FREQ_HALF; df <= HPSS_FREQ_HALF; df += 1) {
        const kb = k + df < 0 ? 0 : k + df >= HALF_FFT ? HALF_FFT - 1 : k + df;
        medFreqScratch[df + HPSS_FREQ_HALF] = centerMidMag[kb];
      }
      const pMed = quickSelectMedian(medFreqScratch, HPSS_FREQ_WIN, HPSS_FREQ_HALF);

      const h2 = hMed * hMed;
      const p2 = pMed * pMed;
      const denom = h2 + p2 + 1e-12;
      const mPerc = p2 / denom;
      const mHarm = h2 / denom;

      maskPercQ[maskRowOffset + k] = Math.min(255, Math.max(0, Math.round(mPerc * 255)));

      const mValMid = centerMidMag[k];
      const mValStereo = mValMid + 0.65 * centerSideMag[k];
      harmMag[k] = mValStereo * mHarm;
      percMag[k] = mValMid * mPerc;

      // SuperFlux vibrato-immune max-filtered positive spectral flux across the 6 psychoacoustic sub-bands
      const kL2 = k >= 2 ? k - 2 : 0;
      const kL1 = k >= 1 ? k - 1 : 0;
      const kR1 = k + 1 < HALF_FFT ? k + 1 : HALF_FFT - 1;
      const kR2 = k + 2 < HALF_FFT ? k + 2 : HALF_FFT - 1;
      const prevMax = Math.max(
        prevMidMag[kL2],
        prevMidMag[kL1],
        prevMidMag[k],
        prevMidMag[kR1],
        prevMidMag[kR2]
      );
      const sFlux = mValMid > prevMax ? mValMid - prevMax : 0;
      if (k >= B0_LO && k <= B0_HI) sf0 += sFlux;
      else if (k >= B1_LO && k <= B1_HI) sf1 += sFlux;
      else if (k >= B2_LO && k <= B2_HI) sf2 += sFlux;
      else if (k >= B3_LO && k <= B3_HI) sf3 += sFlux;
      else if (k >= B4_LO && k <= B4_HI) sf4 += sFlux;
      else if (k >= B5_LO && k <= B5_HI) sf5 += sFlux;

      // Linear Parseval-calibrated stem powers
      const mLinMid = Math.expm1(mValMid) * 0.001;
      const sLinSide = Math.expm1(centerSideMag[k]) * 0.001;
      const wideLin = mLinMid + 0.65 * sLinSide;
      const percLin = mLinMid * mPerc;
      const harmLin = mLinMid * mHarm;
      const harmWideLin = wideLin * mHarm;

      if (
        (k >= KICK_LO && k <= KICK_HI) ||
        (k >= SNARE_BODY_LO && k <= TOM_HI) ||
        (k >= SNAP_LO && k <= CYMBAL_HI)
      ) {
        const pSq = percLin * percLin;
        drumSqSum += pSq;
        percPowerSum += pSq;
        percBinCount += 1;
      }
      if (k >= BASS_LO && k <= SNAP_HI) {
        harmPowerSum += harmLin * harmLin;
        harmBinCount += 1;
      }
      if (k >= BASS_LO && k <= BASS_HI) {
        const kickSuppr = k <= KICK_HI ? 1 - mPerc * 0.65 : 1.0;
        const bLin = harmLin * kickSuppr;
        bassSqSum += bLin * bLin;
      }
      if (k >= SUB_BASS_LO && k <= SUB_BASS_HI) {
        subBassPowerSum += harmLin * harmLin;
        subBassBinCount += 1;
      }
      if (k >= MID_VOCAL_LO && k <= MID_VOCAL_HI) {
        midVocalPowerSum += mLinMid * mLinMid;
        midVocalBinCount += 1;
      }
      if (k >= GUITAR_LO && k <= GUITAR_HI) {
        guitarSqSum += harmWideLin * harmWideLin;
        const sHarmLin = sLinSide * mHarm;
        sideGuitarSqSum += sHarmLin * sHarmLin;
        midGuitarSqSum += harmLin * harmLin;
      }

      // True Complex-Domain Phase Deviation: |X_t - M_{t-1} * exp(i * (2*phi_{t-1} - phi_{t-2}))|
      if (f >= 2 && k >= B0_LO && k <= B5_HI && mValMid > 0.06) {
        let dPhi = centerPhase[k] - 2 * prevPhase[k] + prevPhase2[k];
        dPhi -= Math.round(dPhi / PI2) * PI2;
        const absDev = Math.abs(dPhi) / Math.PI;
        phaseDevWeightedSum += mValMid * absDev;
        phaseMagSum += mValMid;

        const mPrev = prevMidMag[k];
        const complexSq = Math.max(0, mValMid * mValMid + mPrev * mPrev - 2 * mValMid * mPrev * Math.cos(dPhi));
        complexDevSum += Math.sqrt(complexSq);
      }
    }

    const sfOff = f * 6;
    subBandSuperFlux[sfOff] = sf0 / Math.max(1, B0_HI - B0_LO + 1);
    subBandSuperFlux[sfOff + 1] = sf1 / Math.max(1, B1_HI - B1_LO + 1);
    subBandSuperFlux[sfOff + 2] = sf2 / Math.max(1, B2_HI - B2_LO + 1);
    subBandSuperFlux[sfOff + 3] = sf3 / Math.max(1, B3_HI - B3_LO + 1);
    subBandSuperFlux[sfOff + 4] = sf4 / Math.max(1, B4_HI - B4_LO + 1);
    subBandSuperFlux[sfOff + 5] = sf5 / Math.max(1, B5_HI - B5_LO + 1);

    stemDrumsSq[f] = drumSqSum;
    stemBassSq[f] = bassSqSum;
    stemGuitarSq[f] = guitarSqSum;
    percMeanPower[f] = percPowerSum / Math.max(1, percBinCount);
    harmMeanPower[f] = harmPowerSum / Math.max(1, harmBinCount);
    subBassMeanPower[f] = subBassPowerSum / Math.max(1, subBassBinCount);
    midVocalMeanPower[f] = midVocalPowerSum / Math.max(1, midVocalBinCount);
    sideGuitarSq[f] = sideGuitarSqSum;
    midGuitarCenterSq[f] = midGuitarSqSum;

    const phaseDevNorm = phaseMagSum > 1e-5 ? phaseDevWeightedSum / phaseMagSum : 0;
    phaseDevFlux[f] = phaseDevNorm * Math.min(1.65, Math.sqrt(phaseMagSum * 0.04));
    complexDomainFlux[f] = complexDevSum / Math.max(1, B5_HI - B0_LO + 1);

    // ---- 1. stem_drums feature extraction (M_perc + SuperFlux) ----
    let kE = 0;
    let kPosFlux = 0;
    for (let k = KICK_LO; k <= KICK_HI; k += 1) {
      const pm = percMag[k];
      kE += pm;
      const prevMax = Math.max(
        prevPercMag[k > 0 ? k - 1 : 0],
        prevPercMag[k],
        prevPercMag[k + 1 < HALF_FFT ? k + 1 : HALF_FFT - 1]
      );
      const d = pm - prevMax;
      if (d > 0) kPosFlux += d;
    }
    const kBins = Math.max(1, KICK_HI - KICK_LO + 1);
    kE /= kBins;
    kickEnergy[f] = kE;
    kickFlux[f] = (kPosFlux / kBins) * 0.96 + Math.max(0, kE - prevKickE) * 1.28;
    prevKickE = kE;

    let sbE = 0;
    for (let k = SNARE_BODY_LO; k <= SNARE_BODY_HI; k += 1) sbE += percMag[k];
    sbE /= Math.max(1, SNARE_BODY_HI - SNARE_BODY_LO + 1);
    snareBodyEnergy[f] = sbE;

    let tomSum = 0;
    let tomPosFlux = 0;
    for (let k = TOM_LO; k <= TOM_HI; k += 1) {
      const pm = percMag[k];
      tomSum += pm;
      const prevMax = Math.max(prevPercMag[k - 1], prevPercMag[k], prevPercMag[k + 1]);
      const d = pm - prevMax;
      if (d > 0) tomPosFlux += d;
    }
    const tomBins = Math.max(1, TOM_HI - TOM_LO + 1);
    const tE = tomSum / tomBins;
    tomEnergy[f] = tE;
    tomFlux[f] = (tomPosFlux / tomBins) * 1.1 + Math.max(0, tE - prevTomE) * 1.2;
    prevTomE = tE;

    let snapSum = 0;
    let snapPosFlux = 0;
    let snapLogSum = 0;
    let snapBinCount = 0;
    let cymSum = 0;
    let cymPosFlux = 0;

    for (let k = SNAP_LO; k <= CYMBAL_HI; k += 1) {
      const m = percMag[k];
      const prevMax = Math.max(
        prevPercMag[k - 1],
        prevPercMag[k],
        prevPercMag[k + 1 < HALF_FFT ? k + 1 : HALF_FFT - 1]
      );
      const d = m - prevMax;
      if (k <= SNAP_HI) {
        snapSum += m;
        snapLogSum += Math.log(m + 1e-4);
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
    highFlatness[f] = Math.min(1, geomMean / Math.max(1e-4, sMean));

    const cymBins = Math.max(1, CYMBAL_HI - CYMBAL_LO + 1);
    const cMean = cymSum / cymBins;
    cymbalEnergy[f] = cMean;

    const sbRise = Math.max(0, sbE - prevSnareBodyE);
    const snapRise = Math.max(0, sMean - prevSnapE);
    const cymRise = Math.max(0, cMean - prevCymbalE);
    prevSnareBodyE = sbE;
    prevSnapE = sMean;
    prevCymbalE = cMean;

    const flatMult = highFlatness[f] >= 0.3 ? 1.32 : highFlatness[f] >= 0.18 ? 0.85 : 0.32;
    snareFlux[f] = (sbRise * 0.92 + snapRise * 1.44 + (snapPosFlux / Math.max(1, snapBinCount)) * 1.42) * flatMult;
    cymbalFlux[f] = (cymRise * 1.55 + (cymPosFlux / cymBins) * 1.45) * flatMult;

    // ---- 2. stem_bass feature extraction (Mid * M_harm < 240Hz, kick rejection) ----
    let bE = 0;
    let bFlux = 0;
    let bestBassBin = BASS_LO + 1;
    let bestBassVal = 0;
    for (let k = BASS_LO; k <= BASS_HI; k += 1) {
      const mHarmVal = centerMidMag[k] * (1 - maskPercQ[maskRowOffset + k] / 255);
      bE += mHarmVal;
      const prevMax = Math.max(
        prevHarmMag[k > 0 ? k - 1 : 0],
        prevHarmMag[k],
        prevHarmMag[k + 1 < HALF_FFT ? k + 1 : HALF_FFT - 1]
      );
      const d = mHarmVal - prevMax;
      if (d > 0) bFlux += d;
      if (k >= BASS_LO + 1 && mHarmVal > bestBassVal) {
        bestBassVal = mHarmVal;
        bestBassBin = k;
      }
    }
    const bBins = Math.max(1, BASS_HI - BASS_LO + 1);
    bE /= bBins;
    bassEnergy[f] = bE;
    bassFlux[f] = (bFlux / bBins) * 0.95 + Math.max(0, bE - prevBassE) * 1.35;
    prevBassE = bE;

    if (bestBassVal > 0.11 && bestBassBin > BASS_LO && bestBassBin < BASS_HI) {
      const y0 = centerMidMag[bestBassBin - 1];
      const y1 = centerMidMag[bestBassBin];
      const y2 = centerMidMag[bestBassBin + 1];
      const denom = y0 - 2 * y1 + y2;
      const delta = Math.abs(denom) > 1e-8 ? (0.5 * (y0 - y2)) / denom : 0;
      lastBassHz = Math.max(38, Math.min(225, (bestBassBin + Math.max(-0.5, Math.min(0.5, delta))) * binHz));
    }
    bassPeakHz[f] = lastBassHz;
    const bassSemitoneDelta = Math.abs(12 * Math.log2(Math.max(35, lastBassHz) / Math.max(35, prevBassHz)));
    bassRootChange[f] =
      bassSemitoneDelta >= 0.85 && bE > 0.12 ? Math.min(2.2, bassSemitoneDelta * 0.45 + bassFlux[f]) : 0;
    prevBassHz = lastBassHz;

    // ---- 3. stem_guitar (Full-Spectrum 180Hz-4.5kHz Harmonic + 1.2-5.5kHz Pluck/Strum Transients) ----
    let gSum = 0;
    let gHighSum = 0;
    let gFlux = 0;
    let gPluckFlux = 0;
    let top1 = 0;
    let top2 = 0;
    let top3 = 0;
    let bestCombScore = 0;
    let bestPitchBin = GUITAR_LO + 4;
    let weightedHz = 0;
    let weightedSum = 0;

    for (let k = GUITAR_LO; k <= GUITAR_PLUCK_HI; k += 1) {
      const m = harmMag[k];
      const mStereo = centerMidMag[k] + 0.65 * centerSideMag[k];
      const prevMax = Math.max(
        prevHarmMag[k >= 2 ? k - 2 : 0],
        prevHarmMag[k - 1],
        prevHarmMag[k],
        prevHarmMag[k + 1 < HALF_FFT ? k + 1 : HALF_FFT - 1],
        prevHarmMag[k + 2 < HALF_FFT ? k + 2 : HALF_FFT - 1]
      );
      const prevMidMax = Math.max(
        prevMidMag[k >= 1 ? k - 1 : 0],
        prevMidMag[k],
        prevMidMag[k + 1 < HALF_FFT ? k + 1 : HALF_FFT - 1]
      );

      if (k <= GUITAR_HI) {
        gSum += m;
        if (k >= GUITAR_SOLO_LO) gHighSum += m;
        const d = m - prevMax;
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

        if (k <= GUITAR_COMB_MAX_BIN) {
          const h2 = k * 2 < HALF_FFT ? harmMag[k * 2] : 0;
          const h3 = k * 3 < HALF_FFT ? harmMag[k * 3] : 0;
          const h4 = k * 4 < HALF_FFT ? harmMag[k * 4] : 0;
          const combScore = m + h2 * 0.62 + h3 * 0.38 + h4 * 0.22;
          if (combScore > bestCombScore) {
            bestCombScore = combScore;
            bestPitchBin = k;
          }
        }

        const w = m * m;
        weightedHz += w * (k * binHz);
        weightedSum += w;
      }

      // Upper-Mid Pluck/Strum Transient (1.2kHz - 5.5kHz) immune to vocal/drum masking
      if (k >= GUITAR_PLUCK_LO && k <= GUITAR_PLUCK_HI) {
        const mHarmFrac = 1 - (maskPercQ[maskRowOffset + k] / 255) * 0.45;
        const pDiff = (mStereo * mHarmFrac) - prevMidMax;
        if (pDiff > 0) gPluckFlux += pDiff;
      }
    }

    const gBins = Math.max(1, GUITAR_HI - GUITAR_LO + 1);
    const gPluckBins = Math.max(1, GUITAR_PLUCK_HI - GUITAR_PLUCK_LO + 1);
    const gMean = gSum / gBins;
    guitarEnergy[f] = gMean;
    guitarHighEnergy[f] = gHighSum / Math.max(1, GUITAR_HI - GUITAR_SOLO_LO + 1);

    const peakAvg = (top1 + top2 * 0.75 + top3 * 0.5) / 2.25;
    const hnr = peakAvg / Math.max(1e-4, gMean);
    guitarHnr[f] = hnr;
    const harmFluxNorm = (gFlux / gBins) * 1.48;
    const pluckFluxNorm = (gPluckFlux / gPluckBins) * 1.35;
    guitarPluckFlux[f] = pluckFluxNorm;
    guitarFlux[f] = harmFluxNorm + pluckFluxNorm * 0.92;
    guitarAttackRatio[f] = gFlux / Math.max(1e-6, gSum);

    {
      const f0Val = harmMag[bestPitchBin] || 0;
      const h2 = bestPitchBin * 2 < HALF_FFT ? harmMag[bestPitchBin * 2] : 0;
      const h3 = bestPitchBin * 3 < HALF_FFT ? harmMag[bestPitchBin * 3] : 0;
      const h4 = bestPitchBin * 4 < HALF_FFT ? harmMag[bestPitchBin * 4] : 0;
      const ovVal = h2 * 0.62 + h3 * 0.38 + h4 * 0.22;
      guitarOvertoneRatio[f] = ovVal / Math.max(1e-6, f0Val + ovVal);
    }

    if (bestCombScore > 0.15 && bestPitchBin > GUITAR_LO && bestPitchBin < GUITAR_COMB_MAX_BIN) {
      const y0 = harmMag[bestPitchBin - 1];
      const y1 = harmMag[bestPitchBin];
      const y2 = harmMag[bestPitchBin + 1];
      const denom = y0 - 2 * y1 + y2;
      const delta = Math.abs(denom) > 1e-8 ? (0.5 * (y0 - y2)) / denom : 0;
      const interpHz = (bestPitchBin + Math.max(-0.5, Math.min(0.5, delta))) * binHz;
      const centroidHz = weightedSum > 1e-8 ? weightedHz / weightedSum : interpHz;
      lastGuitarHz = Math.max(180, Math.min(3400, interpHz * 0.62 + centroidHz * 0.38));
    }
    guitarPitchHz[f] = lastGuitarHz;

    // ---- 4. stem_piano (110Hz-3.2kHz M_harm * transientAttackMask + 12-TET Chromagram) ----
    let pSum = 0;
    let pFlux = 0;
    let pHarmTotal = 0;
    let pianoSqSum = 0;
    let pWeightedHz = 0;
    let pWeightedSum = 0;
    const cOff = f * 12;
    for (let c = 0; c < 12; c += 1) chromaPeakScratch[c] = 0;

    for (let k = BASS_LO; k <= PIANO_HI; k += 1) {
      const mHarmFrac = 1 - maskPercQ[maskRowOffset + k] / 255;
      const mHarmOnly = centerMidMag[k] * mHarmFrac;
      const prevMax = Math.max(
        prevHarmMag[k > 0 ? k - 1 : 0],
        prevHarmMag[k],
        prevHarmMag[k + 1 < HALF_FFT ? k + 1 : HALF_FFT - 1]
      );
      const attackDelta = Math.max(0, harmMag[k] - prevMax);
      const attackMask = Math.min(1.0, 0.16 + (attackDelta / (harmMag[k] + 0.08)) * 0.84);
      const pVal = mHarmOnly * attackMask;

      const pc = binToChroma[k];
      if (pc >= 0) {
        chromaFrames[cOff + pc] += mHarmOnly * mHarmOnly;
        if (k >= PIANO_LO) {
          chromaPeakScratch[pc] += pVal * pVal;
        }
      }
      if (k >= PIANO_LO) {
        pSum += pVal;
        pFlux += attackDelta;
        pHarmTotal += harmMag[k];
        const linMidK = Math.expm1(centerMidMag[k]) * 0.001;
        const pLinVal = linMidK * mHarmFrac * attackMask;
        pianoSqSum += pLinVal * pLinVal;
        const w = pVal * pVal;
        pWeightedHz += w * (k * binHz);
        pWeightedSum += w;
      }
    }
    stemPianoSq[f] = pianoSqSum;
    pianoAttackRatio[f] = pFlux / Math.max(1e-6, pHarmTotal);

    let chromaNormSq = 0;
    for (let c = 0; c < 12; c += 1) {
      const v = chromaFrames[cOff + c];
      chromaNormSq += v * v;
    }
    if (chromaNormSq > 1e-10) {
      const invNorm = 1 / Math.sqrt(chromaNormSq);
      for (let c = 0; c < 12; c += 1) chromaFrames[cOff + c] *= invNorm;
    }

    let maxChroma = 0;
    for (let c = 0; c < 12; c += 1) {
      if (chromaPeakScratch[c] > maxChroma) maxChroma = chromaPeakScratch[c];
    }
    const chromaGate = Math.max(0.035, maxChroma * 0.28);
    let bestC0 = 0;
    let bestC1 = 0;
    let bestC2 = 0;
    let bestV0 = -1;
    let bestV1 = -1;
    let bestV2 = -1;
    let distinctChromaPeaks = 0;
    for (let c = 0; c < 12; c += 1) {
      const val = chromaPeakScratch[c];
      if (val >= chromaGate) {
        distinctChromaPeaks += 1;
        if (val > bestV0) {
          bestV2 = bestV1; bestC2 = bestC1;
          bestV1 = bestV0; bestC1 = bestC0;
          bestV0 = val; bestC0 = c;
        } else if (val > bestV1) {
          bestV2 = bestV1; bestC2 = bestC1;
          bestV1 = val; bestC1 = c;
        } else if (val > bestV2) {
          bestV2 = val; bestC2 = c;
        }
      }
    }
    pianoPeakCount[f] = Math.min(12, distinctChromaPeaks);
    const pChOff = f * 3;
    pianoChords[pChOff] = bestC0;
    pianoChords[pChOff + 1] = bestV1 >= chromaGate ? bestC1 : 255;
    pianoChords[pChOff + 2] = bestV2 >= chromaGate ? bestC2 : 255;

    const pBins = Math.max(1, PIANO_HI - PIANO_LO + 1);
    const pMean = pSum / pBins;
    pianoEnergy[f] = pMean;
    pianoFlux[f] = (pFlux / pBins) * 1.65;

    if (pWeightedSum > 1e-8 && pMean > 0.05) {
      lastPianoHz = Math.max(110, Math.min(3200, pWeightedHz / pWeightedSum));
    }
    pianoPitchHz[f] = lastPianoHz;

    const pOff = f * 6;
    bandProfiles[pOff] = kE;
    bandProfiles[pOff + 1] = bE;
    bandProfiles[pOff + 2] = sbE;
    bandProfiles[pOff + 3] = gMean;
    bandProfiles[pOff + 4] = guitarHighEnergy[f];
    bandProfiles[pOff + 5] = sMean + cMean;

    prevHarmMag.set(harmMag);
    prevPercMag.set(percMag);
    prevMidMag.set(centerMidMag);
    prevPhase2.set(prevPhase);
    prevPhase.set(centerPhase);

    if (f % progressStride1 === 0) {
      if (shouldCancel?.()) throw new Error('JOB_CANCELLED');
      const s1Pct = Math.min(99, Math.round((f / numFrames) * 100));
      emitProgress(
        1,
        s1Pct,
        0.04 + (f / numFrames) * 0.34,
        `Stage 1/5: 5.8ms SuperFlux & Stereo HPSS Analysis (${s1Pct}%)...`
      );
    }
    if (f % 512 === 511) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  emitProgress(1, 100, 0.38, 'Stage 1/5: 5.8ms SuperFlux & Stereo HPSS Analysis (100%)...');
  if (shouldCancel?.()) throw new Error('JOB_CANCELLED');

  // =========================================================================
  // STAGE 2/5: Local Adaptive Floors, Strict -38 dBFS Stem Gates & OLA iSTFT
  // =========================================================================
  emitProgress(2, 2, 0.39, 'Stage 2/5: Separating Isolated 4-Stem Audio (2%)...');

  const { localPeak: localRmsPeak } = computeSlidingRmsPeakAndMean(rmsAll, 1.5, hopSec);
  const guitarNormFlux = pool.guitarNormFlux.subarray(0, numFrames);
  const bassNormFlux = pool.bassNormFlux.subarray(0, numFrames);
  const pianoNormFlux = pool.pianoNormFlux.subarray(0, numFrames);
  const kickNormFlux = pool.kickNormFlux.subarray(0, numFrames);
  const snareNormFlux = pool.snareNormFlux.subarray(0, numFrames);
  const tomNormFlux = pool.tomNormFlux.subarray(0, numFrames);
  const cymbalNormFlux = pool.cymbalNormFlux.subarray(0, numFrames);

  for (let f = 0; f < numFrames; f += 1) {
    const agcDenom = Math.max(localRmsPeak[f], AGC_NOISE_FLOOR);
    const sfOff = f * 6;
    const subBoost =
      1 +
      Math.min(0.4, (subBandSuperFlux[sfOff] + subBandSuperFlux[sfOff + 1] + subBandSuperFlux[sfOff + 2] + subBandSuperFlux[sfOff + 3] + subBandSuperFlux[sfOff + 4] + subBandSuperFlux[sfOff + 5]) * 0.12);
    guitarNormFlux[f] = (guitarFlux[f] * subBoost + guitarPluckFlux[f] * 0.5) / agcDenom;
    bassNormFlux[f] = bassFlux[f] / agcDenom;
    pianoNormFlux[f] = pianoFlux[f] / agcDenom;
    kickNormFlux[f] = (kickFlux[f] + subBandSuperFlux[sfOff] * 0.28) / agcDenom;
    snareNormFlux[f] = (snareFlux[f] + subBandSuperFlux[sfOff + 2] * 0.22 + subBandSuperFlux[sfOff + 4] * 0.22) / agcDenom;
    tomNormFlux[f] = tomFlux[f] / agcDenom;
    cymbalNormFlux[f] = (cymbalFlux[f] + subBandSuperFlux[sfOff + 5] * 0.28) / agcDenom;
  }

  const guitarFloors = computeLocalRollingFloors(guitarEnergy, 1.2, hopSec, 0);
  const guitarFluxFloors = computeLocalRollingFloors(guitarNormFlux, 1.2, hopSec, 1);
  const pianoFloors = computeLocalRollingFloors(pianoEnergy, 1.5, hopSec, 2);
  const pianoFluxFloors = computeLocalRollingFloors(pianoNormFlux, 1.5, hopSec, 3);
  const bassFloors = computeLocalRollingFloors(bassEnergy, 1.5, hopSec, 4);
  const bassFluxFloors = computeLocalRollingFloors(bassNormFlux, 1.5, hopSec, 5);
  const kickFloors = computeLocalRollingFloors(kickNormFlux, 1.5, hopSec, 6);
  const snareFloors = computeLocalRollingFloors(snareNormFlux, 1.5, hopSec, 7);
  const tomFloors = computeLocalRollingFloors(tomNormFlux, 1.5, hopSec, 8);
  const cymbalFloors = computeLocalRollingFloors(cymbalNormFlux, 1.5, hopSec, 9);
  const localOverallEnergy = computeRollingMean(
    rmsAll,
    Math.max(40, Math.round(1.0 / hopSec)),
    pool.localOverallEnergy.subarray(0, numFrames)
  );

  const sortedRms = pool.sortedRms.subarray(0, numFrames);
  sortedRms.set(localOverallEnergy);
  sortedRms.sort();
  const chorusEnergyFloor = sortedRms[Math.floor(sortedRms.length * 0.72)] || 0.08;
  const globalMedianRms = sortedRms[Math.floor(sortedRms.length * 0.5)] || 0.05;

  let peakRms = 0;
  for (let f = 0; f < numFrames; f += 1) {
    if (rmsAll[f] > peakRms) peakRms = rmsAll[f];
  }
  const melodicSilenceRmsFloor = Math.min(ACTIVE_RMS_FLOOR_NEG42DB, Math.max(0.0005, peakRms * 0.012));
  const bassSilenceRmsFloor = Math.min(ACTIVE_RMS_FLOOR_NEG42DB, Math.max(0.0007, peakRms * 0.016));
  const drumSilenceRmsFloor = Math.min(ACTIVE_RMS_FLOOR_NEG42DB, Math.max(0.001, peakRms * 0.02));

  // Strict Dual-Threshold Per-Stem 150ms Sliding Window RMS (>= max(-38 dBFS, 0.18 * stemPeakRMS))
  const halfWin150 = Math.max(3, Math.round(0.075 / hopSec));
  const computeStemRms150 = (sqArr, outArr) => {
    const meanSq = computeRollingMean(sqArr, halfWin150);
    let peak = 0;
    for (let f = 0; f < numFrames; f += 1) {
      const r = Math.sqrt(Math.max(0, meanSq[f] * 1.3333333));
      outArr[f] = r;
      if (r > peak) peak = r;
    }
    return peak;
  };
  const drumsPeakRMS = computeStemRms150(stemDrumsSq, stemDrumsRms150);
  const bassPeakRMS = computeStemRms150(stemBassSq, stemBassRms150);
  const guitarPeakRMS = computeStemRms150(stemGuitarSq, stemGuitarRms150);
  const pianoPeakRMS = computeStemRms150(stemPianoSq, stemPianoRms150);

  const drumsStemGateFloor = Math.max(STRICT_STEM_GATE_RMS_FLOOR, drumsPeakRMS * 0.18);
  const bassStemGateFloor = Math.max(STRICT_STEM_GATE_RMS_FLOOR, bassPeakRMS * 0.18);
  const guitarStemGateFloor = Math.max(STRICT_STEM_GATE_RMS_FLOOR, guitarPeakRMS * 0.18);
  const pianoStemGateFloor = Math.max(STRICT_STEM_GATE_RMS_FLOOR, pianoPeakRMS * 0.18);

  // Drum candidate extraction (gated by -38 dBFS, 18% peak RMS, crest factor, and percussive dominance)
  const rawPercHit = pool.rawPercHit.subarray(0, numFrames);
  rawPercHit.fill(0);
  const rawKickCandidates = [];
  const rawSnareCandidates = [];
  const rawTomCandidates = [];
  const rawHatCandidates = [];
  const rawCrashCandidates = [];

  const kickMeanSlow = computeRollingMean(kickEnergy, Math.round(0.42 / hopSec), pool.kickMeanSlow.subarray(0, numFrames));
  const snapMeanSlow = computeRollingMean(snapEnergy, Math.round(0.38 / hopSec), pool.snapMeanSlow.subarray(0, numFrames));
  const tomMeanSlow = computeRollingMean(tomEnergy, Math.round(0.38 / hopSec), pool.tomMeanSlow.subarray(0, numFrames));

  for (let f = 2; f < numFrames - 2; f += 1) {
    const t = (f * HOP_SIZE + HALF_FFT) / safeSampleRate;
    if (t < 0.03 || t > actualDuration - 0.06 || rmsAll[f] < drumSilenceRmsFloor) continue;

    const crestFactor = framePeakAbs[f] / Math.max(1e-6, rmsAll[f]);
    const percDominanceRatio = percMeanPower[f] / (harmMeanPower[f] + 1e-9);
    if (
      stemDrumsRms150[f] < drumsStemGateFloor ||
      crestFactor < 1.38 ||
      percDominanceRatio < 0.18
    ) {
      continue;
    }

    const gE = guitarEnergy[f];
    const hnr = guitarHnr[f];
    const flat = highFlatness[f];
    const kE = kickEnergy[f];
    const sE = snapEnergy[f];
    const tE = tomEnergy[f];
    const agcBoost = Math.min(8.0, Math.max(1.0, chorusEnergyFloor / Math.max(localRmsPeak[f], 0.004)));
    const isActiveQuiet = rmsAll[f] >= ACTIVE_RMS_FLOOR_NEG42DB && localOverallEnergy[f] < chorusEnergyFloor * 0.72;

    const isPureTonal =
      hnr > 3.6 &&
      flat < 0.2 &&
      kE < 0.16 / agcBoost &&
      sE < 0.06 / agcBoost;
    if (isPureTonal) continue;

    const kf = kickNormFlux[f];
    const kickCrest = kE / Math.max(0.02, kickMeanSlow[f]);
    const kickThresh = Math.max(0.05, kickFloors.median[f] * 1.85 + kickFloors.floor[f] * 0.65 + 0.025);
    const isKickPeak =
      kf >= kickNormFlux[f - 1] &&
      kf > kickNormFlux[f + 1] &&
      kf >= kickThresh &&
      kE * agcBoost >= 0.11 &&
      kickCrest >= (isActiveQuiet ? 1.12 : 1.18);

    if (isKickPeak) {
      rawPercHit[f] = 1;
      rawKickCandidates.push({ time: t, frame: f, strength: kf / Math.max(0.01, kickThresh), energy: kE });
    }

    const sf = snareNormFlux[f];
    const snapCrest = sE / Math.max(0.01, snapMeanSlow[f]);
    const snareThresh = Math.max(0.045, snareFloors.median[f] * 2.0 + snareFloors.floor[f] * 0.75 + 0.022);
    const isSnarePeak =
      sf >= snareNormFlux[f - 1] &&
      sf > snareNormFlux[f + 1] &&
      sf >= snareThresh &&
      flat >= (isActiveQuiet ? 0.22 : 0.27) &&
      snapCrest >= (isActiveQuiet ? 1.14 : 1.2) &&
      snareBodyEnergy[f] * agcBoost >= 0.075 &&
      sE * agcBoost >= 0.038;

    if (isSnarePeak) {
      rawPercHit[f] = 1;
      rawSnareCandidates.push({
        time: t,
        frame: f,
        strength: sf / Math.max(0.01, snareThresh),
        energy: sE + snareBodyEnergy[f],
      });
    }

    const tf = tomNormFlux[f];
    const tomCrest = tE / Math.max(0.02, tomMeanSlow[f]);
    const tomThresh = Math.max(0.065, tomFloors.median[f] * 2.15 + tomFloors.floor[f] * 0.8 + 0.032);
    if (
      !isSnarePeak &&
      flat >= 0.16 &&
      hnr < 2.35 &&
      tf >= tomNormFlux[f - 1] &&
      tf > tomNormFlux[f + 1] &&
      tf >= tomThresh &&
      tomCrest >= 1.28 &&
      tE * agcBoost >= 0.26 &&
      tE >= gE * 1.05
    ) {
      rawPercHit[f] = 1;
      rawTomCandidates.push({ time: t, frame: f, strength: tf / Math.max(0.01, tomThresh), energy: tE });
    }

    const cf = cymbalNormFlux[f];
    const cymThresh = Math.max(0.035, cymbalFloors.median[f] * 1.85 + cymbalFloors.floor[f] * 0.65 + 0.018);
    if (
      cf >= cymbalNormFlux[f - 1] &&
      cf > cymbalNormFlux[f + 1] &&
      cf >= cymThresh &&
      flat >= (isActiveQuiet ? 0.24 : 0.29) &&
      cymbalEnergy[f] * agcBoost >= 0.024
    ) {
      rawPercHit[f] = 1;
      const isCrash =
        cymbalEnergy[f] * agcBoost >= Math.max(0.11, cymbalFloors.median[f] * localRmsPeak[f] * 2.1) &&
        (localOverallEnergy[f] >= chorusEnergyFloor * 0.78 || isKickPeak || isSnarePeak);
      if (isCrash) {
        rawCrashCandidates.push({ time: t, frame: f, strength: cf / Math.max(0.01, cymThresh), energy: cymbalEnergy[f] });
      } else {
        rawHatCandidates.push({ time: t, frame: f, strength: cf / Math.max(0.01, cymThresh), energy: cymbalEnergy[f] });
      }
    }
  }

  const percDensity = pool.percDensity.subarray(0, numFrames);
  const percPrefix = pool.percPrefix.subarray(0, numFrames + 1);
  percPrefix[0] = 0;
  for (let i = 0; i < numFrames; i += 1) {
    percPrefix[i + 1] = percPrefix[i] + rawPercHit[i];
  }
  const densHalf = Math.round(0.65 / hopSec);
  const aheadFrames = Math.round(0.95 / hopSec);
  for (let f = 0; f < numFrames; f += 1) {
    const lo = Math.max(0, f - densHalf);
    const hi = Math.min(numFrames, f + densHalf + 1);
    const hitsInWindow = percPrefix[hi] - percPrefix[lo];
    const aheadHits = percPrefix[Math.min(numFrames, f + aheadFrames)] - percPrefix[f];
    const minHitsReq = rmsAll[f] >= ACTIVE_RMS_FLOOR_NEG42DB ? 2 : 3;
    const hasDrumPresence =
      hitsInWindow >= minHitsReq ||
      (aheadHits >= minHitsReq && rawPercHit[f] === 1) ||
      (hitsInWindow >= 1 &&
        kickEnergy[f] >= 0.22 &&
        rmsAll[f] >= Math.max(ACTIVE_RMS_FLOOR_NEG42DB, globalMedianRms * 0.35));
    percDensity[f] = hasDrumPresence ? 1 : 0;
  }

  const drumActiveFrame = pool.drumActiveFrame.subarray(0, numFrames);
  drumActiveFrame.set(percDensity);
  {
    const minRun = Math.round(0.25 / hopSec);
    const maxGap = Math.round(0.55 / hopSec);
    let run = 0;
    for (let f = 0; f < numFrames; f += 1) {
      if (drumActiveFrame[f] === 1) run += 1;
      else {
        if (run > 0 && run < minRun) {
          for (let k = f - run; k < f; k += 1) drumActiveFrame[k] = 0;
        }
        run = 0;
      }
    }
    let gap = 0;
    let seenOn = false;
    for (let f = 0; f < numFrames; f += 1) {
      if (drumActiveFrame[f] === 1) {
        if (seenOn && gap > 0 && gap <= maxGap) {
          for (let k = f - gap; k < f; k += 1) drumActiveFrame[k] = 1;
        }
        seenOn = true;
        gap = 0;
      } else if (seenOn) {
        gap += 1;
      }
    }
  }

  // OLA Inverse-STFT Reconstruction of 4 Dedicated Isolated 22.05kHz Stem Buffers
  let separatedStems = null;
  if (synthesizeStemAudio) {
    const stemDrumsPcm = new Float32Array(totalSamples);
    const stemBassPcm = new Float32Array(totalSamples);
    const stemGuitarPcm = new Float32Array(totalSamples);
    const stemPianoPcm = new Float32Array(totalSamples);

    const invN = 1 / FFT_SIZE;
    const scaleNorm = invN / COLA_NORM_STEADY;
    const progressStride2 = Math.max(256, Math.floor(numFrames / 18));

    const bassEndBin = Math.min(HALF_FFT - 1, Math.round(250 / binHz));
    const guitarStartBin = Math.max(1, Math.round(210 / binHz));
    const guitarEndBin = Math.min(HALF_FFT - 1, Math.round(4700 / binHz));
    const pianoStartBin = Math.max(1, Math.round(105 / binHz));
    const pianoEndBin = Math.min(HALF_FFT - 1, Math.round(3400 / binHz));
    const prevMidAmp = new Float32Array(HALF_FFT);

    for (let f = 0; f < numFrames; f += 1) {
      const base = f * HOP_SIZE;
      computeStereoMidSideSpectrum(leftPcm, rightPcm, base, totalSamples);
      const mOff = f * HALF_FFT;
      const drumGate = drumActiveFrame[f] === 1 ? 1.0 : 0.12;

      guitarCombWeights.fill(0.45);
      for (let k = guitarStartBin; k <= Math.min(guitarEndBin, GUITAR_COMB_MAX_BIN); k += 1) {
        const mr = midReBuf[k] + 0.65 * sideReBuf[k];
        const mi = midImBuf[k] + 0.65 * sideImBuf[k];
        const amp = Math.sqrt(mr * mr + mi * mi);
        if (amp > 0.01) {
          const w = Math.min(1.0, 0.55 + amp * 0.08);
          guitarCombWeights[k] = Math.max(guitarCombWeights[k], w);
          if (k * 2 < HALF_FFT) guitarCombWeights[k * 2] = Math.max(guitarCombWeights[k * 2], w);
          if (k * 3 < HALF_FFT) guitarCombWeights[k * 3] = Math.max(guitarCombWeights[k * 3], w * 0.92);
          if (k * 4 < HALF_FFT) guitarCombWeights[k * 4] = Math.max(guitarCombWeights[k * 4], w * 0.84);
        }
      }

      ifftReA.fill(0);
      ifftImA.fill(0);
      ifftReB.fill(0);
      ifftImB.fill(0);

      for (let k = 1; k < HALF_FFT; k += 1) {
        const mPerc = maskPercQ[mOff + k] / 255;
        const mHarm = 1 - mPerc;
        const mr = midReBuf[k];
        const mi = midImBuf[k];
        const amp = Math.sqrt(mr * mr + mi * mi);

        const dInBand =
          (k >= KICK_LO && k <= KICK_HI) ||
          (k >= SNARE_BODY_LO && k <= TOM_HI) ||
          (k >= SNAP_LO && k <= CYMBAL_HI)
            ? 1.0
            : 0.25;
        const dGain = mPerc * dInBand * drumGate;
        ifftReA[k] = mr * dGain;
        ifftImA[k] = mi * dGain;

        if (k <= bassEndBin) {
          const lpFade = k <= BASS_HI ? 1.0 : Math.max(0, 1 - (k - BASS_HI) / Math.max(1, bassEndBin - BASS_HI));
          const kickSuppr = k <= KICK_HI ? 1 - mPerc * 0.65 : 1.0;
          const bGain = mHarm * lpFade * kickSuppr;
          ifftReB[k] = mr * bGain;
          ifftImB[k] = mi * bGain;
        }

        const rise = Math.max(0, amp - prevMidAmp[k]);
        prevMidAmp[k] = amp * 0.72 + prevMidAmp[k] * 0.28;
        pianoTransientBuf[k] = Math.min(1.0, 0.22 + (rise / (amp + 0.05)) * 0.78);
      }

      runPairedRealIfft(fftRe, fftIm);
      for (let i = 0; i < FFT_SIZE; i += 1) {
        const idx = base + i;
        if (idx >= totalSamples) break;
        const synW = HANN[i] * scaleNorm;
        stemDrumsPcm[idx] += fftRe[i] * synW;
        stemBassPcm[idx] += -fftIm[i] * synW;
      }

      ifftReA.fill(0);
      ifftImA.fill(0);
      ifftReB.fill(0);
      ifftImB.fill(0);

      for (let k = pianoStartBin; k <= guitarEndBin; k += 1) {
        const mPerc = maskPercQ[mOff + k] / 255;
        const mHarm = 1 - mPerc;
        const mr = midReBuf[k];
        const mi = midImBuf[k];
        const wideRe = mr + 0.65 * sideReBuf[k];
        const wideIm = mi + 0.65 * sideImBuf[k];

        if (k >= guitarStartBin && k <= guitarEndBin) {
          const gGain = mHarm * guitarCombWeights[k];
          ifftReA[k] = wideRe * gGain;
          ifftImA[k] = wideIm * gGain;
        }
        if (k >= pianoStartBin && k <= pianoEndBin) {
          const pGain = mHarm * pianoTransientBuf[k];
          ifftReB[k] = mr * pGain;
          ifftImB[k] = mi * pGain;
        }
      }

      runPairedRealIfft(fftRe, fftIm);
      for (let i = 0; i < FFT_SIZE; i += 1) {
        const idx = base + i;
        if (idx >= totalSamples) break;
        const synW = HANN[i] * scaleNorm;
        stemGuitarPcm[idx] += fftRe[i] * synW;
        stemPianoPcm[idx] += -fftIm[i] * synW;
      }

      if (f % progressStride2 === 0) {
        if (shouldCancel?.()) throw new Error('JOB_CANCELLED');
        const s2Pct = Math.min(99, Math.round((f / numFrames) * 100));
        emitProgress(
          2,
          s2Pct,
          0.39 + (f / numFrames) * 0.34,
          `Stage 2/5: Separating Isolated 4-Stem Audio (${s2Pct}%)...`
        );
      }
      if (f % 512 === 511) {
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    const sanitizeStem = (buf) => {
      for (let i = 0; i < buf.length; i += 1) {
        const v = buf[i];
        if (!Number.isFinite(v)) buf[i] = 0;
        else if (v > 0.98) buf[i] = 0.98;
        else if (v < -0.98) buf[i] = -0.98;
      }
    };
    sanitizeStem(stemDrumsPcm);
    sanitizeStem(stemBassPcm);
    sanitizeStem(stemGuitarPcm);
    sanitizeStem(stemPianoPcm);

    separatedStems = {
      sampleRate: safeSampleRate,
      drums: stemDrumsPcm,
      bass: stemBassPcm,
      guitar: stemGuitarPcm,
      piano: stemPianoPcm,
    };
  }

  const drumsMonoRef = separatedStems ? separatedStems.drums : leftPcm;
  const refineCandidateSamples = (list, refPcm) => {
    for (let i = 0; i < list.length; i += 1) {
      const ev = list[i];
      const onsetSample = findStemOnsetSample(refPcm, leftPcm, ev.frame, HOP_SIZE, FFT_SIZE, totalSamples);
      ev.peakSample = onsetSample;
      ev.time = Number((onsetSample / safeSampleRate).toFixed(4));
    }
  };
  refineCandidateSamples(rawKickCandidates, drumsMonoRef);
  refineCandidateSamples(rawSnareCandidates, drumsMonoRef);
  refineCandidateSamples(rawTomCandidates, drumsMonoRef);
  refineCandidateSamples(rawHatCandidates, drumsMonoRef);
  refineCandidateSamples(rawCrashCandidates, drumsMonoRef);

  emitProgress(2, 100, 0.73, 'Stage 2/5: Separating Isolated 4-Stem Audio (100%)...');
  if (shouldCancel?.()) throw new Error('JOB_CANCELLED');

  // =========================================================================
  // STAGE 3/5: Resonator Comb-Filter Tempogram (65–195 BPM @ 0.025 BPM) + Viterbi DP
  // + First-Onset Sample Anchoring (-38 dBFS) -> 192 PPQ [SyncTrack]
  // =========================================================================
  emitProgress(3, 5, 0.74, 'Stage 3/5: Comb-Filter Tempogram & Viterbi DP Sync (5%)...');

  for (let f = 0; f < numFrames; f += 1) {
    const phaseBoost = 0.82 + Math.min(0.88, phaseDevFlux[f] * 0.9 + complexDomainFlux[f] * 0.45);
    const drumHasActivity = drumActiveFrame[f] === 1;
    if (drumHasActivity) {
      stemLockedFlux[f] =
        (kickFlux[f] * 1.38 + snareFlux[f] * 1.25 + tomFlux[f] * 0.55 + bassFlux[f] * 0.78 + bassRootChange[f] * 0.5) *
        phaseBoost;
    } else {
      stemLockedFlux[f] =
        (bassFlux[f] * 1.15 + bassRootChange[f] * 0.85 + pianoFlux[f] * 0.55 + guitarFlux[f] * 0.45) * phaseBoost;
    }
  }

  let peakFlux = 0;
  for (let f = 0; f < numFrames; f += 1) {
    if (stemLockedFlux[f] > peakFlux) peakFlux = stemLockedFlux[f];
  }

  // First-Onset Sample Anchor: locate exact sample where true audio crosses -38 dBFS (or active track peak * 5%)
  const firstRmsGate = Math.max(Math.min(STRICT_STEM_GATE_RMS_FLOOR, Math.max(0.004, peakRms * 0.05)), 0.004);
  const fluxGate = Math.max(0.012, peakFlux * 0.065);
  let firstOnsetSample = 0;
  let firstTransientSec = 0;
  const maxScanFrames = Math.min(numFrames - 1, Math.round(25 / hopSec));

  for (let f = 1; f < maxScanFrames; f += 1) {
    const activeFrame =
      rmsAll[f] >= firstRmsGate &&
      (stemLockedFlux[f] >= fluxGate || complexDomainFlux[f] >= 0.015 || rmsAll[f] >= STRICT_STEM_GATE_RMS_FLOOR * 1.2);
    if (activeFrame) {
      const firstRef = separatedStems
        ? (drumActiveFrame[f] === 1
            ? separatedStems.drums
            : bassEnergy[f] > guitarEnergy[f] * 1.25
              ? separatedStems.bass
              : separatedStems.guitar)
        : leftPcm;
      firstOnsetSample = findStemOnsetSample(firstRef, leftPcm, f, HOP_SIZE, FFT_SIZE, totalSamples);
      firstTransientSec = Number((firstOnsetSample / safeSampleRate).toFixed(4));
      break;
    }
  }

  const tempo = estimateTempoAndPhase(stemLockedFlux, hopSec, bpmHint);
  let { bpm, beatSec, beatPhaseSec } = tempo;

  emitProgress(3, 45, 0.79, 'Stage 3/5: Solving 4-Phase Chromagram Downbeats (45%)...');

  const dpBeats = trackStemLockedDynamicBeats(
    stemLockedFlux,
    kickFlux,
    bassRootChange,
    snareFlux,
    hopSec,
    bpm,
    actualDuration,
    chromaFrames
  );
  const analysisEngine = 'cpu-dsp-4stem-hpss-192ppq';

  emitProgress(4, 50, 0.84, 'Stage 4/5: Locking 4-Bar Downbeats & Multi-Point [SyncTrack]...');

  // Build Multi-Anchor Per-Measure (768-tick) [SyncTrack]:
  // 1. Lock Tick 0 strictly to firstBeatSec (first verified percussive/harmonic downbeat, never 0.000s silence).
  // 2. Emit micro-corrected 192 PPQ tempo anchors every 768 ticks (1 measure) by cross-correlating the
  //    Kick (40–120Hz) + Snare (180–500Hz + 2.5–6kHz) onset envelope inside each 4-bar window,
  //    clamping local tempo adjustments smoothly to ±2.5% around the anchor BPM.
  const syncTrack = [];
  let firstBeatSec = firstTransientSec;
  {
    const beatList = dpBeats.beats || [];
    const beatGridRaw = dpBeats.dynamicBeatGrid || [];
    const anchorBpm = Math.max(60, Math.min(205, bpm || 120));
    const anchorBeatSec = 60 / anchorBpm;
    const minClampedBpm = Math.max(55, anchorBpm * 0.975);
    const maxClampedBpm = Math.min(220, anchorBpm * 1.025);
    const frameTimeSecLocal = (f) => (f * HOP_SIZE + HALF_FFT) / safeSampleRate;
    const secToFrameLocal = (sec) =>
      Math.max(0, Math.min(numFrames - 1, Math.round((sec * safeSampleRate - HALF_FFT) / HOP_SIZE)));

    let anchorSec = Math.max(0, firstTransientSec);
    if (beatList.length >= 2) {
      // Locate first beat aligned with or immediately after verified active audio entry
      let firstBeatIdx = 0;
      const minActiveBeatSec = Math.max(0, firstTransientSec - anchorBeatSec * 0.3);
      for (let i = 0; i < beatList.length; i += 1) {
        if (beatList[i] >= minActiveBeatSec) {
          firstBeatIdx = i;
          break;
        }
      }

      // Pick the first verified downbeat (isMeasure) within 4 beats of musical entry so Tick 0 is Beat 1
      let firstDownbeatIdx = firstBeatIdx;
      for (let i = firstBeatIdx; i < Math.min(beatList.length, firstBeatIdx + 4); i += 1) {
        if (beatGridRaw[i]?.isMeasure) {
          const fChk = secToFrameLocal(beatList[i]);
          if (rmsAll[fChk] >= firstRmsGate * 0.65 || stemLockedFlux[fChk] >= fluxGate * 0.5) {
            firstDownbeatIdx = i;
            break;
          }
        }
      }

      anchorSec = Number(beatList[firstDownbeatIdx].toFixed(4));
      const barDur = anchorBeatSec * 4;
      // Only step back by a full measure if verified active musical audio actually exists there (never 0.000s silence)
      while (anchorSec - barDur >= Math.max(0.02, firstTransientSec - anchorBeatSec * 0.35)) {
        const prevBarSec = anchorSec - barDur;
        const fPrev = secToFrameLocal(prevBarSec);
        if (rmsAll[fPrev] >= firstRmsGate * 0.85) {
          anchorSec = Number(prevBarSec.toFixed(4));
        } else {
          break;
        }
      }
      if (firstTransientSec >= 0.04) {
        anchorSec = Math.max(Number(Math.max(0.02, firstTransientSec - anchorBeatSec * 0.25).toFixed(4)), anchorSec);
      } else {
        anchorSec = Math.max(0, anchorSec);
      }

      // Micro-refine firstBeatSec within ±32ms onto exact Kick+Snare/Harmonic attack peak
      const centerF0 = secToFrameLocal(anchorSec);
      const refineHalf = Math.max(2, Math.round(0.032 / hopSec));
      const fLo0 = Math.max(0, centerF0 - refineHalf);
      const fHi0 = Math.min(numFrames - 1, centerF0 + refineHalf);
      let bestF0 = centerF0;
      let bestScore0 = -1;
      for (let f = fLo0; f <= fHi0; f += 1) {
        const distPenalty = 1 - (Math.abs(f - centerF0) / (refineHalf + 2)) * 0.28;
        const s0 =
          (kickFlux[f] * 1.5 + snareFlux[f] * 1.2 + stemLockedFlux[f] * 0.85 + complexDomainFlux[f] * 0.4) *
          distPenalty;
        if (s0 > bestScore0) {
          bestScore0 = s0;
          bestF0 = f;
        }
      }
      if (bestScore0 > 0.02) {
        anchorSec = Math.max(0, Number(frameTimeSecLocal(bestF0).toFixed(4)));
      }
    }

    firstBeatSec = anchorSec;

    // Cross-correlate Kick (40–120Hz) + Snare (180–500Hz + 2.5–6kHz) onset envelope inside 4-bar windows
    const maxLagFrames = Math.max(4, Math.round(0.058 / hopSec)); // ±58ms sweep
    const evalKickSnareAt = (sec) => {
      const f = secToFrameLocal(sec);
      if (f <= 0 || f >= numFrames - 1) return { kick: 0, snare: 0, all: 0, drumOn: 0 };
      const k = Math.max(kickFlux[f - 1] * 0.65, kickFlux[f], kickFlux[f + 1] * 0.65);
      const s = Math.max(snareFlux[f - 1] * 0.65, snareFlux[f], snareFlux[f + 1] * 0.65);
      const a = Math.max(stemLockedFlux[f - 1] * 0.65, stemLockedFlux[f], stemLockedFlux[f + 1] * 0.65);
      return { kick: k, snare: s, all: a, drumOn: drumActiveFrame[f] };
    };

    // Walk measure-by-measure (every 768 ticks) emitting continuous micro-corrected [SyncTrack] anchors
    let curTick = 0;
    let curTime = firstBeatSec;
    let runningBpm = anchorBpm;
    const maxMeasures = 1200;

    for (let m = 0; m < maxMeasures; m += 1) {
      if (curTime > actualDuration + 0.05 && m > 0) break;

      const curBeatSec = 60 / runningBpm;
      const curBarSec = curBeatSec * 4;

      // Cross-correlate Kick + Snare onset envelope against 192 PPQ grid inside a 4-bar window
      // spanning bars -1, 0, +1, +2 around the current measure
      let bestLagFrames = 0;
      let bestCorr = -1;
      let zeroLagCorr = 0;

      for (let lag = -maxLagFrames; lag <= maxLagFrames; lag += 1) {
        const lagSec = lag * hopSec;
        const prior = Math.exp(-0.5 * (lag / (maxLagFrames * 0.65)) * (lag / (maxLagFrames * 0.65)));
        let corrSum = 0;
        let activeSamples = 0;

        for (let bOff = -4; bOff < 12; bOff += 1) {
          const tBeat = curTime + bOff * curBeatSec + lagSec;
          if (tBeat < 0.02 || tBeat >= actualDuration - 0.04) continue;
          const beatInBar = ((bOff % 4) + 4) % 4;
          const barWeight = bOff >= 0 && bOff < 8 ? 1.2 : 0.72;
          const ev = evalKickSnareAt(tBeat);

          // Beat 1 & 3 favor Kick (40–120Hz); Beat 2 & 4 favor Snare (180–500Hz + 2.5–6kHz)
          const pulseVal = ev.drumOn
            ? beatInBar === 0
              ? ev.kick * 1.85 + ev.snare * 0.55 + ev.all * 0.35
              : beatInBar === 2
                ? ev.kick * 1.45 + ev.snare * 0.85 + ev.all * 0.35
                : ev.snare * 1.75 + ev.kick * 0.55 + ev.all * 0.35
            : ev.all * 1.15;

          corrSum += pulseVal * barWeight;
          if (pulseVal > 0.015) activeSamples += 1;

          // Include subtle 1/8-note off-beat reinforcement for syncopated grooves
          const tEighth = tBeat + curBeatSec * 0.5;
          if (tEighth < actualDuration - 0.04) {
            const ev8 = evalKickSnareAt(tEighth);
            corrSum += (ev8.drumOn ? (ev8.kick + ev8.snare) * 0.22 : ev8.all * 0.16) * barWeight;
          }
        }

        const weightedCorr = activeSamples >= 2 ? corrSum * (0.82 + 0.18 * prior) : 0;
        if (lag === 0) zeroLagCorr = weightedCorr;
        if (weightedCorr > bestCorr) {
          bestCorr = weightedCorr;
          bestLagFrames = lag;
        }
      }

      // Compute confidence-weighted phase correction for this measure
      let lagSecApplied = 0;
      if (bestCorr > zeroLagCorr * 1.04 + 0.015) {
        const gainRatio = Math.min(1, (bestCorr - zeroLagCorr) / Math.max(0.08, bestCorr));
        lagSecApplied = bestLagFrames * hopSec * (0.28 + 0.24 * gainRatio);
      }

      // Gentle pull toward DP beat spacing if a nearby DP beat exists, still strictly clamped to ±2.5%
      let targetBarSec = curBarSec + lagSecApplied;
      if (beatList.length >= 8) {
        let idxA = -1;
        let minDiffA = 0.14;
        for (let i = 0; i < beatList.length; i += 1) {
          const d = Math.abs(beatList[i] - curTime);
          if (d < minDiffA) {
            minDiffA = d;
            idxA = i;
          }
        }
        if (idxA >= 0 && idxA + 4 < beatList.length) {
          const dpSpan = beatList[idxA + 4] - beatList[idxA];
          if (dpSpan > curBarSec * 0.92 && dpSpan < curBarSec * 1.08) {
            targetBarSec = targetBarSec * 0.65 + (dpSpan + lagSecApplied * 0.5) * 0.35;
          }
        }
      }

      // Clamp local measure tempo strictly within ±2.5% of anchor BPM and ±0.9% measure-to-measure
      const rawSegBpm = (4 * 60) / Math.max(0.8, targetBarSec);
      const stepBoundedBpm = Math.max(
        runningBpm * 0.991,
        Math.min(runningBpm * 1.009, rawSegBpm)
      );
      const elasticBpm =
        Math.abs(lagSecApplied) < 0.002
          ? stepBoundedBpm * 0.85 + anchorBpm * 0.15
          : stepBoundedBpm;
      const segBpm = Math.max(minClampedBpm, Math.min(maxClampedBpm, elasticBpm));
      const roundedBpm = Number(segBpm.toFixed(3));
      const roundedTime = Number(curTime.toFixed(4));

      syncTrack.push({
        tick: curTick,
        bpm: roundedBpm,
        timeSec: roundedTime,
        timeSeconds: roundedTime,
      });

      curTick += RESOLUTION_PPQ * 4; // 768 ticks = 1 measure
      curTime += (4 * 60) / roundedBpm;
      runningBpm = roundedBpm;
    }

    if (syncTrack.length === 0) {
      const roundedBpm = Number(anchorBpm.toFixed(3));
      const roundedTime = Number(firstBeatSec.toFixed(4));
      syncTrack.push({ tick: 0, bpm: roundedBpm, timeSec: roundedTime, timeSeconds: roundedTime });
    }
    beatPhaseSec = firstBeatSec;
  }

  emitProgress(4, 100, 0.87, 'Stage 4/5: Multi-Anchor 768-Tick [SyncTrack] Locked (100%)...');
  if (shouldCancel?.()) throw new Error('JOB_CANCELLED');

  // =========================================================================
  // STAGE 5/5: Strict 192 PPQ Quantization (Zero Magnetic Snap Drift)
  // =========================================================================
  emitProgress(5, 15, 0.89, 'Stage 5/5: Strict 192 PPQ Quantization & Chart Build (15%)...');

  const secToTickLocal = (sec) => {
    if (!syncTrack.length) return Math.max(0, Math.round((sec / Math.max(0.25, beatSec)) * RESOLUTION_PPQ));
    let idx = 0;
    for (let i = syncTrack.length - 1; i >= 0; i -= 1) {
      if (syncTrack[i].timeSec <= sec) {
        idx = i;
        break;
      }
    }
    const seg = syncTrack[idx];
    return Math.max(0, Math.round(seg.tick + ((sec - seg.timeSec) * seg.bpm * RESOLUTION_PPQ) / 60));
  };

  const tickToSecLocal = (tick) => {
    if (!syncTrack.length) return (tick / RESOLUTION_PPQ) * Math.max(0.25, beatSec);
    let idx = 0;
    for (let i = syncTrack.length - 1; i >= 0; i -= 1) {
      if (syncTrack[i].tick <= tick) {
        idx = i;
        break;
      }
    }
    const seg = syncTrack[idx];
    return seg.timeSec + ((tick - seg.tick) / RESOLUTION_PPQ) * (60 / Math.max(40, seg.bpm));
  };

  // Generate unified 1/4-Beat (tick % 192 === 0) & 1/1-Measure (tick % 768 === 0) grid directly from [SyncTrack]
  const quantizedBeatGrid = [];
  const quantizedBeats = [];
  {
    let bTick = 0;
    let bIdx = 0;
    const maxBeatCount = 4000;
    while (bIdx < maxBeatCount) {
      const tSec = Number(tickToSecLocal(bTick).toFixed(4));
      if (tSec > actualDuration + 0.5) break;
      let segIdx = 0;
      for (let s = syncTrack.length - 1; s >= 0; s -= 1) {
        if (syncTrack[s].tick <= bTick) {
          segIdx = s;
          break;
        }
      }
      const localBpm = Number((syncTrack[segIdx]?.bpm || bpm).toFixed(3));
      quantizedBeats.push(tSec);
      quantizedBeatGrid.push({
        tick: bTick,
        timeSec: tSec,
        time: tSec,
        isMeasure: bTick % 768 === 0,
        beatIndex: bIdx,
        localBpm,
      });
      bTick += RESOLUTION_PPQ;
      bIdx += 1;
    }
  }

  /**
   * Strict Clone Hero 192 PPQ Quantizer:
   * Quantizes every event's tick strictly to 1/4 (192), 1/8 (96), 1/16 (48), or 1/8-triplet (64)
   * and derives exactTimeSec EXCLUSIVELY by integrating the [SyncTrack] BPM map!
   */
  const quantizeEventTo192Grid = (rawTimeSec) => {
    const rawTick = secToTickLocal(rawTimeSec);
    const q48 = Math.round(rawTick / 48) * 48; // 1/4 (192), 1/8 (96), 1/16 (48)
    const q64 = Math.round(rawTick / 64) * 64; // 1/8 triplet (64)
    const targetTick = Math.max(0, Math.abs(rawTick - q48) <= Math.abs(rawTick - q64) + 4 ? q48 : q64);
    const exactTimeSec = Number(tickToSecLocal(targetTick).toFixed(4));
    return {
      tick: targetTick,
      exactTimeSec,
    };
  };

  // 1. Drums Events (Kick, Snare, Tom, Hi-Hat, Crash)
  const drumEvents = [];
  const pushGatedDrums = (list, part) => {
    for (let i = 0; i < list.length; i += 1) {
      const ev = list[i];
      if (drumActiveFrame[ev.frame] === 1) {
        const quantized = quantizeEventTo192Grid(ev.time);
        drumEvents.push({
          tick: quantized.tick,
          time: quantized.exactTimeSec,
          exactTimeSec: quantized.exactTimeSec,
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
  pushGatedDrums(rawTomCandidates, 'tom');
  pushGatedDrums(rawHatCandidates, 'hihat');
  pushGatedDrums(rawCrashCandidates, 'crash');
  drumEvents.sort((a, b) => a.tick - b.tick || a.time - b.time);

  // 2. Full-Spectrum Lead Guitar Onsets (180Hz-4.5kHz Harmonic + 1.2-5.5kHz Pluck, 1.2s Adaptive Median)
  const guitarActiveFrame = pool.guitarActiveFrame.subarray(0, numFrames);
  guitarActiveFrame.fill(0);
  const guitarOnsets = [];
  let lastGuitarTime = -1;
  const maxGuitarHold = Math.round(3.0 / hopSec);
  const guitarMonoRef = separatedStems ? separatedStems.guitar : leftPcm;

  for (let f = 2; f < numFrames - 2; f += 1) {
    const t = (f * HOP_SIZE + HALF_FFT) / safeSampleRate;
    if (t < 0.03 || t > actualDuration - 0.06 || rmsAll[f] < melodicSilenceRmsFloor) continue;

    const gE = guitarEnergy[f];
    const gf = guitarNormFlux[f];
    const hnr = guitarHnr[f];
    const localFloor = guitarFloors.floor[f];
    const localFluxMed = guitarFluxFloors.median[f];
    const agcBoost = Math.min(8.0, Math.max(1.0, chorusEnergyFloor / Math.max(localRmsPeak[f], 0.004)));
    const isQuietSection = localOverallEnergy[f] < chorusEnergyFloor * 0.72;

    // Never choke Lead Guitar when vocals/drums are playing: require only real audio + mid/pluck energy
    const isGuitarPresent =
      stemGuitarRms150[f] >= Math.max(0.0035, guitarPeakRMS * 0.035) ||
      gE * agcBoost >= Math.max(isQuietSection ? 0.014 : 0.024, localFloor * agcBoost * 0.78);

    if (isGuitarPresent) guitarActiveFrame[f] = 1;
    if (gf < guitarNormFlux[f - 1] || gf <= guitarNormFlux[f + 1]) continue;

    // 1.2s local adaptive median threshold (onset > 1.35 * localMedian)
    const localThresh = Math.max(0.018, localFluxMed * 1.35 + 0.008);

    if (isGuitarPresent && gf >= localThresh) {
      const rawSample = findStemOnsetSample(guitarMonoRef, leftPcm, f, HOP_SIZE, FFT_SIZE, totalSamples);
      const rawTimeSec = rawSample / safeSampleRate;
      if (rawTimeSec - lastGuitarTime < 0.072) continue;

      const quantized = quantizeEventTo192Grid(rawTimeSec);

      const peakE = Math.max(gE, guitarEnergy[Math.min(numFrames - 1, f + 2)]);
      const sustainFloor = Math.max(0.04 / agcBoost, peakE * 0.48);
      let holdFrames = 0;
      const maxHold = Math.min(maxGuitarHold, numFrames - 1 - f);
      for (let h = 4; h <= maxHold; h += 1) {
        if (
          h > 16 &&
          guitarNormFlux[f + h] > localThresh * 1.35 &&
          guitarNormFlux[f + h] >= guitarNormFlux[f + h - 1]
        ) {
          break;
        }
        if (guitarEnergy[f + h] >= sustainFloor) holdFrames = h;
        else break;
      }

      const pFrame = Math.min(numFrames - 1, f + 2);
      guitarOnsets.push({
        tick: quantized.tick,
        time: quantized.exactTimeSec,
        exactTimeSec: quantized.exactTimeSec,
        pitchHz: Number(guitarPitchHz[pFrame].toFixed(2)),
        strength: Number((gf / Math.max(0.01, localThresh)).toFixed(3)),
        energy: Number(gE.toFixed(4)),
        sectionEnergy: Number(localOverallEnergy[f].toFixed(5)),
        hnr: Number(hnr.toFixed(2)),
        sustainSec: Number((holdFrames * hopSec).toFixed(3)),
      });
      lastGuitarTime = quantized.exactTimeSec;
    }
  }
  {
    const maxGap = Math.round(0.5 / hopSec);
    let gap = 0;
    let seen = false;
    for (let f = 0; f < numFrames; f += 1) {
      if (guitarActiveFrame[f] === 1) {
        if (seen && gap > 0 && gap <= maxGap) {
          for (let k = f - gap; k < f; k += 1) guitarActiveFrame[k] = 1;
        }
        seen = true;
        gap = 0;
      } else if (seen) gap += 1;
    }
  }

  // 3. Bass Onsets (38-240Hz Sub-Harmonic Stem, Kick-Locked Downbeats & Sustain Envelope)
  const bassActiveFrame = pool.bassActiveFrame.subarray(0, numFrames);
  bassActiveFrame.fill(0);
  const bassOnsets = [];
  let lastBassTime = -1;
  const maxBassHold = Math.round(3.2 / hopSec);
  const bassMonoRef = separatedStems ? separatedStems.bass : leftPcm;

  for (let f = 2; f < numFrames - 2; f += 1) {
    const t = (f * HOP_SIZE + HALF_FFT) / safeSampleRate;
    if (t < 0.03 || t > actualDuration - 0.06 || rmsAll[f] < bassSilenceRmsFloor) continue;

    const bE = bassEnergy[f];
    const bf = bassNormFlux[f];
    const gE = guitarEnergy[f];
    const bFloor = bassFloors.floor[f];
    const bfMed = bassFluxFloors.median[f];
    const bfFloor = bassFluxFloors.floor[f];
    const isQuietSection = localOverallEnergy[f] < chorusEnergyFloor * 0.72;
    const agcBoost = Math.min(8.0, Math.max(1.0, chorusEnergyFloor / Math.max(localRmsPeak[f], 0.004)));

    const sustainBody =
      (bassEnergy[Math.min(numFrames - 1, f + 5)] + bassEnergy[Math.min(numFrames - 1, f + 10)]) * 0.5;
    const isShortKickOnly = kickEnergy[f] > sustainBody * 2.15 && sustainBody < bE * 0.5;
    const subBassDominance = subBassMeanPower[f] / (midVocalMeanPower[f] + 1e-9);
    const isBassPresent =
      !isShortKickOnly &&
      stemBassRms150[f] >= bassStemGateFloor &&
      subBassDominance >= 1.12 &&
      bE * agcBoost >= Math.max(isQuietSection ? 0.044 : 0.095, bFloor * agcBoost * 1.05) &&
      sustainBody * agcBoost >= (isQuietSection ? 0.036 : 0.08) &&
      bE >= gE * (isQuietSection ? 0.2 : 0.26);

    if (isBassPresent) bassActiveFrame[f] = 1;
    if (bf < bassNormFlux[f - 1] || bf <= bassNormFlux[f + 1]) continue;

    const localThresh = Math.max(0.03, (bfMed * 1.16 + bfFloor * 0.44 + 0.018) * (isQuietSection ? 0.8 : 1.0));
    if (isBassPresent && bf >= localThresh) {
      const rawSample = findStemOnsetSample(bassMonoRef, leftPcm, f, HOP_SIZE, FFT_SIZE, totalSamples);
      const rawTimeSec = rawSample / safeSampleRate;
      if (rawTimeSec - lastBassTime < 0.092) continue;

      let alignedSample = rawSample;
      let alignedTime = rawTimeSec;
      for (let kIdx = 0; kIdx < rawKickCandidates.length; kIdx += 1) {
        const kt = rawKickCandidates[kIdx].time;
        const diff = kt - rawTimeSec;
        if (diff > 0.036) break;
        if (Math.abs(diff) <= 0.035 && drumActiveFrame[rawKickCandidates[kIdx].frame] === 1) {
          alignedTime = kt;
          alignedSample = rawKickCandidates[kIdx].peakSample ?? rawSample;
          break;
        }
      }

      const quantized = quantizeEventTo192Grid(alignedTime);
      const centerSample = f * HOP_SIZE + HALF_FFT + Math.round(0.015 * safeSampleRate);
      const rootHz = estimateBassFundamentalHz(
        bassMonoRef,
        centerSample,
        safeSampleRate,
        bassPeakHz[Math.min(numFrames - 1, f + 4)]
      );

      const peakB = Math.max(bE, sustainBody);
      const holdFloor = Math.max(0.055 / agcBoost, peakB * 0.48);
      let holdFrames = 0;
      const maxHold = Math.min(maxBassHold, numFrames - 1 - f);
      for (let h = 6; h <= maxHold; h += 1) {
        if (
          h > 20 &&
          bassNormFlux[f + h] > localThresh * 1.35 &&
          bassNormFlux[f + h] >= bassNormFlux[f + h - 1]
        ) {
          break;
        }
        if (bassEnergy[f + h] >= holdFloor) holdFrames = h;
        else break;
      }

      bassOnsets.push({
        tick: quantized.tick,
        time: quantized.exactTimeSec,
        exactTimeSec: quantized.exactTimeSec,
        pitchHz: Number(rootHz.toFixed(2)),
        strength: Number((bf / Math.max(0.01, localThresh)).toFixed(3)),
        energy: Number(bE.toFixed(4)),
        sectionEnergy: Number(localOverallEnergy[f].toFixed(5)),
        sustainSec: Number((holdFrames * hopSec).toFixed(3)),
      });
      lastBassTime = quantized.exactTimeSec;
    }
  }
  bassOnsets.sort((a, b) => a.tick - b.tick || a.time - b.time);

  {
    const minRun = Math.round(0.2 / hopSec);
    const maxGap = Math.round(0.48 / hopSec);
    let run = 0;
    for (let f = 0; f < numFrames; f += 1) {
      if (bassActiveFrame[f] === 1) run += 1;
      else {
        if (run > 0 && run < minRun) {
          for (let k = f - run; k < f; k += 1) bassActiveFrame[k] = 0;
        }
        run = 0;
      }
    }
    let gap = 0;
    let seen = false;
    for (let f = 0; f < numFrames; f += 1) {
      if (bassActiveFrame[f] === 1) {
        if (seen && gap > 0 && gap <= maxGap) {
          for (let k = f - gap; k < f; k += 1) bassActiveFrame[k] = 1;
        }
        seen = true;
        gap = 0;
      } else if (seen) gap += 1;
    }
  }

  // 4. Piano / Keys Onsets (110Hz-3.2kHz M_harm * transientAttackMask + 12-TET Chromagram)
  const pianoActiveFrame = pool.pianoActiveFrame.subarray(0, numFrames);
  pianoActiveFrame.fill(0);
  const pianoOnsets = [];
  let lastPianoTime = -1;
  const maxPianoHold = Math.round(3.2 / hopSec);
  const pianoMonoRef = separatedStems ? separatedStems.piano : leftPcm;

  for (let f = 2; f < numFrames - 2; f += 1) {
    const t = (f * HOP_SIZE + HALF_FFT) / safeSampleRate;
    if (t < 0.03 || t > actualDuration - 0.06 || rmsAll[f] < melodicSilenceRmsFloor) continue;

    const pE = pianoEnergy[f];
    const pf = pianoNormFlux[f];
    const pFloor = pianoFloors.floor[f];
    const pfMed = pianoFluxFloors.median[f];
    const pfFloor = pianoFluxFloors.floor[f];
    const peaks = pianoPeakCount[f];
    const isQuietSection = localOverallEnergy[f] < chorusEnergyFloor * 0.72;
    const agcBoost = Math.min(8.0, Math.max(1.0, chorusEnergyFloor / Math.max(localRmsPeak[f], 0.004)));

    const hasPianoKeyHarmonicStructure =
      peaks >= 2 || (pianoAttackRatio[f] >= 0.09 && guitarOvertoneRatio[f] >= 0.05);
    const isPianoPresent =
      stemPianoRms150[f] >= pianoStemGateFloor &&
      hasPianoKeyHarmonicStructure &&
      pE * agcBoost >= Math.max(isQuietSection ? 0.02 : 0.042, pFloor * agcBoost * 0.96) &&
      (peaks >= 2 ||
        guitarHnr[f] >= 1.55 ||
        pE * agcBoost >= Math.max(isQuietSection ? 0.06 : 0.14, pFloor * agcBoost * 1.28));

    if (isPianoPresent) pianoActiveFrame[f] = 1;
    if (pf < pianoNormFlux[f - 1] || pf <= pianoNormFlux[f + 1]) continue;

    const polyBonus = peaks >= 3 ? 0.78 : isQuietSection ? 0.76 : 1.0;
    const localThresh = Math.max(0.025, (pfMed * 1.14 + pfFloor * 0.44 + 0.016) * polyBonus);

    if (isPianoPresent && pf >= localThresh) {
      const rawSample = findStemOnsetSample(pianoMonoRef, leftPcm, f, HOP_SIZE, FFT_SIZE, totalSamples);
      const rawTimeSec = rawSample / safeSampleRate;
      if (rawTimeSec - lastPianoTime < 0.08) continue;

      const quantized = quantizeEventTo192Grid(rawTimeSec);

      const peakE = Math.max(pE, pianoEnergy[Math.min(numFrames - 1, f + 2)]);
      const sustainFloor = Math.max(0.05 / agcBoost, peakE * 0.48);
      let holdFrames = 0;
      const maxHold = Math.min(maxPianoHold, numFrames - 1 - f);
      for (let h = 6; h <= maxHold; h += 1) {
        if (
          h > 16 &&
          pianoNormFlux[f + h] > localThresh * 1.38 &&
          pianoNormFlux[f + h] >= pianoNormFlux[f + h - 1]
        ) {
          break;
        }
        if (pianoEnergy[f + h] >= sustainFloor) holdFrames = h;
        else break;
      }

      const pFrame = Math.min(numFrames - 1, f + 2);
      const pHz = Number(pianoPitchHz[pFrame].toFixed(2));
      const chOff = pFrame * 3;
      const chromaVoices = [pianoChords[chOff]];
      if (pianoChords[chOff + 1] !== 255) chromaVoices.push(pianoChords[chOff + 1]);
      if (pianoChords[chOff + 2] !== 255) chromaVoices.push(pianoChords[chOff + 2]);

      pianoOnsets.push({
        tick: quantized.tick,
        time: quantized.exactTimeSec,
        exactTimeSec: quantized.exactTimeSec,
        pitchHz: pHz,
        pianoHand: pHz < 270 ? 'left' : 'right',
        chromaVoices,
        strength: Number((pf / Math.max(0.01, localThresh)).toFixed(3)),
        energy: Number(pE.toFixed(4)),
        sectionEnergy: Number(localOverallEnergy[f].toFixed(5)),
        peakCount: peaks,
        isPolyphonic: chromaVoices.length >= 2 || peaks >= 3,
        sustainSec: Number((holdFrames * hopSec).toFixed(3)),
      });
      lastPianoTime = quantized.exactTimeSec;
    }
  }
  {
    const maxGap = Math.round(0.5 / hopSec);
    let gap = 0;
    let seen = false;
    for (let f = 0; f < numFrames; f += 1) {
      if (pianoActiveFrame[f] === 1) {
        if (seen && gap > 0 && gap <= maxGap) {
          for (let k = f - gap; k < f; k += 1) pianoActiveFrame[k] = 1;
        }
        seen = true;
        gap = 0;
      } else if (seen) gap += 1;
    }
  }

  emitProgress(5, 60, 0.94, 'Stage 5/5: Strict 192 PPQ Charts & Beat Grid Ready (60%)...');

  // Downsample per-stem activity timeline to 50ms hop
  const ratio = Math.max(1, Math.round(ACTIVITY_HOP_SEC / hopSec));
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

  const sections = segmentSongSections({
    dynamicBeatGrid: quantizedBeatGrid,
    duration: actualDuration,
    hopSec,
    rmsAll,
    drumActiveFrame,
    bassEnergy,
    guitarEnergy,
    guitarHighEnergy,
    guitarHnr,
    bandProfiles,
  });

  // Build Unified Strict 192 PPQ Clone Hero Charts:
  // - timeSec / hitTimeSec derived EXCLUSIVELY from tickToSecLocal(tick)
  // - Ascending/descending melodic lane stepping (0..4) + repeated pitch fret lock
  // - Authentic 2-note Power Chords ([0,2] Green+Yellow or [1,3] Red+Blue) on chorus downbeats
  // - Fast 1/16 pitch-changing runs (step <= 48 ticks) flagged as isHopo: true
  // - Sustained harmonic energy (> 240 ticks) encoded as Sustain Tails
  const buildErgonomic192Track = (
    onsets,
    { minPitch = 140, maxPitch = 1400, allowPowerChords = true, isDrums = false, isPiano = false, prefix = 'n' } = {}
  ) => {
    const out = [];
    const seenTickLane = new Set();
    let prevLane = 1;
    let prevPitch = 0;
    let lastSingleTick = -9999;
    let lastSingleLane = -1;
    let starPhraseStart = -99;

    const logMin = Math.log2(Math.max(40, minPitch));
    const logSpan = Math.max(0.5, Math.log2(Math.max(minPitch + 20, maxPitch)) - logMin);
    // Authentic Clone Hero 2-note Power Chords: [0,2] Green+Yellow or [1,3] Red+Blue
    const powerChordPairs = [
      [0, 2],
      [1, 3],
    ];
    const triadVoicings = [
      [0, 2, 4],
      [0, 1, 3],
      [1, 3, 4],
    ];

    for (let i = 0; i < onsets.length; i += 1) {
      const ev = onsets[i];
      const tick = Math.max(0, Math.round(Number.isFinite(ev.tick) ? ev.tick : secToTickLocal(ev.exactTimeSec ?? ev.time)));
      const timeSec = Number(tickToSecLocal(tick).toFixed(4));
      const nextTick =
        i + 1 < onsets.length
          ? Math.max(tick, Math.round(Number.isFinite(onsets[i + 1].tick) ? onsets[i + 1].tick : secToTickLocal(onsets[i + 1].exactTimeSec ?? onsets[i + 1].time)))
          : tick + 768;
      const gapTicks = Math.max(0, nextTick - tick);

      const rawHoldSec = !isDrums && ev.sustainSec > 0 ? Math.min(3.2, ev.sustainSec) : 0;
      const rawSusTicks =
        rawHoldSec > 0 ? Math.round((rawHoldSec / Math.max(0.25, beatSec)) * RESOLUTION_PPQ) : 0;
      const clampedSusTicks = Math.min(rawSusTicks, Math.max(0, gapTicks - 48));
      const sustainTicks = clampedSusTicks > MIN_SUSTAIN_TICKS ? Math.round(clampedSusTicks / 48) * 48 : 0;
      const sustainSec =
        sustainTicks > 0 ? Number(Math.max(0, tickToSecLocal(tick + sustainTicks) - timeSec).toFixed(4)) : 0;

      const isDownbeat = tick % 768 === 0;
      const isStrongBeat = tick % 384 === 0;
      const isAccent = Boolean(isDownbeat || (ev.strength || 1) >= 2.05);
      if (timeSec >= 10 && timeSec - starPhraseStart >= 18) {
        starPhraseStart = timeSec;
      }
      const isStar = Boolean(timeSec >= starPhraseStart && timeSec <= starPhraseStart + 4.2);

      if (isDrums) {
        const part = ev.part || 'kick';
        const lane = part === 'kick' ? 0 : part === 'snare' ? 1 : part === 'hihat' ? 2 : part === 'tom' ? 3 : 4;
        const key = `${tick}:${lane}`;
        if (seenTickLane.has(key)) continue;
        seenTickLane.add(key);
        out.push({
          id: `${prefix}_${out.length}`,
          tick,
          timeSec,
          hitTimeSec: timeSec,
          lane,
          sustainTicks: 0,
          sustainSec: 0,
          sustainDuration: 0,
          isChord: false,
          isHopo: false,
          isStar,
          isFever: isStar,
          isAccent: Boolean(isDownbeat || part === 'crash' || (ev.strength || 1) >= 2.1),
          drumPart: part,
          strength: ev.strength || 1,
          pitchNorm: lane / 4,
          hit: false,
          holding: false,
          holdCompleted: false,
          missed: false,
          dodged: false,
        });
        continue;
      }

      const hz = Math.max(minPitch, Math.min(maxPitch, ev.pitchHz || (minPitch + maxPitch) * 0.5));
      const pitchNorm = Math.max(0, Math.min(1, (Math.log2(hz) - logMin) / logSpan));
      let lane = Math.min(4, Math.max(0, Math.round(pitchNorm * 4)));

      // Smooth melodic fret contour: repeat stays same fret, ascending steps up, descending steps down
      if (prevPitch > 0) {
        const semitones = 12 * Math.log2(hz / prevPitch);
        if (Math.abs(semitones) < 0.85) {
          lane = prevLane;
        } else if (semitones >= 0.85 && lane <= prevLane && prevLane < 4) {
          lane = Math.min(4, prevLane + (semitones > 4.5 ? 2 : 1));
        } else if (semitones <= -0.85 && lane >= prevLane && prevLane > 0) {
          lane = Math.max(0, prevLane - (semitones < -4.5 ? 2 : 1));
        } else if (Math.abs(lane - prevLane) > 2 && tick - lastSingleTick < 96) {
          lane = prevLane + Math.sign(lane - prevLane) * 2;
        }
      }

      const inHighEnergyChorus = (ev.sectionEnergy || 0) >= chorusEnergyFloor * 0.78;
      const makeChord =
        allowPowerChords &&
        ((isPiano && (ev.isPolyphonic || ev.strength >= 1.92)) ||
          (!isPiano && inHighEnergyChorus && isStrongBeat && (isDownbeat || ev.strength >= 1.85)));

      if (makeChord) {
        const isTriad = isPiano && (ev.chromaVoices?.length >= 3 || (ev.peakCount >= 4 && isAccent));
        const voicing = isTriad
          ? triadVoicings[Math.min(2, Math.max(0, lane >= 3 ? 2 : lane >= 1 ? 1 : 0))]
          : powerChordPairs[lane <= 1 ? 0 : 1]; // [0,2] Green+Yellow or [1,3] Red+Blue
        voicing.forEach((l, pairIdx) => {
          const key = `${tick}:${l}`;
          if (seenTickLane.has(key)) return;
          seenTickLane.add(key);
          const hand = isPiano ? (pairIdx === 0 ? 'left' : 'right') : undefined;
          const handSustainTicks =
            isPiano && hand === 'left' && sustainTicks === 0 && gapTicks >= 336 ? 288 : sustainTicks;
          const handSustainSec =
            handSustainTicks > 0
              ? Number(Math.max(0, tickToSecLocal(tick + handSustainTicks) - timeSec).toFixed(4))
              : 0;
          out.push({
            id: `${prefix}_${out.length}`,
            tick,
            timeSec,
            hitTimeSec: timeSec,
            lane: l,
            sustainTicks: handSustainTicks,
            sustainSec: handSustainSec,
            sustainDuration: handSustainSec,
            isChord: true,
            isHopo: false,
            isStar,
            isFever: isStar,
            isAccent,
            pianoHand: hand,
            pitchHz: hz,
            pitchNorm,
            strength: ev.strength || 1,
            drumPart: null,
            hit: false,
            holding: false,
            holdCompleted: false,
            missed: false,
            dodged: false,
          });
        });
        lastSingleTick = -9999;
        lastSingleLane = -1;
      } else {
        const key = `${tick}:${lane}`;
        if (seenTickLane.has(key)) continue;
        seenTickLane.add(key);
        const dtTick = tick - lastSingleTick;
        // Auto-flag fast 1/16 pitch-changing runs (step <= 48 ticks) as HOPO
        const isHopo = dtTick > 0 && dtTick <= HOPO_MAX_TICKS && lane !== lastSingleLane;
        const hand = isPiano ? (ev.pianoHand || (hz < 270 || lane <= 1 ? 'left' : 'right')) : undefined;
        out.push({
          id: `${prefix}_${out.length}`,
          tick,
          timeSec,
          hitTimeSec: timeSec,
          lane,
          sustainTicks,
          sustainSec,
          sustainDuration: sustainSec,
          isChord: false,
          isHopo,
          isStar,
          isFever: isStar,
          isAccent,
          pianoHand: hand,
          pitchHz: hz,
          pitchNorm,
          strength: ev.strength || 1,
          drumPart: null,
          hit: false,
          holding: false,
          holdCompleted: false,
          missed: false,
          dodged: false,
        });
        lastSingleTick = tick;
        lastSingleLane = lane;
      }

      prevLane = lane;
      prevPitch = hz;
    }

    if (out.length >= 24) {
      let lastHazardTick = -9999;
      for (let i = 10; i < out.length - 6; i += 14) {
        const n = out[i];
        if (n.isChord || n.tick - lastHazardTick < 1536) continue;
        const altLane = (n.lane + 2) % 5;
        if (seenTickLane.has(`${n.tick}:${altLane}`)) continue;
        seenTickLane.add(`${n.tick}:${altLane}`);
        lastHazardTick = n.tick;
        const tier = (i / 14) % 3 === 0 ? 'medium' : (i / 14) % 3 === 1 ? 'hard' : 'expert';
        out.push({
          id: `${prefix}_haz_${out.length}`,
          tick: n.tick,
          timeSec: n.timeSec,
          hitTimeSec: n.hitTimeSec,
          lane: altLane,
          sustainTicks: 0,
          sustainSec: 0,
          sustainDuration: 0,
          isChord: false,
          isHopo: false,
          isStar: false,
          isFever: false,
          isAccent: false,
          isHazard: true,
          minDifficulty: tier,
          pitchNorm: altLane / 4,
          drumPart: null,
          hit: false,
          holding: false,
          holdCompleted: false,
          missed: false,
          dodged: false,
        });
      }
    }

    out.sort((a, b) => a.tick - b.tick || a.timeSec - b.timeSec || a.lane - b.lane);
    return out;
  };

  const tracks = {
    guitar: buildErgonomic192Track(guitarOnsets, {
      minPitch: 165,
      maxPitch: 1550,
      allowPowerChords: true,
      prefix: 'mir_g',
    }),
    bass: buildErgonomic192Track(bassOnsets, {
      minPitch: 42,
      maxPitch: 260,
      allowPowerChords: false,
      prefix: 'mir_b',
    }),
    drums: buildErgonomic192Track(drumEvents, {
      isDrums: true,
      prefix: 'mir_d',
    }),
    piano: buildErgonomic192Track(pianoOnsets, {
      minPitch: 110,
      maxPitch: 2400,
      allowPowerChords: true,
      isPiano: true,
      prefix: 'mir_p',
    }),
  };

  let sumBass = 0;
  let sumGuitar = 0;
  let sumGuitarHi = 0;
  let sumPiano = 0;
  let sumCym = 0;
  let sumFlat = 0;
  let sumRms = 0;
  let drumActiveCount = 0;
  for (let f = 0; f < numFrames; f += 1) {
    sumBass += bassEnergy[f];
    sumGuitar += guitarEnergy[f];
    sumGuitarHi += guitarHighEnergy[f];
    sumPiano += pianoEnergy[f];
    sumCym += cymbalEnergy[f];
    sumFlat += highFlatness[f];
    sumRms += rmsAll[f];
    if (drumActiveFrame[f] === 1) drumActiveCount += 1;
  }
  const avgBassE = sumBass / numFrames;
  const avgGuitarE = sumGuitar / numFrames;
  const avgGuitarHiE = sumGuitarHi / numFrames;
  const avgPianoE = sumPiano / numFrames;
  const avgCymE = sumCym / numFrames;
  const avgFlat = sumFlat / numFrames;
  const avgEnergy = sumRms / numFrames;
  const drumRatio = drumActiveCount / numFrames;
  const warmth = Math.max(
    0,
    Math.min(1, (avgPianoE * 1.4 + avgBassE * 0.85) / Math.max(0.05, avgBassE + avgGuitarE + avgCymE * 1.2))
  );

  let ambianceType = 'ROCK_ANTHEM';
  if (bpm <= 104 && (warmth >= 0.43 || drumRatio < 0.72 || avgPianoE >= avgGuitarHiE * 1.12)) {
    ambianceType = 'BALLAD_EMOTIONAL';
  } else if ((bpm >= 146 && avgFlat >= 0.27) || (bpm >= 156 && avgGuitarHiE > avgPianoE * 1.08)) {
    ambianceType = 'METAL_CHAOS';
  } else if (avgPianoE >= avgGuitarE * 1.02 && bpm >= 106 && bpm <= 145) {
    ambianceType = 'SYNTH_CYBER';
  } else if (bpm >= 102 && bpm <= 138 && warmth >= 0.41) {
    ambianceType = 'POP_UPBEAT';
  }

  const trackMeta = {
    ambianceType,
    warmth: Number(warmth.toFixed(3)),
    avgEnergy: Number(avgEnergy.toFixed(4)),
    bpm,
    drumRatio: Number(drumRatio.toFixed(3)),
  };

  emitProgress(5, 100, 1.0, 'Stage 5/5: 192 PPQ Charts & Stems Ready (100%)!');

  return {
    schemaVersion: SCHEMA_VERSION,
    resolution: RESOLUTION_PPQ,
    firstOnsetSample,
    firstTransientSec,
    firstBeatSec,
    syncTrack,
    bpm,
    beatSec,
    beatPhaseSec,
    beats: quantizedBeats,
    dynamicBeatGrid: quantizedBeatGrid,
    downbeatPhase: dpBeats.downbeatPhase,
    sections,
    tracks,
    trackMeta,
    duration: actualDuration,
    chorusEnergyFloor: Number(chorusEnergyFloor.toFixed(5)),
    guitarOnsets,
    pianoOnsets,
    bassOnsets,
    drumEvents,
    stemActivity,
    separatedStems,
    analysisEngine,
  };
}

export async function analyzeMono(monoAudio, options = {}) {
  return analyzeStereo(monoAudio, null, options);
}

export const analyzeMono22k = analyzeMono;
export const analyzeMono16k = analyzeMono;

// =========================================================================
// Web Worker Message Handler (Zero-Copy Transferables)
// =========================================================================
const isWorkerContext =
  typeof self !== 'undefined' &&
  typeof self.postMessage === 'function' &&
  typeof window === 'undefined';

if (isWorkerContext) {
  const cancelledJobIds = new Set();

  self.onmessage = async (event) => {
    const data = event.data || {};
    if (data.type === 'cancel') {
      if (data.id !== undefined) cancelledJobIds.add(data.id);
      if (data.jobId !== undefined) cancelledJobIds.add(data.jobId);
      return;
    }

    const { id, jobId, pcmLeft, pcmRight, mono, mono22k, mono16k, sampleRate, bpmHint, duration } = data;
    const isCancelled = () => cancelledJobIds.has(id) || (jobId !== undefined && cancelledJobIds.has(jobId));
    if (isCancelled()) {
      self.postMessage({ id, jobId, type: 'cancelled' });
      return;
    }

    try {
      const t0 = performance.now();
      const rawL = pcmLeft || mono || mono22k || mono16k;
      const rawR = pcmRight || null;
      const effectiveRate = sampleRate || DEFAULT_SAMPLE_RATE;

      const dec = decimateTo22050Stereo(rawL, rawR, effectiveRate);

      const analysis = await analyzeStereo(dec.left, dec.right, {
        sampleRate: dec.sampleRate,
        bpmHint,
        duration,
        shouldCancel: isCancelled,
        synthesizeStemAudio: true,
        onProgress: (prog) => {
          if (!isCancelled()) {
            const payload =
              typeof prog === 'object' && prog !== null
                ? { id, jobId, type: 'progress', ...prog }
                : { id, jobId, type: 'progress', pct: Number(prog) || 0 };
            self.postMessage(payload);
          }
        },
      });
      if (isCancelled()) {
        self.postMessage({ id, jobId, type: 'cancelled' });
        return;
      }
      const elapsedMs = Math.round(performance.now() - t0);
      const transfers = [
        analysis.stemActivity.drums.buffer,
        analysis.stemActivity.bass.buffer,
        analysis.stemActivity.guitar.buffer,
        analysis.stemActivity.piano.buffer,
      ];
      if (analysis.separatedStems) {
        transfers.push(
          analysis.separatedStems.drums.buffer,
          analysis.separatedStems.bass.buffer,
          analysis.separatedStems.guitar.buffer,
          analysis.separatedStems.piano.buffer
        );
      }
      self.postMessage(
        {
          id,
          jobId,
          type: 'result',
          elapsedMs,
          analysis,
        },
        transfers
      );
    } catch (err) {
      if (err?.message === 'JOB_CANCELLED' || isCancelled()) {
        self.postMessage({ id, jobId, type: 'cancelled' });
      } else {
        self.postMessage({
          id,
          jobId,
          type: 'error',
          error: err?.message || 'Worker audio analysis failed',
        });
      }
    } finally {
      cancelledJobIds.delete(id);
      if (jobId !== undefined) cancelledJobIds.delete(jobId);
    }
  };
}

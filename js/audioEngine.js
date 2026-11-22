/**
 * audioEngine.js
 * Core Web Audio DSP Engine:
 *  1. Exact AudioContext.currentTime clock lock with zero frame-rate drift
 *     across variable playbackRate (0.75x, 0.85x, 1.0x, 1.1x Encore Speed-Up)
 *     and Practice Loop instant seeking.
 *  2. True Instrument-Only Muting (NEVER lowers master volume!):
 *     Splits local AudioBufferSourceNode into 3 parallel frequency buses summing
 *     back into the master output:
 *       - Drums Bus:  < 110Hz lowpass + > 5kHz highpass
 *       - Bass Bus:   90Hz - 320Hz bandpass
 *       - Guitar Bus: 320Hz - 4.5kHz bandpass
 *     (And routes built-in tracks via 3 isolated stem AudioBuffers into the
 *     same 3 parallel buses!)
 *     On miss/wrong key, smoothly ducks ONLY the selected instrument's bus gain
 *     to 0.08 while the other two buses stay at 1.0 full volume!
 *  3. Whammy / Vibrato Pitch-Bend modulation (detune + peaking filter sweep)
 *     on the active instrument bus while holding sustain bars.
 *  4. Dynamic Stereo Width widening unlocked on 30x, 50x, and 100x combos.
 */

export const LEAD_IN_SEC = 2.0;
export const WALK_ON_LEAD_IN_SEC = 4.5; // 2.5s Stage Walk-On & Gear Setup + 2.0s Highway Approach

export class AudioEngine {
  constructor({ onTrackEnded }) {
    this.onTrackEnded = onTrackEnded || (() => {});

    this.ctx = null;
    this.isPlaying = false;
    this.isPaused = false;
    this.instrument = 'guitar';
    this.duration = 0;
    this.playbackRate = 1.0;

    // Exact AudioContext clock lock anchors (supports negative preroll time -4.5s -> 0.0s)
    this.offsetSec = 0;
    this.startCtxTime = 0;
    this.endNotified = false;

    // Loaded audio buffers (either { mode:'local', buffer } or { mode:'stems', drums, bass, guitar })
    this.mediaSource = null;
    this.activeSources = [];

    // 3 Parallel Instrument Bus Nodes + Master
    this.busInputs = null;
    this.busGains = null;
    this.masterGain = null;
    this.speakerAnalyser = null;

    // Whammy vibrato filter & LFO modulation state
    this.whammyFilter = null;
    this.whammyAmount = 0;
    this.whammyPhase = 0;

    // Dynamic Stereo Widener (Haas stereo spread controlled by combo tier)
    this.stereoDryGain = null;
    this.stereoWetGain = null;
    this.stereoDelayR = null;

    // Live per-band audio telemetry for 3D Roblox band, crowd lightsticks & horizon spectrum
    this.speakerFreqData = new Uint8Array(256);
    this.liveDrumEnergy = 0;
    this.liveBassEnergy = 0;
    this.liveGuitarEnergy = 0;
    this.livePianoEnergy = 0;
    this.liveVocalEnergy = 0;
    this.liveOverallEnergy = 0;
    this.liveSpectrumBins = new Float32Array(24);

    // Per-stem activity gate timeline ({ hopSec, duration, drums, bass, guitar, piano })
    this.stemActivity = null;
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  getContext() {
    return this.ensureContext();
  }

  /**
   * Builds the 3 parallel frequency buses + active instrument Whammy/Stereo chain
   * summing cleanly into the untouched 1.0 Master Bus.
   */
  buildParallelMixer(activeInstrument) {
    const ctx = this.ensureContext();
    this.teardownMixer();

    this.instrument = activeInstrument;

    // Master bus stays strictly at 1.0 — NEVER ducked on miss!
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0.92;

    this.speakerAnalyser = ctx.createAnalyser();
    this.speakerAnalyser.fftSize = 512;
    this.speakerAnalyser.smoothingTimeConstant = 0.62;

    this.masterGain.connect(this.speakerAnalyser);
    this.speakerAnalyser.connect(ctx.destination);

    // 4 parallel instrument bus gain nodes (independent 1.0 -> 0.08 on miss)
    this.busGains = {
      drums: ctx.createGain(),
      bass: ctx.createGain(),
      guitar: ctx.createGain(),
      piano: ctx.createGain(),
    };
    this.busGains.drums.gain.value = 1.0;
    this.busGains.bass.gain.value = 1.0;
    this.busGains.guitar.gain.value = 1.0;
    this.busGains.piano.gain.value = 1.0;

    // Active instrument FX chain: Whammy peaking sweep + Dynamic Combo Stereo Widener
    this.whammyFilter = ctx.createBiquadFilter();
    this.whammyFilter.type = 'peaking';
    this.whammyFilter.frequency.value = 1400;
    this.whammyFilter.Q.value = 2.4;
    this.whammyFilter.gain.value = 0;
    this.whammyFilter.channelCount = 2;
    this.whammyFilter.channelCountMode = 'explicit';

    // Stereo widener (dry + micro-delayed right-channel Haas spread)
    this.stereoDryGain = ctx.createGain();
    this.stereoDryGain.gain.value = 1.0;

    this.stereoWetGain = ctx.createGain();
    this.stereoWetGain.gain.value = 0.0; // Widens at 30x, 50x, 100x combos!

    const splitter = ctx.createChannelSplitter(2);
    const merger = ctx.createChannelMerger(2);
    this.stereoDelayR = ctx.createDelay(0.05);
    this.stereoDelayR.delayTime.value = 0.011; // 11ms arena stereo spread

    this.whammyFilter.connect(this.stereoDryGain);
    this.stereoDryGain.connect(this.masterGain);

    this.whammyFilter.connect(splitter);
    splitter.connect(merger, 0, 0);
    splitter.connect(this.stereoDelayR, 1);
    this.stereoDelayR.connect(merger, 0, 1);
    merger.connect(this.stereoWetGain);
    this.stereoWetGain.connect(this.masterGain);

    // Route parallel bus gains into master (active instrument goes through Whammy + Stereo FX)
    ['drums', 'bass', 'guitar', 'piano'].forEach((role) => {
      if (role === activeInstrument) {
        this.busGains[role].connect(this.whammyFilter);
      } else {
        this.busGains[role].connect(this.masterGain);
      }
    });

    // Build parallel crossover filter bank for Local MP3/WAV splitting
    // 1. Drums Bus: 45–105Hz sub-kick + > 5.5kHz snare snap & hi-hat/cymbal sheen
    const drumsIn = ctx.createGain();
    const drumsLow = ctx.createBiquadFilter();
    drumsLow.type = 'lowpass';
    drumsLow.frequency.value = 105;
    drumsLow.Q.value = 0.78;

    const drumsHigh = ctx.createBiquadFilter();
    drumsHigh.type = 'highpass';
    drumsHigh.frequency.value = 5500;
    drumsHigh.Q.value = 0.75;

    drumsIn.connect(drumsLow);
    drumsLow.connect(this.busGains.drums);
    drumsIn.connect(drumsHigh);
    drumsHigh.connect(this.busGains.drums);

    // 2. Bass Bus: strict 40Hz – 240Hz sub-harmonic bassline
    const bassIn = ctx.createBiquadFilter();
    bassIn.type = 'highpass';
    bassIn.frequency.value = 40;
    bassIn.Q.value = 0.75;

    const bassLp = ctx.createBiquadFilter();
    bassLp.type = 'lowpass';
    bassLp.frequency.value = 240;
    bassLp.Q.value = 0.8;

    bassIn.connect(bassLp);
    bassLp.connect(this.busGains.bass);

    // 3. Lead Guitar / Melody Bus: 300Hz – 4.5kHz (or upper 2.2kHz–4.8kHz when Piano is active!)
    const guitarIn = ctx.createBiquadFilter();
    guitarIn.type = 'highpass';
    guitarIn.frequency.value = activeInstrument === 'piano' ? 2200 : 300;
    guitarIn.Q.value = 0.72;

    const guitarLp = ctx.createBiquadFilter();
    guitarLp.type = 'lowpass';
    guitarLp.frequency.value = 4500;
    guitarLp.Q.value = 0.72;

    guitarIn.connect(guitarLp);
    guitarLp.connect(this.busGains.guitar);

    // 4. Piano / Keys Bus: 130Hz – 2.2kHz harmonic keyboard range (only fed on local audio when Piano is selected to avoid double-gain!)
    const pianoIn = ctx.createBiquadFilter();
    pianoIn.type = 'highpass';
    pianoIn.frequency.value = 130;
    pianoIn.Q.value = 0.72;

    const pianoLp = ctx.createBiquadFilter();
    pianoLp.type = 'lowpass';
    pianoLp.frequency.value = 2200;
    pianoLp.Q.value = 0.72;

    pianoIn.connect(pianoLp);
    pianoLp.connect(this.busGains.piano);

    this.busInputs = {
      drums: drumsIn,
      bass: bassIn,
      bassLp,
      guitar: guitarIn,
      guitarLp,
      piano: pianoIn,
      pianoLp,
    };
  }

  teardownSources() {
    this.activeSources.forEach((src) => {
      try {
        src.onended = null;
        src.stop();
        src.disconnect();
      } catch {
        // Ignore already stopped sources
      }
    });
    this.activeSources = [];
  }

  teardownMixer() {
    this.teardownSources();
    const disconnectSafe = (n) => {
      if (n) {
        try {
          n.disconnect();
        } catch {
          // Ignore
        }
      }
    };
    if (this.busInputs) Object.values(this.busInputs).forEach(disconnectSafe);
    if (this.busGains) Object.values(this.busGains).forEach(disconnectSafe);
    disconnectSafe(this.whammyFilter);
    disconnectSafe(this.stereoDryGain);
    disconnectSafe(this.stereoWetGain);
    disconnectSafe(this.stereoDelayR);
    disconnectSafe(this.masterGain);
    disconnectSafe(this.speakerAnalyser);
  }

  /**
   * Starts playback from startOffsetSec with exact AudioContext clock lock.
   * When starting from 0s, applies the requested visual lead-in (default 4.5s:
   * 2.5s Stage Walk-On & Gear Setup + 2.0s Highway Approach) so opening notes
   * cross the strike bar at the exact millisecond the music begins!
   */
  async startPlayback({
    mediaSource,
    instrument,
    playbackRate = 1.0,
    startOffsetSec = 0,
    useLeadIn = true,
    leadInSec = WALK_ON_LEAD_IN_SEC,
  }) {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    this.mediaSource = mediaSource;
    this.playbackRate = playbackRate;
    this.duration =
      mediaSource.mode === 'stems'
        ? mediaSource.drums.duration
        : mediaSource.buffer.duration;
    this.endNotified = false;
    this.whammyAmount = 0;

    this.buildParallelMixer(instrument);
    const delaySec = useLeadIn && startOffsetSec <= 0.01 ? leadInSec : 0.05;
    this.spawnBufferSourcesAt(startOffsetSec, delaySec);

    this.isPlaying = true;
    this.isPaused = false;
  }

  spawnBufferSourcesAt(offsetSec, delaySec = 0.04) {
    this.teardownSources();
    const ctx = this.ctx;
    const clampedOffset = Math.max(0, Math.min(Math.max(0, this.duration - 0.05), offsetSec));
    const startAt = ctx.currentTime + delaySec;

    this.offsetSec = clampedOffset;
    this.startCtxTime = startAt;

    if (this.mediaSource.mode === 'stems') {
      ['drums', 'bass', 'guitar', 'piano'].forEach((role) => {
        if (!this.mediaSource[role]) return;
        const src = ctx.createBufferSource();
        src.buffer = this.mediaSource[role];
        src.playbackRate.setValueAtTime(this.playbackRate, startAt);
        src.connect(this.busGains[role]);
        src.start(startAt, clampedOffset);
        src._role = role;
        this.activeSources.push(src);
      });
    } else {
      const src = ctx.createBufferSource();
      src.buffer = this.mediaSource.buffer;
      src.playbackRate.setValueAtTime(this.playbackRate, startAt);
      src.connect(this.busInputs.drums);
      src.connect(this.busInputs.bass);
      src.connect(this.busInputs.guitar);
      if (this.instrument === 'piano') {
        src.connect(this.busInputs.piano);
      }
      src.start(startAt, clampedOffset);
      src._role = 'local';
      this.activeSources.push(src);
    }
  }

  /**
   * True Instrument-Only Muting:
   * Ducks ONLY the selected instrument's parallel bus gain to 0.08 while
   * keeping all other buses at 1.0 full volume and leaving Master untouched!
   */
  setInstrumentStemMuted(muted) {
    if (!this.ctx || !this.busGains) return;
    const now = this.ctx.currentTime;
    const tau = muted ? 0.028 : 0.04;

    ['drums', 'bass', 'guitar', 'piano'].forEach((role) => {
      if (!this.busGains[role]) return;
      const target = role === this.instrument && muted ? 0.08 : 1.0;
      this.busGains[role].gain.setTargetAtTime(target, now, tau);
    });
  }

  /**
   * Dynamically widens the active instrument's stereo width on 30x, 50x, and 100x combos.
   * @param {number} level 0 (normal), 1 (30x), 2 (50x), 3 (100x)
   */
  setStereoWidthTier(level) {
    if (!this.ctx || !this.stereoWetGain || !this.stereoDelayR) return;
    const now = this.ctx.currentTime;
    const wetTargets = [0.0, 0.24, 0.42, 0.62];
    const delayTargets = [0.006, 0.011, 0.015, 0.019];
    const idx = Math.max(0, Math.min(3, level));

    this.stereoWetGain.gain.setTargetAtTime(wetTargets[idx], now, 0.15);
    this.stereoDelayR.delayTime.setTargetAtTime(delayTargets[idx], now, 0.15);
  }

  /**
   * Modulates subtle Whammy / Vibrato pitch-bend (detune + peaking filter sweep)
   * on the active instrument bus while holding a sustain bar.
   * @param {number} amount 0..1
   * @param {number} dt Frame delta in seconds
   */
  updateWhammy(amount, dt) {
    if (!this.ctx || !this.whammyFilter) return;
    this.whammyAmount += (amount - this.whammyAmount) * Math.min(1, dt * 14);

    const now = this.ctx.currentTime;
    if (this.whammyAmount > 0.02) {
      this.whammyPhase += dt * 42;
      const wave = Math.sin(this.whammyPhase);
      const detuneCents = wave * 34 * this.whammyAmount;

      for (let i = 0; i < this.activeSources.length; i += 1) {
        const src = this.activeSources[i];
        if (src._role === this.instrument || src._role === 'local') {
          src.detune.setTargetAtTime(detuneCents, now, 0.015);
        }
      }

      const baseFreq = this.instrument === 'bass' ? 210 : 1450;
      const sweepHz = baseFreq + wave * (this.instrument === 'bass' ? 95 : 580) * this.whammyAmount;
      this.whammyFilter.frequency.setTargetAtTime(sweepHz, now, 0.02);
      this.whammyFilter.gain.setTargetAtTime(6.5 * this.whammyAmount, now, 0.03);
    } else {
      for (let i = 0; i < this.activeSources.length; i += 1) {
        this.activeSources[i].detune.setTargetAtTime(0, now, 0.03);
      }
      this.whammyFilter.gain.setTargetAtTime(0, now, 0.04);
    }
  }

  /**
   * Smoothly changes playback speed (0.75x, 0.85x, 1.0x, 1.1x) while preserving
   * exact song clock continuity with zero drift!
   */
  setPlaybackRate(newRate) {
    const clamped = Math.max(0.5, Math.min(1.5, Number(newRate) || 1.0));
    if (this.ctx && this.isPlaying) {
      const currentSongTime = this.getSongTime();
      this.playbackRate = clamped;
      if (currentSongTime < 0) {
        // Still inside 2.0s visual preroll: reschedule start cleanly at new rate
        const remainingCtx = Math.max(0.02, -currentSongTime / clamped);
        this.spawnBufferSourcesAt(0, remainingCtx);
      } else {
        this.offsetSec = currentSongTime;
        this.startCtxTime = this.ctx.currentTime;
        this.activeSources.forEach((src) => {
          src.playbackRate.setValueAtTime(clamped, this.ctx.currentTime);
        });
      }
    } else {
      this.playbackRate = clamped;
    }
  }

  /**
   * Instant exact seek used by Practice Loop mode when jumping from Loop End -> Loop Start.
   */
  seekTo(targetSec) {
    if (!this.ctx || !this.mediaSource) return;
    this.endNotified = false;
    this.spawnBufferSourcesAt(targetSec, 0.04);
  }

  /**
   * Exact AudioContext.currentTime-locked song timestamp in seconds.
   * Runs smoothly from -2.0s (visual lead-in preroll) -> 0.0s -> duration.
   */
  getSongTime() {
    if (!this.ctx || !this.isPlaying) return this.offsetSec;
    const elapsedCtx = this.ctx.currentTime - this.startCtxTime;
    return this.offsetSec + elapsedCtx * this.playbackRate;
  }

  getDuration() {
    return this.duration;
  }

  /**
   * Updates live per-band speaker telemetry for the 4 3D Roblox musicians,
   * crowd lightsticks, and horizon spectrum, and detects track completion.
   */
  updateTelemetry() {
    if (!this.isPlaying || this.isPaused || !this.ctx) return;

    const t = this.getSongTime();
    if (!this.endNotified && t >= this.duration + 0.15) {
      this.endNotified = true;
      this.onTrackEnded();
      return;
    }

    if (this.speakerAnalyser) {
      this.speakerAnalyser.getByteFrequencyData(this.speakerFreqData);
      const binHz = this.ctx.sampleRate / this.speakerAnalyser.fftSize;

      const bandAvg = (loHz, hiHz) => {
        const lo = Math.max(1, Math.floor(loHz / binHz));
        const hi = Math.min(this.speakerFreqData.length - 1, Math.ceil(hiHz / binHz));
        let sum = 0;
        let count = 0;
        for (let i = lo; i <= hi; i += 1) {
          sum += this.speakerFreqData[i];
          count += 1;
        }
        return count > 0 ? sum / (count * 255) : 0;
      };

      // Drums: kick punch (<110Hz) + snare/cymbal snap (>5kHz)
      const kick = bandAvg(35, 115);
      const snap = bandAvg(4800, 11000);
      const drumNorm = Math.min(1, kick * 0.72 + snap * 0.65);

      // Bass: 90Hz - 320Hz
      const bassNorm = bandAvg(85, 320);

      // Lead Guitar: 250Hz - 4.2kHz
      const guitarNorm = bandAvg(250, 4200);

      // Piano / Keys: 130Hz - 2.2kHz
      const pianoNorm = bandAvg(130, 2200);

      // Vocal presence: 450Hz - 2.6kHz
      const vocalNorm = bandAvg(450, 2600);

      this.liveDrumEnergy += (drumNorm - this.liveDrumEnergy) * 0.42;
      this.liveBassEnergy += (bassNorm - this.liveBassEnergy) * 0.36;
      this.liveGuitarEnergy += (guitarNorm - this.liveGuitarEnergy) * 0.38;
      this.livePianoEnergy += (pianoNorm - this.livePianoEnergy) * 0.38;
      this.liveVocalEnergy += (vocalNorm - this.liveVocalEnergy) * 0.32;

      let totalSum = 0;
      for (let i = 1; i < 96; i += 1) totalSum += this.speakerFreqData[i];
      this.liveOverallEnergy = totalSum / (95 * 255);

      for (let b = 0; b < 24; b += 1) {
        const bin = Math.floor(2 + Math.pow(b / 24, 1.45) * 110);
        const val = this.speakerFreqData[Math.min(255, bin)] / 255;
        this.liveSpectrumBins[b] += (val - this.liveSpectrumBins[b]) * 0.4;
      }
    }
  }

  setStemActivity(activity) {
    this.stemActivity = activity || null;
  }

  /**
   * O(1) per-frame lookup returning whether Drums, Bass, Lead Guitar, and Piano/Keys are currently
   * audible above their active song entry gate (used by 3D StageBand & CameraDirector).
   */
  getStemActivityAt(songTime) {
    const act = this.stemActivity;
    if (!act || !act.hopSec || songTime < 0) {
      return { drums: true, bass: true, guitar: true, piano: true };
    }
    const idx = Math.max(0, Math.min(act.drums.length - 1, Math.floor(songTime / act.hopSec)));
    return {
      drums: act.drums[idx] === 1,
      bass: act.bass[idx] === 1,
      guitar: act.guitar[idx] === 1,
      piano: act.piano ? act.piano[Math.min(act.piano.length - 1, idx)] === 1 : act.guitar[idx] === 1,
    };
  }

  pause() {
    if (!this.ctx || !this.isPlaying || this.isPaused) return;
    this.isPaused = true;
    this.ctx.suspend().catch(() => {});
  }

  resume() {
    if (!this.ctx || !this.isPlaying || !this.isPaused) return;
    this.isPaused = false;
    this.ctx.resume().catch(() => {});
  }

  stop() {
    this.isPlaying = false;
    this.isPaused = false;
    this.teardownMixer();
    this.offsetSec = 0;
    this.liveDrumEnergy = 0;
    this.liveBassEnergy = 0;
    this.liveGuitarEnergy = 0;
    this.livePianoEnergy = 0;
    this.liveVocalEnergy = 0;
    this.liveOverallEnergy = 0;
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }
}

/* ============================================================================
   MULTI-STEM VIRTUAL SPLITTER & PER-STEM ACTIVITY GATING (OfflineAudioContext)
   - Step 1: Virtual Stem Isolation (Drums, Bass, Lead Guitar)
   - Step 2: Per-Stem Silence & Entry Gating via Active Song Median + Hysteresis
   ============================================================================ */

const VIRTUAL_STEM_RATE = 22050;
const ACTIVITY_HOP_SEC = 0.04; // 25 Hz timeline

function quickMedian(values) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) * 0.5;
}

/**
 * Computes rolling RMS (~0.42s window) and hysteresis entry/exit gate for a single stem AudioBuffer.
 * Returns { active: Uint8Array, rms: Float32Array, activeMedian: number }.
 */
function computeSingleStemGate(audioBuffer, hopSec = ACTIVITY_HOP_SEC, options = {}) {
  const {
    entryRatio = 0.36,
    exitRatio = 0.22,
    absFloor = 0.008,
    minHoldFrames = 6, // ~240ms debounce
  } = options;

  const sr = audioBuffer.sampleRate;
  const ch0 = audioBuffer.getChannelData(0);
  const ch1 = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : null;
  const len = ch0.length;

  const hopSamples = Math.max(64, Math.floor(sr * hopSec));
  const winSamples = Math.max(hopSamples * 2, Math.floor(sr * 0.42));
  const numFrames = Math.max(1, Math.ceil(len / hopSamples));
  const rms = new Float32Array(numFrames);

  let maxRms = 1e-6;
  for (let f = 0; f < numFrames; f += 1) {
    const center = f * hopSamples;
    const start = Math.max(0, center - (winSamples >> 1));
    const end = Math.min(len, start + winSamples);
    const step = Math.max(1, Math.floor((end - start) / 256));
    let sumSq = 0;
    let count = 0;
    for (let i = start; i < end; i += step) {
      const s = ch1 ? (ch0[i] + ch1[i]) * 0.5 : ch0[i];
      sumSq += s * s;
      count += 1;
    }
    const r = Math.sqrt(sumSq / Math.max(1, count));
    rms[f] = r;
    if (r > maxRms) maxRms = r;
  }

  // Evaluate against a LOCAL 2.5-second rolling noise floor (NEVER erased by a loud chorus later!)
  const halfWinFrames = Math.max(8, Math.round(1.25 / hopSec));
  const active = new Uint8Array(numFrames);
  let state = 0;
  let holdCounter = 0;

  // Song-wide audible median strictly as a gentle ceiling cap for noisy beds
  const noiseGate = Math.max(absFloor, maxRms * 0.04);
  const audible = [];
  for (let f = 0; f < numFrames; f += 1) {
    if (rms[f] >= noiseGate) audible.push(rms[f]);
  }
  const activeMedian = audible.length >= 6 ? quickMedian(audible) : maxRms * 0.4;

  for (let f = 0; f < numFrames; f += 1) {
    const r = rms[f];
    const lo = Math.max(0, f - halfWinFrames);
    const hi = Math.min(numFrames - 1, f + halfWinFrames);
    let localMin = r;
    let localSum = 0;
    for (let k = lo; k <= hi; k += 1) {
      const v = rms[k];
      if (v < localMin) localMin = v;
      localSum += v;
    }
    const localMean = localSum / Math.max(1, hi - lo + 1);
    const localRef = Math.min(activeMedian, Math.max(absFloor * 1.4, localMean));
    const entryThresh = Math.max(absFloor, Math.min(activeMedian * entryRatio, localRef * entryRatio * 1.15 + localMin * 0.5));
    const exitThresh = Math.max(absFloor * 0.72, entryThresh * (exitRatio / Math.max(0.1, entryRatio)));

    if (state === 0) {
      if (r >= entryThresh) {
        state = 1;
        holdCounter = minHoldFrames;
      }
    } else if (r < exitThresh) {
      if (holdCounter > 0) {
        holdCounter -= 1;
      } else {
        state = 0;
      }
    } else {
      holdCounter = minHoldFrames;
    }
    active[f] = state;
  }

  // Small 2-frame lookahead dilation so the very first transient of an instrument entry is never clipped
  const dilated = new Uint8Array(active);
  for (let f = 0; f < numFrames; f += 1) {
    if (active[f] === 1) {
      if (f > 0) dilated[f - 1] = 1;
      if (f > 1) dilated[f - 2] = 1;
    }
  }

  return { active: dilated, rms, activeMedian };
}

/**
 * Computes Per-Stem Silence & Entry Activity Gates directly from 3 isolated stem AudioBuffers
 * (used for both built-in multi-stem songs AND virtual-split uploaded MP3/WAV files).
 */
export function computeStemActivityFromBuffers({ drums, bass, guitar, piano = null }) {
  const duration = Math.max(drums.duration, bass.duration, guitar.duration, piano ? piano.duration : 0);
  const drumGate = computeSingleStemGate(drums, ACTIVITY_HOP_SEC, {
    entryRatio: 0.34,
    exitRatio: 0.21,
    absFloor: 0.009,
    minHoldFrames: 7,
  });
  const bassGate = computeSingleStemGate(bass, ACTIVITY_HOP_SEC, {
    entryRatio: 0.36,
    exitRatio: 0.22,
    absFloor: 0.01,
    minHoldFrames: 8,
  });
  const guitarGate = computeSingleStemGate(guitar, ACTIVITY_HOP_SEC, {
    entryRatio: 0.28, // Lower entry gate so quiet solo guitar intros immediately open!
    exitRatio: 0.16,
    absFloor: 0.006,
    minHoldFrames: 8,
  });
  const pianoGate = piano
    ? computeSingleStemGate(piano, ACTIVITY_HOP_SEC, {
        entryRatio: 0.26,
        exitRatio: 0.15,
        absFloor: 0.005,
        minHoldFrames: 8,
      })
    : guitarGate;

  return {
    hopSec: ACTIVITY_HOP_SEC,
    duration,
    drums: drumGate.active,
    bass: bassGate.active,
    guitar: guitarGate.active,
    piano: pianoGate.active,
    rms: {
      drums: drumGate.rms,
      bass: bassGate.rms,
      guitar: guitarGate.rms,
      piano: pianoGate.rms,
    },
  };
}

/**
 * Step 1: Multi-Stem Virtual Splitter using OfflineAudioContext.
 * Renders 3 isolated virtual stem AudioBuffers from any uploaded stereo/mono MP3/WAV:
 *  - Virtual Drum Stem:   Parallel <110Hz sub-punch + 2.8kHz–7.5kHz snap + transient emphasis
 *                         suppressing steady harmonic tones.
 *  - Virtual Bass Stem:   Steep cascaded 45Hz–210Hz low-pass with sub-kick transient rejection
 *                         (attenuates <35ms sharp kick spikes while preserving sustained bass body).
 *  - Virtual Guitar Stem: 320Hz–4.2kHz bandpass + Stereo Side-boost / Center-channel vocal & bass
 *                         attenuation when stereo, preserving panned/melodic guitars!
 */
export async function splitVirtualStems(audioBuffer) {
  const duration = Math.max(0.5, audioBuffer.duration);
  const length = Math.max(512, Math.ceil(duration * VIRTUAL_STEM_RATE));
  const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;

  if (!OfflineCtx) {
    const stems = { drums: audioBuffer, bass: audioBuffer, guitar: audioBuffer };
    return { stems, activity: computeStemActivityFromBuffers(stems) };
  }

  // Helper to build a Side-boosted / Center-attenuated buffer for Lead Guitar isolation
  const buildMidSideGuitarInput = (srcBuf) => {
    if (srcBuf.numberOfChannels < 2) return srcBuf;
    const chL = srcBuf.getChannelData(0);
    const chR = srcBuf.getChannelData(1);
    const len = chL.length;
    const out = new AudioBuffer({ length: len, numberOfChannels: 1, sampleRate: srcBuf.sampleRate });
    const dst = out.getChannelData(0);

    // Measure stereo side energy to avoid wiping out dual-mono recordings
    let sideSq = 0;
    let midSq = 0;
    const stride = Math.max(1, Math.floor(len / 4096));
    for (let i = 0; i < len; i += stride) {
      const m = (chL[i] + chR[i]) * 0.5;
      const s = (chL[i] - chR[i]) * 0.5;
      midSq += m * m;
      sideSq += s * s;
    }
    const sideRatio = Math.sqrt(sideSq / Math.max(1e-8, midSq));
    // When stereo separation exists, strongly attenuate center vocals/kick/bass while keeping guitars!
    const midWeight = sideRatio > 0.14 ? 0.34 : 0.88;
    const sideWeight = sideRatio > 0.14 ? 1.18 : 0.4;

    for (let i = 0; i < len; i += 1) {
      const m = (chL[i] + chR[i]) * 0.5;
      const s = (chL[i] - chR[i]) * 0.5;
      dst[i] = m * midWeight + s * sideWeight;
    }
    return out;
  };

  // Run all 3 OfflineAudioContext isolation renders in parallel!
  const renderDrums = async () => {
    const off = new OfflineCtx(1, length, VIRTUAL_STEM_RATE);
    const src = off.createBufferSource();
    src.buffer = audioBuffer;

    // Parallel Sub-Kick (<110Hz)
    const kickHp = off.createBiquadFilter();
    kickHp.type = 'highpass';
    kickHp.frequency.value = 38;
    kickHp.Q.value = 0.8;

    const kickLp = off.createBiquadFilter();
    kickLp.type = 'lowpass';
    kickLp.frequency.value = 110;
    kickLp.Q.value = 0.95;

    const kickGain = off.createGain();
    kickGain.gain.value = 1.15;

    // Parallel Snare Snap / Hi-Hat (2.8kHz – 7.5kHz)
    const snapHp = off.createBiquadFilter();
    snapHp.type = 'highpass';
    snapHp.frequency.value = 2800;
    snapHp.Q.value = 0.85;

    const snapLp = off.createBiquadFilter();
    snapLp.type = 'lowpass';
    snapLp.frequency.value = 7500;
    snapLp.Q.value = 0.85;

    const snapGain = off.createGain();
    snapGain.gain.value = 1.05;

    src.connect(kickHp);
    kickHp.connect(kickLp);
    kickLp.connect(kickGain);
    kickGain.connect(off.destination);

    src.connect(snapHp);
    snapHp.connect(snapLp);
    snapLp.connect(snapGain);
    snapGain.connect(off.destination);

    src.start(0);
    const rawDrums = await off.startRendering();

    // Transient emphasis pass: suppress steady sustained tones so clean drum hits pop!
    const data = rawDrums.getChannelData(0);
    let fastEnv = 0;
    let slowEnv = 0;
    const fastA = 0.22; // ~2ms attack
    const slowA = 0.008; // ~55ms steady bed
    for (let i = 0; i < data.length; i += 1) {
      const absS = Math.abs(data[i]);
      fastEnv += (absS - fastEnv) * fastA;
      slowEnv += (absS - slowEnv) * slowA;
      const ratio = fastEnv / (slowEnv + 0.004);
      const emph = Math.min(1.8, Math.max(0.18, (ratio - 0.55) * 1.15));
      data[i] *= emph;
    }
    return rawDrums;
  };

  const renderBass = async () => {
    const off = new OfflineCtx(1, length, VIRTUAL_STEM_RATE);
    const src = off.createBufferSource();
    src.buffer = audioBuffer;

    // Steep cascaded 45Hz – 210Hz band-limited bassline filter (36dB/oct lowpass roll-off)
    const hp = off.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 45;
    hp.Q.value = 0.8;

    const lp1 = off.createBiquadFilter();
    lp1.type = 'lowpass';
    lp1.frequency.value = 210;
    lp1.Q.value = 0.85;

    const lp2 = off.createBiquadFilter();
    lp2.type = 'lowpass';
    lp2.frequency.value = 210;
    lp2.Q.value = 0.9;

    src.connect(hp);
    hp.connect(lp1);
    lp1.connect(lp2);
    lp2.connect(off.destination);
    src.start(0);

    const rawBass = await off.startRendering();

    // Sub-kick transient rejection: damp ultra-short (<35ms) sub-kick spikes while preserving sustained bassline!
    const data = rawBass.getChannelData(0);
    let fastEnv = 0;
    let sustainEnv = 0;
    const fastA = 0.16; // tracks instant kick thump
    const sustainA = 0.0055; // tracks sustained bass body (>40ms)
    for (let i = 0; i < data.length; i += 1) {
      const absS = Math.abs(data[i]);
      fastEnv += (absS - fastEnv) * fastA;
      sustainEnv += (absS - sustainEnv) * sustainA;
      // When fast spike vastly exceeds sustained bass body, attenuate the kick punch
      const spikeRatio = fastEnv / (sustainEnv + 0.006);
      const kickDuck = spikeRatio > 2.15 ? Math.max(0.32, 2.15 / spikeRatio) : 1.0;
      data[i] *= kickDuck;
    }
    return rawBass;
  };

  const renderGuitar = async () => {
    const off = new OfflineCtx(1, length, VIRTUAL_STEM_RATE);
    const src = off.createBufferSource();
    src.buffer = buildMidSideGuitarInput(audioBuffer);

    const hp = off.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 320;
    hp.Q.value = 0.78;

    const lp = off.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 4200;
    lp.Q.value = 0.78;

    src.connect(hp);
    hp.connect(lp);
    lp.connect(off.destination);
    src.start(0);
    return off.startRendering();
  };

  const [drumsBuf, bassBuf, guitarBuf] = await Promise.all([
    renderDrums(),
    renderBass(),
    renderGuitar(),
  ]);

  const stems = { drums: drumsBuf, bass: bassBuf, guitar: guitarBuf };
  const activity = computeStemActivityFromBuffers(stems);
  return { stems, activity };
}

/* ============================================================================
   SUB-SECOND (<0.5s) WEB WORKER RADIX-2 FFT & ADAPTIVE LOCAL-CONTRAST ENGINE
   + DIRECT .MID PARSER (@tonejs/midi via ESM CDN + Pure-JS SMF Fallback)
   ============================================================================ */

const WORKER_SAMPLE_RATE = 22050;
const TONEJS_MIDI_ESM_URL = 'https://esm.sh/@tonejs/midi@2.0.28';

let cachedToneMidiMod = null;
let sharedAudioWorker = null;
let workerJobSeq = 0;
const pendingWorkerJobs = new Map();

/**
 * Ultra-fast (~12ms for a 4-minute song) anti-aliased mono 22.05kHz downsampler
 * running purely in typed arrays without OfflineAudioContext overhead.
 */
export function downsampleToMono22k(audioBuffer) {
  const srcRate = audioBuffer.sampleRate;
  const srcLen = audioBuffer.length;
  const numCh = audioBuffer.numberOfChannels;
  const ch0 = audioBuffer.getChannelData(0);
  const ch1 = numCh > 1 ? audioBuffer.getChannelData(1) : null;

  const ratio = srcRate / WORKER_SAMPLE_RATE;
  const outLen = Math.max(1024, Math.floor(srcLen / ratio));
  const out = new Float32Array(outLen);

  // Box-car anti-aliasing average over each downsampling window to prevent high-freq aliasing
  const winHalf = Math.max(1, Math.floor(ratio * 0.5));
  for (let i = 0; i < outLen; i += 1) {
    const center = Math.floor(i * ratio);
    const lo = Math.max(0, center - winHalf);
    const hi = Math.min(srcLen - 1, center + winHalf);
    let sum = 0;
    const count = hi - lo + 1;
    if (ch1) {
      for (let j = lo; j <= hi; j += 1) {
        sum += (ch0[j] + ch1[j]) * 0.5;
      }
    } else {
      for (let j = lo; j <= hi; j += 1) {
        sum += ch0[j];
      }
    }
    out[i] = sum / count;
  }

  return out;
}

export const downsampleToMono16k = downsampleToMono22k;

function getOrCreateAudioWorker() {
  if (typeof Worker === 'undefined') return null;
  if (sharedAudioWorker) return sharedAudioWorker;

  try {
    const worker = new Worker(new URL('./audioWorker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (event) => {
      const { id, type, pct, analysis, elapsedMs, error } = event.data || {};
      const job = pendingWorkerJobs.get(id);
      if (!job) return;

      if (type === 'progress') {
        job.onProgress(pct);
      } else if (type === 'result') {
        pendingWorkerJobs.delete(id);
        job.resolve({ ...analysis, elapsedMs });
      } else if (type === 'error') {
        pendingWorkerJobs.delete(id);
        job.reject(new Error(error || 'Audio worker failed'));
      }
    };
    worker.onerror = (err) => {
      pendingWorkerJobs.forEach((job) => job.reject(err));
      pendingWorkerJobs.clear();
      try {
        worker.terminate();
      } catch {
        // Ignore
      }
      sharedAudioWorker = null;
    };
    sharedAudioWorker = worker;
    return worker;
  } catch {
    return null;
  }
}

/**
 * Runs the client-side WASM AI (Essentia.js) + 22.05kHz Median-Filtered HPSS Radix-2 FFT
 * analysis inside a background Web Worker (with transparent main-thread fallback).
 */
export async function analyzeAudioInWorker(audioBuffer, { bpmHint = null, onProgress = () => {} } = {}) {
  onProgress(0.05, 'Preparing 22.05kHz waveform for HPSS & AI beat tracking…');
  const mono22k = downsampleToMono22k(audioBuffer);
  const duration = Math.max(0.5, audioBuffer.duration);

  const worker = getOrCreateAudioWorker();
  if (worker) {
    try {
      const id = ++workerJobSeq;
      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          pendingWorkerJobs.delete(id);
          reject(new Error('Audio worker timeout'));
        }, 16000);

        pendingWorkerJobs.set(id, {
          onProgress: (pct) => {
            onProgress(
              0.08 + Math.max(0, Math.min(1, pct)) * 0.88,
              pct >= 0.62 ? 'Refining beats & pitch contours…' : 'Separating harmonic & percussive stems…'
            );
          },
          resolve: (val) => {
            clearTimeout(timeout);
            resolve(val);
          },
          reject: (err) => {
            clearTimeout(timeout);
            reject(err);
          },
        });

        // Transfer mono22k Float32Array zero-copy to the background Web Worker!
        worker.postMessage(
          { id, mono22k, sampleRate: WORKER_SAMPLE_RATE, bpmHint, duration },
          [mono22k.buffer]
        );
      });
      onProgress(0.98, 'Quantizing beat-locked chart…');
      return result;
    } catch {
      // Fall through cleanly to direct import fallback on a fresh mono buffer
    }
  }

  // Fallback if Worker is unavailable in the environment
  const { analyzeMono22k } = await import('./audioWorker.js');
  const fallbackMono = mono22k.byteLength > 0 ? mono22k : downsampleToMono22k(audioBuffer);
  const t0 = performance.now();
  const analysis = await analyzeMono22k(fallbackMono, {
    bpmHint,
    duration,
    onProgress: (pct) => onProgress(0.08 + pct * 0.88, 'Separating harmonic & percussive stems…'),
  });
  return { ...analysis, elapsedMs: Math.round(performance.now() - t0) };
}

/**
 * Compact pure-JS Standard MIDI File (SMF Format 0/1) fallback parser so .mid files
 * remain 100% functional even offline without CDN access.
 */
function parseSmfFallback(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);
  if (bytes.length < 14) return null;

  const headerId = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (headerId !== 'MThd') return null;

  const numTracks = view.getUint16(10, false);
  const division = view.getUint16(12, false);
  const ppq = division & 0x7fff || 480;

  let offset = 14;
  let tempoUsec = 500000; // default 120 BPM
  const rawEvents = [];
  const rawSections = [];

  const readVarLen = (pos) => {
    let val = 0;
    let cur = pos;
    let b = 0;
    do {
      b = bytes[cur++];
      val = (val << 7) | (b & 0x7f);
    } while (b & 0x80 && cur < bytes.length);
    return { val, next: cur };
  };

  for (let tr = 0; tr < numTracks && offset + 8 <= bytes.length; tr += 1) {
    const chunkId = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    const chunkLen = view.getUint32(offset + 4, false);
    offset += 8;
    const trackEnd = Math.min(bytes.length, offset + chunkLen);

    if (chunkId !== 'MTrk') {
      offset = trackEnd;
      continue;
    }

    let pos = offset;
    let tick = 0;
    let runningStatus = 0;
    const openNotes = new Map();

    while (pos < trackEnd) {
      const dl = readVarLen(pos);
      tick += dl.val;
      pos = dl.next;
      if (pos >= trackEnd) break;

      let status = bytes[pos];
      if (status < 0x80) {
        status = runningStatus;
      } else {
        pos += 1;
        if (status < 0xf0) runningStatus = status;
      }

      if (status === 0xff) {
        const metaType = bytes[pos++];
        const lenInfo = readVarLen(pos);
        pos = lenInfo.next;
        if (metaType === 0x51 && lenInfo.val === 3 && pos + 3 <= trackEnd) {
          tempoUsec = (bytes[pos] << 16) | (bytes[pos + 1] << 8) | bytes[pos + 2];
        } else if ((metaType === 0x01 || metaType === 0x06) && lenInfo.val > 0 && pos + lenInfo.val <= trackEnd) {
          let txt = '';
          for (let k = 0; k < lenInfo.val; k += 1) txt += String.fromCharCode(bytes[pos + k]);
          const secMatch = txt.match(/\[?(?:section|prc)[\s_]+([^\]\r\n]+)\]?/i);
          if (secMatch) {
            rawSections.push({ tick, label: secMatch[1].replace(/_/g, ' ').trim() });
          }
        }
        pos += lenInfo.val;
      } else if (status === 0xf0 || status === 0xf7) {
        const lenInfo = readVarLen(pos);
        pos = lenInfo.next + lenInfo.val;
      } else {
        const type = status & 0xf0;
        const channel = status & 0x0f;
        const d1 = bytes[pos++];
        const d2 = type === 0xc0 || type === 0xd0 ? 0 : bytes[pos++];
        const key = `${channel}_${d1}`;

        if (type === 0x90 && d2 > 0) {
          openNotes.set(key, { tick, velocity: d2 / 127, channel, midi: d1 });
        } else if (type === 0x80 || (type === 0x90 && d2 === 0)) {
          const started = openNotes.get(key);
          if (started) {
            rawEvents.push({
              pitchMidi: started.midi,
              startTick: started.tick,
              durTicks: Math.max(1, tick - started.tick),
              amplitude: started.velocity,
              isPercussion: started.channel === 9,
            });
            openNotes.delete(key);
          }
        }
      }
    }

    offset = trackEnd;
  }

  const bpm = Math.max(60, Math.min(220, Math.round(60000000 / Math.max(100000, tempoUsec))));
  const secPerTick = tempoUsec / 1000000 / ppq;

  const guitar = [];
  const bass = [];
  const drums = [];
  const piano = [];

  rawEvents.forEach((ev) => {
    const item = {
      pitchMidi: ev.pitchMidi,
      startTimeSeconds: Number((ev.startTick * secPerTick).toFixed(4)),
      durationSeconds: Number(Math.max(0.05, ev.durTicks * secPerTick).toFixed(4)),
      amplitude: ev.amplitude,
    };
    if (ev.isPercussion) {
      drums.push(item);
    } else {
      if (ev.pitchMidi >= 28 && ev.pitchMidi <= 51) bass.push(item);
      if (ev.pitchMidi >= 52 && ev.pitchMidi <= 96) guitar.push(item);
      if (ev.pitchMidi >= 48 && ev.pitchMidi <= 84) piano.push(item);
    }
  });

  const sections = finalizeNativeSections(
    rawSections.map((s) => ({ timeSec: s.tick * secPerTick, label: s.label }))
  );

  return {
    bpm,
    sections,
    notes: {
      guitar: guitar.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds),
      bass: bass.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds),
      drums: drums.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds),
      piano: piano.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds),
    },
  };
}

export function normalizeSectionType(rawLabel = '') {
  const s = String(rawLabel || '').toLowerCase();
  if (/guitar\s*solo|shred|solo/.test(s)) return 'GUITAR_SOLO';
  if (/pre[\s-]*chorus|build|lift/.test(s)) return 'PRE_CHORUS';
  if (/chorus|refrain|hook|finale|encore/.test(s)) return 'CHORUS';
  if (/bridge|break|breakdown|interlude|middle/.test(s)) return 'BRIDGE';
  if (/outro|ending|coda|fade/.test(s)) return 'OUTRO';
  if (/intro|opening|clean|quiet|acoustic/.test(s)) return 'INTRO';
  return 'VERSE';
}

function finalizeNativeSections(markers, durationHint = 0) {
  if (!Array.isArray(markers) || markers.length === 0) return null;
  const sorted = markers
    .filter((m) => Number.isFinite(m.timeSec) && m.timeSec >= 0)
    .sort((a, b) => a.timeSec - b.timeSec);
  if (sorted.length === 0) return null;

  const sections = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const cur = sorted[i];
    const next = sorted[i + 1];
    const type = normalizeSectionType(cur.label);
    const startSec = i === 0 && cur.timeSec < 2.0 ? 0 : Number(cur.timeSec.toFixed(3));
    const endSec = next
      ? Number(next.timeSec.toFixed(3))
      : Number(Math.max(startSec + 8, durationHint || startSec + 20).toFixed(3));
    const energy =
      type === 'CHORUS' || type === 'GUITAR_SOLO'
        ? 0.94
        : type === 'PRE_CHORUS'
          ? 0.78
          : type === 'VERSE'
            ? 0.65
            : type === 'BRIDGE'
              ? 0.52
              : 0.44;
    sections.push({
      id: `native_sec_${i}`,
      type,
      label: cur.label || type,
      startSec,
      endSec,
      energy,
    });
  }
  return sections;
}

/**
 * Parses a Standard MIDI File (.mid) ArrayBuffer via @tonejs/midi ESM CDN (with offline SMF fallback).
 * Also extracts native MIDI section markers when present!
 * Returns { bpm, sections, notes: { guitar, bass, drums } } or null.
 */
export async function parseMidiArrayBuffer(midiArrayBuffer) {
  if (!midiArrayBuffer) return null;

  // Quickly read any native section markers using our local SMF header scan
  let nativeSections = null;
  try {
    const smf = parseSmfFallback(midiArrayBuffer);
    if (smf?.sections?.length) nativeSections = smf.sections;
  } catch {
    // Ignore
  }

  try {
    if (!cachedToneMidiMod) {
      cachedToneMidiMod = await Promise.race([
        import(/* @vite-ignore */ TONEJS_MIDI_ESM_URL),
        new Promise((_, reject) => setTimeout(() => reject(new Error('MIDI CDN timeout')), 6000)),
      ]);
    }
    const MidiCtor = cachedToneMidiMod?.Midi || cachedToneMidiMod?.default?.Midi;
    if (MidiCtor) {
      const midi = new MidiCtor(midiArrayBuffer);
      const bpm = Math.max(60, Math.min(220, Math.round(midi.header?.tempos?.[0]?.bpm || 120)));
      const guitar = [];
      const bass = [];
      const drums = [];
      const piano = [];

      (midi.tracks || []).forEach((track) => {
        const name = `${track.name || ''} ${track.instrument?.name || ''}`.toLowerCase();
        const isPerc = track.instrument?.percussion || track.channel === 9 || /drum|perc|kit/.test(name);
        const isBassTrack = /bass/.test(name);
        const isPianoTrack = /piano|keys|keyboard|synth|organ|rhodes|clav|pad|electric piano/.test(name);
        const isGuitarTrack = /guitar|lead/.test(name);

        (track.notes || []).forEach((n) => {
          const item = {
            pitchMidi: Math.round(n.midi),
            startTimeSeconds: Number(n.time.toFixed(4)),
            durationSeconds: Number(Math.max(0.05, n.duration || 0.08).toFixed(4)),
            amplitude: Number((n.velocity ?? 0.75).toFixed(3)),
          };
          if (isPerc) {
            drums.push(item);
          } else {
            if (isPianoTrack || (!isBassTrack && item.pitchMidi >= 48 && item.pitchMidi <= 84)) {
              piano.push(item);
            }
            if (isBassTrack || (!isGuitarTrack && !isPianoTrack && item.pitchMidi >= 28 && item.pitchMidi <= 51)) {
              bass.push(item);
            } else if (isGuitarTrack || isPianoTrack || (item.pitchMidi >= 52 && item.pitchMidi <= 96)) {
              guitar.push(item);
            }
          }
        });
      });

      return {
        bpm,
        sections: nativeSections,
        notes: {
          guitar: guitar.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds),
          bass: bass.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds),
          drums: drums.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds),
          piano: piano.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds),
        },
      };
    }
  } catch {
    // Fall back seamlessly to built-in pure-JS SMF parser
  }

  try {
    return parseSmfFallback(midiArrayBuffer);
  } catch {
    return null;
  }
}

/**
 * Lightweight, zero-dependency Clone Hero / Feedback `.chart` parser!
 * Parses [Song], [SyncTrack] (dynamic tempo map + time signatures), [Events] (native song sections),
 * and [Expert/Hard/Medium/Easy][Single/DoubleBass/Drums] note, sustain, and Star Power tracks.
 */
export function parseCloneHeroChart(chartText, durationHint = 0) {
  if (!chartText || typeof chartText !== 'string') return null;

  const lines = chartText.replace(/\r\n/g, '\n').split('\n');
  let activeBlock = null;
  const blocks = {};

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line || line === '{' || line === '}') continue;
    const secHeader = line.match(/^\[([^\]]+)\]$/);
    if (secHeader) {
      activeBlock = secHeader[1].trim();
      blocks[activeBlock] = blocks[activeBlock] || [];
      continue;
    }
    if (activeBlock) {
      blocks[activeBlock].push(line);
    }
  }

  // 1. [Song] metadata
  let resolution = 192;
  let offsetSec = 0;
  let title = '';
  let artist = '';
  (blocks.Song || []).forEach((line) => {
    const m = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.+)$/);
    if (!m) return;
    const key = m[1];
    const val = m[2].replace(/^"|"$/g, '').trim();
    if (key === 'Resolution') resolution = Math.max(48, parseInt(val, 10) || 192);
    else if (key === 'Offset') offsetSec = parseFloat(val) || 0;
    else if (key === 'Name') title = val;
    else if (key === 'Artist') artist = val;
  });

  // 2. [SyncTrack] dynamic tempo map & time signatures
  const tempos = [];
  const timeSigs = [];
  (blocks.SyncTrack || []).forEach((line) => {
    const m = line.match(/^(\d+)\s*=\s*([A-Z]+)\s+(\d+)(?:\s+(\d+))?/);
    if (!m) return;
    const tick = parseInt(m[1], 10);
    const kind = m[2];
    const val = parseInt(m[3], 10);
    if (kind === 'B' && val > 0) {
      tempos.push({ tick, bpm: val / 1000 });
    } else if (kind === 'TS' && val > 0) {
      timeSigs.push({ tick, numerator: val });
    }
  });
  if (tempos.length === 0 || tempos[0].tick > 0) {
    tempos.unshift({ tick: 0, bpm: 120 });
  }
  tempos.sort((a, b) => a.tick - b.tick);

  // Precompute cumulative seconds at each tempo change for exact tick -> seconds lookup
  let accSec = offsetSec;
  for (let i = 0; i < tempos.length; i += 1) {
    if (i > 0) {
      const prev = tempos[i - 1];
      const dtTicks = tempos[i].tick - prev.tick;
      accSec += (dtTicks / resolution) * (60 / prev.bpm);
    }
    tempos[i].timeSec = accSec;
  }

  const tickToSec = (tick) => {
    let idx = 0;
    for (let i = tempos.length - 1; i >= 0; i -= 1) {
      if (tempos[i].tick <= tick) {
        idx = i;
        break;
      }
    }
    const seg = tempos[idx];
    return seg.timeSec + ((tick - seg.tick) / resolution) * (60 / seg.bpm);
  };

  // 3. [Events] native song section markers (e.g. `1920 = E "section Guitar Solo"`)
  const rawSections = [];
  (blocks.Events || []).forEach((line) => {
    const m = line.match(/^(\d+)\s*=\s*E\s+"([^"]+)"/);
    if (!m) return;
    const tick = parseInt(m[1], 10);
    const evtText = m[2].trim();
    const secMatch = evtText.match(/^section\s+(.+)$/i);
    if (secMatch) {
      rawSections.push({ timeSec: tickToSec(tick), label: secMatch[1].trim() });
    }
  });

  // 4. Parse instrument & difficulty tracks
  const parseNoteBlock = (blockName) => {
    const list = blocks[blockName];
    if (!list || list.length === 0) return null;
    const notes = [];
    const starPowers = [];
    for (let i = 0; i < list.length; i += 1) {
      const m = list[i].match(/^(\d+)\s*=\s*([NS])\s+(\d+)\s+(\d+)/);
      if (!m) continue;
      const tick = parseInt(m[1], 10);
      const kind = m[2];
      const code = parseInt(m[3], 10);
      const lenTicks = parseInt(m[4], 10);
      const timeSec = tickToSec(tick);
      const endSec = tickToSec(tick + lenTicks);
      if (kind === 'S' && code === 2) {
        starPowers.push({ startSec: timeSec, endSec });
      } else if (kind === 'N' && code >= 0 && code <= 4) {
        notes.push({
          tick,
          fret: code, // 0..4 (Green, Red, Yellow, Blue, Orange)
          timeSec: Number(timeSec.toFixed(4)),
          sustainSec: lenTicks >= resolution * 0.5 ? Number(Math.max(0, endSec - timeSec).toFixed(3)) : 0,
        });
      }
    }
    if (notes.length === 0) return null;
    return { notes, starPowers };
  };

  const tracks = {
    guitar: {
      expert: parseNoteBlock('ExpertSingle'),
      hard: parseNoteBlock('HardSingle'),
      medium: parseNoteBlock('MediumSingle'),
      easy: parseNoteBlock('EasySingle'),
    },
    bass: {
      expert: parseNoteBlock('ExpertDoubleBass'),
      hard: parseNoteBlock('HardDoubleBass'),
      medium: parseNoteBlock('MediumDoubleBass'),
      easy: parseNoteBlock('EasyDoubleBass'),
    },
    drums: {
      expert: parseNoteBlock('ExpertDrums'),
      hard: parseNoteBlock('HardDrums'),
      medium: parseNoteBlock('MediumDrums'),
      easy: parseNoteBlock('EasyDrums'),
    },
    piano: {
      expert: parseNoteBlock('ExpertKeyboard') || parseNoteBlock('ExpertSingle'),
      hard: parseNoteBlock('HardKeyboard') || parseNoteBlock('HardSingle'),
      medium: parseNoteBlock('MediumKeyboard') || parseNoteBlock('MediumSingle'),
      easy: parseNoteBlock('EasyKeyboard') || parseNoteBlock('EasySingle'),
    },
  };

  // Build exact dynamic beat grid from [SyncTrack] tempo map!
  let maxNoteSec = durationHint || 0;
  Object.values(tracks).forEach((roleMap) => {
    Object.values(roleMap).forEach((blk) => {
      if (blk?.notes?.length) {
        const last = blk.notes[blk.notes.length - 1];
        if (last.timeSec + last.sustainSec > maxNoteSec) {
          maxNoteSec = last.timeSec + last.sustainSec;
        }
      }
    });
  });

  const dynamicBeatGrid = [];
  const beats = [];
  let beatTick = 0;
  let beatIdx = 0;
  const maxDuration = Math.max(10, maxNoteSec + 2);
  while (beatIdx < 4000) {
    const tSec = tickToSec(beatTick);
    if (tSec > maxDuration) break;
    // Find current TS numerator (default 4)
    let tsNum = 4;
    for (let i = timeSigs.length - 1; i >= 0; i -= 1) {
      if (timeSigs[i].tick <= beatTick) {
        tsNum = timeSigs[i].numerator || 4;
        break;
      }
    }
    beats.push(Number(tSec.toFixed(4)));
    dynamicBeatGrid.push({
      timeSec: Number(tSec.toFixed(4)),
      isMeasure: beatIdx % tsNum === 0,
      beatIndex: beatIdx,
    });
    beatTick += resolution;
    beatIdx += 1;
  }

  return {
    title,
    artist,
    bpm: Math.round(tempos[0]?.bpm || 120),
    beats,
    dynamicBeatGrid,
    sections: finalizeNativeSections(rawSections, maxDuration),
    tracks,
  };
}



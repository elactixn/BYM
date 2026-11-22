/**
 * soundEffects.js
 * Procedural Web Audio synthesizer with:
 *  - Dedicated Stadium Crowd Audio Engine routed through a DynamicsCompressorNode
 *    + dedicated crowdMasterGain (default 0.75) directly to audioContext.destination,
 *    completely bypassing any instrument-muting buses!
 *  - Explicit first-gesture unlockAudio() guaranteeing AudioContext.resume().
 *  - Rich stereo stadium crowd audio: continuous pink+white multi-band crowd bed,
 *    BPM-synced rhythmic clapping bursts, rising stadium roars on 15x/30x/50x combos
 *    and Fever Mode, rhythmic "WE WANT MORE!" & "EN-CORE! EN-CORE!" crowd chants,
 *    loud standing ovation at song end, and an instant "Test Crowd Cheer" trigger.
 *  - 3D spatial StereoPannerNode lane hits, sustain sparks, miss buzzes, pyro blasts,
 *    and aerial firework bursts.
 */

export function getLanePan(laneIndex, laneCount) {
  if (laneCount <= 1) return 0;
  const normalized = laneIndex / (laneCount - 1);
  return -0.8 + normalized * 1.6;
}

export class SoundEffects {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.crowdVolume = 0.75;
    this.noiseBuffer = null;
    this.pinkCrowdBuffer = null;

    // Dedicated stadium crowd compressor + master gain bus (independent of music stem buses)
    this.crowdBusInput = null;
    this.crowdCompressor = null;
    this.crowdMasterGain = null;

    // Continuous reactive stadium crowd bed nodes
    this.crowdNodes = null;
    this.lastRestlessGroanMs = 0;
    this.lastBeatClapIdx = -1;
  }

  attachContext(audioCtx) {
    if (!audioCtx) return;
    if (this.ctx !== audioCtx) {
      this.stopCrowdAmbience();
      this.teardownCrowdBus();
      this.ctx = audioCtx;
      this.noiseBuffer = null;
      this.pinkCrowdBuffer = null;
    }
    this.ensureBuffersAndCrowdBus();
  }

  /**
   * Explicitly unlocks & resumes the Web Audio context on the very first user gesture.
   */
  unlockAudio(existingCtx = null) {
    if (existingCtx && this.ctx !== existingCtx) {
      this.attachContext(existingCtx);
    }
    const ctx = this.ensureContext({ ignoreMute: true });
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  teardownCrowdBus() {
    if (this.crowdBusInput) {
      try {
        this.crowdBusInput.disconnect();
        this.crowdCompressor.disconnect();
        this.crowdMasterGain.disconnect();
      } catch {
        // Ignore
      }
    }
    this.crowdBusInput = null;
    this.crowdCompressor = null;
    this.crowdMasterGain = null;
  }

  ensureBuffersAndCrowdBus() {
    if (!this.ctx) return;
    if (!this.noiseBuffer) {
      this.noiseBuffer = this.createNoiseBuffer(this.ctx, 2.5);
    }
    if (!this.pinkCrowdBuffer) {
      this.pinkCrowdBuffer = this.createPinkCrowdBuffer(this.ctx, 4.2);
    }
    if (!this.crowdBusInput) {
      const ctx = this.ctx;
      this.crowdBusInput = ctx.createGain();
      this.crowdBusInput.gain.value = 1.0;

      // Dedicated stadium broadcast compressor makes cheers & claps punchy & unmistakable
      this.crowdCompressor = ctx.createDynamicsCompressor();
      this.crowdCompressor.threshold.setValueAtTime(-16, ctx.currentTime);
      this.crowdCompressor.knee.setValueAtTime(14, ctx.currentTime);
      this.crowdCompressor.ratio.setValueAtTime(4.0, ctx.currentTime);
      this.crowdCompressor.attack.setValueAtTime(0.008, ctx.currentTime);
      this.crowdCompressor.release.setValueAtTime(0.22, ctx.currentTime);

      this.crowdMasterGain = ctx.createGain();
      this.crowdMasterGain.gain.value = this.muted ? 0.0 : this.crowdVolume;

      this.crowdBusInput.connect(this.crowdCompressor);
      this.crowdCompressor.connect(this.crowdMasterGain);
      this.crowdMasterGain.connect(ctx.destination);
    }
  }

  ensureContext({ ignoreMute = false } = {}) {
    if (this.muted && !ignoreMute) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this.ensureBuffersAndCrowdBus();
    return this.ctx;
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.ctx && this.crowdMasterGain) {
      const now = this.ctx.currentTime;
      this.crowdMasterGain.gain.setTargetAtTime(this.muted ? 0.0 : this.crowdVolume, now, 0.05);
    }
  }

  setCrowdVolume(vol) {
    const clamped = Math.max(0, Math.min(1, Number(vol)));
    this.crowdVolume = Number.isFinite(clamped) ? clamped : 0.75;
    if (this.ctx && this.crowdMasterGain && !this.muted) {
      this.crowdMasterGain.gain.setTargetAtTime(this.crowdVolume, this.ctx.currentTime, 0.04);
    }
  }

  createNoiseBuffer(ctx, durationSec) {
    const length = Math.floor(ctx.sampleRate * durationSec);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch += 1) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i += 1) {
        data[i] = Math.random() * 2 - 1;
      }
    }
    return buffer;
  }

  /**
   * Generates a lush stereo pink-weighted noise loop ideal for stadium crowd ambience & roars.
   */
  createPinkCrowdBuffer(ctx, durationSec) {
    const length = Math.floor(ctx.sampleRate * durationSec);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch += 1) {
      const data = buffer.getChannelData(ch);
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      let b3 = 0;
      let b4 = 0;
      let b5 = 0;
      let b6 = 0;
      for (let i = 0; i < length; i += 1) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.14;
        b6 = white * 0.115926;
        data[i] = Math.max(-1, Math.min(1, pink));
      }
      const fade = Math.min(1400, Math.floor(length * 0.05));
      for (let i = 0; i < fade; i += 1) {
        const u = i / fade;
        const idx = length - fade + i;
        data[idx] = data[idx] * (1 - u) + data[i] * u;
      }
    }
    return buffer;
  }

  createCrowdPanner(ctx, pan) {
    if (typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), ctx.currentTime);
      panner.connect(this.crowdBusInput);
      return panner;
    }
    return this.crowdBusInput;
  }

  createPanner(ctx, pan) {
    if (typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), ctx.currentTime);
      panner.connect(ctx.destination);
      return panner;
    }
    return ctx.destination;
  }

  /**
   * Starts continuous stereo stadium crowd ambience routed directly into the dedicated crowd compressor bus.
   */
  startCrowdAmbience() {
    const ctx = this.ensureContext({ ignoreMute: true });
    if (!ctx || !this.crowdBusInput) return;
    if (this.crowdNodes) return;

    const srcPink = ctx.createBufferSource();
    srcPink.buffer = this.pinkCrowdBuffer;
    srcPink.loop = true;

    const srcWhite = ctx.createBufferSource();
    srcWhite.buffer = this.noiseBuffer;
    srcWhite.loop = true;

    // Warm stadium body roar (450–900 Hz)
    const bodyFilter = ctx.createBiquadFilter();
    bodyFilter.type = 'bandpass';
    bodyFilter.frequency.value = 580;
    bodyFilter.Q.value = 0.65;

    // Bright cheering sheen & crowd excitement (1.2k–2.4k Hz)
    const cheerFilter = ctx.createBiquadFilter();
    cheerFilter.type = 'bandpass';
    cheerFilter.frequency.value = 1480;
    cheerFilter.Q.value = 0.85;

    const cheerGain = ctx.createGain();
    cheerGain.gain.value = 0.35;

    const bedGain = ctx.createGain();
    bedGain.gain.value = 0.001;

    // Organic stadium wave swell LFO
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.32;
    lfoGain.gain.value = 95;
    lfo.connect(lfoGain);
    lfoGain.connect(bodyFilter.frequency);

    srcPink.connect(bodyFilter);
    bodyFilter.connect(bedGain);

    srcWhite.connect(cheerFilter);
    cheerFilter.connect(cheerGain);
    cheerGain.connect(bedGain);

    bedGain.connect(this.crowdBusInput);

    const now = ctx.currentTime;
    srcPink.start(now);
    srcWhite.start(now);
    lfo.start(now);

    this.lastBeatClapIdx = -1;
    this.crowdNodes = {
      srcPink,
      srcWhite,
      lfo,
      lfoGain,
      bodyFilter,
      cheerFilter,
      cheerGain,
      bedGain,
    };
  }

  /**
   * Updates stadium crowd bed & BPM-synced crowd clapping bursts every frame.
   */
  updateCrowdState({ hype = 58, feverActive = false, playing = false, bpm = 120, songTime = 0, isEncore = false } = {}) {
    if (!this.crowdNodes || !this.ctx) return;
    const now = this.ctx.currentTime;

    if (!playing) {
      this.crowdNodes.bedGain.gain.setTargetAtTime(0.0, now, 0.14);
      return;
    }

    const normHype = Math.max(0, Math.min(1, hype / 100));
    const isRestless = hype < 25;

    if (feverActive || isEncore) {
      const mult = feverActive ? 1.25 : 1.05;
      this.crowdNodes.bodyFilter.frequency.setTargetAtTime(880, now, 0.18);
      this.crowdNodes.cheerFilter.frequency.setTargetAtTime(1880, now, 0.18);
      this.crowdNodes.cheerGain.gain.setTargetAtTime(0.75 * mult, now, 0.16);
      this.crowdNodes.bedGain.gain.setTargetAtTime(0.32 * mult, now, 0.16);
    } else if (isRestless) {
      this.crowdNodes.bodyFilter.frequency.setTargetAtTime(280, now, 0.22);
      this.crowdNodes.cheerFilter.frequency.setTargetAtTime(620, now, 0.22);
      this.crowdNodes.cheerGain.gain.setTargetAtTime(0.06, now, 0.2);
      this.crowdNodes.bedGain.gain.setTargetAtTime(0.18, now, 0.2);

      const perfNow = performance.now();
      if (perfNow - this.lastRestlessGroanMs > 3000) {
        this.lastRestlessGroanMs = perfNow;
        this.playRestlessMurmurWave();
      }
    } else {
      const bodyHz = 460 + normHype * 380;
      const cheerHz = 1120 + normHype * 640;
      const cheerMix = 0.22 + normHype * 0.54;
      const level = 0.11 + normHype * 0.17;

      this.crowdNodes.bodyFilter.frequency.setTargetAtTime(bodyHz, now, 0.2);
      this.crowdNodes.cheerFilter.frequency.setTargetAtTime(cheerHz, now, 0.2);
      this.crowdNodes.cheerGain.gain.setTargetAtTime(cheerMix, now, 0.2);
      this.crowdNodes.bedGain.gain.setTargetAtTime(level, now, 0.2);
    }

    // Rhythmic stadium crowd clapping on the beat when hype >= 65% or Fever/Encore active!
    if ((hype >= 65 || feverActive || isEncore) && songTime > 0.2 && bpm >= 65) {
      const beatSec = 60 / bpm;
      const beatIdx = Math.floor(songTime / beatSec);
      if (beatIdx !== this.lastBeatClapIdx) {
        this.lastBeatClapIdx = beatIdx;
        // Clap on beats 2 & 4 (or every beat during Fever!)
        if (feverActive || beatIdx % 2 === 1) {
          this.playStadiumBeatClap(feverActive ? 0.95 : 0.58 + normHype * 0.3);
        }
      }
    }
  }

  /**
   * Fires a realistic layered stereo crowd hand-clap burst synchronized to the song beat!
   */
  playStadiumBeatClap(intensity = 0.75) {
    const ctx = this.ensureContext();
    if (!ctx || !this.crowdBusInput) return;
    const now = ctx.currentTime;

    const layers = [-0.62, -0.18, 0.22, 0.65];
    for (let i = 0; i < layers.length; i += 1) {
      const t = now + i * 0.008 + Math.random() * 0.014;
      const out = this.createCrowdPanner(ctx, layers[i]);
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1150 + Math.random() * 950, t);
      bp.Q.setValueAtTime(1.4, t);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.16 * intensity, t + 0.007);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.072);

      src.connect(bp);
      bp.connect(g);
      g.connect(out);
      src.start(t, Math.random() * 1.2, 0.085);
    }
  }

  playRestlessMurmurWave() {
    const ctx = this.ensureContext();
    if (!ctx || !this.crowdBusInput) return;
    const now = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.pinkCrowdBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(380, now);
    bp.frequency.exponentialRampToValueAtTime(215, now + 0.85);
    bp.Q.setValueAtTime(2.0, now);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.28, now + 0.22);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.95);

    src.connect(bp);
    bp.connect(g);
    g.connect(this.crowdBusInput);
    src.start(now, Math.random() * 1.5, 1.0);
  }

  stopCrowdAmbience() {
    if (!this.crowdNodes) return;
    try {
      this.crowdNodes.srcPink.stop();
      this.crowdNodes.srcWhite.stop();
      this.crowdNodes.lfo.stop();
      this.crowdNodes.srcPink.disconnect();
      this.crowdNodes.srcWhite.disconnect();
      this.crowdNodes.lfo.disconnect();
      this.crowdNodes.bedGain.disconnect();
    } catch {
      // Ignore
    }
    this.crowdNodes = null;
  }

  /**
   * Instant verification button ("Test Crowd Cheer") in the Pause/Calibrate drawer!
   */
  playTestCrowdCheer() {
    const ctx = this.unlockAudio();
    if (!ctx || !this.crowdBusInput) return;
    if (this.crowdMasterGain) {
      this.crowdMasterGain.gain.setTargetAtTime(Math.max(0.15, this.crowdVolume), ctx.currentTime, 0.02);
    }
    this.playComboCheer(50, { forceAudible: true });
    window.setTimeout(() => this.playStadiumBeatClap(1.0), 180);
    window.setTimeout(() => this.playStadiumBeatClap(0.95), 420);
    window.setTimeout(() => this.playStadiumBeatClap(0.9), 660);
  }

  /**
   * Unmistakable rising stereo stadium crowd roar + vocal cheers + claps on 15x/30x/50x combos!
   */
  playComboCheer(combo, { forceAudible = false } = {}) {
    const ctx = this.ensureContext({ ignoreMute: forceAudible });
    if (!ctx || !this.crowdBusInput) return;

    const now = ctx.currentTime;
    const intensity = combo >= 50 ? 1.4 : combo >= 30 ? 1.15 : 0.9;
    const dur = combo >= 50 ? 1.75 : combo >= 30 ? 1.35 : 1.05;

    // 1. Wide stereo pink-noise stadium roar swell
    const roar = ctx.createBufferSource();
    roar.buffer = this.pinkCrowdBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(580, now);
    bp.frequency.exponentialRampToValueAtTime(1480 * (combo >= 50 ? 1.18 : 1.0), now + dur * 0.32);
    bp.frequency.exponentialRampToValueAtTime(720, now + dur);
    bp.Q.setValueAtTime(0.8, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.55 * intensity, now + 0.14);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    roar.connect(bp);
    bp.connect(gain);
    gain.connect(this.crowdBusInput);
    roar.start(now, Math.random() * 1.4, dur + 0.1);

    // 2. High-energy white-noise stadium air cheer crest
    const air = ctx.createBufferSource();
    air.buffer = this.noiseBuffer;
    const airBp = ctx.createBiquadFilter();
    airBp.type = 'bandpass';
    airBp.frequency.setValueAtTime(1950, now);
    airBp.Q.setValueAtTime(1.1, now);
    const airG = ctx.createGain();
    airG.gain.setValueAtTime(0.001, now);
    airG.gain.linearRampToValueAtTime(0.24 * intensity, now + 0.18);
    airG.gain.exponentialRampToValueAtTime(0.001, now + dur * 0.92);
    air.connect(airBp);
    airBp.connect(airG);
    airG.connect(this.crowdBusInput);
    air.start(now, Math.random() * 0.6, dur);

    // 3. Multi-pan excited stadium vocal cheers ("WOO! / YEAH!")
    const cheerVoices = combo >= 50 ? [-0.75, -0.25, 0.25, 0.75] : combo >= 30 ? [-0.55, 0.0, 0.55] : [-0.35, 0.35];
    cheerVoices.forEach((pan, idx) => {
      const out = this.createCrowdPanner(ctx, pan);
      const voiceNoise = ctx.createBufferSource();
      voiceNoise.buffer = this.noiseBuffer;

      const formant = ctx.createBiquadFilter();
      formant.type = 'bandpass';
      const baseHz = 860 + idx * 175;
      const t0 = now + idx * 0.035;
      formant.frequency.setValueAtTime(baseHz * 0.85, t0);
      formant.frequency.exponentialRampToValueAtTime(baseHz * 1.48, t0 + 0.26);
      formant.frequency.exponentialRampToValueAtTime(baseHz * 0.96, t0 + 0.78);
      formant.Q.setValueAtTime(3.6, t0);

      const vg = ctx.createGain();
      vg.gain.setValueAtTime(0.001, t0);
      vg.gain.linearRampToValueAtTime(0.24 * intensity, t0 + 0.12);
      vg.gain.exponentialRampToValueAtTime(0.001, t0 + 0.84);

      voiceNoise.connect(formant);
      formant.connect(vg);
      vg.connect(out);
      voiceNoise.start(t0, Math.random() * 0.6, 0.9);
    });
  }

  /**
   * Synthesizes a rhythmic stadium crowd syllable chant burst with dual vocal formants + synchronized clap!
   */
  scheduleChantSyllable(ctx, startTime, durationSec, f1Hz, f2Hz, gainAmt = 0.42) {
    // 3 panned crowd sections chanting together
    [-0.65, 0, 0.65].forEach((pan, idx) => {
      const out = this.createCrowdPanner(ctx, pan);
      const t0 = startTime + idx * 0.012;

      const src = ctx.createBufferSource();
      src.buffer = this.pinkCrowdBuffer;

      const bp1 = ctx.createBiquadFilter();
      bp1.type = 'bandpass';
      bp1.frequency.setValueAtTime(f1Hz * (0.97 + idx * 0.03), t0);
      bp1.Q.setValueAtTime(4.2, t0);

      const bp2 = ctx.createBiquadFilter();
      bp2.type = 'bandpass';
      bp2.frequency.setValueAtTime(f2Hz * (0.98 + idx * 0.025), t0);
      bp2.Q.setValueAtTime(4.8, t0);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, t0);
      g.gain.linearRampToValueAtTime(gainAmt, t0 + 0.045);
      g.gain.setValueAtTime(gainAmt * 0.88, t0 + durationSec * 0.65);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + durationSec);

      src.connect(bp1);
      src.connect(bp2);
      bp1.connect(g);
      bp2.connect(g);
      g.connect(out);
      src.start(t0, Math.random() * 1.6, durationSec + 0.06);
    });

    // Synchronized thunderous stadium stomp-clap on every chant syllable
    const clap = ctx.createBufferSource();
    clap.buffer = this.noiseBuffer;
    const cBp = ctx.createBiquadFilter();
    cBp.type = 'bandpass';
    cBp.frequency.setValueAtTime(1250, startTime);
    cBp.Q.setValueAtTime(1.2, startTime);
    const cG = ctx.createGain();
    cG.gain.setValueAtTime(0.001, startTime);
    cG.gain.linearRampToValueAtTime(0.32, startTime + 0.01);
    cG.gain.exponentialRampToValueAtTime(0.001, startTime + 0.11);
    clap.connect(cBp);
    cBp.connect(cG);
    cG.connect(this.crowdBusInput);
    clap.start(startTime, Math.random() * 0.8, 0.12);
  }

  /**
   * Rhythmic "WE! WANT! MORE!" crowd chant played during Tour Setlist intermissions.
   */
  playWeWantMoreChant() {
    const ctx = this.ensureContext();
    if (!ctx || !this.crowdBusInput) return;
    const now = ctx.currentTime;

    // Underlying crowd anticipation roar
    const bed = ctx.createBufferSource();
    bed.buffer = this.pinkCrowdBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(720, now);
    bp.Q.setValueAtTime(0.75, now);
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.001, now);
    bg.gain.linearRampToValueAtTime(0.36, now + 0.25);
    bg.gain.exponentialRampToValueAtTime(0.001, now + 3.1);
    bed.connect(bp);
    bp.connect(bg);
    bg.connect(this.crowdBusInput);
    bed.start(now, 0, 3.2);

    // Two cycles of "WE! (ee) — WANT! (aw) — MORE! (oh)"
    [0.12, 1.55].forEach((offset) => {
      this.scheduleChantSyllable(ctx, now + offset, 0.28, 380, 1950, 0.4); // WE
      this.scheduleChantSyllable(ctx, now + offset + 0.38, 0.28, 620, 1180, 0.44); // WANT
      this.scheduleChantSyllable(ctx, now + offset + 0.76, 0.46, 520, 960, 0.48); // MORE!
    });
  }

  /**
   * Rhythmic "EN-CORE! EN-CORE! EN-CORE!" stadium chant triggered before the Final Encore song!
   */
  playEncoreChant() {
    const ctx = this.ensureContext();
    if (!ctx || !this.crowdBusInput) return;
    const now = ctx.currentTime;

    // Massive roaring arena crowd swell behind the chant
    const bed = ctx.createBufferSource();
    bed.buffer = this.pinkCrowdBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(640, now);
    bp.frequency.exponentialRampToValueAtTime(1320, now + 3.2);
    bp.Q.setValueAtTime(0.72, now);
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.001, now);
    bg.gain.linearRampToValueAtTime(0.46, now + 0.35);
    bg.gain.setValueAtTime(0.42, now + 2.8);
    bg.gain.exponentialRampToValueAtTime(0.001, now + 3.8);
    bed.connect(bp);
    bp.connect(bg);
    bg.connect(this.crowdBusInput);
    bed.start(now, 0, 3.9);

    // Three rhythmic rounds of "EN-CORE!" (eh -> oh)
    [0.1, 1.15, 2.2].forEach((offset) => {
      this.scheduleChantSyllable(ctx, now + offset, 0.26, 560, 1750, 0.44); // EN-
      this.scheduleChantSyllable(ctx, now + offset + 0.34, 0.46, 510, 980, 0.52); // -CORE!
    });
  }

  /**
   * Massive Fever Mode stadium roar + golden harmonic chord (SPACE).
   */
  playFeverActivate() {
    const ctx = this.ensureContext();
    if (!ctx || !this.crowdBusInput) return;

    const now = ctx.currentTime;
    const roar = ctx.createBufferSource();
    roar.buffer = this.pinkCrowdBuffer;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(520, now);
    bp.frequency.exponentialRampToValueAtTime(1680, now + 0.52);
    bp.frequency.exponentialRampToValueAtTime(840, now + 2.0);
    bp.Q.setValueAtTime(0.7, now);

    const rGain = ctx.createGain();
    rGain.gain.setValueAtTime(0.001, now);
    rGain.gain.linearRampToValueAtTime(0.72, now + 0.2);
    rGain.gain.exponentialRampToValueAtTime(0.001, now + 2.1);

    roar.connect(bp);
    bp.connect(rGain);
    rGain.connect(this.crowdBusInput);
    roar.start(now, 0, 2.2);

    this.playComboCheer(50);

    [440, 554.37, 659.25, 880].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.035;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.068, t);
      gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.58);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.6);
    });
  }

  /**
   * Loud Standing Ovation + dense stereo applause + roaring cheers + fanfare at song end!
   */
  playEncoreFanfare(grade) {
    const ctx = this.ensureContext();
    if (!ctx || !this.crowdBusInput) return;

    const now = ctx.currentTime;
    const isStrong = grade === 'S' || grade === 'A' || grade === 'B';

    // 1. Massive stereo standing ovation stadium roar
    const roar = ctx.createBufferSource();
    roar.buffer = this.pinkCrowdBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(isStrong ? 1050 : 580, now);
    bp.frequency.exponentialRampToValueAtTime(isStrong ? 1480 : 620, now + 0.65);
    bp.frequency.exponentialRampToValueAtTime(760, now + 3.6);
    bp.Q.setValueAtTime(0.75, now);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(isStrong ? 0.68 : 0.34, now + 0.3);
    g.gain.setValueAtTime(isStrong ? 0.56 : 0.25, now + 2.2);
    g.gain.exponentialRampToValueAtTime(0.001, now + 3.8);

    roar.connect(bp);
    bp.connect(g);
    g.connect(this.crowdBusInput);
    roar.start(now, 0, 3.9);

    // 2. Dense stereo standing-ovation applause waves
    const clapCount = isStrong ? 34 : 14;
    for (let i = 0; i < clapCount; i += 1) {
      const clapStart = now + 0.08 + i * (isStrong ? 0.09 : 0.16) + Math.random() * 0.035;
      const pan = (Math.random() - 0.5) * 1.65;
      const out = this.createCrowdPanner(ctx, pan);

      const clap = ctx.createBufferSource();
      clap.buffer = this.noiseBuffer;

      const clapFilter = ctx.createBiquadFilter();
      clapFilter.type = 'bandpass';
      clapFilter.frequency.setValueAtTime(1100 + Math.random() * 1100, clapStart);
      clapFilter.Q.setValueAtTime(1.6, clapStart);

      const clapGain = ctx.createGain();
      const envFade = 1 - (i / clapCount) * 0.55;
      clapGain.gain.setValueAtTime(0.001, clapStart);
      clapGain.gain.linearRampToValueAtTime((isStrong ? 0.24 : 0.12) * envFade, clapStart + 0.008);
      clapGain.gain.exponentialRampToValueAtTime(0.0008, clapStart + 0.072);

      clap.connect(clapFilter);
      clapFilter.connect(clapGain);
      clapGain.connect(out);
      clap.start(clapStart, Math.random() * 0.6, 0.085);
    }

    // 3. Stage brass/synth victory fanfare chord
    const chord = isStrong ? [293.66, 369.99, 440.0, 587.33] : [220.0, 261.63, 329.63];
    chord.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.045;
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.064, t);
      gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.78);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.82);
    });
  }

  playLaneHit(laneIndex, laneCount, instrument, judgement, isFever = false) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const pan = getLanePan(laneIndex, laneCount);
    const out = this.createPanner(ctx, pan);
    const isPerfect = judgement === 'PERFECT!';

    if (instrument === 'guitar') {
      const freqs = laneCount === 5
        ? [329.63, 392.0, 440.0, 523.25, 659.25]
        : [329.63, 392.0, 493.88, 659.25];
      const baseFreq = freqs[laneIndex % freqs.length] * (isFever ? 1.5 : 1);

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = isPerfect ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.01, now + 0.08);
      gain.gain.setValueAtTime(isPerfect ? 0.08 : 0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.1);

      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.11);
    } else if (instrument === 'bass') {
      const freqs = laneCount === 5
        ? [110.0, 130.81, 146.83, 164.81, 196.0]
        : [110.0, 130.81, 164.81, 196.0];
      const baseFreq = freqs[laneIndex % freqs.length];

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(baseFreq * 1.35, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq, now + 0.05);
      gain.gain.setValueAtTime(isPerfect ? 0.095 : 0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.11);

      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.12);
    } else {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const pitch = 210 + laneIndex * 95;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(pitch * 1.55, now);
      osc.frequency.exponentialRampToValueAtTime(pitch * 0.65, now + 0.05);
      gain.gain.setValueAtTime(isPerfect ? 0.09 : 0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.07);

      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.075);
    }
  }

  playSustainSpark(laneIndex, laneCount, isFever = false, whammyActive = false) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const pan = getLanePan(laneIndex, laneCount);
    const out = this.createPanner(ctx, pan);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = whammyActive ? 'triangle' : 'sine';
    const base = (isFever || whammyActive ? 987.77 : 698.46) + laneIndex * 55;
    osc.frequency.setValueAtTime(base, now);
    if (whammyActive) {
      osc.frequency.exponentialRampToValueAtTime(base * 1.12, now + 0.065);
    }
    gain.gain.setValueAtTime(whammyActive ? 0.036 : 0.022, now);
    gain.gain.exponentialRampToValueAtTime(0.0006, now + 0.075);

    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  playWrongKeyMiss(laneIndex, laneCount, instrument) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const pan = laneIndex >= 0 ? getLanePan(laneIndex, laneCount) : 0;
    const out = this.createPanner(ctx, pan);

    if (instrument === 'guitar') {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1650, now);
      bp.frequency.exponentialRampToValueAtTime(620, now + 0.095);
      bp.Q.setValueAtTime(2.6, now);

      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.15, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      noise.connect(bp);
      bp.connect(nGain);
      nGain.connect(out);
      noise.start(now);
      noise.stop(now + 0.11);

      const buzz = ctx.createOscillator();
      const bGain = ctx.createGain();
      buzz.type = 'sawtooth';
      buzz.frequency.setValueAtTime(124, now);
      buzz.frequency.exponentialRampToValueAtTime(84, now + 0.09);
      bGain.gain.setValueAtTime(0.075, now);
      bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      buzz.connect(bGain);
      bGain.connect(out);
      buzz.start(now);
      buzz.stop(now + 0.11);
    } else if (instrument === 'bass') {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(92, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.12);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(210, now);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.14);
    } else {
      const osc = ctx.createOscillator();
      const bp = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(490, now);
      osc.frequency.exponentialRampToValueAtTime(280, now + 0.032);
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1150, now);
      bp.Q.setValueAtTime(3.2, now);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.048);

      osc.connect(bp);
      bp.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.055);
    }
  }

  playPyroBlast() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2400, now);
    lp.frequency.exponentialRampToValueAtTime(260, now + 0.65);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.24, now + 0.045);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.72);

    noise.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.75);

    const thump = ctx.createOscillator();
    const tg = ctx.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(110, now);
    thump.frequency.exponentialRampToValueAtTime(36, now + 0.22);
    tg.gain.setValueAtTime(0.22, now);
    tg.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    thump.connect(tg);
    tg.connect(ctx.destination);
    thump.start(now);
    thump.stop(now + 0.26);
  }

  playFireworkBurst(pan = 0) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const out = this.createPanner(ctx, pan);

    const boom = ctx.createOscillator();
    const bGain = ctx.createGain();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(145, now);
    boom.frequency.exponentialRampToValueAtTime(42, now + 0.19);
    bGain.gain.setValueAtTime(0.12, now);
    bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    boom.connect(bGain);
    bGain.connect(out);
    boom.start(now);
    boom.stop(now + 0.24);

    const crackle = ctx.createBufferSource();
    crackle.buffer = this.noiseBuffer;
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.setValueAtTime(3400, now);
    hp.Q.setValueAtTime(1.1, now);

    const cGain = ctx.createGain();
    cGain.gain.setValueAtTime(0.001, now);
    cGain.gain.linearRampToValueAtTime(0.095, now + 0.025);
    cGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.58);

    crackle.connect(hp);
    hp.connect(cGain);
    cGain.connect(out);
    crackle.start(now, Math.random() * 0.8, 0.62);
  }

  /**
   * Dimmed-lights arena roar as the 4 Roblox band members walk onto the stage!
   */
  playWalkOnCrowdSwell() {
    const ctx = this.ensureContext();
    if (!ctx || !this.crowdBusInput) return;

    const now = ctx.currentTime;
    const roar = ctx.createBufferSource();
    roar.buffer = this.pinkCrowdBuffer;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(420, now);
    bp.frequency.exponentialRampToValueAtTime(1280, now + 1.35);
    bp.frequency.exponentialRampToValueAtTime(680, now + 2.75);
    bp.Q.setValueAtTime(0.75, now);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.54, now + 0.55);
    g.gain.setValueAtTime(0.46, now + 1.75);
    g.gain.exponentialRampToValueAtTime(0.001, now + 2.85);

    roar.connect(bp);
    bp.connect(g);
    g.connect(this.crowdBusInput);
    roar.start(now, Math.random() * 0.8, 2.95);

    // Scattered excited fan cheers from left & right wings
    [-0.68, 0.05, 0.72].forEach((pan, idx) => {
      const out = this.createCrowdPanner(ctx, pan);
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const formant = ctx.createBiquadFilter();
      formant.type = 'bandpass';
      const t0 = now + 0.25 + idx * 0.28;
      formant.frequency.setValueAtTime(900 + idx * 180, t0);
      formant.frequency.exponentialRampToValueAtTime(1450 + idx * 160, t0 + 0.35);
      formant.Q.setValueAtTime(3.2, t0);

      const vg = ctx.createGain();
      vg.gain.setValueAtTime(0.001, t0);
      vg.gain.linearRampToValueAtTime(0.18, t0 + 0.14);
      vg.gain.exponentialRampToValueAtTime(0.001, t0 + 0.85);

      src.connect(formant);
      formant.connect(vg);
      vg.connect(out);
      src.start(t0, Math.random() * 0.5, 0.9);
    });
  }

  /**
   * Subtle authentic 1/4" guitar cable plug-in pop + warm tube amp power-up hum
   * triggered as the Guitarist & Bassist plug into their stage stacks during Walk-On!
   */
  playAmpPlugIn() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // 1. Crisp 1/4" jack plug-in thump/pop
    const popOsc = ctx.createOscillator();
    const popGain = ctx.createGain();
    popOsc.type = 'sine';
    popOsc.frequency.setValueAtTime(165, now);
    popOsc.frequency.exponentialRampToValueAtTime(48, now + 0.055);
    popGain.gain.setValueAtTime(0.16, now);
    popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    popOsc.connect(popGain);
    popGain.connect(ctx.destination);
    popOsc.start(now);
    popOsc.stop(now + 0.07);

    // Tiny metallic jack click
    const click = ctx.createBufferSource();
    click.buffer = this.noiseBuffer;
    const clickBp = ctx.createBiquadFilter();
    clickBp.type = 'bandpass';
    clickBp.frequency.setValueAtTime(2200, now);
    clickBp.Q.setValueAtTime(2.0, now);
    const clickG = ctx.createGain();
    clickG.gain.setValueAtTime(0.12, now);
    clickG.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
    click.connect(clickBp);
    clickBp.connect(clickG);
    clickG.connect(ctx.destination);
    click.start(now, 0, 0.03);

    // 2. Warm brief 60Hz/120Hz tube amp hum + subtle string feedback harmonic
    const hum1 = ctx.createOscillator();
    const hum2 = ctx.createOscillator();
    const humLp = ctx.createBiquadFilter();
    const humGain = ctx.createGain();

    hum1.type = 'sawtooth';
    hum1.frequency.setValueAtTime(60, now + 0.03);
    hum2.type = 'triangle';
    hum2.frequency.setValueAtTime(120, now + 0.03);

    humLp.type = 'lowpass';
    humLp.frequency.setValueAtTime(340, now + 0.03);

    humGain.gain.setValueAtTime(0.0005, now + 0.03);
    humGain.gain.linearRampToValueAtTime(0.048, now + 0.14);
    humGain.gain.setValueAtTime(0.036, now + 0.65);
    humGain.gain.exponentialRampToValueAtTime(0.0005, now + 1.15);

    hum1.connect(humLp);
    hum2.connect(humLp);
    humLp.connect(humGain);
    humGain.connect(ctx.destination);

    hum1.start(now + 0.03);
    hum2.start(now + 0.03);
    hum1.stop(now + 1.2);
    hum2.stop(now + 1.2);
  }
}


/**
 * soundEffects.js
 * Tactile Web Audio synthesizer for:
 *  - Crisp instrument-colored lane hit feedback (Guitar, Bass, Drums, Piano/Keys)
 *  - Instrument-specific wrong-key / miss acoustic thud & string clank
 *  - Warm, realistic stadium crowd ambience, multi-formant cheers, rhythmic chants,
 *    and soft bandpass-shaped claps (ZERO harsh raw white-noise static!)
 *  - Pyrotechnic blast, firework burst & Encore victory fanfare
 *
 * Shares the main AudioEngine's unlocked AudioContext so crowd cheering, chants,
 * and stage SFX always play reliably with zero browser autoplay blockage.
 */

const PENTATONIC_5 = [261.63, 293.66, 329.63, 392.0, 440.0];
const PIANO_CHORD_VOICINGS = [
  [261.63, 329.63, 392.0], // C major
  [293.66, 349.23, 440.0], // D minor
  [329.63, 392.0, 493.88], // E minor
  [392.0, 493.88, 587.33], // G major
  [440.0, 523.25, 659.25], // A minor
];

export class SoundEffects {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.crowdVolume = 0.72; // 0..1 controlled by Live Crowd Audio slider
    this.noiseBuffer = null; // Used strictly for short snare/pyro transients
    this.pinkCrowdBuffer = null; // Seamless stereo warm pink noise for realistic crowd vocals & claps

    // Persistent multi-formant stadium crowd ambience graph
    this.crowdBus = null;
    this.crowdNodes = null;
    this.crowdRunning = false;
    this.lastClapBeatIndex = -1;
    this.lastFeverClapState = false;
  }

  /**
   * Unlocks & attaches a shared AudioContext (or creates one if none supplied).
   */
  unlockAudio(sharedCtx = null) {
    if (sharedCtx) {
      if (this.ctx && this.ctx !== sharedCtx && this.crowdRunning) {
        this.stopCrowdAmbience();
      }
      this.ctx = sharedCtx;
    } else if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    if (!this.noiseBuffer || this.noiseBuffer.sampleRate !== this.ctx.sampleRate) {
      const sr = this.ctx.sampleRate;
      const len = Math.floor(sr * 2.0);
      const buf = this.ctx.createBuffer(1, len, sr);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buf;

      // Seamless 5-second Stereo Warm Pink-Noise Buffer (Paul Kellet's 7-pole pink filter)
      // Crossfaded at loop boundaries so looping crowd beds have ZERO clicks or harsh white-noise hiss!
      const pinkLen = Math.floor(sr * 5.0);
      const pinkBuf = this.ctx.createBuffer(2, pinkLen, sr);
      for (let ch = 0; ch < 2; ch += 1) {
        const out = pinkBuf.getChannelData(ch);
        let b0 = 0;
        let b1 = 0;
        let b2 = 0;
        let b3 = 0;
        let b4 = 0;
        let b5 = 0;
        let b6 = 0;
        // Warm up filter state first
        for (let w = 0; w < 2048; w += 1) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          b6 = white * 0.115926;
        }
        for (let i = 0; i < pinkLen; i += 1) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
          b6 = white * 0.115926;
          // Gentle second-stage warmth lowpass smoothing
          out[i] = i > 0 ? out[i - 1] * 0.38 + pink * 0.62 : pink;
        }
        // Seamless loop boundary crossfade (last 0.12s blended smoothly into first 0.12s)
        const fadeSamples = Math.min(Math.floor(sr * 0.12), pinkLen >> 3);
        for (let i = 0; i < fadeSamples; i += 1) {
          const a = i / fadeSamples;
          out[i] = out[i] * a + out[pinkLen - fadeSamples + i] * (1 - a);
        }
      }
      this.pinkCrowdBuffer = pinkBuf;
    }

    if (!this.crowdBus || this.crowdBus.context !== this.ctx) {
      this.crowdBus = this.ctx.createGain();
      this.crowdBus.gain.value = this.muted ? 0 : this.crowdVolume;
      this.crowdBus.connect(this.ctx.destination);
    }

    return this.ctx;
  }

  ensureContext() {
    return this.unlockAudio(this.ctx);
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.crowdBus && this.ctx) {
      this.crowdBus.gain.setTargetAtTime(this.muted ? 0 : this.crowdVolume, this.ctx.currentTime, 0.04);
    }
  }

  setCrowdVolume(vol) {
    this.crowdVolume = Math.max(0, Math.min(1, Number(vol) || 0));
    if (this.crowdBus && this.ctx) {
      this.crowdBus.gain.setTargetAtTime(this.muted ? 0 : this.crowdVolume, this.ctx.currentTime, 0.04);
    }
  }

  laneToPan(laneIndex, laneCount) {
    if (laneCount <= 1) return 0;
    const t = laneIndex / (laneCount - 1);
    return -0.78 + t * 1.56;
  }

  connectPanned(node, pan, destination = null) {
    const dest = destination || this.ctx.destination;
    if (typeof this.ctx.createStereoPanner === 'function') {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      node.connect(panner);
      panner.connect(dest);
    } else {
      node.connect(dest);
    }
  }

  /**
   * Helper: creates a warm multi-formant stadium vocal cheer burst using ONLY stereo pink noise
   * routed through parallel resonant vocal formants (380Hz, 780Hz, 1280Hz, 1740Hz) + lowpass warmth.
   * Zero harsh raw white-noise static!
   */
  scheduleWarmCrowdSwell({
    startTime,
    attackSec = 0.2,
    holdSec = 0.4,
    releaseSec = 1.2,
    peakGain = 0.24,
    formants = [390, 790, 1290, 1720],
    lowpassHz = 2250,
    pan = 0,
    playbackRate = 1.0,
    includeVocalWhoop = true,
  }) {
    const ctx = this.ensureContext();
    const totalDur = attackSec + holdSec + releaseSec;

    const src = ctx.createBufferSource();
    src.buffer = this.pinkCrowdBuffer;
    src.loop = true;
    src.playbackRate.value = playbackRate;

    // Master warm lowpass rolls off all static hiss above ~2.2kHz
    const warmthLp = ctx.createBiquadFilter();
    warmthLp.type = 'lowpass';
    warmthLp.frequency.setValueAtTime(lowpassHz * 0.78, startTime);
    warmthLp.frequency.linearRampToValueAtTime(lowpassHz, startTime + attackSec);
    warmthLp.frequency.exponentialRampToValueAtTime(Math.max(850, lowpassHz * 0.58), startTime + totalDur);
    warmthLp.Q.value = 0.55;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0005, startTime);
    env.gain.linearRampToValueAtTime(peakGain, startTime + attackSec);
    if (holdSec > 0.01) {
      env.gain.setValueAtTime(peakGain * 0.94, startTime + attackSec + holdSec);
    }
    env.gain.exponentialRampToValueAtTime(0.0008, startTime + totalDur);

    // Parallel resonant vocal formant bank simulating thousands of overlapping voices ("AAAH / OHHH / YEEEAH!")
    const weights = [0.62, 0.55, 0.42, 0.26];
    formants.forEach((hz, idx) => {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(hz * 0.92, startTime);
      bp.frequency.linearRampToValueAtTime(hz * 1.08, startTime + attackSec + holdSec * 0.4);
      bp.frequency.exponentialRampToValueAtTime(hz * 0.88, startTime + totalDur);
      bp.Q.value = 2.1 + idx * 0.35;

      const fg = ctx.createGain();
      fg.gain.value = weights[idx] || 0.3;

      src.connect(bp);
      bp.connect(fg);
      fg.connect(warmthLp);
    });

    warmthLp.connect(env);
    this.connectPanned(env, pan, this.crowdBus);

    const randOffset = Math.random() * 2.5;
    src.start(startTime, randOffset);
    src.stop(startTime + totalDur + 0.08);

    // Soft warm harmonic stadium crowd "WOOO!" resonance bed (very subtle & natural)
    if (includeVocalWhoop) {
      const voices = [
        { f0: 270, f1: 375, g: peakGain * 0.075, p: -0.35 },
        { f0: 340, f1: 470, g: peakGain * 0.06, p: 0.35 },
      ];
      voices.forEach((v) => {
        const osc = ctx.createOscillator();
        const lp = ctx.createBiquadFilter();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(v.f0, startTime + attackSec * 0.3);
        osc.frequency.exponentialRampToValueAtTime(v.f1, startTime + attackSec + holdSec * 0.5);
        osc.frequency.exponentialRampToValueAtTime(v.f0 * 0.95, startTime + totalDur * 0.85);

        lp.type = 'lowpass';
        lp.frequency.value = 720;

        g.gain.setValueAtTime(0.0004, startTime);
        g.gain.linearRampToValueAtTime(v.g, startTime + attackSec * 1.1);
        g.gain.exponentialRampToValueAtTime(0.0004, startTime + totalDur * 0.88);

        osc.connect(lp);
        lp.connect(g);
        this.connectPanned(g, v.p, this.crowdBus);
        osc.start(startTime);
        osc.stop(startTime + totalDur);
      });
    }
  }

  /**
   * Starts continuous warm multi-formant stadium ambience bed (stereo pink noise through
   * 3 parallel vocal-resonance formant filters + warm lowpass — zero harsh white-noise static!).
   */
  startCrowdAmbience() {
    if (this.crowdRunning) return;
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    const srcA = ctx.createBufferSource();
    srcA.buffer = this.pinkCrowdBuffer;
    srcA.loop = true;
    srcA.playbackRate.value = 0.96;

    const srcB = ctx.createBufferSource();
    srcB.buffer = this.pinkCrowdBuffer;
    srcB.loop = true;
    srcB.playbackRate.value = 1.04;

    // 3 Parallel warm vocal formant filters (380Hz chest murmur, 820Hz "ah" crowd roar, 1450Hz bright cheers)
    const fLow = ctx.createBiquadFilter();
    fLow.type = 'bandpass';
    fLow.frequency.value = 390;
    fLow.Q.value = 1.65;

    const fMid = ctx.createBiquadFilter();
    fMid.type = 'bandpass';
    fMid.frequency.value = 820;
    fMid.Q.value = 2.0;

    const fHigh = ctx.createBiquadFilter();
    fHigh.type = 'bandpass';
    fHigh.frequency.value = 1460;
    fHigh.Q.value = 2.4;

    const masterLp = ctx.createBiquadFilter();
    masterLp.type = 'lowpass';
    masterLp.frequency.value = 2150;
    masterLp.Q.value = 0.55;

    const lowGain = ctx.createGain();
    lowGain.gain.value = 0.085;

    const midGain = ctx.createGain();
    midGain.gain.value = 0.055;

    const highGain = ctx.createGain();
    highGain.gain.value = 0.025;

    // Gentle organic breathing swell LFO so the stadium feels alive
    const lfo = ctx.createOscillator();
    const lfoDepth = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.19;
    lfoDepth.gain.value = 110;
    lfo.connect(lfoDepth);
    lfoDepth.connect(fMid.frequency);

    srcA.connect(fLow);
    srcA.connect(fMid);
    srcB.connect(fMid);
    srcB.connect(fHigh);

    fLow.connect(lowGain);
    fMid.connect(midGain);
    fHigh.connect(highGain);

    lowGain.connect(masterLp);
    midGain.connect(masterLp);
    highGain.connect(masterLp);
    masterLp.connect(this.crowdBus);

    srcA.start(now, 0.2);
    srcB.start(now, 2.4);
    lfo.start(now);

    this.crowdNodes = { srcA, srcB, lfo, fLow, fMid, fHigh, masterLp, lowGain, midGain, highGain };
    this.crowdRunning = true;
    this.lastClapBeatIndex = -1;
  }

  /**
   * Dynamically scales warm stadium crowd roar & BPM-locked rhythmic clapping with Hype, Fever, & Encore!
   */
  updateCrowdState({ hype = 55, feverActive = false, playing = true, bpm = 120, songTime = 0, isEncore = false }) {
    if (!this.crowdRunning || !this.crowdNodes || !this.ctx) return;
    const now = this.ctx.currentTime;
    const { lowGain, midGain, highGain, fMid, masterLp } = this.crowdNodes;

    if (!playing || this.muted) {
      lowGain.gain.setTargetAtTime(0.001, now, 0.14);
      midGain.gain.setTargetAtTime(0.001, now, 0.14);
      highGain.gain.setTargetAtTime(0.001, now, 0.14);
      return;
    }

    const norm = Math.max(0, Math.min(1, hype / 100));
    const feverBoost = feverActive || isEncore ? 1.42 : 1.0;

    lowGain.gain.setTargetAtTime((0.06 + norm * 0.13) * feverBoost, now, 0.18);
    midGain.gain.setTargetAtTime((0.032 + norm * 0.115) * feverBoost, now, 0.18);
    highGain.gain.setTargetAtTime((0.012 + Math.max(0, norm - 0.25) * 0.085) * feverBoost, now, 0.18);
    fMid.frequency.setTargetAtTime(720 + norm * 320 + (feverActive ? 140 : 0), now, 0.22);
    masterLp.frequency.setTargetAtTime(1750 + norm * 650 + (feverActive ? 250 : 0), now, 0.22);

    // BPM-locked soft warm stadium clapping when hype >= 70% or during Fever / Encore!
    if ((hype >= 70 || feverActive || isEncore) && songTime > 0 && bpm >= 65) {
      const beatSec = 60 / bpm;
      const beatIdx = Math.floor(songTime / beatSec);
      if (beatIdx !== this.lastClapBeatIndex && beatIdx >= 0) {
        this.lastClapBeatIndex = beatIdx;
        if (feverActive || isEncore || beatIdx % 2 === 1) {
          this.playStadiumBeatClap(feverActive || isEncore ? 0.14 : 0.09);
        }
      }
    }
  }

  /**
   * Soft, warm multi-layer stadium handclap (pink noise + resonant palm bandpass + smooth envelope).
   */
  playStadiumBeatClap(level = 0.11) {
    if (this.muted || this.crowdVolume <= 0.01) return;
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    const layers = [
      { delay: 0.0, pan: -0.34, freq: 980 },
      { delay: 0.011, pan: 0.34, freq: 1180 },
      { delay: 0.022, pan: 0.0, freq: 860 },
    ];
    layers.forEach((l) => {
      const t = now + l.delay;
      const src = ctx.createBufferSource();
      src.buffer = this.pinkCrowdBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = l.freq;
      bp.Q.value = 1.65;

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2100;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0005, t);
      g.gain.linearRampToValueAtTime(level * 0.72, t + 0.009);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 0.095);

      src.connect(bp);
      bp.connect(lp);
      lp.connect(g);
      this.connectPanned(g, l.pan, this.crowdBus);
      src.start(t, Math.random() * 2.0);
      src.stop(t + 0.11);
    });
  }

  /**
   * Warm stadium crowd cheer burst on 25x, 50x, 100x+ combo milestones or Test Crowd button!
   */
  playComboCheer(milestone = 25) {
    if (this.muted) return;
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const intensity = milestone >= 100 ? 1.35 : milestone >= 50 ? 1.15 : 0.95;

    // Left & right wide stereo stadium vocal swells
    this.scheduleWarmCrowdSwell({
      startTime: now,
      attackSec: 0.16,
      holdSec: 0.32,
      releaseSec: 1.05 * intensity,
      peakGain: 0.24 * intensity,
      formants: [410, 820, 1340, 1740],
      lowpassHz: 2350,
      pan: -0.22,
      playbackRate: 0.97,
      includeVocalWhoop: true,
    });

    this.scheduleWarmCrowdSwell({
      startTime: now + 0.06,
      attackSec: 0.2,
      holdSec: 0.38,
      releaseSec: 1.15 * intensity,
      peakGain: 0.2 * intensity,
      formants: [360, 740, 1210, 1620],
      lowpassHz: 2200,
      pan: 0.24,
      playbackRate: 1.05,
      includeVocalWhoop: false,
    });

    // Warm rhythmic applause burst layered underneath
    [0.08, 0.26, 0.44, 0.62].forEach((offset) => {
      window.setTimeout(() => {
        if (!this.muted) this.playStadiumBeatClap(0.095 * intensity);
      }, offset * 1000);
    });
  }

  /**
   * Warm crowd swell when the band walks out on stage during the 2.5s Stage Walk-On intro.
   */
  playWalkOnCrowdSwell() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    this.scheduleWarmCrowdSwell({
      startTime: now,
      attackSec: 0.72,
      holdSec: 0.9,
      releaseSec: 1.4,
      peakGain: 0.27,
      formants: [370, 760, 1240, 1650],
      lowpassHz: 2250,
      pan: 0,
      playbackRate: 0.95,
      includeVocalWhoop: true,
    });

    this.scheduleWarmCrowdSwell({
      startTime: now + 0.18,
      attackSec: 0.65,
      holdSec: 0.75,
      releaseSec: 1.35,
      peakGain: 0.2,
      formants: [430, 860, 1380, 1780],
      lowpassHz: 2350,
      pan: 0.18,
      playbackRate: 1.04,
      includeVocalWhoop: false,
    });
  }

  /**
   * Authentic 1/4" instrument cable jack plug-in & warm tube-amp power thump during Stage Walk-On.
   */
  playAmpPlugIn() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(1600, now);
    clickOsc.frequency.exponentialRampToValueAtTime(140, now + 0.032);
    clickGain.gain.setValueAtTime(0.14, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    clickOsc.connect(clickGain);
    clickGain.connect(ctx.destination);
    clickOsc.start(now);
    clickOsc.stop(now + 0.045);

    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(118, now + 0.03);
    thump.frequency.exponentialRampToValueAtTime(52, now + 0.22);
    thumpGain.gain.setValueAtTime(0.001, now + 0.03);
    thumpGain.gain.linearRampToValueAtTime(0.18, now + 0.05);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    thump.connect(thumpGain);
    thumpGain.connect(ctx.destination);
    thump.start(now + 0.03);
    thump.stop(now + 0.28);

    const hum = ctx.createOscillator();
    const humFilter = ctx.createBiquadFilter();
    const humGain = ctx.createGain();
    hum.type = 'sawtooth';
    hum.frequency.value = 120;
    humFilter.type = 'lowpass';
    humFilter.frequency.value = 420;
    humGain.gain.setValueAtTime(0.001, now + 0.05);
    humGain.gain.linearRampToValueAtTime(0.035, now + 0.14);
    humGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.52);
    hum.connect(humFilter);
    humFilter.connect(humGain);
    humGain.connect(ctx.destination);
    hum.start(now + 0.05);
    hum.stop(now + 0.55);
  }

  /**
   * Used by the "Test Crowd Cheer" button in Stage Settings so players can immediately hear & tune crowd audio.
   */
  playTestCrowdCheer() {
    this.ensureContext();
    this.playComboCheer(50);
  }

  /**
   * Synthesizes a rhythmic stadium crowd vocal chant syllable ("WE! WANT! MORE!" or "EN-CORE!")
   * strictly using warm stereo pink noise + dual vowel formant filters (zero static hiss).
   */
  scheduleChantSyllable(startTime, dur, f1Hz, f2Hz, level = 0.24) {
    const ctx = this.ensureContext();
    const src = ctx.createBufferSource();
    src.buffer = this.pinkCrowdBuffer;
    src.loop = true;

    const form1 = ctx.createBiquadFilter();
    form1.type = 'bandpass';
    form1.frequency.value = f1Hz;
    form1.Q.value = 3.0;

    const form2 = ctx.createBiquadFilter();
    form2.type = 'bandpass';
    form2.frequency.value = f2Hz;
    form2.Q.value = 3.4;

    const warmthLp = ctx.createBiquadFilter();
    warmthLp.type = 'lowpass';
    warmthLp.frequency.value = 2200;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, startTime);
    g.gain.linearRampToValueAtTime(level, startTime + 0.045);
    g.gain.exponentialRampToValueAtTime(0.001, startTime + dur);

    src.connect(form1);
    src.connect(form2);
    form1.connect(warmthLp);
    form2.connect(warmthLp);
    warmthLp.connect(g);
    g.connect(this.crowdBus);

    src.start(startTime, Math.random() * 2.0);
    src.stop(startTime + dur + 0.04);

    // Subtle unison crowd vocal root tone
    const chantOsc = ctx.createOscillator();
    const chantLp = ctx.createBiquadFilter();
    const chantGain = ctx.createGain();
    chantOsc.type = 'triangle';
    chantOsc.frequency.value = 215;
    chantLp.type = 'lowpass';
    chantLp.frequency.value = 640;
    chantGain.gain.setValueAtTime(0.001, startTime);
    chantGain.gain.linearRampToValueAtTime(level * 0.16, startTime + 0.04);
    chantGain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);

    chantOsc.connect(chantLp);
    chantLp.connect(chantGain);
    chantGain.connect(this.crowdBus);
    chantOsc.start(startTime);
    chantOsc.stop(startTime + dur + 0.03);
  }

  /**
   * Plays a rhythmic stadium "WE! WANT! MORE!" chant during Tour Intermission.
   */
  playWeWantMoreChant() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    const now = ctx.currentTime + 0.05;

    for (let rep = 0; rep < 2; rep += 1) {
      const base = now + rep * 1.45;
      this.scheduleChantSyllable(base + 0.0, 0.24, 340, 1550, 0.24); // WE!
      this.scheduleChantSyllable(base + 0.34, 0.26, 620, 1080, 0.27); // WANT!
      this.scheduleChantSyllable(base + 0.72, 0.42, 480, 920, 0.3); // MORE!
    }
    this.playComboCheer(50);
  }

  /**
   * Plays a roaring "EN-CORE! EN-CORE!" stadium chant before the Final Encore song!
   */
  playEncoreChant() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    const now = ctx.currentTime + 0.04;

    for (let rep = 0; rep < 3; rep += 1) {
      const base = now + rep * 1.05;
      this.scheduleChantSyllable(base + 0.0, 0.28, 540, 1650, 0.26); // EN-
      this.scheduleChantSyllable(base + 0.36, 0.44, 460, 880, 0.32); // CORE!
    }
    this.playComboCheer(100);
  }

  stopCrowdAmbience() {
    if (!this.crowdRunning || !this.crowdNodes) return;
    try {
      this.crowdNodes.srcA.stop();
      this.crowdNodes.srcB.stop();
      this.crowdNodes.lfo.stop();
      this.crowdNodes.srcA.disconnect();
      this.crowdNodes.srcB.disconnect();
      this.crowdNodes.lfo.disconnect();
      this.crowdNodes.fLow.disconnect();
      this.crowdNodes.fMid.disconnect();
      this.crowdNodes.fHigh.disconnect();
      this.crowdNodes.masterLp.disconnect();
      this.crowdNodes.lowGain.disconnect();
      this.crowdNodes.midGain.disconnect();
      this.crowdNodes.highGain.disconnect();
    } catch {
      // Ignore already stopped
    }
    this.crowdNodes = null;
    this.crowdRunning = false;
  }

  playLaneHit(laneIndex, laneCount, instrument = 'guitar', judgement = 'perfect', fever = false) {
    if (this.muted) return;
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const pan = this.laneToPan(laneIndex, laneCount);
    const freq = PENTATONIC_5[laneIndex % PENTATONIC_5.length];
    const level = judgement === 'perfect' ? 0.145 : 0.105;

    if (instrument === 'drums') {
      if (laneIndex === 0) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(145, now);
        osc.frequency.exponentialRampToValueAtTime(42, now + 0.11);
        g.gain.setValueAtTime(level * 1.35, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.connect(g);
        this.connectPanned(g, pan);
        osc.start(now);
        osc.stop(now + 0.15);
      } else {
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const flt = ctx.createBiquadFilter();
        flt.type = laneIndex === laneCount - 1 ? 'highpass' : 'bandpass';
        flt.frequency.value = laneIndex === laneCount - 1 ? 6200 : 1800 + laneIndex * 600;
        const g = ctx.createGain();
        g.gain.setValueAtTime(level * 0.95, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
        src.connect(flt);
        flt.connect(g);
        this.connectPanned(g, pan);
        src.start(now);
        src.stop(now + 0.095);
      }
      return;
    }

    if (instrument === 'piano') {
      // Crisp concert grand / sparkle electric piano harmonic chime
      const chord = PIANO_CHORD_VOICINGS[laneIndex % PIANO_CHORD_VOICINGS.length];
      const baseHz = chord[0] * (fever ? 2 : 1);
      const harmHz = chord[1] * (fever ? 2 : 1);

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const lp = ctx.createBiquadFilter();
      const g = ctx.createGain();

      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(baseHz, now);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(harmHz, now);

      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(3400, now);
      lp.frequency.exponentialRampToValueAtTime(980, now + 0.16);

      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(level * 0.92, now + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc1.connect(lp);
      osc2.connect(lp);
      lp.connect(g);
      this.connectPanned(g, pan);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.19);
      osc2.stop(now + 0.19);
      return;
    }

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = instrument === 'bass' ? 'triangle' : 'sine';
    const mult = instrument === 'bass' ? 0.5 : fever ? 2.0 : 1.0;
    osc.frequency.setValueAtTime(freq * mult, now);
    osc.frequency.exponentialRampToValueAtTime(freq * mult * 1.03, now + 0.075);

    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(level, now + 0.006);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(g);
    this.connectPanned(g, pan);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  playWrongKeyMiss(laneIndex, laneCount, instrument = 'guitar') {
    if (this.muted) return;
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const pan = this.laneToPan(laneIndex, laneCount);

    const oscA = ctx.createOscillator();
    const oscB = ctx.createOscillator();
    const flt = ctx.createBiquadFilter();
    const g = ctx.createGain();

    if (instrument === 'bass') {
      oscA.type = 'sawtooth';
      oscB.type = 'triangle';
      oscA.frequency.setValueAtTime(92, now);
      oscA.frequency.exponentialRampToValueAtTime(54, now + 0.14);
      oscB.frequency.setValueAtTime(98, now);
      oscB.frequency.exponentialRampToValueAtTime(58, now + 0.14);
      flt.type = 'lowpass';
      flt.frequency.value = 340;
    } else if (instrument === 'drums') {
      oscA.type = 'square';
      oscB.type = 'triangle';
      oscA.frequency.setValueAtTime(420, now);
      oscA.frequency.exponentialRampToValueAtTime(175, now + 0.09);
      oscB.frequency.setValueAtTime(465, now);
      oscB.frequency.exponentialRampToValueAtTime(190, now + 0.09);
      flt.type = 'bandpass';
      flt.frequency.value = 720;
    } else if (instrument === 'piano') {
      // Muted dissonant minor-2nd piano cluster
      oscA.type = 'triangle';
      oscB.type = 'sawtooth';
      oscA.frequency.setValueAtTime(208, now);
      oscB.frequency.setValueAtTime(222, now);
      flt.type = 'lowpass';
      flt.frequency.value = 680;
    } else {
      oscA.type = 'sawtooth';
      oscB.type = 'square';
      oscA.frequency.setValueAtTime(164, now);
      oscA.frequency.exponentialRampToValueAtTime(118, now + 0.13);
      oscB.frequency.setValueAtTime(175, now);
      oscB.frequency.exponentialRampToValueAtTime(127, now + 0.13);
      flt.type = 'bandpass';
      flt.frequency.value = 540;
      flt.Q.value = 1.8;
    }

    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.14, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    oscA.connect(flt);
    oscB.connect(flt);
    flt.connect(g);
    this.connectPanned(g, pan);

    oscA.start(now);
    oscB.start(now);
    oscA.stop(now + 0.16);
    oscB.stop(now + 0.16);
  }

  playSustainSpark(laneIndex, laneCount, fever = false, whammy = false) {
    if (this.muted) return;
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const pan = this.laneToPan(laneIndex, laneCount);
    const base = PENTATONIC_5[laneIndex % PENTATONIC_5.length] * (fever ? 2 : 1.5);

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(base, now);
    if (whammy) {
      osc.frequency.linearRampToValueAtTime(base * 1.07, now + 0.03);
      osc.frequency.linearRampToValueAtTime(base * 0.96, now + 0.06);
    }
    g.gain.setValueAtTime(0.042, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    osc.connect(g);
    this.connectPanned(g, pan);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  playFeverActivate() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    [523.25, 659.25, 783.99, 1046.5].forEach((hz, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(hz, now + idx * 0.05);
      g.gain.setValueAtTime(0.001, now + idx * 0.05);
      g.gain.linearRampToValueAtTime(0.12, now + idx * 0.05 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.34);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.36);
    });

    // Warm roaring stadium eruption (zero static white noise)
    this.scheduleWarmCrowdSwell({
      startTime: now,
      attackSec: 0.14,
      holdSec: 0.45,
      releaseSec: 1.35,
      peakGain: 0.3,
      formants: [400, 820, 1340, 1760],
      lowpassHz: 2400,
      pan: 0,
      playbackRate: 1.02,
      includeVocalWhoop: true,
    });
  }

  playPyroBlast() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.pinkCrowdBuffer;
    const flt = ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(1150, now);
    flt.frequency.exponentialRampToValueAtTime(180, now + 0.44);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.24, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.48);

    src.connect(flt);
    flt.connect(g);
    g.connect(ctx.destination);
    src.start(now, Math.random() * 2.0);
    src.stop(now + 0.5);
  }

  playFireworkBurst(pan = 0) {
    if (this.muted) return;
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(145, now);
    thump.frequency.exponentialRampToValueAtTime(34, now + 0.22);
    thumpGain.gain.setValueAtTime(0.18, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    thump.connect(thumpGain);
    this.connectPanned(thumpGain, pan);
    thump.start(now);
    thump.stop(now + 0.28);

    const crackle = ctx.createBufferSource();
    crackle.buffer = this.pinkCrowdBuffer;
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.setValueAtTime(2200, now);
    hp.frequency.exponentialRampToValueAtTime(650, now + 0.55);
    hp.Q.value = 0.7;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.001, now);
    cg.gain.linearRampToValueAtTime(0.15, now + 0.018);
    cg.gain.exponentialRampToValueAtTime(0.001, now + 0.62);
    crackle.connect(hp);
    hp.connect(cg);
    this.connectPanned(cg, pan);
    crackle.start(now, Math.random() * 2.0);
    crackle.stop(now + 0.65);
  }

  playEncoreFanfare(grade = 'A') {
    if (this.muted) return;
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const notes =
      grade === 'S' || grade === 'A'
        ? [523.25, 659.25, 783.99, 1046.5]
        : [392.0, 493.88, 587.33];

    notes.forEach((hz, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(hz, now + idx * 0.085);
      g.gain.setValueAtTime(0.001, now + idx * 0.085);
      g.gain.linearRampToValueAtTime(0.13, now + idx * 0.085 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.085 + 0.48);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now + idx * 0.085);
      osc.stop(now + idx * 0.085 + 0.5);
    });

    // Warm standing-ovation cheer swell on post-gig results
    this.scheduleWarmCrowdSwell({
      startTime: now + 0.1,
      attackSec: 0.28,
      holdSec: 0.55,
      releaseSec: 1.5,
      peakGain: grade === 'S' || grade === 'A' ? 0.28 : 0.18,
      formants: [390, 790, 1290, 1700],
      lowpassHz: 2300,
      pan: 0,
      playbackRate: 0.99,
      includeVocalWhoop: grade === 'S' || grade === 'A',
    });
  }

  /**
   * Warm downward crowd boo + muffled stage thud & soft splat when an angry crowd projectile lands.
   */
  playCrowdBooAndThud(pan = 0) {
    if (this.muted) return;
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const clampedPan = Math.max(-0.85, Math.min(0.85, Number(pan) || 0));

    // 1. Muffled stage floor thud (lowpass triangle impact)
    const thud = ctx.createOscillator();
    const thudFilter = ctx.createBiquadFilter();
    const thudGain = ctx.createGain();
    thud.type = 'triangle';
    thud.frequency.setValueAtTime(125, now);
    thud.frequency.exponentialRampToValueAtTime(38, now + 0.14);
    thudFilter.type = 'lowpass';
    thudFilter.frequency.setValueAtTime(280, now);
    thudGain.gain.setValueAtTime(0.001, now);
    thudGain.gain.linearRampToValueAtTime(0.24, now + 0.01);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    thud.connect(thudFilter);
    thudFilter.connect(thudGain);
    this.connectPanned(thudGain, clampedPan);
    thud.start(now);
    thud.stop(now + 0.19);

    // 2. Soft wet squish / bounce burst from pinkCrowdBuffer
    if (this.pinkCrowdBuffer) {
      const squish = ctx.createBufferSource();
      squish.buffer = this.pinkCrowdBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(780, now);
      bp.frequency.exponentialRampToValueAtTime(290, now + 0.12);
      bp.Q.value = 1.6;
      const sg = ctx.createGain();
      sg.gain.setValueAtTime(0.001, now);
      sg.gain.linearRampToValueAtTime(0.16, now + 0.012);
      sg.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      squish.connect(bp);
      bp.connect(sg);
      this.connectPanned(sg, clampedPan);
      squish.start(now, Math.random() * 1.5);
      squish.stop(now + 0.16);
    }

    // 3. Low warm crowd "boooo" formant swell (no harsh white static)
    const volScale = Math.max(0.25, Math.min(1, this.crowdVolume ?? 0.75));
    this.scheduleWarmCrowdSwell({
      startTime: now + 0.02,
      attackSec: 0.1,
      holdSec: 0.22,
      releaseSec: 0.42,
      peakGain: 0.15 * volScale,
      formants: [310, 560, 880],
      lowpassHz: 1150,
      pan: clampedPan,
      playbackRate: 0.84,
      includeVocalWhoop: false,
    });
  }

  /**
   * Panggulo hazard bomb detonation: deep sub-bass drop + filtered dissonant crunch panned to lane.
   */
  playHazardDetonate(laneIndex = 2, laneCount = 5) {
    if (this.muted) return;
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const pan = laneCount > 1 ? ((laneIndex / (laneCount - 1)) * 2 - 1) * 0.72 : 0;

    // Sub-bass drop
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(160, now);
    sub.frequency.exponentialRampToValueAtTime(32, now + 0.34);
    subGain.gain.setValueAtTime(0.32, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    sub.connect(subGain);
    this.connectPanned(subGain, pan);
    sub.start(now);
    sub.stop(now + 0.4);

    // Dissonant tritone buzz crunch
    [138.59, 196.0].forEach((freq) => {
      const osc = ctx.createOscillator();
      const lp = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.62, now + 0.26);
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(920, now);
      lp.frequency.exponentialRampToValueAtTime(220, now + 0.26);
      g.gain.setValueAtTime(0.11, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.connect(lp);
      lp.connect(g);
      this.connectPanned(g, pan);
      osc.start(now);
      osc.stop(now + 0.3);
    });

    // Filtered low-mid explosion burst
    if (this.pinkCrowdBuffer) {
      const burst = ctx.createBufferSource();
      burst.buffer = this.pinkCrowdBuffer;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1400, now);
      lp.frequency.exponentialRampToValueAtTime(240, now + 0.32);
      const bg = ctx.createGain();
      bg.gain.setValueAtTime(0.24, now);
      bg.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
      burst.connect(lp);
      lp.connect(bg);
      this.connectPanned(bg, pan);
      burst.start(now, Math.random() * 1.5);
      burst.stop(now + 0.36);
    }
  }

  /**
   * Subtle crisp emerald chime when a player cleanly dodges a Panggulo hazard note.
   */
  playHazardDodged(laneIndex = 2, laneCount = 5) {
    if (this.muted) return;
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const pan = laneCount > 1 ? ((laneIndex / (laneCount - 1)) * 2 - 1) * 0.65 : 0;

    [880, 1318.5].forEach((hz, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      const t0 = now + idx * 0.035;
      osc.frequency.setValueAtTime(hz, t0);
      g.gain.setValueAtTime(0.001, t0);
      g.gain.linearRampToValueAtTime(0.065, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.16);
      osc.connect(g);
      this.connectPanned(g, pan);
      osc.start(t0);
      osc.stop(t0 + 0.18);
    });
  }
}

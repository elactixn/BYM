/**
 * lightingProfiles.js
 * Dynamic Stage Lighting & Mood Profile Interpolator:
 * Smoothly shifts 3D venue fog, spotlight hues, rim-light intensity, crowd lightsticks,
 * and LED backdrop mood across song sections:
 *  - INTRO_MOOD        (deep moody blue/violet haze with tight spotlights)
 *  - VERSE_GROOVE      (warm amber/cyan wash with beat-synced pulses)
 *  - CHORUS_EXPLOSION  (saturated venue colors, rapid truss beam sweeps, bright crowd lightsticks)
 *  - SOLO_SPOTLIGHT    (dramatic high-contrast amber/electric-cyan hero solo spotlighting)
 *  - FEVER_OVERDRIVE   (electric gold & white strobe highlights + pyrotechnics)
 *  - ENCORE_FINALE     (gold/crimson royal lighting + continuous aerial fireworks)
 */

import * as THREE from 'three';

export const LIGHTING_MOODS = {
  INTRO_MOOD: {
    id: 'INTRO_MOOD',
    fogTint: 0x090b22,
    fogDensityMult: 1.24,
    hemiSky: 0x3b4cca,
    hemiGround: 0x09071a,
    hemiIntensity: 0.56,
    keyColor: 0x93c5fd,
    keyIntensityMult: 0.62,
    spotPrimary: 0x6366f1,
    spotSecondary: 0x38bdf8,
    rimColor: 0x6366f1,
    rimIntensity: 1.15,
    crowdGlow: 0x38bdf8,
    beamSweepAmp: 0.25,
    beamSweepSpeed: 0.75,
    beamOpacityBoost: 0.02,
    strobeStrength: 0,
    ledBgTop: '#0d1030',
    ledAccent: '#818cf8',
  },
  VERSE_GROOVE: {
    id: 'VERSE_GROOVE',
    fogTint: 0x071220,
    fogDensityMult: 1.0,
    hemiSky: 0x38bdf8,
    hemiGround: 0x1e140b,
    hemiIntensity: 0.8,
    keyColor: 0xfde68a,
    keyIntensityMult: 0.96,
    spotPrimary: 0x06b6d4,
    spotSecondary: 0xf59e0b,
    rimColor: 0x06b6d4,
    rimIntensity: 1.55,
    crowdGlow: 0x22d3ee,
    beamSweepAmp: 0.45,
    beamSweepSpeed: 1.18,
    beamOpacityBoost: 0.04,
    strobeStrength: 0,
    ledBgTop: '#082230',
    ledAccent: '#22d3ee',
  },
  CHORUS_EXPLOSION: {
    id: 'CHORUS_EXPLOSION',
    fogTint: 0x10132e,
    fogDensityMult: 0.88,
    hemiSky: 0x67e8f9,
    hemiGround: 0x31102a,
    hemiIntensity: 1.08,
    keyColor: 0xffffff,
    keyIntensityMult: 1.25,
    spotPrimary: 0xec4899,
    spotSecondary: 0x22d3ee,
    rimColor: 0x38bdf8,
    rimIntensity: 2.35,
    crowdGlow: 0xf472b6,
    beamSweepAmp: 1.15,
    beamSweepSpeed: 2.25,
    beamOpacityBoost: 0.085,
    strobeStrength: 0.18,
    ledBgTop: '#240b36',
    ledAccent: '#f472b6',
  },
  SOLO_SPOTLIGHT: {
    id: 'SOLO_SPOTLIGHT',
    fogTint: 0x0b0a1f,
    fogDensityMult: 1.12,
    hemiSky: 0x38bdf8,
    hemiGround: 0x261209,
    hemiIntensity: 0.72,
    keyColor: 0xfff7ed,
    keyIntensityMult: 1.38,
    spotPrimary: 0x38bdf8,
    spotSecondary: 0xf59e0b,
    rimColor: 0xfbbf24,
    rimIntensity: 2.65,
    crowdGlow: 0x38bdf8,
    beamSweepAmp: 0.36,
    beamSweepSpeed: 1.05,
    beamOpacityBoost: 0.11,
    strobeStrength: 0.12,
    ledBgTop: '#160d2c',
    ledAccent: '#fbbf24',
  },
  FEVER_OVERDRIVE: {
    id: 'FEVER_OVERDRIVE',
    fogTint: 0x1d1404,
    fogDensityMult: 0.82,
    hemiSky: 0xfef08a,
    hemiGround: 0x2e1704,
    hemiIntensity: 1.22,
    keyColor: 0xfffbeb,
    keyIntensityMult: 1.4,
    spotPrimary: 0xfacc15,
    spotSecondary: 0xffffff,
    rimColor: 0xfacc15,
    rimIntensity: 2.8,
    crowdGlow: 0xfde047,
    beamSweepAmp: 1.35,
    beamSweepSpeed: 2.9,
    beamOpacityBoost: 0.12,
    strobeStrength: 0.45,
    ledBgTop: '#2f1a03',
    ledAccent: '#facc15',
  },
  ENCORE_FINALE: {
    id: 'ENCORE_FINALE',
    fogTint: 0x230812,
    fogDensityMult: 0.85,
    hemiSky: 0xfde047,
    hemiGround: 0x450a18,
    hemiIntensity: 1.18,
    keyColor: 0xfef3c7,
    keyIntensityMult: 1.35,
    spotPrimary: 0xfacc15,
    spotSecondary: 0xe11d48,
    rimColor: 0xfbbf24,
    rimIntensity: 2.75,
    crowdGlow: 0xf43f5e,
    beamSweepAmp: 1.25,
    beamSweepSpeed: 2.55,
    beamOpacityBoost: 0.11,
    strobeStrength: 0.3,
    ledBgTop: '#330916',
    ledAccent: '#fbbf24',
  },
};

const INSTRUMENT_ACCENTS = {
  guitar: 0x06b6d4,
  bass: 0x8b5cf6,
  drums: 0xf59e0b,
  piano: 0xec4899,
};

export class LightingProfileController {
  constructor() {
    this.activeMoodId = 'INTRO_MOOD';
    this.energySmooth = 0.2;

    // Live interpolated values (allocated once, zero per-frame garbage!)
    this.fogColor = new THREE.Color(0x090b22);
    this.hemiSky = new THREE.Color(0x38bdf8);
    this.hemiGround = new THREE.Color(0x0f172a);
    this.keyColor = new THREE.Color(0xe0f2fe);
    this.spotPrimary = new THREE.Color(0x06b6d4);
    this.spotSecondary = new THREE.Color(0xf59e0b);
    this.rimColor = new THREE.Color(0x06b6d4);
    this.bandRimColor = new THREE.Color(0x38bdf8);
    this.crowdGlow = new THREE.Color(0x38bdf8);

    this.fogDensityMult = 1.0;
    this.hemiIntensity = 0.82;
    this.keyIntensityMult = 1.0;
    this.rimIntensity = 1.6;
    this.bandRimIntensity = 2.4;
    this.beamSweepAmp = 0.45;
    this.beamSweepSpeed = 1.2;
    this.beamOpacityBoost = 0.04;
    this.strobeStrength = 0;
    this.strobePhase = 0;
    this.strobeFlash = 0;

    // Transition cooldowns so chorus drops, solos & outros trigger crisp pyro + band cues cleanly
    this.prevMoodId = 'INTRO_MOOD';
    this.prevSectionId = null;
    this.chorusDropCooldown = 0;

    // Scratch colors
    this._targetColor = new THREE.Color();
    this._venueColor = new THREE.Color();
    this._instColor = new THREE.Color();

    // Reusable output state returned every frame (zero per-frame allocations)
    this._state = {
      moodId: 'INTRO_MOOD',
      sectionType: 'INTRO',
      fogColor: this.fogColor,
      hemiSky: this.hemiSky,
      hemiGround: this.hemiGround,
      keyColor: this.keyColor,
      spotPrimary: this.spotPrimary,
      spotSecondary: this.spotSecondary,
      rimColor: this.rimColor,
      bandRimColor: this.bandRimColor,
      crowdGlow: this.crowdGlow,
      fogDensityMult: 1.0,
      hemiMult: 1.0,
      keyMult: 1.0,
      rimMult: 1.0,
      bandRimIntensity: 2.4,
      crowdGlowMult: 1.0,
      spotIntensityMult: 1.0,
      beamOpacityMult: 1.0,
      beamSweepAmp: 0.45,
      beamSweepSpeed: 1.2,
      beamOpacityBoost: 0.04,
      strobeStrength: 0,
      strobeFlash: 0,
      chorusDropTriggered: false,
      soloEntered: false,
      outroEntered: false,
      feverEntered: false,
      ledBgTop: '#0d1030',
      ledAccent: '#818cf8',
    };
  }

  /**
   * Determines the current concert lighting mood directly from detected Song Section,
   * gameplay Fever/Encore state, and fallback audio energy when no sections exist.
   */
  resolveMoodId({ playing, songTime, fever, encore, encoreFinaleActive, overallEnergy, combo, isWalkOn, currentSection }) {
    if (isWalkOn) return 'INTRO_MOOD';
    if (encoreFinaleActive || encore) {
      return fever ? 'FEVER_OVERDRIVE' : 'ENCORE_FINALE';
    }
    if (fever) return 'FEVER_OVERDRIVE';
    if (!playing || songTime < 0.15) return 'INTRO_MOOD';

    const secType = currentSection?.type;
    if (secType) {
      if (secType === 'INTRO' || secType === 'BRIDGE') return 'INTRO_MOOD';
      if (secType === 'GUITAR_SOLO') return 'SOLO_SPOTLIGHT';
      if (secType === 'CHORUS') return 'CHORUS_EXPLOSION';
      if (secType === 'OUTRO') return overallEnergy > 0.34 ? 'ENCORE_FINALE' : 'INTRO_MOOD';
      if (secType === 'PRE_CHORUS') return this.energySmooth > 0.42 ? 'CHORUS_EXPLOSION' : 'VERSE_GROOVE';
      if (secType === 'VERSE') return 'VERSE_GROOVE';
    }

    if (this.energySmooth > 0.4 || (this.energySmooth > 0.32 && combo >= 20)) {
      return 'CHORUS_EXPLOSION';
    }
    if (this.energySmooth < 0.16 && songTime < 16) {
      return 'INTRO_MOOD';
    }
    return 'VERSE_GROOVE';
  }

  /**
   * Smoothly interpolates all lighting profile channels toward the active mood profile.
   */
  update(dt, opts = {}) {
    const playing = Boolean(opts.playing);
    const songTime = opts.songTime ?? 0;
    const bpm = Math.max(70, Math.min(200, opts.bpm || 120));
    const fever = Boolean(opts.fever ?? opts.feverActive);
    const encore = Boolean(opts.encore ?? opts.isEncore);
    const encoreFinaleActive = Boolean(opts.encoreFinaleActive);
    const overallEnergy = opts.overallEnergy || 0;
    const combo = opts.combo || 0;
    const instrument = opts.instrument || 'guitar';
    const venueMeta = opts.venueMeta;
    const isWalkOn = Boolean(opts.isWalkOn);
    const stemDropped = Boolean(opts.stemDropped);
    const currentSection = opts.currentSection || null;
    const sectionType = currentSection?.type || (songTime < 2.2 ? 'INTRO' : 'VERSE');
    const sectionId = currentSection?.id || null;

    this.energySmooth = THREE.MathUtils.damp(this.energySmooth, overallEnergy, 2.4, dt);
    this.chorusDropCooldown = Math.max(0, this.chorusDropCooldown - dt);

    const moodId = this.resolveMoodId({
      playing,
      songTime,
      fever,
      encore,
      encoreFinaleActive,
      overallEnergy,
      combo,
      isWalkOn,
      currentSection,
    });

    const sectionChanged = Boolean(sectionId && sectionId !== this.prevSectionId);
    const enteredChorusBySection = sectionChanged && sectionType === 'CHORUS';
    const chorusDropTriggered =
      playing &&
      !isWalkOn &&
      this.chorusDropCooldown <= 0 &&
      (enteredChorusBySection ||
        (moodId === 'CHORUS_EXPLOSION' &&
          (this.prevMoodId === 'INTRO_MOOD' || this.prevMoodId === 'VERSE_GROOVE')));
    if (chorusDropTriggered) {
      this.chorusDropCooldown = 5.0;
    }

    const soloEntered =
      playing &&
      !isWalkOn &&
      ((sectionChanged && sectionType === 'GUITAR_SOLO') ||
        (moodId === 'SOLO_SPOTLIGHT' && this.prevMoodId !== 'SOLO_SPOTLIGHT'));

    const outroEntered =
      playing &&
      !isWalkOn &&
      sectionChanged &&
      sectionType === 'OUTRO';

    const feverEntered =
      playing &&
      moodId === 'FEVER_OVERDRIVE' &&
      this.prevMoodId !== 'FEVER_OVERDRIVE';

    this.prevSectionId = playing ? sectionId : null;
    this.prevMoodId = moodId;
    this.activeMoodId = moodId;
    const p = LIGHTING_MOODS[moodId] || LIGHTING_MOODS.VERSE_GROOVE;

    const lerpRate = 1 - Math.exp(-3.0 * dt);
    const venueFogHex = venueMeta?.fogColor ?? 0x060a18;
    const instHex = INSTRUMENT_ACCENTS[instrument] || 0x06b6d4;
    this._instColor.setHex(instHex);

    // Blend venue fog, sky & key colors with mood tint so every real-world & themed stage keeps its identity
    this._venueColor.setHex(venueFogHex);
    this._targetColor.setHex(p.fogTint).lerp(this._venueColor, 0.56);
    this.fogColor.lerp(this._targetColor, lerpRate);

    this._targetColor.setHex(p.hemiSky);
    if (venueMeta?.hemiSky != null) {
      this._venueColor.setHex(venueMeta.hemiSky);
      this._targetColor.lerp(this._venueColor, 0.38);
    }
    this.hemiSky.lerp(this._targetColor, lerpRate);

    this._targetColor.setHex(p.hemiGround);
    if (venueMeta?.hemiGround != null) {
      this._venueColor.setHex(venueMeta.hemiGround);
      this._targetColor.lerp(this._venueColor, 0.35);
    }
    this.hemiGround.lerp(this._targetColor, lerpRate);

    this._targetColor.setHex(p.keyColor);
    if (venueMeta?.keyColor != null) {
      this._venueColor.setHex(venueMeta.keyColor);
      this._targetColor.lerp(this._venueColor, 0.28);
    }
    this.keyColor.lerp(this._targetColor, lerpRate);

    // Blend verse/chorus primary accents subtly with the player's chosen instrument color
    const keepInstrumentHue = moodId === 'VERSE_GROOVE' || moodId === 'INTRO_MOOD';
    this._targetColor.setHex(p.spotPrimary);
    if (keepInstrumentHue) this._targetColor.lerp(this._instColor, 0.52);
    this.spotPrimary.lerp(this._targetColor, lerpRate);

    this.spotSecondary.lerp(this._targetColor.setHex(p.spotSecondary), lerpRate);

    this._targetColor.setHex(p.rimColor);
    if (keepInstrumentHue) this._targetColor.lerp(this._instColor, 0.62);
    this.rimColor.lerp(this._targetColor, lerpRate);

    // Dedicated high-contrast rear band rim light (cool white + mood tint) so moving silhouettes pop against haze!
    this._targetColor.setHex(0xffffff).lerp(this.rimColor, 0.48);
    this.bandRimColor.lerp(this._targetColor, lerpRate);

    this._targetColor.setHex(p.crowdGlow);
    if (keepInstrumentHue) this._targetColor.lerp(this._instColor, 0.45);
    this.crowdGlow.lerp(this._targetColor, lerpRate);

    this.fogDensityMult = THREE.MathUtils.damp(this.fogDensityMult, p.fogDensityMult, 2.5, dt);
    this.hemiIntensity = THREE.MathUtils.damp(this.hemiIntensity, p.hemiIntensity, 2.8, dt);
    this.keyIntensityMult = THREE.MathUtils.damp(this.keyIntensityMult, p.keyIntensityMult, 2.8, dt);
    this.rimIntensity = THREE.MathUtils.damp(this.rimIntensity, p.rimIntensity, 3.2, dt);
    const targetBandRim =
      moodId === 'FEVER_OVERDRIVE'
        ? 3.8
        : moodId === 'SOLO_SPOTLIGHT'
          ? 3.55
          : moodId === 'CHORUS_EXPLOSION' || moodId === 'ENCORE_FINALE'
            ? 3.2
            : moodId === 'VERSE_GROOVE'
              ? 2.35
              : 1.95;
    this.bandRimIntensity = THREE.MathUtils.damp(this.bandRimIntensity, targetBandRim, 3.4, dt);
    this.beamSweepAmp = THREE.MathUtils.damp(this.beamSweepAmp, p.beamSweepAmp, 2.6, dt);
    this.beamSweepSpeed = THREE.MathUtils.damp(this.beamSweepSpeed, p.beamSweepSpeed, 2.6, dt);
    this.beamOpacityBoost = THREE.MathUtils.damp(this.beamOpacityBoost, p.beamOpacityBoost, 3.0, dt);
    this.strobeStrength = THREE.MathUtils.damp(this.strobeStrength, p.strobeStrength, 3.4, dt);

    // Beat-synced strobe flash pulse for Chorus, Fever & Encore moments
    this.strobePhase += dt * (bpm / 60) * Math.PI * 4;
    const rawStrobe = Math.pow(Math.max(0, Math.sin(this.strobePhase)), 6);
    this.strobeFlash = stemDropped ? 0 : rawStrobe * this.strobeStrength;

    const dropDim = stemDropped ? 0.72 : 1.0;
    const s = this._state;
    s.moodId = moodId;
    s.sectionType = sectionType;
    s.fogDensityMult = this.fogDensityMult;
    s.hemiMult = (this.hemiIntensity / 0.82) * dropDim;
    s.keyMult = this.keyIntensityMult * dropDim;
    s.rimMult = (this.rimIntensity / 1.55) * dropDim;
    s.bandRimIntensity = this.bandRimIntensity * dropDim + this.strobeFlash * 1.4;
    s.crowdGlowMult = (0.72 + (this.rimIntensity / 2.2) * 0.65) * dropDim;
    s.spotIntensityMult = (0.8 + (this.keyIntensityMult - 0.6) * 0.68) * dropDim;
    s.beamOpacityMult = (0.94 + this.beamOpacityBoost * 4.8) * dropDim;
    s.beamSweepAmp = this.beamSweepAmp;
    s.beamSweepSpeed = this.beamSweepSpeed;
    s.beamOpacityBoost = this.beamOpacityBoost;
    s.strobeStrength = this.strobeStrength;
    s.strobeFlash = this.strobeFlash;
    s.chorusDropTriggered = chorusDropTriggered;
    s.soloEntered = soloEntered;
    s.outroEntered = outroEntered;
    s.feverEntered = feverEntered;
    s.ledBgTop = p.ledBgTop;
    s.ledAccent = p.ledAccent;

    return s;
  }

  getActiveMood() {
    return LIGHTING_MOODS[this.activeMoodId] || LIGHTING_MOODS.VERSE_GROOVE;
  }
}

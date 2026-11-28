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
    skyTop: 0x040615,
    skyMid: 0x0b1233,
    skyHorizon: 0x16224a,
    searchlightIntensity: 0.25,
    searchlightSpeed: 0.35,
    hazeShaftOpacity: 0.14,
    ribbonScrollSpeed: 0.04,
    crowdLightstickBoost: 0.72,
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
    skyTop: 0x050919,
    skyMid: 0x0e1d3b,
    skyHorizon: 0x1f365c,
    searchlightIntensity: 0.52,
    searchlightSpeed: 0.58,
    hazeShaftOpacity: 0.18,
    ribbonScrollSpeed: 0.08,
    crowdLightstickBoost: 0.94,
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
    skyTop: 0x070a22,
    skyMid: 0x1e1645,
    skyHorizon: 0x3f1e56,
    searchlightIntensity: 1.05,
    searchlightSpeed: 1.12,
    hazeShaftOpacity: 0.28,
    ribbonScrollSpeed: 0.16,
    crowdLightstickBoost: 1.35,
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
    skyTop: 0x040717,
    skyMid: 0x101336,
    skyHorizon: 0x2b1f44,
    searchlightIntensity: 0.72,
    searchlightSpeed: 0.45,
    hazeShaftOpacity: 0.3,
    ribbonScrollSpeed: 0.1,
    crowdLightstickBoost: 1.08,
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
    skyTop: 0x080716,
    skyMid: 0x271936,
    skyHorizon: 0x523115,
    searchlightIntensity: 1.38,
    searchlightSpeed: 1.48,
    hazeShaftOpacity: 0.36,
    ribbonScrollSpeed: 0.24,
    crowdLightstickBoost: 1.55,
  },
  ENCORE_FINALE: {
    id: 'ENCORE_FINALE',
    fogTint: 0x050816,
    fogDensityMult: 0.38,
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
    skyTop: 0x02040e,
    skyMid: 0x0a102b,
    skyHorizon: 0x261433,
    searchlightIntensity: 1.42,
    searchlightSpeed: 1.28,
    hazeShaftOpacity: 0.32,
    ribbonScrollSpeed: 0.22,
    crowdLightstickBoost: 1.6,
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
    this.skyTopColor = new THREE.Color(0x040615);
    this.skyMidColor = new THREE.Color(0x0b1233);
    this.skyHorizonColor = new THREE.Color(0x16224a);

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
    this.blinderPulse = 0;
    this.searchlightIntensity = 0.35;
    this.searchlightSpeed = 0.45;
    this.hazeShaftOpacity = 0.16;
    this.ribbonScrollSpeed = 0.06;
    this.crowdLightstickBoost = 0.9;

    // Transition cooldowns so chorus drops, solos & outros trigger crisp pyro + band cues cleanly
    this.prevMoodId = 'INTRO_MOOD';
    this.prevSectionId = null;
    this.chorusDropCooldown = 0;

    // Scratch colors
    this._targetColor = new THREE.Color();
    this._venueColor = new THREE.Color();
    this._instColor = new THREE.Color();
    this.multiplierColor = new THREE.Color(0x38bdf8);

    // Live Pyromusical Firework Multi-Color Sky-Bloom & Stadium Bowl Light Bath state (zero per-frame GC)
    this.fireworkSkyColor = new THREE.Color(0xfacc15);
    this.fireworkSecondaryColor = new THREE.Color(0xec4899);
    this.fireworkRimColor = new THREE.Color(0xfef08a);
    this._fwColorScratch = new THREE.Color();
    this._fwWhiteScratch = new THREE.Color(0xfffbeb);
    this.fireworkFlashIntensity = 0;
    this.fireworkSkyBloom = 0;
    this.fireworkSubBassFlash = 0;
    this.stadiumBowlWash = 0;

    // Motorized roof lighting pods, interactive LED stage floor & sub-bass kick excursion (zero GC)
    this.podTiltX = 0;
    this.podRollZ = 0;
    this.podSpinY = 0;
    this.podLiftY = 0;
    this.floorPulse = 0;
    this.subKickPunch = 0;

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
      skyTopColor: this.skyTopColor,
      skyMidColor: this.skyMidColor,
      skyHorizonColor: this.skyHorizonColor,
      multiplierColor: this.multiplierColor,
      fireworkSkyColor: this.fireworkSkyColor,
      fireworkSecondaryColor: this.fireworkSecondaryColor,
      fireworkRimColor: this.fireworkRimColor,
      fireworkFlashIntensity: 0,
      fireworkSkyBloom: 0,
      fireworkSubBassFlash: 0,
      fireworkReflectionBoost: 0,
      stadiumBowlWash: 0,
      streakTier: 0,
      laserFanActive: false,
      hazeBoost: 0,
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
      blinderPulse: 0,
      searchlightIntensity: 0.35,
      searchlightSpeed: 0.45,
      hazeShaftOpacity: 0.16,
      ribbonScrollSpeed: 0.06,
      crowdLightstickBoost: 0.9,
      chorusDropTriggered: false,
      soloEntered: false,
      outroEntered: false,
      feverEntered: false,
      ledBgTop: '#0d1030',
      ledAccent: '#818cf8',
      ambianceType: 'ROCK_ANTHEM',
      isBallad: false,
      isGrandEncore: false,
      podTiltX: 0,
      podRollZ: 0,
      podSpinY: 0,
      podLiftY: 0,
      podRingIntensity: 1.0,
      floorPulse: 0,
      floorWaveSpeed: 1.0,
      subKickPunch: 0,
    };
  }

  /**
   * Determines the current concert lighting mood directly from detected Song Section,
   * gameplay Fever/Encore state, and fallback audio energy when no sections exist.
   */
  resolveMoodId({ playing, songTime, fever, encore, encoreFinaleActive, isEncoreActive, overallEnergy, combo, isWalkOn, currentSection }) {
    if (isWalkOn) return 'INTRO_MOOD';
    if (encoreFinaleActive || isEncoreActive || encore) {
      return fever ? 'FEVER_OVERDRIVE' : 'ENCORE_FINALE';
    }
    if (fever) return 'FEVER_OVERDRIVE';
    if (!playing || songTime < 0.15) return 'INTRO_MOOD';

    const secType = currentSection?.type;
    if (secType) {
      if (secType === 'INTRO' || secType === 'BRIDGE' || secType === 'BREAKDOWN') return 'INTRO_MOOD';
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
    const isEncoreActive = Boolean(opts.isEncoreActive);
    const encoreFinaleActive = Boolean(opts.encoreFinaleActive);
    const isGrandEncore = isEncoreActive || encoreFinaleActive;
    const overallEnergy = opts.overallEnergy || 0;
    const combo = opts.combo || 0;
    const instrument = opts.instrument || 'guitar';
    const venueMeta = opts.venueMeta;
    const isWalkOn = Boolean(opts.isWalkOn);
    const stemDropped = Boolean(opts.stemDropped);
    const currentSection = opts.currentSection || null;
    const trackMeta = opts.trackMeta || null;
    const ambianceType = trackMeta?.ambianceType || 'ROCK_ANTHEM';
    const isBallad = ambianceType === 'BALLAD_EMOTIONAL';
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
      isEncoreActive,
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

    // Atmospheric Sky Dome 3-stop palette blended subtly with the stadium's native night/twilight identity
    const venueSkyHex = venueMeta?.skyColor ?? 0x050814;
    this._venueColor.setHex(venueSkyHex);
    this._targetColor.setHex(p.skyTop).lerp(this._venueColor, isGrandEncore ? 0.2 : 0.42);
    this.skyTopColor.lerp(this._targetColor, lerpRate);

    this._targetColor.setHex(p.skyMid).lerp(this._venueColor, isGrandEncore ? 0.18 : 0.48);
    this.skyMidColor.lerp(this._targetColor, lerpRate);

    this._venueColor.setHex(venueFogHex);
    this._targetColor.setHex(p.skyHorizon).lerp(this._venueColor, isGrandEncore ? 0.28 : 0.55);
    this.skyHorizonColor.lerp(this._targetColor, lerpRate);

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
    this.searchlightIntensity = THREE.MathUtils.damp(this.searchlightIntensity, p.searchlightIntensity, 2.8, dt);
    this.searchlightSpeed = THREE.MathUtils.damp(this.searchlightSpeed, p.searchlightSpeed, 2.8, dt);
    this.hazeShaftOpacity = THREE.MathUtils.damp(this.hazeShaftOpacity, p.hazeShaftOpacity, 2.8, dt);
    this.ribbonScrollSpeed = THREE.MathUtils.damp(this.ribbonScrollSpeed, p.ribbonScrollSpeed, 2.5, dt);
    this.crowdLightstickBoost = THREE.MathUtils.damp(this.crowdLightstickBoost, p.crowdLightstickBoost, 3.2, dt);

    // Ambiance-driven temperature & movement shaping (Ballads glow warm golden-indigo with gentle beams; Metal punches hard)
    if (isBallad && moodId !== 'FEVER_OVERDRIVE' && moodId !== 'ENCORE_FINALE') {
      this._targetColor.setHex(0xfbbf24); // warm golden spotlight
      this.spotPrimary.lerp(this._targetColor, 0.35);
      this._targetColor.setHex(0x6366f1); // deep indigo fill
      this.spotSecondary.lerp(this._targetColor, 0.32);
      this._targetColor.setHex(0xfde68a);
      this.bandRimColor.lerp(this._targetColor, 0.28);
    } else if (ambianceType === 'METAL_CHAOS' && moodId !== 'FEVER_OVERDRIVE') {
      this._targetColor.setHex(0xef4444);
      this.spotPrimary.lerp(this._targetColor, 0.32);
      this._targetColor.setHex(0xf8fafc);
      this.bandRimColor.lerp(this._targetColor, 0.25);
    } else if (ambianceType === 'SYNTH_CYBER' && moodId !== 'FEVER_OVERDRIVE') {
      this._targetColor.setHex(0x22d3ee);
      this.spotPrimary.lerp(this._targetColor, 0.34);
      this._targetColor.setHex(0xe879f9);
      this.spotSecondary.lerp(this._targetColor, 0.34);
    } else if (ambianceType === 'POP_UPBEAT' && moodId !== 'FEVER_OVERDRIVE') {
      this._targetColor.setHex(0xf472b6);
      this.spotPrimary.lerp(this._targetColor, 0.25);
      this._targetColor.setHex(0x38bdf8);
      this.spotSecondary.lerp(this._targetColor, 0.25);
    }

    const overlayMeta = opts.overlayMeta || null;
    if (overlayMeta && overlayMeta.id !== 'STANDARD' && moodId !== 'FEVER_OVERDRIVE') {
      const isFiesta = overlayMeta.id === 'FIESTA_PINOY';
      const isHellfire = overlayMeta.id === 'APOCALYPSE_HELLFIRE';
      const blendWeight = isHellfire ? 0.46 : isFiesta ? 0.42 : 0.34;
      if (overlayMeta.accentHex != null) {
        this._targetColor.setHex(overlayMeta.accentHex);
        this.spotPrimary.lerp(this._targetColor, blendWeight);
        this.crowdGlow.lerp(this._targetColor, blendWeight);
      }
      if (overlayMeta.secondaryHex != null) {
        this._targetColor.setHex(overlayMeta.secondaryHex);
        this.spotSecondary.lerp(this._targetColor, blendWeight);
      }
      if (overlayMeta.rimHex != null) {
        this._targetColor.setHex(overlayMeta.rimHex);
        this.rimColor.lerp(this._targetColor, blendWeight * 0.9);
      }
      if (isHellfire) {
        this._targetColor.setHex(0x1f0806);
        this.fogColor.lerp(this._targetColor, 0.32);
        this._targetColor.setHex(0xffedd5);
        this.bandRimColor.lerp(this._targetColor, 0.32);
      } else if (isFiesta) {
        this._targetColor.setHex(0xfef08a);
        this.bandRimColor.lerp(this._targetColor, 0.25);
      }
    }

    const ambianceSweepScale = isBallad ? 0.48 : ambianceType === 'METAL_CHAOS' ? 1.28 : 1.0;
    const ambianceStrobeScale = isBallad ? 0.0 : ambianceType === 'METAL_CHAOS' ? 1.25 : 1.0;

    // Beat-synced strobe flash pulse + warm tungsten audience blinders for Chorus Drops, Fever & Encore
    const barPhase = Number.isFinite(opts.barPhase) ? opts.barPhase : ((songTime * (bpm / 60)) / 4) % 1;
    const phraseProgress = Number.isFinite(opts.phraseProgress) ? opts.phraseProgress : ((songTime * (bpm / 60)) / 32) % 1;
    const beatPhase = Number.isFinite(opts.beatPhase) ? opts.beatPhase : (songTime * (bpm / 60)) % 1;
    const kickTransient = Math.max(
      Number(opts.transientEnergy?.kickImpulse || 0),
      Number(opts.transientEnergy?.kick || 0)
    );
    const snareTransient = Math.max(
      Number(opts.transientEnergy?.snareImpulse || 0),
      Number(opts.transientEnergy?.snare || 0)
    );
    const isDownbeat = Boolean(opts.isDownbeat ?? opts.transientEnergy?.isDownbeat ?? barPhase < 0.08);
    const isSnareHit = Boolean(opts.isSnareHit ?? opts.transientEnergy?.isSnareHit ?? false);

    this.strobePhase += dt * (bpm / 60) * Math.PI * 4;
    const rawStrobe = Math.pow(Math.max(0, Math.sin(this.strobePhase)), 6);
    this.strobeFlash = stemDropped
      ? 0
      : Math.min(1.2, rawStrobe * this.strobeStrength * ambianceStrobeScale + (isSnareHit && snareTransient > 0.52 ? snareTransient * 0.22 * ambianceStrobeScale : 0));

    const downbeatHit = playing && (isDownbeat || barPhase < 0.08) ? Math.max(0.82, 1 - Math.min(barPhase, beatPhase) / 0.14) : 0;
    const bassHit = Math.max(opts.bassEnergy || 0, Number(opts.transientEnergy?.bassGroove || 0), kickTransient);
    const blinderTarget =
      !playing || isWalkOn || stemDropped
        ? 0
        : chorusDropTriggered || feverEntered || outroEntered
          ? 1.0
          : isGrandEncore
            ? 0.52 + Math.pow(Math.max(0, Math.sin(beatPhase * Math.PI * 2)), 4) * 0.45
            : moodId === 'FEVER_OVERDRIVE' || (moodId === 'CHORUS_EXPLOSION' && (bassHit > 0.52 || downbeatHit > 0.55))
              ? 0.28 + bassHit * 0.48 + downbeatHit * 0.35
              : 0;
    this.blinderPulse = THREE.MathUtils.damp(this.blinderPulse, blinderTarget, blinderTarget > this.blinderPulse ? 15 : 4.2, dt);

    // Progressive Streak-Driven Stage Evolution: 25x (LED lock), 50x (laser fans + cold sparks + haze), 100x+ (Gold Overdrive)
    const streakTier = combo >= 100 ? 3 : combo >= 50 ? 2 : combo >= 25 ? 1 : 0;
    const multHex =
      fever || streakTier >= 3
        ? 0xfacc15
        : combo >= 30
          ? 0xa855f7
          : combo >= 20
            ? 0x38bdf8
            : combo >= 10
              ? 0x22c55e
              : 0x38bdf8;
    this.multiplierColor.setHex(multHex);
    const beatPulse = playing ? Math.pow(Math.max(0, 1 - beatPhase * 2.2), 1.6) : 0;
    const hazeBoost = streakTier >= 2 ? 0.28 + beatPulse * (streakTier >= 3 ? 0.4 : 0.24) : 0;

    // Articulated Moving-Head Beam & Wash Sweep Choreography synced to barPhase & phraseProgress
    const soloLockStrength = moodId === 'SOLO_SPOTLIGHT' ? 0.92 : moodId === 'INTRO_MOOD' ? 0.72 : 0.38;
    const movingHeadSweep =
      Math.sin(barPhase * Math.PI * 2) * (0.45 + this.beamSweepAmp * 0.12) +
      Math.cos(phraseProgress * Math.PI * 4) * 0.28;
    const movingHeadTiltOffset = Math.sin(phraseProgress * Math.PI * 2) * 0.26 + snareTransient * 0.16;
    const pyroDownbeatAccent = Boolean(
      playing &&
        !isWalkOn &&
        !stemDropped &&
        downbeatHit > 0.78 &&
        (moodId === 'CHORUS_EXPLOSION' || streakTier >= 2 || fever || encore || isGrandEncore) &&
        (bassHit > 0.36 || snareTransient > 0.36 || fever || encore || isGrandEncore)
    );

    // Motorized 3-pod overhead moving-head truss rigs + LED stage floor matrix + cardioid sub-bass punch
    const podAmp = isBallad ? 0.48 : fever || encore || isGrandEncore ? 1.25 : moodId === 'CHORUS_EXPLOSION' ? 1.08 : 0.75;
    const targetPodTiltX = playing
      ? Math.sin(phraseProgress * Math.PI * 2) * 0.24 * podAmp + kickTransient * 0.08
      : Math.sin(songTime * 0.45) * 0.06;
    const targetPodRollZ = playing
      ? Math.cos(barPhase * Math.PI * 2) * 0.18 * podAmp
      : Math.cos(songTime * 0.35) * 0.05;
    const targetPodLiftY = playing
      ? (moodId === 'CHORUS_EXPLOSION' || fever || encore || isGrandEncore ? 0.55 : moodId === 'SOLO_SPOTLIGHT' ? -0.45 : 0) +
        Math.sin(phraseProgress * Math.PI * 2) * 0.34 * podAmp
      : 0;
    this.podTiltX = THREE.MathUtils.damp(this.podTiltX, targetPodTiltX, 6.2, dt);
    this.podRollZ = THREE.MathUtils.damp(this.podRollZ, targetPodRollZ, 6.2, dt);
    this.podLiftY = THREE.MathUtils.damp(this.podLiftY, targetPodLiftY, 3.8, dt);
    this.podSpinY = (this.podSpinY + dt * (playing ? (isBallad ? 0.22 : 0.48 + overallEnergy * 0.52) : 0.14)) % (Math.PI * 2);

    const floorPulseTarget = playing
      ? Math.min(1.4, beatPulse * 0.75 + bassHit * 0.65 + (fever || encore ? 0.32 : 0))
      : 0.18;
    this.floorPulse = THREE.MathUtils.damp(
      this.floorPulse,
      floorPulseTarget,
      floorPulseTarget > this.floorPulse ? 22 : 6.5,
      dt
    );
    const subKickTarget = playing ? Math.min(1.25, kickTransient * 1.1 + bassHit * 0.55) : 0;
    this.subKickPunch = THREE.MathUtils.damp(
      this.subKickPunch,
      subKickTarget,
      subKickTarget > this.subKickPunch ? 34 : 11.5,
      dt
    );

    // Pyromusical Aerial Firework Multi-Color Volumetric Sky Bloom, Stadium Bowl Bath & Salute Concussion Flash
    const fwFlash = opts.fireworkFlash || null;
    const targetFwInt = fwFlash ? Math.min(1.85, Math.max(0, fwFlash.intensity || 0)) : 0;
    const targetFwBloom = fwFlash ? Math.min(1.45, Math.max(0, fwFlash.skyBloom || 0)) : 0;
    const targetFwSub = fwFlash ? Math.min(1.35, Math.max(0, fwFlash.subBassFlash || 0)) : 0;
    this.fireworkFlashIntensity = THREE.MathUtils.damp(
      this.fireworkFlashIntensity,
      targetFwInt,
      targetFwInt > this.fireworkFlashIntensity ? 28 : 4.8,
      dt
    );
    this.fireworkSkyBloom = THREE.MathUtils.damp(
      this.fireworkSkyBloom,
      targetFwBloom,
      targetFwBloom > this.fireworkSkyBloom ? 20 : 3.1,
      dt
    );
    this.fireworkSubBassFlash = THREE.MathUtils.damp(
      this.fireworkSubBassFlash,
      targetFwSub,
      targetFwSub > this.fireworkSubBassFlash ? 34 : 8.5,
      dt
    );
    const targetBowlWash = Math.min(1.65, this.fireworkFlashIntensity * 0.65 + this.fireworkSkyBloom * 0.55 + this.fireworkSubBassFlash * 0.45);
    this.stadiumBowlWash = THREE.MathUtils.damp(
      this.stadiumBowlWash,
      targetBowlWash,
      targetBowlWash > this.stadiumBowlWash ? 16 : 3.6,
      dt
    );
    if (fwFlash?.color && (targetFwInt > 0.01 || targetFwBloom > 0.01)) {
      const colorMix = 1 - Math.exp(-(targetFwInt > 0.2 ? 18 : 7.5) * dt);
      this.fireworkSkyColor.lerp(fwFlash.color, colorMix);
      if (fwFlash.secondaryColor) {
        this.fireworkSecondaryColor.lerp(fwFlash.secondaryColor, colorMix);
      } else {
        this.fireworkSecondaryColor.lerp(fwFlash.color, colorMix * 0.6);
      }
      this._fwColorScratch.copy(fwFlash.color).lerp(this._fwWhiteScratch, 0.28 + this.fireworkSubBassFlash * 0.45);
      this.fireworkRimColor.lerp(this._fwColorScratch, colorMix);
    }

    const fwSkyMix = Math.min(0.88, this.fireworkSkyBloom * 0.66);
    const fwRimMix = Math.min(0.9, this.fireworkFlashIntensity * 0.52);
    const fwSalute = this.fireworkSubBassFlash;
    if (fwSkyMix > 0.004 || fwRimMix > 0.004 || fwSalute > 0.004) {
      this.skyTopColor.lerp(this.fireworkSkyColor, Math.min(0.5, fwSkyMix * 0.38));
      this.skyMidColor.lerp(this.fireworkSkyColor, Math.min(0.8, fwSkyMix * 0.82));
      this.skyHorizonColor.lerp(this.fireworkSecondaryColor, Math.min(0.72, fwSkyMix * 0.6));
      this.fogColor.lerp(this.fireworkSkyColor, Math.min(0.46, fwSkyMix * 0.4));
      this.hemiSky.lerp(this.fireworkRimColor, Math.min(0.72, fwRimMix * 0.76));
      this.hemiGround.lerp(this.fireworkSecondaryColor, Math.min(0.42, this.stadiumBowlWash * 0.28));
      this.rimColor.lerp(this.fireworkRimColor, Math.min(0.78, fwRimMix * 0.88));
      this.bandRimColor.lerp(this.fireworkRimColor, Math.min(0.68, fwRimMix * 0.72));
      this.crowdGlow.lerp(this.fireworkSecondaryColor, Math.min(0.62, fwRimMix * 0.62));

      if (fwSalute > 0.01) {
        const saluteMix = Math.min(0.76, fwSalute * 0.62);
        this.skyMidColor.lerp(this._fwWhiteScratch, saluteMix * 0.62);
        this.hemiSky.lerp(this._fwWhiteScratch, saluteMix * 0.55);
        this.bandRimColor.lerp(this._fwWhiteScratch, saluteMix * 0.68);
      }
    }

    const fwReflectBoost = Math.min(1.75, this.fireworkFlashIntensity * 0.78 + this.fireworkSkyBloom * 0.5 + fwSalute * 0.58);
    const dropDim = stemDropped ? 0.72 : 1.0;
    const s = this._state;
    s.moodId = moodId;
    s.sectionType = sectionType;
    s.ambianceType = ambianceType;
    s.isBallad = isBallad;
    s.isGrandEncore = isGrandEncore;
    s.streakTier = streakTier;
    s.multiplierColor = this.multiplierColor;
    s.fireworkSkyColor = this.fireworkSkyColor;
    s.fireworkSecondaryColor = this.fireworkSecondaryColor;
    s.fireworkRimColor = this.fireworkRimColor;
    s.fireworkFlashIntensity = this.fireworkFlashIntensity;
    s.fireworkSkyBloom = this.fireworkSkyBloom;
    s.fireworkSubBassFlash = fwSalute;
    s.fireworkReflectionBoost = fwReflectBoost;
    s.stadiumBowlWash = this.stadiumBowlWash;
    s.laserFanActive = playing && !isWalkOn && (streakTier >= 2 || fever || encore || isGrandEncore);
    s.hazeBoost = hazeBoost + this.fireworkSkyBloom * 0.22;
    s.fogDensityMult = isGrandEncore ? 0.38 : this.fogDensityMult + hazeBoost * 0.32;
    s.hemiMult = (this.hemiIntensity / 0.82 + this.fireworkFlashIntensity * 0.46 + fwSalute * 0.55) * dropDim;
    s.keyMult = this.keyIntensityMult * dropDim;
    s.rimMult =
      (this.rimIntensity / 1.55 +
        (streakTier >= 3 ? 0.45 : streakTier >= 2 ? 0.22 : 0) +
        this.fireworkFlashIntensity * 0.62 +
        fwSalute * 0.65) *
      dropDim;
    s.bandRimIntensity =
      (this.bandRimIntensity +
        (streakTier >= 2 ? beatPulse * (streakTier >= 3 ? 1.15 : 0.6) : 0) +
        this.fireworkFlashIntensity * 1.15 +
        fwSalute * 1.65) *
        dropDim +
      this.strobeFlash * 1.4;
    s.crowdGlowMult =
      (0.72 +
        (this.rimIntensity / 2.2) * 0.65 +
        (streakTier >= 3 ? 0.28 : streakTier >= 1 ? 0.12 : 0) +
        this.fireworkFlashIntensity * 0.45 +
        fwSalute * 0.52) *
      dropDim;
    s.spotIntensityMult = (0.8 + (this.keyIntensityMult - 0.6) * 0.68) * dropDim;
    s.beamOpacityMult = (0.94 + this.beamOpacityBoost * 4.8 + hazeBoost * 0.5) * dropDim;
    s.beamSweepAmp = this.beamSweepAmp * ambianceSweepScale;
    s.beamSweepSpeed = this.beamSweepSpeed * (isBallad ? 0.58 : 1.0);
    s.beamOpacityBoost = this.beamOpacityBoost;
    s.strobeStrength = this.strobeStrength * ambianceStrobeScale;
    s.strobeFlash = this.strobeFlash + fwSalute * 0.45;
    s.blinderPulse = Math.min(1.25, this.blinderPulse + fwSalute * 0.58);
    s.skyTopColor = this.skyTopColor;
    s.skyMidColor = this.skyMidColor;
    s.skyHorizonColor = this.skyHorizonColor;
    s.searchlightIntensity = (this.searchlightIntensity + (streakTier >= 2 ? 0.25 : 0)) * dropDim;
    s.searchlightSpeed = this.searchlightSpeed * (isBallad ? 0.55 : 1.0);
    s.hazeShaftOpacity = (this.hazeShaftOpacity + hazeBoost * 0.14 + this.fireworkSkyBloom * 0.08) * dropDim;
    s.ribbonScrollSpeed = this.ribbonScrollSpeed * (playing ? 1.0 : 0.35);
    s.crowdLightstickBoost =
      (this.crowdLightstickBoost * (streakTier >= 2 ? 1.15 : 1.0) + this.fireworkFlashIntensity * 0.38 + fwSalute * 0.35) *
      dropDim;
    s.barPhase = barPhase;
    s.phraseProgress = phraseProgress;
    s.soloLockStrength = soloLockStrength;
    s.movingHeadSweep = movingHeadSweep * ambianceSweepScale;
    s.movingHeadTiltOffset = movingHeadTiltOffset;
    s.pyroDownbeatAccent = pyroDownbeatAccent;
    s.chorusDropTriggered = chorusDropTriggered;
    s.soloEntered = soloEntered;
    s.outroEntered = outroEntered;
    s.feverEntered = feverEntered;
    s.ledBgTop = isBallad && moodId !== 'FEVER_OVERDRIVE' ? '#1e1635' : p.ledBgTop;
    s.ledAccent = isBallad && moodId !== 'FEVER_OVERDRIVE' ? '#fbbf24' : p.ledAccent;
    s.podTiltX = this.podTiltX;
    s.podRollZ = this.podRollZ;
    s.podSpinY = this.podSpinY;
    s.podLiftY = this.podLiftY;
    s.podRingIntensity = (1.1 + this.floorPulse * 0.95 + this.blinderPulse * 0.65) * dropDim;
    s.floorPulse = this.floorPulse;
    s.floorWaveSpeed = playing ? (isBallad ? 0.55 : (bpm / 120) * (fever || encore ? 1.45 : 1.0)) : 0.35;
    s.subKickPunch = this.subKickPunch;

    return s;
  }

  getActiveMood() {
    return LIGHTING_MOODS[this.activeMoodId] || LIGHTING_MOODS.VERSE_GROOVE;
  }
}

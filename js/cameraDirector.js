/**
 * cameraDirector.js
 * Kinetic Concert Camera Director:
 *  - Named broadcast presets with smooth cubic damping & continuous dolly/crane motion:
 *      * WIDE_ARENA_SWEEP         — Full concert stage + stadium crowd panoramic glide
 *      * GUITAR_HERO_LOW_ANGLE    — Hero low-angle tracking shot with subtle Dutch tilt on solos
 *      * BASS_POCKET_DOLLY        — Stage-right tracking dolly on Bassist
 *      * DRUM_RISER_OVERHEAD      — Elevated side-overhead angle on Drummer & kit
 *      * CROWD_REVERSE_SILHOUETTE — Dramatic behind-the-band reverse shot over glowing crowd
 *      * FEVER_CRANE_ORBIT        — Sweeping high-energy stadium crane arc during Fever & Encore
 *  - Kick-drum impulse camera shake on bass/kick punches.
 *  - Backstage Live 3D Preview Focus (`setlist`, `band`, `guitar`, `bass`, `drums`, `venues`)
 *    so the 3D camera smoothly zooms onto the band/instrument/venue while browsing Backstage tabs!
 */

import * as THREE from 'three';

export const CAMERA_PRESETS = {
  WIDE_ARENA_SWEEP: 'WIDE_ARENA_SWEEP',
  GUITAR_HERO_LOW_ANGLE: 'GUITAR_HERO_LOW_ANGLE',
  BASS_POCKET_DOLLY: 'BASS_POCKET_DOLLY',
  DRUM_RISER_OVERHEAD: 'DRUM_RISER_OVERHEAD',
  PIANO_KEYS_CLOSEUP: 'PIANO_KEYS_CLOSEUP',
  CROWD_REVERSE_SILHOUETTE: 'CROWD_REVERSE_SILHOUETTE',
  FEVER_CRANE_ORBIT: 'FEVER_CRANE_ORBIT',
};

export class CameraDirector {
  constructor() {
    this.mode = 'on'; // 'on' | 'subtle' | 'locked'
    this.currentPreset = CAMERA_PRESETS.WIDE_ARENA_SWEEP;
    this.backstageFocus = 'setlist'; // 'setlist' | 'band' | 'guitar' | 'bass' | 'drums' | 'highway' | 'venues'
    this.presetAge = 0;
    this.lastCutBar = -999;
    this.cutCount = 0;
    this.shotSideSign = 1;

    // Kinetic spherical rig + Dutch tilt roll + kick-drum impulse shake (zero per-frame heap allocations)
    this.azimuth = 0;
    this.radius = 11.4;
    this.height = 3.9;
    this.fov = 46;
    this.roll = 0;
    this.kickShake = 0;
    this.kickShakePhase = 0;
    this.prevFever = false;
    this.prevEncore = false;
    this.prevSectionId = null;

    // Cubic-damped shot transition state (smooth Hermite glide on camera cuts!)
    this.transitionProgress = 1;
    this.transitionDuration = 0.55;
    this.fromAzimuth = 0;
    this.fromRadius = 11.4;
    this.fromHeight = 3.9;
    this.fromFov = 46;
    this.fromRoll = 0;
    this._fromTarget = new THREE.Vector3(0, 1.85, -1.6);

    this.target = new THREE.Vector3(0, 1.85, -1.6);
    this._desiredTarget = new THREE.Vector3(0, 1.85, -1.6);
  }

  setMode(mode) {
    if (mode === 'on' || mode === 'subtle' || mode === 'locked') {
      this.mode = mode;
    }
  }

  setBackstageFocus(focusKey) {
    this.backstageFocus = focusKey || 'setlist';
  }

  triggerKickImpulse(strength = 0.55) {
    this.kickShake = Math.min(1.0, Math.max(this.kickShake, strength));
  }

  resetForSong() {
    this.currentPreset = CAMERA_PRESETS.WIDE_ARENA_SWEEP;
    this.presetAge = 0;
    this.lastCutBar = -999;
    this.cutCount = 0;
    this.shotSideSign = 1;
    this.roll = 0;
    this.kickShake = 0;
    this.prevFever = false;
    this.prevEncore = false;
    this.prevSectionId = null;
    this.transitionProgress = 1;
  }

  /**
   * Resolves the exact 4/4 measure index from the dynamic DP beatGrid (adapting to live
   * drummer tempo drift) with clean BPM fallback.
   */
  resolveDynamicBarNumber(songTime, beatGrid, beatSec) {
    if (songTime < 0) return -1;
    if (Array.isArray(beatGrid) && beatGrid.length >= 4) {
      let lo = 0;
      let hi = beatGrid.length - 1;
      let idx = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (beatGrid[mid].timeSec <= songTime + 0.025) {
          idx = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      if (idx >= 0) {
        let measureCount = 0;
        for (let i = 0; i <= idx; i += 1) {
          if (beatGrid[i].isMeasure) measureCount += 1;
        }
        return Math.max(0, measureCount - 1);
      }
      return -1;
    }
    return Math.floor(songTime / (beatSec * 4));
  }

  beginCubicTransition(duration = 0.52) {
    this.fromAzimuth = this.azimuth;
    this.fromRadius = this.radius;
    this.fromHeight = this.height;
    this.fromFov = this.fov;
    this.fromRoll = this.roll;
    this._fromTarget.copy(this.target);
    this.transitionProgress = 0;
    this.transitionDuration = Math.max(0.22, duration);
  }

  selectNextPreset({
    activeInstrument,
    combo,
    fever,
    encore,
    overallEnergy,
    stemActivity,
    hasVocalist,
    sectionType,
  }) {
    const instPreset =
      activeInstrument === 'guitar'
        ? CAMERA_PRESETS.GUITAR_HERO_LOW_ANGLE
        : activeInstrument === 'bass'
          ? CAMERA_PRESETS.BASS_POCKET_DOLLY
          : activeInstrument === 'piano'
            ? CAMERA_PRESETS.PIANO_KEYS_CLOSEUP
            : CAMERA_PRESETS.DRUM_RISER_OVERHEAD;

    const isInstActive = (role) => !stemActivity || stemActivity[role] !== false;

    // 1. Section-driven broadcast choreography (highest priority after Fever!)
    if (sectionType === 'GUITAR_SOLO') {
      const soloShot = activeInstrument === 'piano' ? CAMERA_PRESETS.PIANO_KEYS_CLOSEUP : CAMERA_PRESETS.GUITAR_HERO_LOW_ANGLE;
      if (this.currentPreset === soloShot && this.presetAge > 6.5) {
        return CAMERA_PRESETS.CROWD_REVERSE_SILHOUETTE;
      }
      return soloShot;
    }

    if (fever || encore || sectionType === 'OUTRO') {
      const feverCycle = [
        CAMERA_PRESETS.FEVER_CRANE_ORBIT,
        CAMERA_PRESETS.CROWD_REVERSE_SILHOUETTE,
        instPreset,
        CAMERA_PRESETS.FEVER_CRANE_ORBIT,
      ];
      return feverCycle[this.cutCount % feverCycle.length];
    }

    if (sectionType === 'INTRO') {
      const introPool = [CAMERA_PRESETS.WIDE_ARENA_SWEEP];
      if (isInstActive('piano') || activeInstrument === 'piano') introPool.push(CAMERA_PRESETS.PIANO_KEYS_CLOSEUP);
      if (isInstActive('guitar')) introPool.push(CAMERA_PRESETS.GUITAR_HERO_LOW_ANGLE);
      if (isInstActive('bass')) introPool.push(CAMERA_PRESETS.BASS_POCKET_DOLLY);
      if (isInstActive('drums')) introPool.push(CAMERA_PRESETS.DRUM_RISER_OVERHEAD);
      const introCands = introPool.filter((p) => p !== this.currentPreset);
      return introCands.length > 0 ? introCands[this.cutCount % introCands.length] : CAMERA_PRESETS.WIDE_ARENA_SWEEP;
    }

    if (sectionType === 'BRIDGE') {
      const bridgeCycle = [
        CAMERA_PRESETS.PIANO_KEYS_CLOSEUP,
        CAMERA_PRESETS.GUITAR_HERO_LOW_ANGLE,
        CAMERA_PRESETS.BASS_POCKET_DOLLY,
        CAMERA_PRESETS.WIDE_ARENA_SWEEP,
      ];
      const bridgeCands = bridgeCycle.filter((p) => p !== this.currentPreset);
      return bridgeCands[this.cutCount % bridgeCands.length];
    }

    if (sectionType === 'CHORUS') {
      const chorusCycle = [
        CAMERA_PRESETS.FEVER_CRANE_ORBIT,
        CAMERA_PRESETS.CROWD_REVERSE_SILHOUETTE,
        CAMERA_PRESETS.WIDE_ARENA_SWEEP,
        instPreset,
      ];
      const chorusCands = chorusCycle.filter((p) => p !== this.currentPreset);
      return chorusCands[this.cutCount % chorusCands.length];
    }

    if (combo >= 25) {
      if (this.currentPreset !== instPreset && isInstActive(activeInstrument)) {
        return instPreset;
      }
      return this.cutCount % 2 === 0
        ? CAMERA_PRESETS.CROWD_REVERSE_SILHOUETTE
        : CAMERA_PRESETS.WIDE_ARENA_SWEEP;
    }

    const pool = [CAMERA_PRESETS.WIDE_ARENA_SWEEP];
    if (isInstActive('guitar')) pool.push(CAMERA_PRESETS.GUITAR_HERO_LOW_ANGLE);
    if (isInstActive('piano') || activeInstrument === 'piano') pool.push(CAMERA_PRESETS.PIANO_KEYS_CLOSEUP);
    if (isInstActive('drums')) pool.push(CAMERA_PRESETS.DRUM_RISER_OVERHEAD);
    if (isInstActive('bass')) pool.push(CAMERA_PRESETS.BASS_POCKET_DOLLY);
    if (overallEnergy > 0.38 || combo >= 12 || !hasVocalist) {
      pool.push(CAMERA_PRESETS.CROWD_REVERSE_SILHOUETTE);
    }

    const candidates = pool.filter((p) => p !== this.currentPreset);
    if (candidates.length === 0) return CAMERA_PRESETS.WIDE_ARENA_SWEEP;
    return candidates[this.cutCount % candidates.length];
  }

  resolvePresetFraming(
    preset,
    shotTime,
    { lineupPositions, livePositions, bassEnergy, overallEnergy, combo, beatPhase, sectionType }
  ) {
    // Track LIVE animated world positions (walking, knee-drop solos, power-sliding, jumping!) when available!
    const gPos = livePositions?.guitar || lineupPositions?.guitar || { x: -3.55, y: 0, z: -1.1 };
    const bPos = livePositions?.bass || lineupPositions?.bass || { x: 3.55, y: 0, z: -1.1 };
    const dPos = livePositions?.drums || lineupPositions?.drums || { x: 0, y: 0.64, z: -3.56 };
    const pPos = livePositions?.piano || lineupPositions?.piano || { x: -2.45, y: 0, z: -2.65 };

    const drift = Math.sin(shotTime * 0.44) * 0.24 * this.shotSideSign;
    const dollyPush = Math.min(0.8, shotTime * 0.065);
    const bpmPulse = Math.sin(beatPhase) * (0.04 + bassEnergy * 0.08);
    const isGuitarSolo = sectionType === 'GUITAR_SOLO';

    switch (preset) {
      case CAMERA_PRESETS.GUITAR_HERO_LOW_ANGLE: {
        // Dynamically tracks the Lead Guitarist's LIVE roaming/knee-drop/jumping world X/Y/Z with Dutch tilt on solos!
        const soloIntensity = isGuitarSolo ? 1.25 : overallEnergy > 0.4 || combo >= 20 ? 1.0 : 0.48;
        const gY = (isGuitarSolo ? 1.48 : 1.68) + (gPos.y || 0) * 0.58;
        this._desiredTarget.set(gPos.x, gY, gPos.z);
        const angleBias = gPos.x < -0.6 ? -0.36 : gPos.x > 0.6 ? 0.36 : 0.24 * this.shotSideSign;
        return {
          azimuth: angleBias + drift * (isGuitarSolo ? 1.25 : 0.85),
          radius: (isGuitarSolo ? 4.45 : 5.05) - dollyPush * 0.75,
          height: (isGuitarSolo ? 1.56 : 1.92) + (gPos.y || 0) * 0.35 + Math.cos(shotTime * 0.5) * 0.16,
          fov: isGuitarSolo ? 39 : 42,
          roll: this.shotSideSign * 0.072 * soloIntensity,
        };
      }

      case CAMERA_PRESETS.BASS_POCKET_DOLLY: {
        // Smooth tracking dolly following the Bassist's LIVE stage movement & groove jumps!
        const bY = 1.62 + (bPos.y || 0) * 0.55;
        this._desiredTarget.set(bPos.x, bY, bPos.z);
        const bBias = bPos.x > 0.5 ? 0.38 : -0.24;
        return {
          azimuth: bBias + drift * 0.92,
          radius: 5.45 - dollyPush * 0.68,
          height: 2.34 + (bPos.y || 0) * 0.32 + Math.sin(shotTime * 0.44) * 0.18,
          fov: 43,
          roll: -0.028 * this.shotSideSign,
        };
      }

      case CAMERA_PRESETS.DRUM_RISER_OVERHEAD:
        this._desiredTarget.set(dPos.x, 2.08, dPos.z + 0.25);
        return {
          azimuth: this.shotSideSign * 0.54 + drift * 0.8,
          radius: 5.85 - dollyPush * 0.45,
          height: 4.25 + Math.cos(shotTime * 0.38) * 0.26,
          fov: 44,
          roll: 0.022 * this.shotSideSign,
        };

      case CAMERA_PRESETS.PIANO_KEYS_CLOSEUP: {
        const pY = 1.48 + (pPos.y || 0) * 0.45;
        this._desiredTarget.set(pPos.x, pY, pPos.z + 0.25);
        const pBias = pPos.x < 0 ? -0.44 : 0.44;
        return {
          azimuth: pBias + Math.sin(shotTime * 0.52) * 0.34,
          radius: 4.45 - dollyPush * 0.55,
          height: 2.48 + Math.cos(shotTime * 0.42) * 0.22,
          fov: 40,
          roll: -0.024 * this.shotSideSign,
        };
      }

      case CAMERA_PRESETS.CROWD_REVERSE_SILHOUETTE:
        this._desiredTarget.set(this.shotSideSign * 0.55, 1.52, 2.6);
        return {
          azimuth: this.shotSideSign * (2.68 + Math.sin(shotTime * 0.36) * 0.24),
          radius: 5.25 + Math.cos(shotTime * 0.3) * 0.35,
          height: 4.18 + Math.sin(shotTime * 0.42) * 0.28,
          fov: 50,
          roll: 0,
        };

      case CAMERA_PRESETS.FEVER_CRANE_ORBIT:
        this._desiredTarget.set(0, 2.15, -1.45);
        return {
          azimuth: Math.sin(shotTime * 0.62) * 1.12 * this.shotSideSign,
          radius: 9.85 + Math.cos(shotTime * 0.46) * 1.5,
          height: 5.6 + Math.sin(shotTime * 0.52) * 1.25 + bpmPulse,
          fov: 49,
          roll: Math.sin(shotTime * 0.62) * 0.054,
        };

      case CAMERA_PRESETS.WIDE_ARENA_SWEEP:
      default:
        this._desiredTarget.set(0, 1.84, -1.32);
        return {
          azimuth: this.shotSideSign * 0.28 + Math.sin(shotTime * 0.32) * 0.46,
          radius: 11.1 + Math.cos(shotTime * 0.26) * 0.78,
          height: 3.88 + Math.sin(shotTime * 0.34) * 0.38 + bpmPulse,
          fov: 46,
          roll: 0,
        };
    }
  }

  /**
   * Computes live 3D Backstage preview framing depending on the active console tab & gear slot!
   */
  resolveBackstageFraming(clock, lineupPositions) {
    const gPos = lineupPositions?.guitar || { x: -3.55, y: 0, z: -1.1 };
    const bPos = lineupPositions?.bass || { x: 3.55, y: 0, z: -1.1 };
    const dPos = lineupPositions?.drums || { x: 0, y: 0.64, z: -3.56 };
    const pPos = lineupPositions?.piano || { x: -2.45, y: 0, z: -2.65 };
    const vPos = lineupPositions?.vocalist?.visible
      ? lineupPositions.vocalist
      : gPos;

    switch (this.backstageFocus) {
      case 'stars':
        this._desiredTarget.set(vPos.x, 1.72, vPos.z);
        return {
          azimuth: Math.sin(clock * 0.42) * 0.34,
          radius: 3.95,
          height: 2.15,
          fov: 38,
          roll: 0,
        };

      case 'piano':
        this._desiredTarget.set(pPos.x, 1.5, pPos.z + 0.15);
        return {
          azimuth: (pPos.x < 0 ? -0.45 : 0.45) + Math.sin(clock * 0.42) * 0.22,
          radius: 4.35,
          height: 2.45,
          fov: 40,
          roll: 0,
        };

      case 'guitar':
        this._desiredTarget.set(gPos.x, 1.55, gPos.z);
        return {
          azimuth: (gPos.x < -1 ? -0.32 : 0.16) + Math.sin(clock * 0.45) * 0.18,
          radius: 4.5,
          height: 2.1,
          fov: 40,
          roll: 0.02,
        };

      case 'bass':
        this._desiredTarget.set(bPos.x, 1.55, bPos.z);
        return {
          azimuth: 0.32 + Math.sin(clock * 0.45) * 0.18,
          radius: 4.5,
          height: 2.15,
          fov: 40,
          roll: -0.02,
        };

      case 'drums':
        this._desiredTarget.set(dPos.x, 1.78, dPos.z + 0.15);
        return {
          azimuth: Math.sin(clock * 0.38) * 0.48,
          radius: 5.35,
          height: 3.15,
          fov: 42,
          roll: 0,
        };

      case 'band':
      case 'highway':
        this._desiredTarget.set(0, 1.68, -1.45);
        return {
          azimuth: Math.sin(clock * 0.28) * 0.36,
          radius: 8.65,
          height: 2.95 + Math.sin(clock * 0.22) * 0.18,
          fov: 45,
          roll: 0,
        };

      case 'venues':
        this._desiredTarget.set(0, 3.2, -3.5);
        return {
          azimuth: Math.sin(clock * 0.2) * 0.78,
          radius: 15.8 + Math.cos(clock * 0.16) * 1.2,
          height: 6.2 + Math.sin(clock * 0.18) * 0.6,
          fov: 52,
          roll: 0,
        };

      case 'setlist':
      default:
        this._desiredTarget.set(0, 1.85, -1.65);
        return {
          azimuth: Math.sin(clock * 0.2) * 0.5,
          radius: 11.4 + Math.cos(clock * 0.17) * 0.65,
          height: 3.9 + Math.sin(clock * 0.19) * 0.28,
          fov: 46,
          roll: 0,
        };
    }
  }

  update(camera, dt, opts = {}) {
    const clock = Number.isFinite(opts.clock) ? opts.clock : 0;
    const playing = Boolean(opts.playing);
    const songTime = opts.songTime ?? clock;
    const safeBpm = Math.max(70, Math.min(200, opts.bpm || 120));
    const combo = opts.combo || 0;
    const fever = Boolean(opts.fever ?? opts.feverActive);
    const encore = Boolean(opts.encore ?? opts.isEncore);
    const encoreFinaleActive = Boolean(opts.encoreFinaleActive);
    const stemDropped = Boolean(opts.stemDropped);
    const activeInstrument = opts.activeInstrument || 'guitar';
    const overallEnergy = opts.overallEnergy || 0;
    const bassEnergy = opts.bassEnergy || 0;
    const stemActivity = opts.stemActivity;
    const lineupPositions = opts.lineupPositions;
    const livePositions = opts.livePositions;
    const hasVocalist = Boolean(opts.hasVocalist);
    const currentSection = opts.currentSection || null;
    const beatGrid = opts.beatGrid || null;
    const sectionType = currentSection?.type || null;
    const sectionId = currentSection?.id || null;

    const beatSec = 60 / safeBpm;
    const barNumber = this.resolveDynamicBarNumber(songTime, beatGrid, beatSec);
    const beatPhase = (songTime > 0 ? songTime : clock) * (safeBpm / 60) * Math.PI;

    this.presetAge += dt;
    this.kickShake = Math.max(0, this.kickShake - dt * 5.0);
    this.kickShakePhase += dt * 50;

    let targetAz = 0;
    let targetRad = 11.4;
    let targetHeight = 3.9;
    let targetFov = 46;
    let targetRoll = 0;
    this._desiredTarget.set(0, 1.85, -1.6);

    if (!playing && !encoreFinaleActive) {
      // Live 3D Backstage interactive preview framing!
      const bf = this.resolveBackstageFraming(clock, lineupPositions);
      targetAz = bf.azimuth;
      targetRad = bf.radius;
      targetHeight = bf.height;
      targetFov = bf.fov;
      targetRoll = bf.roll;
      this.transitionProgress = 1;
      this.prevSectionId = null;
    } else if (this.mode === 'locked') {
      targetAz = 0;
      targetRad = 11.4;
      targetHeight = 3.9;
      targetFov = 46;
      this.transitionProgress = 1;
    } else if (this.mode === 'subtle') {
      targetAz = Math.sin(clock * 0.24) * 0.4;
      targetRad = 11.3 + Math.cos(clock * 0.18) * 0.65;
      targetHeight = 3.88 + Math.sin(clock * 0.26) * 0.3;
      this._desiredTarget.set(0, 1.85, -1.4);
      this.transitionProgress = 1;
    } else if (encoreFinaleActive) {
      targetAz = Math.sin(clock * 0.36) * 1.1;
      targetRad = 12.1 + Math.cos(clock * 0.28) * 1.1;
      targetHeight = 3.7 + Math.sin(clock * 0.32) * 0.7;
      targetFov = 48;
      this._desiredTarget.set(0, 2.85, -2.0);
      this.transitionProgress = 1;
    } else if (playing && songTime < -1.85) {
      const wp = Math.max(0, Math.min(1, (songTime + 4.5) / 2.65));
      const eased = 1 - Math.pow(1 - wp, 2.2);
      targetAz = -0.82 + eased * 1.02;
      targetRad = 13.4 - eased * 2.0;
      targetHeight = 4.6 - eased * 0.72;
      this._desiredTarget.set(0, 1.75, -1.65);
      this.transitionProgress = 1;
    } else if (playing && stemDropped) {
      targetAz = Math.sin(clock * 0.4) * 0.22;
      targetRad = 12.8;
      targetHeight = 4.55;
      this._desiredTarget.set(0, 1.72, -1.5);
    } else {
      const feverJustTriggered = fever && !this.prevFever;
      const encoreJustTriggered = encore && !this.prevEncore;
      const sectionJustChanged = Boolean(sectionId && sectionId !== this.prevSectionId && songTime >= 0);
      const cutIntervalBars =
        sectionType === 'CHORUS' || sectionType === 'OUTRO' || fever || encore || overallEnergy > 0.45 || combo >= 25
          ? 8
          : sectionType === 'GUITAR_SOLO'
            ? 12
            : 16;

      let shouldCut = false;
      let isFastCut = false;

      if (feverJustTriggered || encoreJustTriggered || sectionJustChanged) {
        shouldCut = true;
        isFastCut = !sectionJustChanged || sectionType === 'CHORUS' || sectionType === 'GUITAR_SOLO';
      } else if (barNumber >= 0 && barNumber !== this.lastCutBar) {
        const isFirstDownbeat = this.lastCutBar < 0 && barNumber === 0;
        const barsSinceCut = barNumber - this.lastCutBar;
        const streakJumpCut =
          combo >= 25 &&
          barsSinceCut >= 4 &&
          this.currentPreset === CAMERA_PRESETS.WIDE_ARENA_SWEEP;

        if (isFirstDownbeat || barsSinceCut >= cutIntervalBars || streakJumpCut) {
          shouldCut = true;
          isFastCut = !isFirstDownbeat;
        }
      }

      if (shouldCut) {
        this.lastCutBar = Math.max(0, barNumber);
        this.cutCount += 1;
        this.shotSideSign = this.cutCount % 2 === 0 ? 1 : -1;
        const nextPreset = feverJustTriggered
          ? CAMERA_PRESETS.FEVER_CRANE_ORBIT
          : this.selectNextPreset({
              activeInstrument,
              combo,
              fever,
              encore,
              overallEnergy,
              stemActivity,
              hasVocalist,
              sectionType,
            });
        if (nextPreset !== this.currentPreset) {
          this.currentPreset = nextPreset;
          this.presetAge = 0;
          // Smooth cubic-damped broadcast transition (crisp 0.36s sweep for cuts, 0.72s crane glide for Fever/Solos)
          const dur =
            nextPreset === CAMERA_PRESETS.FEVER_CRANE_ORBIT
              ? 0.75
              : sectionType === 'GUITAR_SOLO'
                ? 0.48
                : isFastCut
                  ? 0.36
                  : 0.58;
          this.beginCubicTransition(dur);
        }
      }

      const framing = this.resolvePresetFraming(this.currentPreset, this.presetAge, {
        lineupPositions,
        livePositions,
        bassEnergy,
        overallEnergy,
        combo,
        beatPhase,
        sectionType,
      });
      targetAz = framing.azimuth;
      targetRad = framing.radius;
      targetHeight = framing.height;
      targetFov = framing.fov;
      targetRoll = framing.roll || 0;
      this.prevSectionId = sectionId;
    }

    this.prevFever = fever;
    this.prevEncore = encore;

    if (this.transitionProgress < 1) {
      // Smooth cubic Hermite interpolation (smoothstep) on shot transitions!
      this.transitionProgress = Math.min(1, this.transitionProgress + dt / this.transitionDuration);
      const u = this.transitionProgress;
      const ease = u * u * (3 - 2 * u);

      this.azimuth = THREE.MathUtils.lerp(this.fromAzimuth, targetAz, ease);
      this.radius = THREE.MathUtils.lerp(this.fromRadius, targetRad, ease);
      this.height = THREE.MathUtils.lerp(this.fromHeight, targetHeight, ease);
      this.fov = THREE.MathUtils.lerp(this.fromFov, targetFov, ease);
      this.roll = THREE.MathUtils.lerp(this.fromRoll, targetRoll, ease);
      this.target.lerpVectors(this._fromTarget, this._desiredTarget, ease);
    } else {
      const lambda = !playing
        ? 4.4
        : this.mode === 'locked'
          ? 5.0
          : this.currentPreset === CAMERA_PRESETS.FEVER_CRANE_ORBIT
            ? 2.6
            : 4.0;
      this.azimuth = THREE.MathUtils.damp(this.azimuth, targetAz, lambda, dt);
      this.radius = THREE.MathUtils.damp(this.radius, targetRad, lambda, dt);
      this.height = THREE.MathUtils.damp(this.height, targetHeight, lambda, dt);
      this.fov = THREE.MathUtils.damp(this.fov, targetFov, 4.0, dt);
      this.roll = THREE.MathUtils.damp(this.roll, targetRoll, 3.8, dt);

      // Faster target tracking so roaming/jumping guitarists & bassists stay dead-center in frame!
      this.target.x = THREE.MathUtils.damp(this.target.x, this._desiredTarget.x, lambda * 1.45, dt);
      this.target.y = THREE.MathUtils.damp(this.target.y, this._desiredTarget.y, lambda * 1.45, dt);
      this.target.z = THREE.MathUtils.damp(this.target.z, this._desiredTarget.z, lambda * 1.45, dt);
    }

    if (Math.abs(camera.fov - this.fov) > 0.05) {
      camera.fov = this.fov;
      camera.updateProjectionMatrix();
    }

    // Subtle kick-drum / crash impulse punch when live
    const shakeAmp = playing && this.mode !== 'locked' ? this.kickShake * 0.09 : 0;
    const shakeY = Math.sin(this.kickShakePhase) * shakeAmp;
    const shakeX = Math.cos(this.kickShakePhase * 0.7) * shakeAmp * 0.45;

    const camX = this.target.x + Math.sin(this.azimuth) * this.radius + shakeX;
    const camZ = this.target.z + Math.cos(this.azimuth) * this.radius;
    const safeZ = Math.max(-6.9, camZ);
    camera.position.set(camX, this.height + shakeY, safeZ);
    camera.lookAt(this.target);

    if (Math.abs(this.roll) > 0.001 || shakeAmp > 0.002) {
      camera.rotateZ(this.roll + shakeX * 0.14);
    }
  }
}

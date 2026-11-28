/**
 * cameraDirector.js
 * Weighted Anti-Repeat TV Concert Broadcast Camera Director:
 *  - Upper-2/3 Arena Composition: anchors camera targets at y ~ 2.0..2.7m above deck so
 *    performers, drum riser & Live IMAG Jumbotron stay unobstructed above the bottom-center highway.
 *  - Low-Angle Photo-Pit Perspective: front-of-stage heights (~1.15m..1.65m) look upward across the band.
 *  - 7 Core Broadcast Rigs + Dedicated Instrument Closeups:
 *      1. FRONT_ROW_LOW_HERO           (Front-Pit Steadicam: fov 46, z 11.5..13.5 curve, ±1.8° chorus roll)
 *      2. CATWALK_FRONT_WALKOUT        (Catwalk Hero Dolly: fov 38, heroic frontman/guitarist zoom)
 *      3. DRUM_KIT_ACTION_LOW          (3/4 Drum & Riser Crane: fov 42, arcing behind/beside kit toward crowd)
 *      4. REVERSE_SILHOUETTE_SPOTLIGHT (Reverse Artist's POV Stadium Shot: fov 58, 360° bowl + lightsticks)
 *      5. ARENA_WIDE_CRANE             (Technocrane / Spidercam Sweep: fov 50, overhead sweeps across stage + pit)
 *      6. CROWD_PIT_MOSH_CAM           (Pit Event Reaction Cam: fov 36, snappy zoom into crowd events)
 *      7. ENCORE_AERIAL_HELICOPTER     (Grand Encore Helicopter Drone: fov 54 -> 62 during Grand Encore fireworks)
 *      + JUMBOTRON_SHOUTOUT_SWEEP, ACTIVE_PLAYER_CLOSEUP, PIANO_HANDS_OVER_SHOULDER,
 *        DUAL_GUITAR_BACK_TO_BACK, STAGE_WING_DOLLY_TRACK, BAND_ORBIT_360
 *  - Cuts strictly on downbeat phrase boundaries (4 bars verses, 2 bars choruses/solos),
 *    maintains a 5-shot anti-repeat ring buffer, +1.8° snare transient FOV punch, and sub-bass kick shake.
 */

import * as THREE from 'three';

export const CAMERA_PRESETS = {
  ARENA_WIDE_CRANE: 'ARENA_WIDE_CRANE',
  FRONT_ROW_LOW_HERO: 'FRONT_ROW_LOW_HERO',
  ACTIVE_PLAYER_CLOSEUP: 'ACTIVE_PLAYER_CLOSEUP',
  PIANO_HANDS_OVER_SHOULDER: 'PIANO_HANDS_OVER_SHOULDER',
  DRUM_KIT_ACTION_LOW: 'DRUM_KIT_ACTION_LOW',
  DUAL_GUITAR_BACK_TO_BACK: 'DUAL_GUITAR_BACK_TO_BACK',
  STAGE_WING_DOLLY_TRACK: 'STAGE_WING_DOLLY_TRACK',
  CROWD_PIT_MOSH_CAM: 'CROWD_PIT_MOSH_CAM',
  CROWD_POV_FAN_CAM: 'CROWD_POV_FAN_CAM',
  CROWD_PIT_SURF: 'CROWD_PIT_SURF',
  ARENA_UPPER_BOWL_SWEEP: 'ARENA_UPPER_BOWL_SWEEP',
  STAGE_TO_CROWD_REVERSE: 'STAGE_TO_CROWD_REVERSE',
  REVERSE_SILHOUETTE_SPOTLIGHT: 'REVERSE_SILHOUETTE_SPOTLIGHT',
  JUMBOTRON_SHOUTOUT_SWEEP: 'JUMBOTRON_SHOUTOUT_SWEEP',
  BAND_ORBIT_360: 'BAND_ORBIT_360',
  CATWALK_FRONT_WALKOUT: 'CATWALK_FRONT_WALKOUT',
  ENCORE_AERIAL_HELICOPTER: 'ENCORE_AERIAL_HELICOPTER',
};

export const SHOT_CATEGORIES = {
  [CAMERA_PRESETS.ARENA_WIDE_CRANE]: 'WIDE',
  [CAMERA_PRESETS.ARENA_UPPER_BOWL_SWEEP]: 'WIDE',
  [CAMERA_PRESETS.JUMBOTRON_SHOUTOUT_SWEEP]: 'WIDE',
  [CAMERA_PRESETS.ENCORE_AERIAL_HELICOPTER]: 'WIDE',
  [CAMERA_PRESETS.ACTIVE_PLAYER_CLOSEUP]: 'CLOSEUP',
  [CAMERA_PRESETS.PIANO_HANDS_OVER_SHOULDER]: 'CLOSEUP',
  [CAMERA_PRESETS.DRUM_KIT_ACTION_LOW]: 'CLOSEUP',
  [CAMERA_PRESETS.DUAL_GUITAR_BACK_TO_BACK]: 'CLOSEUP',
  [CAMERA_PRESETS.CROWD_PIT_MOSH_CAM]: 'CROWD',
  [CAMERA_PRESETS.CROWD_POV_FAN_CAM]: 'CROWD',
  [CAMERA_PRESETS.CROWD_PIT_SURF]: 'CROWD',
  [CAMERA_PRESETS.STAGE_TO_CROWD_REVERSE]: 'CROWD',
  [CAMERA_PRESETS.REVERSE_SILHOUETTE_SPOTLIGHT]: 'CROWD',
  [CAMERA_PRESETS.FRONT_ROW_LOW_HERO]: 'DYNAMIC',
  [CAMERA_PRESETS.STAGE_WING_DOLLY_TRACK]: 'DYNAMIC',
  [CAMERA_PRESETS.BAND_ORBIT_360]: 'DYNAMIC',
  [CAMERA_PRESETS.CATWALK_FRONT_WALKOUT]: 'DYNAMIC',
};

export const CAMERA_SHOTS = Object.values(CAMERA_PRESETS);

const VALID_CAMERA_MODES = new Set([
  'on',
  'pit-steadicam',
  'crowd-pov',
  'pit-surf',
  'hero-closeup',
  'stadium-crane',
  'aerial-drone',
  'subtle',
  'locked',
]);

export class CameraDirector {
  constructor() {
    this.mode = 'on'; // 'on' | 'pit-steadicam' | 'crowd-pov' | 'pit-surf' | 'hero-closeup' | 'stadium-crane' | 'aerial-drone' | 'subtle' | 'locked'
    this.shots = CAMERA_SHOTS;
    this.currentPreset = CAMERA_PRESETS.FRONT_ROW_LOW_HERO;
    this.recentShots = [CAMERA_PRESETS.FRONT_ROW_LOW_HERO];
    this.lastCategory = SHOT_CATEGORIES[CAMERA_PRESETS.FRONT_ROW_LOW_HERO];
    this.backstageFocus = 'setlist';
    this.presetAge = 0;
    this.lastCutBar = -999;
    this.lastSnarePunchBar = -999;
    this.snareCooldown = 0;
    this.cutCount = 0;
    this.shotSideSign = 1;
    this.rngState = 918273645;

    // Kinetic spherical rig + Dutch tilt roll + kick FOV micro-punch + snare bursts + beat-locked sway (zero GC)
    this.azimuth = 0;
    this.radius = 12.6;
    this.height = 1.45;
    this.fov = 46;
    this.fovPunch = 0;
    this.kickFovPunch = 0;
    this.kickPunchCooldown = 0;
    this.roll = 0;
    this.kickShake = 0;
    this.kickShakePhase = 0;
    this.snareFillScore = 0;
    this.guitarSpikeScore = 0;
    this.spotlightOverrideRole = null;
    this.prevFever = false;
    this.prevEncore = false;
    this.prevSectionId = null;
    this.prevCrowdEventType = 'NORMAL';
    this.pendingCutUrgent = false;
    this.pendingCutPreset = null;

    // Elevated target.y so upper 2/3 of viewport holds performers + Jumbotron cleanly above highway
    this.target = new THREE.Vector3(0, 2.25, -1.6);
    this._desiredTarget = new THREE.Vector3(0, 2.25, -1.6);
  }

  setMode(mode) {
    if (VALID_CAMERA_MODES.has(mode)) {
      this.mode = mode;
    }
  }

  setBackstageFocus(focusKey) {
    this.backstageFocus = focusKey || 'setlist';
  }

  triggerKickImpulse(strength = 0.55) {
    this.kickShake = Math.min(1.0, Math.max(this.kickShake, strength));
  }

  nextRand() {
    this.rngState = (this.rngState * 1664525 + 1013904223) >>> 0;
    return this.rngState / 4294967296;
  }

  pushRecentShot(shot) {
    if (!shot) return;
    this.recentShots.push(shot);
    // Strict 6-shot non-repeating history buffer across hero close-ups, drummer, wide crane, B-stage pit, crowd & aerial drone
    while (this.recentShots.length > 6) {
      this.recentShots.shift();
    }
    this.lastCategory = SHOT_CATEGORIES[shot] || 'WIDE';
  }

  resetForSong() {
    this.currentPreset = CAMERA_PRESETS.FRONT_ROW_LOW_HERO;
    this.recentShots = [CAMERA_PRESETS.FRONT_ROW_LOW_HERO];
    this.lastCategory = SHOT_CATEGORIES[CAMERA_PRESETS.FRONT_ROW_LOW_HERO];
    this.presetAge = 0;
    this.lastCutBar = -999;
    this.lastSnarePunchBar = -999;
    this.snareCooldown = 0;
    this.kickPunchCooldown = 0;
    this.cutCount = 0;
    this.shotSideSign = 1;
    this.fovPunch = 0;
    this.kickFovPunch = 0;
    this.roll = 0;
    this.kickShake = 0;
    this.snareFillScore = 0;
    this.guitarSpikeScore = 0;
    this.spotlightOverrideRole = null;
    this.pendingCutUrgent = false;
    this.pendingCutPreset = null;
    this.prevFever = false;
    this.prevEncore = false;
    this.prevSectionId = null;
    this.prevCrowdEventType = 'NORMAL';
  }

  resolveDynamicBarNumber(songTime, currentTick, beatGrid, beatSec) {
    if (songTime < 0) return -1;
    if (Number.isFinite(currentTick) && currentTick >= 0) {
      return Math.floor(currentTick / 768);
    }
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

  /**
   * Weighted Anti-Repeat Shot Selector driven by song section, active instrument,
   * combo streak, Fever/Encore, and live crowd events.
   */
  selectNextPreset({
    activeInstrument,
    activeInstruments = null,
    combo,
    fever,
    encore,
    overallEnergy,
    stemActivity,
    hasVocalist,
    sectionType,
    crowdEventType,
    ambianceType,
    guitarRiffEnergy = 0,
    snareFillActive = false,
    fireworksGrandActive = false,
  }) {
    const isInstActive = (role) => !stemActivity || stemActivity[role] !== false;
    const isBallad = ambianceType === 'BALLAD_EMOTIONAL';
    const isTwoPlayer = Array.isArray(activeInstruments) && activeInstruments.length >= 2;
    const secondInst = isTwoPlayer ? activeInstruments[1] : null;

    // Stem-Driven Spotlight Framing Priority:
    // 1. Engrande Pyromusical Finale -> sweep out to Aerial Stadium Drone
    if (fireworksGrandActive && this.currentPreset !== CAMERA_PRESETS.ENCORE_AERIAL_HELICOPTER) {
      this.spotlightOverrideRole = null;
      return CAMERA_PRESETS.ENCORE_AERIAL_HELICOPTER;
    }

    // 2. Rapid drum fill (snareImpulse bursts) -> snap to Drummer 3/4 Overhead/Low Action Cam
    if (snareFillActive && isInstActive('drums') && this.currentPreset !== CAMERA_PRESETS.DRUM_KIT_ACTION_LOW) {
      this.spotlightOverrideRole = 'drums';
      return CAMERA_PRESETS.DRUM_KIT_ACTION_LOW;
    }

    // 3. Lead Guitar Solo / Riff Energy spike -> Hero Lead Guitarist Spotlight
    if (
      (sectionType === 'GUITAR_SOLO' || guitarRiffEnergy > 0.72) &&
      isInstActive('guitar') &&
      this.currentPreset !== CAMERA_PRESETS.ACTIVE_PLAYER_CLOSEUP
    ) {
      this.spotlightOverrideRole = 'guitar';
      return CAMERA_PRESETS.ACTIVE_PLAYER_CLOSEUP;
    }
    this.spotlightOverrideRole = null;

    // Immediate thematic crowd cut when a crowd event starts
    if (
      crowdEventType &&
      crowdEventType !== 'NORMAL' &&
      crowdEventType !== this.prevCrowdEventType
    ) {
      if (crowdEventType === 'CROWD_SURFING') return CAMERA_PRESETS.CROWD_PIT_SURF;
      if (crowdEventType === 'STADIUM_WAVE') return CAMERA_PRESETS.ARENA_UPPER_BOWL_SWEEP;
      if (crowdEventType === 'HEART_HANDS' || crowdEventType === 'CRYING_SWAY') {
        return CAMERA_PRESETS.CROWD_POV_FAN_CAM;
      }
      if (this.currentPreset !== CAMERA_PRESETS.CROWD_PIT_MOSH_CAM) {
        return CAMERA_PRESETS.CROWD_PIT_MOSH_CAM;
      }
    }

    const weights = new Map();
    const addW = (shot, w) => {
      if (w <= 0) return;
      weights.set(shot, (weights.get(shot) || 0) + w);
    };

    // Base contextual weights centered around broadcast + immersive Crowd-POV & Pit-Surf rigs
    addW(CAMERA_PRESETS.FRONT_ROW_LOW_HERO, sectionType === 'CHORUS' || combo >= 15 ? 3.0 : 2.2);
    addW(CAMERA_PRESETS.CATWALK_FRONT_WALKOUT, sectionType === 'CHORUS' || sectionType === 'GUITAR_SOLO' || combo >= 20 ? 3.0 : 1.6);
    addW(CAMERA_PRESETS.ARENA_WIDE_CRANE, isTwoPlayer ? 2.5 : sectionType === 'INTRO' ? 3.0 : 1.8);
    addW(
      CAMERA_PRESETS.ARENA_UPPER_BOWL_SWEEP,
      sectionType === 'CHORUS' || fever || encore || sectionType === 'INTRO' ? 2.2 : 1.15
    );
    addW(
      CAMERA_PRESETS.CROWD_POV_FAN_CAM,
      isBallad || sectionType === 'CHORUS' || sectionType === 'BRIDGE' || combo >= 20 ? 2.6 : 1.5
    );
    addW(
      CAMERA_PRESETS.CROWD_PIT_SURF,
      sectionType === 'CHORUS' || sectionType === 'GUITAR_SOLO' || overallEnergy > 0.42 ? 2.5 : 1.25
    );
    addW(
      CAMERA_PRESETS.STAGE_TO_CROWD_REVERSE,
      sectionType === 'CHORUS' || fever || encore || overallEnergy > 0.38 ? 2.3 : 1.1
    );
    addW(
      CAMERA_PRESETS.ACTIVE_PLAYER_CLOSEUP,
      isInstActive(activeInstrument) ? (combo >= 25 || guitarRiffEnergy > 0.5 ? 2.9 : 1.85) : 0.7
    );
    addW(CAMERA_PRESETS.STAGE_WING_DOLLY_TRACK, 1.35);
    addW(CAMERA_PRESETS.BAND_ORBIT_360, sectionType === 'BRIDGE' || sectionType === 'CHORUS' ? 1.75 : 1.05);
    addW(CAMERA_PRESETS.JUMBOTRON_SHOUTOUT_SWEEP, fever || sectionType === 'CHORUS' || combo >= 30 ? 1.85 : 0.95);
    addW(CAMERA_PRESETS.REVERSE_SILHOUETTE_SPOTLIGHT, overallEnergy > 0.34 || fever || sectionType === 'CHORUS' ? 2.1 : 1.0);

    if (isInstActive('piano') || activeInstrument === 'piano' || secondInst === 'piano' || isBallad) {
      addW(CAMERA_PRESETS.PIANO_HANDS_OVER_SHOULDER, activeInstrument === 'piano' || secondInst === 'piano' ? 2.8 : isBallad ? 2.3 : 1.05);
    }
    if (isInstActive('drums') || activeInstrument === 'drums' || secondInst === 'drums') {
      addW(CAMERA_PRESETS.DRUM_KIT_ACTION_LOW, activeInstrument === 'drums' || secondInst === 'drums' || snareFillActive ? 3.2 : 1.85);
    }
    if (isTwoPlayer || (isInstActive('guitar') && isInstActive('bass'))) {
      addW(
        CAMERA_PRESETS.DUAL_GUITAR_BACK_TO_BACK,
        isTwoPlayer ? 3.3 : sectionType === 'GUITAR_SOLO' || sectionType === 'CHORUS' ? 2.1 : 0.95
      );
    }
    if (crowdEventType && crowdEventType !== 'NORMAL') {
      addW(CAMERA_PRESETS.CROWD_PIT_MOSH_CAM, 2.9);
      addW(CAMERA_PRESETS.CROWD_PIT_SURF, 2.7);
      addW(CAMERA_PRESETS.CROWD_POV_FAN_CAM, 2.3);
    } else if (overallEnergy > 0.42 || combo >= 15 || !hasVocalist) {
      addW(CAMERA_PRESETS.CROWD_PIT_MOSH_CAM, 1.0);
    }
    if (fever || encore || sectionType === 'OUTRO' || fireworksGrandActive) {
      addW(CAMERA_PRESETS.ENCORE_AERIAL_HELICOPTER, encore || fireworksGrandActive ? 3.8 : 2.2);
    }

    // Strictly exclude the last 5 shots AND prefer switching camera category
    const recentSet = new Set(this.recentShots);
    const curCategory = SHOT_CATEGORIES[this.currentPreset] || this.lastCategory;
    let pool = [];
    weights.forEach((w, shot) => {
      if (!recentSet.has(shot) && SHOT_CATEGORIES[shot] !== curCategory) {
        pool.push({ shot, w });
      }
    });

    if (pool.length === 0) {
      weights.forEach((w, shot) => {
        if (!recentSet.has(shot)) {
          pool.push({ shot, w });
        }
      });
    }

    if (pool.length === 0) {
      CAMERA_SHOTS.forEach((shot) => {
        if (shot !== this.currentPreset) {
          pool.push({ shot, w: weights.get(shot) || 1.0 });
        }
      });
    }

    let totalW = 0;
    for (let i = 0; i < pool.length; i += 1) totalW += pool[i].w;
    let pick = this.nextRand() * totalW;
    for (let i = 0; i < pool.length; i += 1) {
      pick -= pool[i].w;
      if (pick <= 0) return pool[i].shot;
    }
    return pool[pool.length - 1]?.shot || CAMERA_PRESETS.FRONT_ROW_LOW_HERO;
  }

  resolvePresetFraming(
    preset,
    shotTime,
    {
      activeInstrument,
      activeInstruments = null,
      lineupPositions,
      livePositions,
      bassEnergy,
      sectionType,
      crowdEventCenter,
      crowdEventType,
      ambianceType,
      fever,
      encore,
    }
  ) {
    const gPos = livePositions?.guitar || lineupPositions?.guitar || { x: -4.5, y: 0, z: 1.0 };
    const bPos = livePositions?.bass || lineupPositions?.bass || { x: 4.5, y: 0, z: 1.0 };
    const dPos = livePositions?.drums || lineupPositions?.drums || { x: 0, y: 0.65, z: -2.8 };
    const pPos = livePositions?.piano || lineupPositions?.piano || { x: 6.5, y: 0.45, z: -1.8 };
    const vPos = livePositions?.vocals || lineupPositions?.vocalist || { x: 0, y: 0, z: 2.0 };
    const getPosForRole = (role) =>
      role === 'bass' ? bPos : role === 'drums' ? dPos : role === 'piano' ? pPos : role === 'vocals' ? vPos : gPos;
    const isTwoPlayer = Array.isArray(activeInstruments) && activeInstruments.length >= 2;
    const focusInstrument = this.spotlightOverrideRole
      ? this.spotlightOverrideRole
      : isTwoPlayer
        ? activeInstruments[this.cutCount % activeInstruments.length]
        : activeInstrument;

    const drift = Math.sin(shotTime * 0.44) * 0.24 * this.shotSideSign;
    const dollyPush = Math.min(0.85, shotTime * 0.068);
    const bpmPulse = Math.sin(shotTime * 3.1) * (0.04 + bassEnergy * 0.08);
    const isGuitarSolo = sectionType === 'GUITAR_SOLO';
    const isHighEnergyChorus =
      (sectionType === 'CHORUS' || isGuitarSolo || fever || encore) &&
      ambianceType !== 'BALLAD_EMOTIONAL';

    switch (preset) {
      // 1. B-Stage Pit Steadicam: curved track sweeping safely around the circular B-Stage barricade (z ~ 15.2..17.6m)
      case CAMERA_PRESETS.FRONT_ROW_LOW_HERO: {
        const focusX = (gPos.x * 0.35 + vPos.x * 0.65);
        const focusZ = Math.max(-0.5, Math.min(8.5, vPos.z * 0.55));
        this._desiredTarget.set(focusX * 0.75, 2.35 + (vPos.y || 0) * 0.35, focusZ);
        const sweepRad = Math.sin(shotTime * 0.38) * 0.42 + this.shotSideSign * 0.24;
        const pitRadius = Math.max(15.6 - focusZ * 0.65, 9.2) + Math.sin(shotTime * 0.42) * 1.1;
        return {
          azimuth: sweepRad,
          radius: pitRadius,
          height: 1.55 + Math.cos(shotTime * 0.5) * 0.18,
          fov: 48,
          roll: isHighEnergyChorus ? this.shotSideSign * 0.0314 : 0, // ±1.8 deg = 0.0314 rad
        };
      }

      // 2. Catwalk & B-Stage Hero Dolly: heroic low-angle close-up (fov 38) tracking frontperson/guitarist all the way to circular B-Stage (z <= 13.4)
      case CAMERA_PRESETS.CATWALK_FRONT_WALKOUT: {
        const leadZ = Math.max(vPos.z, gPos.z, bPos.z);
        const focusMember = leadZ === vPos.z ? vPos : leadZ === gPos.z ? gPos : bPos;
        const clampedZ = Math.max(2.6, Math.min(13.4, focusMember.z));
        const onBStage = clampedZ > 9.4;
        this._desiredTarget.set(focusMember.x * 0.85, 2.15 + (focusMember.y || 0) * 0.4, clampedZ);
        return {
          azimuth: this.shotSideSign * (onBStage ? 0.52 : 0.38) + Math.sin(shotTime * 0.44) * 0.28,
          radius: (onBStage ? 6.4 : 5.6) - dollyPush * 0.7,
          height: (onBStage ? 1.48 : 1.32) + Math.cos(shotTime * 0.42) * 0.15 + bpmPulse * 0.45,
          fov: onBStage ? 40 : 38,
          roll: isHighEnergyChorus ? this.shotSideSign * 0.0314 : 0,
        };
      }

      // 3. 3/4 Drum & Riser Crane: sweeping behind/beside elevated 2-tier drum riser looking out toward crowd (fov 42)
      case CAMERA_PRESETS.DRUM_KIT_ACTION_LOW:
        this._desiredTarget.set(dPos.x, 2.38, dPos.z + 0.65);
        return {
          azimuth: this.shotSideSign * (1.82 + Math.sin(shotTime * 0.52) * 0.34),
          radius: 4.65 - dollyPush * 0.38,
          height: 2.65 + Math.sin(shotTime * 0.55) * 0.22 + bpmPulse * 0.5,
          fov: 42,
          roll: -0.026 * this.shotSideSign,
        };

      // 4. Reverse "Artist's POV" Stadium Shot: behind band looking over drum riser & B-Stage into 360° lightstick bowl (fov 58)
      case CAMERA_PRESETS.REVERSE_SILHOUETTE_SPOTLIGHT:
        this._desiredTarget.set(this.shotSideSign * 0.45, 2.35, 13.5);
        return {
          azimuth: Math.PI + this.shotSideSign * (0.22 + Math.sin(shotTime * 0.3) * 0.22),
          radius: 19.6 + Math.cos(shotTime * 0.28) * 0.6,
          height: 3.35 + Math.sin(shotTime * 0.4) * 0.25,
          fov: 58,
          roll: 0,
        };

      // 5. Technocrane / Spidercam 3/4 Sweep: wide arc showcasing full 38m stage, 15.5m truss roof, ±17.8m line arrays & 24m LED wall
      case CAMERA_PRESETS.ARENA_WIDE_CRANE:
        this._desiredTarget.set(0, 3.85, -1.2);
        return {
          azimuth: this.shotSideSign * 0.36 + Math.sin(shotTime * 0.36) * 0.56,
          radius: 21.8 + Math.cos(shotTime * 0.28) * 1.4,
          height: 8.2 + Math.sin(shotTime * 0.34) * 1.05 + bpmPulse * 0.7,
          fov: 54,
          roll: Math.sin(shotTime * 0.36) * 0.018,
        };

      // 6. Pit Event Reaction Cam: snaps into mosh pit / heart hands / wave center clear of B-Stage octagon (fov 38)
      case CAMERA_PRESETS.CROWD_PIT_MOSH_CAM: {
        const isWideCrowd =
          crowdEventType === 'STADIUM_WAVE' ||
          crowdEventType === 'HEART_HANDS' ||
          crowdEventType === 'CRYING_SWAY' ||
          crowdEventType === 'WALL_OF_DEATH';
        const pitX = crowdEventType && crowdEventType !== 'NORMAL' && crowdEventCenter ? crowdEventCenter.x : 0;
        const pitZ = crowdEventType && crowdEventType !== 'NORMAL' && crowdEventCenter ? crowdEventCenter.z : 18.2;
        this._desiredTarget.set(isWideCrowd ? 0 : pitX, isWideCrowd ? 2.4 : 1.85, isWideCrowd ? 17.8 : Math.max(15.8, pitZ - 0.5));
        return {
          azimuth: this.shotSideSign * (isWideCrowd ? 0.42 : 0.52) + Math.sin(shotTime * 0.48) * 0.36,
          radius: (isWideCrowd ? 11.4 : 7.8) + Math.cos(shotTime * 0.42) * 0.45,
          height: (isWideCrowd ? 4.8 : 2.85) + Math.sin(shotTime * 0.56) * 0.22 + bpmPulse * 0.7,
          fov: 38,
          roll: this.shotSideSign * (isWideCrowd ? 0.018 : 0.028),
        };
      }

      // 6B. B-Stage Pit Fan-Cam: eye-level inside GA pit behind B-Stage barricade looking up at frontman, truss roof & 24m backwall
      case CAMERA_PRESETS.CROWD_POV_FAN_CAM: {
        const fanBounce = Math.abs(Math.sin(shotTime * 3.4)) * (0.14 + bassEnergy * 0.16);
        const focusX = (vPos.x * 0.5 + gPos.x * 0.25 + bPos.x * 0.25) * 0.55;
        this._desiredTarget.set(focusX, 3.85, -1.6);
        const pitAngle = this.shotSideSign * 0.3 + Math.sin(shotTime * 0.34) * 0.28;
        return {
          azimuth: pitAngle,
          radius: 21.8 + Math.cos(shotTime * 0.29) * 1.25,
          height: 1.82 + fanBounce + Math.sin(shotTime * 0.75) * 0.09,
          fov: 52,
          roll: Math.sin(shotTime * 0.9) * 0.016,
        };
      }

      // 6C. Crowd Pit-Surf & B-Stage Barricade Glider: energetic lateral surf wrapping outside the octagonal B-Stage perimeter
      case CAMERA_PRESETS.CROWD_PIT_SURF: {
        const surfArc = Math.sin(shotTime * 0.58) * 0.62 + this.shotSideSign * 0.18;
        const surfBounce = Math.sin(shotTime * 4.2) * (0.12 + bassEnergy * 0.18);
        const catwalkZ = Math.max(2.0, Math.min(11.4, vPos.z * 0.55 + 3.2));
        this._desiredTarget.set(Math.sin(shotTime * 0.5) * 1.6, 2.75, catwalkZ);
        return {
          azimuth: surfArc,
          radius: Math.max(11.6, 17.2 - catwalkZ * 0.45) + Math.cos(shotTime * 0.52) * 1.2,
          height: 2.35 + surfBounce + Math.cos(shotTime * 0.65) * 0.18,
          fov: 48,
          roll: Math.cos(shotTime * 0.58) * 0.032,
        };
      }

      // 6D. Arena Upper-Bowl Concertgoer Sweep: sweeping mid/upper-tier vista framing the full 38m stadium stage, B-stage & 360° lightstick bowl
      case CAMERA_PRESETS.ARENA_UPPER_BOWL_SWEEP: {
        this._desiredTarget.set(0, 4.2, -0.8);
        return {
          azimuth: this.shotSideSign * 0.52 + Math.sin(shotTime * 0.24) * 0.64,
          radius: 30.2 + Math.cos(shotTime * 0.2) * 2.0,
          height: 13.8 + Math.sin(shotTime * 0.26) * 1.5,
          fov: 54,
          roll: Math.sin(shotTime * 0.24) * 0.014,
        };
      }

      // 6E. Stage-to-Crowd Reverse Dolly: behind the band looking out across the glowing LED floor & B-Stage into the packed pit
      case CAMERA_PRESETS.STAGE_TO_CROWD_REVERSE: {
        this._desiredTarget.set(this.shotSideSign * 0.75, 2.5, 16.8);
        return {
          azimuth: Math.PI + this.shotSideSign * (0.18 + Math.sin(shotTime * 0.34) * 0.26),
          radius: 23.0 + Math.cos(shotTime * 0.3) * 0.8,
          height: 3.15 + Math.sin(shotTime * 0.44) * 0.24 + bpmPulse * 0.45,
          fov: 56,
          roll: Math.sin(shotTime * 0.34) * 0.015,
        };
      }

      // 7. Grand Encore Aerial Firework Sweep: elevated wide stadium vista framing Tier 1-4 fireworks (up to 75m Kamuro canopy)
      case CAMERA_PRESETS.ENCORE_AERIAL_HELICOPTER:
        this._desiredTarget.set(0, 14.5, -10.5);
        return {
          azimuth: Math.sin(shotTime * 0.2) * 0.72,
          radius: 52.0 + Math.cos(shotTime * 0.16) * 2.8,
          height: 26.5 + Math.sin(shotTime * 0.18) * 2.2,
          fov: 58,
          roll: Math.sin(shotTime * 0.2) * 0.02,
        };

      case CAMERA_PRESETS.ACTIVE_PLAYER_CLOSEUP: {
        const targetPos = getPosForRole(focusInstrument);
        const tY = (focusInstrument === 'drums' ? 2.2 : 2.05) + (targetPos.y || 0) * 0.45;
        this._desiredTarget.set(targetPos.x, tY, targetPos.z);
        const angleBias = targetPos.x < -0.5 ? -0.42 : targetPos.x > 0.5 ? 0.42 : 0.28 * this.shotSideSign;
        return {
          azimuth: angleBias + drift * 0.9,
          radius: (focusInstrument === 'drums' ? 4.5 : 4.35) - dollyPush * 0.5,
          height: (focusInstrument === 'drums' ? 2.55 : 1.48) + (targetPos.y || 0) * 0.3 + Math.cos(shotTime * 0.48) * 0.14,
          fov: isGuitarSolo ? 38 : 40,
          roll: isHighEnergyChorus ? this.shotSideSign * 0.0314 : 0.016 * this.shotSideSign,
        };
      }

      case CAMERA_PRESETS.PIANO_HANDS_OVER_SHOULDER: {
        const pY = 1.95 + (pPos.y || 0) * 0.4;
        this._desiredTarget.set(pPos.x + 0.15, pY, pPos.z + 0.45);
        return {
          azimuth: (pPos.x < 0 ? -1.14 : 1.14) + Math.sin(shotTime * 0.42) * 0.26,
          radius: 3.75 - dollyPush * 0.4,
          height: 2.38 + Math.cos(shotTime * 0.48) * 0.14,
          fov: 40,
          roll: 0.022 * (pPos.x < 0 ? 1 : -1),
        };
      }

      case CAMERA_PRESETS.DUAL_GUITAR_BACK_TO_BACK: {
        const posA = isTwoPlayer ? getPosForRole(activeInstruments[0]) : gPos;
        const posB = isTwoPlayer ? getPosForRole(activeInstruments[1]) : bPos;
        const midX = (posA.x + posB.x) * 0.5;
        const midY = 2.1 + Math.max(posA.y || 0, posB.y || 0) * 0.35;
        const midZ = (posA.z + posB.z) * 0.5;
        const pairSpan = Math.hypot(posA.x - posB.x, posA.z - posB.z);
        this._desiredTarget.set(midX, midY, midZ);
        return {
          azimuth: this.shotSideSign * 0.52 + Math.sin(shotTime * 0.55) * 0.38,
          radius: Math.max(6.2, Math.min(11.5, 5.4 + pairSpan * 0.45)) - dollyPush * 0.65,
          height: 1.75 + Math.cos(shotTime * 0.42) * 0.2,
          fov: isTwoPlayer ? 48 : 44,
          roll: isHighEnergyChorus ? this.shotSideSign * 0.0314 : 0.018 * this.shotSideSign,
        };
      }

      case CAMERA_PRESETS.STAGE_WING_DOLLY_TRACK:
        this._desiredTarget.set(this.shotSideSign * -0.4, 2.55, -1.1);
        return {
          azimuth: this.shotSideSign * (1.22 + Math.sin(shotTime * 0.34) * 0.24),
          radius: 10.6 - dollyPush * 1.0,
          height: 2.05 + Math.cos(shotTime * 0.4) * 0.24,
          fov: 45,
          roll: -0.02 * this.shotSideSign,
        };

      case CAMERA_PRESETS.JUMBOTRON_SHOUTOUT_SWEEP:
        this._desiredTarget.set(0, 6.2, -5.8);
        return {
          azimuth: Math.sin(shotTime * 0.32) * 0.34,
          radius: 22.8 - dollyPush * 1.2,
          height: 4.5 + Math.cos(shotTime * 0.26) * 0.45,
          fov: 54,
          roll: 0,
        };

      case CAMERA_PRESETS.BAND_ORBIT_360:
      default:
        this._desiredTarget.set(0, 2.55, -1.0);
        return {
          azimuth: Math.sin(shotTime * 0.52) * 1.12 * this.shotSideSign,
          radius: 13.6 + Math.cos(shotTime * 0.4) * 1.0,
          height: 3.35 + Math.sin(shotTime * 0.36) * 0.48 + bpmPulse * 0.5,
          fov: 49,
          roll: Math.sin(shotTime * 0.52) * 0.026,
        };
    }
  }

  resolveBackstageFraming(clock, lineupPositions) {
    const gPos = lineupPositions?.guitar || { x: -4.5, y: 0, z: 1.0 };
    const bPos = lineupPositions?.bass || { x: 4.5, y: 0, z: 1.0 };
    const dPos = lineupPositions?.drums || { x: 0, y: 0.65, z: -2.8 };
    const pPos = lineupPositions?.piano || { x: 6.5, y: 0.45, z: -1.8 };
    const vPos = lineupPositions?.vocalist?.visible ? lineupPositions.vocalist : gPos;

    switch (this.backstageFocus) {
      case 'stars':
        this._desiredTarget.set(vPos.x, 1.9, vPos.z);
        return { azimuth: Math.sin(clock * 0.42) * 0.34, radius: 4.2, height: 1.85, fov: 38, roll: 0 };
      case 'piano':
        this._desiredTarget.set(pPos.x, 1.9, pPos.z + 0.15);
        return { azimuth: (pPos.x < 0 ? -0.45 : 0.45) + Math.sin(clock * 0.42) * 0.22, radius: 4.75, height: 2.55, fov: 40, roll: 0 };
      case 'guitar':
        this._desiredTarget.set(gPos.x, 1.75, gPos.z);
        return { azimuth: (gPos.x < -1 ? -0.32 : 0.16) + Math.sin(clock * 0.45) * 0.18, radius: 4.6, height: 1.95, fov: 40, roll: 0.02 };
      case 'bass':
        this._desiredTarget.set(bPos.x, 1.75, bPos.z);
        return { azimuth: 0.32 + Math.sin(clock * 0.45) * 0.18, radius: 4.6, height: 1.95, fov: 40, roll: -0.02 };
      case 'drums':
        this._desiredTarget.set(dPos.x, 2.05, dPos.z + 0.15);
        return { azimuth: Math.sin(clock * 0.38) * 0.48, radius: 5.5, height: 3.0, fov: 42, roll: 0 };
      case 'band':
      case 'highway':
        this._desiredTarget.set(0, 2.6, -1.2);
        return { azimuth: Math.sin(clock * 0.28) * 0.36, radius: 16.4, height: 3.85 + Math.sin(clock * 0.22) * 0.25, fov: 48, roll: 0 };
      case 'venues':
        this._desiredTarget.set(0, 5.2, -3.2);
        return { azimuth: Math.sin(clock * 0.2) * 0.78, radius: 26.0 + Math.cos(clock * 0.16) * 1.6, height: 9.4 + Math.sin(clock * 0.18) * 0.8, fov: 54, roll: 0 };
      case 'setlist':
      default:
        this._desiredTarget.set(0, 2.9, -1.2);
        return { azimuth: Math.sin(clock * 0.2) * 0.44, radius: 18.2 + Math.cos(clock * 0.17) * 0.8, height: 3.4 + Math.sin(clock * 0.19) * 0.28, fov: 49, roll: 0 };
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
    const isEncoreActive = Boolean(opts.isEncoreActive || encoreFinaleActive);
    const stemDropped = Boolean(opts.stemDropped);
    const activeInstrument = opts.activeInstrument || 'guitar';
    const activeInstruments = Array.isArray(opts.activeInstruments) && opts.activeInstruments.length
      ? opts.activeInstruments
      : [activeInstrument];
    const overallEnergy = opts.overallEnergy || 0;
    const bassEnergy = opts.bassEnergy || 0;
    const drumEnergy = opts.drumEnergy || 0;
    const kickTransient = Math.max(Number(opts.kickImpulse || 0), Number(opts.kickTransient || 0));
    const snareTransient = Math.max(Number(opts.snareImpulse || 0), Number(opts.snareTransient || 0));
    const guitarRiffEnergy = Number(opts.guitarRiffEnergy || 0);
    const beatPhase = Number.isFinite(opts.beatPhase) ? opts.beatPhase : (((songTime * (safeBpm / 60)) % 1) + 1) % 1;
    const beatIndex = Number.isFinite(opts.beatIndex) ? opts.beatIndex : Math.floor(songTime * (safeBpm / 60));
    const isDownbeat = Boolean(opts.isDownbeat ?? ((((beatIndex % 4) + 4) % 4) === 0 && beatPhase < 0.22));
    const isPhraseBoundary = Boolean(opts.isPhraseBoundary ?? false);
    const fireworksGrandActive = Boolean(opts.fireworksGrandActive || isEncoreActive);
    const stemActivity = opts.stemActivity;
    const lineupPositions = opts.lineupPositions;
    const livePositions = opts.livePositions;
    const hasVocalist = Boolean(opts.hasVocalist);
    const currentSection = opts.currentSection || null;
    const beatGrid = opts.beatGrid || null;
    const currentTick = opts.currentTick;
    const crowdEventType = opts.crowdEventType || 'NORMAL';
    const crowdEventCenter = opts.crowdEventCenter || null;
    const ambianceType = opts.trackMeta?.ambianceType || 'ROCK_ANTHEM';
    const sectionType = currentSection?.type || null;
    const sectionId = currentSection?.id || null;

    const beatSec = 60 / safeBpm;
    const barNumber = this.resolveDynamicBarNumber(songTime, currentTick, beatGrid, beatSec);
    this.presetAge += dt;
    this.snareCooldown = Math.max(0, this.snareCooldown - dt);
    this.kickPunchCooldown = Math.max(0, this.kickPunchCooldown - dt);

    // Track stem-driven spotlight triggers (rapid drum fills & guitar riff spikes)
    if (snareTransient > 0.56) {
      this.snareFillScore = Math.min(1.5, this.snareFillScore + dt * 3.8);
    } else {
      this.snareFillScore = Math.max(0, this.snareFillScore - dt * 1.6);
    }
    if (guitarRiffEnergy > 0.66) {
      this.guitarSpikeScore = Math.min(1.5, this.guitarSpikeScore + dt * 2.6);
    } else {
      this.guitarSpikeScore = Math.max(0, this.guitarSpikeScore - dt * 1.3);
    }
    const snareFillActive = this.snareFillScore > 0.55;
    const guitarSpikeActive = this.guitarSpikeScore > 0.65 || sectionType === 'GUITAR_SOLO';

    const isHighEnergy = sectionType === 'CHORUS' || sectionType === 'GUITAR_SOLO' || fever || encore || overallEnergy > 0.36;

    // Kick-Drum Micro-Punch: subtle -1.2° FOV punch on kickImpulse during high-energy choruses/drops + sub-bass shake
    if (playing && this.mode !== 'locked' && kickTransient > 0.42) {
      this.triggerKickImpulse(Math.min(0.95, kickTransient));
      if (isHighEnergy && this.kickPunchCooldown <= 0) {
        this.kickFovPunch = -1.2 * Math.min(1.0, (kickTransient - 0.3) / 0.55);
        this.kickPunchCooldown = Math.max(0.18, beatSec * 0.48);
      }
    }
    this.kickFovPunch = THREE.MathUtils.damp(this.kickFovPunch, 0, 11.5, dt);
    this.kickShake = Math.max(0, this.kickShake - dt * 5.2);
    this.kickShakePhase += dt * 52;

    // Snare accent micro-breath (subtle +0.9° when not fighting a kick punch)
    if (
      playing &&
      this.mode !== 'locked' &&
      this.snareCooldown <= 0 &&
      snareTransient > 0.48 &&
      Math.abs(this.kickFovPunch) < 0.25
    ) {
      this.lastSnarePunchBar = barNumber;
      this.snareCooldown = Math.max(0.24, beatSec * 0.5);
      this.fovPunch = 0.85;
    }
    this.fovPunch = THREE.MathUtils.damp(this.fovPunch, 0, 9.5, dt);

    let targetAz = 0;
    let targetRad = 14.2;
    let targetHeight = 2.4;
    let targetFov = 46;
    let targetRoll = 0;
    this._desiredTarget.set(0, 2.35, -1.2);

    if (!playing && !isEncoreActive) {
      const bf = this.resolveBackstageFraming(clock, lineupPositions);
      targetAz = bf.azimuth;
      targetRad = bf.radius;
      targetHeight = bf.height;
      targetFov = bf.fov;
      targetRoll = bf.roll;
      this.prevSectionId = null;
    } else if (this.mode === 'locked') {
      targetAz = 0;
      targetRad = 14.8;
      targetHeight = 2.6;
      targetFov = 46;
      this._desiredTarget.set(0, 2.35, -1.2);
    } else if (
      this.mode === 'aerial-drone' ||
      (isEncoreActive && (!playing || encoreFinaleActive || this.currentPreset === CAMERA_PRESETS.ENCORE_AERIAL_HELICOPTER))
    ) {
      this.currentPreset = CAMERA_PRESETS.ENCORE_AERIAL_HELICOPTER;
      targetAz = Math.sin(clock * 0.2) * 0.74;
      targetRad = isEncoreActive ? 54.0 + Math.cos(clock * 0.16) * 2.8 : 42.0 + Math.cos(clock * 0.18) * 2.2;
      targetHeight = isEncoreActive ? 28.0 + Math.sin(clock * 0.18) * 2.4 : 21.5 + Math.sin(clock * 0.22) * 1.8;
      targetFov = isEncoreActive ? 62 : 55;
      targetRoll = Math.sin(clock * 0.2) * 0.022;
      this._desiredTarget.set(0, isEncoreActive ? 17.5 : 8.2, isEncoreActive ? -11.5 : -5.5);
    } else if (this.mode === 'pit-steadicam') {
      this.currentPreset = CAMERA_PRESETS.FRONT_ROW_LOW_HERO;
      const framing = this.resolvePresetFraming(this.currentPreset, clock, {
        activeInstrument,
        activeInstruments,
        lineupPositions,
        livePositions,
        bassEnergy,
        sectionType,
        crowdEventCenter,
        crowdEventType,
        ambianceType,
        fever,
        encore,
      });
      targetAz = framing.azimuth;
      targetRad = framing.radius;
      targetHeight = framing.height;
      targetFov = framing.fov;
      targetRoll = framing.roll;
    } else if (this.mode === 'crowd-pov') {
      // Smoothly glides between eye-level GA Fan-Cam and Upper-Bowl Concertgoer vista every 8 bars
      const useUpperBowl = barNumber >= 0 && Math.floor(barNumber / 8) % 2 === 1;
      this.currentPreset = useUpperBowl
        ? CAMERA_PRESETS.ARENA_UPPER_BOWL_SWEEP
        : CAMERA_PRESETS.CROWD_POV_FAN_CAM;
      const framing = this.resolvePresetFraming(this.currentPreset, clock, {
        activeInstrument,
        activeInstruments,
        lineupPositions,
        livePositions,
        bassEnergy,
        sectionType,
        crowdEventCenter,
        crowdEventType,
        ambianceType,
        fever,
        encore,
      });
      targetAz = framing.azimuth;
      targetRad = framing.radius;
      targetHeight = framing.height;
      targetFov = framing.fov;
      targetRoll = framing.roll;
    } else if (this.mode === 'pit-surf') {
      this.currentPreset = CAMERA_PRESETS.CROWD_PIT_SURF;
      const framing = this.resolvePresetFraming(this.currentPreset, clock, {
        activeInstrument,
        activeInstruments,
        lineupPositions,
        livePositions,
        bassEnergy,
        sectionType,
        crowdEventCenter,
        crowdEventType,
        ambianceType,
        fever,
        encore,
      });
      targetAz = framing.azimuth;
      targetRad = framing.radius;
      targetHeight = framing.height;
      targetFov = framing.fov;
      targetRoll = framing.roll;
    } else if (this.mode === 'hero-closeup') {
      this.currentPreset = CAMERA_PRESETS.CATWALK_FRONT_WALKOUT;
      const framing = this.resolvePresetFraming(this.currentPreset, clock, {
        activeInstrument,
        lineupPositions,
        livePositions,
        bassEnergy,
        sectionType,
        crowdEventCenter,
        crowdEventType,
        ambianceType,
        fever,
        encore,
      });
      targetAz = framing.azimuth;
      targetRad = framing.radius;
      targetHeight = framing.height;
      targetFov = framing.fov;
      targetRoll = framing.roll;
    } else if (this.mode === 'stadium-crane') {
      this.currentPreset = CAMERA_PRESETS.ARENA_WIDE_CRANE;
      const framing = this.resolvePresetFraming(this.currentPreset, clock, {
        activeInstrument,
        lineupPositions,
        livePositions,
        bassEnergy,
        sectionType,
        crowdEventCenter,
        crowdEventType,
        ambianceType,
        fever,
        encore,
      });
      targetAz = framing.azimuth;
      targetRad = framing.radius;
      targetHeight = framing.height;
      targetFov = framing.fov;
      targetRoll = framing.roll;
    } else if (this.mode === 'subtle') {
      targetAz = Math.sin(clock * 0.24) * 0.36;
      targetRad = 14.8 + Math.cos(clock * 0.18) * 0.7;
      targetHeight = 2.65 + Math.sin(clock * 0.26) * 0.24;
      targetFov = 46;
      this._desiredTarget.set(0, 2.35, -1.2);
    } else if (playing && songTime < -1.85) {
      const wp = Math.max(0, Math.min(1, (songTime + 4.5) / 2.65));
      const eased = 1 - Math.pow(1 - wp, 2.2);
      targetAz = -0.82 + eased * 0.96;
      targetRad = 17.6 - eased * 3.0;
      targetHeight = 4.8 - eased * 3.2;
      this._desiredTarget.set(0, 2.3, -1.25);
    } else if (playing && stemDropped) {
      targetAz = Math.sin(clock * 0.4) * 0.22;
      targetRad = 15.6;
      targetHeight = 3.2;
      this._desiredTarget.set(0, 2.25, -1.25);
    } else {
      const feverJustTriggered = fever && !this.prevFever;
      const encoreJustTriggered = encore && !this.prevEncore;
      const sectionJustChanged = Boolean(sectionId && sectionId !== this.prevSectionId && songTime >= 0);
      const crowdEventJustStarted =
        Boolean(crowdEventType && crowdEventType !== 'NORMAL' && crowdEventType !== this.prevCrowdEventType);

      // Queue urgent editorial cues so cuts fire STRICTLY on the next musical downbeat (never mid-beat!)
      if (crowdEventJustStarted) {
        this.pendingCutUrgent = true;
        this.pendingCutPreset =
          crowdEventType === 'CROWD_SURFING'
            ? CAMERA_PRESETS.CROWD_PIT_SURF
            : crowdEventType === 'STADIUM_WAVE'
              ? CAMERA_PRESETS.ARENA_UPPER_BOWL_SWEEP
              : crowdEventType === 'HEART_HANDS' || crowdEventType === 'CRYING_SWAY'
                ? CAMERA_PRESETS.CROWD_POV_FAN_CAM
                : CAMERA_PRESETS.CROWD_PIT_MOSH_CAM;
      } else if (feverJustTriggered && !this.recentShots.includes(CAMERA_PRESETS.BAND_ORBIT_360)) {
        this.pendingCutUrgent = true;
        this.pendingCutPreset = CAMERA_PRESETS.BAND_ORBIT_360;
      } else if (
        (isEncoreActive || fireworksGrandActive) &&
        this.currentPreset !== CAMERA_PRESETS.ENCORE_AERIAL_HELICOPTER
      ) {
        this.pendingCutUrgent = true;
        this.pendingCutPreset = CAMERA_PRESETS.ENCORE_AERIAL_HELICOPTER;
      } else if (encoreJustTriggered || sectionJustChanged || snareFillActive || (guitarSpikeActive && sectionType === 'GUITAR_SOLO')) {
        this.pendingCutUrgent = true;
      }

      // Phrase-boundary cuts: 2 bars in Choruses/Guitar Solos/Outros/Fever/Encore, 4 bars in Verses/Intros/Bridges
      const cutIntervalBars =
        sectionType === 'GUITAR_SOLO' ||
        sectionType === 'CHORUS' ||
        sectionType === 'OUTRO' ||
        fever ||
        encore ||
        overallEnergy > 0.52 ||
        combo >= 35
          ? 2
          : 4;

      let shouldCut = false;
      const onMusicalDownbeat = isDownbeat || isPhraseBoundary;
      if (barNumber >= 0 && barNumber !== this.lastCutBar && onMusicalDownbeat) {
        const isFirstDownbeat = this.lastCutBar < 0 && barNumber === 0;
        const barsSinceCut = barNumber - this.lastCutBar;
        const isPhraseBarBoundary = isPhraseBoundary || barNumber % cutIntervalBars === 0 || barsSinceCut >= cutIntervalBars;
        if (this.pendingCutUrgent || isFirstDownbeat || (barsSinceCut >= cutIntervalBars && isPhraseBarBoundary)) {
          shouldCut = true;
        }
      }

      if (shouldCut) {
        this.lastCutBar = Math.max(0, barNumber);
        this.cutCount += 1;
        this.shotSideSign = this.cutCount % 2 === 0 ? 1 : -1;
        const queuedPreset = this.pendingCutPreset;
        this.pendingCutUrgent = false;
        this.pendingCutPreset = null;

        const nextPreset = queuedPreset
          ? queuedPreset
          : this.selectNextPreset({
              activeInstrument,
              activeInstruments,
              combo,
              fever,
              encore,
              overallEnergy,
              stemActivity,
              hasVocalist,
              sectionType,
              crowdEventType,
              ambianceType,
              guitarRiffEnergy,
              snareFillActive,
              fireworksGrandActive,
            });
        if (nextPreset !== this.currentPreset) {
          this.currentPreset = nextPreset;
          this.pushRecentShot(nextPreset);
          this.presetAge = 0;
        }
      }

      const framing = this.resolvePresetFraming(this.currentPreset, this.presetAge, {
        activeInstrument,
        activeInstruments,
        lineupPositions,
        livePositions,
        bassEnergy,
        sectionType,
        crowdEventCenter,
        crowdEventType,
        ambianceType,
        fever,
        encore,
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
    this.prevCrowdEventType = crowdEventType;

    const lambda = !playing && !isEncoreActive
      ? 4.4
      : this.mode === 'locked'
        ? 5.0
        : isEncoreActive || this.currentPreset === CAMERA_PRESETS.ENCORE_AERIAL_HELICOPTER
          ? 2.4
          : this.currentPreset === CAMERA_PRESETS.BAND_ORBIT_360
            ? 2.8
            : 4.8;

    this.azimuth = THREE.MathUtils.damp(this.azimuth, targetAz, lambda, dt);
    this.radius = THREE.MathUtils.damp(this.radius, targetRad, lambda, dt);
    this.height = THREE.MathUtils.damp(this.height, targetHeight, lambda, dt);
    this.fov = THREE.MathUtils.damp(this.fov, targetFov + this.fovPunch + this.kickFovPunch, 9.5, dt);
    this.roll = THREE.MathUtils.damp(this.roll, targetRoll, 4.4, dt);

    this.target.x = THREE.MathUtils.damp(this.target.x, this._desiredTarget.x, lambda * 1.45, dt);
    this.target.y = THREE.MathUtils.damp(this.target.y, this._desiredTarget.y, lambda * 1.45, dt);
    this.target.z = THREE.MathUtils.damp(this.target.z, this._desiredTarget.z, lambda * 1.45, dt);

    if (Math.abs(camera.fov - this.fov) > 0.04) {
      camera.fov = this.fov;
      camera.updateProjectionMatrix();
    }

    // Beat-Locked Handheld Steadicam Sway synced to beatPhase * 0.5 + Kick-Drum Sub-Bass Micro-Shake
    const steadyOn = playing && this.mode !== 'locked' && !isEncoreActive;
    const halfBeatRad = (beatIndex + beatPhase) * Math.PI; // 1 full cycle every 2 beats (beatPhase * 0.5)
    const steadyX = steadyOn ? Math.sin(halfBeatRad) * 0.095 + Math.cos(halfBeatRad * 0.5) * 0.045 : 0;
    const steadyY = steadyOn ? Math.abs(Math.sin(halfBeatRad)) * 0.065 : 0;
    const steadyRoll = steadyOn ? Math.sin(halfBeatRad) * 0.0085 : 0;

    const shakeAmp = playing && this.mode !== 'locked' ? this.kickShake * 0.095 : 0;
    const shakeY = Math.sin(this.kickShakePhase) * shakeAmp;
    const shakeX = Math.cos(this.kickShakePhase * 0.7) * shakeAmp * 0.45;

    const camX = this.target.x + Math.sin(this.azimuth) * this.radius + shakeX + steadyX;
    const camZ = this.target.z + Math.cos(this.azimuth) * this.radius;
    // Allow Reverse Artist's POV / Stage-to-Crowd Reverse shots behind rear stage truss while clamping standard shots safely
    const isReversePov =
      (this.currentPreset === CAMERA_PRESETS.REVERSE_SILHOUETTE_SPOTLIGHT ||
        this.currentPreset === CAMERA_PRESETS.STAGE_TO_CROWD_REVERSE) &&
      this.mode === 'on' &&
      !isEncoreActive;
    const safeZ = isReversePov ? camZ : Math.max(-7.6, camZ);
    camera.position.set(camX, this.height + shakeY + steadyY, safeZ);
    camera.lookAt(this.target);

    const totalRoll = this.roll + steadyRoll + shakeX * 0.14;
    if (Math.abs(totalRoll) > 0.001) {
      camera.rotateZ(totalRoll);
    }
  }
}

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

    // Kinetic spherical rig + Dutch tilt roll + kick shake + snare FOV punch (zero per-frame heap allocations)
    this.azimuth = 0;
    this.radius = 12.6;
    this.height = 1.45;
    this.fov = 46;
    this.fovPunch = 0;
    this.roll = 0;
    this.kickShake = 0;
    this.kickShakePhase = 0;
    this.prevFever = false;
    this.prevEncore = false;
    this.prevSectionId = null;
    this.prevCrowdEventType = 'NORMAL';

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
    while (this.recentShots.length > 5) {
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
    this.cutCount = 0;
    this.shotSideSign = 1;
    this.fovPunch = 0;
    this.roll = 0;
    this.kickShake = 0;
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
  }) {
    const isInstActive = (role) => !stemActivity || stemActivity[role] !== false;
    const isBallad = ambianceType === 'BALLAD_EMOTIONAL';
    const isTwoPlayer = Array.isArray(activeInstruments) && activeInstruments.length >= 2;
    const secondInst = isTwoPlayer ? activeInstruments[1] : null;

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
    addW(CAMERA_PRESETS.CATWALK_FRONT_WALKOUT, sectionType === 'CHORUS' || sectionType === 'GUITAR_SOLO' || combo >= 20 ? 2.8 : 1.6);
    addW(CAMERA_PRESETS.ARENA_WIDE_CRANE, isTwoPlayer ? 2.5 : sectionType === 'INTRO' ? 3.0 : 1.7);
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
      isInstActive(activeInstrument) ? (combo >= 25 ? 2.7 : 1.75) : 0.7
    );
    addW(CAMERA_PRESETS.STAGE_WING_DOLLY_TRACK, 1.35);
    addW(CAMERA_PRESETS.BAND_ORBIT_360, sectionType === 'BRIDGE' || sectionType === 'CHORUS' ? 1.75 : 1.05);
    addW(CAMERA_PRESETS.JUMBOTRON_SHOUTOUT_SWEEP, fever || sectionType === 'CHORUS' || combo >= 30 ? 1.85 : 0.95);
    addW(CAMERA_PRESETS.REVERSE_SILHOUETTE_SPOTLIGHT, overallEnergy > 0.34 || fever || sectionType === 'CHORUS' ? 2.1 : 1.0);

    if (isInstActive('piano') || activeInstrument === 'piano' || secondInst === 'piano' || isBallad) {
      addW(CAMERA_PRESETS.PIANO_HANDS_OVER_SHOULDER, activeInstrument === 'piano' || secondInst === 'piano' ? 2.8 : isBallad ? 2.3 : 1.05);
    }
    if (isInstActive('drums') || activeInstrument === 'drums' || secondInst === 'drums') {
      addW(CAMERA_PRESETS.DRUM_KIT_ACTION_LOW, activeInstrument === 'drums' || secondInst === 'drums' ? 3.0 : 1.75);
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
    if (fever || encore || sectionType === 'OUTRO') {
      addW(CAMERA_PRESETS.ENCORE_AERIAL_HELICOPTER, encore ? 3.5 : 2.0);
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
    const dPos = livePositions?.drums || lineupPositions?.drums || { x: 0, y: 0.8, z: -2.8 };
    const pPos = livePositions?.piano || lineupPositions?.piano || { x: 6.5, y: 0.5, z: -1.8 };
    const vPos = livePositions?.vocals || lineupPositions?.vocalist || { x: 0, y: 0, z: 2.0 };
    const getPosForRole = (role) =>
      role === 'bass' ? bPos : role === 'drums' ? dPos : role === 'piano' ? pPos : role === 'vocals' ? vPos : gPos;
    const isTwoPlayer = Array.isArray(activeInstruments) && activeInstruments.length >= 2;
    const focusInstrument = isTwoPlayer
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
      // 1. Front-Pit Steadicam: curved track sweeping z: 11.5 -> 13.5, low-angle y: 1.25..1.55m, fov 46, ±1.8° roll
      case CAMERA_PRESETS.FRONT_ROW_LOW_HERO: {
        const focusX = (gPos.x * 0.35 + vPos.x * 0.65);
        this._desiredTarget.set(focusX, 2.25 + (vPos.y || 0) * 0.35, -1.0);
        const sweepRad = Math.sin(shotTime * 0.38) * 0.34 + this.shotSideSign * 0.18;
        const pitRadius = 12.8 + Math.sin(shotTime * 0.42) * 1.0; // z ~ 11.5..13.5m in front of -1.0 target
        return {
          azimuth: sweepRad,
          radius: pitRadius,
          height: 1.38 + Math.cos(shotTime * 0.5) * 0.16,
          fov: 46,
          roll: isHighEnergyChorus ? this.shotSideSign * 0.0314 : 0, // ±1.8 deg = 0.0314 rad
        };
      }

      // 2. Catwalk Hero Dolly: heroic low-angle close-up (fov 38) tracking frontperson/guitarist on catwalk
      case CAMERA_PRESETS.CATWALK_FRONT_WALKOUT: {
        const leadZ = Math.max(vPos.z, gPos.z, bPos.z);
        const focusMember = leadZ === vPos.z ? vPos : leadZ === gPos.z ? gPos : bPos;
        const clampedZ = Math.max(2.6, Math.min(10.6, focusMember.z));
        this._desiredTarget.set(focusMember.x * 0.8, 2.15 + (focusMember.y || 0) * 0.4, clampedZ);
        return {
          azimuth: this.shotSideSign * (0.36 + Math.sin(shotTime * 0.44) * 0.24),
          radius: 5.4 - dollyPush * 0.75,
          height: 1.28 + Math.cos(shotTime * 0.42) * 0.14 + bpmPulse * 0.45,
          fov: 38,
          roll: isHighEnergyChorus ? this.shotSideSign * 0.0314 : 0,
        };
      }

      // 3. 3/4 Drum & Riser Crane: sweeping behind/beside elevated drum riser looking out toward crowd (fov 42)
      case CAMERA_PRESETS.DRUM_KIT_ACTION_LOW:
        this._desiredTarget.set(dPos.x, 2.48, dPos.z + 0.65);
        return {
          azimuth: this.shotSideSign * (1.82 + Math.sin(shotTime * 0.52) * 0.34),
          radius: 4.55 - dollyPush * 0.38,
          height: 2.75 + Math.sin(shotTime * 0.55) * 0.22 + bpmPulse * 0.5,
          fov: 42,
          roll: -0.026 * this.shotSideSign,
        };

      // 4. Reverse "Artist's POV" Stadium Shot: behind band looking over drum riser into 360° lightstick bowl (fov 58)
      case CAMERA_PRESETS.REVERSE_SILHOUETTE_SPOTLIGHT:
        this._desiredTarget.set(this.shotSideSign * 0.45, 2.35, 11.5);
        return {
          azimuth: Math.PI + this.shotSideSign * (0.22 + Math.sin(shotTime * 0.3) * 0.22),
          radius: 17.2 + Math.cos(shotTime * 0.28) * 0.5,
          height: 3.15 + Math.sin(shotTime * 0.4) * 0.25,
          fov: 58,
          roll: 0,
        };

      // 5. Technocrane / Spidercam Sweep: high-speed sweeping arc across wide stadium & photo pit (fov 50)
      case CAMERA_PRESETS.ARENA_WIDE_CRANE:
        this._desiredTarget.set(0, 2.68, -1.2);
        return {
          azimuth: this.shotSideSign * 0.32 + Math.sin(shotTime * 0.38) * 0.58,
          radius: 15.8 + Math.cos(shotTime * 0.28) * 1.15,
          height: 6.45 + Math.sin(shotTime * 0.36) * 0.85 + bpmPulse * 0.7,
          fov: 50,
          roll: Math.sin(shotTime * 0.38) * 0.018,
        };

      // 6. Pit Event Reaction Cam: snaps into mosh pit / heart hands / wave center (fov 36)
      case CAMERA_PRESETS.CROWD_PIT_MOSH_CAM: {
        const isWideCrowd =
          crowdEventType === 'STADIUM_WAVE' ||
          crowdEventType === 'HEART_HANDS' ||
          crowdEventType === 'CRYING_SWAY' ||
          crowdEventType === 'WALL_OF_DEATH';
        const pitX = crowdEventType && crowdEventType !== 'NORMAL' && crowdEventCenter ? crowdEventCenter.x : 0;
        const pitZ = crowdEventType && crowdEventType !== 'NORMAL' && crowdEventCenter ? crowdEventCenter.z : 14.8;
        this._desiredTarget.set(isWideCrowd ? 0 : pitX, isWideCrowd ? 2.4 : 1.85, isWideCrowd ? 14.5 : pitZ - 0.5);
        return {
          azimuth: this.shotSideSign * (isWideCrowd ? 0.4 : 0.52) + Math.sin(shotTime * 0.48) * 0.36,
          radius: (isWideCrowd ? 10.6 : 7.2) + Math.cos(shotTime * 0.42) * 0.45,
          height: (isWideCrowd ? 4.4 : 2.65) + Math.sin(shotTime * 0.56) * 0.22 + bpmPulse * 0.7,
          fov: 36,
          roll: this.shotSideSign * (isWideCrowd ? 0.018 : 0.028),
        };
      }

      // 6B. Crowd-POV Fan-Cam: eye-level inside the GA standing pit looking up past waving lightsticks to the band & Jumbotron
      case CAMERA_PRESETS.CROWD_POV_FAN_CAM: {
        const fanBounce = Math.abs(Math.sin(shotTime * 3.4)) * (0.14 + bassEnergy * 0.16);
        const focusX = (vPos.x * 0.5 + gPos.x * 0.25 + bPos.x * 0.25) * 0.55;
        this._desiredTarget.set(focusX, 3.15, -1.65);
        const pitAngle = this.shotSideSign * 0.26 + Math.sin(shotTime * 0.34) * 0.28;
        return {
          azimuth: pitAngle,
          radius: 18.2 + Math.cos(shotTime * 0.29) * 1.15,
          height: 1.72 + fanBounce + Math.sin(shotTime * 0.75) * 0.09,
          fov: 50,
          roll: Math.sin(shotTime * 0.9) * 0.016,
        };
      }

      // 6C. Crowd Pit-Surf & Barricade Glider: energetic lateral surf along front GA rail & moshpit hands
      case CAMERA_PRESETS.CROWD_PIT_SURF: {
        const surfArc = Math.sin(shotTime * 0.62) * 0.58 + this.shotSideSign * 0.14;
        const surfBounce = Math.sin(shotTime * 4.2) * (0.12 + bassEnergy * 0.18);
        const catwalkZ = Math.max(0.5, Math.min(7.2, vPos.z * 0.45 + 1.8));
        this._desiredTarget.set(Math.sin(shotTime * 0.5) * 1.4, 2.55, catwalkZ - 1.2);
        return {
          azimuth: surfArc,
          radius: 13.4 + Math.cos(shotTime * 0.52) * 1.35,
          height: 2.25 + surfBounce + Math.cos(shotTime * 0.65) * 0.18,
          fov: 45,
          roll: Math.cos(shotTime * 0.62) * 0.032,
        };
      }

      // 6D. Arena Upper-Bowl Concertgoer Sweep: sweeping mid/upper-tier stadium vista showing full 360° lightstick bowls
      case CAMERA_PRESETS.ARENA_UPPER_BOWL_SWEEP: {
        this._desiredTarget.set(0, 3.4, -1.5);
        return {
          azimuth: this.shotSideSign * 0.52 + Math.sin(shotTime * 0.24) * 0.64,
          radius: 26.8 + Math.cos(shotTime * 0.2) * 1.8,
          height: 12.2 + Math.sin(shotTime * 0.26) * 1.45,
          fov: 52,
          roll: Math.sin(shotTime * 0.24) * 0.014,
        };
      }

      // 6E. Stage-to-Crowd Reverse Dolly: behind the band looking out across musicians into the glowing pit & stadium wave
      case CAMERA_PRESETS.STAGE_TO_CROWD_REVERSE: {
        this._desiredTarget.set(this.shotSideSign * 0.75, 2.5, 15.5);
        return {
          azimuth: Math.PI + this.shotSideSign * (0.18 + Math.sin(shotTime * 0.34) * 0.26),
          radius: 21.6 + Math.cos(shotTime * 0.3) * 0.75,
          height: 2.95 + Math.sin(shotTime * 0.44) * 0.24 + bpmPulse * 0.45,
          fov: 56,
          roll: Math.sin(shotTime * 0.34) * 0.015,
        };
      }

      // 7. Grand Encore Helicopter Drone: sweeping wide 360° stadium & aerial fireworks vista (fov 54)
      case CAMERA_PRESETS.ENCORE_AERIAL_HELICOPTER:
        this._desiredTarget.set(0, 8.8, -4.0);
        return {
          azimuth: Math.sin(shotTime * 0.22) * 0.76,
          radius: 44.0 + Math.cos(shotTime * 0.16) * 2.4,
          height: 24.5 + Math.sin(shotTime * 0.2) * 2.0,
          fov: 54,
          roll: Math.sin(shotTime * 0.22) * 0.02,
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
        this._desiredTarget.set(this.shotSideSign * -0.4, 2.25, -1.25);
        return {
          azimuth: this.shotSideSign * (1.24 + Math.sin(shotTime * 0.34) * 0.24),
          radius: 7.5 - dollyPush * 0.9,
          height: 1.62 + Math.cos(shotTime * 0.4) * 0.2,
          fov: 43,
          roll: -0.02 * this.shotSideSign,
        };

      case CAMERA_PRESETS.JUMBOTRON_SHOUTOUT_SWEEP:
        this._desiredTarget.set(0, 5.4, -5.6);
        return {
          azimuth: Math.sin(shotTime * 0.32) * 0.36,
          radius: 17.6 - dollyPush * 1.1,
          height: 3.6 + Math.cos(shotTime * 0.26) * 0.38,
          fov: 50,
          roll: 0,
        };

      case CAMERA_PRESETS.BAND_ORBIT_360:
      default:
        this._desiredTarget.set(0, 2.32, -1.1);
        return {
          azimuth: Math.sin(shotTime * 0.52) * 1.15 * this.shotSideSign,
          radius: 10.8 + Math.cos(shotTime * 0.4) * 0.9,
          height: 2.95 + Math.sin(shotTime * 0.36) * 0.42 + bpmPulse * 0.5,
          fov: 47,
          roll: Math.sin(shotTime * 0.52) * 0.026,
        };
    }
  }

  resolveBackstageFraming(clock, lineupPositions) {
    const gPos = lineupPositions?.guitar || { x: -4.5, y: 0, z: 1.0 };
    const bPos = lineupPositions?.bass || { x: 4.5, y: 0, z: 1.0 };
    const dPos = lineupPositions?.drums || { x: 0, y: 0.8, z: -2.8 };
    const pPos = lineupPositions?.piano || { x: 6.5, y: 0.5, z: -1.8 };
    const vPos = lineupPositions?.vocalist?.visible ? lineupPositions.vocalist : gPos;

    switch (this.backstageFocus) {
      case 'stars':
        this._desiredTarget.set(vPos.x, 1.9, vPos.z);
        return { azimuth: Math.sin(clock * 0.42) * 0.34, radius: 4.2, height: 1.85, fov: 38, roll: 0 };
      case 'piano':
        this._desiredTarget.set(pPos.x, 1.95, pPos.z + 0.15);
        return { azimuth: (pPos.x < 0 ? -0.45 : 0.45) + Math.sin(clock * 0.42) * 0.22, radius: 4.75, height: 2.6, fov: 40, roll: 0 };
      case 'guitar':
        this._desiredTarget.set(gPos.x, 1.75, gPos.z);
        return { azimuth: (gPos.x < -1 ? -0.32 : 0.16) + Math.sin(clock * 0.45) * 0.18, radius: 4.6, height: 1.95, fov: 40, roll: 0.02 };
      case 'bass':
        this._desiredTarget.set(bPos.x, 1.75, bPos.z);
        return { azimuth: 0.32 + Math.sin(clock * 0.45) * 0.18, radius: 4.6, height: 1.95, fov: 40, roll: -0.02 };
      case 'drums':
        this._desiredTarget.set(dPos.x, 2.2, dPos.z + 0.15);
        return { azimuth: Math.sin(clock * 0.38) * 0.48, radius: 5.5, height: 3.15, fov: 42, roll: 0 };
      case 'band':
      case 'highway':
        this._desiredTarget.set(0, 2.2, -1.2);
        return { azimuth: Math.sin(clock * 0.28) * 0.36, radius: 13.4, height: 3.35 + Math.sin(clock * 0.22) * 0.2, fov: 46, roll: 0 };
      case 'venues':
        this._desiredTarget.set(0, 4.6, -3.5);
        return { azimuth: Math.sin(clock * 0.2) * 0.78, radius: 22.0 + Math.cos(clock * 0.16) * 1.4, height: 8.2 + Math.sin(clock * 0.18) * 0.7, fov: 54, roll: 0 };
      case 'setlist':
      default:
        this._desiredTarget.set(0, 2.35, -1.35);
        return { azimuth: Math.sin(clock * 0.2) * 0.46, radius: 14.4 + Math.cos(clock * 0.17) * 0.7, height: 2.35 + Math.sin(clock * 0.19) * 0.25, fov: 46, roll: 0 };
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
    const kickTransient = Number(opts.kickTransient || 0);
    const snareTransient = Number(opts.snareTransient || 0);
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
    if (kickTransient > 0.35) {
      this.triggerKickImpulse(Math.min(0.95, kickTransient));
    }
    this.kickShake = Math.max(0, this.kickShake - dt * 5.2);
    this.kickShakePhase += dt * 52;

    // +1.8° FOV punch triggered on snare transients & strong downbeats (locked smoothly so it feels physical)
    const isHighEnergy = sectionType === 'CHORUS' || sectionType === 'GUITAR_SOLO' || fever || encore || overallEnergy > 0.36;
    if (
      playing &&
      this.mode !== 'locked' &&
      this.snareCooldown <= 0 &&
      (snareTransient > 0.34 || (isHighEnergy && barNumber > this.lastSnarePunchBar && (bassEnergy > 0.34 || drumEnergy > 0.34)))
    ) {
      this.lastSnarePunchBar = barNumber;
      this.snareCooldown = 0.22;
      this.fovPunch = 1.8;
    }
    this.fovPunch = THREE.MathUtils.damp(this.fovPunch, 0, 8.2, dt);

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
    } else if (isEncoreActive || this.mode === 'aerial-drone') {
      this.currentPreset = CAMERA_PRESETS.ENCORE_AERIAL_HELICOPTER;
      targetAz = Math.sin(clock * 0.22) * 0.78;
      targetRad = isEncoreActive ? 46.0 + Math.cos(clock * 0.16) * 2.4 : 38.0 + Math.cos(clock * 0.18) * 2.2;
      targetHeight = isEncoreActive ? 25.5 + Math.sin(clock * 0.2) * 2.2 : 20.5 + Math.sin(clock * 0.22) * 1.8;
      targetFov = isEncoreActive ? 62 : 54;
      targetRoll = Math.sin(clock * 0.22) * 0.022;
      this._desiredTarget.set(0, isEncoreActive ? 11.2 : 6.4, -4.8);
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
      if (crowdEventJustStarted || feverJustTriggered || encoreJustTriggered || sectionJustChanged) {
        shouldCut = true;
      } else if (barNumber >= 0 && barNumber !== this.lastCutBar) {
        const isFirstDownbeat = this.lastCutBar < 0 && barNumber === 0;
        const barsSinceCut = barNumber - this.lastCutBar;
        const isPhraseBarBoundary = barNumber % cutIntervalBars === 0 || barsSinceCut >= cutIntervalBars;
        if (isFirstDownbeat || (barsSinceCut >= cutIntervalBars && isPhraseBarBoundary)) {
          shouldCut = true;
        }
      }

      if (shouldCut) {
        this.lastCutBar = Math.max(0, barNumber);
        this.cutCount += 1;
        this.shotSideSign = this.cutCount % 2 === 0 ? 1 : -1;
        const crowdEventShot =
          crowdEventType === 'CROWD_SURFING'
            ? CAMERA_PRESETS.CROWD_PIT_SURF
            : crowdEventType === 'STADIUM_WAVE'
              ? CAMERA_PRESETS.ARENA_UPPER_BOWL_SWEEP
              : crowdEventType === 'HEART_HANDS' || crowdEventType === 'CRYING_SWAY'
                ? CAMERA_PRESETS.CROWD_POV_FAN_CAM
                : CAMERA_PRESETS.CROWD_PIT_MOSH_CAM;
        const nextPreset = crowdEventJustStarted
          ? crowdEventShot
          : feverJustTriggered && !this.recentShots.includes(CAMERA_PRESETS.BAND_ORBIT_360)
            ? CAMERA_PRESETS.BAND_ORBIT_360
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
          ? 2.2
          : this.currentPreset === CAMERA_PRESETS.BAND_ORBIT_360
            ? 2.8
            : 4.4;

    this.azimuth = THREE.MathUtils.damp(this.azimuth, targetAz, lambda, dt);
    this.radius = THREE.MathUtils.damp(this.radius, targetRad, lambda, dt);
    this.height = THREE.MathUtils.damp(this.height, targetHeight, lambda, dt);
    this.fov = THREE.MathUtils.damp(this.fov, targetFov + this.fovPunch, 6.8, dt);
    this.roll = THREE.MathUtils.damp(this.roll, targetRoll, 4.2, dt);

    this.target.x = THREE.MathUtils.damp(this.target.x, this._desiredTarget.x, lambda * 1.45, dt);
    this.target.y = THREE.MathUtils.damp(this.target.y, this._desiredTarget.y, lambda * 1.45, dt);
    this.target.z = THREE.MathUtils.damp(this.target.z, this._desiredTarget.z, lambda * 1.45, dt);

    if (Math.abs(camera.fov - this.fov) > 0.04) {
      camera.fov = this.fov;
      camera.updateProjectionMatrix();
    }

    // Organic Steadicam operator sway + kick transient sub-bass micro-shake
    const steadyOn = playing && this.mode !== 'locked' && !isEncoreActive;
    const steadyX = steadyOn ? Math.sin(clock * 0.92) * 0.085 + Math.cos(clock * 1.47) * 0.04 : 0;
    const steadyY = steadyOn ? Math.sin(clock * 1.24 + 0.8) * 0.055 : 0;
    const steadyRoll = steadyOn ? Math.sin(clock * 0.76) * 0.006 : 0;

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

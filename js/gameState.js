/**
 * gameState.js
 * Central state manager for Encore Stage:
 *  - Instrument role (guitar, bass, drums)
 *  - Authentic Guitar Hero: World Tour 4-tier Difficulty & Lane Mapping:
 *      * easy   -> 3 lanes (D F G)
 *      * medium -> 4 lanes (D F G J)
 *      * hard   -> 5 lanes (D F G J K)
 *      * expert -> 5 lanes + chords (D F G J K)
 *  - Practice Speed (50%, 75%, 100%, plus 110% Encore Speed-Up)
 *  - Multi-Song Tour Setlist Queue with automatic Final Encore flagging & Tour Summary
 *  - Fever Mode (SPACE for 2x multiplier) + Whammy Fever bonus on sustain bends
 *  - Practice / Section Loop mode ([ start, ] end)
 *  - Persisted audio/visual latency, venue, camera mode, crowd volume, and Backstage Gear
 */

const STORAGE_LATENCY_KEY = 'encore_stage_latency_ms';
const STORAGE_VENUE_KEY = 'encore_stage_venue_id';
const STORAGE_CAMERA_KEY = 'encore_stage_camera_mode';
const STORAGE_CROWD_VOL_KEY = 'encore_stage_crowd_vol';
const STORAGE_BAND_LINEUP_KEY = 'encore_stage_band_lineup_id';
const STORAGE_HIGHWAY_SKIN_KEY = 'encore_stage_highway_skin_id';
const STORAGE_GUITAR_MODEL_KEY = 'encore_stage_guitar_model_id';
const STORAGE_BASS_MODEL_KEY = 'encore_stage_bass_model_id';
const STORAGE_DRUM_KIT_KEY = 'encore_stage_drum_kit_id';
const STORAGE_KEYBOARD_MODEL_KEY = 'encore_stage_keyboard_model_id';
const STORAGE_STAR_LOOK_KEY = 'encore_stage_star_look_id';
const STORAGE_INSTRUMENT_SKIN_KEY = 'encore_stage_instrument_skin_id';
const STORAGE_DIFFICULTY_KEY = 'encore_stage_difficulty_id';
const STORAGE_INSTRUMENT_KEY = 'encore_stage_instrument_id';

export const SCREENS = {
  BACKSTAGE: 'BACKSTAGE',
  STAGE: 'STAGE',
  PAUSED: 'PAUSED',
  INTERMISSION: 'INTERMISSION',
  RESULTS: 'RESULTS',
  TOUR_SUMMARY: 'TOUR_SUMMARY',
};

export const INSTRUMENTS = {
  guitar: {
    id: 'guitar',
    label: 'Lead Guitar',
    shortLabel: 'Guitar',
    bandLabel: 'Lead & Chords',
    dropDesc: 'Shred solos, melodies & power chords',
    accent: '#06b6d4',
    accentBright: '#67e8f9',
    accentGlow: 'rgba(6, 182, 212, 0.72)',
  },
  bass: {
    id: 'bass',
    label: 'Bass',
    shortLabel: 'Bass',
    bandLabel: 'Low-End Groove',
    dropDesc: 'Pocket basslines, octaves & sustain grooves',
    accent: '#8b5cf6',
    accentBright: '#c4b5fd',
    accentGlow: 'rgba(139, 92, 246, 0.72)',
  },
  drums: {
    id: 'drums',
    label: 'Drums',
    shortLabel: 'Drums',
    bandLabel: 'Kit & Fills',
    dropDesc: 'Kick, snare, hi-hat & crash accents',
    accent: '#f59e0b',
    accentBright: '#fde68a',
    accentGlow: 'rgba(245, 158, 11, 0.75)',
  },
  piano: {
    id: 'piano',
    label: 'Piano / Keys',
    shortLabel: 'Piano',
    bandLabel: 'Chords & Arpeggios',
    dropDesc: 'Sustained grand piano chords, synth hooks & cascading arpeggios',
    accent: '#ec4899',
    accentBright: '#f9a8d4',
    accentGlow: 'rgba(236, 72, 153, 0.75)',
  },
};

export const DIFFICULTIES = {
  easy: {
    id: 'easy',
    label: 'Easy',
    badge: '3 Lanes',
    laneCount: 3,
    minNoteGapMs: 360,
    scanSensitivity: 1.62,
    chordChance: 0.0,
    allowChords: false,
    sustainChance: 0.36,
    scrollWindowSec: 1.8,
    hypeDrainOnMiss: 3.0,
    hypeGainOnHit: 3.0,
    allowFailOut: false,
    perfectWindowMs: 76,
    goodWindowMs: 170,
    wrongKeyWindowMs: 215,
  },
  medium: {
    id: 'medium',
    label: 'Medium',
    badge: '4 Lanes',
    laneCount: 4,
    minNoteGapMs: 225,
    scanSensitivity: 1.4,
    chordChance: 0.08,
    allowChords: false,
    sustainChance: 0.52,
    scrollWindowSec: 1.54,
    hypeDrainOnMiss: 4.5,
    hypeGainOnHit: 2.5,
    allowFailOut: true,
    perfectWindowMs: 62,
    goodWindowMs: 144,
    wrongKeyWindowMs: 190,
  },
  hard: {
    id: 'hard',
    label: 'Hard',
    badge: '5 Lanes',
    laneCount: 5,
    minNoteGapMs: 155,
    scanSensitivity: 1.24,
    chordChance: 0.24,
    allowChords: true,
    sustainChance: 0.52,
    scrollWindowSec: 1.36,
    hypeDrainOnMiss: 5.8,
    hypeGainOnHit: 2.25,
    allowFailOut: true,
    perfectWindowMs: 55,
    goodWindowMs: 130,
    wrongKeyWindowMs: 175,
  },
  expert: {
    id: 'expert',
    label: 'Expert',
    badge: '5 Lanes + Chords',
    laneCount: 5,
    minNoteGapMs: 105,
    scanSensitivity: 1.08,
    chordChance: 0.52,
    allowChords: true,
    sustainChance: 0.48,
    scrollWindowSec: 1.2,
    hypeDrainOnMiss: 7.2,
    hypeGainOnHit: 2.0,
    allowFailOut: true,
    perfectWindowMs: 48,
    goodWindowMs: 118,
    wrongKeyWindowMs: 160,
  },
};

export const LANE_CONFIGS = {
  3: {
    count: 3,
    keys: ['D', 'F', 'G'],
    codes: ['KeyD', 'KeyF', 'KeyG'],
    colors: [
      { base: '#22c55e', bright: '#86efac', glow: 'rgba(34, 197, 94, 0.78)' },
      { base: '#ef4444', bright: '#fca5a5', glow: 'rgba(239, 68, 68, 0.78)' },
      { base: '#f59e0b', bright: '#fde68a', glow: 'rgba(245, 158, 11, 0.8)' },
    ],
  },
  4: {
    count: 4,
    keys: ['D', 'F', 'G', 'J'],
    codes: ['KeyD', 'KeyF', 'KeyG', 'KeyJ'],
    colors: [
      { base: '#22c55e', bright: '#86efac', glow: 'rgba(34, 197, 94, 0.78)' },
      { base: '#ef4444', bright: '#fca5a5', glow: 'rgba(239, 68, 68, 0.78)' },
      { base: '#f59e0b', bright: '#fde68a', glow: 'rgba(245, 158, 11, 0.8)' },
      { base: '#38bdf8', bright: '#bae6fd', glow: 'rgba(56, 189, 248, 0.78)' },
    ],
  },
  5: {
    count: 5,
    keys: ['D', 'F', 'G', 'J', 'K'],
    codes: ['KeyD', 'KeyF', 'KeyG', 'KeyJ', 'KeyK'],
    colors: [
      { base: '#22c55e', bright: '#86efac', glow: 'rgba(34, 197, 94, 0.78)' },
      { base: '#ef4444', bright: '#fca5a5', glow: 'rgba(239, 68, 68, 0.78)' },
      { base: '#f59e0b', bright: '#fde68a', glow: 'rgba(245, 158, 11, 0.8)' },
      { base: '#38bdf8', bright: '#bae6fd', glow: 'rgba(56, 189, 248, 0.78)' },
      { base: '#f97316', bright: '#fed7aa', glow: 'rgba(249, 115, 22, 0.82)' },
    ],
  },
};

export const TIMING_WINDOWS = {
  PERFECT_MS: 58,
  GOOD_MS: 138,
  WRONG_KEY_WINDOW_MS: 185,
};

export const PYRO_MILESTONES = [30, 50, 100];
export const CHEER_MILESTONES = [15, 30, 50];

export class GameState {
  constructor() {
    this.screen = SCREENS.BACKSTAGE;

    const savedInst = this.loadStringPref(STORAGE_INSTRUMENT_KEY, 'guitar');
    this.instrument = INSTRUMENTS[savedInst] ? savedInst : 'guitar';

    const savedDiff = this.loadStringPref(STORAGE_DIFFICULTY_KEY, 'medium');
    this.difficulty = DIFFICULTIES[savedDiff] ? savedDiff : 'medium';
    this.laneCount = DIFFICULTIES[this.difficulty].laneCount;

    this.currentTrack = null;
    this.sfxMuted = false;

    this.latencyOffsetMs = this.loadLatencyOffset();
    this.venueId = this.loadVenueId();
    this.cameraMode = this.loadCameraMode();
    this.crowdVolume = this.loadCrowdVolume();

    // Backstage Band Lineup, Highway Skin & 3D Gear Customizer state
    this.bandLineupId = this.loadStringPref(STORAGE_BAND_LINEUP_KEY, 'arena-4piece');
    this.highwaySkinId = this.loadStringPref(STORAGE_HIGHWAY_SKIN_KEY, 'smoked-glass');
    this.guitarModelId = this.loadStringPref(STORAGE_GUITAR_MODEL_KEY, 'les-paul-sunburst');
    this.bassModelId = this.loadStringPref(STORAGE_BASS_MODEL_KEY, 'precision-blonde');
    this.drumKitModelId = this.loadStringPref(STORAGE_DRUM_KIT_KEY, 'pop-single-kick');
    this.keyboardModelId = this.loadStringPref(STORAGE_KEYBOARD_MODEL_KEY, 'concert-grand');
    this.starLookId = this.loadStringPref(STORAGE_STAR_LOOK_KEY, 'default-band');
    this.instrumentSkinId = this.loadStringPref(STORAGE_INSTRUMENT_SKIN_KEY, 'classic-sunburst');

    this.playbackRate = 1.0;
    this.practiceLoop = {
      enabled: false,
      startSec: null,
      endSec: null,
    };

    // Multi-Song Tour Setlist Builder state
    this.setlistQueue = [];
    this.tourActive = false;
    this.tourIndex = 0;
    this.tourResults = [];
    this.isEncorePerformance = false;

    this.resetRun();
  }

  loadStringPref(key, fallback) {
    try {
      const saved = window.localStorage.getItem(key);
      if (saved) return saved;
    } catch {
      // Ignore storage errors
    }
    return fallback;
  }

  saveStringPref(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Ignore storage errors
    }
  }

  setBandLineupId(id) {
    this.bandLineupId = id || 'arena-4piece';
    this.saveStringPref(STORAGE_BAND_LINEUP_KEY, this.bandLineupId);
  }

  setHighwaySkinId(id) {
    this.highwaySkinId = id || 'smoked-glass';
    this.saveStringPref(STORAGE_HIGHWAY_SKIN_KEY, this.highwaySkinId);
  }

  setGuitarModelId(id) {
    this.guitarModelId = id || 'les-paul-sunburst';
    this.saveStringPref(STORAGE_GUITAR_MODEL_KEY, this.guitarModelId);
  }

  setBassModelId(id) {
    this.bassModelId = id || 'precision-blonde';
    this.saveStringPref(STORAGE_BASS_MODEL_KEY, this.bassModelId);
  }

  setDrumKitModelId(id) {
    this.drumKitModelId = id || 'pop-single-kick';
    this.saveStringPref(STORAGE_DRUM_KIT_KEY, this.drumKitModelId);
  }

  setKeyboardModelId(id) {
    this.keyboardModelId = id || 'concert-grand';
    this.saveStringPref(STORAGE_KEYBOARD_MODEL_KEY, this.keyboardModelId);
  }

  setStarLookId(id) {
    this.starLookId = id || 'default-band';
    this.saveStringPref(STORAGE_STAR_LOOK_KEY, this.starLookId);
  }

  setInstrumentSkinId(id) {
    this.instrumentSkinId = id || 'classic-sunburst';
    this.saveStringPref(STORAGE_INSTRUMENT_SKIN_KEY, this.instrumentSkinId);
  }

  loadCrowdVolume() {
    try {
      const saved = window.localStorage.getItem(STORAGE_CROWD_VOL_KEY);
      if (saved !== null) {
        const parsed = Number(saved);
        if (Number.isFinite(parsed)) return Math.max(0, Math.min(1, parsed));
      }
    } catch {
      // Ignore
    }
    return 0.75;
  }

  setCrowdVolume(vol) {
    const clamped = Math.max(0, Math.min(1, Number(vol)));
    this.crowdVolume = Number.isFinite(clamped) ? clamped : 0.75;
    try {
      window.localStorage.setItem(STORAGE_CROWD_VOL_KEY, String(this.crowdVolume));
    } catch {
      // Ignore
    }
  }

  loadVenueId() {
    try {
      const saved = window.localStorage.getItem(STORAGE_VENUE_KEY);
      if (saved) return saved;
    } catch {
      // Ignore
    }
    return 'christmas-wonderland';
  }

  setVenueId(id) {
    this.venueId = id || 'philippine-arena';
    try {
      window.localStorage.setItem(STORAGE_VENUE_KEY, this.venueId);
    } catch {
      // Ignore
    }
  }

  loadCameraMode() {
    try {
      const saved = window.localStorage.getItem(STORAGE_CAMERA_KEY);
      if (saved === 'on' || saved === 'subtle' || saved === 'locked') return saved;
    } catch {
      // Ignore
    }
    return 'on';
  }

  setCameraMode(mode) {
    if (mode === 'on' || mode === 'subtle' || mode === 'locked') {
      this.cameraMode = mode;
      try {
        window.localStorage.setItem(STORAGE_CAMERA_KEY, mode);
      } catch {
        // Ignore
      }
    }
  }

  loadLatencyOffset() {
    try {
      const saved = window.localStorage.getItem(STORAGE_LATENCY_KEY);
      if (saved !== null) {
        const parsed = Number(saved);
        if (Number.isFinite(parsed)) {
          return Math.max(-150, Math.min(150, Math.round(parsed)));
        }
      }
    } catch {
      // Ignore
    }
    return 0;
  }

  setLatencyOffsetMs(ms) {
    const clamped = Math.max(-150, Math.min(150, Math.round(Number(ms) || 0)));
    this.latencyOffsetMs = clamped;
    try {
      window.localStorage.setItem(STORAGE_LATENCY_KEY, String(clamped));
    } catch {
      // Ignore
    }
  }

  setInstrument(id) {
    if (INSTRUMENTS[id]) {
      this.instrument = id;
      this.saveStringPref(STORAGE_INSTRUMENT_KEY, id);
    }
  }

  getInstrumentConfig() {
    return INSTRUMENTS[this.instrument];
  }

  setLaneCount(count) {
    if (count === 3 || count === 4 || count === 5) {
      this.laneCount = count;
    }
  }

  getLaneConfig() {
    return LANE_CONFIGS[this.laneCount] || LANE_CONFIGS[4];
  }

  getLaneIndexFromCode(code) {
    return this.getLaneConfig().codes.indexOf(code);
  }

  setDifficulty(id) {
    if (DIFFICULTIES[id]) {
      this.difficulty = id;
      this.laneCount = DIFFICULTIES[id].laneCount;
      this.saveStringPref(STORAGE_DIFFICULTY_KEY, id);
    }
  }

  getDifficultyConfig() {
    return DIFFICULTIES[this.difficulty] || DIFFICULTIES.medium;
  }

  getTimingWindows() {
    const d = this.getDifficultyConfig();
    return {
      PERFECT_MS: d.perfectWindowMs || TIMING_WINDOWS.PERFECT_MS,
      GOOD_MS: d.goodWindowMs || TIMING_WINDOWS.GOOD_MS,
      WRONG_KEY_WINDOW_MS: d.wrongKeyWindowMs || TIMING_WINDOWS.WRONG_KEY_WINDOW_MS,
    };
  }

  /* ========================================================================
     Multi-Song Tour Setlist Builder & Automatic Final Encore Progression
     ======================================================================== */

  addToSetlist(track) {
    if (!track) return;
    if (this.setlistQueue.length >= 10) return;
    this.setlistQueue.push(track);
  }

  removeFromSetlist(index) {
    if (index < 0 || index >= this.setlistQueue.length) return;
    this.setlistQueue.splice(index, 1);
  }

  moveSetlistItem(index, delta) {
    const next = index + delta;
    if (index < 0 || index >= this.setlistQueue.length) return;
    if (next < 0 || next >= this.setlistQueue.length) return;
    const item = this.setlistQueue[index];
    this.setlistQueue[index] = this.setlistQueue[next];
    this.setlistQueue[next] = item;
  }

  clearSetlist() {
    this.setlistQueue = [];
    this.endTour();
  }

  startTour() {
    if (this.setlistQueue.length < 2) return null;
    this.tourActive = true;
    this.tourIndex = 0;
    this.tourResults = [];
    this.isEncorePerformance = false;
    return this.setlistQueue[0];
  }

  endTour() {
    this.tourActive = false;
    this.tourIndex = 0;
    this.isEncorePerformance = false;
  }

  isTourFinalEncore(index = this.tourIndex) {
    return this.tourActive && this.setlistQueue.length >= 2 && index === this.setlistQueue.length - 1;
  }

  hasNextTourSong() {
    return this.tourActive && this.tourIndex + 1 < this.setlistQueue.length;
  }

  getNextTourSong() {
    if (!this.hasNextTourSong()) return null;
    return this.setlistQueue[this.tourIndex + 1];
  }

  advanceTourSong() {
    if (!this.hasNextTourSong()) return null;
    this.tourIndex += 1;
    this.isEncorePerformance = this.isTourFinalEncore(this.tourIndex);
    return this.setlistQueue[this.tourIndex];
  }

  recordTourSongResult(track, summary) {
    if (!this.tourActive) return;
    this.tourResults.push({
      songNumber: this.tourIndex + 1,
      title: track?.title || 'Live Song',
      artist: track?.artist || '',
      isEncore: this.isTourFinalEncore(this.tourIndex),
      score: summary.score,
      accuracy: summary.accuracy,
      maxCombo: summary.maxCombo,
      grade: summary.grade,
      perfect: summary.perfect,
      miss: summary.miss,
    });
  }

  getTourSummary() {
    const count = this.tourResults.length;
    if (count === 0) {
      return {
        songs: [],
        totalScore: 0,
        avgAccuracy: 0,
        bestCombo: 0,
        overallGrade: '—',
      };
    }
    let totalScore = 0;
    let accSum = 0;
    let bestCombo = 0;
    let totalMiss = 0;
    let totalNotes = 0;
    for (let i = 0; i < count; i += 1) {
      const r = this.tourResults[i];
      totalScore += r.score;
      accSum += r.accuracy;
      if (r.maxCombo > bestCombo) bestCombo = r.maxCombo;
      totalMiss += r.miss;
      totalNotes += r.perfect + r.miss;
    }
    const avgAccuracy = accSum / count;
    let overallGrade = 'D';
    if (avgAccuracy >= 93 && totalMiss <= Math.max(5, Math.floor(totalNotes * 0.04))) overallGrade = 'S';
    else if (avgAccuracy >= 85) overallGrade = 'A';
    else if (avgAccuracy >= 74) overallGrade = 'B';
    else if (avgAccuracy >= 60) overallGrade = 'C';

    return {
      songs: [...this.tourResults],
      totalScore,
      avgAccuracy,
      bestCombo,
      overallGrade,
    };
  }

  /* ========================================================================
     Screen, Track, Practice Loop & Gameplay Scoring
     ======================================================================== */

  setScreen(screen) {
    this.screen = screen;
  }

  setTrack(track) {
    this.currentTrack = track;
  }

  setSfxMuted(muted) {
    this.sfxMuted = Boolean(muted);
  }

  setPlaybackRate(rate) {
    this.playbackRate = Math.max(0.5, Math.min(1.15, Number(rate) || 1.0));
  }

  setPracticeLoopEnabled(enabled) {
    this.practiceLoop.enabled = Boolean(enabled);
  }

  setLoopStart(sec) {
    const t = Math.max(0, Number(sec) || 0);
    this.practiceLoop.startSec = t;
    if (this.practiceLoop.endSec !== null && this.practiceLoop.endSec <= t + 1.0) {
      this.practiceLoop.endSec = null;
    }
  }

  setLoopEnd(sec) {
    const t = Math.max(1.0, Number(sec) || 1.0);
    if (this.practiceLoop.startSec === null) {
      this.practiceLoop.startSec = Math.max(0, t - 8);
    }
    if (t > this.practiceLoop.startSec + 1.0) {
      this.practiceLoop.endSec = t;
      this.practiceLoop.enabled = true;
    }
  }

  clearPracticeLoop() {
    this.practiceLoop.enabled = false;
    this.practiceLoop.startSec = null;
    this.practiceLoop.endSec = null;
  }

  hasValidPracticeLoop() {
    return (
      this.practiceLoop.enabled &&
      this.practiceLoop.startSec !== null &&
      this.practiceLoop.endSec !== null &&
      this.practiceLoop.endSec > this.practiceLoop.startSec + 1.0
    );
  }

  resetRun({ keepPracticeLoop = false, playbackRate = this.playbackRate, isEncore = false, totalChartNotes = 120 } = {}) {
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.baseMultiplier = 1;
    this.perfectCount = 0;
    this.earlyCount = 0;
    this.lateCount = 0;
    this.missCount = 0;
    this.consecutiveMisses = 0;
    this.hazardsDodged = 0;
    this.hazardsHit = 0;
    this.totalChartNotes = Math.max(24, Number(totalChartNotes) || 120);

    this.feverCharge = isEncore ? 50 : 0;
    this.feverActive = false;
    this.whammyActive = false;

    this.crowdHype = isEncore ? 78 : 58;
    this.failedOut = false;
    this.stemDropped = false;

    this.stereoWidthTier = 0;
    this.encoreSpeedUnlocked = false;
    this.playbackRate = Math.max(0.5, Math.min(1.15, Number(playbackRate) || 1.0));
    this.isEncorePerformance = Boolean(isEncore);
    this.fcPaceMilestonesHit = { 50: false, 75: false };

    if (!keepPracticeLoop) {
      this.clearPracticeLoop();
    }
  }

  getEffectiveMultiplier() {
    return this.feverActive ? this.baseMultiplier * 2 : this.baseMultiplier;
  }

  computeBaseMultiplier(combo) {
    if (combo >= 30) return 4;
    if (combo >= 20) return 3;
    if (combo >= 10) return 2;
    return 1;
  }

  computeStereoTier(combo) {
    if (combo >= 100) return 3;
    if (combo >= 50) return 2;
    if (combo >= 30) return 1;
    return 0;
  }

  canActivateFever() {
    return !this.feverActive && this.feverCharge >= 50;
  }

  activateFever() {
    if (!this.canActivateFever()) return false;
    this.feverActive = true;
    this.crowdHype = Math.min(100, this.crowdHype + 12);
    return true;
  }

  updateFever(dt) {
    if (!this.feverActive) return false;
    this.feverCharge = Math.max(0, this.feverCharge - dt * 11.5);
    if (this.feverCharge <= 0) {
      this.feverActive = false;
      this.feverCharge = 0;
      return true;
    }
    return false;
  }

  /**
   * Computes dynamic 1★–5★ live progress + 5 Gold Stars on Hard/Expert (95%+ accuracy & 5★ threshold).
   */
  getStarState() {
    const fiveStarThreshold = Math.max(4500, this.totalChartNotes * 220);
    const goldThreshold = fiveStarThreshold * 1.16;
    const rawProgress = (this.score / fiveStarThreshold) * 5;
    const progress = Math.max(0, Math.min(5, rawProgress));
    const stars = Math.min(5, Math.floor(progress + 0.0001));
    const acc = this.getAccuracy();
    const isGoldStars =
      (this.difficulty === 'hard' || this.difficulty === 'expert') &&
      this.score >= goldThreshold &&
      acc >= 95 &&
      !this.failedOut;

    return {
      stars,
      progress,
      isGoldStars,
      nextStarFraction: stars >= 5 ? 1 : progress - stars,
    };
  }

  registerHit(deltaMs, isFeverNote = false) {
    const absMs = Math.abs(deltaMs);
    const prevBase = this.baseMultiplier;
    const diff = this.getDifficultyConfig();
    const windows = this.getTimingWindows();

    this.combo += 1;
    this.consecutiveMisses = 0;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    this.baseMultiplier = this.computeBaseMultiplier(this.combo);
    const mult = this.getEffectiveMultiplier();

    let judgement = 'PERFECT!';
    let basePoints = 100;

    if (absMs <= windows.PERFECT_MS) {
      judgement = 'PERFECT!';
      basePoints = 100;
      this.perfectCount += 1;
    } else if (deltaMs > 0) {
      judgement = 'EARLY';
      basePoints = 50;
      this.earlyCount += 1;
    } else {
      judgement = 'LATE';
      basePoints = 50;
      this.lateCount += 1;
    }

    const speedBonus = this.playbackRate >= 1.09 ? 1.15 : 1.0;
    const encoreBonus = this.isEncorePerformance ? 1.1 : 1.0;
    const points = Math.round(basePoints * mult * speedBonus * encoreBonus);
    this.score += points;

    const hypeBoost = judgement === 'PERFECT!' ? diff.hypeGainOnHit * 1.25 : diff.hypeGainOnHit;
    this.crowdHype = Math.min(100, this.crowdHype + hypeBoost * (this.feverActive ? 1.4 : 1));

    if (!this.feverActive) {
      if (isFeverNote) {
        this.feverCharge = Math.min(100, this.feverCharge + 17);
      } else if (judgement === 'PERFECT!' && this.combo >= 10) {
        this.feverCharge = Math.min(100, this.feverCharge + 1.8);
      }
    }

    const hitCheerMilestone = CHEER_MILESTONES.includes(this.combo) ? this.combo : 0;
    const hitPyroMilestone = PYRO_MILESTONES.includes(this.combo) ? this.combo : 0;
    const hitStreakBanner = this.combo > 0 && this.combo % 50 === 0 ? this.combo : 0;
    const newStereoTier = this.computeStereoTier(this.combo);
    const stereoTierChanged = newStereoTier !== this.stereoWidthTier;
    this.stereoWidthTier = newStereoTier;

    if (this.combo >= 30) {
      this.encoreSpeedUnlocked = true;
    }

    const stemRestored = this.stemDropped;
    this.stemDropped = false;

    return {
      judgement,
      points,
      multiplierUp: this.baseMultiplier > prevBase,
      effectiveMultiplier: mult,
      stemRestored,
      hitCheerMilestone,
      hitPyroMilestone,
      hitStreakBanner,
      stereoTierChanged,
      stereoTier: this.stereoWidthTier,
    };
  }

  registerSustainTick(dt, whammyActive = false) {
    const rate = whammyActive ? 210 : 140;
    const points = Math.round(dt * rate * this.getEffectiveMultiplier());
    if (points > 0) this.score += points;
    this.crowdHype = Math.min(100, this.crowdHype + dt * (whammyActive ? 3.8 : 2.2));

    if (whammyActive && !this.feverActive) {
      this.feverCharge = Math.min(100, this.feverCharge + dt * 24);
    }
  }

  registerMiss() {
    const diff = this.getDifficultyConfig();
    const brokeStreak = this.combo >= 8;
    const prevStereo = this.stereoWidthTier;

    this.combo = 0;
    this.baseMultiplier = 1;
    this.stereoWidthTier = 0;
    this.missCount += 1;
    this.consecutiveMisses += 1;
    this.stemDropped = true;

    if (!this.hasValidPracticeLoop()) {
      this.crowdHype = Math.max(0, this.crowdHype - diff.hypeDrainOnMiss);
      if (diff.allowFailOut && this.crowdHype <= 0) {
        this.failedOut = true;
      }
    }

    return {
      judgement: 'MISS',
      brokeStreak,
      failedOut: this.failedOut,
      stereoReset: prevStereo > 0,
      crowdHype: this.crowdHype,
      consecutiveMisses: this.consecutiveMisses,
    };
  }

  registerHazardHit() {
    const diff = this.getDifficultyConfig();
    const brokeStreak = this.combo >= 4;
    const prevStereo = this.stereoWidthTier;

    this.combo = 0;
    this.baseMultiplier = 1;
    this.stereoWidthTier = 0;
    this.hazardsHit += 1;
    this.missCount += 1;
    this.consecutiveMisses += 2;
    this.stemDropped = true;
    this.feverCharge = Math.max(0, this.feverCharge - 18);

    if (!this.hasValidPracticeLoop()) {
      this.crowdHype = Math.max(0, this.crowdHype - diff.hypeDrainOnMiss * 1.8);
      if (diff.allowFailOut && this.crowdHype <= 0) {
        this.failedOut = true;
      }
    }

    return {
      judgement: 'PANGGULO HIT!',
      brokeStreak,
      failedOut: this.failedOut,
      stereoReset: prevStereo > 0,
      crowdHype: this.crowdHype,
      consecutiveMisses: this.consecutiveMisses,
    };
  }

  registerHazardDodged() {
    this.hazardsDodged += 1;
    const bonus = Math.round(75 * this.getEffectiveMultiplier());
    this.score += bonus;
    this.crowdHype = Math.min(100, this.crowdHype + 1.5);
    return {
      judgement: 'DODGED!',
      bonus,
      crowdHype: this.crowdHype,
    };
  }

  getAccuracy() {
    const total = this.perfectCount + this.earlyCount + this.lateCount + this.missCount;
    if (total === 0) return 100;
    const weighted = this.perfectCount + (this.earlyCount + this.lateCount) * 0.65;
    return (weighted / total) * 100;
  }

  getGrade() {
    if (this.failedOut) return 'D';
    const total = this.perfectCount + this.earlyCount + this.lateCount + this.missCount;
    if (total === 0) return '—';
    const acc = this.getAccuracy();
    if (acc >= 94 && this.missCount <= Math.max(3, Math.floor(total * 0.03))) return 'S';
    if (acc >= 86) return 'A';
    if (acc >= 74) return 'B';
    if (acc >= 60) return 'C';
    return 'D';
  }

  getSummary() {
    const starState = this.getStarState();
    return {
      score: this.score,
      combo: this.combo,
      maxCombo: this.maxCombo,
      multiplier: this.getEffectiveMultiplier(),
      perfect: this.perfectCount,
      early: this.earlyCount,
      late: this.lateCount,
      miss: this.missCount,
      accuracy: this.getAccuracy(),
      grade: this.getGrade(),
      stars: starState.stars,
      isGoldStars: starState.isGoldStars,
      crowdHype: this.crowdHype,
      failedOut: this.failedOut,
      encoreSpeedUnlocked: this.encoreSpeedUnlocked || this.getAccuracy() >= 80,
      playbackRate: this.playbackRate,
      isEncorePerformance: this.isEncorePerformance,
    };
  }
}

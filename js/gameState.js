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
const STORAGE_VENUE_OVERLAY_KEY = 'encore_stage_venue_overlay_id';
const STORAGE_CAMERA_KEY = 'encore_stage_camera_mode';
const STORAGE_CROWD_VOL_KEY = 'encore_stage_crowd_vol';
const STORAGE_SFX_VOL_KEY = 'encore_stage_sfx_vol';
const STORAGE_BAND_LINEUP_KEY = 'encore_stage_band_lineup_id';
const STORAGE_HIGHWAY_SKIN_KEY = 'encore_stage_highway_skin_id';
const STORAGE_GUITAR_MODEL_KEY = 'encore_stage_guitar_model_id';
const STORAGE_BASS_MODEL_KEY = 'encore_stage_bass_model_id';
const STORAGE_DRUM_KIT_KEY = 'encore_stage_drum_kit_id';
const STORAGE_KEYBOARD_MODEL_KEY = 'encore_stage_keyboard_model_id';
const STORAGE_STAR_LOOK_KEY = 'encore_stage_star_look_id';
const STORAGE_INSTRUMENT_SKIN_KEY = 'encore_stage_instrument_skin_id';
const STORAGE_INSTRUMENT_SKINS_MAP_KEY = 'encore_stage_instrument_skins_map';
const STORAGE_DIFFICULTY_KEY = 'encore_stage_difficulty_id';
const STORAGE_INSTRUMENT_KEY = 'encore_stage_instrument_id';
const STORAGE_MORALE_SHIELD_KEY = 'encore_stage_morale_shield';
const STORAGE_PLAY_MODE_KEY = 'encore_stage_play_mode';
const STORAGE_P2_INSTRUMENT_KEY = 'encore_stage_p2_instrument_id';
const STORAGE_P2_DIFFICULTY_KEY = 'encore_stage_p2_difficulty_id';

export const SCREENS = {
  MAIN_MENU: 'MAIN_MENU',
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
    perfectEarlyMs: 32,
    perfectLateMs: 32,
    greatEarlyMs: 58,
    greatLateMs: 58,
    goodEarlyMs: 85,
    goodLateMs: 85,
    wrongKeyWindowMs: 115,
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
    allowFailOut: false,
    perfectEarlyMs: 32,
    perfectLateMs: 32,
    greatEarlyMs: 58,
    greatLateMs: 58,
    goodEarlyMs: 85,
    goodLateMs: 85,
    wrongKeyWindowMs: 115,
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
    allowFailOut: false,
    perfectEarlyMs: 26,
    perfectLateMs: 26,
    greatEarlyMs: 48,
    greatLateMs: 48,
    goodEarlyMs: 70,
    goodLateMs: 70,
    wrongKeyWindowMs: 100,
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
    allowFailOut: false,
    perfectEarlyMs: 26,
    perfectLateMs: 26,
    greatEarlyMs: 48,
    greatLateMs: 48,
    goodEarlyMs: 70,
    goodLateMs: 70,
    wrongKeyWindowMs: 100,
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
  PERFECT_EARLY_MS: 26,
  PERFECT_LATE_MS: 26,
  GREAT_EARLY_MS: 48,
  GREAT_LATE_MS: 48,
  GOOD_EARLY_MS: 70,
  GOOD_LATE_MS: 70,
  PERFECT_MS: 26,
  GREAT_MS: 48,
  GOOD_MS: 70,
  WRONG_KEY_WINDOW_MS: 100,
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
    const initialVenuePair = this.loadVenueAndOverlay();
    this.venueId = initialVenuePair.venueId;
    this.venueOverlayId = initialVenuePair.overlayId;
    this.cameraMode = this.loadCameraMode();
    this.crowdVolume = this.loadCrowdVolume();
    this.sfxVolume = this.loadSfxVolume();

    // Backstage Band Lineup, Highway Skin & 3D Gear Customizer state
    this.bandLineupId = this.loadStringPref(STORAGE_BAND_LINEUP_KEY, 'arena-4piece');
    this.highwaySkinId = this.loadStringPref(STORAGE_HIGHWAY_SKIN_KEY, 'smoked-glass');
    this.guitarModelId = this.loadStringPref(STORAGE_GUITAR_MODEL_KEY, 'les-paul-sunburst');
    this.bassModelId = this.loadStringPref(STORAGE_BASS_MODEL_KEY, 'precision-blonde');
    this.drumKitModelId = this.loadStringPref(STORAGE_DRUM_KIT_KEY, 'pop-single-kick');
    this.keyboardModelId = this.loadStringPref(STORAGE_KEYBOARD_MODEL_KEY, 'concert-grand');
    this.starLookId = this.loadStringPref(STORAGE_STAR_LOOK_KEY, 'default-band');
    this.instrumentSkinId = this.loadStringPref(STORAGE_INSTRUMENT_SKIN_KEY, 'classic-sunburst');
    this.instrumentSkins = this.loadInstrumentSkinsMap(this.instrumentSkinId);

    const savedMode = this.loadStringPref(STORAGE_PLAY_MODE_KEY, 'solo');
    this.playMode = savedMode === 'coop' || savedMode === 'faceoff' ? savedMode : 'solo';
    const savedP2Inst = this.loadStringPref(STORAGE_P2_INSTRUMENT_KEY, 'bass');
    this.p2Instrument = INSTRUMENTS[savedP2Inst] ? savedP2Inst : 'bass';
    const savedP2Diff = this.loadStringPref(STORAGE_P2_DIFFICULTY_KEY, 'medium');
    this.p2Difficulty = DIFFICULTIES[savedP2Diff] ? savedP2Diff : 'medium';
    this.p2LaneCount = DIFFICULTIES[this.p2Difficulty].laneCount;

    this.playbackRate = 1.0;
    this.moraleShield = this.loadBoolPref(STORAGE_MORALE_SHIELD_KEY, false);
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

  loadBoolPref(key, fallback = false) {
    try {
      const saved = window.localStorage.getItem(key);
      if (saved === 'true') return true;
      if (saved === 'false') return false;
    } catch {
      // Ignore storage errors
    }
    return fallback;
  }

  setMoraleShield(enabled) {
    this.moraleShield = Boolean(enabled);
    if (this.moraleShield) {
      this.stemDropped = false;
    }
    this.saveStringPref(STORAGE_MORALE_SHIELD_KEY, this.moraleShield ? 'true' : 'false');
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

  setInstrumentSkinId(id, targetRole = 'all') {
    const next = id || 'classic-sunburst';
    if (targetRole === 'all') {
      this.instrumentSkinId = next;
      this.instrumentSkins = { guitar: next, bass: next, drums: next, piano: next };
      this.saveStringPref(STORAGE_INSTRUMENT_SKIN_KEY, next);
    } else if (this.instrumentSkins && Object.prototype.hasOwnProperty.call(this.instrumentSkins, targetRole)) {
      this.instrumentSkins[targetRole] = next;
      this.instrumentSkinId = next;
      this.saveStringPref(STORAGE_INSTRUMENT_SKIN_KEY, next);
    }
    this.saveInstrumentSkinsMap();
  }

  getInstrumentSkinFor(role) {
    return this.instrumentSkins?.[role] || this.instrumentSkinId || 'classic-sunburst';
  }

  loadInstrumentSkinsMap(fallbackSkin = 'classic-sunburst') {
    const base = {
      guitar: fallbackSkin,
      bass: fallbackSkin,
      drums: fallbackSkin,
      piano: fallbackSkin,
    };
    try {
      const raw = window.localStorage.getItem(STORAGE_INSTRUMENT_SKINS_MAP_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return {
            guitar: parsed.guitar || base.guitar,
            bass: parsed.bass || base.bass,
            drums: parsed.drums || base.drums,
            piano: parsed.piano || base.piano,
          };
        }
      }
    } catch {
      // Ignore storage errors
    }
    return base;
  }

  saveInstrumentSkinsMap() {
    try {
      window.localStorage.setItem(STORAGE_INSTRUMENT_SKINS_MAP_KEY, JSON.stringify(this.instrumentSkins));
    } catch {
      // Ignore storage errors
    }
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

  loadSfxVolume() {
    try {
      const saved = window.localStorage.getItem(STORAGE_SFX_VOL_KEY);
      if (saved !== null) {
        const parsed = Number(saved);
        if (Number.isFinite(parsed)) return Math.max(0, Math.min(1, parsed));
      }
    } catch {
      // Ignore
    }
    return 0.85;
  }

  setSfxVolume(vol) {
    const clamped = Math.max(0, Math.min(1, Number(vol)));
    this.sfxVolume = Number.isFinite(clamped) ? clamped : 0.85;
    try {
      window.localStorage.setItem(STORAGE_SFX_VOL_KEY, String(this.sfxVolume));
    } catch {
      // Ignore
    }
  }

  loadVenueAndOverlay() {
    const legacyMap = {
      'christmas-wonderland': { venueId: 'philippine-arena', overlayId: 'CHRISTMAS' },
      'halloween-cathedral': { venueId: 'wembley', overlayId: 'HALLOWEEN' },
      'sakura-festival': { venueId: 'tokyo-dome', overlayId: 'SAKURA' },
      'cyber-tokyo': { venueId: 'tokyo-dome', overlayId: 'CYBER_NEON' },
      'royal-opera': { venueId: 'madison-square-garden', overlayId: 'ROYAL_OPERA' },
      'tropical-beach': { venueId: 'moa-arena', overlayId: 'TROPICAL_SUMMER' },
      'araneta-coliseum': { venueId: 'philippine-arena', overlayId: 'STANDARD' },
      'up-sunken-garden': { venueId: 'red-rocks', overlayId: 'STANDARD' },
      intramuros: { venueId: 'wembley', overlayId: 'STANDARD' },
      coachella: { venueId: 'red-rocks', overlayId: 'TROPICAL_SUMMER' },
    };
    let savedVenue = 'philippine-arena';
    let savedOverlay = null;
    try {
      const v = window.localStorage.getItem(STORAGE_VENUE_KEY);
      if (v) savedVenue = v;
      savedOverlay = window.localStorage.getItem(STORAGE_VENUE_OVERLAY_KEY);
    } catch {
      // Ignore
    }
    const migrated = legacyMap[savedVenue];
    if (migrated) {
      this.setVenueId(migrated.venueId);
      const nextOverlay = savedOverlay || migrated.overlayId;
      this.setVenueOverlayId(nextOverlay);
      return { venueId: migrated.venueId, overlayId: nextOverlay };
    }
    return {
      venueId: savedVenue || 'philippine-arena',
      overlayId: savedOverlay || 'STANDARD',
    };
  }

  loadVenueId() {
    return this.loadVenueAndOverlay().venueId;
  }

  setVenueId(id) {
    this.venueId = id || 'philippine-arena';
    try {
      window.localStorage.setItem(STORAGE_VENUE_KEY, this.venueId);
    } catch {
      // Ignore
    }
  }

  setVenueOverlayId(id) {
    this.venueOverlayId = id || 'STANDARD';
    try {
      window.localStorage.setItem(STORAGE_VENUE_OVERLAY_KEY, this.venueOverlayId);
    } catch {
      // Ignore
    }
  }

  loadCameraMode() {
    const valid = new Set([
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
    try {
      const saved = window.localStorage.getItem(STORAGE_CAMERA_KEY);
      if (valid.has(saved)) return saved;
    } catch {
      // Ignore
    }
    return 'on';
  }

  setCameraMode(mode) {
    const valid = new Set([
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
    if (valid.has(mode)) {
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

  setPlayMode(mode) {
    this.playMode = mode === 'coop' || mode === 'faceoff' ? mode : 'solo';
    this.saveStringPref(STORAGE_PLAY_MODE_KEY, this.playMode);
  }

  isTwoPlayerMode() {
    return this.playMode === 'coop' || this.playMode === 'faceoff';
  }

  setP2Instrument(id) {
    if (INSTRUMENTS[id]) {
      this.p2Instrument = id;
      this.saveStringPref(STORAGE_P2_INSTRUMENT_KEY, id);
    }
  }

  setP2Difficulty(id) {
    if (DIFFICULTIES[id]) {
      this.p2Difficulty = id;
      this.p2LaneCount = DIFFICULTIES[id].laneCount;
      this.saveStringPref(STORAGE_P2_DIFFICULTY_KEY, id);
    }
  }

  getInstrumentConfig() {
    return INSTRUMENTS[this.instrument];
  }

  getInstrumentConfigFor(player = 1) {
    if (player === 2) return INSTRUMENTS[this.p2Instrument] || INSTRUMENTS.bass;
    return this.getInstrumentConfig();
  }

  setLaneCount(count) {
    if (count === 3 || count === 4 || count === 5) {
      this.laneCount = count;
    }
  }

  getLaneConfig() {
    return this.getLaneConfigFor(1);
  }

  getLaneConfigFor(player = 1) {
    if (!this.isTwoPlayerMode()) {
      return LANE_CONFIGS[this.laneCount] || LANE_CONFIGS[4];
    }
    const count = player === 2 ? (this.p2LaneCount || 4) : (this.laneCount || 4);
    const baseCfg = LANE_CONFIGS[count] || LANE_CONFIGS[4];
    if (player === 1) {
      const p1Keys = ['A', 'S', 'D', 'F', 'G'].slice(0, count);
      const p1Codes = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG'].slice(0, count);
      const p1AltCodes = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].slice(0, count);
      return {
        ...baseCfg,
        keys: p1Keys,
        codes: p1Codes,
        altCodes: p1AltCodes,
      };
    }
    const p2Keys = ['H', 'J', 'K', 'L', ';'].slice(0, count);
    const p2Codes = ['KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon'].slice(0, count);
    const p2AltCodes = ['ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowRight', 'Enter'].slice(0, count);
    return {
      ...baseCfg,
      keys: p2Keys,
      codes: p2Codes,
      altCodes: p2AltCodes,
    };
  }

  getLaneIndexFromCode(code) {
    const cfg = this.getLaneConfigFor(1);
    const idx = cfg.codes.indexOf(code);
    if (idx >= 0) return idx;
    return cfg.altCodes ? cfg.altCodes.indexOf(code) : -1;
  }

  getPlayerAndLaneFromCode(code) {
    if (!this.isTwoPlayerMode()) {
      const idx = (LANE_CONFIGS[this.laneCount] || LANE_CONFIGS[4]).codes.indexOf(code);
      return idx >= 0 ? { player: 1, lane: idx } : null;
    }
    const p1Cfg = this.getLaneConfigFor(1);
    let idx = p1Cfg.codes.indexOf(code);
    if (idx < 0 && p1Cfg.altCodes) idx = p1Cfg.altCodes.indexOf(code);
    if (idx >= 0) return { player: 1, lane: idx };

    const p2Cfg = this.getLaneConfigFor(2);
    idx = p2Cfg.codes.indexOf(code);
    if (idx < 0 && p2Cfg.altCodes) idx = p2Cfg.altCodes.indexOf(code);
    if (idx >= 0) return { player: 2, lane: idx };
    return null;
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

  getDifficultyConfigFor(player = 1) {
    if (player === 2) return DIFFICULTIES[this.p2Difficulty] || DIFFICULTIES.medium;
    return this.getDifficultyConfig();
  }

  getTimingWindows(player = 1) {
    const d = this.getDifficultyConfigFor(player);
    const perfectEarly = d.perfectEarlyMs ?? TIMING_WINDOWS.PERFECT_EARLY_MS;
    const perfectLate = d.perfectLateMs ?? TIMING_WINDOWS.PERFECT_LATE_MS;
    const greatEarly = d.greatEarlyMs ?? TIMING_WINDOWS.GREAT_EARLY_MS;
    const greatLate = d.greatLateMs ?? TIMING_WINDOWS.GREAT_LATE_MS;
    const goodEarly = d.goodEarlyMs ?? TIMING_WINDOWS.GOOD_EARLY_MS;
    const goodLate = d.goodLateMs ?? TIMING_WINDOWS.GOOD_LATE_MS;
    return {
      PERFECT_EARLY_MS: perfectEarly,
      PERFECT_LATE_MS: perfectLate,
      GREAT_EARLY_MS: greatEarly,
      GREAT_LATE_MS: greatLate,
      GOOD_EARLY_MS: goodEarly,
      GOOD_LATE_MS: goodLate,
      PERFECT_MS: perfectLate,
      GREAT_MS: greatLate,
      GOOD_MS: goodLate,
      WRONG_KEY_WINDOW_MS: d.wrongKeyWindowMs ?? TIMING_WINDOWS.WRONG_KEY_WINDOW_MS,
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

  isFinalTourSong(index = this.tourIndex) {
    return this.isTourFinalEncore(index);
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

  resetRun({
    keepPracticeLoop = false,
    playbackRate = this.playbackRate,
    isEncore = false,
    totalChartNotes = 120,
    totalChartNotesP2 = 120,
  } = {}) {
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.baseMultiplier = 1;
    this.perfectCount = 0;
    this.greatCount = 0;
    this.goodCount = 0;
    this.earlyCount = 0;
    this.lateCount = 0;
    this.missCount = 0;
    this.deltaMsSum = 0;
    this.hitJudgedCount = 0;
    this.consecutiveMisses = 0;
    this.hazardsDodged = 0;
    this.hazardsHit = 0;
    this.totalChartNotes = Math.max(24, Number(totalChartNotes) || 120);
    this._sustainPtsCarry = 0;
    this.sectionBonusesEarned = 0;
    this.sectionBonusTotal = 0;

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

    // Big Rock Ending (BRE) Freestyle Finale state
    this.breActive = false;
    this.breCompleted = false;
    this.breHits = 0;
    this.breBonusPoints = 0;

    // Player 2 independent stats for 2P Band Co-Op & 2P Pro Face-Off
    this.p2 = {
      score: 0,
      combo: 0,
      maxCombo: 0,
      baseMultiplier: 1,
      perfectCount: 0,
      greatCount: 0,
      goodCount: 0,
      earlyCount: 0,
      lateCount: 0,
      missCount: 0,
      deltaMsSum: 0,
      hitJudgedCount: 0,
      consecutiveMisses: 0,
      hazardsDodged: 0,
      hazardsHit: 0,
      totalChartNotes: Math.max(24, Number(totalChartNotesP2) || 120),
      _sustainPtsCarry: 0,
      feverCharge: isEncore ? 50 : 0,
      feverActive: false,
      whammyActive: false,
      stemDropped: false,
      breHits: 0,
      breBonusPoints: 0,
      sectionBonusesEarned: 0,
      sectionBonusTotal: 0,
    };

    if (!keepPracticeLoop) {
      this.clearPracticeLoop();
    }
  }

  registerBreHit() {
    return this.registerPlayerBreHit(1);
  }

  registerPlayerBreHit(player = 1) {
    const mult = this.getEffectiveMultiplierFor(player);
    const pts = Math.round(150 * Math.max(1, mult * 0.5));
    if (player === 2) {
      this.p2.breHits += 1;
      this.p2.breBonusPoints += pts;
      this.p2.score += pts;
      this.crowdHype = Math.min(100, this.crowdHype + 1.0);
      return {
        points: pts,
        totalBreBonus: this.p2.breBonusPoints,
        hits: this.p2.breHits,
      };
    }
    this.breHits += 1;
    this.breBonusPoints += pts;
    this.score += pts;
    this.crowdHype = Math.min(100, this.crowdHype + 1.2);
    return {
      points: pts,
      totalBreBonus: this.breBonusPoints,
      hits: this.breHits,
    };
  }

  getEffectiveMultiplier() {
    return this.feverActive ? this.baseMultiplier * 2 : this.baseMultiplier;
  }

  getEffectiveMultiplierFor(player = 1) {
    if (player === 2) {
      return this.p2.feverActive ? this.p2.baseMultiplier * 2 : this.p2.baseMultiplier;
    }
    return this.getEffectiveMultiplier();
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
    return this.canActivateFeverFor(1);
  }

  canActivateFeverFor(player = 1) {
    if (player === 2) {
      return !this.p2.feverActive && this.p2.feverCharge >= 50;
    }
    return !this.feverActive && this.feverCharge >= 50;
  }

  activateFever() {
    return this.activateFeverFor(1);
  }

  activateFeverFor(player = 1) {
    if (!this.canActivateFeverFor(player)) return false;
    if (player === 2) {
      this.p2.feverActive = true;
    } else {
      this.feverActive = true;
    }
    this.crowdHype = Math.min(100, this.crowdHype + 12);
    return true;
  }

  updateFever(dt) {
    let anyEnded = false;
    if (this.feverActive) {
      this.feverCharge = Math.max(0, this.feverCharge - dt * 11.5);
      if (this.feverCharge <= 0) {
        this.feverActive = false;
        this.feverCharge = 0;
        anyEnded = true;
      }
    }
    if (this.p2.feverActive) {
      this.p2.feverCharge = Math.max(0, this.p2.feverCharge - dt * 11.5);
      if (this.p2.feverCharge <= 0) {
        this.p2.feverActive = false;
        this.p2.feverCharge = 0;
        anyEnded = true;
      }
    }
    return anyEnded;
  }

  getCombinedBandScore() {
    return this.isTwoPlayerMode() ? this.score + this.p2.score : this.score;
  }

  getFaceOffDelta() {
    return this.score - this.p2.score;
  }

  getFaceOffWinner() {
    if (this.score > this.p2.score) return 'P1';
    if (this.p2.score > this.score) return 'P2';
    return 'TIE';
  }

  /**
   * Computes dynamic 1★–5★ live progress + 5 Gold Stars on Hard/Expert (95%+ accuracy & 5★ threshold).
   */
  getStarState(player = 1) {
    const isP2 = player === 2;
    const score = isP2 ? this.p2.score : this.score;
    const totalNotes = isP2 ? this.p2.totalChartNotes : this.totalChartNotes;
    const diffId = isP2 ? this.p2Difficulty : this.difficulty;
    const fiveStarThreshold = Math.max(4500, totalNotes * 220);
    const goldThreshold = fiveStarThreshold * 1.16;
    const rawProgress = (score / fiveStarThreshold) * 5;
    const progress = Math.max(0, Math.min(5, rawProgress));
    const stars = Math.min(5, Math.floor(progress + 0.0001));
    const acc = this.getAccuracyFor(player);
    const isGoldStars =
      (diffId === 'hard' || diffId === 'expert') &&
      score >= goldThreshold &&
      acc >= 95 &&
      !this.failedOut;

    return {
      stars,
      progress,
      isGoldStars,
      nextStarFraction: stars >= 5 ? 1 : progress - stars,
    };
  }

  registerPlayerHit(player = 1, deltaMs = 0, isFeverNote = false) {
    if (player === 2) {
      return this._registerP2Hit(deltaMs, isFeverNote);
    }
    return this.registerHit(deltaMs, isFeverNote);
  }

  registerHit(deltaMs, isFeverNote = false) {
    // Convention: deltaMs = (hitTimeSec - songTime) * 1000
    // deltaMs > 0 => EARLY; deltaMs < 0 => LATE
    const isEarly = deltaMs > 0;
    const absMs = Math.abs(deltaMs);
    const prevBase = this.baseMultiplier;
    const diff = this.getDifficultyConfig();
    const windows = this.getTimingWindows(1);

    const perfectLimit = isEarly ? windows.PERFECT_EARLY_MS : windows.PERFECT_LATE_MS;
    const greatLimit = isEarly ? windows.GREAT_EARLY_MS : windows.GREAT_LATE_MS;

    this.combo += 1;
    this.consecutiveMisses = 0;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    this.baseMultiplier = this.computeBaseMultiplier(this.combo);
    const mult = this.getEffectiveMultiplier();

    this.deltaMsSum += deltaMs;
    this.hitJudgedCount += 1;

    let judgement = 'PERFECT!';
    let basePoints = 100;

    if (absMs <= perfectLimit) {
      judgement = 'PERFECT!';
      basePoints = 100;
      this.perfectCount += 1;
    } else if (absMs <= greatLimit) {
      judgement = 'GREAT!';
      basePoints = 75;
      this.greatCount += 1;
      if (deltaMs > 0) this.earlyCount += 1;
      else this.lateCount += 1;
    } else {
      judgement = 'GOOD';
      basePoints = 50;
      this.goodCount += 1;
      if (deltaMs > 0) this.earlyCount += 1;
      else this.lateCount += 1;
    }

    const speedBonus = this.playbackRate >= 1.09 ? 1.15 : 1.0;
    const encoreBonus = this.isEncorePerformance ? 1.1 : 1.0;
    const points = Math.round(basePoints * mult * speedBonus * encoreBonus);
    this.score += points;

    const hypeBoost =
      judgement === 'PERFECT!'
        ? diff.hypeGainOnHit * 1.25
        : judgement === 'GREAT!'
          ? diff.hypeGainOnHit * 1.08
          : diff.hypeGainOnHit;
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

  _registerP2Hit(deltaMs, isFeverNote = false) {
    const p2 = this.p2;
    const isEarly = deltaMs > 0;
    const absMs = Math.abs(deltaMs);
    const prevBase = p2.baseMultiplier;
    const diff = this.getDifficultyConfigFor(2);
    const windows = this.getTimingWindows(2);

    const perfectLimit = isEarly ? windows.PERFECT_EARLY_MS : windows.PERFECT_LATE_MS;
    const greatLimit = isEarly ? windows.GREAT_EARLY_MS : windows.GREAT_LATE_MS;

    p2.combo += 1;
    p2.consecutiveMisses = 0;
    if (p2.combo > p2.maxCombo) p2.maxCombo = p2.combo;
    p2.baseMultiplier = this.computeBaseMultiplier(p2.combo);
    const mult = this.getEffectiveMultiplierFor(2);

    p2.deltaMsSum += deltaMs;
    p2.hitJudgedCount += 1;

    let judgement = 'PERFECT!';
    let basePoints = 100;
    if (absMs <= perfectLimit) {
      judgement = 'PERFECT!';
      basePoints = 100;
      p2.perfectCount += 1;
    } else if (absMs <= greatLimit) {
      judgement = 'GREAT!';
      basePoints = 75;
      p2.greatCount += 1;
      if (deltaMs > 0) p2.earlyCount += 1;
      else p2.lateCount += 1;
    } else {
      judgement = 'GOOD';
      basePoints = 50;
      p2.goodCount += 1;
      if (deltaMs > 0) p2.earlyCount += 1;
      else p2.lateCount += 1;
    }

    const speedBonus = this.playbackRate >= 1.09 ? 1.15 : 1.0;
    const encoreBonus = this.isEncorePerformance ? 1.1 : 1.0;
    const points = Math.round(basePoints * mult * speedBonus * encoreBonus);
    p2.score += points;

    const hypeBoost =
      judgement === 'PERFECT!'
        ? diff.hypeGainOnHit * 0.85
        : diff.hypeGainOnHit * 0.65;
    this.crowdHype = Math.min(100, this.crowdHype + hypeBoost * (p2.feverActive ? 1.35 : 1));

    if (!p2.feverActive) {
      if (isFeverNote) {
        p2.feverCharge = Math.min(100, p2.feverCharge + 17);
      } else if (judgement === 'PERFECT!' && p2.combo >= 10) {
        p2.feverCharge = Math.min(100, p2.feverCharge + 1.8);
      }
    }

    const stemRestored = p2.stemDropped;
    p2.stemDropped = false;
    return {
      judgement,
      points,
      multiplierUp: p2.baseMultiplier > prevBase,
      effectiveMultiplier: mult,
      stemRestored,
      hitCheerMilestone: CHEER_MILESTONES.includes(p2.combo) ? p2.combo : 0,
      hitPyroMilestone: PYRO_MILESTONES.includes(p2.combo) ? p2.combo : 0,
      hitStreakBanner: p2.combo > 0 && p2.combo % 50 === 0 ? p2.combo : 0,
      stereoTierChanged: false,
      stereoTier: this.stereoWidthTier,
    };
  }

  registerSustainTick(dt, whammyActive = false, bpm = 120) {
    this.registerPlayerSustainTick(1, dt, whammyActive, bpm);
  }

  registerPlayerSustainTick(player = 1, dt = 0, whammyActive = false, bpm = 120) {
    const safeBpm = Math.max(40, Number(bpm) || 120);
    const beatsDelta = (Math.max(0, dt) * safeBpm) / 60;
    const ratePerBeat = whammyActive ? 40 : 25;
    if (player === 2) {
      const p2 = this.p2;
      p2._sustainPtsCarry += beatsDelta * ratePerBeat * this.getEffectiveMultiplierFor(2);
      const points = Math.floor(p2._sustainPtsCarry);
      if (points > 0) {
        p2._sustainPtsCarry -= points;
        p2.score += points;
      }
      this.crowdHype = Math.min(100, this.crowdHype + dt * (whammyActive ? 2.4 : 1.4));
      if (whammyActive && !p2.feverActive) {
        p2.feverCharge = Math.min(100, p2.feverCharge + dt * 24);
      }
      return;
    }

    this._sustainPtsCarry += beatsDelta * ratePerBeat * this.getEffectiveMultiplier();
    const points = Math.floor(this._sustainPtsCarry);
    if (points > 0) {
      this._sustainPtsCarry -= points;
      this.score += points;
    }
    this.crowdHype = Math.min(100, this.crowdHype + dt * (whammyActive ? 3.8 : 2.2));

    if (whammyActive && !this.feverActive) {
      this.feverCharge = Math.min(100, this.feverCharge + dt * 24);
    }
  }

  completeSection({ label = 'Section', hits = 0, misses = 0 } = {}, player = 1) {
    if (hits <= 0) return null;
    const total = Math.max(1, hits + misses);
    const acc = hits / total;
    const densityBoost = Math.min(1000, Math.round((hits / 12) * 1000));
    const bonus = Math.min(5000, Math.max(1000, Math.round(1000 + acc * 3000 + densityBoost)));
    if (player === 2) {
      this.p2.score += bonus;
      this.p2.sectionBonusesEarned += 1;
      this.p2.sectionBonusTotal += bonus;
    } else {
      this.score += bonus;
      this.sectionBonusesEarned += 1;
      this.sectionBonusTotal += bonus;
    }
    return {
      bonus,
      label,
      accuracy: acc,
    };
  }

  registerPlayerMiss(player = 1, opts = {}) {
    if (player === 2) {
      return this._registerP2Miss(opts);
    }
    return this.registerMiss(opts);
  }

  registerMiss({ isWrongKey = false } = {}) {
    const diff = this.getDifficultyConfig();
    const prevStereo = this.stereoWidthTier;
    const prevHype = this.crowdHype;
    this.failedOut = false;

    if (this.moraleShield) {
      this.stemDropped = false;
      const brokeStreak = !isWrongKey && this.combo >= 8;
      if (!isWrongKey) {
        this.combo = 0;
        this.baseMultiplier = 1;
        this.stereoWidthTier = 0;
        this.missCount += 1;
        this.consecutiveMisses += 1;
      }
      return {
        judgement: isWrongKey ? 'STRAY' : 'MISS',
        brokeStreak,
        failedOut: false,
        stereoReset: prevStereo > 0 && this.stereoWidthTier === 0,
        crowdHype: this.crowdHype,
        moraleDelta: 0,
        stemMuted: false,
        shielded: true,
        consecutiveMisses: this.consecutiveMisses,
      };
    }

    const brokeStreak = this.combo >= 8;
    this.combo = 0;
    this.baseMultiplier = 1;
    this.stereoWidthTier = 0;
    this.missCount += 1;
    this.consecutiveMisses += 1;
    this.stemDropped = true;

    if (!this.hasValidPracticeLoop()) {
      const drainScale = this.playMode === 'faceoff' ? 0.45 : 1.0;
      this.crowdHype = Math.max(5, this.crowdHype - diff.hypeDrainOnMiss * drainScale);
    }

    return {
      judgement: 'MISS',
      brokeStreak,
      failedOut: false,
      stereoReset: prevStereo > 0,
      crowdHype: this.crowdHype,
      moraleDelta: this.crowdHype - prevHype,
      stemMuted: true,
      shielded: false,
      consecutiveMisses: this.consecutiveMisses,
    };
  }

  _registerP2Miss({ isWrongKey = false } = {}) {
    const p2 = this.p2;
    const diff = this.getDifficultyConfigFor(2);
    const prevHype = this.crowdHype;

    if (this.moraleShield) {
      p2.stemDropped = false;
      const brokeStreak = !isWrongKey && p2.combo >= 8;
      if (!isWrongKey) {
        p2.combo = 0;
        p2.baseMultiplier = 1;
        p2.missCount += 1;
        p2.consecutiveMisses += 1;
      }
      return {
        judgement: isWrongKey ? 'STRAY' : 'MISS',
        brokeStreak,
        failedOut: false,
        stereoReset: false,
        crowdHype: this.crowdHype,
        moraleDelta: 0,
        stemMuted: false,
        shielded: true,
        consecutiveMisses: p2.consecutiveMisses,
      };
    }

    const brokeStreak = p2.combo >= 8;
    p2.combo = 0;
    p2.baseMultiplier = 1;
    p2.missCount += 1;
    p2.consecutiveMisses += 1;
    p2.stemDropped = true;

    if (!this.hasValidPracticeLoop()) {
      const drainScale = this.playMode === 'coop' ? 0.72 : 0.45;
      this.crowdHype = Math.max(5, this.crowdHype - diff.hypeDrainOnMiss * drainScale);
    }

    return {
      judgement: 'MISS',
      brokeStreak,
      failedOut: false,
      stereoReset: false,
      crowdHype: this.crowdHype,
      moraleDelta: this.crowdHype - prevHype,
      stemMuted: true,
      shielded: false,
      consecutiveMisses: p2.consecutiveMisses,
    };
  }

  registerPlayerHazardHit(player = 1) {
    if (player === 2) {
      const p2 = this.p2;
      const diff = this.getDifficultyConfigFor(2);
      const brokeStreak = p2.combo >= 4;
      const prevHype = this.crowdHype;
      p2.combo = 0;
      p2.baseMultiplier = 1;
      p2.hazardsHit += 1;
      p2.missCount += 1;
      if (this.moraleShield) {
        p2.stemDropped = false;
        return {
          judgement: 'PANGGULO HIT!',
          brokeStreak,
          failedOut: false,
          stereoReset: false,
          crowdHype: this.crowdHype,
          moraleDelta: 0,
          stemMuted: false,
          shielded: true,
          consecutiveMisses: p2.consecutiveMisses,
        };
      }
      p2.consecutiveMisses += 2;
      p2.stemDropped = true;
      p2.feverCharge = Math.max(0, p2.feverCharge - 18);
      if (!this.hasValidPracticeLoop()) {
        this.crowdHype = Math.max(5, this.crowdHype - diff.hypeDrainOnMiss * 1.1);
      }
      return {
        judgement: 'PANGGULO HIT!',
        brokeStreak,
        failedOut: false,
        stereoReset: false,
        crowdHype: this.crowdHype,
        moraleDelta: this.crowdHype - prevHype,
        stemMuted: true,
        shielded: false,
        consecutiveMisses: p2.consecutiveMisses,
      };
    }
    return this.registerHazardHit();
  }

  registerHazardHit() {
    const diff = this.getDifficultyConfig();
    const brokeStreak = this.combo >= 4;
    const prevStereo = this.stereoWidthTier;
    const prevHype = this.crowdHype;
    this.failedOut = false;

    this.combo = 0;
    this.baseMultiplier = 1;
    this.stereoWidthTier = 0;
    this.hazardsHit += 1;
    this.missCount += 1;

    if (this.moraleShield) {
      this.stemDropped = false;
      return {
        judgement: 'PANGGULO HIT!',
        brokeStreak,
        failedOut: false,
        stereoReset: prevStereo > 0,
        crowdHype: this.crowdHype,
        moraleDelta: 0,
        stemMuted: false,
        shielded: true,
        consecutiveMisses: this.consecutiveMisses,
      };
    }

    this.consecutiveMisses += 2;
    this.stemDropped = true;
    this.feverCharge = Math.max(0, this.feverCharge - 18);

    if (!this.hasValidPracticeLoop()) {
      this.crowdHype = Math.max(5, this.crowdHype - diff.hypeDrainOnMiss * 1.8);
    }

    return {
      judgement: 'PANGGULO HIT!',
      brokeStreak,
      failedOut: false,
      stereoReset: prevStereo > 0,
      crowdHype: this.crowdHype,
      moraleDelta: this.crowdHype - prevHype,
      stemMuted: true,
      shielded: false,
      consecutiveMisses: this.consecutiveMisses,
    };
  }

  registerPlayerHazardDodged(player = 1) {
    if (player === 2) {
      this.p2.hazardsDodged += 1;
      const bonus = Math.round(75 * this.getEffectiveMultiplierFor(2));
      this.p2.score += bonus;
      this.crowdHype = Math.min(100, this.crowdHype + 1.2);
      return {
        judgement: 'DODGED!',
        bonus,
        crowdHype: this.crowdHype,
      };
    }
    return this.registerHazardDodged();
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

  getAccuracyFor(player = 1) {
    const s = player === 2 ? this.p2 : this;
    const hasTiered = s.greatCount > 0 || s.goodCount > 0;
    const total = hasTiered
      ? s.perfectCount + s.greatCount + s.goodCount + s.missCount
      : s.perfectCount + s.earlyCount + s.lateCount + s.missCount;
    if (total === 0) return 100;
    const weighted = hasTiered
      ? s.perfectCount + s.greatCount * 0.85 + s.goodCount * 0.6
      : s.perfectCount + (s.earlyCount + s.lateCount) * 0.65;
    return (weighted / total) * 100;
  }

  getAccuracy() {
    return this.getAccuracyFor(1);
  }

  getGradeFor(player = 1) {
    if (player === 1 && this.failedOut) return 'D';
    const s = player === 2 ? this.p2 : this;
    const hasTiered = s.greatCount > 0 || s.goodCount > 0;
    const total = hasTiered
      ? s.perfectCount + s.greatCount + s.goodCount + s.missCount
      : s.perfectCount + s.earlyCount + s.lateCount + s.missCount;
    if (total === 0) return '—';
    const acc = this.getAccuracyFor(player);
    if (s.missCount === 0 && s.hitJudgedCount > 0 && acc >= 98) return 'S+';
    if (acc >= 94 && s.missCount <= Math.max(3, Math.floor(total * 0.03))) return 'S';
    if (acc >= 86) return 'A';
    if (acc >= 74) return 'B';
    if (acc >= 60) return 'C';
    return 'D';
  }

  getGrade() {
    return this.getGradeFor(1);
  }

  buildBanterQuote({ grade = 'A', isFullCombo = false, playMode = 'solo', instrument = 'guitar', faceOffWinner = 'P1' } = {}) {
    if (playMode === 'faceoff') {
      if (faceOffWinner === 'TIE') return '"Deadlocked down to the final bar — even the monitors couldn\'t pick a favorite!"';
      return faceOffWinner === 'P1'
        ? '"Player 1 stole the front-row spotlights tonight — demand a rematch on Expert!"'
        : '"Player 2 came off the wing and owned the whole arena!"';
    }
    if (playMode === 'coop') {
      if (isFullCombo) return '"Twin-engine stadium lockstep! Zero missed notes — the soundcrew is framing this setlist!"';
      if (grade === 'S+' || grade === 'S') return '"Tightest two-piece pocket on the World Tour — crowd didn\'t stop singing for a second!"';
      return '"Dual amplifiers shaking the rafters! One more soundcheck and we headline Wembley."';
    }
    if (isFullCombo) {
      return '"100% Full Combo Crown! Rolling Stone just cleared tomorrow\'s front cover for us!"';
    }
    if (grade === 'S+') {
      return '"Pure surgical perfection — zero misses and crystal-clear timing on every downbeat."';
    }
    if (grade === 'S') {
      return '"Sold-out roar! Even the security guards were air-guitaring by the encore."';
    }
    if (grade === 'A') {
      if (instrument === 'drums') return '"Pocket was ironclad — kick drum shook dust off the overhead lighting truss!"';
      if (instrument === 'piano') return '"Every chord glistened across the arena — pure stadium magic."';
      return '"Blistering tone all night — crank the rig up one notch for the next city!"';
    }
    if (grade === 'B') {
      return '"Solid club-circuit heat! Tightened up on the chorus and kept the crowd moving."';
    }
    return '"Survived the rowdy pit! Grab a fresh set of strings and hit the practice loop."';
  }

  getSummaryFor(player = 1) {
    const isP2 = player === 2;
    const s = isP2 ? this.p2 : this;
    const starState = this.getStarState(player);
    const accuracy = this.getAccuracyFor(player);
    const grade = this.getGradeFor(player);
    const isFullCombo = s.missCount === 0 && (s.hitJudgedCount > 0 || s.perfectCount > 0);
    const avgTimingOffsetMs = s.hitJudgedCount > 0 ? Math.round(s.deltaMsSum / s.hitJudgedCount) : 0;
    const effectiveMult = this.getEffectiveMultiplierFor(player);
    return {
      player,
      instrument: isP2 ? this.p2Instrument : this.instrument,
      difficulty: isP2 ? this.p2Difficulty : this.difficulty,
      score: s.score,
      combo: s.combo,
      maxCombo: s.maxCombo,
      multiplier: effectiveMult,
      perfect: s.perfectCount,
      great: s.greatCount,
      good: s.goodCount,
      early: s.earlyCount,
      late: s.lateCount,
      miss: s.missCount,
      avgTimingOffsetMs,
      isFullCombo,
      sectionBonusTotal: s.sectionBonusTotal,
      accuracy,
      grade,
      stars: starState.stars,
      isGoldStars: starState.isGoldStars,
    };
  }

  getSummary() {
    const p1 = this.getSummaryFor(1);
    const twoPlayer = this.isTwoPlayerMode();
    const p2 = twoPlayer ? this.getSummaryFor(2) : null;
    const faceOffWinner = twoPlayer && this.playMode === 'faceoff' ? this.getFaceOffWinner() : null;
    const combinedScore = this.getCombinedBandScore();
    const banterQuote = this.buildBanterQuote({
      grade: p1.grade,
      isFullCombo: p1.isFullCombo,
      playMode: this.playMode,
      instrument: this.instrument,
      faceOffWinner,
    });
    return {
      ...p1,
      playMode: this.playMode,
      p2Summary: p2,
      combinedScore,
      faceOffWinner,
      banterQuote,
      moraleShield: this.moraleShield,
      crowdHype: this.crowdHype,
      failedOut: this.failedOut,
      encoreSpeedUnlocked: this.encoreSpeedUnlocked || p1.accuracy >= 80,
      playbackRate: this.playbackRate,
      isEncorePerformance: this.isEncorePerformance,
    };
  }
}


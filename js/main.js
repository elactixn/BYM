/**
 * main.js
 * Main arena stage controller connecting:
 *  - Authentic 3-Tab Console Lobby (Tour Setlist, Backstage Gear & Band, Venues)
 *  - Built-In 3-Tier Song Library (0ms pre-authored charts) + Persistent Custom Setlist
 *  - Zero-API-Key Neural Audio-to-MIDI (Spotify Basic Pitch) + Direct .MID support + Spectral Flux fallback
 *  - Keyboard input (D, F, G, J, K, SPACE Fever, W/ArrowUp/Wheel Whammy, [ ] Practice Loop, ESC Pause)
 *  - Clickable/multi-touch spatial stage pedals (3, 4, or 5 lanes mapped to Easy/Medium/Hard/Expert)
 *  - Kinetic Concert Camera Director + Live Backstage 3D Camera Focus
 *  - Multi-Song Tour Setlist Builder with Intermission chants & Automatic Final Encore
 */

import {
  SONG_TIERS,
  BUILTIN_TRACKS,
  formatTime,
  buildPreauthoredBuiltinChart,
  ensureBuiltinStems,
  importLocalAudioFile,
  decodeStoredLocalTrack,
  loadSavedLocalTracks,
  updateLocalTrackChartCache,
  deleteLocalTrackFromLibrary,
  loadAllHighScores,
  saveHighScore,
  bindLocalAudioDropzone,
} from './songLibrary.js';
import {
  analyzeAndBuildChart,
  cloneFreshNotes,
  getSongSectionAt,
  createBeatSyncClock,
} from './beatScheduler.js';
import {
  GameState,
  SCREENS,
} from './gameState.js';
import {
  AudioEngine,
  CHART_SCHEMA_VERSION,
  WALK_ON_LEAD_IN_SEC,
  analyzeAudioInWorker,
  computeStemActivityFromBuffers,
} from './audioEngine.js';
import { SoundEffects } from './soundEffects.js';
import { RhythmCanvas } from './rhythmCanvas.js';
import { StageBand } from './stageBand.js';
import { VENUES, STAGE_OVERLAYS, getVenueById, getStageOverlayById } from './venues.js';
import {
  BAND_LINEUPS,
  HIGHWAY_SKINS,
  GUITAR_MODELS,
  BASS_MODELS,
  DRUM_KIT_MODELS,
  KEYBOARD_MODELS,
  STAR_LOOKALIKES,
  INSTRUMENT_SKINS,
  getBandLineupById,
  getHighwaySkinById,
  getGuitarModelById,
  getBassModelById,
  getDrumKitModelById,
  getKeyboardModelById,
  getStarLookById,
  getInstrumentSkinById,
} from './bandGearCatalog.js';

export { CHART_SCHEMA_VERSION };
const CHART_CACHE_VERSION = CHART_SCHEMA_VERSION;
const gameState = new GameState();
const sfx = new SoundEffects();
const beatSyncClock = createBeatSyncClock();
let stageBand = null;
let idleBandRaf = null;
let lastIdleBandMs = 0;

// 60 FPS Adaptive Quality Guard (automatically softens GPU load if FPS dips < 45 for > 2s)
let emaFps = 60;
let lowFpsAccumSec = 0;
let highFpsAccumSec = 0;
let adaptiveLowPowerActive = false;

// In-memory Web Worker DSP analysis + reconstructed 4-stem WebAudio buffer caches keyed by track.id
const workerAnalysisCache = new Map();
const workerStemMediaCache = new Map();

function stripStemsForStorage(workerAnalysis) {
  if (!workerAnalysis || !workerAnalysis.separatedStems) return workerAnalysis;
  const { separatedStems: _omit, ...persistable } = workerAnalysis;
  return persistable;
}

// Console Lobby Navigation State
let activeLobbyTab = 'setlist'; // 'setlist' | 'gear' | 'venues'
let dedicatedLobbyMode = false; // true when opened directly from Main Menu to Rock Shop / Venues / Quickplay
let activeSetlistSubTab = 'world-tour'; // 'world-tour' | 'custom'
let activeGearCategory = 'band'; // 'band' | 'guitar' | 'bass' | 'drums' | 'highway'
let activeSkinTargetRole = 'all'; // 'all' | 'guitar' | 'bass' | 'drums' | 'piano'
let selectedTrack = BUILTIN_TRACKS[0];
let lobbyPracticeSpeed = 1.0;

// Runtime song & chart state
let masterNotes = [];
let activeNotes = [];
let masterNotesP2 = [];
let activeNotesP2 = [];
let activeBeatGrid = [];
let activeSections = [];
let activeBreWindow = null;
let activeTrackBpm = 120;
let activeTrackMeta = null;
let savedLocalTracks = [];
let highScoresMap = {};
let lastHudUpdateMs = 0;
let lastSustainSparkMs = 0;
let lastSustainSparkMsP2 = 0;
let lastChorusPyroMs = 0;
let calibrationOnlyMode = false;
let grandEncoreActive = false;
let grandEncoreManualOverride = false;
let victoryEncoreHoldActive = false;
let victoryEncoreTimer = 0;
let trainerOpen = false;
let lastFinishedSummary = null;
let lastFinishedTrack = null;
let activeSectionTracker = { idx: -1, label: 'Section', hits: 0, misses: 0 };
let activeSectionTrackerP2 = { idx: -1, label: 'Section', hits: 0, misses: 0 };
const lanePressedAtSongTime = [-999, -999, -999, -999, -999];
const lanePressedAtSongTimeP2 = [-999, -999, -999, -999, -999];

// 4-Beat Interactive Tap-to-Calibrate Session State
const tapCalibrateState = {
  active: false,
  beatTimesMs: [],
  deltasMs: [],
  timers: [],
};

// Stage Walk-On & Guitar Hero Song Title Marquee state
let walkOnAmpPlugPlayed = false;
let songTitleMarqueeShown = false;
let songTitleMarqueeTimeout = null;

// Whammy input state (W, ArrowUp, or mouse wheel wiggle while holding sustain)
let whammyKeyHeld = false;
let whammyWheelImpulse = 0;

// DOM references
const arenaRoot = document.getElementById('arena-root');
const canvasEl = document.getElementById('rhythm-canvas');
const stageBandCanvasEl = document.getElementById('stage-band-canvas');

// Overlays
const mainMenuOverlay = document.getElementById('main-menu-overlay');
const btnMenuQuickplay = document.getElementById('btn-menu-quickplay');
const btnMenuRockshop = document.getElementById('btn-menu-rockshop');
const btnMenuVenues = document.getElementById('btn-menu-venues');
const btnMenuOptions = document.getElementById('btn-menu-options');
const btnMainMenuTopbar = document.getElementById('btn-main-menu-topbar');
const consoleDedicatedHeader = document.getElementById('console-dedicated-header');
const consoleDedicatedTitle = document.getElementById('console-dedicated-title');
const btnDedicatedMainMenu = document.getElementById('btn-dedicated-main-menu');

const backstageOverlay = document.getElementById('backstage-overlay');
const pauseDrawer = document.getElementById('pause-drawer');
const intermissionOverlay = document.getElementById('intermission-overlay');
const resultsOverlay = document.getElementById('results-overlay');
const tourSummaryOverlay = document.getElementById('tour-summary-overlay');
const scanOverlay = document.getElementById('scan-overlay');
const scanOverlayTitle = document.getElementById('scan-overlay-title');
const scanOverlaySub = document.getElementById('scan-overlay-sub');
const scanProgressWrap = document.getElementById('scan-progress-wrap');
const scanProgressFill = document.getElementById('scan-progress-fill');
const scanProgressPct = document.getElementById('scan-progress-pct');

// Console Lobby Tabs & Panels
const lobbyTabButtons = document.querySelectorAll('[data-lobby-tab]');
const panelSetlist = document.getElementById('panel-setlist');
const panelGear = document.getElementById('panel-gear');
const panelVenues = document.getElementById('panel-venues');
const setlistSubtabButtons = document.querySelectorAll('[data-setlist-subtab]');
const worldTourPane = document.getElementById('world-tour-pane');
const customSetlistPane = document.getElementById('custom-setlist-pane');
const customCountBadge = document.getElementById('custom-count-badge');

// Setlist & Dropzone DOM
const builtinTrackList = document.getElementById('builtin-track-list');
const savedLibraryList = document.getElementById('saved-library-list');
const savedLibraryEmpty = document.getElementById('saved-library-empty');
const dropZone = document.getElementById('audio-dropzone');
const fileInput = document.getElementById('audio-file-input');
const dropStatusEl = document.getElementById('dropzone-status');

// Gig Ticket DOM
const ticketCoverBadge = document.getElementById('ticket-cover-badge');
const ticketTierTag = document.getElementById('ticket-tier-tag');
const ticketSongTitle = document.getElementById('ticket-song-title');
const ticketSongArtist = document.getElementById('ticket-song-artist');
const ticketBpm = document.getElementById('ticket-bpm');
const ticketDuration = document.getElementById('ticket-duration');
const ticketSkulls = document.getElementById('ticket-skulls');
const ticketBestStars = document.getElementById('ticket-best-stars');
const ticketBestScore = document.getElementById('ticket-best-score');
const ticketInstrumentCaption = document.getElementById('ticket-instrument-caption');
const ticketKeysHint = document.getElementById('ticket-keys-hint');
const ticketVenueStamp = document.getElementById('ticket-venue-stamp');
const ticketGearStamp = document.getElementById('ticket-gear-stamp');
const playModeButtons = document.querySelectorAll('[data-play-mode]');
const ticketModeHint = document.getElementById('ticket-mode-hint');
const ticketRoleLabel = document.getElementById('ticket-role-label');
const ticketDiffLabel = document.getElementById('ticket-diff-label');
const p2ConfigRow = document.getElementById('p2-config-row');
const ticketP2KeysHint = document.getElementById('ticket-p2-keys-hint');
const p2InstrumentButtons = document.querySelectorAll('[data-p2-instrument]');
const p2DifficultyButtons = document.querySelectorAll('[data-p2-difficulty]');
const instrumentButtons = document.querySelectorAll('[data-instrument-choice]');
const difficultyButtons = document.querySelectorAll('[data-difficulty]');
const lobbySpeedButtons = document.querySelectorAll('[data-lobby-speed]');
const btnTicketQueue = document.getElementById('btn-ticket-queue');
const btnPlayGig = document.getElementById('btn-play-gig');

// Backstage Gear Dock DOM
const gearCatButtons = document.querySelectorAll('[data-gear-category]');
const gearActiveDesc = document.getElementById('gear-active-desc');
const gearActiveGrid = document.getElementById('gear-active-grid');

// Venues Carousel & Stage Overlay DOM
const venueActiveType = document.getElementById('venue-active-type');
const venueActiveName = document.getElementById('venue-active-name');
const venueActiveCity = document.getElementById('venue-active-city');
const venueActiveOverlayTag = document.getElementById('venue-active-overlay-tag');
const venueActiveDesc = document.getElementById('venue-active-desc');
const venueOverlayGrid = document.getElementById('venue-overlay-grid');
const venueSelectorGrid = document.getElementById('venue-selector-grid');
const btnVenuePrev = document.getElementById('btn-venue-prev');
const btnVenueNext = document.getElementById('btn-venue-next');

// Topbar Tour Popover & Calibration DOM
const btnTourQueueToggle = document.getElementById('btn-tour-queue-toggle');
const tourQueueBadge = document.getElementById('tour-queue-badge');
const tourQueuePopover = document.getElementById('tour-queue-popover');
const tourQueueList = document.getElementById('tour-queue-list');
const tourQueueCaption = document.getElementById('tour-queue-caption');
const btnStartTour = document.getElementById('btn-start-tour');
const btnClearTour = document.getElementById('btn-clear-tour');
const backstageLatencyVal = document.getElementById('backstage-latency-val');
const btnOpenCalibrationBackstage = document.getElementById('btn-open-calibration-backstage');

// Intermission Overlay DOM
const intermissionChant = document.getElementById('intermission-chant');
const intermissionPrevSummary = document.getElementById('intermission-prev-summary');
const intermissionNextLabel = document.getElementById('intermission-next-label');
const intermissionNextTitle = document.getElementById('intermission-next-title');
const intermissionNextMeta = document.getElementById('intermission-next-meta');
const btnIntermissionGo = document.getElementById('btn-intermission-go');
const btnIntermissionBackstage = document.getElementById('btn-intermission-backstage');

// Tour Summary Overlay DOM
const tourSummaryVenue = document.getElementById('tour-summary-venue');
const tourSummaryGrade = document.getElementById('tour-summary-grade');
const tourSummaryScore = document.getElementById('tour-summary-score');
const tourSummaryAccuracy = document.getElementById('tour-summary-accuracy');
const tourSummaryCombo = document.getElementById('tour-summary-combo');
const tourSummarySongs = document.getElementById('tour-summary-songs');
const btnTourReplay = document.getElementById('btn-tour-replay');
const btnTourBackstage = document.getElementById('btn-tour-backstage');

// Live Stage HUD
const hudTrackTitle = document.getElementById('hud-track-title');
const hudSectionBadge = document.getElementById('hud-section-badge');
const hudTrackMeta = document.getElementById('hud-track-meta');
const hudProgressFill = document.getElementById('hud-progress-fill');
const hudTimeCurrent = document.getElementById('hud-time-current');
const hudTimeTotal = document.getElementById('hud-time-total');
const hudAmpRole = document.getElementById('hud-amp-role');
const hudAmpStatus = document.getElementById('hud-amp-status');
const hudAmpCard = document.getElementById('hud-amp-card');
const hudAmpMeterFill = document.getElementById('hud-amp-meter-fill');
const hudLoopReadout = document.getElementById('hud-loop-readout');

const hudScore = document.getElementById('hud-score');
const hudStarRating = document.getElementById('hud-star-rating');
const hudStarsRow = document.getElementById('hud-stars-row');
const hudStarProgressFill = document.getElementById('hud-star-progress-fill');
const hudStarLabel = document.getElementById('hud-star-label');
const hudCombo = document.getElementById('hud-combo');
const hudMultiplier = document.getElementById('hud-multiplier');
const hudStreakBulbs = document.getElementById('hud-streak-bulbs');
const hudFeverBulb = document.getElementById('hud-fever-bulb');
const hudRockNeedle = document.getElementById('hud-rock-needle');
const hudMoraleShieldBadge = document.getElementById('hud-morale-shield-badge');
const hudHypeFill = document.getElementById('hud-hype-fill');
const hudHypeVal = document.getElementById('hud-hype-val');
const hudFeverFill = document.getElementById('hud-fever-fill');
const hudWhammyTag = document.getElementById('hud-whammy-tag');
const btnFeverTrigger = document.getElementById('btn-fever-trigger');

// Classic Guitar Hero-Style Animated Song Title Marquee DOM
const ghSongMarquee = document.getElementById('gh-song-marquee');
const ghMarqueeKicker = document.getElementById('gh-marquee-kicker');
const ghMarqueeTitle = document.getElementById('gh-marquee-title');
const ghMarqueeArtist = document.getElementById('gh-marquee-artist');
const ghMarqueeMeta = document.getElementById('gh-marquee-meta');

const btnToggleTrainer = document.getElementById('btn-toggle-trainer');
const practiceSectionTrainer = document.getElementById('practice-section-trainer');
const trainerSectionsStrip = document.getElementById('trainer-sections-strip');
const btnTrainerLoopA = document.getElementById('btn-trainer-loop-a');
const btnTrainerLoopB = document.getElementById('btn-trainer-loop-b');
const btnTrainerLoopClear = document.getElementById('btn-trainer-loop-clear');
const trainerLoopReadout = document.getElementById('trainer-loop-readout');
const trainerSpeedButtons = document.querySelectorAll('[data-trainer-speed]');

const btnFxPyro = document.getElementById('btn-fx-pyro');
const btnFxConfetti = document.getElementById('btn-fx-confetti');
const btnFxCryo = document.getElementById('btn-fx-cryo');
const btnFxCrowd = document.getElementById('btn-fx-crowd');

const hudP2Panel = document.getElementById('hud-p2-panel');
const hudP2Role = document.getElementById('hud-p2-role');
const hudP2Score = document.getElementById('hud-p2-score');
const hudP2Combo = document.getElementById('hud-p2-combo');
const hudP2Mult = document.getElementById('hud-p2-mult');
const hudP2FeverFill = document.getElementById('hud-p2-fever-fill');
const btnP2FeverTrigger = document.getElementById('btn-p2-fever-trigger');

const btnSfxMute = document.getElementById('btn-sfx-mute');
const btnPauseStage = document.getElementById('btn-pause-stage');
const btnBackstageHud = document.getElementById('btn-backstage-hud');

// Stage pedals & crowd
const stagePedalsContainer = document.getElementById('stage-pedals');
const stagePedalsP2Container = document.getElementById('stage-pedals-p2');
const crowdContainer = document.getElementById('crowd-lightsticks');

// Calibration / Pause / Practice Loop / Crowd Volume Drawer controls
const pauseModalTitle = document.getElementById('pause-modal-title');
const pauseModalSub = document.getElementById('pause-modal-sub');
const latencySlider = document.getElementById('latency-slider');
const latencyReadout = document.getElementById('latency-readout');
const btnLatencyMinus = document.getElementById('btn-latency-minus');
const btnLatencyPlus = document.getElementById('btn-latency-plus');
const btnLatencyReset = document.getElementById('btn-latency-reset');
const btnTapCalibrate = document.getElementById('btn-tap-calibrate');
const tapCalibrateStatus = document.getElementById('tap-calibrate-status');

const crowdVolumeSlider = document.getElementById('crowd-volume-slider');
const crowdVolumeReadout = document.getElementById('crowd-volume-readout');
const btnTestCrowd = document.getElementById('btn-test-crowd');
const sfxVolumeSlider = document.getElementById('sfx-volume-slider');
const sfxVolumeReadout = document.getElementById('sfx-volume-readout');

const practiceSection = document.getElementById('practice-loop-section');
const practiceLoopToggle = document.getElementById('practice-loop-toggle');
const btnLoopSetStart = document.getElementById('btn-loop-set-start');
const btnLoopSetEnd = document.getElementById('btn-loop-set-end');
const btnLoopClear = document.getElementById('btn-loop-clear');
const loopBoundsReadout = document.getElementById('loop-bounds-readout');
const speedButtons = document.querySelectorAll('[data-playback-rate]');
const cameraModeButtons = document.querySelectorAll('[data-camera-mode]');
const moraleShieldToggle = document.getElementById('morale-shield-toggle');
const pauseMoraleShieldToggle = document.getElementById('pause-morale-shield-toggle');
const moraleShieldReadout = document.getElementById('morale-shield-readout');

const btnResume = document.getElementById('btn-resume');
const btnNextSongPause = document.getElementById('btn-next-song-pause');
const btnRestart = document.getElementById('btn-restart');
const btnFinishNow = document.getElementById('btn-finish-now');
const btnBackstagePause = document.getElementById('btn-backstage-pause');
const btnCloseCalOnly = document.getElementById('btn-close-cal-only');
const pauseStageActions = document.getElementById('pause-stage-actions');

// Single-Song Encore Results / Magazine Cover elements
const resultsHeading = document.getElementById('results-modal-title');
const resultsTrackTitle = document.getElementById('results-track-title');
const resultsTrackMeta = document.getElementById('results-track-meta');
const resultsFcBadge = document.getElementById('results-fc-badge');
const resultsGoldBadge = document.getElementById('results-gold-badge');
const resultsGrade = document.getElementById('results-grade');
const resultsScore = document.getElementById('results-score');
const resultsStars = document.getElementById('results-stars');
const resultsAccuracy = document.getElementById('results-accuracy');
const resultsMaxCombo = document.getElementById('results-max-combo');
const resultsTimingBias = document.getElementById('results-timing-bias');
const resultsPerfect = document.getElementById('results-perfect');
const resultsGreat = document.getElementById('results-great');
const resultsGood = document.getElementById('results-good');
const resultsMiss = document.getElementById('results-miss');
const results2pComparison = document.getElementById('results-2p-comparison');
const resultsBanterQuote = document.getElementById('results-banter-quote');
const btnSavePoster = document.getElementById('btn-save-poster');
const btnEncoreSpeedup = document.getElementById('btn-encore-speedup');
const btnNextSongResults = document.getElementById('btn-next-song-results');
const btnPlayAgain = document.getElementById('btn-play-again');
const btnBackstageResults = document.getElementById('btn-backstage-results');

// AudioEngine
const audioEngine = new AudioEngine({
  onTrackEnded: () => {
    if (gameState.screen === SCREENS.STAGE) {
      if (gameState.hasValidPracticeLoop()) {
        jumpToPracticeLoopStart();
      } else if (!gameState.failedOut && !victoryEncoreHoldActive) {
        enterVictoryEncoreHold();
      }
    }
  },
});

function unlockSharedAudio() {
  const ctx = audioEngine.getContext();
  sfx.unlockAudio(ctx);
  sfx.setCrowdVolume(gameState.crowdVolume);
  sfx.setSfxVolume(gameState.sfxVolume);
  sfx.setMuted(gameState.sfxMuted);
  if (stageBand?.crowdAmbience) {
    stageBand.crowdAmbience.attachAudioContext(ctx);
    stageBand.crowdAmbience.setVolume(gameState.crowdVolume, gameState.sfxMuted);
  }
}

function getEffectiveSongTime(eventTimeStampMs = null) {
  return audioEngine.getExactPlaybackTime(eventTimeStampMs);
}

// RhythmCanvas
const rhythmCanvas = new RhythmCanvas(canvasEl, {
  getGameState: () => gameState,
  getNotes: () => activeNotes,
  getNotesP2: () => activeNotesP2,
  getBeatGrid: () => activeBeatGrid,
  getEffectiveTime: () => getEffectiveSongTime(),
  getBeatSync: () => beatSyncClock.getState(),
  getAudioTelemetry: () => ({
    drumEnergy: audioEngine.liveDrumEnergy,
    drumTransient: audioEngine.liveDrumTransient,
    kickEnergy: audioEngine.liveKickEnergy,
    kickTransient: audioEngine.liveKickTransient,
    snareEnergy: audioEngine.liveSnareEnergy,
    snareTransient: audioEngine.liveSnareTransient,
    harmonicEnergy: audioEngine.liveHarmonicEnergy,
    bassEnergy: audioEngine.liveBassEnergy,
    bassTransient: audioEngine.liveBassTransient,
    guitarEnergy: audioEngine.liveGuitarEnergy,
    guitarTransient: audioEngine.liveGuitarTransient,
    pianoEnergy: audioEngine.livePianoEnergy,
    pianoTransient: audioEngine.livePianoTransient,
    vocalEnergy: audioEngine.liveVocalEnergy,
    overallEnergy: audioEngine.liveOverallEnergy,
    spectrum: audioEngine.liveSpectrumBins,
  }),
  onFrameTick: (dt) => handleFrameTick(dt),
});

function initStageBand() {
  if (!stageBandCanvasEl) return;
  try {
    stageBand = new StageBand(stageBandCanvasEl, {
      venueId: gameState.venueId,
      venueOverlayId: gameState.venueOverlayId,
      cameraMode: gameState.cameraMode,
      bandLineupId: gameState.bandLineupId,
      guitarModelId: gameState.guitarModelId,
      bassModelId: gameState.bassModelId,
      drumKitModelId: gameState.drumKitModelId,
      keyboardModelId: gameState.keyboardModelId,
      starLookId: gameState.starLookId,
      instrumentSkinId: gameState.instrumentSkinId,
      instrumentSkins: gameState.instrumentSkins,
      onFireworkLaunch: (pan) => sfx.playFireworkWhistle(pan),
      onFireworkBurst: (pan) => sfx.playFireworkBurst(pan),
      onProjectileImpact: (pan) => sfx.playCrowdBooAndThud(pan),
    });
    stageBand.setBackstageFocus('setlist');
    stageBand.setActivePlayers(
      gameState.isTwoPlayerMode() ? [gameState.instrument, gameState.p2Instrument] : [gameState.instrument],
      false
    );
    window.addEventListener('resize', () => {
      if (stageBand) stageBand.resize();
    });
    startIdleBandLoop();
  } catch (err) {
    console.warn('3D Stage Band unavailable:', err);
    stageBand = null;
  }
}

function startIdleBandLoop() {
  if (idleBandRaf || !stageBand) return;
  lastIdleBandMs = performance.now();
  const tick = (now) => {
    idleBandRaf = window.requestAnimationFrame(tick);
    if (gameState.screen === SCREENS.STAGE) return;
    const dt = Math.min(Math.max((now - lastIdleBandMs) / 1000, 0.001), 0.05);
    lastIdleBandMs = now;
    const isCelebration =
      gameState.screen === SCREENS.RESULTS ||
      gameState.screen === SCREENS.TOUR_SUMMARY ||
      gameState.screen === SCREENS.INTERMISSION;
    const idleBpm = activeTrackBpm || 120;
    const idleSongTime = now / 1000;
    const idleBeatPhase = (((idleSongTime * (idleBpm / 60)) % 1) + 1) % 1;
    stageBand.update(
      dt,
      {
        playing: false,
        instrument: gameState.instrument,
        activeInstruments: gameState.isTwoPlayerMode()
          ? [gameState.instrument, gameState.p2Instrument]
          : [gameState.instrument],
        feverActive: false,
        isEncore: gameState.isEncorePerformance,
        stemDropped: false,
        combo: 0,
        hype: isCelebration ? 90 : 62,
        bpm: idleBpm,
        songTime: idleSongTime,
        beatPhase: idleBeatPhase,
      },
      {
        drumEnergy: isCelebration ? 0.36 : 0.16,
        bassEnergy: isCelebration ? 0.34 : 0.14,
        guitarEnergy: isCelebration ? 0.36 : 0.16,
        vocalEnergy: isCelebration ? 0.28 : 0.12,
        overallEnergy: isCelebration ? 0.38 : 0.14,
      }
    );
  };
  idleBandRaf = window.requestAnimationFrame(tick);
}

function buildCrowdLightsticks() {
  crowdContainer.innerHTML = '';
  const total = 26;
  for (let i = 0; i < total; i += 1) {
    const pct = (i / (total - 1)) * 100;
    const isCenter = pct > 28 && pct < 72;
    const stick = document.createElement('span');
    stick.className = isCenter ? 'lightstick is-center' : 'lightstick';
    stick.style.left = `${pct.toFixed(1)}%`;
    stick.style.setProperty('--sway-delay', `${(i * 0.23) % 2.4}s`);
    stick.style.setProperty('--sway-dur', `${1.7 + (i % 5) * 0.25}s`);
    stick.style.setProperty('--stick-height', `${isCenter ? 20 + (i % 3) * 4 : 30 + (i % 4) * 7}px`);
    crowdContainer.appendChild(stick);
  }
}

/* ==========================================================================
   Cover Emblem SVGs, Difficulty Skulls & Star Formatters
   ========================================================================== */

function getCoverEmblemSvg(emblem = 'bolt', accent = '#fde047') {
  switch (emblem) {
    case 'sun':
      return `<svg viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="10" fill="${accent}"/><path d="M6 22h24M8 26h20M11 30h14" stroke="#0f172a" stroke-width="2.4"/></svg>`;
    case 'star':
      return `<svg viewBox="0 0 36 36" fill="none"><path d="M18 4l4.1 8.5 9.4 1.3-6.8 6.5 1.7 9.3L18 25l-8.4 4.6 1.7-9.3-6.8-6.5 9.4-1.3L18 4z" fill="${accent}"/></svg>`;
    case 'flame':
      return `<svg viewBox="0 0 36 36" fill="none"><path d="M19 4c2 6-3 8-2 13 3-2 5-5 5-8 5 4 7 10 5 16-2 5-6 7-10 7-6 0-10-4-10-11 0-7 5-12 12-17z" fill="${accent}"/></svg>`;
    case 'lightning':
      return `<svg viewBox="0 0 36 36" fill="none"><path d="M21 3L8 20h9l-3 13 14-18h-9l2-12z" fill="${accent}"/></svg>`;
    case 'skull':
      return `<svg viewBox="0 0 36 36" fill="none"><path d="M18 5c7 0 12 4.8 12 11 0 3.7-1.9 6.8-4.5 8.6V29h-4v-3h-2v3h-3v-3h-2v3h-4v-4.4C7.9 22.8 6 19.7 6 16c0-6.2 5-11 12-11z" fill="${accent}"/><circle cx="13.5" cy="16.5" r="2.6" fill="#09090b"/><circle cx="22.5" cy="16.5" r="2.6" fill="#09090b"/></svg>`;
    case 'vinyl':
      return `<svg viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="13" fill="#0f172a" stroke="${accent}" stroke-width="2.2"/><circle cx="18" cy="18" r="4.5" fill="${accent}"/><circle cx="18" cy="18" r="1.4" fill="#0f172a"/></svg>`;
    case 'bolt':
    default:
      return `<svg viewBox="0 0 36 36" fill="none"><path d="M20 4L9 19h8l-2 13 12-16h-8l1-12z" fill="${accent}"/></svg>`;
  }
}

function renderSkullsHtml(rating = 3) {
  const count = Math.max(1, Math.min(5, Math.round(rating)));
  const flameSvg =
    '<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M8.8 1.2c.9 2.6-1.3 3.7-.9 6 1.2-.8 2.1-2 2.2-3.4 2.1 1.7 3.1 4.2 2.2 6.8-.8 2.2-2.6 3.5-4.7 3.5-2.8 0-4.7-2-4.7-4.8 0-3 2.2-5.4 5.9-8.1z"/></svg>';
  let html = '';
  for (let i = 1; i <= 5; i += 1) {
    html += i <= count
      ? `<span class="flame-icon">${flameSvg}</span>`
      : `<span class="flame-icon flame-dim">${flameSvg}</span>`;
  }
  return html;
}

function renderStarsHtml(stars = 0) {
  let html = '';
  for (let i = 1; i <= 5; i += 1) {
    html += i <= stars ? '<span>★</span>' : '<span class="star-dim">★</span>';
  }
  return html;
}

/* ==========================================================================
   Console 3-Tab Lobby Switching + Live 3D Stage Camera Focus
   ========================================================================== */

function syncBackstageCameraFocus() {
  if (!stageBand || gameState.screen !== SCREENS.BACKSTAGE) return;
  if (activeLobbyTab === 'setlist') {
    stageBand.setBackstageFocus('setlist');
  } else if (activeLobbyTab === 'venues') {
    stageBand.setBackstageFocus('venues');
  } else if (activeLobbyTab === 'gear') {
    const focusCat =
      activeGearCategory === 'skins'
        ? (activeSkinTargetRole === 'all' ? 'guitar' : activeSkinTargetRole)
        : activeGearCategory;
    stageBand.setBackstageFocus(focusCat);
  }
}

const DEDICATED_TAB_TITLES = {
  gear: '🎸 ROCK SHOP — ARTIST LOOKS & CUSTOM GEAR',
  venues: '🏟️ WORLD TOUR — STADIUMS & STAGE OVERLAYS',
  setlist: '🎤 QUICKPLAY — TOUR SETLIST & GIG TICKET',
};

function setLobbyMode(mode = 'tabs') {
  dedicatedLobbyMode = mode === 'dedicated';
  if (backstageOverlay) {
    backstageOverlay.dataset.lobbyMode = dedicatedLobbyMode ? 'dedicated' : 'tabs';
  }
  if (consoleDedicatedHeader) {
    consoleDedicatedHeader.classList.toggle('is-hidden', !dedicatedLobbyMode);
  }
  if (consoleDedicatedTitle) {
    consoleDedicatedTitle.textContent =
      DEDICATED_TAB_TITLES[activeLobbyTab] || DEDICATED_TAB_TITLES.setlist;
  }
}

function switchLobbyTab(tabId) {
  activeLobbyTab = tabId;
  if (backstageOverlay) backstageOverlay.dataset.activeTab = tabId;
  if (dedicatedLobbyMode && consoleDedicatedTitle) {
    consoleDedicatedTitle.textContent =
      DEDICATED_TAB_TITLES[tabId] || DEDICATED_TAB_TITLES.setlist;
  }

  lobbyTabButtons.forEach((btn) => {
    const active = btn.dataset.lobbyTab === tabId;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', String(active));
  });

  panelSetlist.classList.toggle('is-hidden', tabId !== 'setlist');
  panelGear.classList.toggle('is-hidden', tabId !== 'gear');
  panelVenues.classList.toggle('is-hidden', tabId !== 'venues');

  if (tabId === 'gear') {
    renderGearDock();
  } else if (tabId === 'venues') {
    scrollActiveVenueIntoView();
  }

  syncBackstageCameraFocus();
}

function switchSetlistSubTab(subTabId) {
  activeSetlistSubTab = subTabId;
  setlistSubtabButtons.forEach((btn) => {
    const active = btn.dataset.setlistSubtab === subTabId;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', String(active));
  });

  worldTourPane.classList.toggle('is-hidden', subTabId !== 'world-tour');
  customSetlistPane.classList.toggle('is-hidden', subTabId !== 'custom');

  // Auto-select first custom track if switching to custom setlist and tracks exist
  if (subTabId === 'custom' && savedLocalTracks.length > 0 && selectedTrack?.sourceType !== 'local') {
    selectTrackForTicket(savedLocalTracks[0]);
  } else if (subTabId === 'world-tour' && selectedTrack?.sourceType !== 'builtin') {
    selectTrackForTicket(BUILTIN_TRACKS[0]);
  }
}

function switchGearCategory(cat) {
  activeGearCategory = cat;
  gearCatButtons.forEach((btn) => {
    const active = btn.dataset.gearCategory === cat;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', String(active));
  });
  renderGearDock();
  syncBackstageCameraFocus();
}

/* ==========================================================================
   Tab 1: Tour Setlist & Gig Ticket Rendering
   ========================================================================== */

function selectTrackForTicket(track) {
  if (!track) return;
  selectedTrack = track;
  renderBuiltinTracks();
  renderSavedLibrary();
  renderGigTicket();
}

function renderBuiltinTracks() {
  if (!builtinTrackList) return;
  builtinTrackList.innerHTML = '';

  SONG_TIERS.forEach((tierInfo) => {
    const tierTracks = BUILTIN_TRACKS.filter((t) => t.tier === tierInfo.tier);
    if (tierTracks.length === 0) return;

    const block = document.createElement('div');
    block.className = 'tier-block';
    block.innerHTML = `
      <div class="tier-header" style="--tier-accent: ${tierInfo.accent}">
        <span class="tier-title">${tierInfo.name}</span>
        <span class="tier-tag">${tierInfo.tag}</span>
      </div>
    `;

    tierTracks.forEach((track) => {
      const best = highScoresMap[track.id];
      const isSelected = selectedTrack && selectedTrack.id === track.id;
      const [c1, c2, c3] = track.coverPalette || ['#0891b2', '#0f172a', '#fde047'];

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = isSelected ? 'setlist-song-row is-selected' : 'setlist-song-row';
      btn.dataset.trackId = track.id;
      btn.innerHTML = `
        <span class="song-cover-mini" style="background: linear-gradient(135deg, ${c1} 0%, ${c2} 100%)">
          ${getCoverEmblemSvg(track.coverEmblem, c3)}
        </span>
        <span class="song-row-info">
          <span class="song-row-title">${track.title}</span>
          <span class="song-row-artist">${track.artist} · ${track.genre}</span>
        </span>
        <span class="song-row-right">
          <span class="song-row-stars ${best?.isGoldStars ? 'is-gold' : ''}">${renderStarsHtml(best?.stars || 0)}</span>
          <span class="song-row-skulls">${renderSkullsHtml(track.difficultyRating)}</span>
          <span class="song-row-bpm tabular">${track.bpm} BPM · ${formatTime(track.duration)}</span>
        </span>
      `;

      btn.addEventListener('click', () => {
        selectTrackForTicket(track);
      });
      btn.addEventListener('dblclick', () => {
        selectTrackForTicket(track);
        launchSelectedGig();
      });

      block.appendChild(btn);
    });

    builtinTrackList.appendChild(block);
  });
}

function renderSavedLibrary() {
  if (!savedLibraryList) return;
  savedLibraryList.innerHTML = '';
  if (customCountBadge) customCountBadge.textContent = String(savedLocalTracks.length);
  savedLibraryEmpty.classList.toggle('is-hidden', savedLocalTracks.length > 0);

  savedLocalTracks.forEach((rec) => {
    const best = highScoresMap[rec.id];
    const isSelected = selectedTrack && selectedTrack.id === rec.id;
    const metaParts = [
      rec.bpm ? `${rec.bpm} BPM` : 'Auto Tempo',
      formatTime(rec.duration),
      best ? `${best.grade} · ${best.score.toLocaleString()}` : `${rec.fileSizeMb} MB`,
    ];

    const row = document.createElement('div');
    row.className = isSelected ? 'custom-track-row is-selected' : 'custom-track-row';
    row.innerHTML = `
      <button type="button" class="custom-track-select">
        <span class="custom-track-title-line">
          <span class="custom-track-title">${rec.title}</span>
          ${rec.chartText ? '<span class="midi-badge">CHART</span>' : rec.midiBytes ? '<span class="midi-badge">MIDI</span>' : ''}
        </span>
        <span class="custom-track-meta tabular">${rec.artist} · ${metaParts.join(' · ')}</span>
      </button>
      <span class="song-row-stars ${best?.isGoldStars ? 'is-gold' : ''}">${renderStarsHtml(best?.stars || 0)}</span>
      <button type="button" class="custom-track-remove" aria-label="Remove ${rec.title}">×</button>
    `;

    const selectBtn = row.querySelector('.custom-track-select');
    selectBtn.addEventListener('click', () => selectTrackForTicket(rec));
    selectBtn.addEventListener('dblclick', () => {
      selectTrackForTicket(rec);
      launchSelectedGig();
    });

    row.querySelector('.custom-track-remove').addEventListener('click', async (e) => {
      e.stopPropagation();
      await deleteLocalTrackFromLibrary(rec.id);
      savedLocalTracks = savedLocalTracks.filter((item) => item.id !== rec.id);
      delete highScoresMap[rec.id];
      if (selectedTrack && selectedTrack.id === rec.id) {
        selectedTrack = savedLocalTracks[0] || BUILTIN_TRACKS[0];
      }
      renderSavedLibrary();
      renderGigTicket();
    });

    savedLibraryList.appendChild(row);
  });
}

function renderGigTicket() {
  const track = selectedTrack || BUILTIN_TRACKS[0];
  if (!track) return;

  const [c1, c2, c3] = track.coverPalette || ['#0284c7', '#111827', '#f59e0b'];
  if (ticketCoverBadge) {
    ticketCoverBadge.style.background = `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`;
    if (track.coverArtUrl) {
      const img = document.createElement('img');
      img.src = track.coverArtUrl;
      img.alt = `${track.title} cover art`;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      img.style.borderRadius = 'inherit';
      img.onerror = () => {
        ticketCoverBadge.innerHTML = getCoverEmblemSvg(track.coverEmblem || 'vinyl', c3);
      };
      ticketCoverBadge.innerHTML = '';
      ticketCoverBadge.appendChild(img);
    } else {
      ticketCoverBadge.innerHTML = getCoverEmblemSvg(track.coverEmblem || 'vinyl', c3);
    }
  }

  if (ticketTierTag) {
    ticketTierTag.textContent = track.sourceType === 'local'
      ? (track.chartText ? 'MY CUSTOM SETLIST · CHART' : track.midiBytes ? 'MY CUSTOM SETLIST · MIDI CHART' : 'MY CUSTOM SETLIST')
      : (track.tierName || 'WORLD TOUR').toUpperCase();
  }
  if (ticketSongTitle) ticketSongTitle.textContent = track.title;
  if (ticketSongArtist) ticketSongArtist.textContent = `${track.artist}${track.genre ? ` · ${track.genre}` : ''}`;
  if (ticketBpm) ticketBpm.textContent = track.bpm ? `${track.bpm} BPM` : 'Auto BPM';
  if (ticketDuration) ticketDuration.textContent = formatTime(track.duration);
  if (ticketSkulls) ticketSkulls.innerHTML = renderSkullsHtml(track.difficultyRating || 3);

  const best = highScoresMap[track.id];
  if (ticketBestStars) {
    ticketBestStars.classList.toggle('is-gold', Boolean(best?.isGoldStars));
    ticketBestStars.innerHTML = renderStarsHtml(best?.stars || 0);
  }
  if (ticketBestScore) {
    ticketBestScore.textContent = best
      ? `BEST ${best.grade} · ${best.score.toLocaleString()} (${best.accuracy}%)`
      : 'UNPLAYED GIG';
  }

  const inst = gameState.getInstrumentConfig();
  const laneCfg = gameState.getLaneConfigFor(1);
  const twoP = gameState.isTwoPlayerMode();
  if (ticketInstrumentCaption) ticketInstrumentCaption.textContent = inst.dropDesc;
  if (ticketRoleLabel) ticketRoleLabel.textContent = twoP ? 'PLAYER 1 ROLE' : 'STAGE ROLE';
  if (ticketDiffLabel) ticketDiffLabel.textContent = twoP ? 'P1 DIFFICULTY' : 'DIFFICULTY';
  if (ticketKeysHint) ticketKeysHint.textContent = `${twoP ? 'P1 Keys' : 'Keys'}: ${laneCfg.keys.join(' ')}`;

  if (ticketP2KeysHint && twoP) {
    const p2LaneCfg = gameState.getLaneConfigFor(2);
    ticketP2KeysHint.textContent = `P2 Keys: ${p2LaneCfg.keys.join(' ')}`;
  }

  const venue = getVenueById(gameState.venueId);
  const overlay = getStageOverlayById(gameState.venueOverlayId);
  const lineup = getBandLineupById(gameState.bandLineupId);
  const starLook = getStarLookById(gameState.starLookId);
  const gearName =
    gameState.instrument === 'bass'
      ? getBassModelById(gameState.bassModelId).shortName
      : gameState.instrument === 'drums'
        ? getDrumKitModelById(gameState.drumKitModelId).shortName
        : gameState.instrument === 'piano'
          ? getKeyboardModelById(gameState.keyboardModelId).shortName
          : getGuitarModelById(gameState.guitarModelId).shortName;

  if (ticketVenueStamp) {
    ticketVenueStamp.textContent = overlay && overlay.id !== 'STANDARD'
      ? `${venue.name} · ${overlay.shortName}`
      : venue.name;
  }
  if (ticketGearStamp) {
    const roleSkinId = gameState.getInstrumentSkinFor(gameState.instrument);
    const skin = getInstrumentSkinById(roleSkinId);
    const skinSuffix = skin && skin.id !== 'classic-sunburst' ? ` · ${skin.shortName}` : '';
    const lookSuffix = starLook && starLook.id !== 'default-band' ? ` · ${starLook.shortName}` : '';
    ticketGearStamp.textContent = `${lineup.shortName} · ${gearName}${skinSuffix}${lookSuffix}`;
  }
}

function launchSelectedGig() {
  const track = selectedTrack || BUILTIN_TRACKS[0];
  if (!track) return;
  gameState.endTour();
  startTrack(track, { playbackRate: lobbyPracticeSpeed, isEncore: false });
}

function playNextSong() {
  if (gameState.tourActive && gameState.hasNextTourSong()) {
    const nextTrack = gameState.advanceTourSong();
    if (nextTrack) {
      startTrack(nextTrack, { playbackRate: 1.0, isEncore: gameState.isTourFinalEncore() });
      return;
    }
  }
  const cur = gameState.currentTrack || selectedTrack;
  const list =
    cur?.sourceType === 'local' && savedLocalTracks.length > 1
      ? savedLocalTracks
      : BUILTIN_TRACKS;
  if (!list.length) return;
  const idx = list.findIndex((t) => cur && t.id === cur.id);
  const nextTrack = list[(idx + 1 + list.length) % list.length];
  selectedTrack = nextTrack;
  renderBuiltinTracks();
  renderSavedLibrary();
  renderGigTicket();
  gameState.endTour();
  startTrack(nextTrack, { playbackRate: 1.0, isEncore: false });
}

/* ==========================================================================
   Tab 2: Backstage Gear & Band Bottom Dock (Custom Inline SVG Silhouettes)
   ========================================================================== */

function renderGearDock() {
  if (!gearActiveGrid) return;
  gearActiveGrid.innerHTML = '';

  let items = [];
  let activeId = '';
  let onSelect = null;
  let isHighway = false;

  if (activeGearCategory === 'band') {
    items = BAND_LINEUPS;
    activeId = gameState.bandLineupId;
    onSelect = selectBandLineup;
    const cur = getBandLineupById(activeId);
    if (gearActiveDesc) gearActiveDesc.textContent = cur.description;
  } else if (activeGearCategory === 'stars') {
    items = STAR_LOOKALIKES;
    activeId = gameState.starLookId;
    onSelect = selectStarLook;
    const cur = getStarLookById(activeId);
    if (gearActiveDesc) gearActiveDesc.textContent = cur.description;
  } else if (activeGearCategory === 'guitar') {
    items = GUITAR_MODELS;
    activeId = gameState.guitarModelId;
    onSelect = selectGuitarModel;
    if (gearActiveDesc) gearActiveDesc.textContent = 'Swap your Lead Guitarist’s 3D stage guitar live on stage.';
  } else if (activeGearCategory === 'bass') {
    items = BASS_MODELS;
    activeId = gameState.bassModelId;
    onSelect = selectBassModel;
    if (gearActiveDesc) gearActiveDesc.textContent = 'Equip your Bassist with a classic Precision, Battle Axe, or Neon 5-String.';
  } else if (activeGearCategory === 'drums') {
    items = DRUM_KIT_MODELS;
    activeId = gameState.drumKitModelId;
    onSelect = selectDrumKitModel;
    if (gearActiveDesc) gearActiveDesc.textContent = 'Customize the rear riser kit with Single-Kick, Double-Bass Metal, or Acrylic LED shells.';
  } else if (activeGearCategory === 'piano') {
    items = KEYBOARD_MODELS;
    activeId = gameState.keyboardModelId;
    onSelect = selectKeyboardModel;
    const cur = getKeyboardModelById(activeId);
    if (gearActiveDesc) gearActiveDesc.textContent = cur.description;
  } else if (activeGearCategory === 'skins') {
    items = INSTRUMENT_SKINS;
    activeId =
      activeSkinTargetRole === 'all'
        ? gameState.instrumentSkinId
        : gameState.getInstrumentSkinFor(activeSkinTargetRole);
    onSelect = selectInstrumentSkin;
    const cur = getInstrumentSkinById(activeId);
    if (gearActiveDesc) {
      const roleLabels = { all: 'Full Band', guitar: 'Guitar', bass: 'Bass', drums: 'Drum Kit', piano: 'Piano / Keys' };
      gearActiveDesc.textContent = `${roleLabels[activeSkinTargetRole] || 'Full Band'} Finish — ${cur.description}`;
    }

    // Per-instrument PBR finish target selector row (persisted independently per role!)
    const targetBar = document.createElement('div');
    targetBar.className = 'segmented-group';
    targetBar.style.gridColumn = '1 / -1';
    targetBar.style.justifySelf = 'start';
    targetBar.style.marginBottom = '4px';
    const roles = [
      ['all', 'All Band'],
      ['guitar', 'Guitar'],
      ['bass', 'Bass'],
      ['drums', 'Drums'],
      ['piano', 'Piano'],
    ];
    roles.forEach(([roleId, label]) => {
      const rBtn = document.createElement('button');
      rBtn.type = 'button';
      const isCur = activeSkinTargetRole === roleId;
      rBtn.className = isCur ? 'seg-btn is-active' : 'seg-btn';
      rBtn.setAttribute('aria-pressed', String(isCur));
      rBtn.textContent = label;
      rBtn.addEventListener('click', () => {
        activeSkinTargetRole = roleId;
        renderGearDock();
        syncBackstageCameraFocus();
      });
      targetBar.appendChild(rBtn);
    });
    gearActiveGrid.appendChild(targetBar);
  } else if (activeGearCategory === 'highway') {
    items = HIGHWAY_SKINS;
    activeId = gameState.highwaySkinId;
    onSelect = selectHighwaySkin;
    isHighway = true;
    const cur = getHighwaySkinById(activeId);
    if (gearActiveDesc) gearActiveDesc.textContent = cur.description;
  }

  items.forEach((item) => {
    const active = item.id === activeId;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = active ? 'gear-deck-card is-active' : 'gear-deck-card';
    btn.dataset.gearId = item.id;
    btn.setAttribute('aria-pressed', String(active));

    if (isHighway) {
      const [c1, c2] = item.swatch || ['#0f172a', '#06b6d4'];
      const stripe = item.stripeColor || '#38bdf8';
      btn.innerHTML = `
        <span class="gear-highway-swatch" style="background: linear-gradient(180deg, ${c1} 0%, ${c2} 100%)">
          <span class="gear-highway-lanes">
            <span style="background:${stripe}"></span>
            <span style="background:${stripe}"></span>
            <span style="background:${stripe}"></span>
            <span style="background:${stripe}"></span>
          </span>
        </span>
        <span class="gear-deck-name">${item.name}</span>
        <span class="gear-deck-badge">${active ? 'EQUIPPED' : 'SELECT SKIN'}</span>
      `;
    } else {
      btn.innerHTML = `
        <span class="gear-svg-stage">${item.svgIcon || ''}</span>
        <span class="gear-deck-name">${item.name}</span>
        <span class="gear-deck-badge">${active ? 'EQUIPPED' : 'EQUIP'}</span>
      `;
    }

    btn.addEventListener('click', () => onSelect(item.id));
    gearActiveGrid.appendChild(btn);
  });
}

function selectBandLineup(id) {
  gameState.setBandLineupId(id);
  if (stageBand) stageBand.setBandLineup(gameState.bandLineupId);
  renderGearDock();
  renderGigTicket();
}

function selectStarLook(id) {
  gameState.setStarLookId(id);
  if (stageBand) stageBand.setStarLook(gameState.starLookId);
  renderGearDock();
  renderGigTicket();
}

function selectHighwaySkin(id) {
  gameState.setHighwaySkinId(id);
  renderGearDock();
  renderGigTicket();
}

function selectGuitarModel(id) {
  gameState.setGuitarModelId(id);
  if (stageBand) stageBand.setGuitarModel(gameState.guitarModelId);
  renderGearDock();
  renderGigTicket();
}

function selectBassModel(id) {
  gameState.setBassModelId(id);
  if (stageBand) stageBand.setBassModel(gameState.bassModelId);
  renderGearDock();
  renderGigTicket();
}

function selectDrumKitModel(id) {
  gameState.setDrumKitModelId(id);
  if (stageBand) stageBand.setDrumKitModel(gameState.drumKitModelId);
  renderGearDock();
  renderGigTicket();
}

function selectKeyboardModel(id) {
  gameState.setKeyboardModelId(id);
  if (stageBand) stageBand.setKeyboardModel(gameState.keyboardModelId);
  renderGearDock();
  renderGigTicket();
}

function selectInstrumentSkin(id) {
  gameState.setInstrumentSkinId(id, activeSkinTargetRole);
  if (stageBand) stageBand.setInstrumentSkin(id, activeSkinTargetRole);
  renderGearDock();
  renderGigTicket();
}

/* ==========================================================================
   Tab 3: Venues Horizontal Tour-Poster Carousel
   ========================================================================== */

const VENUE_POSTER_ACCENTS = [
  '#38bdf8', '#a855f7', '#f472b6', '#22d3ee', '#facc15', '#f97316',
  '#38bdf8', '#06b6d4', '#ef4444', '#f59e0b', '#22c55e', '#fb923c',
];

function renderOverlaySelector() {
  if (!venueOverlayGrid) return;
  venueOverlayGrid.innerHTML = '';

  STAGE_OVERLAYS.forEach((ov) => {
    const active = ov.id === gameState.venueOverlayId;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = active ? 'venue-overlay-btn is-active' : 'venue-overlay-btn';
    btn.dataset.overlayId = ov.id;
    btn.style.setProperty('--overlay-accent', ov.accentCss || '#38bdf8');
    btn.setAttribute('aria-pressed', String(active));
    btn.title = ov.description || ov.name;
    btn.innerHTML = `
      <span class="venue-overlay-dot" aria-hidden="true"></span>
      <span>${ov.shortName}</span>
    `;
    btn.addEventListener('click', () => selectVenueOverlay(ov.id));
    venueOverlayGrid.appendChild(btn);
  });

  syncVenueBanner(getVenueById(gameState.venueId), getStageOverlayById(gameState.venueOverlayId));
}

function renderVenueSelector() {
  if (!venueSelectorGrid) return;
  venueSelectorGrid.innerHTML = '';

  VENUES.forEach((v, idx) => {
    const active = v.id === gameState.venueId;
    const accent = VENUE_POSTER_ACCENTS[idx % VENUE_POSTER_ACCENTS.length];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = active ? 'venue-poster-card is-active' : 'venue-poster-card';
    btn.dataset.venueId = v.id;
    btn.style.setProperty('--poster-accent', accent);
    btn.setAttribute('aria-pressed', String(active));
    btn.innerHTML = `
      <span class="venue-poster-type">${v.type}</span>
      <span class="venue-poster-name">${v.name}</span>
      <span class="venue-poster-loc">${v.location}</span>
    `;
    btn.addEventListener('click', () => selectVenue(v.id));
    venueSelectorGrid.appendChild(btn);
  });

  syncVenueBanner(getVenueById(gameState.venueId), getStageOverlayById(gameState.venueOverlayId));
}

function syncVenueBanner(meta, overlayMeta = getStageOverlayById(gameState.venueOverlayId)) {
  if (venueActiveType) venueActiveType.textContent = meta.type;
  if (venueActiveName) venueActiveName.textContent = meta.name;
  if (venueActiveCity) venueActiveCity.textContent = meta.location;
  if (venueActiveOverlayTag && overlayMeta) {
    venueActiveOverlayTag.textContent = overlayMeta.name.toUpperCase();
    venueActiveOverlayTag.style.borderColor = overlayMeta.accentCss || '';
  }
  if (venueActiveDesc) {
    venueActiveDesc.textContent = overlayMeta && overlayMeta.id !== 'STANDARD'
      ? `${meta.description} · ${overlayMeta.name}: ${overlayMeta.description}`
      : meta.description;
  }
}

function scrollActiveVenueIntoView() {
  if (!venueSelectorGrid) return;
  const activeCard = venueSelectorGrid.querySelector('.venue-poster-card.is-active');
  if (activeCard) {
    activeCard.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }
}

function selectVenue(venueId) {
  const meta = getVenueById(venueId);
  gameState.setVenueId(meta.id);
  if (stageBand) {
    stageBand.setVenue(meta.id, gameState.venueOverlayId);
  }
  syncVenueBanner(meta, getStageOverlayById(gameState.venueOverlayId));
  if (venueSelectorGrid) {
    venueSelectorGrid.querySelectorAll('.venue-poster-card').forEach((card) => {
      const active = card.dataset.venueId === meta.id;
      card.classList.toggle('is-active', active);
      card.setAttribute('aria-pressed', String(active));
    });
    scrollActiveVenueIntoView();
  }
  renderGigTicket();
}

function selectVenueOverlay(overlayId) {
  const overlayMeta = getStageOverlayById(overlayId);
  gameState.setVenueOverlayId(overlayMeta.id);
  if (stageBand) {
    stageBand.setVenue(gameState.venueId, overlayMeta.id);
  }
  syncVenueBanner(getVenueById(gameState.venueId), overlayMeta);
  if (venueOverlayGrid) {
    venueOverlayGrid.querySelectorAll('.venue-overlay-btn').forEach((btn) => {
      const active = btn.dataset.overlayId === overlayMeta.id;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }
  renderGigTicket();
}

function stepVenue(delta) {
  const idx = VENUES.findIndex((v) => v.id === gameState.venueId);
  const nextIdx = (Math.max(0, idx) + delta + VENUES.length) % VENUES.length;
  selectVenue(VENUES[nextIdx].id);
}

/* ==========================================================================
   Multi-Song Tour Setlist Popover
   ========================================================================== */

function renderTourSetlistQueue() {
  const q = gameState.setlistQueue;
  if (tourQueueBadge) tourQueueBadge.textContent = String(q.length);
  if (!tourQueueList) return;
  tourQueueList.innerHTML = '';

  const ready = q.length >= 2;
  btnStartTour.disabled = !ready;
  btnStartTour.textContent = ready
    ? `Start Tour (${q.length} Songs)`
    : `Start Tour (Add ${Math.max(0, 2 - q.length)}+)`;
  btnClearTour.classList.toggle('is-hidden', q.length === 0);

  if (q.length === 0) {
    tourQueueCaption.textContent =
      'Queue 2+ songs — the closing track unlocks your Gold-and-Pyro Final Encore!';
    return;
  }

  tourQueueCaption.textContent = ready
    ? `${q.length} songs queued · "${q[q.length - 1].title}" is locked in as your FINAL ENCORE!`
    : 'Queue 1 more song to start a Multi-Song Tour with a Final Encore!';

  q.forEach((track, idx) => {
    const isEncoreSlot = q.length >= 2 && idx === q.length - 1;
    const item = document.createElement('div');
    item.className = isEncoreSlot ? 'tour-queue-item is-encore-slot' : 'tour-queue-item';
    item.innerHTML = `
      <span class="tour-slot-num">${isEncoreSlot ? 'FINAL ENCORE' : `SONG ${idx + 1}`}</span>
      <span class="tour-slot-title">${track.title}</span>
      <span class="tour-slot-controls">
        <button type="button" class="tour-slot-btn" data-move="-1" aria-label="Move earlier">←</button>
        <button type="button" class="tour-slot-btn" data-move="1" aria-label="Move later">→</button>
        <button type="button" class="tour-slot-btn" data-remove="1" aria-label="Remove from queue">×</button>
      </span>
    `;

    item.querySelector('[data-move="-1"]').addEventListener('click', () => {
      gameState.moveSetlistItem(idx, -1);
      renderTourSetlistQueue();
    });
    item.querySelector('[data-move="1"]').addEventListener('click', () => {
      gameState.moveSetlistItem(idx, 1);
      renderTourSetlistQueue();
    });
    item.querySelector('[data-remove="1"]').addEventListener('click', () => {
      gameState.removeFromSetlist(idx);
      renderTourSetlistQueue();
    });

    tourQueueList.appendChild(item);
  });
}

function setTourPopoverOpen(open) {
  if (!tourQueuePopover || !btnTourQueueToggle) return;
  tourQueuePopover.classList.toggle('is-hidden', !open);
  btnTourQueueToggle.setAttribute('aria-expanded', String(open));
}

function startTourSetlist() {
  const firstTrack = gameState.startTour();
  if (!firstTrack) return;
  setTourPopoverOpen(false);
  startTrack(firstTrack, { playbackRate: 1.0, isEncore: false });
}

/* ==========================================================================
   Instrument, Difficulty, Practice Speed & Stage Pedals
   ========================================================================== */

function renderPedalStripForPlayer(container, player) {
  if (!container) return;
  const config = gameState.getLaneConfigFor(player);
  container.innerHTML = '';
  container.dataset.lanes = String(config.count);

  config.keys.forEach((keyLabel, laneIndex) => {
    const color = config.colors[laneIndex];
    const panPct = Math.round((-0.8 + (laneIndex / Math.max(1, config.count - 1)) * 1.6) * 100);
    const panText = panPct === 0 ? 'C' : panPct < 0 ? `L${Math.abs(panPct)}` : `R${panPct}`;

    const pedal = document.createElement('button');
    pedal.type = 'button';
    pedal.className = 'stage-pedal';
    pedal.dataset.lane = String(laneIndex);
    pedal.dataset.player = String(player);
    pedal.style.setProperty('--pedal-color', color.base);
    pedal.style.setProperty('--pedal-bright', color.bright);
    pedal.style.setProperty('--pedal-glow', color.glow);
    pedal.setAttribute('aria-label', `Player ${player} Lane ${laneIndex + 1} (${keyLabel})`);

    pedal.innerHTML = `
      <span class="pedal-led" aria-hidden="true"></span>
      <span class="pedal-key">${keyLabel}</span>
      <span class="pedal-pan tabular" aria-hidden="true">${panText}</span>
    `;

    pedal.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const exactPlaybackSec = audioEngine.getExactPlaybackTime(e.timeStamp);
      if (pedal.setPointerCapture) {
        try {
          pedal.setPointerCapture(e.pointerId);
        } catch {
          // Ignore
        }
      }
      handleLanePress(laneIndex, e.timeStamp, exactPlaybackSec, player);
    });

    const onUp = () => handleLaneRelease(laneIndex, player);
    pedal.addEventListener('pointerup', onUp);
    pedal.addEventListener('pointercancel', onUp);
    pedal.addEventListener('lostpointercapture', onUp);

    container.appendChild(pedal);
  });
}

function renderStagePedals() {
  renderPedalStripForPlayer(stagePedalsContainer, 1);
  const twoP = gameState.isTwoPlayerMode();
  if (stagePedalsP2Container) {
    stagePedalsP2Container.classList.toggle('is-hidden', !twoP);
    if (twoP) {
      renderPedalStripForPlayer(stagePedalsP2Container, 2);
    } else {
      stagePedalsP2Container.innerHTML = '';
    }
  }
}

function selectPlayMode(mode) {
  gameState.setPlayMode(mode);
  const twoP = gameState.isTwoPlayerMode();
  if (arenaRoot) arenaRoot.dataset.playMode = gameState.playMode;
  playModeButtons.forEach((btn) => {
    const active = btn.dataset.playMode === gameState.playMode;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
  if (p2ConfigRow) {
    p2ConfigRow.classList.toggle('is-hidden', !twoP);
  }
  if (ticketModeHint) {
    ticketModeHint.textContent =
      gameState.playMode === 'coop'
        ? 'Shared Crowd Hype · Combined Band Score'
        : gameState.playMode === 'faceoff'
          ? 'Head-to-Head Arena Duel!'
          : 'Solo Stage Performance';
  }
  if (stageBand) {
    stageBand.setActivePlayers(
      twoP ? [gameState.instrument, gameState.p2Instrument] : [gameState.instrument],
      gameState.feverActive
    );
  }
  renderStagePedals();
  renderGigTicket();
}

function selectP2Instrument(id) {
  gameState.setP2Instrument(id);
  p2InstrumentButtons.forEach((btn) => {
    const active = btn.dataset.p2Instrument === gameState.p2Instrument;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
  if (stageBand && gameState.isTwoPlayerMode()) {
    stageBand.setActivePlayers([gameState.instrument, gameState.p2Instrument], gameState.feverActive);
  }
  renderGigTicket();
}

function selectP2Difficulty(id) {
  gameState.setP2Difficulty(id);
  p2DifficultyButtons.forEach((btn) => {
    const active = btn.dataset.p2Difficulty === gameState.p2Difficulty;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
  renderStagePedals();
  renderGigTicket();
}

function selectInstrument(id) {
  gameState.setInstrument(id);
  arenaRoot.dataset.instrument = gameState.instrument;
  if (stageBand) {
    stageBand.setInstrumentTheme(gameState.instrument, gameState.feverActive);
    stageBand.setActivePlayers(
      gameState.isTwoPlayerMode() ? [gameState.instrument, gameState.p2Instrument] : [gameState.instrument],
      gameState.feverActive
    );
  }
  instrumentButtons.forEach((btn) => {
    const active = btn.dataset.instrumentChoice === gameState.instrument;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
  renderGigTicket();
}

function selectDifficulty(id) {
  gameState.setDifficulty(id);
  difficultyButtons.forEach((btn) => {
    const active = btn.dataset.difficulty === gameState.difficulty;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
  renderStagePedals();
  renderGigTicket();
}

function selectLobbyPracticeSpeed(rate) {
  lobbyPracticeSpeed = Number(rate) || 1.0;
  lobbySpeedButtons.forEach((btn) => {
    const r = Number(btn.dataset.lobbySpeed);
    const active = Math.abs(r - lobbyPracticeSpeed) < 0.01;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
}

function selectCameraMode(mode) {
  gameState.setCameraMode(mode);
  if (stageBand) {
    stageBand.setCameraMode(gameState.cameraMode);
  }
  cameraModeButtons.forEach((btn) => {
    const active = btn.dataset.cameraMode === gameState.cameraMode;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
}

function syncCalibrationUI() {
  const val = gameState.latencyOffsetMs;
  audioEngine.setAudioOffsetMs(val);
  const formatted = `${val > 0 ? '+' : ''}${val} ms`;
  latencySlider.value = String(val);
  latencyReadout.textContent = formatted;
  backstageLatencyVal.textContent = formatted;

  const volPct = Math.round(gameState.crowdVolume * 100);
  if (crowdVolumeSlider) crowdVolumeSlider.value = String(volPct);
  if (crowdVolumeReadout) crowdVolumeReadout.textContent = `${volPct}%`;
  sfx.setCrowdVolume(gameState.crowdVolume);
  if (stageBand?.crowdAmbience) {
    stageBand.crowdAmbience.setVolume(gameState.crowdVolume, gameState.sfxMuted);
  }

  const sfxPct = Math.round(gameState.sfxVolume * 100);
  if (sfxVolumeSlider) sfxVolumeSlider.value = String(sfxPct);
  if (sfxVolumeReadout) sfxVolumeReadout.textContent = `${sfxPct}%`;
  sfx.setSfxVolume(gameState.sfxVolume);

  const shieldOn = Boolean(gameState.moraleShield);
  if (moraleShieldToggle) moraleShieldToggle.checked = shieldOn;
  if (pauseMoraleShieldToggle) pauseMoraleShieldToggle.checked = shieldOn;
  if (moraleShieldReadout) {
    moraleShieldReadout.textContent = shieldOn ? 'ACTIVE · Shielded' : 'OFF · Classic 5% Floor';
  }
  if (hudMoraleShieldBadge) {
    hudMoraleShieldBadge.classList.toggle('is-hidden', !shieldOn);
  }
}

function stopTapCalibration() {
  tapCalibrateState.active = false;
  tapCalibrateState.timers.forEach((id) => window.clearTimeout(id));
  tapCalibrateState.timers = [];
  if (btnTapCalibrate) btnTapCalibrate.textContent = '4-Beat Tap to Calibrate';
}

function startTapCalibration() {
  unlockSharedAudio();
  stopTapCalibration();
  tapCalibrateState.active = true;
  tapCalibrateState.beatTimesMs = [];
  tapCalibrateState.deltasMs = [];
  if (btnTapCalibrate) btnTapCalibrate.textContent = 'TAP ON BEAT…';
  if (tapCalibrateStatus) tapCalibrateStatus.textContent = 'Listen & tap Space / D (4 beats)';

  const beatMs = 500; // crisp 120 BPM metronome
  const basePerf = performance.now() + 260;

  for (let b = 0; b < 4; b += 1) {
    const targetMs = basePerf + b * beatMs;
    tapCalibrateState.beatTimesMs.push(targetMs);
    const tid = window.setTimeout(() => {
      if (!tapCalibrateState.active) return;
      sfx.playCalibrationMetronomeTick(b === 0);
      if (tapCalibrateStatus) {
        tapCalibrateStatus.textContent = `Beat ${b + 1} / 4 · TAP NOW!`;
      }
    }, Math.max(0, targetMs - performance.now()));
    tapCalibrateState.timers.push(tid);
  }

  const endTid = window.setTimeout(() => {
    finishTapCalibration();
  }, basePerf + 4 * beatMs + 320 - performance.now());
  tapCalibrateState.timers.push(endTid);
}

function recordCalibrationTap() {
  if (!tapCalibrateState.active || tapCalibrateState.beatTimesMs.length === 0) return;
  const now = performance.now();
  let bestDelta = Infinity;
  for (let i = 0; i < tapCalibrateState.beatTimesMs.length; i += 1) {
    const d = now - tapCalibrateState.beatTimesMs[i];
    if (Math.abs(d) < Math.abs(bestDelta)) bestDelta = d;
  }
  if (Math.abs(bestDelta) <= 220) {
    tapCalibrateState.deltasMs.push(bestDelta);
    if (tapCalibrateStatus) {
      tapCalibrateStatus.textContent = `Captured ${tapCalibrateState.deltasMs.length} / 4 taps`;
    }
    if (tapCalibrateState.deltasMs.length >= 4) {
      finishTapCalibration();
    }
  }
}

function finishTapCalibration() {
  const deltas = [...tapCalibrateState.deltasMs].sort((a, b) => a - b);
  stopTapCalibration();
  if (deltas.length < 2) {
    if (tapCalibrateStatus) tapCalibrateStatus.textContent = 'Tap at least 2 beats to calibrate';
    return;
  }
  const mid = Math.floor(deltas.length / 2);
  const median = deltas.length % 2 === 1 ? deltas[mid] : (deltas[mid - 1] + deltas[mid]) * 0.5;
  const snapped = Math.max(-150, Math.min(150, Math.round(median / 5) * 5));
  gameState.setLatencyOffsetMs(snapped);
  syncCalibrationUI();
  if (tapCalibrateStatus) {
    tapCalibrateStatus.textContent = `Calibrated: ${snapped > 0 ? '+' : ''}${snapped} ms`;
  }
}

function setPlaybackRateUnified(rate) {
  const clamped = Math.max(0.5, Math.min(1.15, Number(rate) || 1.0));
  gameState.setPlaybackRate(clamped);
  audioEngine.setPlaybackRate(clamped);
  audioEngine.setPracticeStemFocus(clamped < 0.99 ? 'boost' : 'full');
  syncPracticeLoopUI();
}

function setTrainerOpen(open) {
  trainerOpen = Boolean(open);
  if (practiceSectionTrainer) {
    practiceSectionTrainer.classList.toggle('is-hidden', !trainerOpen);
  }
  if (btnToggleTrainer) {
    btnToggleTrainer.setAttribute('aria-pressed', String(trainerOpen));
    btnToggleTrainer.classList.toggle('stage-btn-primary', trainerOpen);
  }
}

function buildTrainerSectionsStrip(durationSec = 90) {
  if (!trainerSectionsStrip) return;
  trainerSectionsStrip.innerHTML = '';

  let list = Array.isArray(activeSections)
    ? activeSections.filter((s) => Number.isFinite(s?.startSec))
    : [];

  if (list.length === 0) {
    const dur = Math.max(20, Number(durationSec) || 90);
    const step = dur <= 70 ? 15 : 22;
    list = [];
    let idx = 1;
    for (let t = 0; t < dur - 4; t += step) {
      const end = Math.min(dur - 0.5, t + step);
      list.push({ label: idx === 1 ? 'Intro' : `Part ${idx}`, startSec: t, endSec: end });
      idx += 1;
    }
  }

  list.forEach((sec, idx) => {
    const startSec = Math.max(0, Number(sec.startSec) || 0);
    const nextStart = idx + 1 < list.length ? Number(list[idx + 1].startSec) : Number(durationSec || startSec + 20);
    const endSec = Math.max(startSec + 1.5, Number(sec.endSec) || nextStart || startSec + 20);
    const label = sec.label || sec.type || `Section ${idx + 1}`;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'trainer-section-chip';
    btn.dataset.startSec = String(startSec);
    btn.dataset.endSec = String(endSec);
    btn.textContent = label;
    btn.addEventListener('click', () => {
      if (gameState.screen !== SCREENS.STAGE) return;
      const lp = gameState.practiceLoop;
      const sameLoop =
        lp.enabled &&
        lp.startSec !== null &&
        lp.endSec !== null &&
        Math.abs(lp.startSec - startSec) < 0.25 &&
        Math.abs(lp.endSec - endSec) < 0.25;

      if (sameLoop) {
        gameState.clearPracticeLoop();
      } else {
        gameState.setLoopStart(startSec);
        gameState.setLoopEnd(endSec);
        resetNotesFromTimestamp(startSec);
        audioEngine.seekTo(startSec);
        audioEngine.setInstrumentStemMuted(false);
        gameState.stemDropped = false;
        gameState.p2.stemDropped = false;
      }
      syncPracticeLoopUI();
    });
    trainerSectionsStrip.appendChild(btn);
  });
}

function syncPracticeLoopUI() {
  const lp = gameState.practiceLoop;
  practiceLoopToggle.checked = lp.enabled;

  const startStr = lp.startSec !== null ? formatTime(lp.startSec) : '—';
  const endStr = lp.endSec !== null ? formatTime(lp.endSec) : '—';
  loopBoundsReadout.textContent = `Loop: ${startStr} → ${endStr}`;
  if (trainerLoopReadout) {
    trainerLoopReadout.textContent = gameState.hasValidPracticeLoop()
      ? `Loop: ${startStr} → ${endStr}`
      : lp.startSec !== null
        ? `A: ${startStr} → ?`
        : 'Loop: OFF';
  }

  speedButtons.forEach((btn) => {
    const r = Number(btn.dataset.playbackRate);
    const active = Math.abs(r - gameState.playbackRate) < 0.01;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  });

  trainerSpeedButtons.forEach((btn) => {
    const r = Number(btn.dataset.trainerSpeed);
    const active = Math.abs(r - gameState.playbackRate) < 0.01;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  });

  if (trainerSectionsStrip) {
    trainerSectionsStrip.querySelectorAll('.trainer-section-chip').forEach((chip) => {
      const s = Number(chip.dataset.startSec);
      const e = Number(chip.dataset.endSec);
      const active =
        lp.enabled &&
        lp.startSec !== null &&
        lp.endSec !== null &&
        Math.abs(lp.startSec - s) < 0.25 &&
        Math.abs(lp.endSec - e) < 0.25;
      chip.classList.toggle('is-active', active);
    });
  }

  if (grandEncoreActive) {
    hudLoopReadout.textContent = '✨ GRAND ENCORE FINALE ✨';
    hudLoopReadout.classList.remove('is-hidden');
  } else if (gameState.hasValidPracticeLoop()) {
    hudLoopReadout.textContent = `Loop ${startStr}–${endStr} · ${Math.round(gameState.playbackRate * 100)}%`;
    hudLoopReadout.classList.remove('is-hidden');
  } else if (gameState.isEncorePerformance) {
    hudLoopReadout.textContent = '★ FINAL ENCORE · +10% SCORE';
    hudLoopReadout.classList.remove('is-hidden');
  } else if (Math.abs(gameState.playbackRate - 1.0) > 0.01) {
    hudLoopReadout.textContent =
      gameState.playbackRate >= 1.09
        ? `Encore Speed-Up · ${Math.round(gameState.playbackRate * 100)}%`
        : `Practice Speed · ${Math.round(gameState.playbackRate * 100)}%`;
    hudLoopReadout.classList.remove('is-hidden');
  } else {
    hudLoopReadout.classList.add('is-hidden');
  }
}

function setScreen(nextScreen) {
  gameState.setScreen(nextScreen);
  if (mainMenuOverlay) {
    mainMenuOverlay.classList.toggle('is-hidden', nextScreen !== SCREENS.MAIN_MENU);
  }
  backstageOverlay.classList.toggle('is-hidden', nextScreen !== SCREENS.BACKSTAGE);
  pauseDrawer.classList.toggle('is-hidden', nextScreen !== SCREENS.PAUSED && !calibrationOnlyMode);
  intermissionOverlay.classList.toggle('is-hidden', nextScreen !== SCREENS.INTERMISSION);
  resultsOverlay.classList.toggle('is-hidden', nextScreen !== SCREENS.RESULTS);
  tourSummaryOverlay.classList.toggle('is-hidden', nextScreen !== SCREENS.TOUR_SUMMARY);

  const isStage = nextScreen === SCREENS.STAGE || nextScreen === SCREENS.PAUSED;
  const isArenaShowcase = nextScreen === SCREENS.BACKSTAGE || nextScreen === SCREENS.MAIN_MENU;
  arenaRoot.classList.toggle('stage-live', isStage);
  arenaRoot.classList.toggle('stage-backstage', isArenaShowcase);
  arenaRoot.classList.toggle('stage-main-menu', nextScreen === SCREENS.MAIN_MENU);

  if (nextScreen === SCREENS.MAIN_MENU && stageBand) {
    stageBand.setBackstageFocus('setlist');
  } else if (nextScreen === SCREENS.BACKSTAGE) {
    syncBackstageCameraFocus();
  }
}

function showScanProgress(title, sub, pct = null) {
  scanOverlayTitle.textContent = title;
  scanOverlaySub.textContent = sub;
  const optionalDspStatus = document.getElementById('dspStatus');
  if (optionalDspStatus) optionalDspStatus.textContent = sub;
  if (scanProgressWrap && scanProgressFill && scanProgressPct) {
    if (typeof pct === 'number' && Number.isFinite(pct)) {
      const clamped = Math.max(0, Math.min(100, Math.round(pct)));
      scanProgressWrap.classList.remove('is-hidden');
      scanProgressFill.style.transform = `scaleX(${(clamped / 100).toFixed(3)})`;
      scanProgressPct.textContent = `${clamped}%`;
    } else {
      scanProgressWrap.classList.add('is-hidden');
    }
  }
  scanOverlay.classList.remove('is-hidden');
}

function hideScanProgress() {
  const optionalDspStatus = document.getElementById('dspStatus');
  if (optionalDspStatus) optionalDspStatus.textContent = '';
  scanOverlay.classList.add('is-hidden');
}

function hideSongTitleMarquee() {
  if (songTitleMarqueeTimeout) {
    window.clearTimeout(songTitleMarqueeTimeout);
    songTitleMarqueeTimeout = null;
  }
  if (ghSongMarquee) {
    ghSongMarquee.classList.remove('is-visible');
    ghSongMarquee.setAttribute('aria-hidden', 'true');
  }
}

function showSongTitleMarquee(track, bpm, isEncore = false) {
  if (!ghSongMarquee || !track) return;
  hideSongTitleMarquee();

  const inst = gameState.getInstrumentConfig();
  const diff = gameState.getDifficultyConfig();

  ghSongMarquee.classList.toggle('is-encore', Boolean(isEncore));
  ghMarqueeKicker.textContent = isEncore ? '★ FINAL ENCORE PERFORMANCE' : 'NOW PERFORMING LIVE';
  ghMarqueeTitle.textContent = track.title || 'Live Track';
  ghMarqueeArtist.textContent = track.artist || 'Custom Recording';
  ghMarqueeMeta.textContent = `${inst.label} · ${diff.label} · ${Math.round(bpm || 120)} BPM`;

  ghSongMarquee.setAttribute('aria-hidden', 'false');
  void ghSongMarquee.offsetWidth;
  ghSongMarquee.classList.add('is-visible');

  songTitleMarqueeTimeout = window.setTimeout(() => {
    hideSongTitleMarquee();
  }, 3500);
}

/* ==========================================================================
   Custom MP3/WAV + Optional .MID Dropzone & Neural Chart Generation
   ========================================================================== */

async function handleLocalFilesSelected(files) {
  if (!files || files.length === 0) return;
  unlockSharedAudio();

  const audioFile = files.find(
    (f) => f.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac|aac|webm)$/i.test(f.name)
  );
  const midiFile = files.find((f) => /\.(mid|midi)$/i.test(f.name));
  const chartFile = files.find((f) => /\.chart$/i.test(f.name));

  // Allow attaching a .chart or .mid file directly to the currently selected custom track
  if (!audioFile && (midiFile || chartFile) && selectedTrack?.sourceType === 'local') {
    try {
      const patch = { charts: {} };
      if (chartFile) {
        const chartText = await chartFile.text();
        selectedTrack.chartText = chartText;
        selectedTrack.chartFileName = chartFile.name;
        selectedTrack.genre = 'Custom Audio + CHART';
        patch.chartText = chartText;
        patch.chartFileName = chartFile.name;
        patch.genre = selectedTrack.genre;
      }
      if (midiFile) {
        const midiBytes = await midiFile.arrayBuffer();
        selectedTrack.midiBytes = midiBytes;
        selectedTrack.midiFileName = midiFile.name;
        if (!chartFile) selectedTrack.genre = 'Custom Audio + MIDI';
        patch.midiBytes = midiBytes;
        patch.midiFileName = midiFile.name;
        patch.genre = selectedTrack.genre;
      }
      selectedTrack.charts = {};
      await updateLocalTrackChartCache(selectedTrack.id, null, null, selectedTrack.bpm, patch);
      const pairedName = chartFile ? chartFile.name : midiFile.name;
      dropStatusEl.textContent = `Paired "${pairedName}" with "${selectedTrack.title}"!`;
      dropStatusEl.classList.remove('is-error');
      renderSavedLibrary();
      renderGigTicket();
    } catch (err) {
      dropStatusEl.textContent = err.message || 'Could not load that chart file.';
      dropStatusEl.classList.add('is-error');
    }
    return;
  }

  if (!audioFile) {
    dropStatusEl.textContent = 'Drop an MP3, WAV, OGG, or M4A song (plus an optional .MID or .CHART file).';
    dropStatusEl.classList.add('is-error');
    return;
  }

  dropStatusEl.textContent = `Adding "${audioFile.name}" & reading song metadata…`;
  dropStatusEl.classList.remove('is-error');
  showScanProgress('Loading Song', `Reading tags & preparing "${audioFile.name}"…`, 12);

  try {
    const ctx = audioEngine.getContext();
    const record = await importLocalAudioFile(audioFile, ctx, midiFile || null, chartFile || null, {
      existingTracks: savedLocalTracks,
      schemaVersion: CHART_SCHEMA_VERSION,
    });

    savedLocalTracks = [record, ...savedLocalTracks.filter((item) => item.id !== record.id)];
    switchSetlistSubTab('custom');
    selectTrackForTicket(record);

    dropStatusEl.textContent = record.replayedFromCache
      ? `Ready — Cached to IndexedDB! Instant 0ms load for "${record.title}"!`
      : chartFile
        ? `Added "${record.title}" with .CHART track to your setlist!`
        : midiFile
          ? `Added "${record.title}" with MIDI chart to your setlist!`
          : `Added "${record.title}" — ${record.artist} to your setlist!`;

    hideScanProgress();
    gameState.endTour();
    await startTrack(record, { playbackRate: lobbyPracticeSpeed, isEncore: false });
  } catch (err) {
    hideScanProgress();
    dropStatusEl.textContent = err.message || 'Could not load that audio file.';
    dropStatusEl.classList.add('is-error');
  }
}

async function startTrack(track, { playbackRate = 1.0, keepPracticeLoop = false, isEncore = false } = {}) {
  calibrationOnlyMode = false;
  setTourPopoverOpen(false);
  unlockSharedAudio();
  const ctx = audioEngine.getContext();

  const twoP = gameState.isTwoPlayerMode();
  const inst = gameState.getInstrumentConfig();
  const diff = gameState.getDifficultyConfig();
  const p2Inst = gameState.getInstrumentConfigFor(2);
  const p2Diff = gameState.getDifficultyConfigFor(2);
  const chartKey = `${CHART_CACHE_VERSION}_${gameState.instrument}_${gameState.laneCount}_${diff.id}`;
  const chartKeyP2 = `${CHART_CACHE_VERSION}_${p2Inst.id}_${p2Diff.laneCount}_${p2Diff.id}`;

  try {
    let mediaSource = null;
    let chart = null;
    let chartP2 = null;
    let activeStemActivity = null;
    let decodedBuffer = null;
    let cachedAnalysis = null;

    if (track.sourceType === 'builtin') {
      // 0ms pre-authored musical chart + cached multi-stem WebAudio synthesis
      showScanProgress(`Setting Up ${track.title}`, `Tuning ${inst.label} rig & stage lighting…`);
      chart = buildPreauthoredBuiltinChart(track, {
        instrument: gameState.instrument,
        difficulty: diff.id,
        laneCount: gameState.laneCount,
      });
      if (twoP) {
        chartP2 = buildPreauthoredBuiltinChart(track, {
          instrument: p2Inst.id,
          difficulty: p2Diff.id,
          laneCount: p2Diff.laneCount,
        });
      }
      const stems = await ensureBuiltinStems(track);
      mediaSource = {
        mode: 'stems',
        drums: stems.drums,
        bass: stems.bass,
        guitar: stems.guitar,
        piano: stems.piano,
      };
      activeStemActivity = computeStemActivityFromBuffers(stems);
    } else {
      showScanProgress(`Loading ${track.title}`, 'Decoding concert audio…', 4);
      decodedBuffer = await decodeStoredLocalTrack(track, ctx);
      mediaSource = workerStemMediaCache.get(track.id) || { mode: 'local', buffer: decodedBuffer };

      cachedAnalysis = workerAnalysisCache.get(track.id) || track.workerAnalysis || null;
      if (cachedAnalysis && cachedAnalysis.schemaVersion !== CHART_SCHEMA_VERSION) {
        cachedAnalysis = null;
      }
      if (cachedAnalysis) {
        workerAnalysisCache.set(track.id, cachedAnalysis);
        if (cachedAnalysis.separatedStems && !workerStemMediaCache.has(track.id)) {
          const builtStems = audioEngine.buildSeparatedStemBuffers(cachedAnalysis.separatedStems);
          if (builtStems) {
            workerStemMediaCache.set(track.id, builtStems);
            mediaSource = builtStems;
          }
        }
      }

      if (track.charts && track.charts[chartKey]) {
        chart = track.charts[chartKey];
        if (cachedAnalysis?.stemActivity) {
          activeStemActivity = cachedAnalysis.stemActivity;
        } else if (track.stemActivity) {
          activeStemActivity = track.stemActivity;
        } else {
          cachedAnalysis = await analyzeAudioInWorker(decodedBuffer, {
            bpmHint: track.bpm || null,
            onProgress: (pct, msg) => {
              const uiPct = Math.max(4, Math.min(99, Math.round(pct * 100)));
              const text = msg || `Stage 1/5: Stereo STFT & SuperFlux Spectral Flux (${uiPct}%)...`;
              showScanProgress(`4-Stem DSP: ${track.title}`, text, uiPct);
              if (dropStatusEl) dropStatusEl.textContent = text;
            },
          });
          if (cachedAnalysis.separatedStems) {
            const builtStems = audioEngine.buildSeparatedStemBuffers(cachedAnalysis.separatedStems);
            if (builtStems) {
              workerStemMediaCache.set(track.id, builtStems);
              mediaSource = builtStems;
            }
          }
          const persistableAnalysis = stripStemsForStorage(cachedAnalysis);
          workerAnalysisCache.set(track.id, persistableAnalysis);
          track.workerAnalysis = persistableAnalysis;
          track.stemActivity = persistableAnalysis.stemActivity;
          activeStemActivity = persistableAnalysis.stemActivity;
          await updateLocalTrackChartCache(track.id, null, null, persistableAnalysis.bpm, {
            workerAnalysis: persistableAnalysis,
            stemActivity: persistableAnalysis.stemActivity,
          });
          if (dropStatusEl) dropStatusEl.textContent = 'Ready — Cached to IndexedDB!';
        }
      } else {
        chart = await analyzeAndBuildChart({
          audioBuffer: decodedBuffer,
          cachedWorkerAnalysis: cachedAnalysis,
          stemActivity: cachedAnalysis?.stemActivity || track.stemActivity || null,
          trackId: track.id,
          instrument: gameState.instrument,
          laneCount: gameState.laneCount,
          difficultyConfig: diff,
          bpmHint: track.bpm || null,
          midiBytes: track.midiBytes || null,
          chartText: track.chartText || null,
          onProgress: (pct, msg) => {
            const uiPct = Math.max(4, Math.min(100, Math.round(pct * 100)));
            const text =
              msg || `Analyzing ${inst.label.toLowerCase()} stems & 192 PPQ sync for ${track.title}…`;
            showScanProgress(`4-Stem DSP: ${track.title}`, text, uiPct);
            if (dropStatusEl) dropStatusEl.textContent = text;
          },
        });

        activeStemActivity = chart.stemActivity || cachedAnalysis?.stemActivity || null;
        if (chart.workerAnalysis?.separatedStems) {
          const builtStems = audioEngine.buildSeparatedStemBuffers(chart.workerAnalysis.separatedStems);
          if (builtStems) {
            workerStemMediaCache.set(track.id, builtStems);
            mediaSource = builtStems;
          }
        }
        const persistableAnalysis = stripStemsForStorage(chart.workerAnalysis);
        if (persistableAnalysis) {
          workerAnalysisCache.set(track.id, persistableAnalysis);
          cachedAnalysis = persistableAnalysis;
          track.workerAnalysis = persistableAnalysis;
        }
        if (activeStemActivity) {
          track.stemActivity = activeStemActivity;
        }

        const resolvedSections = chart.sections || persistableAnalysis?.sections || cachedAnalysis?.sections || [];
        const resolvedTrackMeta = chart.trackMeta || persistableAnalysis?.trackMeta || cachedAnalysis?.trackMeta || null;
        const cachePayload = {
          bpm: chart.bpm,
          resolution: chart.resolution || 192,
          syncTrack: chart.syncTrack || [],
          beatGrid: chart.beatGrid,
          sections: resolvedSections,
          breWindow: chart.breWindow || null,
          trackMeta: resolvedTrackMeta,
          notes: chart.notes,
        };
        track.bpm = chart.bpm;
        track.charts = track.charts || {};
        track.charts[chartKey] = cachePayload;

        const extraPatch = {};
        if (persistableAnalysis) extraPatch.workerAnalysis = persistableAnalysis;
        if (activeStemActivity) extraPatch.stemActivity = activeStemActivity;

        await updateLocalTrackChartCache(
          track.id,
          chartKey,
          cachePayload,
          chart.bpm,
          Object.keys(extraPatch).length > 0 ? extraPatch : null
        );
        if (dropStatusEl) dropStatusEl.textContent = 'Ready — Cached to IndexedDB!';
        renderSavedLibrary();
        renderGigTicket();
      }

      if (twoP) {
        if (chartKeyP2 === chartKey) {
          chartP2 = chart;
        } else if (track.charts && track.charts[chartKeyP2]) {
          chartP2 = track.charts[chartKeyP2];
        } else {
          chartP2 = await analyzeAndBuildChart({
            audioBuffer: decodedBuffer,
            cachedWorkerAnalysis: chart.workerAnalysis || cachedAnalysis,
            stemActivity: activeStemActivity,
            trackId: track.id,
            instrument: p2Inst.id,
            laneCount: p2Diff.laneCount,
            difficultyConfig: p2Diff,
            bpmHint: track.bpm || null,
            midiBytes: track.midiBytes || null,
            chartText: track.chartText || null,
          });
          const cachePayloadP2 = {
            bpm: chartP2.bpm,
            resolution: chartP2.resolution || 192,
            syncTrack: chartP2.syncTrack || [],
            beatGrid: chartP2.beatGrid,
            sections: chartP2.sections || chart.sections || [],
            breWindow: chartP2.breWindow || chart.breWindow || null,
            trackMeta: chartP2.trackMeta || chart.trackMeta || null,
            notes: chartP2.notes,
          };
          track.charts = track.charts || {};
          track.charts[chartKeyP2] = cachePayloadP2;
          await updateLocalTrackChartCache(track.id, chartKeyP2, cachePayloadP2, chartP2.bpm, null);
        }
      }
    }

    audioEngine.setAudioOffsetMs(gameState.latencyOffsetMs);
    audioEngine.setStemActivity(activeStemActivity);
    audioEngine.setSyncTrack(chart.syncTrack || [], chart.resolution || 192);
    audioEngine.setPracticeStemFocus(playbackRate < 0.99 ? 'boost' : 'full');
    hideScanProgress();

    masterNotes = (chart.notes || [])
      .slice()
      .sort((a, b) => (a.timeSec ?? a.hitTimeSec) - (b.timeSec ?? b.hitTimeSec) || a.lane - b.lane);
    activeNotes = cloneFreshNotes(masterNotes);

    if (twoP && chartP2?.notes) {
      masterNotesP2 = chartP2.notes
        .slice()
        .sort((a, b) => (a.timeSec ?? a.hitTimeSec) - (b.timeSec ?? b.hitTimeSec) || a.lane - b.lane);
      activeNotesP2 = cloneFreshNotes(masterNotesP2);
    } else {
      masterNotesP2 = [];
      activeNotesP2 = [];
    }

    activeBeatGrid = chart.beatGrid;
    activeSections = chart.sections || track.workerAnalysis?.sections || [];
    activeBreWindow = chart.breWindow || null;
    activeTrackBpm = chart.bpm || track.bpm || 120;
    const rawMeta = chart.trackMeta || track.workerAnalysis?.trackMeta || null;
    if (rawMeta) {
      activeTrackMeta = rawMeta;
    } else {
      const styleHint = `${track.style || ''} ${track.genre || ''} ${track.title || ''}`.toLowerCase();
      let ambianceType = 'ROCK_ANTHEM';
      if (/ballad|acoustic|slow|love|acoustic|piano|waltz/.test(styleHint) || activeTrackBpm <= 92) {
        ambianceType = 'BALLAD_EMOTIONAL';
      } else if (/metal|thrash|shred|heavy|punk|hardcore|chaos/.test(styleHint) || activeTrackBpm >= 162) {
        ambianceType = 'METAL_CHAOS';
      } else if (/synth|cyber|electro|neon|edm|techno|disco|wave/.test(styleHint)) {
        ambianceType = 'SYNTH_CYBER';
      } else if (/pop|funk|dance|groove|upbeat|indie/.test(styleHint)) {
        ambianceType = 'POP_UPBEAT';
      }
      activeTrackMeta = {
        ambianceType,
        warmth: ambianceType === 'BALLAD_EMOTIONAL' ? 0.78 : ambianceType === 'POP_UPBEAT' ? 0.56 : 0.34,
        avgEnergy: ambianceType === 'BALLAD_EMOTIONAL' ? 0.42 : ambianceType === 'METAL_CHAOS' ? 0.88 : 0.68,
        bpm: activeTrackBpm,
      };
    }
    lastChorusPyroMs = 0;

    gameState.setTrack(track);
    gameState.resetRun({
      keepPracticeLoop,
      playbackRate,
      isEncore,
      totalChartNotes: masterNotes.length,
      totalChartNotesP2: masterNotesP2.length || masterNotes.length,
    });
    rhythmCanvas.resetVisuals();
    hideSongTitleMarquee();
    whammyKeyHeld = false;
    whammyWheelImpulse = 0;
    grandEncoreActive = false;
    grandEncoreManualOverride = false;
    victoryEncoreHoldActive = false;
    victoryEncoreTimer = 0;
    lastSustainSparkMsP2 = 0;
    activeSectionTracker = { idx: -1, label: 'Section', hits: 0, misses: 0 };
    activeSectionTrackerP2 = { idx: -1, label: 'Section', hits: 0, misses: 0 };
    lanePressedAtSongTime.fill(-999);
    lanePressedAtSongTimeP2.fill(-999);

    arenaRoot.dataset.instrument = inst.id;
    arenaRoot.dataset.playMode = gameState.playMode;
    arenaRoot.dataset.fever = 'false';
    arenaRoot.dataset.encore = isEncore ? 'true' : 'false';

    if (hudP2Panel) {
      hudP2Panel.classList.toggle('is-hidden', !twoP);
    }
    if (hudP2Role) {
      hudP2Role.textContent = p2Inst.shortLabel || p2Inst.label;
    }
    renderStagePedals();

    if (stageBand) {
      stageBand.setGrandEncore(false);
      stageBand.setEncoreFinale(false);
      stageBand.setTrackTitle(track.title);
      stageBand.setEncorePerformance(isEncore, track.title);
      stageBand.setInstrumentTheme(inst.id, false);
      stageBand.setActivePlayers(twoP ? [inst.id, p2Inst.id] : [inst.id], false);
      stageBand.setPlayersMissed([]);
      stageBand.resetCameraForSong();
      stageBand.resize();
      if (stageBand.crowdAmbience) {
        stageBand.crowdAmbience.attachAudioContext(ctx);
        stageBand.crowdAmbience.setVolume(gameState.crowdVolume, gameState.sfxMuted);
      }
    }

    const venueMeta = getVenueById(gameState.venueId);
    const tourTag = gameState.tourActive
      ? isEncore
        ? ' · ★ FINAL ENCORE'
        : ` · Song ${gameState.tourIndex + 1}/${gameState.setlistQueue.length}`
      : '';
    hudTrackTitle.textContent = isEncore ? `★ ${track.title}` : track.title;
    if (hudSectionBadge) hudSectionBadge.textContent = isEncore ? 'FINAL ENCORE' : 'STAGE INTRO';
    const modeSuffix = twoP ? ` · ${gameState.playMode === 'coop' ? '2P CO-OP' : '2P FACE-OFF'}` : '';
    hudTrackMeta.textContent = `${track.artist} · ${activeTrackBpm} BPM · ${inst.label}${twoP ? ` + ${p2Inst.shortLabel}` : ''} · ${venueMeta.name}${modeSuffix}${tourTag}`;
    hudAmpRole.textContent = inst.label;

    const startOffset =
      keepPracticeLoop && gameState.hasValidPracticeLoop()
        ? gameState.practiceLoop.startSec
        : 0;

    const useWalkOnIntro = startOffset <= 0.01;
    walkOnAmpPlugPlayed = !useWalkOnIntro;
    songTitleMarqueeShown = false;

    if (startOffset > 0) {
      resetNotesFromTimestamp(startOffset);
    }

    const totalDurationSec =
      mediaSource.mode === 'stems' ? mediaSource.drums.duration : mediaSource.buffer.duration;

    hudTimeCurrent.textContent = formatTime(startOffset);
    hudTimeTotal.textContent = formatTime(totalDurationSec);
    hudProgressFill.style.transform = 'scaleX(0)';

    buildTrainerSectionsStrip(totalDurationSec);
    setTrainerOpen(playbackRate < 0.99 || gameState.hasValidPracticeLoop());
    syncHudReadouts();
    syncPracticeLoopUI();
    setScreen(SCREENS.STAGE);
    rhythmCanvas.resize();
    rhythmCanvas.start();

    await audioEngine.startPlayback({
      mediaSource,
      instrument: gameState.instrument,
      playbackRate,
      startOffsetSec: startOffset,
      useLeadIn: useWalkOnIntro,
      leadInSec: useWalkOnIntro ? WALK_ON_LEAD_IN_SEC : 0.05,
    });
    audioEngine.setInstrumentStemMuted(false);
    audioEngine.setStereoWidthTier(0);
    sfx.startCrowdAmbience();
    sfx.updateCrowdState({
      hype: gameState.crowdHype,
      feverActive: false,
      playing: true,
      bpm: activeTrackBpm,
      songTime: useWalkOnIntro ? -WALK_ON_LEAD_IN_SEC : startOffset,
      isEncore,
    });

    if (useWalkOnIntro) {
      sfx.playWalkOnCrowdSwell();
    }
    if (isEncore) {
      sfx.playEncoreChant();
    }
  } catch (err) {
    hideScanProgress();
    if (dropStatusEl) {
      dropStatusEl.textContent = err.message || 'Unable to start that song.';
      dropStatusEl.classList.add('is-error');
    }
  }
}

/* ==========================================================================
   Core Gameplay Frame Tick & Note Judgement
   ========================================================================== */

function lowerBoundNoteIndex(notes, targetSec) {
  let lo = 0;
  let hi = notes.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const t = notes[mid].timeSec ?? notes[mid].hitTimeSec;
    if (t < targetSec) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function resetNotesFromTimestamp(startSec) {
  const mapFresh = (n) => {
    const t = n.timeSec ?? n.hitTimeSec;
    return {
      ...n,
      hit: t < startSec - 0.05,
      holding: false,
      holdCompleted: t < startSec - 0.05,
      missed: false,
      dodged: false,
    };
  };
  activeNotes = masterNotes.map(mapFresh);
  activeNotesP2 = masterNotesP2.length > 0 ? masterNotesP2.map(mapFresh) : [];
}

function jumpToPracticeLoopStart() {
  if (!gameState.hasValidPracticeLoop()) return;
  const startSec = gameState.practiceLoop.startSec;
  resetNotesFromTimestamp(startSec);
  activeSectionTracker = { idx: -1, label: 'Section', hits: 0, misses: 0 };
  activeSectionTrackerP2 = { idx: -1, label: 'Section', hits: 0, misses: 0 };
  audioEngine.seekTo(startSec);
  audioEngine.setInstrumentStemMuted(false);
  gameState.stemDropped = false;
  gameState.p2.stemDropped = false;
  if (stageBand) stageBand.setPlayersMissed([]);
}

function syncStageBandMissedAndAudioStem() {
  const twoP = gameState.isTwoPlayerMode();
  const missed = [];
  if (gameState.stemDropped) missed.push(gameState.instrument);
  if (twoP && gameState.p2.stemDropped) missed.push(gameState.p2Instrument);
  if (stageBand) {
    stageBand.setPlayersMissed(missed);
  }
  const muteAudioStem =
    twoP && gameState.instrument === gameState.p2Instrument
      ? Boolean(gameState.stemDropped && gameState.p2.stemDropped)
      : Boolean(gameState.stemDropped);
  audioEngine.setInstrumentStemMuted(muteAudioStem);
}

function hasEventNearWindow(arr, startSec, endSec, getTimeFn) {
  if (!arr || arr.length === 0) return false;
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (getTimeFn(arr[mid]) < startSec) lo = mid + 1;
    else hi = mid;
  }
  return lo < arr.length && getTimeFn(arr[lo]) <= endSec;
}

function computeMeasureStemActivity(songTime) {
  const base = audioEngine.getStemActivityAt(songTime);
  if (songTime < 0) return base;
  const winStart = songTime - 0.35;
  const winEnd = songTime + 1.45;
  const out = { ...base };
  const wa = gameState.currentTrack?.workerAnalysis;
  if (wa && wa.analysisEngine) {
    const getT = (e) => e.exactTimeSec ?? e.timeSec ?? e.time ?? 0;
    out.drums = Boolean(base.drums && hasEventNearWindow(wa.drumEvents, winStart, winEnd, getT));
    out.bass = Boolean(base.bass && hasEventNearWindow(wa.bassOnsets, winStart, winEnd, getT));
    out.guitar = Boolean(base.guitar && hasEventNearWindow(wa.guitarOnsets, winStart, winEnd, getT));
    out.piano = Boolean(base.piano && hasEventNearWindow(wa.pianoOnsets, winStart, winEnd, getT));
  }
  const activeInst = gameState.instrument;
  const twoP = gameState.isTwoPlayerMode();
  const p2Inst = gameState.p2Instrument;
  if (activeNotes.length > 0 && Object.prototype.hasOwnProperty.call(out, activeInst)) {
    const p1Has = hasEventNearWindow(activeNotes, winStart, winEnd, (n) => n.timeSec ?? n.hitTimeSec);
    const p2SameHas =
      twoP && p2Inst === activeInst && activeNotesP2.length > 0
        ? hasEventNearWindow(activeNotesP2, winStart, winEnd, (n) => n.timeSec ?? n.hitTimeSec)
        : false;
    out[activeInst] = Boolean(out[activeInst] && (p1Has || p2SameHas));
  }
  if (twoP && p2Inst !== activeInst && activeNotesP2.length > 0 && Object.prototype.hasOwnProperty.call(out, p2Inst)) {
    const p2Has = hasEventNearWindow(activeNotesP2, winStart, winEnd, (n) => n.timeSec ?? n.hitTimeSec);
    out[p2Inst] = Boolean(out[p2Inst] && p2Has);
  }
  return out;
}

function isNaturalGrandEncoreWindow(songTime, duration) {
  if (gameState.hasValidPracticeLoop() || duration <= 5 || songTime <= 0) return false;
  const remainingSeconds = duration - songTime;
  const songProgress = songTime / duration;
  return (
    (remainingSeconds <= 12 && remainingSeconds > 0) ||
    (duration > 45 && songProgress >= 0.88)
  );
}

function setGrandEncoreState(active, { bannerText = '✨ GRAND ENCORE FINALE ✨' } = {}) {
  const next = Boolean(active);
  if (next === grandEncoreActive) return;
  grandEncoreActive = next;
  arenaRoot.dataset.encore = next || gameState.isEncorePerformance ? 'true' : 'false';
  if (stageBand) {
    stageBand.setGrandEncore(next);
  }
  syncPracticeLoopUI();
  if (next) {
    if (bannerText) {
      rhythmCanvas.triggerMilestoneBanner(bannerText, '#fde047', 2.6);
    }
    sfx.playComboCheer(100);
    sfx.playPyroBlast();
  } else if (bannerText === 'ENCORE PREVIEW OFF') {
    rhythmCanvas.triggerMilestoneBanner('ENCORE PREVIEW OFF', '#94a3b8', 1.4);
  }
}

function enterVictoryEncoreHold() {
  if (victoryEncoreHoldActive) return;
  victoryEncoreHoldActive = true;
  victoryEncoreTimer = 3.0;
  whammyKeyHeld = false;
  whammyWheelImpulse = 0;
  gameState.whammyActive = false;
  if (gameState.p2) gameState.p2.whammyActive = false;
  rhythmCanvas.clearHeldLanes();
  clearAllPedals();

  if (!grandEncoreActive) {
    setGrandEncoreState(true, { bannerText: '✨ GRAND ENCORE FINALE ✨' });
  } else {
    rhythmCanvas.triggerMilestoneBanner('✨ GRAND ENCORE FINALE ✨', '#fde047', 3.0);
    sfx.playComboCheer(100);
    sfx.playPyroBlast();
  }

  if (stageBand) {
    stageBand.crowdAmbience?.triggerMilestoneRoar(1.4);
    stageBand.triggerBandJump(1.4);
    stageBand.triggerStagePyro(1.55);
    stageBand.triggerConfettiBurst(true);
    stageBand.launchFireworkShell(true);
    stageBand.launchFireworkShell(true);
  }
}

function processPlayerFrame(player, notes, songTime, dt, nowPerf) {
  const isP2 = player === 2;
  const pState = isP2 ? gameState.p2 : gameState;
  const laneCfg = gameState.getLaneConfigFor(player);
  const laneColors = laneCfg.colors;
  const laneCount = laneCfg.count;
  const roleInst = isP2 ? gameState.p2Instrument : gameState.instrument;
  const tracker = isP2 ? activeSectionTrackerP2 : activeSectionTracker;
  const pressedArr = isP2 ? lanePressedAtSongTimeP2 : lanePressedAtSongTime;
  const rcPlayer = rhythmCanvas.playerStates?.[player - 1];
  const heldLanes = rcPlayer ? rcPlayer.heldLanes : rhythmCanvas.heldLanes;

  let anyActiveSustainHeld = false;
  const sustainStartIdx = lowerBoundNoteIndex(notes, songTime - 10.0);
  for (let i = sustainStartIdx; i < notes.length; i += 1) {
    const note = notes[i];
    const noteTime = note.timeSec ?? note.hitTimeSec;
    if (noteTime > songTime + 0.25) break;
    if (!note.holding || note.holdCompleted) continue;

    const sustainDur = note.sustainSec ?? note.sustainDuration ?? 0;
    const tailEnd = noteTime + sustainDur;
    if (songTime >= tailEnd) {
      note.holding = false;
      note.holdCompleted = true;
    } else if (heldLanes[note.lane]) {
      anyActiveSustainHeld = true;
      const whammyOn = !isP2 && (whammyKeyHeld || whammyWheelImpulse > 0.1);
      gameState.registerPlayerSustainTick(player, dt, whammyOn, activeTrackBpm);

      const lastSpark = isP2 ? lastSustainSparkMsP2 : lastSustainSparkMs;
      if (nowPerf - lastSpark >= 90) {
        if (isP2) lastSustainSparkMsP2 = nowPerf;
        else lastSustainSparkMs = nowPerf;
        rhythmCanvas.triggerSustainSparkVisual(
          note.lane,
          laneColors[note.lane],
          pState.feverActive,
          whammyOn,
          player
        );
        sfx.playSustainSpark(note.lane, laneCount, pState.feverActive, whammyOn);
      }
    } else {
      note.holding = false;
      note.holdCompleted = true;
    }
  }

  if (!isP2) {
    const whammyTarget = anyActiveSustainHeld
      ? Math.min(1, (whammyKeyHeld ? 1.0 : 0) + whammyWheelImpulse)
      : 0;
    gameState.whammyActive = whammyTarget > 0.1;
    audioEngine.updateWhammy(whammyTarget, dt);
    rhythmCanvas.setWhammyVisual(whammyTarget, 1);
  } else {
    gameState.p2.whammyActive = false;
    rhythmCanvas.setWhammyVisual(0, 2);
  }

  // Clone Hero HOPO Auto-Tap / Fret-Slide Leniency
  const windows = gameState.getTimingWindows(player);
  if (!gameState.breActive && pState.combo >= 1 && songTime >= 0) {
    let heldCount = 0;
    for (let l = 0; l < laneCount; l += 1) {
      if (heldLanes[l]) heldCount += 1;
    }
    if (heldCount >= 1 && heldCount <= 2) {
      const hopoStartIdx = lowerBoundNoteIndex(notes, songTime - 0.032);
      for (let i = hopoStartIdx; i < notes.length; i += 1) {
        const note = notes[i];
        const noteTime = note.timeSec ?? note.hitTimeSec;
        if (noteTime > songTime + 0.016) break;
        if (note.hit || note.missed || note.dodged || note.isHazard || !note.isHopo) continue;
        if (
          songTime >= noteTime - 0.014 &&
          songTime <= noteTime + 0.028 &&
          heldLanes[note.lane] &&
          pressedArr[note.lane] >= noteTime - 0.35
        ) {
          commitNoteHit(note, note.lane, songTime, windows, player);
        }
      }
    }
  }

  // Detect expired missed notes + auto-dodged "Panggulo" Hazard notes
  const missThresholdSec = (windows.GOOD_LATE_MS || windows.GOOD_MS || 70) / 1000;
  let anyMiss = false;
  const missStartIdx = lowerBoundNoteIndex(notes, songTime - 6.0);
  for (let i = missStartIdx; i < notes.length; i += 1) {
    const note = notes[i];
    if (note.hit || note.missed || note.dodged) continue;

    const noteTime = note.timeSec ?? note.hitTimeSec;
    const hopoGraceSec = note.isHopo ? 0.020 : 0;
    if (songTime - noteTime > missThresholdSec + hopoGraceSec) {
      if (note.isHazard) {
        note.dodged = true;
        gameState.registerPlayerHazardDodged(player);
        rhythmCanvas.triggerHazardDodgedVisual(note.lane, player);
        sfx.playHazardDodged(note.lane, laneCount);
        anyMiss = true;
        continue;
      }

      note.missed = true;
      anyMiss = true;
      tracker.misses += 1;
      const res = gameState.registerPlayerMiss(player);
      if (res.stemMuted) {
        syncStageBandMissedAndAudioStem();
        if (stageBand && (res.crowdHype < 42 || res.consecutiveMisses >= 2)) {
          stageBand.triggerCrowdThrow({ targetRole: roleInst, laneIndex: note.lane });
        }
      }
      if (!isP2 && res.stereoReset) audioEngine.setStereoWidthTier(0);
      rhythmCanvas.triggerMissVisual(res.brokeStreak, player);
      sfx.playWrongKeyMiss(note.lane, laneCount, roleInst);

      if (res.failedOut) {
        handleTrackFinished();
        return { anyActiveSustainHeld, anyMiss, failedOut: true };
      }
    } else if (noteTime > songTime) {
      break;
    }
  }

  return { anyActiveSustainHeld, anyMiss, failedOut: false };
}

function handleFrameTick(dt) {
  if (gameState.screen !== SCREENS.STAGE) return;

  // Automatic 60 FPS Adaptive Quality Guard
  const instFps = 1 / Math.max(dt, 0.001);
  emaFps = emaFps * 0.9 + Math.min(120, instFps) * 0.1;
  if (!adaptiveLowPowerActive) {
    if (emaFps < 45) {
      lowFpsAccumSec += dt;
      if (lowFpsAccumSec >= 2.0) {
        adaptiveLowPowerActive = true;
        lowFpsAccumSec = 0;
        highFpsAccumSec = 0;
        if (stageBand) stageBand.setAdaptiveQualityMode(true);
        rhythmCanvas.setLowParticleMode(true);
      }
    } else {
      lowFpsAccumSec = Math.max(0, lowFpsAccumSec - dt * 0.5);
    }
  } else if (emaFps >= 55) {
    highFpsAccumSec += dt;
    if (highFpsAccumSec >= 4.0) {
      adaptiveLowPowerActive = false;
      highFpsAccumSec = 0;
      lowFpsAccumSec = 0;
      if (stageBand) stageBand.setAdaptiveQualityMode(false);
      rhythmCanvas.setLowParticleMode(false);
    }
  } else {
    highFpsAccumSec = 0;
  }

  audioEngine.updateTelemetry();

  const songTime = getEffectiveSongTime();
  const duration = audioEngine.getDuration();
  const twoP = gameState.isTwoPlayerMode();
  const activeInstruments = twoP
    ? [gameState.instrument, gameState.p2Instrument]
    : [gameState.instrument];

  // 0B. 3-second Post-Song Victory Encore Hold
  if (victoryEncoreHoldActive) {
    victoryEncoreTimer = Math.max(0, victoryEncoreTimer - dt);
    whammyKeyHeld = false;
    whammyWheelImpulse = 0;
    gameState.whammyActive = false;
    if (gameState.p2) gameState.p2.whammyActive = false;
    audioEngine.updateWhammy(0, dt);
    rhythmCanvas.setWhammyVisual(0, 1);
    rhythmCanvas.setWhammyVisual(0, 2);

    if (!grandEncoreActive) {
      setGrandEncoreState(true, { bannerText: '✨ GRAND ENCORE FINALE ✨' });
    }

    if (stageBand) {
      const holdTime = Math.max(songTime, duration || 0);
      const currentSection = getSongSectionAt(activeSections, holdTime);
      const beatPhase = (((holdTime * (activeTrackBpm / 60)) % 1) + 1) % 1;
      stageBand.update(
        dt,
        {
          playing: true,
          instrument: gameState.instrument,
          activeInstruments,
          feverActive: gameState.feverActive || (twoP && gameState.p2.feverActive),
          breActive: false,
          isEncore: gameState.isEncorePerformance,
          isEncoreActive: true,
          stemDropped: false,
          combo: Math.max(gameState.combo, twoP ? gameState.p2.combo : 0),
          hype: Math.max(gameState.crowdHype, 88),
          bpm: activeTrackBpm,
          songTime: holdTime,
          currentTick: Math.round(holdTime * (activeTrackBpm / 60) * 192),
          beatPhase,
          trackMeta: activeTrackMeta,
          sustainHeld: false,
          stemActivity: { drums: true, bass: true, guitar: true, piano: true },
          currentSection,
          beatGrid: activeBeatGrid,
        },
        {
          drumEnergy: 0.48,
          bassEnergy: 0.45,
          guitarEnergy: 0.55,
          pianoEnergy: 0.45,
          vocalEnergy: 0.5,
          overallEnergy: 0.62,
        }
      );
      stageBand.crowdAmbience?.update({
        playing: true,
        songTime: holdTime,
        bpm: activeTrackBpm,
        beatPhase,
        combo: Math.max(gameState.combo, twoP ? gameState.p2.combo : 0),
        hypeNorm: Math.max(gameState.crowdHype, 90) / 100,
        sectionType: currentSection?.type || 'CHORUS',
        fever: true,
        encore: true,
      });
    }

    sfx.updateCrowdState({
      hype: Math.max(gameState.crowdHype, 90),
      feverActive: true,
      playing: true,
      bpm: activeTrackBpm,
      songTime: duration || songTime,
      isEncore: true,
    });

    if (duration > 0) {
      hudTimeCurrent.textContent = formatTime(duration);
      hudTimeTotal.textContent = formatTime(duration);
      hudProgressFill.style.transform = 'scaleX(1)';
    }

    if (victoryEncoreTimer <= 0) {
      victoryEncoreHoldActive = false;
      victoryEncoreTimer = 0;
      handleTrackFinished();
    }
    return;
  }

  // Dual Grand Encore Finale trigger (final 12s OR >= 88% on tracks > 45s, plus E/Backquote manual preview)
  const shouldGrandEncore = Boolean(
    isNaturalGrandEncoreWindow(songTime, duration) || grandEncoreManualOverride
  );
  if (shouldGrandEncore !== grandEncoreActive) {
    setGrandEncoreState(shouldGrandEncore, {
      bannerText: shouldGrandEncore ? '✨ GRAND ENCORE FINALE ✨' : '',
    });
  }

  // 0. Stage Walk-On Audio & Guitar Hero Song Title Marquee choreography
  if (!walkOnAmpPlugPlayed && songTime >= -3.1 && songTime < -2.0) {
    walkOnAmpPlugPlayed = true;
    sfx.playAmpPlugIn();
  }
  if (!songTitleMarqueeShown && songTime >= -2.05) {
    songTitleMarqueeShown = true;
    showSongTitleMarquee(gameState.currentTrack, activeTrackBpm, gameState.isEncorePerformance);
  }

  // Full Combo Pace milestone banners at 50% & 75% progress
  if (duration > 20 && gameState.missCount === 0 && gameState.combo >= 25 && songTime > 0) {
    const pct = (songTime / duration) * 100;
    if (pct >= 50 && !gameState.fcPaceMilestonesHit[50]) {
      gameState.fcPaceMilestonesHit[50] = true;
      rhythmCanvas.triggerMilestoneBanner('★ FULL COMBO PACE · 50% ★', '#4ade80', 1.85);
    } else if (pct >= 75 && !gameState.fcPaceMilestonesHit[75]) {
      gameState.fcPaceMilestonesHit[75] = true;
      rhythmCanvas.triggerMilestoneBanner('★ FULL COMBO PACE · 75% ★', '#4ade80', 1.85);
    }
  }

  // 1. Practice Loop boundary check
  if (gameState.hasValidPracticeLoop() && songTime >= gameState.practiceLoop.endSec) {
    jumpToPracticeLoopStart();
    return;
  }

  // 2. Fever Mode drain
  const feverEnded = gameState.updateFever(dt);
  const anyFever = gameState.feverActive || (twoP && gameState.p2.feverActive);
  arenaRoot.dataset.fever = anyFever ? 'true' : 'false';
  if (feverEnded && stageBand) {
    stageBand.setInstrumentTheme(gameState.instrument, anyFever);
  }

  // 3 & 4. Process sustains, whammy, HOPOs & missed/dodged notes per active player
  whammyWheelImpulse = Math.max(0, whammyWheelImpulse - dt * 2.8);
  const nowPerf = performance.now();

  const p1Frame = processPlayerFrame(1, activeNotes, songTime, dt, nowPerf);
  if (p1Frame.failedOut) return;

  let p2Frame = null;
  if (twoP && activeNotesP2.length > 0) {
    p2Frame = processPlayerFrame(2, activeNotesP2, songTime, dt, nowPerf);
    if (p2Frame.failedOut) return;
  } else {
    rhythmCanvas.setWhammyVisual(0, 2);
  }

  const anyActiveSustainHeld = p1Frame.anyActiveSustainHeld || Boolean(p2Frame?.anyActiveSustainHeld);
  const anyMiss = p1Frame.anyMiss || Boolean(p2Frame?.anyMiss);

  // 4B. Big Rock Ending (BRE) Freestyle Finale State Machine
  if (activeBreWindow && !gameState.hasValidPracticeLoop()) {
    if (!gameState.breActive && !gameState.breCompleted && songTime >= activeBreWindow.startSec && songTime < activeBreWindow.endSec) {
      gameState.breActive = true;
      gameState.stemDropped = false;
      gameState.p2.stemDropped = false;
      syncStageBandMissedAndAudioStem();
      if (stageBand) {
        stageBand.triggerCryoJets(2.4);
        stageBand.crowdAmbience?.triggerMilestoneRoar(1.25);
      }
      rhythmCanvas.triggerMilestoneBanner('⚡ BIG ROCK ENDING · FREESTYLE! ⚡', '#fde047', 2.2);
      sfx.playComboCheer(50);
    } else if (gameState.breActive && songTime >= activeBreWindow.endSec) {
      gameState.breActive = false;
      gameState.breCompleted = true;
      if (stageBand) {
        stageBand.crowdAmbience?.triggerMilestoneRoar(1.35);
        stageBand.triggerBandJump(1.35);
        stageBand.triggerStagePyro(1.55);
        stageBand.triggerConfettiBurst();
        stageBand.launchFireworkShell(true);
      }
      sfx.playPyroBlast();
      const breTotal = gameState.breBonusPoints + (twoP ? gameState.p2.breBonusPoints : 0);
      const breLabel =
        breTotal > 0
          ? `★ BIG ROCK ENDING +${breTotal.toLocaleString()}! ★`
          : '★ ENCORE FINALE! ★';
      rhythmCanvas.triggerMilestoneBanner(breLabel, '#fde047', 2.4);
      syncHudReadouts();
    }
  }

  // 5. Update 3D Stage Band, Venue FX, Kinetic Camera & Chorus Pyro
  const maxCombo = Math.max(gameState.combo, twoP ? gameState.p2.combo : 0);
  if (
    stageBand &&
    (maxCombo >= 15 || gameState.isEncorePerformance) &&
    !gameState.stemDropped &&
    audioEngine.liveOverallEnergy > 0.56 &&
    audioEngine.liveBassEnergy > 0.5 &&
    nowPerf - lastChorusPyroMs > 4400
  ) {
    lastChorusPyroMs = nowPerf;
    stageBand.triggerStagePyro(gameState.isEncorePerformance ? 1.25 : 0.95);
  }

  const liveTelemetry = {
    drumEnergy: audioEngine.liveDrumEnergy,
    drumTransient: audioEngine.liveDrumTransient,
    kickEnergy: audioEngine.liveKickEnergy,
    kickTransient: audioEngine.liveKickTransient,
    snareEnergy: audioEngine.liveSnareEnergy,
    snareTransient: audioEngine.liveSnareTransient,
    harmonicEnergy: audioEngine.liveHarmonicEnergy,
    bassEnergy: audioEngine.liveBassEnergy,
    bassTransient: audioEngine.liveBassTransient,
    guitarEnergy: audioEngine.liveGuitarEnergy,
    guitarTransient: audioEngine.liveGuitarTransient,
    pianoEnergy: audioEngine.livePianoEnergy,
    pianoTransient: audioEngine.livePianoTransient,
    vocalEnergy: audioEngine.liveVocalEnergy,
    overallEnergy: audioEngine.liveOverallEnergy,
  };

  if (songTime < -1.95 && beatSyncClock.getState().sampleCount > 0) {
    beatSyncClock.reset();
  }

  const beatSync = beatSyncClock.update({
    songTime,
    syncTrack: audioEngine.syncTrack,
    fallbackBpm: activeTrackBpm,
    resolution: audioEngine.syncResolution,
    outputLatencySec: audioEngine.getOutputLatencySec(),
    playing: true,
    telemetry: liveTelemetry,
    sections: activeSections,
    trackMeta: activeTrackMeta,
  });

  const currentSection = getSongSectionAt(activeSections, songTime);
  if (songTime >= 0 && Array.isArray(activeSections) && activeSections.length > 0 && currentSection) {
    const secIdx = activeSections.indexOf(currentSection);
    if (secIdx !== -1 && secIdx !== activeSectionTracker.idx) {
      if (activeSectionTracker.idx !== -1 && !gameState.hasValidPracticeLoop()) {
        if (activeSectionTracker.hits > 0) {
          const secRes = gameState.completeSection(
            {
              label: activeSectionTracker.label,
              hits: activeSectionTracker.hits,
              misses: activeSectionTracker.misses,
            },
            1
          );
          if (secRes?.bonus > 0) {
            rhythmCanvas.triggerMilestoneBanner(
              `SECTION CLEARED · +${secRes.bonus.toLocaleString()} PTS`,
              '#fde047',
              1.75
            );
            syncHudReadouts();
          }
        }
        if (twoP && activeSectionTrackerP2.hits > 0) {
          gameState.completeSection(
            {
              label: activeSectionTrackerP2.label,
              hits: activeSectionTrackerP2.hits,
              misses: activeSectionTrackerP2.misses,
            },
            2
          );
          syncHudReadouts();
        }
      }
      const nextLabel = currentSection.label || currentSection.type || 'Section';
      activeSectionTracker = { idx: secIdx, label: nextLabel, hits: 0, misses: 0 };
      activeSectionTrackerP2 = { idx: secIdx, label: nextLabel, hits: 0, misses: 0 };
    }
  }

  if (stageBand) {
    stageBand.update(
      dt,
      {
        playing: true,
        instrument: gameState.instrument,
        activeInstruments,
        feverActive: anyFever,
        breActive: gameState.breActive,
        isEncore: gameState.isEncorePerformance,
        isEncoreActive: grandEncoreActive,
        stemDropped: gameState.stemDropped || (twoP && gameState.p2.stemDropped),
        combo: maxCombo,
        hype: gameState.crowdHype,
        bpm: beatSync.currentBpm || activeTrackBpm,
        songTime,
        currentTick: beatSync.currentTick ?? beatSync.tick,
        beatIndex: beatSync.beatIndex,
        beatPhase: beatSync.beatPhase,
        sixteenthPhase: beatSync.sixteenthPhase,
        barPhase: beatSync.barPhase,
        phraseProgress: beatSync.phraseProgress,
        isDownbeat: beatSync.isDownbeat,
        isPhraseBoundary: beatSync.isPhraseBoundary,
        songAmbiance: beatSync.songAmbiance,
        transientEnergy: beatSync.transientEnergy,
        syncLocked: beatSync.syncLocked,
        trackMeta: activeTrackMeta,
        sustainHeld: anyActiveSustainHeld,
        stemActivity: computeMeasureStemActivity(songTime),
        currentSection,
        beatGrid: activeBeatGrid,
      },
      liveTelemetry
    );

    stageBand.crowdAmbience?.update({
      playing: true,
      songTime,
      bpm: beatSync.currentBpm || activeTrackBpm,
      beatPhase: beatSync.beatPhase,
      combo: maxCombo,
      hypeNorm: gameState.crowdHype / 100,
      sectionType: currentSection?.type || 'VERSE',
      fever: anyFever,
      encore: gameState.isEncorePerformance || grandEncoreActive,
    });
  }

  sfx.updateCrowdState({
    hype: gameState.crowdHype,
    feverActive: anyFever,
    playing: true,
    bpm: activeTrackBpm,
    songTime,
    isEncore: gameState.isEncorePerformance || grandEncoreActive,
  });

  // 6. Live bass energy drives crowd lightsticks & amp VU meter
  const bassEnergy = Math.min(1, audioEngine.liveBassEnergy * 1.45);
  arenaRoot.style.setProperty('--bass-energy', bassEnergy.toFixed(3));
  hudAmpMeterFill.style.transform = `scaleX(${Math.min(1, 0.12 + audioEngine.liveOverallEnergy * 1.5).toFixed(3)})`;

  // 7. Throttled HUD readouts
  if (anyMiss || nowPerf - lastHudUpdateMs >= 65) {
    lastHudUpdateMs = nowPerf;
    syncHudReadouts();

    if (hudSectionBadge) {
      const secText =
        songTime < 0
          ? 'STAGE INTRO'
          : grandEncoreActive
            ? 'ENCORE FINALE'
            : currentSection
              ? String(currentSection.label || currentSection.type || 'LIVE SET').toUpperCase()
              : 'LIVE SET';
      if (hudSectionBadge.textContent !== secText) {
        hudSectionBadge.textContent = secText;
      }
    }

    const clampedTime = Math.max(0, songTime);
    hudTimeCurrent.textContent = formatTime(clampedTime);
    if (duration > 0) {
      hudTimeTotal.textContent = formatTime(duration);
      const ratio = Math.max(0, Math.min(1, clampedTime / duration));
      hudProgressFill.style.transform = `scaleX(${ratio.toFixed(4)})`;
    }
  }
}

function commitNoteHit(candidate, laneIndex, songTime, windows, player = 1) {
  const isP2 = player === 2;
  const laneCfg = gameState.getLaneConfigFor(player);
  const colorObj = laneCfg.colors[laneIndex];
  const roleInst = isP2 ? gameState.p2Instrument : gameState.instrument;
  const pState = isP2 ? gameState.p2 : gameState;
  const tracker = isP2 ? activeSectionTrackerP2 : activeSectionTracker;

  const candTime = candidate.timeSec ?? candidate.hitTimeSec;
  const candSus = candidate.sustainSec ?? candidate.sustainDuration ?? 0;
  const deltaMs = (candTime - songTime) * 1000;
  candidate.hit = true;
  tracker.hits += 1;
  if (candSus > 0) {
    candidate.holding = true;
  }

  const res = gameState.registerPlayerHit(player, deltaMs, Boolean(candidate.isFever || candidate.isStar));
  rhythmCanvas.recordTimingDeviation(deltaMs, windows, res.judgement, player);
  if (!isP2) {
    beatSyncClock.recordHitDeviation(deltaMs);
  }

  if (res.stemRestored) {
    syncStageBandMissedAndAudioStem();
  }

  if (!isP2 && res.stereoTierChanged) {
    audioEngine.setStereoWidthTier(res.stereoTier);
  }

  if (stageBand) {
    stageBand.notifyNoteEvent({
      instrument: roleInst,
      lane: laneIndex,
      pitchNorm: candidate.pitchNorm,
      drumPart: candidate.drumPart,
      isChord: candidate.isChord,
      pianoHand: candidate.pianoHand || null,
      isAccent: Boolean(candidate.isAccent),
    });
  }

  if (res.hitStreakBanner > 0) {
    const prefix = gameState.isTwoPlayerMode() ? `P${player} · ` : '';
    rhythmCanvas.triggerMilestoneBanner(`${prefix}${res.hitStreakBanner} NOTE STREAK!`, '#fde047', 1.65);
  }

  if (res.hitCheerMilestone > 0) {
    sfx.playComboCheer(res.hitCheerMilestone);
  }

  if (res.hitPyroMilestone > 0) {
    rhythmCanvas.triggerPyroBurst(res.hitPyroMilestone);
    if (stageBand) {
      stageBand.crowdAmbience?.triggerMilestoneRoar(res.hitPyroMilestone >= 100 ? 1.5 : 1.15);
      stageBand.triggerStagePyro(res.hitPyroMilestone >= 100 ? 1.5 : res.hitPyroMilestone >= 50 ? 1.25 : 1.0);
      if (res.hitPyroMilestone >= 50) {
        stageBand.triggerConfettiBurst();
        stageBand.launchFireworkShell(gameState.isEncorePerformance);
      }
    }
    sfx.playPyroBlast();
  }

  sfx.playLaneHit(
    laneIndex,
    laneCfg.count,
    roleInst,
    res.judgement,
    candidate.isFever || pState.feverActive
  );

  rhythmCanvas.triggerHitVisual({
    laneIndex,
    judgement: res.judgement,
    colorObj,
    isChord: candidate.isChord,
    isFever: candidate.isFever,
    feverActive: pState.feverActive,
    multiplierUp: res.multiplierUp,
    effectiveMultiplier: res.effectiveMultiplier,
    player,
  });

  syncHudReadouts();
}

function handleLanePress(laneIndex, eventTimeStampMs = null, capturedPlaybackSec = null, player = 1) {
  if (gameState.screen !== SCREENS.STAGE) return;
  const isP2 = player === 2;
  if (isP2 && !gameState.isTwoPlayerMode()) return;

  const laneCfg = gameState.getLaneConfigFor(player);
  const laneCount = laneCfg.count;
  if (laneIndex < 0 || laneIndex >= laneCount) return;

  const songTime =
    typeof capturedPlaybackSec === 'number' && Number.isFinite(capturedPlaybackSec)
      ? capturedPlaybackSec
      : getEffectiveSongTime(eventTimeStampMs);

  const pressedArr = isP2 ? lanePressedAtSongTimeP2 : lanePressedAtSongTime;
  const notes = isP2 ? activeNotesP2 : activeNotes;
  const roleInst = isP2 ? gameState.p2Instrument : gameState.instrument;
  const tracker = isP2 ? activeSectionTrackerP2 : activeSectionTracker;

  pressedArr[laneIndex] = songTime;
  rhythmCanvas.setLaneHeld(laneIndex, true, player);
  setPedalPressed(laneIndex, true, player);
  if (victoryEncoreHoldActive) return;

  // Big Rock Ending (BRE) Freestyle Finale
  if (gameState.breActive) {
    gameState.registerPlayerBreHit(player);
    sfx.playBreFreestyleHit(laneIndex, laneCount);
    rhythmCanvas.triggerHitVisual({
      laneIndex,
      judgement: 'FREESTYLE!',
      colorObj: { base: '#facc15', bright: '#fef9c3' },
      isChord: true,
      isFever: true,
      feverActive: true,
      multiplierUp: false,
      effectiveMultiplier: gameState.getEffectiveMultiplierFor(player),
      player,
    });
    if (stageBand) {
      stageBand.notifyNoteEvent({
        instrument: roleInst,
        lane: laneIndex,
        pitchNorm: laneIndex / Math.max(1, laneCount - 1),
        isChord: true,
      });
    }
    syncHudReadouts();
    return;
  }

  const windows = gameState.getTimingWindows(player);
  const goodEarlySec = (windows.GOOD_EARLY_MS || 70) / 1000;
  const goodLateSec = (windows.GOOD_LATE_MS || 70) / 1000;
  const maxWindowSec = (windows.WRONG_KEY_WINDOW_MS || 100) / 1000;

  let candidate = null;
  let fallbackWrongKey = null;
  const pressStartIdx = lowerBoundNoteIndex(notes, songTime - maxWindowSec - 0.05);
  for (let i = pressStartIdx; i < notes.length; i += 1) {
    const n = notes[i];
    if (n.hit || n.missed || n.dodged || n.lane !== laneIndex) continue;
    const noteTime = n.timeSec ?? n.hitTimeSec;
    const diff = noteTime - songTime;
    const hopoBonusSec = n.isHopo ? 0.020 : 0;
    if (diff < -(maxWindowSec + hopoBonusSec)) continue;
    if (diff > maxWindowSec + hopoBonusSec) break;
    if (diff >= -(goodLateSec + hopoBonusSec) && diff <= goodEarlySec + hopoBonusSec) {
      candidate = n;
      break;
    }
    if (!fallbackWrongKey) {
      fallbackWrongKey = n;
    }
  }

  if (candidate) {
    if (candidate.isHazard) {
      candidate.hit = true;
      tracker.misses += 1;
      const hRes = gameState.registerPlayerHazardHit(player);
      if (hRes.stemMuted) {
        syncStageBandMissedAndAudioStem();
        if (stageBand) {
          stageBand.triggerCrowdThrow({ targetRole: roleInst, laneIndex, forced: true });
        }
      }
      if (!isP2 && hRes.stereoReset) audioEngine.setStereoWidthTier(0);
      sfx.playHazardDetonate(laneIndex, laneCount);
      rhythmCanvas.triggerHazardDetonateVisual(laneIndex, player);
      syncHudReadouts();
      if (hRes.failedOut) {
        handleTrackFinished();
      }
      return;
    }

    commitNoteHit(candidate, laneIndex, songTime, windows, player);
    return;
  }

  if (songTime < -0.2) return;
  const wrongTarget = candidate || fallbackWrongKey;
  if (wrongTarget && !wrongTarget.isHazard) {
    wrongTarget.missed = true;
    tracker.misses += 1;
  }

  const missRes = gameState.registerPlayerMiss(player, { isWrongKey: !wrongTarget });
  if (missRes.stemMuted) {
    syncStageBandMissedAndAudioStem();
    if (stageBand && (missRes.crowdHype < 42 || missRes.consecutiveMisses >= 2)) {
      stageBand.triggerCrowdThrow({ targetRole: roleInst, laneIndex });
    }
    if (!isP2 && missRes.stereoReset) audioEngine.setStereoWidthTier(0);
  }
  if (missRes.stemMuted || wrongTarget) {
    sfx.playWrongKeyMiss(laneIndex, laneCount, roleInst);
    rhythmCanvas.triggerMissVisual(missRes.brokeStreak, player);
  }
  syncHudReadouts();

  if (missRes.failedOut) {
    handleTrackFinished();
  }
}

function handleLaneRelease(laneIndex, player = 1) {
  const pressedArr = player === 2 ? lanePressedAtSongTimeP2 : lanePressedAtSongTime;
  if (laneIndex >= 0 && laneIndex < pressedArr.length) {
    pressedArr[laneIndex] = -999;
  }
  rhythmCanvas.setLaneHeld(laneIndex, false, player);
  setPedalPressed(laneIndex, false, player);
}

function setPedalPressed(laneIndex, active, player = 1) {
  const container = player === 2 ? stagePedalsP2Container : stagePedalsContainer;
  if (!container) return;
  const pedal = container.querySelector(`[data-lane="${laneIndex}"]`);
  if (pedal) pedal.classList.toggle('is-pressed', active);
}

function clearAllPedals() {
  [stagePedalsContainer, stagePedalsP2Container].forEach((container) => {
    if (!container) return;
    container.querySelectorAll('.stage-pedal').forEach((el) => {
      el.classList.remove('is-pressed');
    });
  });
}

function tryTriggerFever(player = 1) {
  if (gameState.screen !== SCREENS.STAGE) return;
  if (player === 2 && !gameState.isTwoPlayerMode()) return;
  if (gameState.activateFeverFor(player)) {
    arenaRoot.dataset.fever = 'true';
    if (stageBand) {
      stageBand.crowdAmbience?.triggerMilestoneRoar(1.3);
      stageBand.setInstrumentTheme(gameState.instrument, true);
      stageBand.triggerStagePyro(1.4);
      stageBand.triggerCryoJets(2.2);
      stageBand.triggerBandJump(1.25);
      stageBand.triggerConfettiBurst();
      stageBand.launchFireworkShell(gameState.isEncorePerformance);
    }
    sfx.playFeverActivate();
    rhythmCanvas.triggerFeverBanner(player);
    syncHudReadouts();
  }
}

function syncHudReadouts() {
  hudScore.textContent = gameState.score.toLocaleString();
  hudCombo.textContent = String(gameState.combo);

  if (hudStarRating && hudStarsRow && hudStarProgressFill) {
    const starState = gameState.getStarState();
    const starEls = hudStarsRow.querySelectorAll('.hud-star');
    starEls.forEach((el, idx) => {
      el.classList.toggle('is-earned', idx < starState.stars);
    });
    hudStarRating.classList.toggle('is-gold-stars', starState.isGoldStars);
    hudStarProgressFill.style.transform = `scaleX(${Math.min(1, starState.progress / 5).toFixed(3)})`;
    if (hudStarLabel) {
      hudStarLabel.classList.toggle('is-hidden', !starState.isGoldStars);
    }
  }

  const mult = gameState.getEffectiveMultiplier();
  hudMultiplier.textContent = `${mult}×`;
  hudMultiplier.dataset.fever = String(gameState.feverActive);
  hudMultiplier.dataset.tier = String(gameState.baseMultiplier);

  if (hudStreakBulbs) {
    hudStreakBulbs.querySelectorAll('.streak-bulb').forEach((bulb) => {
      const targetMult = Number(bulb.dataset.mult);
      const lit = targetMult === 8 ? gameState.feverActive : targetMult <= gameState.baseMultiplier;
      bulb.classList.toggle('is-lit', lit);
    });
  }

  const clampedHype = Math.max(0, Math.min(100, gameState.crowdHype));
  const hypePct = Math.round(clampedHype);
  hudHypeFill.style.transform = `scaleX(${(clampedHype / 100).toFixed(3)})`;
  hudHypeVal.textContent = `${hypePct}%`;
  hudHypeFill.dataset.state = hypePct >= 70 ? 'hot' : hypePct >= 35 ? 'steady' : 'danger';

  if (hudRockNeedle) {
    const angleDeg = -72 + (clampedHype / 100) * 144;
    hudRockNeedle.style.transform = `rotate(${angleDeg.toFixed(1)}deg)`;
  }

  if (hudMoraleShieldBadge) {
    hudMoraleShieldBadge.classList.toggle('is-hidden', !gameState.moraleShield);
  }

  hudFeverFill.style.transform = `scaleX(${(gameState.feverCharge / 100).toFixed(3)})`;
  hudWhammyTag.classList.toggle('is-hidden', !gameState.whammyActive);

  const feverReady = gameState.canActivateFever();
  if (hudFeverBulb) {
    hudFeverBulb.classList.toggle('is-ready', feverReady && !gameState.feverActive);
    hudFeverBulb.classList.toggle('is-active', gameState.feverActive);
  }
  btnFeverTrigger.disabled = !feverReady;
  btnFeverTrigger.classList.toggle('is-ready', feverReady);
  btnFeverTrigger.classList.toggle('is-active', gameState.feverActive);
  btnFeverTrigger.textContent = gameState.feverActive
    ? 'FEVER 2×'
    : feverReady
      ? 'SPACE · Fever'
      : `Fever ${Math.round(gameState.feverCharge)}%`;

  const anyDropped = gameState.stemDropped || (gameState.isTwoPlayerMode() && gameState.p2.stemDropped);
  hudAmpCard.classList.toggle('is-dropped', anyDropped);
  const stereoNote = gameState.stereoWidthTier > 0 ? ` · WIDE ${gameState.stereoWidthTier}` : '';
  hudAmpStatus.textContent = anyDropped
    ? 'MISS · HIT TO RESTORE'
    : `LIVE IN MIX${stereoNote}`;

  if (gameState.isTwoPlayerMode()) {
    const p2Mult = gameState.getEffectiveMultiplierFor(2);
    if (hudP2Score) hudP2Score.textContent = gameState.p2.score.toLocaleString();
    if (hudP2Combo) hudP2Combo.textContent = String(gameState.p2.combo);
    if (hudP2Mult) {
      hudP2Mult.textContent = `${p2Mult}×`;
      hudP2Mult.dataset.fever = String(gameState.p2.feverActive);
    }
    if (hudP2FeverFill) {
      hudP2FeverFill.style.transform = `scaleX(${(gameState.p2.feverCharge / 100).toFixed(3)})`;
    }
    if (btnP2FeverTrigger) {
      const p2Ready = gameState.canActivateFeverFor(2);
      btnP2FeverTrigger.disabled = !p2Ready;
      btnP2FeverTrigger.classList.toggle('is-ready', p2Ready);
      btnP2FeverTrigger.classList.toggle('is-active', gameState.p2.feverActive);
      btnP2FeverTrigger.textContent = gameState.p2.feverActive
        ? 'FEVER 2×'
        : p2Ready
          ? 'R-SHIFT · Fever'
          : `Fever ${Math.round(gameState.p2.feverCharge)}%`;
    }
  }
}

/* ==========================================================================
   Pause / Calibration / Crowd Audio / Tour Intermission / Results / Finale
   ========================================================================== */

function openPauseDrawer() {
  if (gameState.screen !== SCREENS.STAGE) return;
  calibrationOnlyMode = false;
  victoryEncoreHoldActive = false;
  victoryEncoreTimer = 0;
  hideSongTitleMarquee();
  audioEngine.pause();
  sfx.updateCrowdState({ playing: false });
  stageBand?.crowdAmbience?.silence();
  rhythmCanvas.clearHeldLanes();
  clearAllPedals();
  whammyKeyHeld = false;

  pauseModalTitle.textContent = 'Stage Paused · Practice & Audio';
  pauseModalSub.textContent = 'Set a section loop, adjust crowd volume, camera direction, or audio sync.';
  practiceSection.classList.remove('is-hidden');
  pauseStageActions.classList.remove('is-hidden');
  btnCloseCalOnly.classList.add('is-hidden');
  syncCalibrationUI();
  syncPracticeLoopUI();
  setScreen(SCREENS.PAUSED);
}

function openBackstageCalibration() {
  unlockSharedAudio();
  calibrationOnlyMode = true;
  pauseModalTitle.textContent = 'Stage Audio, Camera & Sync';
  pauseModalSub.textContent = 'Test stadium crowd cheering, set camera direction, or tune audio/visual sync.';
  practiceSection.classList.add('is-hidden');
  pauseStageActions.classList.add('is-hidden');
  btnCloseCalOnly.classList.remove('is-hidden');
  syncCalibrationUI();
  pauseDrawer.classList.remove('is-hidden');
}

function closeBackstageCalibration() {
  stopTapCalibration();
  calibrationOnlyMode = false;
  pauseDrawer.classList.add('is-hidden');
}

function resumeFromPause() {
  if (gameState.screen !== SCREENS.PAUSED) return;
  stopTapCalibration();
  syncPracticeLoopUI();
  setScreen(SCREENS.STAGE);
  audioEngine.resume();
}

function restartCurrentTrack(playbackRate = gameState.playbackRate) {
  if (!gameState.currentTrack) return;
  startTrack(gameState.currentTrack, {
    playbackRate,
    keepPracticeLoop: playbackRate === gameState.playbackRate && gameState.hasValidPracticeLoop(),
    isEncore: gameState.isEncorePerformance,
  });
}

async function handleTrackFinished() {
  victoryEncoreHoldActive = false;
  victoryEncoreTimer = 0;
  hideSongTitleMarquee();
  audioEngine.stop();
  sfx.stopCrowdAmbience();
  stageBand?.crowdAmbience?.silence();
  rhythmCanvas.stop();
  rhythmCanvas.clearHeldLanes();
  clearAllPedals();
  whammyKeyHeld = false;
  arenaRoot.dataset.fever = 'false';

  const summary = gameState.getSummary();
  const track = gameState.currentTrack;
  lastFinishedSummary = summary;
  lastFinishedTrack = track;
  const inst = gameState.getInstrumentConfig();
  const diff = gameState.getDifficultyConfig();

  if (track && summary.playbackRate >= 1.0 && !gameState.hasValidPracticeLoop()) {
    await saveHighScore(track.id, {
      score: summary.score,
      grade: summary.grade,
      accuracy: summary.accuracy,
      maxCombo: summary.maxCombo,
      stars: summary.stars,
      isGoldStars: summary.isGoldStars,
      instrument: inst.id,
      difficulty: diff.id,
    });
    highScoresMap = await loadAllHighScores();
    renderBuiltinTracks();
    renderSavedLibrary();
    renderGigTicket();
  }

  if (gameState.tourActive) {
    gameState.recordTourSongResult(track, summary);

    if (!summary.failedOut && gameState.hasNextTourSong()) {
      showTourIntermission(track, summary);
      return;
    }

    showTourSummary(summary.failedOut);
    return;
  }

  showEncoreResults(track, summary);
}

function showTourIntermission(prevTrack, prevSummary) {
  const nextTrack = gameState.getNextTourSong();
  const nextIdx = gameState.tourIndex + 1;
  const nextIsEncore = gameState.isTourFinalEncore(nextIdx);
  const total = gameState.setlistQueue.length;

  intermissionChant.textContent = nextIsEncore ? 'EN-CORE! EN-CORE!' : 'WE WANT MORE!';
  intermissionPrevSummary.textContent = `${prevTrack?.title || 'Song'} Complete · Grade ${prevSummary.grade} · ${prevSummary.score.toLocaleString()} pts · ${prevSummary.accuracy.toFixed(1)}%`;

  intermissionNextLabel.textContent = nextIsEncore
    ? '★ FINAL ENCORE PERFORMANCE ★'
    : `UP NEXT · SONG ${nextIdx + 1} OF ${total}`;
  intermissionNextLabel.classList.toggle('is-encore', nextIsEncore);
  intermissionNextTitle.textContent = nextTrack.title;
  intermissionNextMeta.textContent = nextIsEncore
    ? `${nextTrack.artist} · Gold-and-Pyro Encore Stage · Fever Pre-Charged · +10% Score Bonus`
    : `${nextTrack.artist} · ${nextTrack.bpm || 'Auto'} BPM`;

  btnIntermissionGo.textContent = nextIsEncore ? 'Launch Final Encore!' : 'Take the Stage';

  if (stageBand) {
    stageBand.setMemberMissed(gameState.instrument, false);
    stageBand.triggerStagePyro(nextIsEncore ? 1.35 : 0.9);
    if (nextIsEncore) {
      stageBand.setEncorePerformance(true, nextTrack.title);
    }
  }

  if (nextIsEncore) {
    sfx.playEncoreChant();
  } else {
    sfx.playWeWantMoreChant();
  }

  setScreen(SCREENS.INTERMISSION);
}

function launchNextTourSong() {
  const nextTrack = gameState.advanceTourSong();
  if (!nextTrack) {
    returnToBackstage();
    return;
  }
  startTrack(nextTrack, {
    playbackRate: 1.0,
    keepPracticeLoop: false,
    isEncore: gameState.isEncorePerformance,
  });
}

function showTourSummary(failedOut = false) {
  const tour = gameState.getTourSummary();
  const venueMeta = getVenueById(gameState.venueId);
  const inst = gameState.getInstrumentConfig();
  const diff = gameState.getDifficultyConfig();

  tourSummaryVenue.textContent = `${venueMeta.name} · ${inst.label} · ${diff.label}${failedOut ? ' · Tour Ended Early' : ' · Sold-Out Finale'}`;
  tourSummaryGrade.textContent = tour.overallGrade;
  tourSummaryGrade.dataset.grade = tour.overallGrade;
  tourSummaryScore.textContent = tour.totalScore.toLocaleString();
  tourSummaryAccuracy.textContent = `${tour.avgAccuracy.toFixed(1)}% Avg`;
  tourSummaryCombo.textContent = String(tour.bestCombo);

  tourSummarySongs.innerHTML = '';
  tour.songs.forEach((s) => {
    const row = document.createElement('div');
    row.className = s.isEncore ? 'tour-summary-row is-encore' : 'tour-summary-row';
    row.innerHTML = `
      <span class="tour-row-slot">${s.isEncore ? '★ ENCORE' : `SONG ${s.songNumber}`}</span>
      <span class="tour-row-title">${s.title}</span>
      <span class="tour-row-stats tabular">${s.score.toLocaleString()} · ${s.accuracy.toFixed(1)}%</span>
      <span class="tour-row-grade">${s.grade}</span>
    `;
    tourSummarySongs.appendChild(row);
  });

  if (stageBand) {
    stageBand.setMemberMissed(gameState.instrument, false);
    stageBand.setEncorePerformance(true, 'TOUR FINALE');
    stageBand.setEncoreFinale(!failedOut, tour.overallGrade);
  }

  sfx.playEncoreFanfare(failedOut ? 'C' : tour.overallGrade);
  setScreen(SCREENS.TOUR_SUMMARY);
}

function showEncoreResults(track, summary) {
  const inst = gameState.getInstrumentConfig();
  const diff = gameState.getDifficultyConfig();
  const venueMeta = getVenueById(gameState.venueId);

  if (stageBand) {
    stageBand.setPlayersMissed([]);
    stageBand.setInstrumentTheme(gameState.instrument, false);
    stageBand.setEncoreFinale(!summary.failedOut, summary.grade);
  }

  resultsHeading.textContent = summary.failedOut ? 'Crowd Lost — Show Ended' : 'Encore Results';
  resultsTrackTitle.textContent = track ? track.title : 'Live Performance';
  const speedTag = summary.playbackRate !== 1.0 ? ` · ${Math.round(summary.playbackRate * 100)}% Tempo` : '';
  const modeTag =
    summary.playMode === 'coop'
      ? ' · 2P Band Co-Op'
      : summary.playMode === 'faceoff'
        ? ' · 2P Pro Face-Off'
        : '';
  resultsTrackMeta.textContent = `${inst.label} · ${diff.label} · ${venueMeta.name}${modeTag}${speedTag}`;
  resultsGrade.textContent = summary.grade;
  resultsGrade.dataset.grade = summary.grade;
  resultsScore.textContent =
    summary.playMode === 'coop' && summary.p2Summary
      ? summary.combinedScore.toLocaleString()
      : summary.score.toLocaleString();

  if (resultsFcBadge) {
    resultsFcBadge.classList.toggle('is-hidden', !summary.isFullCombo);
  }
  if (resultsGoldBadge) {
    resultsGoldBadge.classList.toggle('is-hidden', !summary.isGoldStars);
  }

  if (resultsStars) {
    const earned = summary.stars || 0;
    resultsStars.classList.toggle('is-gold-stars', Boolean(summary.isGoldStars));
    let starsHtml = renderStarsHtml(earned);
    if (summary.isGoldStars) {
      starsHtml += '<span class="results-stars-tag">GOLD</span>';
    }
    resultsStars.innerHTML = starsHtml;
  }

  resultsAccuracy.textContent = `${summary.accuracy.toFixed(1)}%`;
  resultsMaxCombo.textContent = String(summary.maxCombo);
  if (resultsTimingBias) {
    const offset = Number(summary.avgTimingOffsetMs || 0);
    const dirLabel =
      Math.abs(offset) <= 3
        ? 'Dead-On Beat'
        : offset > 0
          ? `${offset} ms Early`
          : `${Math.abs(offset)} ms Late`;
    resultsTimingBias.textContent = `Avg Timing Offset: ${offset > 0 ? '+' : ''}${offset} ms (${dirLabel})`;
  }

  resultsPerfect.textContent = String(summary.perfect ?? 0);
  if (resultsGreat) resultsGreat.textContent = String(summary.great ?? 0);
  if (resultsGood) resultsGood.textContent = String(summary.good ?? 0);
  resultsMiss.textContent = String(summary.miss ?? 0);

  if (resultsBanterQuote) {
    resultsBanterQuote.textContent = summary.banterQuote || '"Sold-out stadium magic!"';
  }

  if (results2pComparison) {
    if (summary.playMode !== 'solo' && summary.p2Summary) {
      const p1Inst = gameState.getInstrumentConfigFor(1);
      const p2Inst = gameState.getInstrumentConfigFor(2);
      const p2 = summary.p2Summary;
      const isFaceOff = summary.playMode === 'faceoff';
      const p1Win = isFaceOff && summary.faceOffWinner === 'P1';
      const p2Win = isFaceOff && summary.faceOffWinner === 'P2';
      const banner = isFaceOff
        ? summary.faceOffWinner === 'TIE'
          ? '⚡ PRO FACE-OFF · DEADLOCKED TIE! ⚡'
          : `🏆 ${summary.faceOffWinner === 'P1' ? 'PLAYER 1' : 'PLAYER 2'} WINS THE DUEL!`
        : `🤝 BAND CO-OP SYNERGY · ${summary.combinedScore.toLocaleString()} COMBINED PTS`;

      results2pComparison.innerHTML = `
        <div class="results-2p-banner">${banner}</div>
        <div class="results-2p-grid">
          <div class="results-2p-card ${p1Win ? 'is-winner' : ''}">
            <span class="results-2p-card-head">PLAYER 1 · ${p1Inst.shortLabel.toUpperCase()} · GRADE ${summary.grade}</span>
            <span class="results-2p-card-score tabular">${summary.score.toLocaleString()}</span>
            <span class="results-2p-card-meta tabular">${summary.accuracy.toFixed(1)}% · ${summary.maxCombo} Streak</span>
          </div>
          <div class="results-2p-card ${p2Win ? 'is-winner' : ''}">
            <span class="results-2p-card-head">PLAYER 2 · ${p2Inst.shortLabel.toUpperCase()} · GRADE ${p2.grade}</span>
            <span class="results-2p-card-score tabular">${p2.score.toLocaleString()}</span>
            <span class="results-2p-card-meta tabular">${p2.accuracy.toFixed(1)}% · ${p2.maxCombo} Streak</span>
          </div>
        </div>
      `;
      results2pComparison.classList.remove('is-hidden');
    } else {
      results2pComparison.classList.add('is-hidden');
      results2pComparison.innerHTML = '';
    }
  }

  const canEncoreSpeed = summary.encoreSpeedUnlocked && !summary.failedOut;
  btnEncoreSpeedup.classList.toggle('is-hidden', !canEncoreSpeed);
  if (btnSavePoster) {
    btnSavePoster.textContent = '📸 Save Gig Poster PNG';
    btnSavePoster.disabled = false;
  }

  sfx.playEncoreFanfare(summary.grade);
  setScreen(SCREENS.RESULTS);
}

function exportGigPosterPng() {
  const summary = lastFinishedSummary || gameState.getSummary();
  const track = lastFinishedTrack || gameState.currentTrack;
  const venue = getVenueById(gameState.venueId);
  const overlay = getStageOverlayById(gameState.venueOverlayId);
  const inst = gameState.getInstrumentConfig();
  const diff = gameState.getDifficultyConfig();

  const w = 900;
  const h = 1200;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Deep concert magazine background
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#090d1a');
  bg.addColorStop(0.55, '#13172b');
  bg.addColorStop(1, '#080b14');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Subtle stage spotlight beams
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.moveTo(110, 0);
  ctx.lineTo(440, 740);
  ctx.lineTo(20, 740);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f43f5e';
  ctx.beginPath();
  ctx.moveTo(790, 0);
  ctx.lineTo(880, 740);
  ctx.lineTo(460, 740);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Outer gold & crimson frame
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 6;
  ctx.strokeRect(24, 24, w - 48, h - 48);
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.72)';
  ctx.lineWidth = 2;
  ctx.strokeRect(36, 36, w - 72, h - 72);

  // Masthead banner
  ctx.fillStyle = '#b91c1c';
  ctx.fillRect(46, 48, w - 92, 68);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('STAGE HERO LIVE · WORLD TOUR EDITION', w / 2, 95);

  // Badges
  let badgeY = 148;
  if (summary.isFullCombo || summary.isGoldStars) {
    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = summary.isFullCombo ? '#4ade80' : '#fde047';
    const badgeText = [
      summary.isFullCombo ? '★ FC · FULL COMBO CROWN ★' : '',
      summary.isGoldStars ? '★ 5 GOLD STARS ★' : '',
    ]
      .filter(Boolean)
      .join('   ·   ');
    ctx.fillText(badgeText, w / 2, badgeY);
    badgeY += 32;
  }

  // Venue & Headline
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 20px sans-serif';
  const venueLine =
    overlay && overlay.id !== 'STANDARD'
      ? `${venue.name.toUpperCase()} (${overlay.shortName.toUpperCase()})`
      : venue.name.toUpperCase();
  ctx.fillText(`LIVE AT ${venueLine}`, w / 2, badgeY + 12);

  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 50px Impact, "Arial Black", sans-serif';
  const titleText = String(track?.title || 'LIVE ENCORE SET').toUpperCase().slice(0, 28);
  ctx.fillText(titleText, w / 2, badgeY + 78);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(
    `${track?.artist || 'Tour Band'}  ·  ${inst.label} (${diff.label})`,
    w / 2,
    badgeY + 116
  );

  // Grade medallion & score box
  const heroY = badgeY + 150;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.fillRect(64, heroY, w - 128, 220);
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(64, heroY, w - 128, 220);

  ctx.fillStyle = summary.grade === 'S+' || summary.grade === 'S' ? '#fde047' : '#38bdf8';
  ctx.font = 'bold 124px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(summary.grade, 190, heroY + 154);

  const mainScore =
    summary.playMode === 'coop' && summary.p2Summary ? summary.combinedScore : summary.score;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 64px Impact, "Arial Black", sans-serif';
  ctx.fillText(mainScore.toLocaleString(), 320, heroY + 95);

  ctx.fillStyle = summary.isGoldStars ? '#facc15' : '#eab308';
  ctx.font = 'bold 34px sans-serif';
  const starsTxt = '★'.repeat(summary.stars || 0) + '☆'.repeat(Math.max(0, 5 - (summary.stars || 0)));
  ctx.fillText(`${starsTxt}${summary.isGoldStars ? '  GOLD' : ''}`, 320, heroY + 144);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 22px monospace';
  ctx.fillText(
    `ACC ${summary.accuracy.toFixed(1)}%  ·  MAX STREAK ${summary.maxCombo}  ·  OFFSET ${summary.avgTimingOffsetMs > 0 ? '+' : ''}${summary.avgTimingOffsetMs || 0}ms`,
    320,
    heroY + 188
  );

  // Setlist Receipt Table
  const tableY = heroY + 252;
  const cols = [
    ['PERFECT', String(summary.perfect ?? 0), '#fde047'],
    ['GREAT', String(summary.great ?? 0), '#4ade80'],
    ['GOOD', String(summary.good ?? 0), '#38bdf8'],
    ['MISS', String(summary.miss ?? 0), '#f87171'],
  ];
  const colW = (w - 128 - 36) / 4;
  cols.forEach(([lbl, val, col], idx) => {
    const cx = 64 + idx * (colW + 12);
    ctx.fillStyle = '#111827';
    ctx.fillRect(cx, tableY, colW, 120);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.strokeRect(cx, tableY, colW, 120);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(lbl, cx + colW / 2, tableY + 36);
    ctx.fillStyle = col;
    ctx.font = 'bold 44px Impact, "Arial Black", sans-serif';
    ctx.fillText(val, cx + colW / 2, tableY + 92);
  });

  // 2P Comparison Strip if applicable
  let quoteY = tableY + 170;
  if (summary.playMode !== 'solo' && summary.p2Summary) {
    const p1Inst = gameState.getInstrumentConfigFor(1);
    const p2Inst = gameState.getInstrumentConfigFor(2);
    ctx.fillStyle = 'rgba(14, 116, 144, 0.24)';
    ctx.fillRect(64, quoteY - 12, w - 128, 108);
    ctx.strokeStyle = '#38bdf8';
    ctx.strokeRect(64, quoteY - 12, w - 128, 108);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 22px sans-serif';
    const modeTitle =
      summary.playMode === 'faceoff'
        ? `PRO FACE-OFF · WINNER: ${summary.faceOffWinner}`
        : `BAND CO-OP COMBINED: ${summary.combinedScore.toLocaleString()} PTS`;
    ctx.fillText(modeTitle, w / 2, quoteY + 22);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(
      `P1 (${p1Inst.shortLabel}): ${summary.score.toLocaleString()} (${summary.grade})   |   P2 (${p2Inst.shortLabel}): ${summary.p2Summary.score.toLocaleString()} (${summary.p2Summary.grade})`,
      w / 2,
      quoteY + 64
    );
    quoteY += 136;
  }

  // Band Quote & Footer Stamp
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'italic 24px Georgia, serif';
  const quote = summary.banterQuote || '"Sold-out roar across the arena!"';
  ctx.fillText(quote.slice(0, 68), w / 2, quoteY + 30);
  if (quote.length > 68) {
    ctx.fillText(quote.slice(68, 136), w / 2, quoteY + 62);
  }

  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 17px monospace';
  ctx.fillText(
    `STAGE HERO 3D · ${new Date().toLocaleDateString().toUpperCase()} · NO-API OFFLINE CONCERT ENGINE`,
    w / 2,
    h - 64
  );

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeSlug = String(track?.title || 'gig-poster')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    link.download = `stage-hero-${safeSlug || 'poster'}.png`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    if (btnSavePoster) {
      btnSavePoster.textContent = '✓ Poster PNG Saved!';
    }
  }, 'image/png');
}

function returnToBackstage() {
  calibrationOnlyMode = false;
  grandEncoreActive = false;
  grandEncoreManualOverride = false;
  victoryEncoreHoldActive = false;
  victoryEncoreTimer = 0;
  hideSongTitleMarquee();
  gameState.endTour();
  audioEngine.stop();
  sfx.stopCrowdAmbience();
  stageBand?.crowdAmbience?.silence();
  rhythmCanvas.stop();
  rhythmCanvas.resetVisuals();
  activeNotes = [];
  activeNotesP2 = [];
  if (hudP2Panel) hudP2Panel.classList.add('is-hidden');
  setTrainerOpen(false);
  clearAllPedals();
  whammyKeyHeld = false;
  arenaRoot.dataset.fever = 'false';
  arenaRoot.dataset.encore = 'false';
  arenaRoot.style.setProperty('--bass-energy', '0');
  if (stageBand) {
    stageBand.setGrandEncore(false);
    stageBand.setEncoreFinale(false);
    stageBand.setEncorePerformance(false, 'ENCORE STAGE');
    stageBand.setPlayersMissed([]);
    stageBand.setActivePlayers(
      gameState.isTwoPlayerMode() ? [gameState.instrument, gameState.p2Instrument] : [gameState.instrument],
      false
    );
    stageBand.setInstrumentTheme(gameState.instrument, false);
  }
  setScreen(SCREENS.BACKSTAGE);
}

function toggleSfxMute() {
  const nextMuted = !gameState.sfxMuted;
  gameState.setSfxMuted(nextMuted);
  sfx.setMuted(nextMuted);
  stageBand?.crowdAmbience?.setVolume(gameState.crowdVolume, nextMuted);
  btnSfxMute.textContent = nextMuted ? 'SFX Off' : 'SFX On';
  btnSfxMute.setAttribute('aria-pressed', String(nextMuted));
}

function triggerStageFx(fxType) {
  if (!stageBand || gameState.screen !== SCREENS.STAGE) return;
  unlockSharedAudio();
  if (fxType === 'pyro') {
    stageBand.triggerManualPyroAndSparks();
    sfx.playPyroBlast();
    rhythmCanvas.triggerMilestoneBanner('🔥 STAGE PYRO IGNITED!', '#fb923c', 1.15);
  } else if (fxType === 'confetti') {
    stageBand.triggerConfettiBurst(true);
    stageBand.crowdAmbience?.triggerMilestoneRoar(1.05);
    rhythmCanvas.triggerMilestoneBanner('🎊 CONFETTI CANNONS!', '#fde047', 1.15);
  } else if (fxType === 'cryo') {
    stageBand.triggerCryoJets(2.4);
    rhythmCanvas.triggerMilestoneBanner('❄️ CO2 CRYO BLAST!', '#67e8f9', 1.15);
  } else if (fxType === 'crowd') {
    const ev = stageBand.triggerCrowdEvent('CYCLE');
    stageBand.crowdAmbience?.triggerMilestoneRoar(1.25);
    sfx.playComboCheer(30);
    rhythmCanvas.triggerMilestoneBanner(
      `📣 CROWD: ${String(ev || 'STADIUM_WAVE').replace(/_/g, ' ')}!`,
      '#f472b6',
      1.35
    );
  }
}

/* ==========================================================================
   Console Backstage Navigation & Live Stage Keyboard Wiring
   ========================================================================== */

function stepLobbySelection(delta) {
  if (activeLobbyTab === 'setlist') {
    const list = activeSetlistSubTab === 'custom' && savedLocalTracks.length > 0
      ? savedLocalTracks
      : BUILTIN_TRACKS;
    if (list.length === 0) return;
    const idx = list.findIndex((t) => selectedTrack && t.id === selectedTrack.id);
    const nextIdx = (Math.max(0, idx) + delta + list.length) % list.length;
    selectTrackForTicket(list[nextIdx]);
  } else if (activeLobbyTab === 'venues') {
    stepVenue(delta);
  } else if (activeLobbyTab === 'gear') {
    const map = {
      band: { list: BAND_LINEUPS, cur: gameState.bandLineupId, fn: selectBandLineup },
      stars: { list: STAR_LOOKALIKES, cur: gameState.starLookId, fn: selectStarLook },
      guitar: { list: GUITAR_MODELS, cur: gameState.guitarModelId, fn: selectGuitarModel },
      bass: { list: BASS_MODELS, cur: gameState.bassModelId, fn: selectBassModel },
      drums: { list: DRUM_KIT_MODELS, cur: gameState.drumKitModelId, fn: selectDrumKitModel },
      piano: { list: KEYBOARD_MODELS, cur: gameState.keyboardModelId, fn: selectKeyboardModel },
      skins: { list: INSTRUMENT_SKINS, cur: gameState.instrumentSkinId, fn: selectInstrumentSkin },
      highway: { list: HIGHWAY_SKINS, cur: gameState.highwaySkinId, fn: selectHighwaySkin },
    };
    const entry = map[activeGearCategory];
    if (!entry) return;
    const idx = entry.list.findIndex((item) => item.id === entry.cur);
    const nextIdx = (Math.max(0, idx) + delta + entry.list.length) % entry.list.length;
    entry.fn(entry.list[nextIdx].id);
  }
}

function setupKeyboardListeners() {
  window.addEventListener('pointerdown', unlockSharedAudio, { once: true });
  window.addEventListener('keydown', unlockSharedAudio, { once: true });

  window.addEventListener('keydown', (e) => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.repeat) return;

    if (tapCalibrateState.active) {
      if (e.code === 'Space' || e.code === 'KeyD' || e.code === 'KeyF' || e.code === 'KeyG' || e.code === 'Enter') {
        e.preventDefault();
        if (!e.repeat) recordCalibrationTap();
        return;
      }
      if (e.code === 'Escape') {
        e.preventDefault();
        stopTapCalibration();
        return;
      }
    }

    if (e.code === 'Escape') {
      e.preventDefault();
      if (calibrationOnlyMode) closeBackstageCalibration();
      else if (gameState.screen === SCREENS.STAGE) openPauseDrawer();
      else if (gameState.screen === SCREENS.PAUSED) resumeFromPause();
      else if (gameState.screen === SCREENS.BACKSTAGE) {
        if (tourQueuePopover && !tourQueuePopover.classList.contains('is-hidden')) {
          setTourPopoverOpen(false);
        } else if (dedicatedLobbyMode) {
          setLobbyMode('tabs');
          setScreen(SCREENS.MAIN_MENU);
        } else if (activeLobbyTab !== 'setlist') {
          switchLobbyTab('setlist');
        } else {
          setScreen(SCREENS.MAIN_MENU);
        }
      }
      return;
    }

    if (gameState.screen === SCREENS.MAIN_MENU && !calibrationOnlyMode) {
      if ((e.code === 'Enter' || e.code === 'Space') && !e.repeat) {
        e.preventDefault();
        switchLobbyTab('setlist');
        setLobbyMode('tabs');
        setScreen(SCREENS.BACKSTAGE);
      }
      return;
    }

    // Authentic Console Controller Shortcuts on Backstage Lobby
    if (gameState.screen === SCREENS.BACKSTAGE && !calibrationOnlyMode) {
      if ((e.code === 'KeyD' || e.code === 'ArrowUp' || e.code === 'ArrowLeft') && !e.repeat) {
        e.preventDefault();
        stepLobbySelection(-1);
        return;
      }
      if ((e.code === 'KeyF' || e.code === 'ArrowDown' || e.code === 'ArrowRight') && !e.repeat) {
        e.preventDefault();
        stepLobbySelection(1);
        return;
      }
      if (e.code === 'KeyG' && !e.repeat) {
        e.preventDefault();
        if (activeLobbyTab !== 'gear') {
          switchLobbyTab('gear');
        } else {
          const cats = ['band', 'stars', 'guitar', 'bass', 'drums', 'piano', 'skins', 'highway'];
          const next = cats[(cats.indexOf(activeGearCategory) + 1) % cats.length];
          switchGearCategory(next);
        }
        return;
      }
      if (e.code === 'KeyJ' && !e.repeat) {
        e.preventDefault();
        switchLobbyTab(activeLobbyTab === 'venues' ? 'setlist' : 'venues');
        return;
      }
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        launchSelectedGig();
        return;
      }
      return;
    }

    if (gameState.screen !== SCREENS.STAGE) return;

    if (e.code === 'BracketLeft' && !e.repeat) {
      e.preventDefault();
      gameState.setLoopStart(Math.max(0, audioEngine.getSongTime()));
      syncPracticeLoopUI();
      return;
    }
    if (e.code === 'BracketRight' && !e.repeat) {
      e.preventDefault();
      gameState.setLoopEnd(Math.max(1, audioEngine.getSongTime()));
      syncPracticeLoopUI();
      return;
    }

    if (e.code === 'Digit7' && !e.repeat) {
      e.preventDefault();
      triggerStageFx('pyro');
      return;
    }
    if (e.code === 'Digit8' && !e.repeat) {
      e.preventDefault();
      triggerStageFx('confetti');
      return;
    }
    if (e.code === 'Digit9' && !e.repeat) {
      e.preventDefault();
      triggerStageFx('cryo');
      return;
    }
    if (e.code === 'Digit0' && !e.repeat) {
      e.preventDefault();
      triggerStageFx('crowd');
      return;
    }

    if (e.code === 'KeyW' || (!gameState.isTwoPlayerMode() && e.code === 'ArrowUp')) {
      e.preventDefault();
      whammyKeyHeld = true;
      return;
    }

    if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) tryTriggerFever(1);
      return;
    }

    if (e.code === 'ShiftRight' && gameState.isTwoPlayerMode()) {
      e.preventDefault();
      if (!e.repeat) tryTriggerFever(2);
      return;
    }

    if (e.code === 'KeyM' && !e.repeat) {
      e.preventDefault();
      toggleSfxMute();
      return;
    }

    if ((e.code === 'KeyE' || e.code === 'Backquote') && !e.repeat) {
      e.preventDefault();
      if (victoryEncoreHoldActive) return;
      grandEncoreManualOverride = !grandEncoreManualOverride;
      const inNatural = isNaturalGrandEncoreWindow(
        getEffectiveSongTime(),
        audioEngine.getDuration()
      );
      const nextActive = Boolean(inNatural || grandEncoreManualOverride);
      setGrandEncoreState(nextActive, {
        bannerText: nextActive ? '✨ GRAND ENCORE FINALE ✨' : 'ENCORE PREVIEW OFF',
      });
      return;
    }

    const hit = gameState.getPlayerAndLaneFromCode(e.code);
    if (hit) {
      e.preventDefault();
      const exactPlaybackSec = audioEngine.getExactPlaybackTime(e.timeStamp);
      handleLanePress(hit.lane, e.timeStamp, exactPlaybackSec, hit.player);
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyW' || (!gameState.isTwoPlayerMode() && e.code === 'ArrowUp')) {
      whammyKeyHeld = false;
      return;
    }
    const hit = gameState.getPlayerAndLaneFromCode(e.code);
    if (hit) handleLaneRelease(hit.lane, hit.player);
  });

  window.addEventListener(
    'wheel',
    (e) => {
      if (gameState.screen !== SCREENS.STAGE) return;
      if (Math.abs(e.deltaY) > 2) {
        whammyWheelImpulse = 1.0;
      }
    },
    { passive: true }
  );

  window.addEventListener('blur', () => {
    whammyKeyHeld = false;
    whammyWheelImpulse = 0;
    rhythmCanvas.clearHeldLanes();
    clearAllPedals();
  });
}

function setupUiHandlers() {
  if (btnMenuQuickplay) {
    btnMenuQuickplay.addEventListener('click', () => {
      switchLobbyTab('setlist');
      setLobbyMode('dedicated');
      setScreen(SCREENS.BACKSTAGE);
    });
  }
  if (btnMenuRockshop) {
    btnMenuRockshop.addEventListener('click', () => {
      switchLobbyTab('gear');
      setLobbyMode('dedicated');
      setScreen(SCREENS.BACKSTAGE);
    });
  }
  if (btnMenuVenues) {
    btnMenuVenues.addEventListener('click', () => {
      switchLobbyTab('venues');
      setLobbyMode('dedicated');
      setScreen(SCREENS.BACKSTAGE);
    });
  }
  if (btnMenuOptions) {
    btnMenuOptions.addEventListener('click', openBackstageCalibration);
  }
  if (btnMainMenuTopbar) {
    btnMainMenuTopbar.addEventListener('click', () => {
      setTourPopoverOpen(false);
      setLobbyMode('tabs');
      setScreen(SCREENS.MAIN_MENU);
    });
  }
  if (btnDedicatedMainMenu) {
    btnDedicatedMainMenu.addEventListener('click', () => {
      setTourPopoverOpen(false);
      setLobbyMode('tabs');
      setScreen(SCREENS.MAIN_MENU);
    });
  }

  lobbyTabButtons.forEach((btn) => {
    btn.addEventListener('click', () => switchLobbyTab(btn.dataset.lobbyTab));
  });

  setlistSubtabButtons.forEach((btn) => {
    btn.addEventListener('click', () => switchSetlistSubTab(btn.dataset.setlistSubtab));
  });

  gearCatButtons.forEach((btn) => {
    btn.addEventListener('click', () => switchGearCategory(btn.dataset.gearCategory));
  });

  playModeButtons.forEach((btn) => {
    btn.addEventListener('click', () => selectPlayMode(btn.dataset.playMode));
  });

  p2InstrumentButtons.forEach((btn) => {
    btn.addEventListener('click', () => selectP2Instrument(btn.dataset.p2Instrument));
  });

  p2DifficultyButtons.forEach((btn) => {
    btn.addEventListener('click', () => selectP2Difficulty(btn.dataset.p2Difficulty));
  });

  instrumentButtons.forEach((btn) => {
    btn.addEventListener('click', () => selectInstrument(btn.dataset.instrumentChoice));
  });

  difficultyButtons.forEach((btn) => {
    btn.addEventListener('click', () => selectDifficulty(btn.dataset.difficulty));
  });

  lobbySpeedButtons.forEach((btn) => {
    btn.addEventListener('click', () => selectLobbyPracticeSpeed(btn.dataset.lobbySpeed));
  });

  if (btnPlayGig) {
    btnPlayGig.addEventListener('click', launchSelectedGig);
  }

  if (btnTicketQueue) {
    btnTicketQueue.addEventListener('click', () => {
      const track = selectedTrack || BUILTIN_TRACKS[0];
      if (!track) return;
      gameState.addToSetlist(track);
      renderTourSetlistQueue();
      setTourPopoverOpen(true);
    });
  }

  if (btnTourQueueToggle) {
    btnTourQueueToggle.addEventListener('click', () => {
      const opening = tourQueuePopover.classList.contains('is-hidden');
      setTourPopoverOpen(opening);
    });
  }

  if (btnVenuePrev) btnVenuePrev.addEventListener('click', () => stepVenue(-1));
  if (btnVenueNext) btnVenueNext.addEventListener('click', () => stepVenue(1));

  bindLocalAudioDropzone({
    dropZone,
    fileInput,
    onFilesPicked: handleLocalFilesSelected,
  });

  // Tour Setlist Builder controls
  btnStartTour.addEventListener('click', startTourSetlist);
  btnClearTour.addEventListener('click', () => {
    gameState.clearSetlist();
    renderTourSetlistQueue();
  });

  btnIntermissionGo.addEventListener('click', launchNextTourSong);
  btnIntermissionBackstage.addEventListener('click', returnToBackstage);

  btnTourReplay.addEventListener('click', startTourSetlist);
  btnTourBackstage.addEventListener('click', returnToBackstage);

  btnOpenCalibrationBackstage.addEventListener('click', openBackstageCalibration);
  btnCloseCalOnly.addEventListener('click', closeBackstageCalibration);

  // Crowd Volume Slider, SFX Volume Slider + "Test Crowd Cheer" button
  if (crowdVolumeSlider) {
    crowdVolumeSlider.addEventListener('input', () => {
      const vol = Number(crowdVolumeSlider.value) / 100;
      gameState.setCrowdVolume(vol);
      syncCalibrationUI();
    });
  }
  if (sfxVolumeSlider) {
    sfxVolumeSlider.addEventListener('input', () => {
      const vol = Number(sfxVolumeSlider.value) / 100;
      gameState.setSfxVolume(vol);
      syncCalibrationUI();
    });
  }
  if (btnTestCrowd) {
    btnTestCrowd.addEventListener('click', () => {
      unlockSharedAudio();
      sfx.playTestCrowdCheer();
    });
  }

  // Latency calibration + 4-Beat Tap-to-Calibrate controls
  latencySlider.addEventListener('input', () => {
    gameState.setLatencyOffsetMs(Number(latencySlider.value));
    syncCalibrationUI();
  });
  btnLatencyMinus.addEventListener('click', () => {
    gameState.setLatencyOffsetMs(gameState.latencyOffsetMs - 5);
    syncCalibrationUI();
  });
  btnLatencyPlus.addEventListener('click', () => {
    gameState.setLatencyOffsetMs(gameState.latencyOffsetMs + 5);
    syncCalibrationUI();
  });
  btnLatencyReset.addEventListener('click', () => {
    gameState.setLatencyOffsetMs(0);
    syncCalibrationUI();
  });
  if (btnTapCalibrate) {
    btnTapCalibrate.addEventListener('click', () => {
      if (tapCalibrateState.active) {
        recordCalibrationTap();
      } else {
        startTapCalibration();
      }
    });
  }

  if (moraleShieldToggle) {
    moraleShieldToggle.addEventListener('change', () => {
      gameState.setMoraleShield(moraleShieldToggle.checked);
      if (gameState.moraleShield) {
        gameState.stemDropped = false;
        if (gameState.p2) gameState.p2.stemDropped = false;
        syncStageBandMissedAndAudioStem();
      }
      syncCalibrationUI();
    });
  }

  if (pauseMoraleShieldToggle) {
    pauseMoraleShieldToggle.addEventListener('change', () => {
      gameState.setMoraleShield(pauseMoraleShieldToggle.checked);
      if (gameState.moraleShield) {
        gameState.stemDropped = false;
        if (gameState.p2) gameState.p2.stemDropped = false;
        syncStageBandMissedAndAudioStem();
      }
      syncCalibrationUI();
    });
  }

  // Practice Loop & Playback Speed controls inside Pause Drawer
  practiceLoopToggle.addEventListener('change', () => {
    const enabled = practiceLoopToggle.checked;
    if (enabled && gameState.practiceLoop.startSec === null) {
      const nowT = Math.max(0, audioEngine.getSongTime());
      gameState.setLoopStart(Math.max(0, nowT - 6));
      gameState.setLoopEnd(Math.min(audioEngine.getDuration() - 0.5, nowT + 6));
    } else {
      gameState.setPracticeLoopEnabled(enabled);
    }
    syncPracticeLoopUI();
  });

  btnLoopSetStart.addEventListener('click', () => {
    gameState.setLoopStart(Math.max(0, audioEngine.getSongTime()));
    syncPracticeLoopUI();
  });

  btnLoopSetEnd.addEventListener('click', () => {
    gameState.setLoopEnd(Math.max(1, audioEngine.getSongTime()));
    syncPracticeLoopUI();
  });

  btnLoopClear.addEventListener('click', () => {
    gameState.clearPracticeLoop();
    syncPracticeLoopUI();
  });

  speedButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      setPlaybackRateUnified(Number(btn.dataset.playbackRate));
    });
  });

  trainerSpeedButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      setPlaybackRateUnified(Number(btn.dataset.trainerSpeed));
    });
  });

  if (btnToggleTrainer) {
    btnToggleTrainer.addEventListener('click', () => setTrainerOpen(!trainerOpen));
  }
  if (btnTrainerLoopA) {
    btnTrainerLoopA.addEventListener('click', () => {
      gameState.setLoopStart(Math.max(0, audioEngine.getSongTime()));
      syncPracticeLoopUI();
    });
  }
  if (btnTrainerLoopB) {
    btnTrainerLoopB.addEventListener('click', () => {
      gameState.setLoopEnd(Math.max(1, audioEngine.getSongTime()));
      syncPracticeLoopUI();
    });
  }
  if (btnTrainerLoopClear) {
    btnTrainerLoopClear.addEventListener('click', () => {
      gameState.clearPracticeLoop();
      syncPracticeLoopUI();
    });
  }

  if (btnFxPyro) btnFxPyro.addEventListener('click', () => triggerStageFx('pyro'));
  if (btnFxConfetti) btnFxConfetti.addEventListener('click', () => triggerStageFx('confetti'));
  if (btnFxCryo) btnFxCryo.addEventListener('click', () => triggerStageFx('cryo'));
  if (btnFxCrowd) btnFxCrowd.addEventListener('click', () => triggerStageFx('crowd'));

  cameraModeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      selectCameraMode(btn.dataset.cameraMode);
    });
  });

  // Live HUD buttons
  btnFeverTrigger.addEventListener('click', () => tryTriggerFever(1));
  if (btnP2FeverTrigger) {
    btnP2FeverTrigger.addEventListener('click', () => tryTriggerFever(2));
  }
  btnSfxMute.addEventListener('click', toggleSfxMute);
  btnPauseStage.addEventListener('click', openPauseDrawer);
  btnBackstageHud.addEventListener('click', returnToBackstage);

  // Pause & Results actions
  btnResume.addEventListener('click', resumeFromPause);
  btnNextSongPause?.addEventListener('click', playNextSong);
  btnRestart.addEventListener('click', () => restartCurrentTrack(gameState.playbackRate));
  btnFinishNow.addEventListener('click', handleTrackFinished);
  btnBackstagePause.addEventListener('click', returnToBackstage);

  if (btnSavePoster) {
    btnSavePoster.addEventListener('click', exportGigPosterPng);
  }
  btnEncoreSpeedup.addEventListener('click', () => {
    gameState.clearPracticeLoop();
    startTrack(gameState.currentTrack, { playbackRate: 1.1, keepPracticeLoop: false, isEncore: false });
  });
  btnNextSongResults?.addEventListener('click', playNextSong);
  btnPlayAgain.addEventListener('click', () => restartCurrentTrack(1.0));
  btnBackstageResults.addEventListener('click', returnToBackstage);
}

// Boot application & load persisted Custom Setlist + high scores
async function boot() {
  buildCrowdLightsticks();
  initStageBand();
  renderOverlaySelector();
  renderVenueSelector();
  selectPlayMode(gameState.playMode);
  selectP2Instrument(gameState.p2Instrument);
  selectP2Difficulty(gameState.p2Difficulty);
  selectInstrument(gameState.instrument);
  selectDifficulty(gameState.difficulty);
  selectLobbyPracticeSpeed(1.0);
  selectCameraMode(gameState.cameraMode);
  setTrainerOpen(false);
  syncCalibrationUI();
  renderTourSetlistQueue();
  renderGearDock();
  setupKeyboardListeners();
  setupUiHandlers();
  switchLobbyTab('setlist');
  setScreen(SCREENS.MAIN_MENU);

  const [savedSongs, savedScores] = await Promise.all([
    loadSavedLocalTracks(),
    loadAllHighScores(),
  ]);
  savedLocalTracks = savedSongs;
  highScoresMap = savedScores;
  renderBuiltinTracks();
  renderSavedLibrary();
  renderGigTicket();
}

boot();

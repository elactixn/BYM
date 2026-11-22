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
} from './beatScheduler.js';
import {
  GameState,
  SCREENS,
} from './gameState.js';
import {
  AudioEngine,
  WALK_ON_LEAD_IN_SEC,
  analyzeAudioInWorker,
  computeStemActivityFromBuffers,
} from './audioEngine.js';
import { SoundEffects } from './soundEffects.js';
import { RhythmCanvas } from './rhythmCanvas.js';
import { StageBand } from './stageBand.js';
import { VENUES, getVenueById } from './venues.js';
import {
  BAND_LINEUPS,
  HIGHWAY_SKINS,
  GUITAR_MODELS,
  BASS_MODELS,
  DRUM_KIT_MODELS,
  KEYBOARD_MODELS,
  STAR_LOOKALIKES,
  getBandLineupById,
  getHighwaySkinById,
  getGuitarModelById,
  getBassModelById,
  getDrumKitModelById,
  getKeyboardModelById,
  getStarLookById,
} from './bandGearCatalog.js';

const CHART_CACHE_VERSION = 'v10';
const gameState = new GameState();
const sfx = new SoundEffects();
let stageBand = null;
let idleBandRaf = null;
let lastIdleBandMs = 0;

// In-memory sub-second Web Worker FFT analysis cache keyed by track.id (0ms instrument/difficulty switches)
const workerAnalysisCache = new Map();

// Console Lobby Navigation State
let activeLobbyTab = 'setlist'; // 'setlist' | 'gear' | 'venues'
let activeSetlistSubTab = 'world-tour'; // 'world-tour' | 'custom'
let activeGearCategory = 'band'; // 'band' | 'guitar' | 'bass' | 'drums' | 'highway'
let selectedTrack = BUILTIN_TRACKS[0];
let lobbyPracticeSpeed = 1.0;

// Runtime song & chart state
let masterNotes = [];
let activeNotes = [];
let activeBeatGrid = [];
let activeSections = [];
let activeTrackBpm = 120;
let savedLocalTracks = [];
let highScoresMap = {};
let lastHudUpdateMs = 0;
let lastSustainSparkMs = 0;
let lastChorusPyroMs = 0;
let calibrationOnlyMode = false;

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
const instrumentButtons = document.querySelectorAll('[data-instrument-choice]');
const difficultyButtons = document.querySelectorAll('[data-difficulty]');
const lobbySpeedButtons = document.querySelectorAll('[data-lobby-speed]');
const btnTicketQueue = document.getElementById('btn-ticket-queue');
const btnPlayGig = document.getElementById('btn-play-gig');

// Backstage Gear Dock DOM
const gearCatButtons = document.querySelectorAll('[data-gear-category]');
const gearActiveDesc = document.getElementById('gear-active-desc');
const gearActiveGrid = document.getElementById('gear-active-grid');

// Venues Carousel DOM
const venueActiveType = document.getElementById('venue-active-type');
const venueActiveName = document.getElementById('venue-active-name');
const venueActiveCity = document.getElementById('venue-active-city');
const venueActiveDesc = document.getElementById('venue-active-desc');
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

const btnSfxMute = document.getElementById('btn-sfx-mute');
const btnPauseStage = document.getElementById('btn-pause-stage');
const btnBackstageHud = document.getElementById('btn-backstage-hud');

// Stage pedals & crowd
const stagePedalsContainer = document.getElementById('stage-pedals');
const crowdContainer = document.getElementById('crowd-lightsticks');

// Calibration / Pause / Practice Loop / Crowd Volume Drawer controls
const pauseModalTitle = document.getElementById('pause-modal-title');
const pauseModalSub = document.getElementById('pause-modal-sub');
const latencySlider = document.getElementById('latency-slider');
const latencyReadout = document.getElementById('latency-readout');
const btnLatencyMinus = document.getElementById('btn-latency-minus');
const btnLatencyPlus = document.getElementById('btn-latency-plus');
const btnLatencyReset = document.getElementById('btn-latency-reset');

const crowdVolumeSlider = document.getElementById('crowd-volume-slider');
const crowdVolumeReadout = document.getElementById('crowd-volume-readout');
const btnTestCrowd = document.getElementById('btn-test-crowd');

const practiceSection = document.getElementById('practice-loop-section');
const practiceLoopToggle = document.getElementById('practice-loop-toggle');
const btnLoopSetStart = document.getElementById('btn-loop-set-start');
const btnLoopSetEnd = document.getElementById('btn-loop-set-end');
const btnLoopClear = document.getElementById('btn-loop-clear');
const loopBoundsReadout = document.getElementById('loop-bounds-readout');
const speedButtons = document.querySelectorAll('[data-playback-rate]');
const cameraModeButtons = document.querySelectorAll('[data-camera-mode]');

const btnResume = document.getElementById('btn-resume');
const btnNextSongPause = document.getElementById('btn-next-song-pause');
const btnRestart = document.getElementById('btn-restart');
const btnFinishNow = document.getElementById('btn-finish-now');
const btnBackstagePause = document.getElementById('btn-backstage-pause');
const btnCloseCalOnly = document.getElementById('btn-close-cal-only');
const pauseStageActions = document.getElementById('pause-stage-actions');

// Single-Song Encore Results elements
const resultsHeading = document.getElementById('results-modal-title');
const resultsTrackTitle = document.getElementById('results-track-title');
const resultsTrackMeta = document.getElementById('results-track-meta');
const resultsGrade = document.getElementById('results-grade');
const resultsScore = document.getElementById('results-score');
const resultsStars = document.getElementById('results-stars');
const resultsAccuracy = document.getElementById('results-accuracy');
const resultsMaxCombo = document.getElementById('results-max-combo');
const resultsPerfect = document.getElementById('results-perfect');
const resultsEarly = document.getElementById('results-early');
const resultsLate = document.getElementById('results-late');
const resultsMiss = document.getElementById('results-miss');
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
      } else {
        handleTrackFinished();
      }
    }
  },
});

function unlockSharedAudio() {
  const ctx = audioEngine.getContext();
  sfx.unlockAudio(ctx);
  sfx.setCrowdVolume(gameState.crowdVolume);
  sfx.setMuted(gameState.sfxMuted);
}

function getEffectiveSongTime() {
  return audioEngine.getSongTime() - gameState.latencyOffsetMs / 1000;
}

// RhythmCanvas
const rhythmCanvas = new RhythmCanvas(canvasEl, {
  getGameState: () => gameState,
  getNotes: () => activeNotes,
  getBeatGrid: () => activeBeatGrid,
  getEffectiveTime: () => getEffectiveSongTime(),
  getAudioTelemetry: () => ({
    drumEnergy: audioEngine.liveDrumEnergy,
    bassEnergy: audioEngine.liveBassEnergy,
    guitarEnergy: audioEngine.liveGuitarEnergy,
    pianoEnergy: audioEngine.livePianoEnergy,
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
      cameraMode: gameState.cameraMode,
      bandLineupId: gameState.bandLineupId,
      guitarModelId: gameState.guitarModelId,
      bassModelId: gameState.bassModelId,
      drumKitModelId: gameState.drumKitModelId,
      keyboardModelId: gameState.keyboardModelId,
      starLookId: gameState.starLookId,
      onFireworkBurst: (pan) => sfx.playFireworkBurst(pan),
    });
    stageBand.setBackstageFocus('setlist');
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
    stageBand.update(
      dt,
      {
        playing: false,
        instrument: gameState.instrument,
        feverActive: false,
        isEncore: gameState.isEncorePerformance,
        stemDropped: false,
        combo: 0,
        hype: isCelebration ? 90 : 62,
        bpm: activeTrackBpm || 120,
        songTime: now / 1000,
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
  let html = '';
  for (let i = 1; i <= 5; i += 1) {
    html += i <= count ? '<span>☠</span>' : '<span class="skull-dim">☠</span>';
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
    stageBand.setBackstageFocus(activeGearCategory);
  }
}

function switchLobbyTab(tabId) {
  activeLobbyTab = tabId;
  if (backstageOverlay) backstageOverlay.dataset.activeTab = tabId;

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
  const laneCfg = gameState.getLaneConfig();
  if (ticketInstrumentCaption) ticketInstrumentCaption.textContent = inst.dropDesc;
  if (ticketKeysHint) ticketKeysHint.textContent = `Keys: ${laneCfg.keys.join(' ')}`;

  const venue = getVenueById(gameState.venueId);
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

  if (ticketVenueStamp) ticketVenueStamp.textContent = venue.name;
  if (ticketGearStamp) {
    const lookSuffix = starLook && starLook.id !== 'default-band' ? ` · ${starLook.shortName}` : '';
    ticketGearStamp.textContent = `${lineup.shortName} · ${gearName}${lookSuffix}`;
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
      startTrack(nextTrack, { playbackRate: 1.0, isEncore: gameState.isFinalTourSong() });
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

/* ==========================================================================
   Tab 3: Venues Horizontal Tour-Poster Carousel
   ========================================================================== */

const VENUE_POSTER_ACCENTS = [
  '#dc2626', '#f97316', '#f472b6', '#22d3ee', '#eab308', '#06b6d4',
  '#f59e0b', '#06b6d4', '#ef4444', '#a855f7', '#22c55e',
  '#f97316', '#38bdf8', '#ec4899', '#eab308', '#14b8a6',
];

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

  syncVenueBanner(getVenueById(gameState.venueId));
}

function syncVenueBanner(meta) {
  if (venueActiveType) venueActiveType.textContent = meta.type;
  if (venueActiveName) venueActiveName.textContent = meta.name;
  if (venueActiveCity) venueActiveCity.textContent = meta.location;
  if (venueActiveDesc) venueActiveDesc.textContent = meta.description;
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
    stageBand.setVenue(meta.id);
  }
  syncVenueBanner(meta);
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

function renderStagePedals() {
  const config = gameState.getLaneConfig();
  stagePedalsContainer.innerHTML = '';
  stagePedalsContainer.dataset.lanes = String(config.count);

  config.keys.forEach((keyLabel, laneIndex) => {
    const color = config.colors[laneIndex];
    const panPct = Math.round((-0.8 + (laneIndex / (config.count - 1)) * 1.6) * 100);
    const panText = panPct === 0 ? 'C' : panPct < 0 ? `L${Math.abs(panPct)}` : `R${panPct}`;

    const pedal = document.createElement('button');
    pedal.type = 'button';
    pedal.className = 'stage-pedal';
    pedal.dataset.lane = String(laneIndex);
    pedal.style.setProperty('--pedal-color', color.base);
    pedal.style.setProperty('--pedal-bright', color.bright);
    pedal.style.setProperty('--pedal-glow', color.glow);
    pedal.setAttribute('aria-label', `Lane ${laneIndex + 1} (${keyLabel})`);

    pedal.innerHTML = `
      <span class="pedal-led" aria-hidden="true"></span>
      <span class="pedal-key">${keyLabel}</span>
      <span class="pedal-pan tabular" aria-hidden="true">${panText}</span>
    `;

    pedal.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (pedal.setPointerCapture) {
        try {
          pedal.setPointerCapture(e.pointerId);
        } catch {
          // Ignore
        }
      }
      handleLanePress(laneIndex);
    });

    const onUp = () => handleLaneRelease(laneIndex);
    pedal.addEventListener('pointerup', onUp);
    pedal.addEventListener('pointercancel', onUp);
    pedal.addEventListener('lostpointercapture', onUp);

    stagePedalsContainer.appendChild(pedal);
  });
}

function selectInstrument(id) {
  gameState.setInstrument(id);
  arenaRoot.dataset.instrument = gameState.instrument;
  if (stageBand) {
    stageBand.setInstrumentTheme(gameState.instrument, gameState.feverActive);
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
  const formatted = `${val > 0 ? '+' : ''}${val} ms`;
  latencySlider.value = String(val);
  latencyReadout.textContent = formatted;
  backstageLatencyVal.textContent = formatted;

  const volPct = Math.round(gameState.crowdVolume * 100);
  if (crowdVolumeSlider) crowdVolumeSlider.value = String(volPct);
  if (crowdVolumeReadout) crowdVolumeReadout.textContent = `${volPct}%`;
  sfx.setCrowdVolume(gameState.crowdVolume);
}

function syncPracticeLoopUI() {
  const lp = gameState.practiceLoop;
  practiceLoopToggle.checked = lp.enabled;

  const startStr = lp.startSec !== null ? formatTime(lp.startSec) : '—';
  const endStr = lp.endSec !== null ? formatTime(lp.endSec) : '—';
  loopBoundsReadout.textContent = `Loop: ${startStr} → ${endStr}`;

  speedButtons.forEach((btn) => {
    const r = Number(btn.dataset.playbackRate);
    const active = Math.abs(r - gameState.playbackRate) < 0.01;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  });

  if (gameState.hasValidPracticeLoop()) {
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
  backstageOverlay.classList.toggle('is-hidden', nextScreen !== SCREENS.BACKSTAGE);
  pauseDrawer.classList.toggle('is-hidden', nextScreen !== SCREENS.PAUSED && !calibrationOnlyMode);
  intermissionOverlay.classList.toggle('is-hidden', nextScreen !== SCREENS.INTERMISSION);
  resultsOverlay.classList.toggle('is-hidden', nextScreen !== SCREENS.RESULTS);
  tourSummaryOverlay.classList.toggle('is-hidden', nextScreen !== SCREENS.TOUR_SUMMARY);

  const isStage = nextScreen === SCREENS.STAGE || nextScreen === SCREENS.PAUSED;
  arenaRoot.classList.toggle('stage-live', isStage);
  arenaRoot.classList.toggle('stage-backstage', nextScreen === SCREENS.BACKSTAGE);

  if (nextScreen === SCREENS.BACKSTAGE) {
    syncBackstageCameraFocus();
  }
}

function showScanProgress(title, sub, pct = null) {
  scanOverlayTitle.textContent = title;
  scanOverlaySub.textContent = sub;
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
    const record = await importLocalAudioFile(audioFile, ctx, midiFile || null, chartFile || null);

    savedLocalTracks = [record, ...savedLocalTracks.filter((item) => item.id !== record.id)];
    switchSetlistSubTab('custom');
    selectTrackForTicket(record);

    dropStatusEl.textContent = chartFile
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

  const inst = gameState.getInstrumentConfig();
  const diff = gameState.getDifficultyConfig();
  const chartKey = `${CHART_CACHE_VERSION}_${gameState.instrument}_${gameState.laneCount}_${diff.id}`;

  try {
    let mediaSource = null;
    let chart = null;
    let activeStemActivity = null;

    if (track.sourceType === 'builtin') {
      // 0ms pre-authored musical chart + cached multi-stem WebAudio synthesis
      showScanProgress(`Setting Up ${track.title}`, `Tuning ${inst.label} rig & stage lighting…`);
      chart = buildPreauthoredBuiltinChart(track, {
        instrument: gameState.instrument,
        difficulty: diff.id,
        laneCount: gameState.laneCount,
      });
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
      showScanProgress(`Loading ${track.title}`, 'Decoding concert audio…', 14);
      const decodedBuffer = await decodeStoredLocalTrack(track, ctx);
      mediaSource = { mode: 'local', buffer: decodedBuffer };

      let cachedAnalysis = workerAnalysisCache.get(track.id) || track.workerAnalysis || null;
      if (cachedAnalysis) {
        workerAnalysisCache.set(track.id, cachedAnalysis);
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
              showScanProgress(`Soundcheck: ${track.title}`, msg || 'Analyzing stage cues…', 20 + Math.round(pct * 75));
            },
          });
          workerAnalysisCache.set(track.id, cachedAnalysis);
          track.workerAnalysis = cachedAnalysis;
          track.stemActivity = cachedAnalysis.stemActivity;
          activeStemActivity = cachedAnalysis.stemActivity;
          await updateLocalTrackChartCache(track.id, null, null, cachedAnalysis.bpm, {
            workerAnalysis: cachedAnalysis,
            stemActivity: cachedAnalysis.stemActivity,
          });
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
            const scaled = 18 + Math.round(pct * 80);
            showScanProgress(
              `Analyzing ${inst.label} Track`,
              msg || `Mapping ${inst.label.toLowerCase()} notes & song sections for ${track.title}…`,
              scaled
            );
          },
        });

        activeStemActivity = chart.stemActivity || cachedAnalysis?.stemActivity || null;
        if (chart.workerAnalysis) {
          workerAnalysisCache.set(track.id, chart.workerAnalysis);
          track.workerAnalysis = chart.workerAnalysis;
        }
        if (activeStemActivity) {
          track.stemActivity = activeStemActivity;
        }

        const resolvedSections = chart.sections || chart.workerAnalysis?.sections || cachedAnalysis?.sections || [];
        const cachePayload = {
          bpm: chart.bpm,
          beatGrid: chart.beatGrid,
          sections: resolvedSections,
          notes: chart.notes,
        };
        track.bpm = chart.bpm;
        track.charts = track.charts || {};
        track.charts[chartKey] = cachePayload;

        const extraPatch = {};
        if (chart.workerAnalysis) extraPatch.workerAnalysis = chart.workerAnalysis;
        if (activeStemActivity) extraPatch.stemActivity = activeStemActivity;

        await updateLocalTrackChartCache(
          track.id,
          chartKey,
          cachePayload,
          chart.bpm,
          Object.keys(extraPatch).length > 0 ? extraPatch : null
        );
        renderSavedLibrary();
        renderGigTicket();
      }
    }

    audioEngine.setStemActivity(activeStemActivity);
    hideScanProgress();

    masterNotes = chart.notes;
    activeNotes = cloneFreshNotes(masterNotes);
    activeBeatGrid = chart.beatGrid;
    activeSections = chart.sections || track.workerAnalysis?.sections || [];
    activeTrackBpm = chart.bpm || track.bpm || 120;
    lastChorusPyroMs = 0;

    gameState.setTrack(track);
    gameState.resetRun({
      keepPracticeLoop,
      playbackRate,
      isEncore,
      totalChartNotes: masterNotes.length,
    });
    rhythmCanvas.resetVisuals();
    hideSongTitleMarquee();
    whammyKeyHeld = false;
    whammyWheelImpulse = 0;

    arenaRoot.dataset.instrument = inst.id;
    arenaRoot.dataset.fever = 'false';
    arenaRoot.dataset.encore = isEncore ? 'true' : 'false';

    if (stageBand) {
      stageBand.setEncoreFinale(false);
      stageBand.setTrackTitle(track.title);
      stageBand.setEncorePerformance(isEncore, track.title);
      stageBand.setInstrumentTheme(inst.id, false);
      stageBand.setMemberMissed(inst.id, false);
      stageBand.resetCameraForSong();
      stageBand.resize();
    }

    const venueMeta = getVenueById(gameState.venueId);
    const tourTag = gameState.tourActive
      ? isEncore
        ? ' · ★ FINAL ENCORE'
        : ` · Song ${gameState.tourIndex + 1}/${gameState.setlistQueue.length}`
      : '';
    hudTrackTitle.textContent = isEncore ? `★ ${track.title}` : track.title;
    hudTrackMeta.textContent = `${track.artist} · ${activeTrackBpm} BPM · ${inst.label} · ${venueMeta.name}${tourTag}`;
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

    hudTimeCurrent.textContent = formatTime(startOffset);
    hudTimeTotal.textContent = formatTime(
      mediaSource.mode === 'stems' ? mediaSource.drums.duration : mediaSource.buffer.duration
    );
    hudProgressFill.style.transform = 'scaleX(0)';

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

function resetNotesFromTimestamp(startSec) {
  activeNotes = masterNotes.map((n) => ({
    ...n,
    hit: n.hitTimeSec < startSec - 0.05,
    holding: false,
    holdCompleted: n.hitTimeSec < startSec - 0.05,
    missed: false,
  }));
}

function jumpToPracticeLoopStart() {
  if (!gameState.hasValidPracticeLoop()) return;
  const startSec = gameState.practiceLoop.startSec;
  resetNotesFromTimestamp(startSec);
  audioEngine.seekTo(startSec);
  audioEngine.setInstrumentStemMuted(false);
  gameState.stemDropped = false;
  if (stageBand) stageBand.setMemberMissed(gameState.instrument, false);
}

function handleFrameTick(dt) {
  if (gameState.screen !== SCREENS.STAGE) return;

  audioEngine.updateTelemetry();

  const songTime = getEffectiveSongTime();
  const duration = audioEngine.getDuration();

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
  if (feverEnded) {
    arenaRoot.dataset.fever = 'false';
    if (stageBand) stageBand.setInstrumentTheme(gameState.instrument, false);
  }

  // 3. Process held Sustain bars + Whammy / Vibrato Pitch-Bend modulation
  whammyWheelImpulse = Math.max(0, whammyWheelImpulse - dt * 2.8);
  const laneColors = gameState.getLaneConfig().colors;
  const nowPerf = performance.now();
  let anyActiveSustainHeld = false;

  for (let i = 0; i < activeNotes.length; i += 1) {
    const note = activeNotes[i];
    if (!note.holding || note.holdCompleted) continue;

    const tailEnd = note.hitTimeSec + note.sustainDuration;
    if (songTime >= tailEnd) {
      note.holding = false;
      note.holdCompleted = true;
    } else if (rhythmCanvas.heldLanes[note.lane]) {
      anyActiveSustainHeld = true;
      const whammyOn = whammyKeyHeld || whammyWheelImpulse > 0.1;
      gameState.registerSustainTick(dt, whammyOn);

      if (nowPerf - lastSustainSparkMs >= 90) {
        lastSustainSparkMs = nowPerf;
        rhythmCanvas.triggerSustainSparkVisual(
          note.lane,
          laneColors[note.lane],
          gameState.feverActive,
          whammyOn
        );
        sfx.playSustainSpark(note.lane, gameState.laneCount, gameState.feverActive, whammyOn);
      }
    } else {
      note.holding = false;
      note.holdCompleted = true;
    }
  }

  const whammyTarget = anyActiveSustainHeld
    ? Math.min(1, (whammyKeyHeld ? 1.0 : 0) + whammyWheelImpulse)
    : 0;
  gameState.whammyActive = whammyTarget > 0.1;
  audioEngine.updateWhammy(whammyTarget, dt);
  rhythmCanvas.setWhammyVisual(whammyTarget);

  // 4. Detect expired missed notes using active difficulty's timing window
  const windows = gameState.getTimingWindows();
  const missThresholdSec = windows.GOOD_MS / 1000;
  let anyMiss = false;
  for (let i = 0; i < activeNotes.length; i += 1) {
    const note = activeNotes[i];
    if (note.hit || note.missed) continue;

    if (songTime - note.hitTimeSec > missThresholdSec) {
      note.missed = true;
      anyMiss = true;
      const res = gameState.registerMiss();
      audioEngine.setInstrumentStemMuted(true);
      if (stageBand) stageBand.setMemberMissed(gameState.instrument, true);
      if (res.stereoReset) audioEngine.setStereoWidthTier(0);
      rhythmCanvas.triggerMissVisual(res.brokeStreak);
      sfx.playWrongKeyMiss(note.lane, gameState.laneCount, gameState.instrument);

      if (res.failedOut) {
        handleTrackFinished();
        return;
      }
    } else if (note.hitTimeSec > songTime) {
      break;
    }
  }

  // 5. Update 3D Stage Band, Venue FX, Kinetic Camera & Chorus Pyro
  if (
    stageBand &&
    (gameState.combo >= 15 || gameState.isEncorePerformance) &&
    !gameState.stemDropped &&
    audioEngine.liveOverallEnergy > 0.56 &&
    audioEngine.liveBassEnergy > 0.5 &&
    nowPerf - lastChorusPyroMs > 4400
  ) {
    lastChorusPyroMs = nowPerf;
    stageBand.triggerStagePyro(gameState.isEncorePerformance ? 1.25 : 0.95);
  }

  if (stageBand) {
    const currentSection = getSongSectionAt(activeSections, songTime);
    stageBand.update(
      dt,
      {
        playing: true,
        instrument: gameState.instrument,
        feverActive: gameState.feverActive,
        isEncore: gameState.isEncorePerformance,
        stemDropped: gameState.stemDropped,
        combo: gameState.combo,
        hype: gameState.crowdHype,
        bpm: activeTrackBpm,
        songTime,
        sustainHeld: anyActiveSustainHeld,
        stemActivity: audioEngine.getStemActivityAt(songTime),
        currentSection,
        beatGrid: activeBeatGrid,
      },
      {
        drumEnergy: audioEngine.liveDrumEnergy,
        bassEnergy: audioEngine.liveBassEnergy,
        guitarEnergy: audioEngine.liveGuitarEnergy,
        pianoEnergy: audioEngine.livePianoEnergy,
        vocalEnergy: audioEngine.liveVocalEnergy,
        overallEnergy: audioEngine.liveOverallEnergy,
      }
    );
  }

  sfx.updateCrowdState({
    hype: gameState.crowdHype,
    feverActive: gameState.feverActive,
    playing: true,
    bpm: activeTrackBpm,
    songTime,
    isEncore: gameState.isEncorePerformance,
  });

  // 6. Live bass energy drives crowd lightsticks & amp VU meter
  const bassEnergy = Math.min(1, audioEngine.liveBassEnergy * 1.45);
  arenaRoot.style.setProperty('--bass-energy', bassEnergy.toFixed(3));
  hudAmpMeterFill.style.transform = `scaleX(${Math.min(1, 0.12 + audioEngine.liveOverallEnergy * 1.5).toFixed(3)})`;

  // 7. Throttled HUD readouts
  if (anyMiss || nowPerf - lastHudUpdateMs >= 65) {
    lastHudUpdateMs = nowPerf;
    syncHudReadouts();

    const clampedTime = Math.max(0, songTime);
    hudTimeCurrent.textContent = formatTime(clampedTime);
    if (duration > 0) {
      hudTimeTotal.textContent = formatTime(duration);
      const ratio = Math.max(0, Math.min(1, clampedTime / duration));
      hudProgressFill.style.transform = `scaleX(${ratio.toFixed(4)})`;
    }
  }
}

function handleLanePress(laneIndex) {
  if (gameState.screen !== SCREENS.STAGE) return;
  if (laneIndex < 0 || laneIndex >= gameState.laneCount) return;

  rhythmCanvas.setLaneHeld(laneIndex, true);
  setPedalPressed(laneIndex, true);

  const songTime = getEffectiveSongTime();
  const windows = gameState.getTimingWindows();
  const maxWindowSec = windows.WRONG_KEY_WINDOW_MS / 1000;

  let candidate = null;
  let bestAbs = Infinity;
  for (let i = 0; i < activeNotes.length; i += 1) {
    const n = activeNotes[i];
    if (n.hit || n.missed || n.lane !== laneIndex) continue;
    const diff = n.hitTimeSec - songTime;
    if (diff < -maxWindowSec) continue;
    if (diff > maxWindowSec) break;
    const abs = Math.abs(diff);
    if (abs < bestAbs) {
      bestAbs = abs;
      candidate = n;
    }
  }

  const colorObj = gameState.getLaneConfig().colors[laneIndex];

  if (candidate && bestAbs <= windows.GOOD_MS / 1000) {
    const deltaMs = (candidate.hitTimeSec - songTime) * 1000;
    candidate.hit = true;
    if (candidate.sustainDuration > 0) {
      candidate.holding = true;
    }

    const res = gameState.registerHit(deltaMs, candidate.isFever);
    rhythmCanvas.recordTimingDeviation(deltaMs, windows.GOOD_MS, res.judgement);

    if (res.stemRestored) {
      audioEngine.setInstrumentStemMuted(false);
      if (stageBand) stageBand.setMemberMissed(gameState.instrument, false);
    }

    if (res.stereoTierChanged) {
      audioEngine.setStereoWidthTier(res.stereoTier);
    }

    if (stageBand) {
      stageBand.notifyNoteEvent({
        instrument: gameState.instrument,
        lane: laneIndex,
        pitchNorm: candidate.pitchNorm,
        drumPart: candidate.drumPart,
        isChord: candidate.isChord,
      });
    }

    if (res.hitStreakBanner > 0) {
      rhythmCanvas.triggerMilestoneBanner(`${res.hitStreakBanner} NOTE STREAK!`, '#fde047', 1.65);
    }

    if (res.hitCheerMilestone > 0) {
      sfx.playComboCheer(res.hitCheerMilestone);
    }

    if (res.hitPyroMilestone > 0) {
      rhythmCanvas.triggerPyroBurst(res.hitPyroMilestone);
      if (stageBand) {
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
      gameState.laneCount,
      gameState.instrument,
      res.judgement,
      candidate.isFever || gameState.feverActive
    );

    rhythmCanvas.triggerHitVisual({
      laneIndex,
      judgement: res.judgement,
      colorObj,
      isChord: candidate.isChord,
      isFever: candidate.isFever,
      feverActive: gameState.feverActive,
      multiplierUp: res.multiplierUp,
      effectiveMultiplier: res.effectiveMultiplier,
    });

    syncHudReadouts();
    return;
  }

  if (songTime < -0.2) return;
  if (candidate) candidate.missed = true;

  const missRes = gameState.registerMiss();
  audioEngine.setInstrumentStemMuted(true);
  if (stageBand) stageBand.setMemberMissed(gameState.instrument, true);
  if (missRes.stereoReset) audioEngine.setStereoWidthTier(0);
  sfx.playWrongKeyMiss(laneIndex, gameState.laneCount, gameState.instrument);
  rhythmCanvas.triggerMissVisual(missRes.brokeStreak);
  syncHudReadouts();

  if (missRes.failedOut) {
    handleTrackFinished();
  }
}

function handleLaneRelease(laneIndex) {
  rhythmCanvas.setLaneHeld(laneIndex, false);
  setPedalPressed(laneIndex, false);
}

function setPedalPressed(laneIndex, active) {
  const pedal = stagePedalsContainer.querySelector(`[data-lane="${laneIndex}"]`);
  if (pedal) pedal.classList.toggle('is-pressed', active);
}

function clearAllPedals() {
  stagePedalsContainer.querySelectorAll('.stage-pedal').forEach((el) => {
    el.classList.remove('is-pressed');
  });
}

function tryTriggerFever() {
  if (gameState.screen !== SCREENS.STAGE) return;
  if (gameState.activateFever()) {
    arenaRoot.dataset.fever = 'true';
    if (stageBand) {
      stageBand.setInstrumentTheme(gameState.instrument, true);
      stageBand.triggerStagePyro(1.4);
      stageBand.triggerCryoJets(2.2);
      stageBand.triggerBandJump(1.25);
      stageBand.triggerConfettiBurst();
      stageBand.launchFireworkShell(gameState.isEncorePerformance);
    }
    sfx.playFeverActivate();
    rhythmCanvas.triggerFeverBanner();
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

  const hypePct = Math.round(gameState.crowdHype);
  hudHypeFill.style.transform = `scaleX(${(gameState.crowdHype / 100).toFixed(3)})`;
  hudHypeVal.textContent = `${hypePct}%`;
  hudHypeFill.dataset.state = hypePct >= 70 ? 'hot' : hypePct >= 35 ? 'steady' : 'danger';

  hudFeverFill.style.transform = `scaleX(${(gameState.feverCharge / 100).toFixed(3)})`;
  hudWhammyTag.classList.toggle('is-hidden', !gameState.whammyActive);

  const feverReady = gameState.canActivateFever();
  btnFeverTrigger.disabled = !feverReady;
  btnFeverTrigger.classList.toggle('is-ready', feverReady);
  btnFeverTrigger.classList.toggle('is-active', gameState.feverActive);
  btnFeverTrigger.textContent = gameState.feverActive
    ? 'FEVER 2×'
    : feverReady
      ? 'SPACE · Fever'
      : `Fever ${Math.round(gameState.feverCharge)}%`;

  hudAmpCard.classList.toggle('is-dropped', gameState.stemDropped);
  const stereoNote = gameState.stereoWidthTier > 0 ? ` · WIDE ${gameState.stereoWidthTier}` : '';
  hudAmpStatus.textContent = gameState.stemDropped
    ? 'DROPPED OUT (MISS)'
    : `LIVE IN MIX${stereoNote}`;
}

/* ==========================================================================
   Pause / Calibration / Crowd Audio / Tour Intermission / Results / Finale
   ========================================================================== */

function openPauseDrawer() {
  if (gameState.screen !== SCREENS.STAGE) return;
  calibrationOnlyMode = false;
  hideSongTitleMarquee();
  audioEngine.pause();
  sfx.updateCrowdState({ playing: false });
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
  calibrationOnlyMode = false;
  pauseDrawer.classList.add('is-hidden');
}

function resumeFromPause() {
  if (gameState.screen !== SCREENS.PAUSED) return;
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
  hideSongTitleMarquee();
  audioEngine.stop();
  sfx.stopCrowdAmbience();
  rhythmCanvas.stop();
  rhythmCanvas.clearHeldLanes();
  clearAllPedals();
  whammyKeyHeld = false;
  arenaRoot.dataset.fever = 'false';

  const summary = gameState.getSummary();
  const track = gameState.currentTrack;
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
    stageBand.setMemberMissed(gameState.instrument, false);
    stageBand.setInstrumentTheme(gameState.instrument, false);
    stageBand.setEncoreFinale(!summary.failedOut, summary.grade);
  }

  resultsHeading.textContent = summary.failedOut ? 'Crowd Lost — Show Ended' : 'Encore Results';
  resultsTrackTitle.textContent = track ? track.title : 'Live Performance';
  const speedTag = summary.playbackRate !== 1.0 ? ` · ${Math.round(summary.playbackRate * 100)}% Tempo` : '';
  resultsTrackMeta.textContent = `${inst.label} · ${diff.label} · ${venueMeta.name}${speedTag}`;
  resultsGrade.textContent = summary.grade;
  resultsGrade.dataset.grade = summary.grade;
  resultsScore.textContent = summary.score.toLocaleString();

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
  resultsPerfect.textContent = String(summary.perfect);
  resultsEarly.textContent = String(summary.early);
  resultsLate.textContent = String(summary.late);
  resultsMiss.textContent = String(summary.miss);

  const canEncoreSpeed = summary.encoreSpeedUnlocked && !summary.failedOut;
  btnEncoreSpeedup.classList.toggle('is-hidden', !canEncoreSpeed);

  sfx.playEncoreFanfare(summary.grade);
  setScreen(SCREENS.RESULTS);
}

function returnToBackstage() {
  calibrationOnlyMode = false;
  hideSongTitleMarquee();
  gameState.endTour();
  audioEngine.stop();
  sfx.stopCrowdAmbience();
  rhythmCanvas.stop();
  rhythmCanvas.resetVisuals();
  activeNotes = [];
  clearAllPedals();
  whammyKeyHeld = false;
  arenaRoot.dataset.fever = 'false';
  arenaRoot.dataset.encore = 'false';
  arenaRoot.style.setProperty('--bass-energy', '0');
  if (stageBand) {
    stageBand.setEncoreFinale(false);
    stageBand.setEncorePerformance(false, 'ENCORE STAGE');
    stageBand.setMemberMissed(gameState.instrument, false);
    stageBand.setInstrumentTheme(gameState.instrument, false);
  }
  setScreen(SCREENS.BACKSTAGE);
}

function toggleSfxMute() {
  const nextMuted = !gameState.sfxMuted;
  gameState.setSfxMuted(nextMuted);
  sfx.setMuted(nextMuted);
  btnSfxMute.textContent = nextMuted ? 'SFX Off' : 'SFX On';
  btnSfxMute.setAttribute('aria-pressed', String(nextMuted));
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

    if (e.code === 'Escape') {
      e.preventDefault();
      if (calibrationOnlyMode) closeBackstageCalibration();
      else if (gameState.screen === SCREENS.STAGE) openPauseDrawer();
      else if (gameState.screen === SCREENS.PAUSED) resumeFromPause();
      else if (gameState.screen === SCREENS.BACKSTAGE) {
        if (tourQueuePopover && !tourQueuePopover.classList.contains('is-hidden')) {
          setTourPopoverOpen(false);
        } else if (activeLobbyTab !== 'setlist') {
          switchLobbyTab('setlist');
        }
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
          const cats = ['band', 'stars', 'guitar', 'bass', 'drums', 'piano', 'highway'];
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

    if (e.code === 'KeyW' || e.code === 'ArrowUp') {
      e.preventDefault();
      whammyKeyHeld = true;
      return;
    }

    if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) tryTriggerFever();
      return;
    }

    if (e.code === 'KeyM' && !e.repeat) {
      e.preventDefault();
      toggleSfxMute();
      return;
    }

    const laneIndex = gameState.getLaneIndexFromCode(e.code);
    if (laneIndex !== -1) {
      e.preventDefault();
      if (!e.repeat) handleLanePress(laneIndex);
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyW' || e.code === 'ArrowUp') {
      whammyKeyHeld = false;
      return;
    }
    const laneIndex = gameState.getLaneIndexFromCode(e.code);
    if (laneIndex !== -1) handleLaneRelease(laneIndex);
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
  lobbyTabButtons.forEach((btn) => {
    btn.addEventListener('click', () => switchLobbyTab(btn.dataset.lobbyTab));
  });

  setlistSubtabButtons.forEach((btn) => {
    btn.addEventListener('click', () => switchSetlistSubTab(btn.dataset.setlistSubtab));
  });

  gearCatButtons.forEach((btn) => {
    btn.addEventListener('click', () => switchGearCategory(btn.dataset.gearCategory));
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

  // Crowd Volume Slider + "Test Crowd Cheer" button
  if (crowdVolumeSlider) {
    crowdVolumeSlider.addEventListener('input', () => {
      const vol = Number(crowdVolumeSlider.value) / 100;
      gameState.setCrowdVolume(vol);
      syncCalibrationUI();
    });
  }
  if (btnTestCrowd) {
    btnTestCrowd.addEventListener('click', () => {
      unlockSharedAudio();
      sfx.playTestCrowdCheer();
    });
  }

  // Latency calibration controls
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
      const rate = Number(btn.dataset.playbackRate);
      gameState.setPlaybackRate(rate);
      audioEngine.setPlaybackRate(rate);
      syncPracticeLoopUI();
    });
  });

  cameraModeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      selectCameraMode(btn.dataset.cameraMode);
    });
  });

  // Live HUD buttons
  btnFeverTrigger.addEventListener('click', tryTriggerFever);
  btnSfxMute.addEventListener('click', toggleSfxMute);
  btnPauseStage.addEventListener('click', openPauseDrawer);
  btnBackstageHud.addEventListener('click', returnToBackstage);

  // Pause & Results actions
  btnResume.addEventListener('click', resumeFromPause);
  btnNextSongPause?.addEventListener('click', playNextSong);
  btnRestart.addEventListener('click', () => restartCurrentTrack(gameState.playbackRate));
  btnFinishNow.addEventListener('click', handleTrackFinished);
  btnBackstagePause.addEventListener('click', returnToBackstage);

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
  renderVenueSelector();
  selectInstrument(gameState.instrument);
  selectDifficulty(gameState.difficulty);
  selectLobbyPracticeSpeed(1.0);
  selectCameraMode(gameState.cameraMode);
  syncCalibrationUI();
  renderTourSetlistQueue();
  renderGearDock();
  setupKeyboardListeners();
  setupUiHandlers();
  switchLobbyTab('setlist');
  setScreen(SCREENS.BACKSTAGE);

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

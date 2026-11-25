/**
 * rhythmCanvas.js
 * Dedicated HTML5 Canvas renderer and requestAnimationFrame loop.
 *  - Exact AudioContext clock-locked Y-positioning derived directly from
 *    (note.hitTimeSec - effectiveSongTime) * scrollSpeed with zero drift.
 *  - Angled perspective highway with quantized beat/measure fret lines.
 *  - Tap bar notes, smart non-overlapping Hold/Sustain bars with Whammy
 *    vibrato sine-wave modulation, and Golden Fever notes.
 *  - Spatial stereo wave ripples on hit + pooled particle explosions.
 *  - Dynamic Stage Edge Pyrotechnics (flaming jet cannons on 30x, 50x, 100x combos).
 */

import { getHighwaySkinById } from './bandGearCatalog.js';

const PARTICLE_POOL_SIZE = 220;
const PYRO_POOL_SIZE = 160;
const RIPPLE_POOL_SIZE = 24;
const PAST_GRACE_SEC = 0.25;

function hexToRgba(hex, alpha) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export class RhythmCanvas {
  constructor(
    canvas,
    { getGameState, getNotes, getNotesP2, getBeatGrid, getEffectiveTime, getAudioTelemetry, getBeatSync, onFrameTick }
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.getGameState = getGameState;
    this.getNotes = getNotes;
    this.getNotesP2 = getNotesP2 || (() => []);
    this.getBeatGrid = getBeatGrid;
    this.getEffectiveTime = getEffectiveTime;
    this.getAudioTelemetry = getAudioTelemetry;
    this.getBeatSync = getBeatSync || (() => null);
    this.onFrameTick = onFrameTick || (() => {});

    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.running = false;
    this.rafId = null;
    this.lastFrameMs = 0;
    this.animClock = 0;

    const createPlayerVisualState = () => ({
      heldLanes: [false, false, false, false, false],
      laneBeamIntensity: [0, 0, 0, 0, 0],
      padPulse: [0, 0, 0, 0, 0],
      whammyVisualAmount: 0,
      timingTicks: [],
      avgTimingRatio: 0,
      timingMeterAlpha: 0,
      judgementPopup: null,
    });
    this.playerStates = [createPlayerVisualState(), createPlayerVisualState()];

    // Backward-compatible 1P references pointing to Player 1 state
    this.heldLanes = this.playerStates[0].heldLanes;
    this.laneBeamIntensity = this.playerStates[0].laneBeamIntensity;
    this.padPulse = this.playerStates[0].padPulse;
    this.whammyVisualAmount = 0;

    // Camera shake & popups
    this.shakeAmount = 0;
    this.judgementPopup = null;
    this.bannerPopup = null;

    // Hit-Window Timing Meter (Early / Late deviation ticks + rolling average needle)
    this.timingTicks = this.playerStates[0].timingTicks;
    this.avgTimingRatio = 0;
    this.timingMeterAlpha = 0;

    // Cached offscreen procedural rosewood woodgrain pattern & static deck gradients
    this.rosewoodPattern = this.createRosewoodPattern();
    this.cachedDeckGrads = {};
    this.lowParticleMode = false;

    // Pooled note hit particles
    this.particles = Array.from({ length: PARTICLE_POOL_SIZE }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      size: 3,
      life: 0,
      maxLife: 0.45,
      color: '#ffffff',
      bright: '#ffffff',
      shape: 'spark',
    }));
    this.particleCursor = 0;

    // Pooled stage-edge pyrotechnic flame particles (left & right flame jets!)
    this.pyroParticles = Array.from({ length: PYRO_POOL_SIZE }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 10,
      life: 0,
      maxLife: 0.75,
      heat: 1,
    }));
    this.pyroCursor = 0;
    this.pyroEmitterTimer = 0;
    this.pyroEmitterStrength = 0;

    // Pooled spatial stereo wave ripples
    this.ripples = Array.from({ length: RIPPLE_POOL_SIZE }, () => ({
      active: false,
      x: 0,
      y: 0,
      rx: 18,
      ry: 7,
      maxRx: 140,
      life: 0,
      maxLife: 0.44,
      color: '#38bdf8',
      isFever: false,
    }));
    this.rippleCursor = 0;

    this.handleResize = this.resize.bind(this);
    window.addEventListener('resize', this.handleResize);
    this.resize();
  }

  createRosewoodPattern() {
    if (typeof document === 'undefined') return null;
    const off = document.createElement('canvas');
    off.width = 128;
    off.height = 128;
    const octx = off.getContext('2d');
    if (!octx) return null;

    octx.fillStyle = 'rgba(46, 22, 14, 0.88)';
    octx.fillRect(0, 0, 128, 128);

    // Procedural vertical rosewood grain streaks
    for (let x = 0; x < 128; x += 2) {
      const shade = Math.sin(x * 0.24) * 0.5 + Math.cos(x * 0.63) * 0.5;
      octx.fillStyle = shade > 0
        ? `rgba(74, 37, 22, ${0.18 + shade * 0.2})`
        : `rgba(24, 11, 7, ${0.22 + Math.abs(shade) * 0.24})`;
      octx.fillRect(x, 0, 2, 128);
    }
    for (let y = 0; y < 128; y += 8) {
      octx.fillStyle = 'rgba(18, 8, 5, 0.16)';
      octx.fillRect(0, y, 128, 1);
    }
    return this.ctx.createPattern(off, 'repeat');
  }

  resize() {
    const rect = this.canvas.parentElement
      ? this.canvas.parentElement.getBoundingClientRect()
      : { width: window.innerWidth, height: window.innerHeight };

    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.width = Math.max(320, Math.floor(rect.width));
    this.height = Math.max(280, Math.floor(rect.height));

    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.cachedDeckGrads = {};
  }

  setLowParticleMode(low) {
    this.lowParticleMode = Boolean(low);
  }

  getPlayerVisualState(player = 1) {
    return this.playerStates[player === 2 ? 1 : 0];
  }

  getHighwayGeometry(player = 1) {
    const w = this.width;
    const h = this.height;
    const state = this.getGameState();
    const isTwoPlayer = typeof state.isTwoPlayerMode === 'function' ? state.isTwoPlayerMode() : false;

    const topY = isTwoPlayer ? Math.max(106, h * 0.27) : Math.max(82, h * 0.25);
    const hitY = h * 0.825;
    const bottomY = h * 0.965;

    const diff = typeof state.getDifficultyConfigFor === 'function'
      ? state.getDifficultyConfigFor(player)
      : state.getDifficultyConfig();
    const laneCount = diff.laneCount || state.laneCount || 4;

    let cx = w * 0.5;
    let targetW = laneCount === 5 ? 650 : laneCount === 3 ? 440 : 550;
    let maxBottomWidth = Math.min(w * 0.86, targetW);
    let minBottomWidth = 260;

    if (isTwoPlayer) {
      cx = player === 2 ? w * 0.725 : w * 0.275;
      targetW = laneCount === 5 ? 430 : laneCount === 3 ? 320 : 380;
      maxBottomWidth = Math.min(w * 0.4, targetW);
      minBottomWidth = 200;
    }

    const bottomWidth = Math.max(minBottomWidth, maxBottomWidth);
    const topWidth = bottomWidth * 0.3;

    // Effective scroll speed (pixels per second along the vertical highway span)
    const windowSec = diff.scrollWindowSec || 1.5;
    const highwayLength = hitY - topY;
    const scrollSpeed = highwayLength / windowSec;

    return { cx, topY, hitY, bottomY, topWidth, bottomWidth, windowSec, highwayLength, scrollSpeed };
  }

  /**
   * Computes exact AudioContext clock-locked screen position from:
   *   linearDist = (hitTimeSec - effectiveSongTime) * scrollSpeed
   * Then maps through clean perspective foreshortening so notes stay strictly
   * locked to the audio clock with zero frame-rate drift!
   */
  projectAudioTime(hitTimeSec, effectiveSongTime, geom) {
    const lookaheadSec = Math.max(0.25, geom.windowSec || 1.5);
    const timeRemaining = hitTimeSec - effectiveSongTime;
    const linearProgress = 1.0 - timeRemaining / lookaheadSec;

    if (linearProgress < 0) {
      return { visible: false, progress: linearProgress, y: geom.topY, width: geom.topWidth, scale: 0.3 };
    }

    // Perspective foreshortening preserving exact hitY alignment at linearProgress === 1.0 (t = 0ms)
    const perspective = Math.pow(linearProgress, 1.72);
    const y = geom.topY + geom.highwayLength * perspective;
    const width = geom.topWidth + (geom.bottomWidth - geom.topWidth) * perspective;
    const scale = width / geom.bottomWidth;
    return { visible: true, progress: linearProgress, y, width, scale };
  }

  setLaneHeld(laneIndex, held, player = 1) {
    if (laneIndex < 0 || laneIndex >= 5) return;
    const ps = this.getPlayerVisualState(player);
    ps.heldLanes[laneIndex] = held;
    if (held) {
      ps.laneBeamIntensity[laneIndex] = Math.max(ps.laneBeamIntensity[laneIndex], 0.72);
    }
  }

  setWhammyVisual(amount, player = 1) {
    const clamped = Math.max(0, Math.min(1, amount));
    this.getPlayerVisualState(player).whammyVisualAmount = clamped;
    if (player === 1) this.whammyVisualAmount = clamped;
  }

  clearHeldLanes(player = null) {
    if (player === 1 || player === 2) {
      this.getPlayerVisualState(player).heldLanes.fill(false);
      return;
    }
    this.playerStates[0].heldLanes.fill(false);
    this.playerStates[1].heldLanes.fill(false);
  }

  /**
   * Fires roaring stage-edge pyrotechnic flame cannons on 30x, 50x, and 100x combos!
   */
  triggerPyroBurst(comboMilestone) {
    this.pyroEmitterTimer = comboMilestone >= 100 ? 1.55 : comboMilestone >= 50 ? 1.15 : 0.85;
    this.pyroEmitterStrength = comboMilestone >= 100 ? 1.5 : comboMilestone >= 50 ? 1.2 : 1.0;
    this.shakeAmount = Math.max(this.shakeAmount, comboMilestone >= 50 ? 8.5 : 6.2);

    this.bannerPopup = {
      text: `${comboMilestone}× COMBO PYRO · STEREO WIDE`,
      color: '#fb923c',
      age: 0,
      duration: 1.4,
    };
  }

  triggerHitVisual({ laneIndex, judgement, colorObj, isChord, isFever, feverActive, multiplierUp, effectiveMultiplier, player = 1 }) {
    const ps = this.getPlayerVisualState(player);
    if (laneIndex >= 0 && laneIndex < 5) {
      ps.laneBeamIntensity[laneIndex] = judgement === 'PERFECT!' ? 1.0 : 0.84;
      ps.padPulse[laneIndex] = judgement === 'PERFECT!' ? 1.0 : 0.78;
    }

    const state = this.getGameState();
    const geom = this.getHighwayGeometry(player);
    const laneCount = typeof state.getLaneConfigFor === 'function' ? state.getLaneConfigFor(player).count : state.laneCount;
    const laneW = geom.bottomWidth / laneCount;
    const hitX = geom.cx - geom.bottomWidth * 0.5 + laneW * (laneIndex + 0.5);
    const hitY = geom.hitY;

    const activeColor = isFever || feverActive
      ? { base: '#facc15', bright: '#fef9c3' }
      : colorObj;

    this.spawnStereoRipple(hitX, hitY, activeColor.base, isFever || feverActive, isChord);

    const count = judgement === 'PERFECT!' ? (isChord ? 24 : 18) : 11;
    this.spawnBurst(hitX, hitY, activeColor, count, judgement === 'PERFECT!');

    if (isChord || isFever || judgement === 'PERFECT!') {
      this.shakeAmount = Math.max(this.shakeAmount, isChord ? 4.8 : isFever ? 3.5 : 1.6);
    }

    const labelColor =
      judgement === 'PERFECT!' || judgement === 'FREESTYLE!'
        ? '#fde047'
        : judgement === 'GREAT!' || judgement === 'EARLY'
          ? '#38bdf8'
          : judgement === 'GOOD'
            ? '#4ade80'
            : '#fb923c';

    ps.judgementPopup = {
      text: judgement,
      color: labelColor,
      age: 0,
      duration: 0.52,
    };
    if (player === 1) this.judgementPopup = ps.judgementPopup;

    if (multiplierUp && effectiveMultiplier >= 2 && !this.bannerPopup) {
      this.bannerPopup = {
        text: `${state.isTwoPlayerMode?.() ? `P${player} ` : ''}${effectiveMultiplier}× STREAK`,
        color: feverActive ? '#fde047' : '#f8fafc',
        age: 0,
        duration: 0.95,
      };
    }
  }

  triggerSustainSparkVisual(laneIndex, colorObj, feverActive, whammyActive, player = 1) {
    const state = this.getGameState();
    const ps = this.getPlayerVisualState(player);
    const geom = this.getHighwayGeometry(player);
    const laneCount = typeof state.getLaneConfigFor === 'function' ? state.getLaneConfigFor(player).count : state.laneCount;
    const laneW = geom.bottomWidth / laneCount;
    const hitX = geom.cx - geom.bottomWidth * 0.5 + laneW * (laneIndex + 0.5);
    const c = feverActive || whammyActive
      ? { base: '#facc15', bright: '#ffffff' }
      : colorObj;
    this.spawnBurst(hitX, geom.hitY, c, whammyActive ? 7 : 4, whammyActive);
    ps.padPulse[laneIndex] = Math.max(ps.padPulse[laneIndex], whammyActive ? 0.9 : 0.65);
  }

  triggerMilestoneBanner(text, color = '#fde047', duration = 1.6) {
    this.bannerPopup = {
      text,
      color,
      age: 0,
      duration,
    };
  }

  /**
   * Records a hit's timing deviation (deltaMs: positive = EARLY, negative = LATE)
   * onto the compact Hit-Window Timing Deviation Bar below the hit-line.
   */
  recordTimingDeviation(deltaMs, timingWindowsOrGoodMs = 70, judgement = 'PERFECT!', player = 1) {
    const ps = this.getPlayerVisualState(player);
    const goodEarly =
      typeof timingWindowsOrGoodMs === 'object' && timingWindowsOrGoodMs !== null
        ? Math.max(50, timingWindowsOrGoodMs.GOOD_EARLY_MS || 70)
        : Math.max(50, timingWindowsOrGoodMs);
    const goodLate =
      typeof timingWindowsOrGoodMs === 'object' && timingWindowsOrGoodMs !== null
        ? Math.max(50, timingWindowsOrGoodMs.GOOD_LATE_MS || 70)
        : Math.max(50, timingWindowsOrGoodMs);
    // Convention: LEFT = EARLY (-1), CENTER = PERFECT (0), RIGHT = LATE (+1)
    const ratio =
      deltaMs > 0
        ? Math.max(-1, -deltaMs / goodEarly)
        : Math.min(1, -deltaMs / goodLate);
    const color =
      judgement === 'PERFECT!'
        ? '#fde047'
        : judgement === 'GREAT!'
          ? '#38bdf8'
          : judgement === 'GOOD'
            ? '#4ade80'
            : deltaMs > 0
              ? '#38bdf8'
              : '#fb923c';

    ps.timingTicks.push({ ratio, color, age: 0, maxAge: 1.8 });
    if (ps.timingTicks.length > 10) {
      ps.timingTicks.shift();
    }
    ps.avgTimingRatio = ps.avgTimingRatio * 0.72 + ratio * 0.28;
    ps.timingMeterAlpha = 1.0;
    if (player === 1) {
      this.avgTimingRatio = ps.avgTimingRatio;
      this.timingMeterAlpha = ps.timingMeterAlpha;
    }
  }

  triggerFeverBanner(player = 1) {
    this.pyroEmitterTimer = Math.max(this.pyroEmitterTimer, 1.35);
    this.pyroEmitterStrength = Math.max(this.pyroEmitterStrength, 1.35);
    const is2P = this.getGameState().isTwoPlayerMode?.();
    this.bannerPopup = {
      text: is2P ? `P${player} FEVER MODE · 2× MULTIPLIER` : 'FEVER MODE · 2× MULTIPLIER',
      color: '#fde047',
      age: 0,
      duration: 1.35,
    };
    this.shakeAmount = Math.max(this.shakeAmount, 7.5);
  }

  triggerMissVisual(brokeStreak = false, player = 1) {
    const ps = this.getPlayerVisualState(player);
    ps.judgementPopup = {
      text: 'MISS',
      color: '#fb7185',
      age: 0,
      duration: 0.52,
    };
    if (player === 1) this.judgementPopup = ps.judgementPopup;
    if (brokeStreak) {
      this.shakeAmount = Math.max(this.shakeAmount, 5.2);
    }
  }

  triggerHazardDetonateVisual(laneIndex, player = 1) {
    const state = this.getGameState();
    const ps = this.getPlayerVisualState(player);
    const geom = this.getHighwayGeometry(player);
    const laneCount = typeof state.getLaneConfigFor === 'function' ? state.getLaneConfigFor(player).count : state.laneCount;
    const laneW = geom.bottomWidth / laneCount;
    const hitX = geom.cx - geom.bottomWidth * 0.5 + laneW * (laneIndex + 0.5);

    ps.padPulse[laneIndex] = 1.0;
    this.shakeAmount = Math.max(this.shakeAmount, 10.5);
    this.spawnStereoRipple(hitX, geom.hitY, '#ef4444', true, true);
    this.spawnBurst(hitX, geom.hitY, { base: '#ef4444', bright: '#fde047' }, 24, true);

    ps.judgementPopup = {
      text: 'PANGGULO HIT!',
      color: '#ef4444',
      age: 0,
      duration: 0.72,
    };
    if (player === 1) this.judgementPopup = ps.judgementPopup;
  }

  triggerHazardDodgedVisual(laneIndex, player = 1) {
    const state = this.getGameState();
    const ps = this.getPlayerVisualState(player);
    const geom = this.getHighwayGeometry(player);
    const laneCount = typeof state.getLaneConfigFor === 'function' ? state.getLaneConfigFor(player).count : state.laneCount;
    const laneW = geom.bottomWidth / laneCount;
    const hitX = geom.cx - geom.bottomWidth * 0.5 + laneW * (laneIndex + 0.5);

    this.spawnBurst(hitX, geom.hitY, { base: '#22c55e', bright: '#bbf7d0' }, 8, false);
    ps.judgementPopup = {
      text: 'DODGED!',
      color: '#4ade80',
      age: 0,
      duration: 0.44,
    };
    if (player === 1) this.judgementPopup = ps.judgementPopup;
  }

  spawnStereoRipple(x, y, color, isFever, isChord) {
    const r = this.ripples[this.rippleCursor];
    this.rippleCursor = (this.rippleCursor + 1) % RIPPLE_POOL_SIZE;
    r.active = true;
    r.x = x;
    r.y = y;
    r.rx = 18;
    r.ry = 7;
    r.maxRx = isChord || isFever ? 175 : 130;
    r.life = 0;
    r.maxLife = 0.44;
    r.color = color;
    r.isFever = isFever;
  }

  spawnBurst(x, y, colorObj, count, intense) {
    const effectiveCount = this.lowParticleMode ? Math.max(3, Math.ceil(count * 0.45)) : count;
    for (let i = 0; i < effectiveCount; i += 1) {
      const p = this.particles[this.particleCursor];
      this.particleCursor = (this.particleCursor + 1) % PARTICLE_POOL_SIZE;

      const angle = -Math.PI * 0.1 - Math.random() * Math.PI * 0.8;
      const speed = (intense ? 180 : 120) + Math.random() * (intense ? 270 : 165);

      p.active = true;
      p.x = x + (Math.random() - 0.5) * 32;
      p.y = y + (Math.random() - 0.5) * 6;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 45;
      p.size = (intense ? 3.4 : 2.4) + Math.random() * 4.2;
      p.life = 0;
      p.maxLife = 0.28 + Math.random() * 0.32;
      p.color = colorObj.base;
      p.bright = colorObj.bright;
      p.shape = i % 3 === 0 ? 'bar' : 'spark';
    }
  }

  emitPyroJetFlames(geom) {
    // 4 stage-edge flame cannons flanking left & right sides of the highway
    const leftOuter = Math.max(36, geom.cx - geom.bottomWidth * 0.5 - 52);
    const rightOuter = Math.min(this.width - 36, geom.cx + geom.bottomWidth * 0.5 + 52);
    const leftInner = Math.max(76, geom.cx - geom.bottomWidth * 0.5 - 18);
    const rightInner = Math.min(this.width - 76, geom.cx + geom.bottomWidth * 0.5 + 18);
    const sources = [leftOuter, leftInner, rightInner, rightOuter];

    const perCannon = this.lowParticleMode ? 1 : Math.ceil(2 * this.pyroEmitterStrength);
    for (let s = 0; s < sources.length; s += 1) {
      const sx = sources[s];
      const outward = s < 2 ? -1 : 1;
      for (let i = 0; i < perCannon; i += 1) {
        const f = this.pyroParticles[this.pyroCursor];
        this.pyroCursor = (this.pyroCursor + 1) % PYRO_POOL_SIZE;
        f.active = true;
        f.x = sx + (Math.random() - 0.5) * 16;
        f.y = geom.bottomY - 8;
        f.vx = outward * (18 + Math.random() * 45) + (Math.random() - 0.5) * 35;
        f.vy = -(360 + Math.random() * 320 * this.pyroEmitterStrength);
        f.radius = 9 + Math.random() * 14 * this.pyroEmitterStrength;
        f.life = 0;
        f.maxLife = 0.42 + Math.random() * 0.36;
        f.heat = 0.8 + Math.random() * 0.2;
      }
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastFrameMs = performance.now();

    const loop = (now) => {
      if (!this.running) return;
      const rawDt = (now - this.lastFrameMs) / 1000;
      this.lastFrameMs = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      this.animClock += dt;
      this.onFrameTick(dt);
      this.updateEffects(dt);
      this.render();

      this.rafId = window.requestAnimationFrame(loop);
    };
    this.rafId = window.requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    if (this.rafId) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  resetVisuals() {
    this.clearHeldLanes();
    for (let p = 0; p < this.playerStates.length; p += 1) {
      const ps = this.playerStates[p];
      ps.laneBeamIntensity.fill(0);
      ps.padPulse.fill(0);
      ps.whammyVisualAmount = 0;
      ps.timingTicks.length = 0;
      ps.avgTimingRatio = 0;
      ps.timingMeterAlpha = 0;
      ps.judgementPopup = null;
    }
    this.shakeAmount = 0;
    this.whammyVisualAmount = 0;
    this.pyroEmitterTimer = 0;
    this.judgementPopup = null;
    this.bannerPopup = null;
    this.avgTimingRatio = 0;
    this.timingMeterAlpha = 0;
    for (let i = 0; i < this.particles.length; i += 1) this.particles[i].active = false;
    for (let i = 0; i < this.pyroParticles.length; i += 1) this.pyroParticles[i].active = false;
    for (let i = 0; i < this.ripples.length; i += 1) this.ripples[i].active = false;
  }

  updateEffects(dt) {
    for (let p = 0; p < this.playerStates.length; p += 1) {
      const ps = this.playerStates[p];
      for (let i = 0; i < 5; i += 1) {
        const target = ps.heldLanes[i] ? 0.56 : 0;
        if (ps.laneBeamIntensity[i] > target) {
          ps.laneBeamIntensity[i] = Math.max(target, ps.laneBeamIntensity[i] - dt * 4.4);
        }
        if (ps.padPulse[i] > 0) {
          ps.padPulse[i] = Math.max(0, ps.padPulse[i] - dt * 5.0);
        }
      }

      if (ps.judgementPopup) {
        ps.judgementPopup.age += dt;
        if (ps.judgementPopup.age >= ps.judgementPopup.duration) {
          ps.judgementPopup = null;
          if (p === 0) this.judgementPopup = null;
        }
      }

      for (let i = ps.timingTicks.length - 1; i >= 0; i -= 1) {
        ps.timingTicks[i].age += dt;
        if (ps.timingTicks[i].age >= ps.timingTicks[i].maxAge) {
          ps.timingTicks.splice(i, 1);
        }
      }
      if (ps.timingTicks.length === 0) {
        ps.timingMeterAlpha = Math.max(0.32, ps.timingMeterAlpha - dt * 0.45);
      }
    }
    this.avgTimingRatio = this.playerStates[0].avgTimingRatio;
    this.timingMeterAlpha = this.playerStates[0].timingMeterAlpha;

    if (this.shakeAmount > 0.05) {
      this.shakeAmount *= Math.pow(0.0015, dt);
    } else {
      this.shakeAmount = 0;
    }

    if (this.bannerPopup) {
      this.bannerPopup.age += dt;
      if (this.bannerPopup.age >= this.bannerPopup.duration) {
        this.bannerPopup = null;
      }
    }

    // Active stage pyro cannons
    if (this.pyroEmitterTimer > 0) {
      this.pyroEmitterTimer = Math.max(0, this.pyroEmitterTimer - dt);
      const geom = this.getHighwayGeometry(1);
      this.emitPyroJetFlames(geom);
    }

    for (let i = 0; i < this.pyroParticles.length; i += 1) {
      const f = this.pyroParticles[i];
      if (!f.active) continue;
      f.life += dt;
      if (f.life >= f.maxLife) {
        f.active = false;
        continue;
      }
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vy *= Math.pow(0.28, dt); // Flame slows near apex
      f.radius += dt * 16;
    }

    for (let i = 0; i < this.ripples.length; i += 1) {
      const r = this.ripples[i];
      if (!r.active) continue;
      r.life += dt;
      if (r.life >= r.maxLife) r.active = false;
    }

    for (let i = 0; i < this.particles.length; i += 1) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 430 * dt;
      p.vx *= Math.pow(0.32, dt);
    }
  }

  renderPlayerHighway(ctx, state, player, notes, beatGrid, songTime, telemetry, beatSync, highwaySkin) {
    const isP2 = player === 2;
    const ps = this.getPlayerVisualState(player);
    const geom = this.getHighwayGeometry(player);
    const laneConfig = typeof state.getLaneConfigFor === 'function' ? state.getLaneConfigFor(player) : state.getLaneConfig();
    const instConfig = typeof state.getInstrumentConfigFor === 'function' ? state.getInstrumentConfigFor(player) : state.getInstrumentConfig();
    const timingWindows = state.getTimingWindows ? state.getTimingWindows(player) : null;
    const feverActive = isP2 ? Boolean(state.p2?.feverActive) : Boolean(state.feverActive);
    const feverCharge = isP2 ? (state.p2?.feverCharge || 0) : (state.feverCharge || 0);
    const canFever = typeof state.canActivateFeverFor === 'function' ? state.canActivateFeverFor(player) : feverCharge >= 50;
    const stemDropped = isP2 ? Boolean(state.p2?.stemDropped) : Boolean(state.stemDropped);
    const stereoTier = isP2 ? 0 : (state.stereoWidthTier || 0);
    const accentHex = feverActive ? '#facc15' : instConfig.accent;
    const isTwoPlayer = typeof state.isTwoPlayerMode === 'function' && state.isTwoPlayerMode();

    this.drawHorizonSpectrum(ctx, geom, telemetry.spectrum, accentHex, stemDropped);
    this.drawHighwayDeck(
      ctx,
      geom,
      laneConfig.count,
      accentHex,
      feverActive,
      telemetry.bassEnergy,
      highwaySkin
    );
    this.drawLaneFlashBeams(ctx, geom, laneConfig, feverActive, ps);
    this.drawBeatGrid(ctx, geom, beatGrid, songTime, highwaySkin);
    this.drawLaneRails(
      ctx,
      geom,
      laneConfig.count,
      accentHex,
      feverActive,
      stereoTier,
      highwaySkin
    );
    this.drawHitZoneReceptors(
      ctx,
      geom,
      laneConfig,
      feverActive || state.breActive,
      beatSync,
      notes,
      songTime,
      timingWindows,
      ps
    );
    this.drawTimingDeviationBar(ctx, geom, accentHex, isTwoPlayer ? null : beatSync, timingWindows, ps);
    if (state.breActive) {
      const breBonus = isP2 ? (state.p2?.breBonusPoints || 0) : (state.breBonusPoints || 0);
      this.drawBreFreestyleOverlay(ctx, geom, laneConfig, breBonus);
    }
    this.drawBesideHighwayFeverMeter(ctx, geom, {
      feverCharge,
      feverActive,
      canActivateFever: () => canFever,
    });
    this.drawNotes(ctx, geom, laneConfig, notes, songTime, feverActive, ps);
    if (isTwoPlayer) {
      this.drawPlayerHeaderBadge(ctx, geom, player, instConfig, state);
    }
    if (player === 1) {
      this.drawLeadInCue(ctx, geom, songTime, accentHex);
    }
    this.drawCallouts(ctx, geom, ps, player === 1);
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    const state = this.getGameState();
    const notesP1 = this.getNotes();
    const notesP2 = this.getNotesP2 ? this.getNotesP2() : [];
    const beatGrid = this.getBeatGrid();
    const songTime = this.getEffectiveTime();
    const telemetry = this.getAudioTelemetry();
    const beatSync = this.getBeatSync ? this.getBeatSync() : null;
    const highwaySkin = getHighwaySkinById(state.highwaySkinId);
    const isTwoPlayer = typeof state.isTwoPlayerMode === 'function' && state.isTwoPlayerMode();

    // Smoothly fade the highway deck in after Phase 1 Stage Walk-On (-2.25s -> -1.55s)
    // so the 2.5s band walk-on & gear setup has a 100% unobstructed 3D arena view!
    const highwayAlpha =
      songTime < -2.25 ? 0 : songTime < -1.55 ? (songTime + 2.25) / 0.7 : 1;

    ctx.save();
    if (this.shakeAmount > 0.1) {
      const ox = (Math.random() - 0.5) * this.shakeAmount * 2;
      const oy = (Math.random() - 0.5) * this.shakeAmount * 1.4;
      ctx.translate(ox, oy);
    }

    this.drawPyroFlames(ctx);
    if (highwayAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = highwayAlpha;

      this.renderPlayerHighway(ctx, state, 1, notesP1, beatGrid, songTime, telemetry, beatSync, highwaySkin);
      if (isTwoPlayer) {
        this.renderPlayerHighway(ctx, state, 2, notesP2, beatGrid, songTime, telemetry, beatSync, highwaySkin);
        this.drawTwoPlayerVersusBar(ctx, state);
      }

      this.drawStereoRipples(ctx);
      this.drawParticles(ctx);

      if (typeof state.hasValidPracticeLoop === 'function' && state.hasValidPracticeLoop()) {
        const s = state.practiceLoop.startSec.toFixed(1);
        const e = state.practiceLoop.endSec.toFixed(1);
        ctx.save();
        ctx.font = '700 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        this.roundRect(ctx, this.width * 0.5 - 92, this.height * 0.968 - 18, 184, 18, 5);
        ctx.fill();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#bae6fd';
        ctx.fillText(`LOOP [A ${s}s → B ${e}s]`, this.width * 0.5, this.height * 0.968 - 5);
        ctx.restore();
      }

      ctx.restore();
    }

    ctx.restore();
  }

  drawPlayerHeaderBadge(ctx, geom, player, instConfig, state) {
    const isP2 = player === 2;
    const combo = isP2 ? (state.p2?.combo || 0) : (state.combo || 0);
    const mult = typeof state.getEffectiveMultiplierFor === 'function' ? state.getEffectiveMultiplierFor(player) : 1;
    const y = Math.max(54, geom.topY - 22);
    const badgeW = Math.min(200, geom.topWidth * 1.45);
    const x = geom.cx - badgeW * 0.5;

    ctx.save();
    ctx.fillStyle = 'rgba(8, 13, 25, 0.82)';
    this.roundRect(ctx, x, y - 12, badgeW, 22, 6);
    ctx.fill();
    ctx.strokeStyle = hexToRgba(instConfig.accent, 0.72);
    ctx.lineWidth = 1.25;
    ctx.stroke();

    ctx.font = '700 11px "Oswald", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(`P${player} · ${instConfig.shortLabel.toUpperCase()} · ${combo}× (${mult}×)`, geom.cx, y - 1);
    ctx.restore();
  }

  drawTwoPlayerVersusBar(ctx, state) {
    const cx = this.width * 0.5;
    const y = Math.max(96, this.height * 0.25);
    const isFaceoff = state.playMode === 'faceoff';

    ctx.save();
    const barW = Math.min(230, this.width * 0.19);
    const halfW = barW * 0.5;
    ctx.fillStyle = 'rgba(6, 10, 20, 0.86)';
    this.roundRect(ctx, cx - halfW, y, barW, 40, 8);
    ctx.fill();
    ctx.strokeStyle = isFaceoff ? 'rgba(250, 204, 21, 0.55)' : 'rgba(56, 189, 248, 0.55)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (isFaceoff) {
      const p1Score = state.score || 0;
      const p2Score = state.p2?.score || 0;
      const delta = p1Score - p2Score;
      const ratio = delta === 0 ? 0.5 : Math.max(0.1, Math.min(0.9, 0.5 - delta / Math.max(4000, p1Score + p2Score)));

      ctx.font = '700 10px "Oswald", sans-serif';
      ctx.fillStyle = '#fde047';
      const leadLabel = delta === 0
        ? 'TIE GAME'
        : delta > 0
          ? `P1 LEADS +${delta.toLocaleString()}`
          : `P2 LEADS +${Math.abs(delta).toLocaleString()}`;
      ctx.fillText(leadLabel, cx, y + 12);

      const trackW = barW - 20;
      const trackX = cx - trackW * 0.5;
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(trackX, y + 23, trackW * (1 - ratio), 6);
      ctx.fillStyle = '#f43f5e';
      ctx.fillRect(trackX + trackW * (1 - ratio), y + 23, trackW * ratio, 6);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - 1, y + 21, 2, 10);
    } else {
      const combined = typeof state.getCombinedBandScore === 'function' ? state.getCombinedBandScore() : (state.score + (state.p2?.score || 0));
      ctx.font = '700 10px "Oswald", sans-serif';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('BAND CO-OP SYNERGY', cx, y + 12);
      ctx.font = '700 13px "JetBrains Mono", monospace';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(`${combined.toLocaleString()} PTS`, cx, y + 27);
    }
    ctx.restore();
  }

  /**
   * Compact horizontal Hit-Window Timing Deviation Bar directly below the hit-line
   * showing EARLY (left) / symmetric PERFECT (±26ms..±32ms center) / LATE (right) ticks + rolling needle.
   */
  drawTimingDeviationBar(ctx, geom, accentHex, beatSync = null, timingWindows = null, ps = this.playerStates[0]) {
    const barW = Math.min(240, geom.bottomWidth * 0.44);
    const halfW = barW * 0.5;
    const x0 = geom.cx - halfW;
    const y = geom.hitY + 42;
    const perfEarlyFrac = (timingWindows?.PERFECT_EARLY_MS || 26) / (timingWindows?.GOOD_EARLY_MS || 70);
    const perfLateFrac = (timingWindows?.PERFECT_LATE_MS || 26) / (timingWindows?.GOOD_LATE_MS || 70);
    const perfLeftX = geom.cx - perfEarlyFrac * halfW;
    const perfRightX = geom.cx + perfLateFrac * halfW;

    ctx.save();
    ctx.globalAlpha = Math.max(0.42, ps.timingMeterAlpha);

    // Subtle track capsule
    ctx.fillStyle = 'rgba(8, 12, 22, 0.72)';
    this.roundRect(ctx, x0, y - 4, barW, 8, 4);
    ctx.fill();

    // Symmetric PERFECT zone tint
    ctx.fillStyle = 'rgba(250, 204, 21, 0.24)';
    ctx.fillRect(perfLeftX, y - 3, Math.max(4, perfRightX - perfLeftX), 6);

    // Center ideal zero-ms notch
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(geom.cx - 1, y - 6, 2, 12);

    // Recent fading hit tick marks
    for (let i = 0; i < ps.timingTicks.length; i += 1) {
      const tk = ps.timingTicks[i];
      const fade = Math.max(0, 1 - tk.age / tk.maxAge);
      const tx = geom.cx + tk.ratio * (halfW - 4);
      ctx.fillStyle = hexToRgba(tk.color, 0.25 + fade * 0.75);
      ctx.fillRect(tx - 1.5, y - 5, 3, 10);
    }

    // Rolling average timing needle
    if (ps.timingTicks.length > 0) {
      const avgX = geom.cx + ps.avgTimingRatio * (halfW - 4);
      ctx.fillStyle = accentHex;
      ctx.beginPath();
      ctx.moveTo(avgX, y - 8);
      ctx.lineTo(avgX - 4, y - 13);
      ctx.lineTo(avgX + 4, y - 13);
      ctx.closePath();
      ctx.fill();
    }

    // Clean flanking EARLY / LATE micro-labels
    ctx.font = '600 9px "JetBrains Mono", monospace';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.76)';
    ctx.textAlign = 'right';
    ctx.fillText('EARLY', x0 - 7, y);
    ctx.textAlign = 'left';
    ctx.fillText('LATE', x0 + barW + 7, y);

    // Compact static Beat-Sync Lock micro-readout directly beneath timing bar
    if (beatSync && beatSync.syncLocked) {
      const bpmLabel = Math.round(beatSync.currentBpm || 120);
      const offMs = Math.round(beatSync.dynamicOffsetMs || 0);
      const offStr = offMs === 0 ? '0ms' : `${offMs > 0 ? '+' : ''}${offMs}ms`;
      ctx.font = '600 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(56, 189, 248, 0.85)';
      ctx.fillText(
        `SYNC LOCK · ${bpmLabel} BPM · DRIFT ${offStr}`,
        geom.cx,
        y + 13
      );
    }

    ctx.restore();
  }

  drawPyroFlames(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.pyroParticles.length; i += 1) {
      const f = this.pyroParticles[i];
      if (!f.active) continue;
      const t = f.life / f.maxLife;
      const alpha = Math.max(0, (1 - t) * 0.72);
      const grad = ctx.createRadialGradient(f.x, f.y, 1, f.x, f.y, f.radius);
      if (t < 0.25) {
        grad.addColorStop(0, `rgba(255, 255, 235, ${alpha})`);
        grad.addColorStop(0.45, `rgba(253, 224, 71, ${alpha * 0.9})`);
        grad.addColorStop(1, 'rgba(234, 88, 12, 0)');
      } else {
        grad.addColorStop(0, `rgba(251, 146, 60, ${alpha * 0.85})`);
        grad.addColorStop(0.55, `rgba(225, 29, 72, ${alpha * 0.5})`);
        grad.addColorStop(1, 'rgba(127, 29, 29, 0)');
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawHorizonSpectrum(ctx, geom, spectrum, accentHex, stemDropped) {
    if (!spectrum) return;
    const count = spectrum.length;
    const spanW = geom.topWidth * 1.22;
    const startX = geom.cx - spanW * 0.5;
    const barGap = 3;
    const barW = Math.max(2, (spanW - barGap * (count - 1)) / count);

    ctx.save();
    for (let i = 0; i < count; i += 1) {
      const mirrorIdx = Math.abs(i - Math.floor(count / 2));
      const val = spectrum[Math.min(count - 1, mirrorIdx * 2)] || 0;
      const barH = 4 + val * 44;
      const x = startX + i * (barW + barGap);
      const y = geom.topY - barH - 4;
      ctx.fillStyle = stemDropped
        ? `rgba(251, 113, 133, ${0.22 + val * 0.45})`
        : hexToRgba(accentHex, 0.24 + val * 0.66);
      ctx.fillRect(x, y, barW, barH);
    }
    ctx.restore();
  }

  drawHighwayDeck(ctx, geom, laneCount, accentHex, feverActive, bassEnergy, highwaySkin) {
    const skinId = highwaySkin?.id || 'smoked-glass';
    const topLeft = geom.cx - geom.topWidth * 0.5;
    const topRight = geom.cx + geom.topWidth * 0.5;
    const botHalf = geom.bottomWidth * 0.5 * 1.07;
    const botLeft = geom.cx - botHalf;
    const botRight = geom.cx + botHalf;

    // Choose outer aura tint based on skin
    const auraColor = feverActive
      ? '#facc15'
      : skinId === 'inferno-flames'
        ? '#f97316'
        : skinId === 'cyber-synth'
          ? '#e879f9'
          : skinId === 'royal-gold'
            ? '#f59e0b'
            : skinId === 'rosewood-classic'
              ? '#b45309'
              : accentHex;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(topLeft - 14, geom.topY);
    ctx.lineTo(topRight + 14, geom.topY);
    ctx.lineTo(botRight + 28, geom.bottomY);
    ctx.lineTo(botLeft - 28, geom.bottomY);
    ctx.closePath();

    const auraGrad = ctx.createLinearGradient(0, geom.topY, 0, geom.bottomY);
    const glowBoost = feverActive ? 0.34 : 0.14 + bassEnergy * 0.18;
    auraGrad.addColorStop(0, hexToRgba(auraColor, 0.05));
    auraGrad.addColorStop(0.65, hexToRgba(auraColor, glowBoost));
    auraGrad.addColorStop(1, hexToRgba(auraColor, glowBoost * 1.25));
    ctx.fillStyle = auraGrad;
    ctx.fill();

    // Main highway trapezoid path
    ctx.beginPath();
    ctx.moveTo(topLeft, geom.topY);
    ctx.lineTo(topRight, geom.topY);
    ctx.lineTo(botRight, geom.bottomY);
    ctx.lineTo(botLeft, geom.bottomY);
    ctx.closePath();

    if (skinId === 'rosewood-classic' && this.rosewoodPattern) {
      ctx.save();
      ctx.clip();
      ctx.globalAlpha = 0.78;
      ctx.fillStyle = this.rosewoodPattern;
      ctx.fillRect(botLeft, geom.topY, botRight - botLeft, geom.bottomY - geom.topY);
      if (!this.cachedDeckGrads.rosewood) {
        const shadeGrad = ctx.createLinearGradient(0, geom.topY, 0, geom.bottomY);
        shadeGrad.addColorStop(0, 'rgba(18, 7, 4, 0.64)');
        shadeGrad.addColorStop(0.45, 'rgba(38, 17, 10, 0.14)');
        shadeGrad.addColorStop(1, 'rgba(14, 6, 3, 0.34)');
        this.cachedDeckGrads.rosewood = shadeGrad;
      }
      ctx.fillStyle = this.cachedDeckGrads.rosewood;
      ctx.fillRect(botLeft, geom.topY, botRight - botLeft, geom.bottomY - geom.topY);
      ctx.restore();
    } else if (skinId === 'inferno-flames') {
      if (!this.cachedDeckGrads.inferno) {
        const deckGrad = ctx.createLinearGradient(0, geom.topY, 0, geom.bottomY);
        deckGrad.addColorStop(0, 'rgba(26, 8, 6, 0.38)');
        deckGrad.addColorStop(0.38, 'rgba(36, 10, 7, 0.62)');
        deckGrad.addColorStop(0.82, 'rgba(58, 15, 8, 0.68)');
        deckGrad.addColorStop(1, 'rgba(92, 24, 9, 0.78)');
        this.cachedDeckGrads.inferno = deckGrad;
      }
      ctx.fillStyle = this.cachedDeckGrads.inferno;
      ctx.fill();

      // Animated ember wave ribbons licking inward from left & right border rails
      ctx.save();
      ctx.clip();
      const t = this.animClock;
      for (let side = -1; side <= 1; side += 2) {
        ctx.beginPath();
        const steps = 14;
        for (let s = 0; s <= steps; s += 1) {
          const frac = s / steps;
          const y = geom.topY + (geom.bottomY - geom.topY) * frac;
          const halfW = (geom.topWidth * 0.5) + (botHalf - geom.topWidth * 0.5) * frac;
          const edgeX = geom.cx + side * halfW;
          const flameReach = (10 + frac * 26) * (0.65 + 0.35 * Math.sin(t * 7.5 - frac * 11 + side));
          const x = edgeX - side * flameReach;
          if (s === 0) ctx.moveTo(edgeX, y);
          ctx.lineTo(x, y);
        }
        ctx.lineTo(geom.cx + side * botHalf, geom.bottomY);
        ctx.lineTo(geom.cx + side * (geom.topWidth * 0.5), geom.topY);
        ctx.closePath();
        const flameGrad = ctx.createLinearGradient(0, geom.topY, 0, geom.bottomY);
        flameGrad.addColorStop(0, 'rgba(251, 146, 60, 0.08)');
        flameGrad.addColorStop(0.6, 'rgba(249, 115, 22, 0.32)');
        flameGrad.addColorStop(1, 'rgba(250, 204, 21, 0.45)');
        ctx.fillStyle = flameGrad;
        ctx.fill();
      }
      ctx.restore();
    } else if (skinId === 'cyber-synth') {
      const deckGrad = ctx.createLinearGradient(0, geom.topY, 0, geom.bottomY);
      deckGrad.addColorStop(0, 'rgba(13, 6, 36, 0.34)');
      deckGrad.addColorStop(0.35, 'rgba(22, 9, 54, 0.58)');
      deckGrad.addColorStop(0.82, 'rgba(17, 10, 44, 0.64)');
      deckGrad.addColorStop(1, 'rgba(10, 14, 42, 0.76)');
      ctx.fillStyle = deckGrad;
      ctx.fill();

      // Scrolling neon cyan/magenta synthwave laser scanlines
      ctx.save();
      ctx.clip();
      const scrollPhase = (this.animClock * 1.4) % 1;
      for (let g = 0; g < 12; g += 1) {
        const lin = (g + scrollPhase) / 12;
        const persp = Math.pow(lin, 1.72);
        const y = geom.topY + (geom.bottomY - geom.topY) * persp;
        ctx.strokeStyle = g % 2 === 0
          ? `rgba(34, 211, 238, ${0.08 + persp * 0.22})`
          : `rgba(232, 121, 249, ${0.06 + persp * 0.18})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(botLeft, y);
        ctx.lineTo(botRight, y);
        ctx.stroke();
      }
      ctx.restore();
    } else if (skinId === 'royal-gold') {
      const deckGrad = ctx.createLinearGradient(0, geom.topY, 0, geom.bottomY);
      deckGrad.addColorStop(0, 'rgba(16, 13, 10, 0.38)');
      deckGrad.addColorStop(0.35, 'rgba(20, 16, 11, 0.62)');
      deckGrad.addColorStop(0.82, 'rgba(24, 18, 10, 0.68)');
      deckGrad.addColorStop(1, 'rgba(18, 13, 8, 0.78)');
      ctx.fillStyle = deckGrad;
      ctx.fill();
    } else {
      // Default: Smoked Concert Glass
      const deckGrad = ctx.createLinearGradient(0, geom.topY, 0, geom.bottomY);
      deckGrad.addColorStop(0, 'rgba(10, 14, 26, 0.28)');
      deckGrad.addColorStop(0.22, 'rgba(10, 14, 26, 0.52)');
      deckGrad.addColorStop(0.82, 'rgba(10, 14, 26, 0.58)');
      deckGrad.addColorStop(1, 'rgba(8, 11, 20, 0.68)');
      ctx.fillStyle = deckGrad;
      ctx.fill();
    }

    // Subtle alternating lane tint
    const laneTint =
      skinId === 'cyber-synth'
        ? 'rgba(34, 211, 238, 0.045)'
        : skinId === 'royal-gold'
          ? 'rgba(251, 191, 36, 0.04)'
          : skinId === 'inferno-flames'
            ? 'rgba(251, 146, 60, 0.04)'
            : 'rgba(255, 255, 255, 0.032)';

    for (let i = 0; i < laneCount; i += 1) {
      if (i % 2 === 1) continue;
      const u0 = i / laneCount;
      const u1 = (i + 1) / laneCount;
      ctx.beginPath();
      ctx.moveTo(topLeft + geom.topWidth * u0, geom.topY);
      ctx.lineTo(topLeft + geom.topWidth * u1, geom.topY);
      ctx.lineTo(botLeft + botHalf * 2 * u1, geom.bottomY);
      ctx.lineTo(botLeft + botHalf * 2 * u0, geom.bottomY);
      ctx.closePath();
      ctx.fillStyle = laneTint;
      ctx.fill();
    }
    ctx.restore();
  }

  drawLaneFlashBeams(ctx, geom, laneConfig, feverActive, ps = this.playerStates[0]) {
    const laneCount = laneConfig.count;
    const topLeft = geom.cx - geom.topWidth * 0.5;
    const hitLeft = geom.cx - geom.bottomWidth * 0.5;

    for (let i = 0; i < laneCount; i += 1) {
      const intensity = ps.laneBeamIntensity[i];
      if (intensity <= 0.01) continue;

      const baseHex = feverActive ? '#facc15' : laneConfig.colors[i].base;
      const u0 = i / laneCount;
      const u1 = (i + 1) / laneCount;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(topLeft + geom.topWidth * u0, geom.topY);
      ctx.lineTo(topLeft + geom.topWidth * u1, geom.topY);
      ctx.lineTo(hitLeft + geom.bottomWidth * u1, geom.hitY + 12);
      ctx.lineTo(hitLeft + geom.bottomWidth * u0, geom.hitY + 12);
      ctx.closePath();

      const grad = ctx.createLinearGradient(0, geom.hitY + 12, 0, geom.topY);
      grad.addColorStop(0, hexToRgba(baseHex, 0.48 * intensity));
      grad.addColorStop(0.32, hexToRgba(baseHex, 0.22 * intensity));
      grad.addColorStop(0.78, hexToRgba(baseHex, 0.04 * intensity));
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();
    }
  }

  lowerBoundTime(items, targetSec, getTime) {
    let lo = 0;
    let hi = items.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (getTime(items[mid]) < targetSec) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  drawBeatGrid(ctx, geom, beatGrid, songTime, highwaySkin) {
    if (!beatGrid || beatGrid.length === 0) return;
    const skinId = highwaySkin?.id || 'smoked-glass';
    const getBeatTime = (b) => b.timeSec ?? b.time;
    const startIdx = this.lowerBoundTime(beatGrid, songTime - 0.08, getBeatTime);

    for (let i = startIdx; i < beatGrid.length; i += 1) {
      const b = beatGrid[i];
      const beatTime = getBeatTime(b);
      if (beatTime > songTime + geom.windowSec) break;

      const proj = this.projectAudioTime(beatTime, songTime, geom);
      if (!proj.visible || proj.progress <= 0.02 || proj.progress > 1.05) continue;

      const tickVal = Number.isFinite(b.tick) ? Math.round(b.tick) : null;
      const isMeasureLine = Boolean(
        b.isMeasure || (tickVal !== null && tickVal % 768 === 0)
      );
      const isQuarterBeat = Boolean(
        isMeasureLine || tickVal === null || tickVal % 192 === 0
      );
      if (!isQuarterBeat) continue;

      const halfW = proj.width * 0.5;
      const fadeIn = Math.min(1, proj.progress * 3.6);
      const nearStrike = Math.max(0, 1 - Math.abs(beatTime - songTime) / 0.14);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(geom.cx - halfW, proj.y);
      ctx.lineTo(geom.cx + halfW, proj.y);

      // Clone Hero 192-PPQ fretboard lines: razor-sharp white 1/1 measure bars (tick % 768 === 0)
      // & crisp slate 1/4 beat lines (tick % 192 === 0) crossing y = hitY at exact t = 0ms
      ctx.lineWidth = isMeasureLine
        ? Math.max(1.8, (3.0 + nearStrike * 0.9) * proj.scale)
        : Math.max(1.0, (1.4 + nearStrike * 0.35) * proj.scale);

      ctx.strokeStyle = isMeasureLine
        ? `rgba(255, 255, 255, ${(0.8 + nearStrike * 0.2) * fadeIn})`
        : `rgba(203, 213, 225, ${(0.38 + nearStrike * 0.14) * fadeIn})`;
      ctx.stroke();

      // Subtle measure-bar outer edge fret markers for instant visual rhythm verification
      if (isMeasureLine) {
        const notchW = Math.max(3, 6 * proj.scale);
        const notchH = Math.max(2, 4.2 * proj.scale);
        ctx.fillStyle = `rgba(255, 255, 255, ${(0.82 * fadeIn).toFixed(3)})`;
        ctx.fillRect(geom.cx - halfW - notchW, proj.y - notchH * 0.5, notchW, notchH);
        ctx.fillRect(geom.cx + halfW, proj.y - notchH * 0.5, notchW, notchH);
      }

      // Fretboard inlays on measure lines for Rosewood Classic (mother-of-pearl trapezoid) & Royal Gold (diamond)
      if (isMeasureLine && skinId === 'rosewood-classic') {
        const inlayW = Math.max(10, proj.width * 0.24);
        const inlayH = Math.max(3, 9 * proj.scale);
        ctx.fillStyle = `rgba(241, 245, 249, ${0.24 * fadeIn})`;
        ctx.beginPath();
        ctx.moveTo(geom.cx - inlayW * 0.42, proj.y - inlayH * 0.5);
        ctx.lineTo(geom.cx + inlayW * 0.42, proj.y - inlayH * 0.5);
        ctx.lineTo(geom.cx + inlayW * 0.5, proj.y + inlayH * 0.5);
        ctx.lineTo(geom.cx - inlayW * 0.5, proj.y + inlayH * 0.5);
        ctx.closePath();
        ctx.fill();
      } else if (isMeasureLine && skinId === 'royal-gold') {
        const dSize = Math.max(3, 7 * proj.scale);
        ctx.fillStyle = `rgba(251, 191, 36, ${0.38 * fadeIn})`;
        ctx.beginPath();
        ctx.moveTo(geom.cx, proj.y - dSize);
        ctx.lineTo(geom.cx + dSize * 1.4, proj.y);
        ctx.lineTo(geom.cx, proj.y + dSize);
        ctx.lineTo(geom.cx - dSize * 1.4, proj.y);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    }
  }

  drawLaneRails(ctx, geom, laneCount, accentHex, feverActive, stereoTier, highwaySkin) {
    const skinId = highwaySkin?.id || 'smoked-glass';
    const topLeft = geom.cx - geom.topWidth * 0.5;
    const botW = geom.bottomWidth * 1.07;
    const botLeft = geom.cx - botW * 0.5;

    const outerPrimary = feverActive
      ? '#facc15'
      : skinId === 'inferno-flames'
        ? '#f97316'
        : skinId === 'cyber-synth'
          ? '#22d3ee'
          : skinId === 'royal-gold'
            ? '#fbbf24'
            : skinId === 'rosewood-classic'
              ? '#d97706'
              : accentHex;

    for (let i = 0; i <= laneCount; i += 1) {
      const u = i / laneCount;
      const isOuter = i === 0 || i === laneCount;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(topLeft + geom.topWidth * u, geom.topY);
      ctx.lineTo(botLeft + botW * u, geom.bottomY);

      if (isOuter) {
        const railGrad = ctx.createLinearGradient(0, geom.topY, 0, geom.bottomY);
        railGrad.addColorStop(0, hexToRgba(outerPrimary, 0.25));
        railGrad.addColorStop(0.5, hexToRgba(outerPrimary, feverActive || stereoTier > 0 ? 0.98 : 0.86));
        railGrad.addColorStop(1, feverActive ? '#fef08a' : skinId === 'inferno-flames' ? '#fde047' : hexToRgba(outerPrimary, 0.98));
        ctx.strokeStyle = railGrad;
        ctx.lineWidth = feverActive ? 4.2 : 3.0 + stereoTier * 0.45;
        ctx.stroke();

        // Double metallic gold filigree outer pinstripe on Royal Gold Encore
        if (skinId === 'royal-gold') {
          const offset = i === 0 ? -5 : 5;
          ctx.beginPath();
          ctx.moveTo(topLeft + geom.topWidth * u + offset * 0.5, geom.topY);
          ctx.lineTo(botLeft + botW * u + offset, geom.bottomY);
          ctx.strokeStyle = 'rgba(254, 243, 199, 0.62)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      } else {
        const innerGrad = ctx.createLinearGradient(0, geom.topY, 0, geom.bottomY);
        if (skinId === 'cyber-synth') {
          innerGrad.addColorStop(0, 'rgba(232, 121, 249, 0.12)');
          innerGrad.addColorStop(0.5, 'rgba(34, 211, 238, 0.34)');
          innerGrad.addColorStop(1, 'rgba(232, 121, 249, 0.55)');
        } else if (skinId === 'royal-gold') {
          innerGrad.addColorStop(0, 'rgba(254, 243, 199, 0.1)');
          innerGrad.addColorStop(0.5, 'rgba(251, 191, 36, 0.3)');
          innerGrad.addColorStop(1, 'rgba(254, 243, 199, 0.45)');
        } else if (skinId === 'rosewood-classic') {
          innerGrad.addColorStop(0, 'rgba(245, 222, 179, 0.12)');
          innerGrad.addColorStop(0.5, 'rgba(217, 179, 130, 0.28)');
          innerGrad.addColorStop(1, 'rgba(245, 222, 179, 0.42)');
        } else if (skinId === 'inferno-flames') {
          innerGrad.addColorStop(0, 'rgba(251, 146, 60, 0.1)');
          innerGrad.addColorStop(0.5, 'rgba(249, 115, 22, 0.26)');
          innerGrad.addColorStop(1, 'rgba(253, 186, 116, 0.42)');
        } else {
          innerGrad.addColorStop(0, 'rgba(148, 163, 184, 0.06)');
          innerGrad.addColorStop(0.45, 'rgba(148, 163, 184, 0.22)');
          innerGrad.addColorStop(1, 'rgba(226, 232, 240, 0.34)');
        }
        ctx.strokeStyle = innerGrad;
        ctx.lineWidth = 1.25;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawHitZoneReceptors(
    ctx,
    geom,
    laneConfig,
    feverActive,
    beatSync = null,
    notes = null,
    songTime = 0,
    timingWindows = null,
    ps = this.playerStates[0]
  ) {
    const laneCount = laneConfig.count;
    const hitY = geom.hitY;
    const hitW = geom.bottomWidth;
    const hitLeft = geom.cx - hitW * 0.5;
    const laneW = hitW / laneCount;

    // Detect per-lane incoming notes inside symmetric Clone Hero hit zone (±70ms / ±85ms), peaking at center PERFECT (±26ms)
    const goodEarlySec = (timingWindows?.GOOD_EARLY_MS || 70) / 1000;
    const goodLateSec = (timingWindows?.GOOD_LATE_MS || 70) / 1000;
    const perfectSec = (timingWindows?.PERFECT_LATE_MS || 26) / 1000;
    const perfectHalo = [0, 0, 0, 0, 0];
    const getNoteTime = (n) => n.timeSec ?? n.hitTimeSec;
    if (Array.isArray(notes) && notes.length > 0) {
      const checkStart = this.lowerBoundTime(notes, songTime - goodLateSec - 0.02, getNoteTime);
      for (let idx = checkStart; idx < notes.length; idx += 1) {
        const n = notes[idx];
        const noteTime = getNoteTime(n);
        if (noteTime > songTime + goodEarlySec + 0.02) break;
        if (n.hit || n.missed || n.dodged || n.isHazard) continue;
        const diff = noteTime - songTime;
        if (diff >= -goodLateSec && diff <= goodEarlySec) {
          const absDiff = Math.abs(diff);
          const limit = diff >= 0 ? goodEarlySec : goodLateSec;
          const intensity =
            absDiff <= perfectSec
              ? 1.0
              : Math.max(0.45, 0.9 - ((absDiff - perfectSec) / Math.max(0.01, limit - perfectSec)) * 0.45);
          if (n.lane >= 0 && n.lane < 5) {
            perfectHalo[n.lane] = Math.max(perfectHalo[n.lane], intensity);
          }
        }
      }
    }

    // Sample-accurate 192 PPQ downbeat & drum-transient strike-bar pulse along y = hitY
    const beatPulse = beatSync ? Math.pow(Math.max(0, 1 - beatSync.beatPhase * 3.4), 2) : 0;
    const drumPulse = beatSync?.transientEnergy?.drums ?? beatSync?.transientEnergy?.kick ?? 0;
    const downbeatBoost = beatSync?.isDownbeat ? 0.35 : 0;
    const barGlow = Math.min(0.85, beatPulse * 0.28 + drumPulse * 0.24 + downbeatBoost);

    ctx.save();
    // Live beat-locked pulse aura across the entire receptor strike-bar
    if (barGlow > 0.05) {
      const pulseGrad = ctx.createLinearGradient(0, hitY - 12, 0, hitY + 12);
      const pulseRgb = feverActive || beatSync?.isDownbeat ? '250, 204, 21' : '56, 189, 248';
      pulseGrad.addColorStop(0, `rgba(${pulseRgb}, 0)`);
      pulseGrad.addColorStop(0.5, `rgba(${pulseRgb}, ${(barGlow * 0.42).toFixed(3)})`);
      pulseGrad.addColorStop(1, `rgba(${pulseRgb}, 0)`);
      ctx.fillStyle = pulseGrad;
      ctx.fillRect(hitLeft - 12, hitY - 12, hitW + 24, 24);
    }

    // Wide center strike-bar anchored cleanly at y = hitY (exact t = 0ms centerline)
    const strikeGrad = ctx.createLinearGradient(hitLeft - 10, hitY, hitLeft + hitW + 10, hitY);
    strikeGrad.addColorStop(0, feverActive ? 'rgba(250, 204, 21, 0.18)' : 'rgba(226, 232, 240, 0.14)');
    strikeGrad.addColorStop(0.5, feverActive ? `rgba(254, 240, 138, ${(0.58 + barGlow * 0.42).toFixed(3)})` : `rgba(248, 250, 252, ${(0.42 + barGlow * 0.48).toFixed(3)})`);
    strikeGrad.addColorStop(1, feverActive ? 'rgba(250, 204, 21, 0.18)' : 'rgba(226, 232, 240, 0.14)');
    ctx.fillStyle = strikeGrad;
    ctx.fillRect(hitLeft - 8, hitY - 1.5, hitW + 16, 3 + beatPulse * 1.4);

    // Subtle rail alignment notches at exact hitY
    ctx.fillStyle = feverActive || beatSync?.isDownbeat ? '#fef08a' : '#f8fafc';
    ctx.fillRect(hitLeft - 11, hitY - 3, 5, 6);
    ctx.fillRect(hitLeft + hitW + 6, hitY - 3, 5, 6);

    for (let i = 0; i < laneCount; i += 1) {
      const baseColor = feverActive ? { base: '#facc15', bright: '#fef9c3' } : laneConfig.colors[i];
      const held = ps.heldLanes[i];
      const pulse = ps.padPulse[i];
      const haloStrength = perfectHalo[i];

      const padMargin = laneW * 0.065;
      const padCenterX = hitLeft + (i + 0.5) * laneW;
      const padW = laneW - padMargin * 2;
      const padH = 22;
      const depressY = held ? 2.5 : 0;
      const ringCy = hitY + depressY;
      const topHalfW = padW * 0.47;
      const botHalfW = padW * 0.51;
      const topEdgeY = ringCy - padH * 0.5;
      const botEdgeY = ringCy + padH * 0.5;

      const traceTrapezoid = (dx = 0, dyTop = 0, dyBot = 0) => {
        ctx.beginPath();
        ctx.moveTo(padCenterX - topHalfW - dx, topEdgeY - dyTop);
        ctx.lineTo(padCenterX + topHalfW + dx, topEdgeY - dyTop);
        ctx.lineTo(padCenterX + botHalfW + dx, botEdgeY + dyBot);
        ctx.lineTo(padCenterX - botHalfW - dx, botEdgeY + dyBot);
        ctx.closePath();
      };

      // 1. Dynamic outer bloom when held, struck, or note enters PERFECT (-45ms..+55ms) zone
      if (held || pulse > 0.02 || haloStrength > 0.05) {
        ctx.save();
        ctx.shadowColor = haloStrength > 0.1 ? '#fef08a' : baseColor.base;
        ctx.shadowBlur = 14 + Math.max(pulse * 18, haloStrength * 22);
        const haloAlpha = Math.max(held ? 0.28 : 0, pulse * 0.42, haloStrength * 0.36);
        ctx.fillStyle = hexToRgba(haloStrength > 0.15 ? baseColor.bright : baseColor.base, haloAlpha);
        traceTrapezoid(3, 2, 3);
        ctx.fill();
        ctx.restore();
      }

      // 2. Dark 3D Fret Pad base bevel underneath
      ctx.fillStyle = 'rgba(2, 6, 23, 0.92)';
      traceTrapezoid(1, 0, 4);
      ctx.fill();

      // 3. Wide, flat perspective-matched 3D Fret Pad socket
      const padGrad = ctx.createLinearGradient(0, topEdgeY, 0, botEdgeY);
      if (held) {
        padGrad.addColorStop(0, hexToRgba(baseColor.bright, 0.72));
        padGrad.addColorStop(1, hexToRgba(baseColor.base, 0.9));
      } else {
        padGrad.addColorStop(0, 'rgba(15, 23, 42, 0.88)');
        padGrad.addColorStop(0.55, 'rgba(9, 13, 24, 0.94)');
        padGrad.addColorStop(1, 'rgba(24, 33, 52, 0.92)');
      }
      ctx.fillStyle = padGrad;
      traceTrapezoid(0, 0, 0);
      ctx.fill();

      ctx.lineWidth = held || pulse > 0.1 || haloStrength > 0.15 ? 2.4 : 1.75;
      ctx.strokeStyle = haloStrength > 0.25 ? '#fef08a' : held || pulse > 0.1 ? baseColor.bright : baseColor.base;
      ctx.stroke();

      // 4. Perspective Target Ring centered precisely at (padCenterX, ringCy == hitY)
      const ringRx = Math.max(10, padW * 0.39);
      const ringRy = Math.max(5.5, padH * 0.38);

      // Dynamic Inner Halo illuminating when incoming note is inside PERFECT (-45ms..+55ms)
      if (haloStrength > 0.05 || held || pulse > 0.1) {
        const innerGlow = Math.max(haloStrength, pulse * 0.85, held ? 0.5 : 0);
        const haloGrad = ctx.createRadialGradient(
          padCenterX,
          ringCy,
          1,
          padCenterX,
          ringCy,
          ringRx * 1.08
        );
        haloGrad.addColorStop(0, `rgba(255, 255, 255, ${(innerGlow * 0.78).toFixed(3)})`);
        haloGrad.addColorStop(0.45, hexToRgba(haloStrength > 0.2 ? '#fde047' : baseColor.bright, innerGlow * 0.62));
        haloGrad.addColorStop(1, hexToRgba(baseColor.base, 0));
        ctx.fillStyle = haloGrad;
        ctx.beginPath();
        ctx.ellipse(padCenterX, ringCy, ringRx * 1.05, ringRy * 1.15, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Outer beveled target ring matching gem footprint
      ctx.beginPath();
      ctx.ellipse(padCenterX, ringCy, ringRx, ringRy, 0, 0, Math.PI * 2);
      ctx.lineWidth = haloStrength > 0.15 || held ? 2.4 : 1.75;
      ctx.strokeStyle = haloStrength > 0.2 ? '#ffffff' : held || pulse > 0.15 ? baseColor.bright : hexToRgba(baseColor.base, 0.92);
      ctx.stroke();

      // Crisp inner target ring & bright strike-bar crosshair aligned at exact hitY (t = 0ms)
      ctx.beginPath();
      ctx.ellipse(padCenterX, ringCy, ringRx * 0.64, ringRy * 0.62, 0, 0, Math.PI * 2);
      ctx.lineWidth = haloStrength > 0.15 ? 1.8 : 1.2;
      ctx.strokeStyle = haloStrength > 0.15 ? '#fef08a' : hexToRgba(baseColor.bright, held ? 0.92 : 0.45);
      ctx.stroke();

      ctx.fillStyle = haloStrength > 0.15 || held || pulse > 0.2 ? '#ffffff' : hexToRgba(baseColor.bright, 0.72);
      ctx.fillRect(padCenterX - ringRx * 0.82, ringCy - 1, ringRx * 1.64, 2);

      // 5. Key label cleanly beneath Fret Pad
      ctx.font = '700 13px "Oswald", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = held || haloStrength > 0.25 ? '#ffffff' : 'rgba(226, 232, 240, 0.78)';
      ctx.fillText(laneConfig.keys[i], padCenterX, botEdgeY + 6);
    }
    ctx.restore();
  }

  /**
   * Renders a diegetic glowing vertical Fever Lightning Charge tube flanking
   * the right rail of the note highway, crackling with electric gold when ready/active.
   */
  drawBesideHighwayFeverMeter(ctx, geom, state) {
    const charge = Math.max(0, Math.min(100, state.feverCharge || 0)) / 100;
    const ready = typeof state.canActivateFever === 'function' ? state.canActivateFever() : charge >= 0.5;
    const active = Boolean(state.feverActive);

    const startFrac = 0.28;
    const endFrac = 0.97;
    const topRightX = geom.cx + geom.topWidth * 0.5;
    const hitRightX = geom.cx + geom.bottomWidth * 0.5 * 1.07;

    const pTop = Math.pow(startFrac, 1.72);
    const pBot = Math.pow(endFrac, 1.72);
    const yTop = geom.topY + geom.highwayLength * pTop;
    const yBot = geom.topY + geom.highwayLength * pBot;

    const railXTop = topRightX + (hitRightX - topRightX) * pTop + 14;
    const railXBot = topRightX + (hitRightX - topRightX) * pBot + 22;
    const wTop = 8;
    const wBot = 15;

    ctx.save();

    // Outer glass tube casing following highway perspective slope
    ctx.beginPath();
    ctx.moveTo(railXTop, yTop);
    ctx.lineTo(railXTop + wTop, yTop);
    ctx.lineTo(railXBot + wBot, yBot);
    ctx.lineTo(railXBot, yBot);
    ctx.closePath();

    ctx.fillStyle = 'rgba(7, 11, 20, 0.84)';
    ctx.fill();
    ctx.lineWidth = ready || active ? 1.8 : 1.1;
    ctx.strokeStyle = active
      ? '#fef08a'
      : ready
        ? '#38bdf8'
        : 'rgba(148, 163, 184, 0.36)';
    ctx.stroke();

    // Rising charge liquid column inside the perspective tube
    const fillRatio = active ? Math.max(0.08, charge) : charge;
    if (fillRatio > 0.01) {
      const fillFrac = endFrac - (endFrac - startFrac) * fillRatio;
      const pFill = Math.pow(fillFrac, 1.72);
      const yFill = geom.topY + geom.highwayLength * pFill;
      const xFillLeft = topRightX + (hitRightX - topRightX) * pFill + (14 + 8 * pFill);
      const wFill = wTop + (wBot - wTop) * ((fillFrac - startFrac) / (endFrac - startFrac));

      if (ready || active) {
        ctx.shadowColor = active ? '#facc15' : '#38bdf8';
        ctx.shadowBlur = active ? 20 : 14;
      }

      ctx.beginPath();
      ctx.moveTo(xFillLeft + 1.5, yFill);
      ctx.lineTo(xFillLeft + wFill - 1.5, yFill);
      ctx.lineTo(railXBot + wBot - 1.5, yBot - 1);
      ctx.lineTo(railXBot + 1.5, yBot - 1);
      ctx.closePath();

      const colGrad = ctx.createLinearGradient(0, yFill, 0, yBot);
      if (active) {
        colGrad.addColorStop(0, '#ffffff');
        colGrad.addColorStop(0.35, '#fef08a');
        colGrad.addColorStop(1, '#f59e0b');
      } else if (ready) {
        colGrad.addColorStop(0, '#e0f2fe');
        colGrad.addColorStop(0.4, '#38bdf8');
        colGrad.addColorStop(1, '#facc15');
      } else {
        colGrad.addColorStop(0, '#38bdf8');
        colGrad.addColorStop(1, '#0284c7');
      }
      ctx.fillStyle = colGrad;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Animated electric crackle wave inside active/ready tube
      if (ready || active) {
        ctx.beginPath();
        const steps = 8;
        for (let s = 0; s <= steps; s += 1) {
          const t = s / steps;
          const sy = yFill + (yBot - yFill) * t;
          const sxBase = xFillLeft + (railXBot - xFillLeft) * t + (wFill + (wBot - wFill) * t) * 0.5;
          const jitter = Math.sin(this.animClock * 28 + s * 2.7) * 3.2;
          if (s === 0) ctx.moveTo(sxBase + jitter, sy);
          else ctx.lineTo(sxBase + jitter, sy);
        }
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
    }

    // 50% Ready threshold notch
    const halfFrac = startFrac + (endFrac - startFrac) * 0.5;
    const pHalf = Math.pow(halfFrac, 1.72);
    const yHalf = geom.topY + geom.highwayLength * pHalf;
    const xHalf = topRightX + (hitRightX - topRightX) * pHalf + (14 + 8 * pHalf);
    const wHalf = wTop + (wBot - wTop) * 0.5;
    ctx.fillStyle = ready || active ? '#fef08a' : 'rgba(255, 255, 255, 0.45)';
    ctx.fillRect(xHalf - 2, yHalf - 1, wHalf + 4, 2);

    // Top lightning bolt emblem
    const boltX = railXTop + wTop * 0.5;
    const boltY = yTop - 14;
    const pulse = ready || active ? 1 + 0.14 * Math.sin(this.animClock * 11) : 1;
    ctx.save();
    ctx.translate(boltX, boltY);
    ctx.scale(pulse, pulse);
    if (ready || active) {
      ctx.shadowColor = active ? '#facc15' : '#38bdf8';
      ctx.shadowBlur = 14;
    }
    ctx.fillStyle = active ? '#fef08a' : ready ? '#38bdf8' : 'rgba(148, 163, 184, 0.55)';
    ctx.beginPath();
    ctx.moveTo(2, -9);
    ctx.lineTo(-5, 1);
    ctx.lineTo(0, 1);
    ctx.lineTo(-2, 9);
    ctx.lineTo(5, -1);
    ctx.lineTo(0, -1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  drawStereoRipples(ctx) {
    for (let i = 0; i < this.ripples.length; i += 1) {
      const r = this.ripples[i];
      if (!r.active) continue;

      const t = r.life / r.maxLife;
      const easeOut = 1 - Math.pow(1 - t, 3);
      const rx = r.rx + (r.maxRx - r.rx) * easeOut;
      const ry = r.ry + 22 * easeOut;
      const alpha = Math.max(0, 1 - t);

      ctx.save();
      ctx.strokeStyle = hexToRgba(r.color, alpha * (r.isFever ? 0.9 : 0.72));
      ctx.lineWidth = Math.max(1, 3.2 * (1 - t));
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.4})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, rx * 0.68, ry * 0.65, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawNotes(ctx, geom, laneConfig, notes, songTime, feverActive, ps = this.playerStates[0]) {
    if (!notes || notes.length === 0) return;
    const laneCount = laneConfig.count;
    const getHitTime = (n) => n.timeSec ?? n.hitTimeSec;

    // 1. Draw Smart Non-Overlapping Hold / Sustain Ribbons via stateless binary search (max sustain ~10s)
    const sustainStart = this.lowerBoundTime(notes, songTime - 10.0, getHitTime);
    for (let i = sustainStart; i < notes.length; i += 1) {
      const note = notes[i];
      const noteTime = getHitTime(note);
      const sustainDur = note.sustainSec ?? note.sustainDuration ?? 0;
      if (noteTime > songTime + geom.windowSec) break;
      if (sustainDur <= 0 || note.holdCompleted) continue;
      if (note.hit && !note.holding) continue;

      const tailTime = noteTime + sustainDur;
      if (tailTime < songTime - 0.1) continue;

      const headTime = note.holding ? Math.max(noteTime, songTime) : noteTime;
      const clampedTailTime = Math.min(tailTime, songTime + geom.windowSec);

      const isGolden = note.isFever || note.isStar || feverActive;
      const color = isGolden
        ? { base: '#facc15', bright: '#fef9c3' }
        : laneConfig.colors[note.lane];

      const isWhammyBending = note.holding && ps.whammyVisualAmount > 0.05;
      const segments = isWhammyBending ? 14 : 6;

      ctx.save();
      ctx.globalAlpha = note.missed ? 0.22 : note.holding ? 0.98 : 0.8;

      const leftPts = [];
      const rightPts = [];
      const centerPts = [];

      for (let s = 0; s <= segments; s += 1) {
        const frac = s / segments;
        const sampleT = headTime + (clampedTailTime - headTime) * frac;
        const proj = this.projectAudioTime(sampleT, songTime, geom);
        if (!proj.visible) continue;

        const laneW = proj.width / laneCount;
        let cx = geom.cx - proj.width * 0.5 + (note.lane + 0.5) * laneW;
        if (isWhammyBending) {
          // Physical vibrato wave pulsing along the held sustain ribbon!
          const amp = laneW * 0.19 * ps.whammyVisualAmount * Math.sin(frac * Math.PI);
          cx += Math.sin(this.animClock * 36 - frac * 14) * amp;
        }
        const half = laneW * (isWhammyBending ? 0.2 : 0.16);
        const anchorY = proj.y;
        leftPts.push([cx - half, anchorY]);
        rightPts.push([cx + half, anchorY]);
        centerPts.push([cx, anchorY]);
      }

      if (leftPts.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(leftPts[0][0], leftPts[0][1]);
        for (let k = 1; k < leftPts.length; k += 1) ctx.lineTo(leftPts[k][0], leftPts[k][1]);
        for (let k = rightPts.length - 1; k >= 0; k -= 1) ctx.lineTo(rightPts[k][0], rightPts[k][1]);
        ctx.closePath();

        const tailGrad = ctx.createLinearGradient(0, leftPts[leftPts.length - 1][1], 0, leftPts[0][1]);
        tailGrad.addColorStop(0, hexToRgba(color.base, 0.45));
        tailGrad.addColorStop(0.5, hexToRgba(color.base, 0.86));
        tailGrad.addColorStop(1, isWhammyBending ? '#ffffff' : color.bright);
        ctx.fillStyle = tailGrad;
        ctx.fill();

        // Luminous center wire
        ctx.beginPath();
        ctx.moveTo(centerPts[0][0], centerPts[0][1]);
        for (let k = 1; k < centerPts.length; k += 1) ctx.lineTo(centerPts[k][0], centerPts[k][1]);
        ctx.strokeStyle = isWhammyBending ? '#fef08a' : 'rgba(255, 255, 255, 0.78)';
        ctx.lineWidth = isWhammyBending ? 4 : 2.5;
        ctx.stroke();
      }
      ctx.restore();
    }

    // 2. Chord connector bars via binary-search visible window
    const chordStart = this.lowerBoundTime(notes, songTime - PAST_GRACE_SEC - 0.05, getHitTime);
    for (let i = chordStart; i < notes.length - 1; i += 1) {
      const a = notes[i];
      const aTime = getHitTime(a);
      if (aTime > songTime + geom.windowSec) break;
      const b = notes[i + 1];
      const bTime = getHitTime(b);
      if (!a.isChord || !b.isChord || a.hit || b.hit || Math.abs(aTime - bTime) > 0.008) {
        continue;
      }
      const proj = this.projectAudioTime(aTime, songTime, geom);
      if (!proj.visible || proj.progress <= 0.02 || proj.progress > 1.08) continue;

      const laneW = proj.width / laneCount;
      const left = geom.cx - proj.width * 0.5;
      const x1 = left + (a.lane + 0.5) * laneW;
      const x2 = left + (b.lane + 0.5) * laneW;
      const barY = proj.y;

      ctx.save();
      ctx.strokeStyle = a.isFever || a.isStar || feverActive
        ? `rgba(254, 240, 138, ${Math.min(0.95, proj.progress * 2.4)})`
        : `rgba(226, 232, 240, ${Math.min(0.72, proj.progress * 2.2)})`;
      ctx.lineWidth = Math.max(1.5, 4 * proj.scale);
      ctx.beginPath();
      ctx.moveTo(x1, barY);
      ctx.lineTo(x2, barY);
      ctx.stroke();
      ctx.restore();
    }

    // 3. Draw note heads + "Panggulo" Hazard Bomb gems via stateless binary-search visible window
    const headStart = this.lowerBoundTime(notes, songTime - PAST_GRACE_SEC - 0.05, getHitTime);
    for (let i = headStart; i < notes.length; i += 1) {
      const note = notes[i];
      if (note.hit || note.dodged) continue;

      const noteTime = getHitTime(note);
      const timeRemaining = noteTime - songTime;
      if (timeRemaining > geom.windowSec) break;
      if (timeRemaining < -PAST_GRACE_SEC) continue;

      const proj = this.projectAudioTime(noteTime, songTime, geom);
      if (!proj.visible || proj.progress <= 0.01 || proj.progress > 1.12) continue;

      const laneW = proj.width / laneCount;
      const leftEdge = geom.cx - proj.width * 0.5;
      const margin = laneW * 0.085;
      const noteW = Math.max(8, laneW - margin * 2);
      const noteH = Math.max(5, 22 * proj.scale);
      const noteX = leftEdge + note.lane * laneW + margin;

      const fadeIn = Math.min(1, proj.progress * 4.4);
      const fadeOut = proj.progress > 1.02 ? Math.max(0, 1 - (proj.progress - 1.02) * 10) : 1;
      const alpha = (note.missed ? 0.25 : 1) * fadeIn * fadeOut;

      // Distinct "Panggulo" Hazard Bomb Gem (DO NOT HIT!)
      if (note.isHazard) {
        const cx = noteX + noteW * 0.5;
        const rx = Math.max(9, noteW * 0.38);
        const ry = Math.max(7, noteH * 0.72);
        const cy = proj.y;
        const pulse = 0.75 + 0.25 * Math.sin(this.animClock * 18 + i);

        ctx.save();
        ctx.globalAlpha = alpha;

        // Pulsing crimson danger aura
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = Math.max(8, 22 * proj.scale * pulse);

        // Spiked crimson-obsidian octagon silhouette
        ctx.beginPath();
        const spikes = 8;
        for (let s = 0; s < spikes * 2; s += 1) {
          const ang = (s * Math.PI) / spikes + this.animClock * 1.4;
          const mult = s % 2 === 0 ? 1.16 : 0.78;
          const px = cx + Math.cos(ang) * rx * mult;
          const py = cy + Math.sin(ang) * ry * mult;
          if (s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = '#18060a';
        ctx.fill();
        ctx.lineWidth = Math.max(1.6, 2.8 * proj.scale);
        ctx.strokeStyle = '#ef4444';
        ctx.stroke();

        // Diagonal yellow/black hazard caution ribbon clipped inside body
        ctx.shadowBlur = 0;
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx * 0.78, ry * 0.74, 0, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = Math.max(2, 4 * proj.scale);
        const step = Math.max(5, 9 * proj.scale);
        for (let sx = -rx * 1.6; sx <= rx * 1.6; sx += step * 1.6) {
          ctx.beginPath();
          ctx.moveTo(cx + sx - ry, cy + ry);
          ctx.lineTo(cx + sx + ry, cy - ry);
          ctx.stroke();
        }
        ctx.restore();

        // Crisp dark badge & glowing red X / "!" warning symbol in center
        ctx.fillStyle = '#09090b';
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx * 0.48, ry * 0.48, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = Math.max(1.2, 2.2 * proj.scale);
        ctx.stroke();

        const xArm = rx * 0.25;
        const yArm = ry * 0.25;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(1.6, 2.8 * proj.scale);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - xArm, cy - yArm);
        ctx.lineTo(cx + xArm, cy + yArm);
        ctx.moveTo(cx + xArm, cy - yArm);
        ctx.lineTo(cx - xArm, cy + yArm);
        ctx.stroke();

        ctx.restore();
        continue;
      }

      const isGolden = note.isFever || feverActive;
      const isStar = isGolden || Boolean(note.isStar) || Boolean(note.isAccent);
      const isHopo = Boolean(note.isHopo);
      const color = isGolden
        ? { base: '#f59e0b', bright: '#fef08a' }
        : laneConfig.colors[note.lane];

      const gemCx = noteX + noteW * 0.5;
      const gemRx = Math.max(6.5, noteW * 0.42);
      const gemRy = Math.max(4.5, noteH * 0.58);
      // Center gem directly on proj.y so target-ring alignment is exact 0.0ms PERFECT
      const gemCy = proj.y;

      ctx.save();
      ctx.globalAlpha = alpha;

      if (!note.missed) {
        ctx.shadowColor = isHopo ? '#ffffff' : isGolden ? '#facc15' : isStar ? '#38bdf8' : color.base;
        ctx.shadowBlur = Math.max(6, (isHopo ? 22 : isStar ? 24 : 15) * proj.scale);
      }

      if (isStar) {
        this.drawStarGem(ctx, gemCx, gemCy, gemRx * 1.06, gemRy * 1.18, proj.scale, {
          color,
          isGolden,
          isHopo,
          animSeed: i * 0.37,
        });
      } else {
        this.drawCircleGem(ctx, gemCx, gemCy, gemRx, gemRy, proj.scale, {
          color,
          isHopo,
        });
      }

      ctx.restore();
    }
  }

  /**
   * Draws a sculpted Guitar Hero-style beveled 3D circular disc gem with
   * outer metallic bezel, radial dome lighting, specular crescent, and raised white HOPO cap.
   */
  drawCircleGem(ctx, cx, cy, rx, ry, scale, { color, isHopo }) {
    const bevelOffset = Math.max(1.8, 3.2 * scale);

    // 1. Dark underside 3D drop bevel
    ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + bevelOffset, rx * 1.02, ry * 1.02, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Outer metallic chrome/color bezel
    const rimGrad = ctx.createLinearGradient(cx, cy - ry, cx, cy + ry);
    rimGrad.addColorStop(0, isHopo ? '#ffffff' : '#e2e8f0');
    rimGrad.addColorStop(0.5, color.base);
    rimGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = rimGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = Math.max(1, 1.8 * scale);
    ctx.strokeStyle = isHopo ? '#ffffff' : 'rgba(255, 255, 255, 0.72)';
    ctx.stroke();

    // 3. Inner dome core with offset 3D radial highlight
    ctx.shadowBlur = 0;
    const innerRx = rx * 0.78;
    const innerRy = ry * 0.76;
    const domeGrad = ctx.createRadialGradient(
      cx - innerRx * 0.22,
      cy - innerRy * 0.28,
      Math.max(1, innerRx * 0.08),
      cx,
      cy,
      innerRx
    );
    domeGrad.addColorStop(0, '#ffffff');
    domeGrad.addColorStop(0.32, color.bright);
    domeGrad.addColorStop(0.72, color.base);
    domeGrad.addColorStop(1, hexToRgba(color.base, 0.92));

    ctx.fillStyle = domeGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, innerRx, innerRy, 0, 0, Math.PI * 2);
    ctx.fill();

    // 4. Center cap: bright raised glowing white cap for HOPO notes, glossy highlight crescent otherwise
    if (isHopo) {
      const capGrad = ctx.createRadialGradient(cx, cy - innerRy * 0.18, 1, cx, cy, innerRx * 0.54);
      capGrad.addColorStop(0, '#ffffff');
      capGrad.addColorStop(0.65, '#f8fafc');
      capGrad.addColorStop(1, '#cbd5e1');
      ctx.fillStyle = capGrad;
      ctx.beginPath();
      ctx.ellipse(cx, cy - ry * 0.05, innerRx * 0.56, innerRy * 0.56, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = Math.max(0.9, 1.4 * scale);
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
      ctx.beginPath();
      ctx.ellipse(cx, cy - innerRy * 0.34, innerRx * 0.54, innerRy * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * Draws a sculpted 5-point Guitar Hero Star-Power / Accent gem with
   * rotating golden-cyan halo and crisp inner star core.
   */
  drawStarGem(ctx, cx, cy, rx, ry, scale, { color, isGolden, isHopo, animSeed }) {
    const bevelOffset = Math.max(1.8, 3.2 * scale);
    const rot = Math.sin(this.animClock * 3.1 + animSeed) * 0.16;
    const pulse = 1 + 0.06 * Math.sin(this.animClock * 7.5 + animSeed);

    // Subtle golden-cyan outer halo ring
    ctx.save();
    ctx.strokeStyle = isGolden ? 'rgba(254, 240, 138, 0.65)' : 'rgba(56, 189, 248, 0.55)';
    ctx.lineWidth = Math.max(1, 1.6 * scale);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 1.12 * pulse, ry * 1.12 * pulse, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    const traceStar = (xCenter, yCenter, outerX, outerY, innerRatio) => {
      ctx.beginPath();
      const spikes = 5;
      for (let s = 0; s < spikes * 2; s += 1) {
        const radiusScale = s % 2 === 0 ? 1 : innerRatio;
        const ang = -Math.PI * 0.5 + rot + (s * Math.PI) / spikes;
        const px = xCenter + Math.cos(ang) * outerX * radiusScale;
        const py = yCenter + Math.sin(ang) * outerY * radiusScale;
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    };

    // 1. Dark 3D drop bevel
    ctx.fillStyle = 'rgba(2, 6, 23, 0.86)';
    traceStar(cx, cy + bevelOffset, rx * 1.03, ry * 1.03, 0.46);
    ctx.fill();

    // 2. Sculpted 3D metallic star body
    const starGrad = ctx.createRadialGradient(
      cx - rx * 0.15,
      cy - ry * 0.25,
      Math.max(1, rx * 0.08),
      cx,
      cy,
      Math.max(rx, ry)
    );
    starGrad.addColorStop(0, '#ffffff');
    starGrad.addColorStop(0.28, isGolden ? '#fef08a' : color.bright);
    starGrad.addColorStop(0.7, isGolden ? '#f59e0b' : color.base);
    starGrad.addColorStop(1, isGolden ? '#92400e' : '#0f172a');

    ctx.fillStyle = starGrad;
    traceStar(cx, cy, rx, ry, 0.46);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.lineWidth = Math.max(1.1, 2.0 * scale);
    ctx.strokeStyle = isHopo || isGolden ? '#fef9c3' : '#e0f2fe';
    ctx.stroke();

    // 3. Inner luminous star core / HOPO white pearl center
    ctx.fillStyle = isHopo ? '#ffffff' : 'rgba(255, 255, 255, 0.9)';
    traceStar(cx, cy - ry * 0.03, rx * (isHopo ? 0.44 : 0.34), ry * (isHopo ? 0.44 : 0.34), 0.52);
    ctx.fill();
  }

  /**
   * Renders the glowing multi-lane Big Rock Ending (BRE) freestyle runway zone & live bonus counter!
   */
  drawBreFreestyleOverlay(ctx, geom, laneConfig, breBonusPoints) {
    const laneCount = laneConfig.count;
    const topLeft = geom.cx - geom.topWidth * 0.5;
    const hitLeft = geom.cx - geom.bottomWidth * 0.5;
    const pulse = 0.65 + 0.35 * Math.sin(this.animClock * 11);

    ctx.save();
    for (let i = 0; i < laneCount; i += 1) {
      const u0 = i / laneCount;
      const u1 = (i + 1) / laneCount;
      const laneColor = laneConfig.colors[i]?.base || '#facc15';
      const wave = 0.55 + 0.45 * Math.sin(this.animClock * 14 + i * 1.15);

      ctx.beginPath();
      ctx.moveTo(topLeft + geom.topWidth * u0, geom.topY);
      ctx.lineTo(topLeft + geom.topWidth * u1, geom.topY);
      ctx.lineTo(hitLeft + geom.bottomWidth * u1, geom.hitY);
      ctx.lineTo(hitLeft + geom.bottomWidth * u0, geom.hitY);
      ctx.closePath();

      const grad = ctx.createLinearGradient(0, geom.topY, 0, geom.hitY);
      grad.addColorStop(0, hexToRgba(laneColor, 0.06));
      grad.addColorStop(0.55, hexToRgba(laneColor, 0.22 * wave));
      grad.addColorStop(1, hexToRgba('#fde047', 0.38 * pulse));
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Center FREESTYLE banner & live bonus tally
    const bannerY = geom.topY + (geom.hitY - geom.topY) * 0.42;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 22;
    ctx.fillStyle = '#fef08a';
    ctx.font = '700 28px "Oswald", sans-serif';
    ctx.fillText('⚡ BIG ROCK ENDING · FREESTYLE! ⚡', geom.cx, bannerY);

    ctx.shadowColor = '#fb923c';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 18px "JetBrains Mono", monospace';
    ctx.fillText(
      breBonusPoints > 0 ? `+${breBonusPoints.toLocaleString()} BRE BONUS` : 'MASH ANY FRETS FOR ENCORE BONUS!',
      geom.cx,
      bannerY + 30
    );
    ctx.restore();
  }

  drawParticles(ctx) {
    for (let i = 0; i < this.particles.length; i += 1) {
      const p = this.particles[i];
      if (!p.active) continue;

      const t = p.life / p.maxLife;
      const alpha = Math.max(0, 1 - t);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = t < 0.28 ? p.bright : p.color;

      if (p.shape === 'bar') {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.vx * 0.008);
        ctx.fillRect(-p.size * 1.15, -p.size * 0.38, p.size * 2.3, p.size * 0.76);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - t * 0.45), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  drawLeadInCue(ctx, geom, songTime, accentHex) {
    if (songTime >= -0.05 || songTime < -1.85) return;
    const rem = Math.max(0, -songTime);
    const label = rem > 0.95 ? 'GET READY · 2' : 'GET READY · 1';
    const pulse = 0.72 + 0.28 * Math.sin(this.animClock * 12);

    ctx.save();
    ctx.translate(geom.cx, geom.hitY - 92);
    ctx.globalAlpha = Math.min(1, rem * 3.5) * pulse;
    ctx.font = '700 22px "Oswald", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = accentHex;
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }

  drawCallouts(ctx, geom, ps = this.playerStates[0], showBanner = true) {
    if (ps.judgementPopup) {
      const j = ps.judgementPopup;
      const p = j.age / j.duration;
      const scale = p < 0.15 ? 0.82 + (p / 0.15) * 0.3 : 1.12 - ((p - 0.15) / 0.85) * 0.14;
      const alpha = p < 0.65 ? 1 : Math.max(0, 1 - (p - 0.65) / 0.35);
      const lift = p * 28;

      ctx.save();
      ctx.translate(geom.cx, geom.hitY - 62 - lift);
      ctx.scale(scale, scale);
      ctx.globalAlpha = alpha;
      ctx.font = '700 28px "Oswald", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = j.color;
      ctx.shadowBlur = 18;
      ctx.fillStyle = j.color;
      ctx.fillText(j.text, 0, 0);
      ctx.restore();
    }

    // Non-intrusive Streak Milestone & Concert Banners positioned cleanly ABOVE the highway horizon
    // so they NEVER block incoming notes!
    if (showBanner && this.bannerPopup) {
      const b = this.bannerPopup;
      const p = b.age / b.duration;
      const alpha = p < 0.14 ? p / 0.14 : p < 0.74 ? 1 : Math.max(0, 1 - (p - 0.74) / 0.26);
      const scale = p < 0.14 ? 0.9 + (p / 0.14) * 0.12 : 1.02 - ((p - 0.14) / 0.86) * 0.04;
      const bannerX = this.width * 0.5;
      const bannerY = Math.max(30, geom.topY - 34);

      ctx.save();
      ctx.translate(bannerX, bannerY);
      ctx.scale(scale, scale);
      ctx.globalAlpha = alpha;
      ctx.font = '700 24px "Oswald", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 22;
      ctx.fillStyle = b.color;
      ctx.fillText(b.text, 0, 0);
      ctx.restore();
    }
  }

  roundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width * 0.5, height * 0.5);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}

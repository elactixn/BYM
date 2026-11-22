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
const PAST_GRACE_SEC = 0.22;

function hexToRgba(hex, alpha) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export class RhythmCanvas {
  constructor(canvas, { getGameState, getNotes, getBeatGrid, getEffectiveTime, getAudioTelemetry, onFrameTick }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.getGameState = getGameState;
    this.getNotes = getNotes;
    this.getBeatGrid = getBeatGrid;
    this.getEffectiveTime = getEffectiveTime;
    this.getAudioTelemetry = getAudioTelemetry;
    this.onFrameTick = onFrameTick || (() => {});

    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.running = false;
    this.rafId = null;
    this.lastFrameMs = 0;
    this.animClock = 0;

    // Input & Whammy visuals
    this.heldLanes = [false, false, false, false, false];
    this.laneBeamIntensity = [0, 0, 0, 0, 0];
    this.padPulse = [0, 0, 0, 0, 0];
    this.whammyVisualAmount = 0;

    // Camera shake & popups
    this.shakeAmount = 0;
    this.judgementPopup = null;
    this.bannerPopup = null;

    // Hit-Window Timing Meter (Early / Late deviation ticks + rolling average needle)
    this.timingTicks = [];
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

  getHighwayGeometry() {
    const w = this.width;
    const h = this.height;
    const cx = w * 0.5;

    const topY = Math.max(58, h * 0.145);
    const hitY = h * 0.825;
    const bottomY = h * 0.965;

    const laneCount = this.getGameState().laneCount;
    const targetW = laneCount === 5 ? 650 : laneCount === 3 ? 440 : 550;
    const maxBottomWidth = Math.min(w * 0.86, targetW);
    const bottomWidth = Math.max(260, maxBottomWidth);
    const topWidth = bottomWidth * 0.3;

    // Effective scroll speed (pixels per second along the vertical highway span)
    const diff = this.getGameState().getDifficultyConfig();
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
    const timeRemaining = hitTimeSec - effectiveSongTime;
    const distPixels = timeRemaining * geom.scrollSpeed;
    const linearProgress = 1 - distPixels / geom.highwayLength;

    if (linearProgress < 0) {
      return { visible: false, progress: linearProgress, y: geom.topY, width: geom.topWidth, scale: 0.3 };
    }

    // Subtle perspective curve preserving exact hitY alignment at linearProgress === 1.0
    const perspective = Math.pow(linearProgress, 1.72);
    const y = geom.topY + geom.highwayLength * perspective;
    const width = geom.topWidth + (geom.bottomWidth - geom.topWidth) * perspective;
    const scale = width / geom.bottomWidth;
    return { visible: true, progress: linearProgress, y, width, scale };
  }

  setLaneHeld(laneIndex, held) {
    if (laneIndex < 0 || laneIndex >= 5) return;
    this.heldLanes[laneIndex] = held;
    if (held) {
      this.laneBeamIntensity[laneIndex] = Math.max(this.laneBeamIntensity[laneIndex], 0.72);
    }
  }

  setWhammyVisual(amount) {
    this.whammyVisualAmount = Math.max(0, Math.min(1, amount));
  }

  clearHeldLanes() {
    for (let i = 0; i < 5; i += 1) this.heldLanes[i] = false;
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

  triggerHitVisual({ laneIndex, judgement, colorObj, isChord, isFever, feverActive, multiplierUp, effectiveMultiplier }) {
    if (laneIndex >= 0 && laneIndex < 5) {
      this.laneBeamIntensity[laneIndex] = judgement === 'PERFECT!' ? 1.0 : 0.84;
      this.padPulse[laneIndex] = judgement === 'PERFECT!' ? 1.0 : 0.78;
    }

    const geom = this.getHighwayGeometry();
    const laneCount = this.getGameState().laneCount;
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
      judgement === 'PERFECT!'
        ? '#fde047'
        : judgement === 'EARLY'
          ? '#38bdf8'
          : '#fb923c';

    this.judgementPopup = {
      text: judgement,
      color: labelColor,
      age: 0,
      duration: 0.52,
    };

    if (multiplierUp && effectiveMultiplier >= 2 && !this.bannerPopup) {
      this.bannerPopup = {
        text: `${effectiveMultiplier}× STREAK`,
        color: feverActive ? '#fde047' : '#f8fafc',
        age: 0,
        duration: 0.95,
      };
    }
  }

  triggerSustainSparkVisual(laneIndex, colorObj, feverActive, whammyActive) {
    const geom = this.getHighwayGeometry();
    const laneCount = this.getGameState().laneCount;
    const laneW = geom.bottomWidth / laneCount;
    const hitX = geom.cx - geom.bottomWidth * 0.5 + laneW * (laneIndex + 0.5);
    const c = feverActive || whammyActive
      ? { base: '#facc15', bright: '#ffffff' }
      : colorObj;
    this.spawnBurst(hitX, geom.hitY, c, whammyActive ? 7 : 4, whammyActive);
    this.padPulse[laneIndex] = Math.max(this.padPulse[laneIndex], whammyActive ? 0.9 : 0.65);
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
  recordTimingDeviation(deltaMs, goodWindowMs = 138, judgement = 'PERFECT!') {
    const win = Math.max(60, goodWindowMs);
    // Convention: LEFT = EARLY (-1), CENTER = PERFECT (0), RIGHT = LATE (+1)
    const ratio = Math.max(-1, Math.min(1, -deltaMs / win));
    const color =
      judgement === 'PERFECT!'
        ? '#fde047'
        : deltaMs > 0
          ? '#38bdf8'
          : '#fb923c';

    this.timingTicks.push({ ratio, color, age: 0, maxAge: 1.8 });
    if (this.timingTicks.length > 10) {
      this.timingTicks.shift();
    }
    this.avgTimingRatio = this.avgTimingRatio * 0.72 + ratio * 0.28;
    this.timingMeterAlpha = 1.0;
  }

  triggerFeverBanner() {
    this.pyroEmitterTimer = Math.max(this.pyroEmitterTimer, 1.35);
    this.pyroEmitterStrength = Math.max(this.pyroEmitterStrength, 1.35);
    this.bannerPopup = {
      text: 'FEVER MODE · 2× MULTIPLIER',
      color: '#fde047',
      age: 0,
      duration: 1.35,
    };
    this.shakeAmount = Math.max(this.shakeAmount, 7.5);
  }

  triggerMissVisual(brokeStreak = false) {
    this.judgementPopup = {
      text: 'MISS',
      color: '#fb7185',
      age: 0,
      duration: 0.52,
    };
    if (brokeStreak) {
      this.shakeAmount = Math.max(this.shakeAmount, 5.2);
    }
  }

  triggerHazardDetonateVisual(laneIndex) {
    const geom = this.getHighwayGeometry();
    const laneCount = this.getGameState().laneCount;
    const laneW = geom.bottomWidth / laneCount;
    const hitX = geom.cx - geom.bottomWidth * 0.5 + laneW * (laneIndex + 0.5);

    this.padPulse[laneIndex] = 1.0;
    this.shakeAmount = Math.max(this.shakeAmount, 10.5);
    this.spawnStereoRipple(hitX, geom.hitY, '#ef4444', true, true);
    this.spawnBurst(hitX, geom.hitY, { base: '#ef4444', bright: '#fde047' }, 24, true);

    this.judgementPopup = {
      text: 'PANGGULO HIT!',
      color: '#ef4444',
      age: 0,
      duration: 0.72,
    };
  }

  triggerHazardDodgedVisual(laneIndex) {
    const geom = this.getHighwayGeometry();
    const laneCount = this.getGameState().laneCount;
    const laneW = geom.bottomWidth / laneCount;
    const hitX = geom.cx - geom.bottomWidth * 0.5 + laneW * (laneIndex + 0.5);

    this.spawnBurst(hitX, geom.hitY, { base: '#22c55e', bright: '#bbf7d0' }, 8, false);
    this.judgementPopup = {
      text: 'DODGED!',
      color: '#4ade80',
      age: 0,
      duration: 0.44,
    };
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
    this.laneBeamIntensity.fill(0);
    this.padPulse.fill(0);
    this.shakeAmount = 0;
    this.whammyVisualAmount = 0;
    this.pyroEmitterTimer = 0;
    this.judgementPopup = null;
    this.bannerPopup = null;
    this.timingTicks = [];
    this.avgTimingRatio = 0;
    this.timingMeterAlpha = 0;
    for (let i = 0; i < this.particles.length; i += 1) this.particles[i].active = false;
    for (let i = 0; i < this.pyroParticles.length; i += 1) this.pyroParticles[i].active = false;
    for (let i = 0; i < this.ripples.length; i += 1) this.ripples[i].active = false;
  }

  updateEffects(dt) {
    for (let i = 0; i < 5; i += 1) {
      const target = this.heldLanes[i] ? 0.56 : 0;
      if (this.laneBeamIntensity[i] > target) {
        this.laneBeamIntensity[i] = Math.max(target, this.laneBeamIntensity[i] - dt * 4.4);
      }
      if (this.padPulse[i] > 0) {
        this.padPulse[i] = Math.max(0, this.padPulse[i] - dt * 5.0);
      }
    }

    if (this.shakeAmount > 0.05) {
      this.shakeAmount *= Math.pow(0.0015, dt);
    } else {
      this.shakeAmount = 0;
    }

    if (this.judgementPopup) {
      this.judgementPopup.age += dt;
      if (this.judgementPopup.age >= this.judgementPopup.duration) {
        this.judgementPopup = null;
      }
    }

    if (this.bannerPopup) {
      this.bannerPopup.age += dt;
      if (this.bannerPopup.age >= this.bannerPopup.duration) {
        this.bannerPopup = null;
      }
    }

    // Age timing meter deviation ticks
    for (let i = this.timingTicks.length - 1; i >= 0; i -= 1) {
      this.timingTicks[i].age += dt;
      if (this.timingTicks[i].age >= this.timingTicks[i].maxAge) {
        this.timingTicks.splice(i, 1);
      }
    }
    if (this.timingTicks.length === 0) {
      this.timingMeterAlpha = Math.max(0.32, this.timingMeterAlpha - dt * 0.45);
    }

    // Active stage pyro cannons
    if (this.pyroEmitterTimer > 0) {
      this.pyroEmitterTimer = Math.max(0, this.pyroEmitterTimer - dt);
      const geom = this.getHighwayGeometry();
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

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    const state = this.getGameState();
    const laneConfig = state.getLaneConfig();
    const instConfig = state.getInstrumentConfig();
    const notes = this.getNotes();
    const beatGrid = this.getBeatGrid();
    const songTime = this.getEffectiveTime();
    const telemetry = this.getAudioTelemetry();
    const geom = this.getHighwayGeometry();

    const accentHex = state.feverActive ? '#facc15' : instConfig.accent;
    const highwaySkin = getHighwaySkinById(state.highwaySkinId);

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
      this.drawHorizonSpectrum(ctx, geom, telemetry.spectrum, accentHex, state.stemDropped);
      this.drawHighwayDeck(
        ctx,
        geom,
        laneConfig.count,
        accentHex,
        state.feverActive,
        telemetry.bassEnergy,
        highwaySkin
      );
      this.drawLaneFlashBeams(ctx, geom, laneConfig, state.feverActive);
      this.drawBeatGrid(ctx, geom, beatGrid, songTime, highwaySkin);
      this.drawLaneRails(
        ctx,
        geom,
        laneConfig.count,
        accentHex,
        state.feverActive,
        state.stereoWidthTier,
        highwaySkin
      );
      this.drawHitZoneReceptors(ctx, geom, laneConfig, state.feverActive);
      this.drawTimingDeviationBar(ctx, geom, accentHex);
      this.drawStereoRipples(ctx);
      this.drawNotes(ctx, geom, laneConfig, notes, songTime, state.feverActive);
      this.drawParticles(ctx);
      this.drawLeadInCue(ctx, geom, songTime, accentHex);
      this.drawCallouts(ctx, geom);
      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * Compact horizontal Hit-Window Timing Deviation Bar directly below the hit-line
   * showing EARLY (left) / PERFECT (center) / LATE (right) ticks + rolling average needle.
   */
  drawTimingDeviationBar(ctx, geom, accentHex) {
    const barW = Math.min(240, geom.bottomWidth * 0.44);
    const halfW = barW * 0.5;
    const x0 = geom.cx - halfW;
    const y = geom.hitY + 42;
    const perfectHalfW = barW * 0.2;

    ctx.save();
    ctx.globalAlpha = Math.max(0.42, this.timingMeterAlpha);

    // Subtle track capsule
    ctx.fillStyle = 'rgba(8, 12, 22, 0.72)';
    this.roundRect(ctx, x0, y - 4, barW, 8, 4);
    ctx.fill();

    // Center PERFECT zone tint
    ctx.fillStyle = 'rgba(250, 204, 21, 0.24)';
    ctx.fillRect(geom.cx - perfectHalfW, y - 3, perfectHalfW * 2, 6);

    // Center ideal zero-ms notch
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(geom.cx - 1, y - 6, 2, 12);

    // Recent fading hit tick marks
    for (let i = 0; i < this.timingTicks.length; i += 1) {
      const tk = this.timingTicks[i];
      const fade = Math.max(0, 1 - tk.age / tk.maxAge);
      const tx = geom.cx + tk.ratio * (halfW - 4);
      ctx.fillStyle = hexToRgba(tk.color, 0.25 + fade * 0.75);
      ctx.fillRect(tx - 1.5, y - 5, 3, 10);
    }

    // Rolling average timing needle
    if (this.timingTicks.length > 0) {
      const avgX = geom.cx + this.avgTimingRatio * (halfW - 4);
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

  drawLaneFlashBeams(ctx, geom, laneConfig, feverActive) {
    const laneCount = laneConfig.count;
    const topLeft = geom.cx - geom.topWidth * 0.5;
    const hitLeft = geom.cx - geom.bottomWidth * 0.5;

    for (let i = 0; i < laneCount; i += 1) {
      const intensity = this.laneBeamIntensity[i];
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

  drawBeatGrid(ctx, geom, beatGrid, songTime, highwaySkin) {
    if (!beatGrid) return;
    const skinId = highwaySkin?.id || 'smoked-glass';

    for (let i = 0; i < beatGrid.length; i += 1) {
      const b = beatGrid[i];
      if (b.time < songTime - 0.08) continue;
      if (b.time > songTime + geom.windowSec) break;

      const proj = this.projectAudioTime(b.time, songTime, geom);
      if (!proj.visible || proj.progress <= 0.02 || proj.progress > 1.05) continue;

      const halfW = proj.width * 0.5;
      const fadeIn = Math.min(1, proj.progress * 3.5);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(geom.cx - halfW, proj.y);
      ctx.lineTo(geom.cx + halfW, proj.y);
      ctx.lineWidth = b.isMeasure ? Math.max(1.2, 2.5 * proj.scale) : Math.max(0.7, 1.1 * proj.scale);

      if (skinId === 'rosewood-classic') {
        // Metallic nickel-silver guitar fret wire
        ctx.strokeStyle = b.isMeasure
          ? `rgba(226, 214, 192, ${0.42 * fadeIn})`
          : `rgba(180, 165, 142, ${0.22 * fadeIn})`;
      } else if (skinId === 'royal-gold') {
        ctx.strokeStyle = b.isMeasure
          ? `rgba(251, 191, 36, ${0.38 * fadeIn})`
          : `rgba(254, 243, 199, ${0.14 * fadeIn})`;
      } else if (skinId === 'cyber-synth') {
        ctx.strokeStyle = b.isMeasure
          ? `rgba(34, 211, 238, ${0.38 * fadeIn})`
          : `rgba(232, 121, 249, ${0.16 * fadeIn})`;
      } else if (skinId === 'inferno-flames') {
        ctx.strokeStyle = b.isMeasure
          ? `rgba(251, 146, 60, ${0.36 * fadeIn})`
          : `rgba(254, 215, 170, ${0.12 * fadeIn})`;
      } else {
        ctx.strokeStyle = b.isMeasure
          ? `rgba(248, 250, 252, ${0.24 * fadeIn})`
          : `rgba(148, 163, 184, ${0.1 * fadeIn})`;
      }
      ctx.stroke();

      // Fretboard inlays on measure lines for Rosewood Classic (mother-of-pearl trapezoid) & Royal Gold (diamond)
      if (b.isMeasure && skinId === 'rosewood-classic') {
        const inlayW = Math.max(10, proj.width * 0.24);
        const inlayH = Math.max(3, 9 * proj.scale);
        ctx.fillStyle = `rgba(241, 245, 249, ${0.22 * fadeIn})`;
        ctx.beginPath();
        ctx.moveTo(geom.cx - inlayW * 0.42, proj.y - inlayH * 0.5);
        ctx.lineTo(geom.cx + inlayW * 0.42, proj.y - inlayH * 0.5);
        ctx.lineTo(geom.cx + inlayW * 0.5, proj.y + inlayH * 0.5);
        ctx.lineTo(geom.cx - inlayW * 0.5, proj.y + inlayH * 0.5);
        ctx.closePath();
        ctx.fill();
      } else if (b.isMeasure && skinId === 'royal-gold') {
        const dSize = Math.max(3, 7 * proj.scale);
        ctx.fillStyle = `rgba(251, 191, 36, ${0.36 * fadeIn})`;
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

  drawHitZoneReceptors(ctx, geom, laneConfig, feverActive) {
    const laneCount = laneConfig.count;
    const hitY = geom.hitY;
    const hitW = geom.bottomWidth;
    const hitLeft = geom.cx - hitW * 0.5;
    const laneW = hitW / laneCount;

    ctx.save();
    ctx.fillStyle = feverActive ? 'rgba(250, 204, 21, 0.28)' : 'rgba(248, 250, 252, 0.14)';
    ctx.fillRect(hitLeft - 6, hitY - 2, hitW + 12, 4);

    for (let i = 0; i < laneCount; i += 1) {
      const baseColor = feverActive ? { base: '#facc15', bright: '#fef9c3' } : laneConfig.colors[i];
      const held = this.heldLanes[i];
      const pulse = this.padPulse[i];

      const padMargin = laneW * 0.085;
      const padX = hitLeft + i * laneW + padMargin;
      const padW = laneW - padMargin * 2;
      const padH = 22;
      const padY = hitY - padH * 0.5 + (held ? 3 : 0);

      if (held || pulse > 0.02) {
        ctx.save();
        ctx.shadowColor = baseColor.base;
        ctx.shadowBlur = 18 + pulse * 20;
        ctx.fillStyle = hexToRgba(baseColor.base, 0.34 + pulse * 0.44);
        this.roundRect(ctx, padX - 2, padY - 2, padW + 4, padH + 4, 6);
        ctx.fill();
        ctx.restore();
      }

      ctx.fillStyle = held ? hexToRgba(baseColor.base, 0.78) : 'rgba(14, 18, 28, 0.9)';
      this.roundRect(ctx, padX, padY, padW, padH, 5);
      ctx.fill();

      ctx.lineWidth = held || pulse > 0.1 ? 2.6 : 2;
      ctx.strokeStyle = held || pulse > 0.1 ? baseColor.bright : baseColor.base;
      this.roundRect(ctx, padX, padY, padW, padH, 5);
      ctx.stroke();

      ctx.fillStyle = held || pulse > 0.2 ? '#ffffff' : hexToRgba(baseColor.bright, 0.5);
      ctx.fillRect(padX + padW * 0.2, padY + padH * 0.44, padW * 0.6, 2.5);

      ctx.font = '700 13px "Oswald", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = held ? '#ffffff' : 'rgba(226, 232, 240, 0.76)';
      ctx.fillText(laneConfig.keys[i], padX + padW * 0.5, padY + padH + 6);
    }
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

  drawNotes(ctx, geom, laneConfig, notes, songTime, feverActive) {
    const laneCount = laneConfig.count;

    // 1. Draw Smart Non-Overlapping Hold / Sustain Ribbons (with live Whammy sine vibrato!)
    for (let i = 0; i < notes.length; i += 1) {
      const note = notes[i];
      if (note.sustainDuration <= 0 || note.holdCompleted) continue;
      if (note.hit && !note.holding) continue;

      const tailTime = note.hitTimeSec + note.sustainDuration;
      if (tailTime < songTime - 0.1 || note.hitTimeSec > songTime + geom.windowSec) continue;

      const headTime = note.holding ? Math.max(note.hitTimeSec, songTime) : note.hitTimeSec;
      const clampedTailTime = Math.min(tailTime, songTime + geom.windowSec);

      const isGolden = note.isFever || feverActive;
      const color = isGolden
        ? { base: '#facc15', bright: '#fef9c3' }
        : laneConfig.colors[note.lane];

      const isWhammyBending = note.holding && this.whammyVisualAmount > 0.05;
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
          const amp = laneW * 0.19 * this.whammyVisualAmount * Math.sin(frac * Math.PI);
          cx += Math.sin(this.animClock * 36 - frac * 14) * amp;
        }
        const half = laneW * (isWhammyBending ? 0.2 : 0.16);
        leftPts.push([cx - half, proj.y]);
        rightPts.push([cx + half, proj.y]);
        centerPts.push([cx, proj.y]);
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

    // 2. Chord connector bars
    for (let i = 0; i < notes.length - 1; i += 1) {
      const a = notes[i];
      const b = notes[i + 1];
      if (!a.isChord || !b.isChord || a.hit || b.hit || Math.abs(a.hitTimeSec - b.hitTimeSec) > 0.008) {
        continue;
      }
      const proj = this.projectAudioTime(a.hitTimeSec, songTime, geom);
      if (!proj.visible || proj.progress <= 0.02 || proj.progress > 1.08) continue;

      const laneW = proj.width / laneCount;
      const left = geom.cx - proj.width * 0.5;
      const x1 = left + (a.lane + 0.5) * laneW;
      const x2 = left + (b.lane + 0.5) * laneW;

      ctx.save();
      ctx.strokeStyle = a.isFever || feverActive
        ? `rgba(254, 240, 138, ${Math.min(0.95, proj.progress * 2.4)})`
        : `rgba(226, 232, 240, ${Math.min(0.72, proj.progress * 2.2)})`;
      ctx.lineWidth = Math.max(1.5, 4 * proj.scale);
      ctx.beginPath();
      ctx.moveTo(x1, proj.y);
      ctx.lineTo(x2, proj.y);
      ctx.stroke();
      ctx.restore();
    }

    // 3. Draw note heads + unmistakable "Panggulo" Hazard Bomb notes locked directly to hitTimeSec
    for (let i = 0; i < notes.length; i += 1) {
      const note = notes[i];
      if (note.hit || note.dodged) continue;

      const timeRemaining = note.hitTimeSec - songTime;
      if (timeRemaining > geom.windowSec) break;
      if (timeRemaining < -PAST_GRACE_SEC) continue;

      const proj = this.projectAudioTime(note.hitTimeSec, songTime, geom);
      if (!proj.visible || proj.progress <= 0.01 || proj.progress > 1.12) continue;

      const laneW = proj.width / laneCount;
      const leftEdge = geom.cx - proj.width * 0.5;
      const margin = laneW * 0.085;
      const noteW = Math.max(8, laneW - margin * 2);
      const noteH = Math.max(5, 22 * proj.scale);
      const noteX = leftEdge + note.lane * laneW + margin;
      const noteY = proj.y - noteH * 0.5;

      const fadeIn = Math.min(1, proj.progress * 4.4);
      const fadeOut = proj.progress > 1.02 ? Math.max(0, 1 - (proj.progress - 1.02) * 10) : 1;
      const alpha = (note.missed ? 0.25 : 1) * fadeIn * fadeOut;

      // Distinct "Panggulo" Hazard Bomb Gem (DO NOT HIT!)
      if (note.isHazard) {
        const cx = noteX + noteW * 0.5;
        const cy = proj.y;
        const rx = Math.max(9, noteW * 0.38);
        const ry = Math.max(7, noteH * 0.72);
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
      const color = isGolden
        ? { base: '#f59e0b', bright: '#fef08a' }
        : laneConfig.colors[note.lane];

      ctx.save();
      ctx.globalAlpha = alpha;

      if (!note.missed) {
        ctx.shadowColor = isGolden ? '#facc15' : color.base;
        ctx.shadowBlur = Math.max(5, (isGolden ? 24 : 15) * proj.scale);
      }

      const barGrad = ctx.createLinearGradient(noteX, noteY, noteX, noteY + noteH);
      barGrad.addColorStop(0, color.bright);
      barGrad.addColorStop(0.35, color.base);
      barGrad.addColorStop(1, isGolden ? '#b45309' : hexToRgba(color.base, 0.85));
      ctx.fillStyle = barGrad;

      const radius = Math.max(2, 4.5 * proj.scale);
      this.roundRect(ctx, noteX, noteY, noteW, noteH, radius);
      ctx.fill();

      ctx.shadowBlur = 0;
      if (isGolden) {
        ctx.lineWidth = Math.max(1, 2 * proj.scale);
        ctx.strokeStyle = '#fef9c3';
        this.roundRect(ctx, noteX, noteY, noteW, noteH, radius);
        ctx.stroke();
      }

      const coreH = Math.max(1.5, noteH * 0.28);
      ctx.fillStyle = isGolden ? '#ffffff' : 'rgba(255, 255, 255, 0.92)';
      this.roundRect(
        ctx,
        noteX + noteW * 0.1,
        noteY + noteH * 0.2,
        noteW * 0.8,
        coreH,
        radius * 0.5
      );
      ctx.fill();

      ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
      ctx.fillRect(
        noteX + 2,
        noteY + noteH - Math.max(2, 3 * proj.scale),
        noteW - 4,
        Math.max(1.5, 2.5 * proj.scale)
      );

      ctx.restore();
    }
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

  drawCallouts(ctx, geom) {
    if (this.judgementPopup) {
      const j = this.judgementPopup;
      const p = j.age / j.duration;
      const scale = p < 0.15 ? 0.82 + (p / 0.15) * 0.3 : 1.12 - ((p - 0.15) / 0.85) * 0.14;
      const alpha = p < 0.65 ? 1 : Math.max(0, 1 - (p - 0.65) / 0.35);
      const lift = p * 28;

      ctx.save();
      ctx.translate(geom.cx, geom.hitY - 62 - lift);
      ctx.scale(scale, scale);
      ctx.globalAlpha = alpha;
      ctx.font = '700 30px "Oswald", sans-serif';
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
    if (this.bannerPopup) {
      const b = this.bannerPopup;
      const p = b.age / b.duration;
      const alpha = p < 0.14 ? p / 0.14 : p < 0.74 ? 1 : Math.max(0, 1 - (p - 0.74) / 0.26);
      const scale = p < 0.14 ? 0.9 + (p / 0.14) * 0.12 : 1.02 - ((p - 0.14) / 0.86) * 0.04;
      const bannerY = Math.max(30, geom.topY - 26);

      ctx.save();
      ctx.translate(geom.cx, bannerY);
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

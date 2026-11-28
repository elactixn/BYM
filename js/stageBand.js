/**
 * stageBand.js
 * Three.js 3D Roblox-Style Performing Concert Band, Upgraded Arena Stage,
 * Full-Bodied 3D Crowd (InstancedMesh), Rotating 3D Orbital Camera Rig,
 * 10 Real-World Venues, and Extravagant Encore Pyrotechnics:
 *  - Renders behind the translucent smoked-glass rhythm highway (z-index: 1).
 *  - True 3D orbital concert camera (`cameraRig`) smoothly sweeping -55°..+55°
 *    across the front, orbiting the active musician during solos, and swinging
 *    behind the band (reverse crowd-view angle) during 30x+ combos, Fever, or Final Encore.
 *  - Upgraded concert stage: elevated LED drum riser, glowing floor wedge monitors,
 *    left/right curved hanging line-array speaker stacks, geometric box-truss rig
 *    with moving volumetric spotlights, animated live LED backdrop screen, and pyro nozzles.
 *  - 144 full-bodied blocky 3D Roblox-style fans (InstancedMesh) with colorful shirts,
 *    heads, jumping legs, raised waving arms, and glowing lightsticks synced to BPM.
 *  - Deep instrument-matched band animations driven by real note attacks (`notifyNoteEvent`)
 *    plus live Web Audio frequency telemetry.
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildVenueEnvironment, getStageOverlayById } from './venues.js';
import {
  getBandLineupById,
  buildCustomGuitarMesh,
  buildCustomBassMesh,
  buildCustomDrumKitMesh,
  buildCustomKeyboardMesh,
  getStarLookById,
  createAmpGrilleSkinTexture,
  createPerforatedSteelMaps,
} from './bandGearCatalog.js';
import { CameraDirector } from './cameraDirector.js';
import { LightingProfileController } from './lightingProfiles.js';

const THEME_COLORS = {
  guitar: 0x06b6d4,
  bass: 0x8b5cf6,
  drums: 0xf59e0b,
  piano: 0xec4899,
  fever: 0xfacc15,
  encore: 0xfbbf24,
  miss: 0xff1e42,
};

const FIREWORK_PALETTES = [
  // 0: 24k Sodium Gold & Brocade Amber
  [0xfef08a, 0xfacc15, 0xd97706],
  // 1: Electric Magenta -> Deep Violet Chrysanthemum
  [0xf472b6, 0xd946ef, 0x6d28d9],
  // 2: Copper Electric Azure & Ice Cyan
  [0xe0f2fe, 0x38bdf8, 0x0284c7],
  // 3: Strontium Crimson -> Rose Gold
  [0xfda4af, 0xf43f5e, 0xbe123c],
  // 4: Barium Emerald & Mint Spark
  [0xdcfce7, 0x4ade80, 0x059669],
  // 5: Neon Cyber Gold & Cyan
  [0xfef08a, 0x22d3ee, 0x818cf8],
  // 6: Patriot / Stadium R-W-B Pearl
  [0xff3355, 0xf8fafc, 0x38bdf8],
  // 7: Royal Ultraviolet & Champagne Silver
  [0xf5d0fe, 0xa855f7, 0x38bdf8],
];

/**
 * Procedural 128x64 velocity-aligned glowing firework streak texture (zero external image assets).
 * Head sits near u = 0.84 with an incandescent core; plasma trail tapers smoothly back to u = 0.04.
 */
function createFireworkStreakTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 128, 64);

  // Horizontal tapering luminous plasma body
  const tailGrad = ctx.createLinearGradient(4, 32, 118, 32);
  tailGrad.addColorStop(0.0, 'rgba(255,255,255,0.0)');
  tailGrad.addColorStop(0.22, 'rgba(255,255,255,0.22)');
  tailGrad.addColorStop(0.62, 'rgba(255,255,255,0.72)');
  tailGrad.addColorStop(0.84, 'rgba(255,255,255,1.0)');
  tailGrad.addColorStop(1.0, 'rgba(255,255,255,0.0)');

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(4, 32);
  ctx.quadraticCurveTo(64, 16, 108, 22);
  ctx.quadraticCurveTo(122, 26, 122, 32);
  ctx.quadraticCurveTo(122, 38, 108, 42);
  ctx.quadraticCurveTo(64, 48, 4, 32);
  ctx.closePath();
  ctx.fillStyle = tailGrad;
  ctx.fill();
  ctx.restore();

  // Soft vertical radial glow around the bright streak spine
  const spineGrad = ctx.createRadialGradient(104, 32, 1.5, 96, 32, 28);
  spineGrad.addColorStop(0.0, 'rgba(255,255,255,1.0)');
  spineGrad.addColorStop(0.32, 'rgba(255,255,255,0.85)');
  spineGrad.addColorStop(0.65, 'rgba(255,255,255,0.25)');
  spineGrad.addColorStop(1.0, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = spineGrad;
  ctx.fillRect(0, 0, 128, 64);

  // Tight white-hot center filament along streak axis
  const coreGrad = ctx.createLinearGradient(18, 32, 114, 32);
  coreGrad.addColorStop(0.0, 'rgba(255,255,255,0.0)');
  coreGrad.addColorStop(0.55, 'rgba(255,255,255,0.55)');
  coreGrad.addColorStop(0.86, 'rgba(255,255,255,1.0)');
  coreGrad.addColorStop(1.0, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = coreGrad;
  ctx.fillRect(18, 28, 96, 8);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Procedural 128x128 incandescent star-core sprite with subtle 4-point optical diffraction spikes & radial bloom.
 */
function createFireworkStarCoreTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);

  const cx = 64;
  const cy = 64;

  // Outer radial bloom halo
  const halo = ctx.createRadialGradient(cx, cy, 2, cx, cy, 62);
  halo.addColorStop(0.0, 'rgba(255,255,255,1.0)');
  halo.addColorStop(0.16, 'rgba(255,255,255,0.94)');
  halo.addColorStop(0.36, 'rgba(255,255,255,0.44)');
  halo.addColorStop(0.68, 'rgba(255,255,255,0.12)');
  halo.addColorStop(1.0, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, 128, 128);

  // Crisp 4-point optical diffraction flare spikes
  const drawSpike = (angle, len, halfWidth, alpha) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    const g = ctx.createLinearGradient(-len, 0, len, 0);
    g.addColorStop(0.0, 'rgba(255,255,255,0.0)');
    g.addColorStop(0.38, `rgba(255,255,255,${alpha * 0.45})`);
    g.addColorStop(0.5, `rgba(255,255,255,${alpha})`);
    g.addColorStop(0.62, `rgba(255,255,255,${alpha * 0.45})`);
    g.addColorStop(1.0, 'rgba(255,255,255,0.0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-len, 0);
    ctx.quadraticCurveTo(0, -halfWidth, len, 0);
    ctx.quadraticCurveTo(0, halfWidth, -len, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
  drawSpike(0, 60, 4.5, 0.9);
  drawSpike(Math.PI * 0.5, 60, 4.5, 0.9);
  drawSpike(Math.PI * 0.25, 34, 2.8, 0.42);
  drawSpike(-Math.PI * 0.25, 34, 2.8, 0.42);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Procedural 128x128 soft multi-lobe volumetric smoke cloud puff texture (zero hard edges).
 */
function createFireworkSmokeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);

  const lobes = [
    [64, 64, 48, 0.46],
    [48, 56, 34, 0.34],
    [80, 58, 32, 0.32],
    [58, 78, 35, 0.3],
    [74, 46, 28, 0.26],
    [42, 72, 26, 0.22],
  ];
  for (let i = 0; i < lobes.length; i += 1) {
    const [lx, ly, lr, la] = lobes[i];
    const g = ctx.createRadialGradient(lx, ly, 2, lx, ly, lr);
    g.addColorStop(0.0, `rgba(255,255,255,${la})`);
    g.addColorStop(0.45, `rgba(240,244,255,${la * 0.55})`);
    g.addColorStop(0.8, `rgba(210,220,238,${la * 0.14})`);
    g.addColorStop(1.0, 'rgba(200,210,230,0.0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

const FW_STREAK_VERTEX_SHADER = /* glsl */ `
  attribute vec3 aPos;
  attribute vec3 aVel;
  attribute vec3 aColor;
  attribute vec4 aMeta; // x: size, y: alpha, z: stretchFactor, w: spriteMode (0=streak, 1=star, 2=crackle, 3=halo)

  uniform float uAspect;
  uniform float uProjScale;

  varying vec2 vUv;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vMode;

  void main() {
    vUv = uv;
    vColor = aColor;
    vAlpha = aMeta.y;
    vMode = aMeta.w;

    if (aMeta.x <= 0.001 || aMeta.y <= 0.002) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }

    vec4 mvCur = modelViewMatrix * vec4(aPos, 1.0);
    if (mvCur.z > -0.35) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }

    vec4 clipCur = projectionMatrix * mvCur;
    vec2 ndcCur = clipCur.xy / max(0.0001, clipCur.w);

    // Project velocity vector into aspect-corrected screen space for razor-sharp velocity streaks
    vec4 mvNext = modelViewMatrix * vec4(aPos + aVel * 0.055, 1.0);
    mvNext.z = min(mvNext.z, -0.25);
    vec4 clipNext = projectionMatrix * mvNext;
    vec2 ndcNext = clipNext.xy / max(0.0001, clipNext.w);

    vec2 velScreen = (ndcNext - ndcCur) * vec2(uAspect, 1.0);
    float velLen = length(velScreen);

    vec2 dir = vec2(1.0, 0.0);
    vec2 perp = vec2(0.0, 1.0);
    float streakLen = 0.0;

    float baseNdc = (aMeta.x * uProjScale) / max(1.6, -mvCur.z);
    if (velLen > 0.0004 && aMeta.z > 0.01) {
      dir = velScreen / velLen;
      perp = vec2(-dir.y, dir.x);
      streakLen = clamp(velLen * aMeta.z * 2.8, 0.0, baseNdc * 18.0);
    }

    // Anchor leading head near aPos (+0.5) and stretch luminous tail behind along -dir (-0.5)
    float headExt = baseNdc * 0.56;
    float tailExt = baseNdc * 0.56 + streakLen;
    float along = position.x > 0.0 ? headExt : -tailExt;
    float widthScale = aMeta.w < 0.5 ? 0.84 : 1.0;
    float across = position.y * baseNdc * widthScale;

    vec2 offsetNdc = dir * along + perp * across;
    offsetNdc.x /= max(0.25, uAspect);

    clipCur.xy += offsetNdc * clipCur.w;
    gl_Position = clipCur;
  }
`;

const FW_STREAK_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uStreakTex;
  uniform sampler2D uStarTex;

  varying vec2 vUv;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vMode;

  void main() {
    float mask = 0.0;
    float coreHeat = 0.0;

    if (vMode < 0.5) {
      vec4 tex = texture2D(uStreakTex, vUv);
      mask = tex.a;
      coreHeat = pow(clamp(tex.a, 0.0, 1.0), 2.8) * 0.72;
    } else if (vMode < 2.5) {
      vec4 tex = texture2D(uStarTex, vUv);
      mask = tex.a;
      float boost = vMode > 1.5 ? 1.15 : 0.78;
      coreHeat = pow(clamp(tex.a, 0.0, 1.0), 2.3) * boost;
    } else {
      // Volumetric soft radial bloom halo around shell detonations / Roman pearls
      float d = length(vUv - vec2(0.5)) * 2.0;
      mask = pow(max(0.0, 1.0 - d), 2.2);
      coreHeat = pow(max(0.0, 1.0 - d), 4.0) * 0.55;
    }

    float a = mask * vAlpha;
    if (a < 0.004) discard;

    // Incandescent white-hot center core + saturated HDR chemical color halo for ACESFilmicToneMapping
    vec3 col = vColor * mask + vec3(1.0, 0.98, 0.92) * coreHeat;
    gl_FragColor = vec4(col * vAlpha, a);
  }
`;

const FW_SMOKE_VERTEX_SHADER = /* glsl */ `
  attribute vec3 aPos;
  attribute vec4 aMeta; // x: size, y: alpha, z: rotRad, w: baseGrey

  uniform float uAspect;
  uniform float uProjScale;
  uniform vec3 uFlashPos[6];
  uniform vec3 uFlashCol[6];

  varying vec2 vUv;
  varying vec3 vLitColor;
  varying float vAlpha;

  void main() {
    vUv = uv;
    vAlpha = aMeta.y;

    if (aMeta.x <= 0.01 || aMeta.y <= 0.002) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }

    vec4 mvCur = modelViewMatrix * vec4(aPos, 1.0);
    if (mvCur.z > -1.0) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }

    // Dynamic proximity illumination: smoke clouds catch colored light of neighboring firework explosions!
    vec3 lit = vec3(aMeta.w * 0.24, aMeta.w * 0.27, aMeta.w * 0.36);
    for (int i = 0; i < 6; i++) {
      vec3 diff = aPos - uFlashPos[i];
      float d2 = dot(diff, diff);
      float atten = 1.0 / (1.0 + d2 * 0.0018);
      lit += uFlashCol[i] * atten * 0.95;
    }
    vLitColor = min(lit, vec3(2.2));

    float c = cos(aMeta.z);
    float s = sin(aMeta.z);
    vec2 rotPos = vec2(position.x * c - position.y * s, position.x * s + position.y * c);

    float ndcSize = (aMeta.x * uProjScale) / max(2.2, -mvCur.z);
    vec4 clipCur = projectionMatrix * mvCur;
    vec2 offsetNdc = rotPos * ndcSize;
    offsetNdc.x /= max(0.25, uAspect);
    clipCur.xy += offsetNdc * clipCur.w;
    gl_Position = clipCur;
  }
`;

const FW_SMOKE_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uSmokeTex;

  varying vec2 vUv;
  varying vec3 vLitColor;
  varying float vAlpha;

  void main() {
    vec4 tex = texture2D(uSmokeTex, vUv);
    float a = tex.a * vAlpha;
    if (a < 0.003) discard;
    gl_FragColor = vec4(vLitColor, a);
  }
`;

const CONFETTI_COLORS = [0xfacc15, 0x38bdf8, 0xf43f5e, 0xc084fc, 0x4ade80, 0xf8fafc, 0xfb923c];

const CROWD_SHIRT_COLORS = [
  0x1d4ed8, 0x0891b2, 0x7c3aed, 0xbe123c, 0xd97706, 0x059669, 0x334155, 0xec4899, 0x2563eb, 0xf97316,
  0x14b8a6, 0xe11d48,
];

const CROWD_PANTS_COLORS = [0x0f172a, 0x1e293b, 0x1f2937, 0x172554, 0x27272a, 0x312e81];

const STAGE_DECK_TOP_Y = 0;
const DRUM_RISER_TOP_Y = 0.65;
const KEYS_RISER_TOP_Y = 0.45;

function setHierarchyFrustumCulled(root, culled = false) {
  if (!root) return;
  root.frustumCulled = culled;
  root.traverse((obj) => {
    obj.frustumCulled = culled;
  });
}
const CROWD_HAIR_COLORS = [0x111827, 0x27272a, 0x451a03, 0x78350f, 0x0f172a, 0x3f3f46, 0x1e1b4b];
const CROWD_CAP_COLORS = [0xef4444, 0x0284c7, 0xf59e0b, 0x111827, 0x7c3aed, 0x10b981, 0xf43f5e];
const CROWD_SKIN_TONES = [0xf4c79a, 0xe8b587, 0xd69e72, 0xf9d8b8, 0xc68b59, 0xf0be91];
const CROWD_STICK_COLORS = [0x38bdf8, 0xf472b6, 0xfacc15, 0xa855f7, 0x34d399, 0xfb923c, 0x22d3ee, 0xfef08a];

/**
 * Builds an authentic beveled/rounded Roblox cylindrical head using LatheGeometry
 * with smooth chamfered top & bottom caps and clean cylindrical UVs for front face decals.
 */
function createRobloxR15HeadGeometry() {
  const pts = [
    new THREE.Vector2(0.001, -0.23),
    new THREE.Vector2(0.15, -0.23),
    new THREE.Vector2(0.215, -0.19),
    new THREE.Vector2(0.235, -0.12),
    new THREE.Vector2(0.235, 0.12),
    new THREE.Vector2(0.215, 0.19),
    new THREE.Vector2(0.15, 0.23),
    new THREE.Vector2(0.001, 0.23),
  ];
  const geo = new THREE.LatheGeometry(pts, 12);
  // Rotate so UV seam is strictly at the back (-Z) and u=0.5 is dead-center front (+Z)
  geo.rotateY(Math.PI);
  return geo;
}

/**
 * Creates a crisp cylindrical wrap texture with a classic excited Roblox smile/eyes
 * centered strictly on the front face (u = 0.5, v = 0.25..0.75) tinted cleanly by instanceColor!
 */
function createCrowdR15FaceTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  // Neutral white base so InstancedMesh.setColorAt(skinTone) tints the whole head accurately
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 256, 128);

  // Subtle shading near top/bottom bevels
  const shade = ctx.createLinearGradient(0, 0, 0, 128);
  shade.addColorStop(0, 'rgba(0, 0, 0, 0.08)');
  shade.addColorStop(0.2, 'rgba(255, 255, 255, 0)');
  shade.addColorStop(0.82, 'rgba(0, 0, 0, 0)');
  shade.addColorStop(1, 'rgba(0, 0, 0, 0.14)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, 256, 128);

  // Front face band centered at x = 128
  // Classic Roblox cheerful eyes
  [112, 144].forEach((ex) => {
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.ellipse(ex, 54, 4.6, 6.2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex - 1.4, 52, 1.6, 0, Math.PI * 2);
    ctx.fill();
  });

  // Classic hyped concert smile
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(111, 74);
  ctx.quadraticCurveTo(128, 90, 145, 74);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Merges simple indexed/non-indexed BoxGeometries into a single BufferGeometry for InstancedMesh headwear.
 */
function mergeSimpleGeometries(geoms) {
  const nonIndexed = geoms.map((g) => (g.index ? g.toNonIndexed() : g));
  let totalVerts = 0;
  for (let i = 0; i < nonIndexed.length; i += 1) {
    totalVerts += nonIndexed[i].attributes.position.count;
  }
  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  let offset = 0;
  for (let i = 0; i < nonIndexed.length; i += 1) {
    const pos = nonIndexed[i].attributes.position.array;
    const norm = nonIndexed[i].attributes.normal.array;
    positions.set(pos, offset);
    normals.set(norm, offset);
    offset += pos.length;
    nonIndexed[i].dispose();
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  return merged;
}

function createSpikyHairGeometry() {
  const base = new THREE.BoxGeometry(0.49, 0.14, 0.49);
  base.translate(0, 0.21, -0.01);
  const s1 = new THREE.BoxGeometry(0.14, 0.16, 0.16);
  s1.rotateZ(0.24);
  s1.translate(-0.14, 0.31, 0.04);
  const s2 = new THREE.BoxGeometry(0.16, 0.18, 0.16);
  s2.translate(0, 0.33, 0.06);
  const s3 = new THREE.BoxGeometry(0.14, 0.16, 0.16);
  s3.rotateZ(-0.24);
  s3.translate(0.14, 0.31, 0.04);
  const back = new THREE.BoxGeometry(0.49, 0.28, 0.12);
  back.translate(0, 0.07, -0.22);
  return mergeSimpleGeometries([base, s1, s2, s3, back]);
}

function createBaseballCapGeometry() {
  const crown = new THREE.BoxGeometry(0.5, 0.17, 0.5);
  crown.translate(0, 0.21, -0.01);
  const brim = new THREE.BoxGeometry(0.46, 0.045, 0.26);
  brim.rotateX(0.12);
  brim.translate(0, 0.14, 0.3);
  return mergeSimpleGeometries([crown, brim]);
}

function createHeadphonesGeometry() {
  const band = new THREE.BoxGeometry(0.56, 0.07, 0.12);
  band.translate(0, 0.27, 0);
  const armL = new THREE.BoxGeometry(0.06, 0.26, 0.1);
  armL.translate(-0.27, 0.15, 0);
  const armR = new THREE.BoxGeometry(0.06, 0.26, 0.1);
  armR.translate(0.27, 0.15, 0);
  const cupL = new THREE.BoxGeometry(0.11, 0.2, 0.2);
  cupL.translate(-0.27, 0.01, 0);
  const cupR = new THREE.BoxGeometry(0.11, 0.2, 0.2);
  cupR.translate(0.27, 0.01, 0);
  return mergeSimpleGeometries([band, armL, armR, cupL, cupR]);
}

function createGlowParticleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.28, 'rgba(255, 255, 240, 0.88)');
  grad.addColorStop(0.62, 'rgba(255, 210, 120, 0.28)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createRobloxFaceTexture({
  skin = '#f4c79a',
  shocked = false,
  expression = null, // 'grin' | 'belt' | 'intense' | 'closed' | 'shocked'
  sunglasses = false,
  sunglassesTint = null,
  smile = 'grin',
  eyeliner = false,
  eyeshadow = null,
  blush = null,
  lipColor = null,
  starMakeup = false,
  mustache = false,
  buckTeeth = false,
  visorLed = false,
  fangs = false,
}) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  const resolvedExpr = shocked || expression === 'shocked' ? 'shocked' : expression || 'grin';
  const isShocked = resolvedExpr === 'shocked';
  const isBelt = resolvedExpr === 'belt';
  const isIntense = resolvedExpr === 'intense';
  const isClosed = resolvedExpr === 'closed';

  ctx.fillStyle = skin;
  ctx.fillRect(0, 0, 256, 256);

  if (visorLed) {
    ctx.fillStyle = '#090d16';
    ctx.fillRect(22, 62, 212, 128);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 6;
    ctx.strokeRect(22, 62, 212, 128);

    const bars = isShocked ? [16, 48, 22, 54, 18, 52, 20, 44]
      : isBelt || isIntense ? [26, 44, 58, 38, 60, 42, 48, 30]
        : [18, 30, 44, 34, 48, 36, 28, 18];
    for (let i = 0; i < bars.length; i += 1) {
      const h = bars[i];
      const bx = 42 + i * 22;
      const by = 126 - h * 0.5;
      ctx.fillStyle = isShocked ? '#ef4444' : i % 2 === 0 ? '#22d3ee' : '#38bdf8';
      ctx.fillRect(bx, by, 14, h);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  const grad = ctx.createRadialGradient(128, 128, 24, 128, 128, 150);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.14)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.1)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  if (blush && !isShocked) {
    ctx.fillStyle = blush;
    ctx.beginPath();
    ctx.ellipse(58, 142, 26, 15, 0, 0, Math.PI * 2);
    ctx.ellipse(198, 142, 26, 15, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  if (starMakeup && !isShocked) {
    ctx.fillStyle = '#fde047';
    [
      [48, 142, 7],
      [208, 142, 7],
      [62, 158, 4.5],
      [194, 158, 4.5],
    ].forEach(([sx, sy, sr]) => {
      ctx.beginPath();
      for (let p = 0; p < 8; p += 1) {
        const ang = (p * Math.PI) / 4;
        const rad = p % 2 === 0 ? sr : sr * 0.42;
        const px = sx + Math.cos(ang) * rad;
        const py = sy + Math.sin(ang) * rad;
        if (p === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    });
  }

  if (isShocked) {
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(54, 72);
    ctx.quadraticCurveTo(84, 52, 108, 68);
    ctx.moveTo(148, 68);
    ctx.quadraticCurveTo(172, 52, 202, 72);
    ctx.stroke();

    [82, 174].forEach((ex) => {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex, 112, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#18181b';
      ctx.stroke();

      ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.arc(ex, 114, 8, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = '#27131a';
    ctx.beginPath();
    ctx.ellipse(128, 184, 24, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#18181b';
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(214, 76);
    ctx.quadraticCurveTo(228, 102, 214, 112);
    ctx.quadraticCurveTo(200, 102, 214, 76);
    ctx.fill();
  } else {
    if (sunglasses) {
      ctx.fillStyle = sunglassesTint || '#0f172a';
      ctx.fillRect(36, 86, 82, 46);
      ctx.fillRect(138, 86, 82, 46);
      ctx.fillRect(114, 100, 28, 12);
      ctx.strokeStyle = sunglassesTint === '#78350f' ? '#facc15' : '#334155';
      ctx.lineWidth = 4;
      ctx.strokeRect(36, 86, 82, 46);
      ctx.strokeRect(138, 86, 82, 46);

      ctx.fillStyle = sunglassesTint === '#78350f' ? 'rgba(250, 204, 21, 0.35)' : 'rgba(192, 132, 252, 0.55)';
      ctx.beginPath();
      ctx.moveTo(44, 92);
      ctx.lineTo(74, 92);
      ctx.lineTo(56, 126);
      ctx.lineTo(44, 126);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(146, 92);
      ctx.lineTo(176, 92);
      ctx.lineTo(158, 126);
      ctx.lineTo(146, 126);
      ctx.closePath();
      ctx.fill();
    } else {
      if (eyeshadow) {
        ctx.fillStyle = eyeshadow;
        ctx.globalAlpha = 0.72;
        [82, 174].forEach((ex) => {
          ctx.beginPath();
          ctx.ellipse(ex, 101, 22, 14, 0, Math.PI, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = 1;
      }

      if (isClosed) {
        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 7;
        ctx.lineCap = 'round';
        [82, 174].forEach((ex) => {
          ctx.beginPath();
          ctx.moveTo(ex - 16, 110);
          ctx.quadraticCurveTo(ex, 123, ex + 16, 110);
          ctx.stroke();
        });
      } else {
        [82, 174].forEach((ex, i) => {
          ctx.fillStyle = '#111827';
          ctx.beginPath();
          if (isBelt) {
            // Expressive squeezed emotion eyes during big vocal/ballad sustain holds
            ctx.ellipse(ex, 111, 14, 11, 0, 0, Math.PI * 2);
          } else {
            ctx.ellipse(ex, 110, 14, isIntense ? 15 : 18, 0, 0, Math.PI * 2);
          }
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(ex - 4, 104, isBelt ? 4 : 5, 0, Math.PI * 2);
          ctx.fill();

          if (eyeliner) {
            ctx.strokeStyle = '#09090b';
            ctx.lineWidth = 5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            const dir = i === 0 ? -1 : 1;
            ctx.moveTo(ex - dir * 14, 101);
            ctx.quadraticCurveTo(ex, 92, ex + dir * 24, 96);
            ctx.stroke();
          }
        });
      }

      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = eyeliner ? 6 : 8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      if (isIntense) {
        // Fierce rock / solo angled eyebrows
        ctx.moveTo(56, 76);
        ctx.lineTo(106, 92);
        ctx.moveTo(200, 76);
        ctx.lineTo(150, 92);
      } else if (isBelt || isClosed) {
        // Expressive empathetic raised inner eyebrows
        ctx.moveTo(56, 86);
        ctx.quadraticCurveTo(82, 72, 106, 78);
        ctx.moveTo(200, 86);
        ctx.quadraticCurveTo(174, 72, 150, 78);
      } else {
        ctx.moveTo(58, 82);
        ctx.lineTo(104, 86);
        ctx.moveTo(198, 82);
        ctx.lineTo(152, 86);
      }
      ctx.stroke();
    }

    if (mustache) {
      ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.moveTo(88, 156);
      ctx.quadraticCurveTo(128, 136, 168, 156);
      ctx.quadraticCurveTo(128, 152, 88, 156);
      ctx.closePath();
      ctx.fill();
    }

    if (isBelt || isClosed) {
      // Wide passionate belt / ballad sustain mouth
      ctx.fillStyle = '#27131a';
      ctx.beginPath();
      ctx.ellipse(128, 178, isClosed ? 22 : 28, isClosed ? 15 : 22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = lipColor || '#18181b';
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(110, 163, 36, 7);
    } else if (isIntense) {
      // Gritted teeth rock solo intensity
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(86, 162, 84, 26, 8) : ctx.rect(86, 162, 84, 26);
      ctx.fill();
      ctx.lineWidth = 7;
      ctx.strokeStyle = '#18181b';
      ctx.stroke();
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(88, 175);
      ctx.lineTo(168, 175);
      ctx.moveTo(114, 163);
      ctx.lineTo(114, 187);
      ctx.moveTo(142, 163);
      ctx.lineTo(142, 187);
      ctx.stroke();
    } else if (lipColor) {
      ctx.fillStyle = lipColor;
      ctx.beginPath();
      ctx.moveTo(92, 174);
      ctx.quadraticCurveTo(114, 162, 128, 168);
      ctx.quadraticCurveTo(142, 162, 164, 174);
      ctx.quadraticCurveTo(128, 198, 92, 174);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillRect(114, 173, 28, 5);
    } else if (smile === 'sing') {
      ctx.fillStyle = '#27131a';
      ctx.beginPath();
      ctx.ellipse(128, 176, 26, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(108, 160, 40, 8);
    } else if (smile === 'cool') {
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(92, 174);
      ctx.quadraticCurveTo(132, 190, 168, 166);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(82, 164);
      ctx.quadraticCurveTo(128, 204, 174, 164);
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 7;
      ctx.strokeStyle = '#18181b';
      ctx.stroke();
    }

    if (buckTeeth && !isBelt) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 3;
      ctx.fillRect(112, 170, 14, 16);
      ctx.strokeRect(112, 170, 14, 16);
      ctx.fillRect(130, 170, 14, 16);
      ctx.strokeRect(130, 170, 14, 16);
    }

    if (fangs) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 2.5;
      [98, 150].forEach((fx) => {
        ctx.beginPath();
        ctx.moveTo(fx - 6, 168);
        ctx.lineTo(fx, 189);
        ctx.lineTo(fx + 6, 168);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      });
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function populateHairGroup(hairGroup, hairStyle, hairColor, accentMat, extras = {}) {
  const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.48, metalness: 0.12 });

  if (hairStyle === 'long-wavy') {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.22, 0.74), hairMat);
    cap.position.set(0, 0.69, -0.02);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.96, 0.24), hairMat);
    back.position.set(0, 0.24, -0.36);
    const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.78, 0.3), hairMat);
    sideL.position.set(-0.36, 0.32, -0.04);
    const sideR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.78, 0.3), hairMat);
    sideR.position.set(0.36, 0.32, -0.04);
    hairGroup.add(cap, back, sideL, sideR);
  } else if (hairStyle === 'big-red-curls') {
    const curlGeo = new THREE.SphereGeometry(0.24, 10, 8);
    const pts = [
      [0, 0.74, -0.04],
      [-0.3, 0.66, -0.08],
      [0.3, 0.66, -0.08],
      [-0.42, 0.42, -0.14],
      [0.42, 0.42, -0.14],
      [-0.38, 0.16, -0.18],
      [0.38, 0.16, -0.18],
      [0, 0.48, -0.36],
      [-0.24, 0.22, -0.38],
      [0.24, 0.22, -0.38],
    ];
    pts.forEach(([x, y, z]) => {
      const puff = new THREE.Mesh(curlGeo, hairMat);
      puff.position.set(x, y, z);
      hairGroup.add(puff);
    });
    if (extras.cowgirlHat) {
      const hatMat = new THREE.MeshStandardMaterial({
        color: 0xf472b6,
        emissive: 0xdb2777,
        emissiveIntensity: 0.45,
        roughness: 0.3,
        metalness: 0.35,
      });
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.06, 16), hatMat);
      brim.position.set(0, 0.84, 0.02);
      brim.rotation.x = -0.14;
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.34, 0.32, 14), hatMat);
      crown.position.set(0, 1.0, -0.02);
      const hatBand = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.06, 14), accentMat);
      hatBand.position.set(0, 0.88, -0.02);
      hairGroup.add(brim, crown, hatBand);
    }
  } else if (hairStyle === 'blonde-bangs') {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.24, 0.74), hairMat);
    cap.position.set(0, 0.69, -0.02);
    const bangs = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.17, 0.12), hairMat);
    bangs.position.set(0, 0.56, 0.34);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.86, 0.22), hairMat);
    back.position.set(0, 0.28, -0.35);
    const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.66, 0.24), hairMat);
    sideL.position.set(-0.36, 0.36, -0.06);
    const sideR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.66, 0.24), hairMat);
    sideR.position.set(0.36, 0.36, -0.06);
    hairGroup.add(cap, bangs, back, sideL, sideR);
  } else if (hairStyle === 'slick-back') {
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.2, 0.74), hairMat);
    top.position.set(0, 0.68, -0.04);
    const sweep = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.54), hairMat);
    sweep.position.set(0, 0.78, -0.08);
    sweep.rotation.x = -0.15;
    hairGroup.add(top, sweep);
  } else if (hairStyle === 'top-hat-curls') {
    const hatMat = new THREE.MeshStandardMaterial({ color: 0x0b0d12, roughness: 0.42, metalness: 0.25 });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.05, 16), hatMat);
    brim.position.set(0, 0.72, 0);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.52, 16), hatMat);
    crown.position.set(0, 0.99, 0);
    const buckleBand = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.08, 16), accentMat);
    buckleBand.position.set(0, 0.78, 0);
    hairGroup.add(brim, crown, buckleBand);

    const curlGeo = new THREE.SphereGeometry(0.19, 8, 8);
    [
      [-0.38, 0.42, -0.04],
      [0.38, 0.42, -0.04],
      [-0.36, 0.18, -0.08],
      [0.36, 0.18, -0.08],
      [0, 0.34, -0.36],
      [-0.22, 0.18, -0.34],
      [0.22, 0.18, -0.34],
    ].forEach(([x, y, z]) => {
      const c = new THREE.Mesh(curlGeo, hairMat);
      c.position.set(x, y, z);
      hairGroup.add(c);
    });
  } else if (hairStyle === 'pompadour') {
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.2, 0.72), hairMat);
    base.position.set(0, 0.68, -0.02);
    const pomp = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), hairMat);
    pomp.scale.set(1.08, 0.72, 1.18);
    pomp.position.set(0, 0.84, 0.08);
    hairGroup.add(base, pomp);
  } else if (hairStyle === 'opm-shag') {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.22, 0.76), hairMat);
    cap.position.set(0, 0.69, -0.02);
    const frontSwept = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.16, 0.16), hairMat);
    frontSwept.position.set(0.06, 0.57, 0.34);
    frontSwept.rotation.z = -0.14;
    const mulletBack = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.74, 0.22), hairMat);
    mulletBack.position.set(0, 0.32, -0.36);
    const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.28), hairMat);
    sideL.position.set(-0.37, 0.38, -0.04);
    const sideR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.28), hairMat);
    sideR.position.set(0.37, 0.38, -0.04);
    hairGroup.add(cap, frontSwept, mulletBack, sideL, sideR);
  } else if (hairStyle === 'anime-spiky') {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.2, 0.72), hairMat);
    cap.position.set(0, 0.68, -0.02);
    hairGroup.add(cap);
    const spikeCoords = [
      [0, 0.94, 0.02, 0, 0, 0.24, 0.44],
      [-0.28, 0.86, 0.08, 0.15, 0.42, 0.2, 0.42],
      [0.28, 0.86, 0.08, 0.15, -0.42, 0.2, 0.42],
      [-0.36, 0.64, -0.06, 0, 0.78, 0.18, 0.38],
      [0.36, 0.64, -0.06, 0, -0.78, 0.18, 0.38],
      [0, 0.78, -0.34, -0.62, 0, 0.22, 0.44],
      [-0.22, 0.56, 0.32, 0.58, 0.24, 0.12, 0.32],
    ];
    spikeCoords.forEach(([x, y, z, rx, rz, r, h]) => {
      const sp = new THREE.Mesh(new THREE.ConeGeometry(r, h, 5), hairMat);
      sp.position.set(x, y, z);
      sp.rotation.set(rx, 0, rz);
      hairGroup.add(sp);
    });
  } else if (hairStyle === 'glam-teased') {
    const puffGeo = new THREE.SphereGeometry(0.28, 10, 8);
    [
      [0, 0.86, -0.04],
      [-0.28, 0.74, -0.06],
      [0.28, 0.74, -0.06],
      [-0.42, 0.48, -0.1],
      [0.42, 0.48, -0.1],
      [-0.38, 0.2, -0.14],
      [0.38, 0.2, -0.14],
      [0, 0.52, -0.38],
      [-0.24, 0.24, -0.36],
      [0.24, 0.24, -0.36],
    ].forEach(([x, y, z]) => {
      const p = new THREE.Mesh(puffGeo, hairMat);
      p.position.set(x, y, z);
      hairGroup.add(p);
    });
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.11, 0.72), accentMat);
    band.position.set(0, 0.58, 0.01);
    hairGroup.add(band);
  } else if (hairStyle === 'chrome-helmet') {
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.12,
      metalness: 0.96,
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.47, 18, 14), chromeMat);
    dome.position.set(0, 0.44, -0.02);
    dome.scale.set(0.95, 0.92, 0.96);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.18, 0.72), chromeMat);
    brow.position.set(0, 0.64, 0.02);
    [-1, 1].forEach((side) => {
      const earPod = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.1, 12), chromeMat);
      earPod.rotation.z = Math.PI * 0.5;
      earPod.position.set(side * 0.39, 0.34, 0);
      const podRing = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 6, 16), accentMat);
      podRing.rotation.y = Math.PI * 0.5;
      podRing.position.set(side * 0.44, 0.34, 0);
      hairGroup.add(earPod, podRing);
    });
    hairGroup.add(dome, brow);
  } else if (hairStyle === 'backwards-cap') {
    const capMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.48, metalness: 0.1 });
    const crown = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.24, 0.74), capMat);
    crown.position.set(0, 0.69, -0.02);
    const brimBack = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.06, 0.38), capMat);
    brimBack.position.set(0, 0.58, -0.5);
    brimBack.rotation.x = 0.12;
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.07, 0.04), accentMat);
    strap.position.set(0, 0.6, 0.36);
    hairGroup.add(crown, brimBack, strap);
  } else if (hairStyle === 'sombrero') {
    const feltMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.52, metalness: 0.18 });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.96, 1.02, 0.07, 24), feltMat);
    brim.position.set(0, 0.72, -0.02);
    const brimRim = new THREE.Mesh(new THREE.TorusGeometry(0.98, 0.035, 8, 24), accentMat);
    brimRim.rotation.x = Math.PI * 0.5;
    brimRim.position.set(0, 0.72, -0.02);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.4, 16), feltMat);
    crown.position.set(0, 0.94, -0.02);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.39, 0.07, 16), accentMat);
    band.position.set(0, 0.78, -0.02);
    hairGroup.add(brim, brimRim, crown, band);
  } else if (hairStyle === 'mech-visor') {
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.24, metalness: 0.88 });
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.78), brassMat);
    crest.position.set(0, 0.78, -0.02);
    const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.2, 0.74), brassMat);
    helmet.position.set(0, 0.68, -0.02);
    [-1, 1].forEach((side) => {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.32, 8), accentMat);
      ant.position.set(side * 0.37, 0.64, -0.06);
      hairGroup.add(ant);
    });
    hairGroup.add(helmet, crest);
  } else if (hairStyle === 'dreadlocks-tam') {
    const greenTam = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.72 });
    const goldTam = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.65 });
    const redTam = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.68 });
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 10), greenTam);
    crown.scale.set(1.02, 0.74, 1.04);
    crown.position.set(0, 0.78, -0.02);
    const bandGold = new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.42, 0.08, 14), goldTam);
    bandGold.position.set(0, 0.64, -0.02);
    const bandRed = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.41, 0.08, 14), redTam);
    bandRed.position.set(0, 0.56, -0.02);
    hairGroup.add(crown, bandGold, bandRed);
    const dreadGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.74, 6);
    [
      [-0.36, 0.24, -0.14],
      [-0.38, 0.22, 0.08],
      [-0.24, 0.2, -0.35],
      [0, 0.18, -0.37],
      [0.24, 0.2, -0.35],
      [0.38, 0.22, 0.08],
      [0.36, 0.24, -0.14],
    ].forEach(([dx, dy, dz]) => {
      const dr = new THREE.Mesh(dreadGeo, hairMat);
      dr.position.set(dx, dy, dz);
      hairGroup.add(dr);
    });
  } else if (hairStyle === 'funk-pompadour') {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.22, 0.74), hairMat);
    cap.position.set(0, 0.69, -0.02);
    const wave = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 10), hairMat);
    wave.scale.set(1.12, 0.76, 1.24);
    wave.position.set(0, 0.86, 0.06);
    const sideBurnL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.14), hairMat);
    sideBurnL.position.set(-0.36, 0.44, 0.14);
    const sideBurnR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.14), hairMat);
    sideBurnR.position.set(0.36, 0.44, 0.14);
    hairGroup.add(cap, wave, sideBurnL, sideBurnR);
  } else if (hairStyle === 'kpop-ponytail') {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.22, 0.72), hairMat);
    cap.position.set(0, 0.69, -0.02);
    const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.12, 0.12), hairMat);
    fringe.position.set(0, 0.56, 0.34);
    const scrunchie = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.035, 8, 14), accentMat);
    scrunchie.position.set(0.14, 0.76, -0.34);
    const tailUpper = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.54, 0.22), hairMat);
    tailUpper.position.set(0.18, 0.56, -0.44);
    tailUpper.rotation.x = 0.28;
    tailUpper.rotation.z = -0.18;
    const tailLower = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.48, 0.18), hairMat);
    tailLower.position.set(0.24, 0.12, -0.54);
    tailLower.rotation.z = -0.1;
    hairGroup.add(cap, fringe, scrunchie, tailUpper, tailLower);
  } else if (hairStyle === 'samurai-kabuto') {
    const armorMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.72 });
    const hornMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xb45309,
      emissiveIntensity: 0.35,
      roughness: 0.2,
      metalness: 0.9,
    });
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 10), armorMat);
    bowl.scale.set(1.02, 0.72, 1.04);
    bowl.position.set(0, 0.66, -0.02);
    const neckGuard = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.58, 0.28, 12, 1, true, Math.PI * 0.6, Math.PI * 1.8), armorMat);
    neckGuard.position.set(0, 0.44, -0.06);
    const crestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.08), accentMat);
    crestPlate.position.set(0, 0.76, 0.36);
    [-1, 1].forEach((side) => {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.44, 5), hornMat);
      horn.position.set(side * 0.26, 0.92, 0.3);
      horn.rotation.z = -side * 0.62;
      horn.rotation.x = -0.18;
      hairGroup.add(horn);
    });
    hairGroup.add(bowl, neckGuard, crestPlate);
  } else if (hairStyle === 'cowboy-hat') {
    const hatMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.62, metalness: 0.08 });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.74, 0.06, 20), hatMat);
    brim.position.set(0, 0.72, 0.01);
    brim.rotation.x = -0.08;
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 0.34, 16), hatMat);
    crown.position.set(0, 0.9, -0.01);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.365, 0.365, 0.06, 16), accentMat);
    band.position.set(0, 0.77, -0.01);
    const backHair = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.38, 0.16), new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.6 }));
    backHair.position.set(0, 0.42, -0.32);
    hairGroup.add(brim, crown, band, backHair);
  } else if (hairStyle === 'vocaloid-twintails') {
    const aquaGlowMat = new THREE.MeshStandardMaterial({
      color: hairColor,
      emissive: 0x0d9488,
      emissiveIntensity: 0.55,
      roughness: 0.26,
      metalness: 0.35,
    });
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.24, 0.74), aquaGlowMat);
    cap.position.set(0, 0.69, -0.02);
    const bangs = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.16, 0.12), aquaGlowMat);
    bangs.position.set(0, 0.56, 0.34);
    hairGroup.add(cap, bangs);
  } else if (hairStyle === 'grunge-shag') {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.24, 0.76), hairMat);
    cap.position.set(0, 0.68, -0.02);
    const messyBack = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.68, 0.22), hairMat);
    messyBack.position.set(0, 0.34, -0.35);
    const strandL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.24), hairMat);
    strandL.position.set(-0.37, 0.36, 0.04);
    strandL.rotation.z = 0.08;
    const strandR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.24), hairMat);
    strandR.position.set(0.37, 0.36, 0.04);
    strandR.rotation.z = -0.08;
    const bang = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.16, 0.14), hairMat);
    bang.position.set(-0.04, 0.56, 0.34);
    bang.rotation.z = 0.12;
    hairGroup.add(cap, messyBack, strandL, strandR, bang);
  } else if (hairStyle === 'steampunk-goggles') {
    const leatherHatMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.5, metalness: 0.22 });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.24, metalness: 0.88 });
    const lensMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.55, roughness: 0.15 });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.05, 18), leatherHatMat);
    brim.position.set(0, 0.72, 0);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.31, 0.5, 16), leatherHatMat);
    crown.position.set(0, 0.98, 0);
    const hatBand = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.08, 16), brassMat);
    hatBand.position.set(0, 0.8, 0);
    [-0.14, 0.14].forEach((gx) => {
      const gogRim = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.028, 8, 16), brassMat);
      gogRim.position.set(gx, 0.81, 0.33);
      const gogLens = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.03, 12), lensMat);
      gogLens.rotation.x = Math.PI * 0.5;
      gogLens.position.set(gx, 0.81, 0.325);
      hairGroup.add(gogRim, gogLens);
    });
    hairGroup.add(brim, crown, hatBand);
  } else {
    const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.22, 0.72), hairMat);
    hairTop.position.set(0, 0.69, -0.02);
    hairGroup.add(hairTop);

    if (hairStyle === 'spiky') {
      for (let i = -1; i <= 1; i += 1) {
        const spike = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.2), hairMat);
        spike.position.set(i * 0.2, 0.84, 0.08);
        spike.rotation.z = -i * 0.28;
        hairGroup.add(spike);
      }
    } else if (hairStyle === 'mohawk') {
      const crest = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 0.72), accentMat);
      crest.position.set(0, 0.88, -0.02);
      hairGroup.add(crest);
    } else if (hairStyle === 'long') {
      const backHair = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.62, 0.2), hairMat);
      backHair.position.set(0, 0.38, -0.34);
      hairGroup.add(backHair);
    } else if (hairStyle === 'headband') {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.73, 0.1, 0.71), accentMat);
      band.position.set(0, 0.56, 0);
      hairGroup.add(band);
    }
  }
}

function clearAndDisposeGroup(group) {
  if (!group) return;
  const geos = new Set();
  const mats = new Set();
  group.traverse((obj) => {
    if (obj.geometry) geos.add(obj.geometry);
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach((m) => mats.add(m));
      else mats.add(obj.material);
    }
  });
  while (group.children.length > 0) {
    group.remove(group.children[0]);
  }
  geos.forEach((g) => g.dispose());
  mats.forEach((m) => {
    if (!m.userData?.shared) m.dispose();
  });
}

function createBeveledBoxGeometry(w, h, d, bevel = 0.032) {
  const b = Math.min(bevel, w * 0.22, h * 0.22, d * 0.22);
  const iw = Math.max(0.01, w - b * 2);
  const ih = Math.max(0.01, h - b * 2);
  const id = Math.max(0.01, d - b * 2);
  const hw = iw * 0.5;
  const hh = ih * 0.5;
  const r = Math.min(b * 0.65, hw * 0.45, hh * 0.45);
  const shape = new THREE.Shape();
  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
  shape.lineTo(hw, hh - r);
  shape.quadraticCurveTo(hw, hh, hw - r, hh);
  shape.lineTo(-hw + r, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
  shape.lineTo(-hw, -hh + r);
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: id,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: b,
    bevelThickness: b,
  });
  geo.center();
  return geo;
}

function createPbrClothingMaps() {
  const makePair = (drawFn, repeatX = 2, repeatY = 2) => {
    const albCanvas = document.createElement('canvas');
    albCanvas.width = 256;
    albCanvas.height = 256;
    const aCtx = albCanvas.getContext('2d');

    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = 256;
    bumpCanvas.height = 256;
    const bCtx = bumpCanvas.getContext('2d');

    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = 256;
    roughCanvas.height = 256;
    const rCtx = roughCanvas.getContext('2d');

    drawFn(aCtx, bCtx, rCtx);

    const map = new THREE.CanvasTexture(albCanvas);
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(repeatX, repeatY);
    map.colorSpace = THREE.SRGBColorSpace;

    const bumpMap = new THREE.CanvasTexture(bumpCanvas);
    bumpMap.wrapS = THREE.RepeatWrapping;
    bumpMap.wrapT = THREE.RepeatWrapping;
    bumpMap.repeat.set(repeatX, repeatY);
    bumpMap.colorSpace = THREE.NoColorSpace;

    const roughnessMap = new THREE.CanvasTexture(roughCanvas);
    roughnessMap.wrapS = THREE.RepeatWrapping;
    roughnessMap.wrapT = THREE.RepeatWrapping;
    roughnessMap.repeat.set(repeatX, repeatY);
    roughnessMap.colorSpace = THREE.NoColorSpace;

    return { map, bumpMap, roughnessMap };
  };

  // 1. Diagonal Denim Twill Weave
  const denim = makePair((aCtx, bCtx, rCtx) => {
    aCtx.fillStyle = '#ebeff5';
    aCtx.fillRect(0, 0, 256, 256);
    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, 256, 256);
    rCtx.fillStyle = '#c4c4c4';
    rCtx.fillRect(0, 0, 256, 256);
    for (let y = -256; y < 512; y += 6) {
      aCtx.strokeStyle = y % 12 === 0 ? 'rgba(205, 214, 226, 0.72)' : 'rgba(255, 255, 255, 0.35)';
      aCtx.lineWidth = 2.2;
      aCtx.beginPath();
      aCtx.moveTo(0, y);
      aCtx.lineTo(256, y + 256);
      aCtx.stroke();

      bCtx.strokeStyle = y % 12 === 0 ? '#5c5c5c' : '#a8a8a8';
      bCtx.lineWidth = 2.0;
      bCtx.beginPath();
      bCtx.moveTo(0, y);
      bCtx.lineTo(256, y + 256);
      bCtx.stroke();
    }
    // Double pocket stitch highlight
    aCtx.strokeStyle = 'rgba(248, 224, 160, 0.35)';
    aCtx.setLineDash([5, 4]);
    aCtx.lineWidth = 1.6;
    aCtx.strokeRect(10, 12, 236, 232);
    aCtx.setLineDash([]);
  }, 3, 3);

  // 2. Concert Pebbled Leather Jacket + Lapel Stitches
  const leather = makePair((aCtx, bCtx, rCtx) => {
    aCtx.fillStyle = '#eef2f6';
    aCtx.fillRect(0, 0, 256, 256);
    bCtx.fillStyle = '#787878';
    bCtx.fillRect(0, 0, 256, 256);
    rCtx.fillStyle = '#747474';
    rCtx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 420; i += 1) {
      const px = (i * 73) % 256;
      const py = (i * 139) % 256;
      const rad = 2.5 + (i % 3);
      aCtx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.16)' : 'rgba(148,163,184,0.2)';
      aCtx.beginPath();
      aCtx.arc(px, py, rad, 0, Math.PI * 2);
      aCtx.fill();

      bCtx.fillStyle = i % 2 === 0 ? '#a8a8a8' : '#585858';
      bCtx.beginPath();
      bCtx.arc(px, py, rad, 0, Math.PI * 2);
      bCtx.fill();

      rCtx.fillStyle = i % 2 === 0 ? '#525252' : '#909090';
      rCtx.beginPath();
      rCtx.arc(px, py, rad, 0, Math.PI * 2);
      rCtx.fill();
    }
    // Center zipper & seam lines
    aCtx.fillStyle = 'rgba(226, 232, 240, 0.9)';
    aCtx.fillRect(124, 0, 8, 256);
    bCtx.fillStyle = '#e0e0e0';
    bCtx.fillRect(124, 0, 8, 256);
    rCtx.fillStyle = '#282828';
    rCtx.fillRect(124, 0, 8, 256);
  }, 1, 1);

  // 3. Stage Sequin Diamond Facets
  const sequin = makePair((aCtx, bCtx, rCtx) => {
    aCtx.fillStyle = '#e2e8f0';
    aCtx.fillRect(0, 0, 256, 256);
    bCtx.fillStyle = '#606060';
    bCtx.fillRect(0, 0, 256, 256);
    rCtx.fillStyle = '#8e8e8e';
    rCtx.fillRect(0, 0, 256, 256);
    const step = 16;
    for (let row = 0; row < 16; row += 1) {
      for (let col = 0; col < 16; col += 1) {
        const cx = col * step + (row % 2 === 0 ? step * 0.5 : 0);
        const cy = row * step + step * 0.5;
        const bright = ((row * 7 + col * 11) % 5) === 0;
        aCtx.fillStyle = bright ? '#ffffff' : 'rgba(226, 232, 240, 0.78)';
        aCtx.beginPath();
        aCtx.arc(cx, cy, 5.6, 0, Math.PI * 2);
        aCtx.fill();

        bCtx.fillStyle = bright ? '#ededed' : '#a8a8a8';
        bCtx.beginPath();
        bCtx.arc(cx, cy, 5.4, 0, Math.PI * 2);
        bCtx.fill();

        rCtx.fillStyle = bright ? '#1a1a1a' : '#424242';
        rCtx.beginPath();
        rCtx.arc(cx, cy, 5.4, 0, Math.PI * 2);
        rCtx.fill();
      }
    }
  }, 2, 2);

  return { denim, leather, sequin };
}

function buildRobloxCharacter({
  torsoColor,
  pantsColor,
  skinColor = '#f4c79a',
  hairColor = '#1e1b2e',
  hairStyle = 'spiky',
  accentColor = 0x38bdf8,
  sunglasses = false,
  smile = 'grin',
  seated = false,
  clothingPbrMaps = null,
}) {
  const root = new THREE.Group();
  const originalSpec = {
    torsoColor,
    pantsColor,
    skinColor,
    hairColor,
    hairStyle,
    accentColor,
    sunglasses,
    smile,
  };

  const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.42, metalness: 0.04 });
  const torsoMat = new THREE.MeshStandardMaterial({
    color: torsoColor,
    map: clothingPbrMaps?.leather?.map || null,
    bumpMap: clothingPbrMaps?.leather?.bumpMap || null,
    bumpScale: 0.018,
    roughnessMap: clothingPbrMaps?.leather?.roughnessMap || null,
    roughness: 0.52,
    metalness: 0.16,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: pantsColor,
    map: clothingPbrMaps?.denim?.map || null,
    bumpMap: clothingPbrMaps?.denim?.bumpMap || null,
    bumpScale: 0.014,
    roughnessMap: clothingPbrMaps?.denim?.roughnessMap || null,
    roughness: 0.72,
    metalness: 0.06,
  });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x0f121a, roughness: 0.44, metalness: 0.24 });
  const soleMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.82, metalness: 0.08 });
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 0.55,
    roughness: 0.28,
    metalness: 0.35,
  });
  accentMat.userData.shared = true;

  function bakeExpressionTextures(cfg) {
    return {
      grin: createRobloxFaceTexture({ ...cfg, expression: 'grin', shocked: false }),
      belt: createRobloxFaceTexture({ ...cfg, expression: 'belt', shocked: false }),
      intense: createRobloxFaceTexture({ ...cfg, expression: 'intense', shocked: false }),
      closed: createRobloxFaceTexture({ ...cfg, expression: 'closed', shocked: false }),
      shocked: createRobloxFaceTexture({ ...cfg, expression: 'shocked', shocked: true, sunglasses: false }),
    };
  }

  let exprTextures = bakeExpressionTextures({ skin: skinColor, sunglasses, smile });
  const exprMats = {
    grin: new THREE.MeshStandardMaterial({ map: exprTextures.grin, roughness: 0.4, metalness: 0.04 }),
    belt: new THREE.MeshStandardMaterial({ map: exprTextures.belt, roughness: 0.4, metalness: 0.04 }),
    intense: new THREE.MeshStandardMaterial({ map: exprTextures.intense, roughness: 0.4, metalness: 0.04 }),
    closed: new THREE.MeshStandardMaterial({ map: exprTextures.closed, roughness: 0.4, metalness: 0.04 }),
    shocked: new THREE.MeshStandardMaterial({ map: exprTextures.shocked, roughness: 0.4, metalness: 0.04 }),
  };
  let activeExprId = 'grin';
  let currentDanceStyle = 'standard';
  const headMaterials = [skinMat, skinMat, skinMat, skinMat, exprMats.grin, skinMat];

  // Beveled legs + multi-part 3D boots whose bottom lugged sole rests strictly at y = 0 when standing (pivot y = 0.96)
  const legGeo = createBeveledBoxGeometry(0.41, 0.78, 0.42, 0.035);
  const bootCuffGeo = createBeveledBoxGeometry(0.43, 0.14, 0.45, 0.028);
  const bootVampGeo = createBeveledBoxGeometry(0.42, 0.11, 0.52, 0.028);
  const bootSoleGeo = createBeveledBoxGeometry(0.44, 0.05, 0.56, 0.014);

  const buildLegRig = (offsetX) => {
    const pivot = new THREE.Group();
    pivot.position.set(offsetX, seated ? 0.72 : 0.96, 0);
    const leg = new THREE.Mesh(legGeo, pantsMat);
    leg.position.y = -0.39;
    const cuff = new THREE.Mesh(bootCuffGeo, shoeMat);
    cuff.position.set(0, -0.82, 0.01);
    const vamp = new THREE.Mesh(bootVampGeo, shoeMat);
    vamp.position.set(0, -0.885, 0.05);
    const sole = new THREE.Mesh(bootSoleGeo, soleMat);
    sole.position.set(0, -0.935, 0.05);
    pivot.add(leg, cuff, vamp, sole);
    if (seated) pivot.rotation.x = -1.15;
    return pivot;
  };

  const leftLegPivot = buildLegRig(-0.23);
  const rightLegPivot = buildLegRig(0.23);
  root.add(leftLegPivot, rightLegPivot);

  const upperBody = new THREE.Group();
  upperBody.position.set(0, seated ? 0.72 : 0.96, 0);
  root.add(upperBody);

  const torsoMesh = new THREE.Mesh(createBeveledBoxGeometry(0.92, 1.02, 0.48, 0.044), torsoMat);
  torsoMesh.position.y = 0.51;
  upperBody.add(torsoMesh);

  const collarMesh = new THREE.Mesh(createBeveledBoxGeometry(0.56, 0.11, 0.49, 0.024), torsoMat);
  collarMesh.position.y = 1.02;
  upperBody.add(collarMesh);

  const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.14, 12), skinMat);
  neckMesh.position.y = 1.04;
  upperBody.add(neckMesh);

  const stripe = new THREE.Mesh(createBeveledBoxGeometry(0.95, 0.12, 0.51, 0.02), accentMat);
  stripe.position.y = 0.62;
  upperBody.add(stripe);

  const accessoryGroup = new THREE.Group();
  upperBody.add(accessoryGroup);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.06, 0);
  upperBody.add(headGroup);

  const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.66, 0.66), headMaterials);
  headMesh.position.y = 0.34;
  headGroup.add(headMesh);

  const hairGroup = new THREE.Group();
  headGroup.add(hairGroup);
  populateHairGroup(hairGroup, hairStyle, hairColor, accentMat);

  // Articulated Shoulder -> Upper Arm -> Elbow -> Forearm -> Wrist -> Hand
  const upperArmGeo = createBeveledBoxGeometry(0.34, 0.46, 0.36, 0.034);
  const sleeveGeo = createBeveledBoxGeometry(0.38, 0.42, 0.4, 0.034);
  const forearmGeo = createBeveledBoxGeometry(0.3, 0.4, 0.32, 0.028);
  const wristbandGeo = createBeveledBoxGeometry(0.32, 0.09, 0.34, 0.018);
  const handGeo = createBeveledBoxGeometry(0.27, 0.15, 0.28, 0.024);

  const buildArticulatedArm = (offsetX) => {
    const armPivot = new THREE.Group();
    armPivot.position.set(offsetX, 0.94, 0);

    const upperMesh = new THREE.Mesh(upperArmGeo, skinMat);
    upperMesh.position.y = -0.23;
    const sleeveMesh = new THREE.Mesh(sleeveGeo, torsoMat);
    sleeveMesh.position.y = -0.19;

    const elbowPivot = new THREE.Group();
    elbowPivot.position.set(0, -0.44, 0);
    const forearmMesh = new THREE.Mesh(forearmGeo, skinMat);
    forearmMesh.position.y = -0.2;
    const wristbandMesh = new THREE.Mesh(wristbandGeo, accentMat);
    wristbandMesh.position.y = -0.35;

    const wristPivot = new THREE.Group();
    wristPivot.position.set(0, -0.4, 0);
    const handMesh = new THREE.Mesh(handGeo, skinMat);
    handMesh.position.y = -0.06;

    wristPivot.add(handMesh);
    elbowPivot.add(forearmMesh, wristbandMesh, wristPivot);
    armPivot.add(upperMesh, sleeveMesh, elbowPivot);
    return { armPivot, elbowPivot, wristPivot };
  };

  const leftArmRig = buildArticulatedArm(-0.66);
  const rightArmRig = buildArticulatedArm(0.66);
  const leftArmPivot = leftArmRig.armPivot;
  const rightArmPivot = rightArmRig.armPivot;
  const leftElbowPivot = leftArmRig.elbowPivot;
  const rightElbowPivot = rightArmRig.elbowPivot;
  const leftWristPivot = leftArmRig.wristPivot;
  const rightWristPivot = rightArmRig.wristPivot;

  upperBody.add(leftArmPivot, rightArmPivot);

  function applyLook(lookSpec) {
    clearAndDisposeGroup(hairGroup);
    clearAndDisposeGroup(accessoryGroup);

    if (!lookSpec || lookSpec.id === 'default-band') {
      currentDanceStyle = 'standard';
      skinMat.color.set(originalSpec.skinColor);
      torsoMat.color.set(originalSpec.torsoColor);
      torsoMat.emissive.setHex(0x000000);
      torsoMat.emissiveIntensity = 0;
      torsoMat.map = clothingPbrMaps?.leather?.map || null;
      torsoMat.bumpMap = clothingPbrMaps?.leather?.bumpMap || null;
      torsoMat.roughnessMap = clothingPbrMaps?.leather?.roughnessMap || null;
      torsoMat.roughness = 0.52;
      torsoMat.metalness = 0.16;
      torsoMat.needsUpdate = true;
      pantsMat.color.set(originalSpec.pantsColor);
      shoeMat.color.setHex(0x0f121a);
      accentMat.color.set(originalSpec.accentColor);
      accentMat.emissive.set(originalSpec.accentColor);
      accentMat.emissiveIntensity = 0.55;

      populateHairGroup(hairGroup, originalSpec.hairStyle, originalSpec.hairColor, accentMat);

      const nextSet = bakeExpressionTextures({
        skin: originalSpec.skinColor,
        sunglasses: originalSpec.sunglasses,
        smile: originalSpec.smile,
      });
      Object.keys(exprTextures).forEach((k) => {
        exprTextures[k]?.dispose?.();
        exprTextures[k] = nextSet[k];
        exprMats[k].map = nextSet[k];
        exprMats[k].needsUpdate = true;
      });
      return;
    }

    currentDanceStyle = lookSpec.danceStyle || 'standard';
    const skinHexStr = `#${new THREE.Color(lookSpec.skinColor).getHexString()}`;
    skinMat.color.setHex(lookSpec.skinColor);
    torsoMat.color.setHex(lookSpec.torsoColor);
    torsoMat.emissive.setHex(lookSpec.torsoEmissive || 0x000000);
    torsoMat.emissiveIntensity = lookSpec.glitter ? 0.52 : 0.24;
    const isFlatCartoon = lookSpec.customSculpt === 'sponge-rocker' || lookSpec.customSculpt === 'shrek-ogre';
    const fabricSet = isFlatCartoon
      ? null
      : lookSpec.glitter
        ? clothingPbrMaps?.sequin
        : clothingPbrMaps?.leather;
    torsoMat.map = fabricSet?.map || null;
    torsoMat.bumpMap = fabricSet?.bumpMap || null;
    torsoMat.roughnessMap = fabricSet?.roughnessMap || null;
    torsoMat.roughness = lookSpec.glitter ? 0.24 : 0.44;
    torsoMat.metalness = lookSpec.glitter ? 0.62 : 0.18;
    torsoMat.needsUpdate = true;
    pantsMat.color.setHex(lookSpec.legColor ?? originalSpec.pantsColor);
    shoeMat.color.setHex(lookSpec.bootColor ?? 0x0f121a);
    accentMat.color.setHex(lookSpec.accentColor ?? 0xfacc15);
    accentMat.emissive.setHex(lookSpec.accentColor ?? 0xfacc15);
    accentMat.emissiveIntensity = lookSpec.glitter ? 1.15 : 0.65;

    populateHairGroup(hairGroup, lookSpec.hairStyle, lookSpec.hairColor, accentMat, {
      cowgirlHat: Boolean(lookSpec.cowgirlHat),
    });

    // Stage outfit accessories: pleated mini-skirt, glam fringe, or Bruno gold chain
    if (lookSpec.skirtColor) {
      const skirtMat = new THREE.MeshStandardMaterial({
        color: lookSpec.skirtColor,
        emissive: lookSpec.skirtColor,
        emissiveIntensity: lookSpec.glitter ? 0.35 : 0.08,
        roughness: lookSpec.glitter ? 0.22 : 0.52,
        metalness: lookSpec.glitter ? 0.55 : 0.12,
      });
      const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 0.44, 14), skirtMat);
      skirt.position.set(0, -0.08, 0);
      accessoryGroup.add(skirt);
      if (lookSpec.skirtStyle === 'glam-fringe') {
        const trim = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.04, 8, 20), accentMat);
        trim.rotation.x = Math.PI * 0.5;
        trim.position.set(0, -0.28, 0);
        accessoryGroup.add(trim);
      }
    }

    if (lookSpec.goldChain) {
      const goldMat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xb45309,
        emissiveIntensity: 0.38,
        roughness: 0.18,
        metalness: 0.92,
      });
      const chain = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.032, 8, 18), goldMat);
      chain.position.set(0, 0.84, 0.25);
      chain.rotation.x = 0.28;
      accessoryGroup.add(chain);
    }

    // Custom 3D Cartoon / Pop-Culture Sculpt Attachments
    if (lookSpec.customSculpt === 'shrek-ogre') {
      const ogreSkinMat = new THREE.MeshStandardMaterial({ color: 0x84cc16, roughness: 0.44, metalness: 0.06 });
      const vestMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.78, metalness: 0.08 });
      const strapMat = new THREE.MeshStandardMaterial({ color: 0x3b2313, roughness: 0.7 });
      [-1, 1].forEach((side) => {
        const earStem = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.04, 0.24, 8), ogreSkinMat);
        earStem.position.set(side * 0.4, 0.46, -0.02);
        earStem.rotation.z = -side * 1.15;
        const earBell = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.055, 0.12, 10), ogreSkinMat);
        earBell.position.set(side * 0.52, 0.52, -0.02);
        earBell.rotation.z = -side * 1.15;
        hairGroup.add(earStem, earBell);

        const vestPanel = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.88, 0.52), vestMat);
        vestPanel.position.set(side * 0.28, 0.52, 0);
        accessoryGroup.add(vestPanel);
      });
      const belt = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.15, 0.53), strapMat);
      belt.position.set(0, 0.08, 0);
      accessoryGroup.add(belt);
    } else if (lookSpec.customSculpt === 'sponge-rocker') {
      const poreMat = new THREE.MeshStandardMaterial({ color: 0xca8a04, roughness: 0.72, metalness: 0.05 });
      const collarMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4, metalness: 0.06 });
      const tieMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35, metalness: 0.1 });
      [
        [-0.26, 0.78, 0.245, 0.07],
        [0.28, 0.58, 0.245, 0.06],
        [-0.18, 0.34, 0.245, 0.055],
      ].forEach(([px, py, pz, pr]) => {
        const pore = new THREE.Mesh(new THREE.CylinderGeometry(pr, pr, 0.03, 10), poreMat);
        pore.rotation.x = Math.PI * 0.5;
        pore.position.set(px, py, pz);
        accessoryGroup.add(pore);
      });
      [
        [-0.22, 0.52, 0.335, 0.055],
        [0.24, 0.44, -0.335, 0.06],
      ].forEach(([hx, hy, hz, hr]) => {
        const hp = new THREE.Mesh(new THREE.CylinderGeometry(hr, hr, 0.03, 10), poreMat);
        hp.rotation.x = Math.PI * 0.5;
        hp.position.set(hx, hy, hz);
        hairGroup.add(hp);
      });
      const shirtBand = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.3, 0.5), collarMat);
      shirtBand.position.set(0, 0.2, 0);
      const tieKnot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.06), tieMat);
      tieKnot.position.set(0, 0.74, 0.26);
      const tieBlade = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.4, 0.05), tieMat);
      tieBlade.position.set(0, 0.5, 0.26);
      accessoryGroup.add(shirtBand, tieKnot, tieBlade);
    } else if (lookSpec.customSculpt === 'dark-knight') {
      const cowlMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.38, metalness: 0.48 });
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.24, metalness: 0.88 });
      const capeMat = new THREE.MeshStandardMaterial({
        color: 0x090d16,
        roughness: 0.65,
        metalness: 0.18,
        side: THREE.DoubleSide,
      });
      const cowlCap = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.28, 0.74), cowlMat);
      cowlCap.position.set(0, 0.58, -0.01);
      const cowlBack = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.64, 0.38), cowlMat);
      cowlBack.position.set(0, 0.34, -0.18);
      hairGroup.add(cowlCap, cowlBack);
      [-1, 1].forEach((side) => {
        const batEar = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.32, 4), cowlMat);
        batEar.position.set(side * 0.26, 0.84, 0.06);
        batEar.rotation.z = -side * 0.08;
        hairGroup.add(batEar);
      });
      const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.24, 0.06), cowlMat);
      chestPlate.position.set(0, 0.68, 0.25);
      const batEmblem = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.11, 0.07), goldMat);
      batEmblem.position.set(0, 0.68, 0.26);
      const utilBelt = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.14, 0.52), goldMat);
      utilBelt.position.set(0, 0.08, 0);
      const cape = new THREE.Mesh(new THREE.BoxGeometry(1.06, 1.48, 0.05), capeMat);
      cape.position.set(0, 0.24, -0.34);
      cape.rotation.x = 0.12;
      accessoryGroup.add(chestPlate, batEmblem, utilBelt, cape);
    } else if (lookSpec.customSculpt === 'cyber-idol') {
      const cyanGlowMat = new THREE.MeshStandardMaterial({
        color: 0x22d3ee,
        emissive: 0x06b6d4,
        emissiveIntensity: 1.05,
        roughness: 0.25,
        metalness: 0.45,
      });
      const darkTrimMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.32, metalness: 0.72 });
      [-1, 1].forEach((side) => {
        const tie = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), darkTrimMat);
        tie.position.set(side * 0.4, 0.58, -0.1);
        const upperTail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.66, 0.18), cyanGlowMat);
        upperTail.position.set(side * 0.48, 0.28, -0.14);
        upperTail.rotation.z = side * 0.18;
        const lowerTail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.58, 0.16), cyanGlowMat);
        lowerTail.position.set(side * 0.56, -0.22, -0.16);
        lowerTail.rotation.z = side * 0.1;
        hairGroup.add(tie, upperTail, lowerTail);
      });
      const cyberNeckTie = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.48, 0.05), cyanGlowMat);
      cyberNeckTie.position.set(0, 0.54, 0.26);
      const cyberBelt = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.1, 0.51), cyanGlowMat);
      cyberBelt.position.set(0, 0.08, 0);
      accessoryGroup.add(cyberNeckTie, cyberBelt);
    } else if (lookSpec.customSculpt === 'opm-pinoy-rock') {
      const teeMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.65 });
      const teeFront = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.88, 0.06), teeMat);
      teeFront.position.set(0, 0.52, 0.24);
      const dogTag = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.03), accentMat);
      dogTag.position.set(0, 0.74, 0.28);
      accessoryGroup.add(teeFront, dogTag);
    } else if (lookSpec.customSculpt === 'visual-kei-shredder') {
      const strapMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.2, metalness: 0.88 });
      const sash = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.14, 0.52), strapMat);
      sash.position.set(0, 0.62, 0);
      sash.rotation.z = 0.58;
      const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.52), strapMat);
      shoulder.position.set(-0.44, 0.96, 0);
      accessoryGroup.add(sash, shoulder);
    } else if (lookSpec.customSculpt === 'glam-metal-80s') {
      const zebraMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.45 });
      for (let s = 0; s < 3; s += 1) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.11, 0.51), zebraMat);
        stripe.position.set(0, 0.26 + s * 0.26, 0);
        stripe.rotation.z = (s % 2 === 0 ? 1 : -1) * 0.16;
        accessoryGroup.add(stripe);
      }
    } else if (lookSpec.customSculpt === 'chrome-synth-dj') {
      const synthBelt = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.11, 0.52), accentMat);
      synthBelt.position.set(0, 0.1, 0);
      const chestCore = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.06), accentMat);
      chestCore.position.set(0, 0.68, 0.25);
      accessoryGroup.add(synthBelt, chestCore);
    } else if (lookSpec.customSculpt === 'punk-skater-bass') {
      const studMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2, metalness: 0.9 });
      const belt = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.12, 0.51), studMat);
      belt.position.set(0, 0.08, 0);
      const cargoBand = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.18, 0.5), new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.8 }));
      cargoBand.position.set(0, -0.02, 0);
      accessoryGroup.add(belt, cargoBand);
    } else if (lookSpec.customSculpt === 'mariachi-virtuoso') {
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.22, metalness: 0.88 });
      const crimsonMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.42 });
      const bowL = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.2, 4), crimsonMat);
      bowL.position.set(-0.1, 0.9, 0.26);
      bowL.rotation.z = Math.PI * 0.5;
      const bowR = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.2, 4), crimsonMat);
      bowR.position.set(0.1, 0.9, 0.26);
      bowR.rotation.z = -Math.PI * 0.5;
      [-0.3, 0.3].forEach((bx) => {
        const trim = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.86, 0.52), goldMat);
        trim.position.set(bx, 0.52, 0);
        accessoryGroup.add(trim);
      });
      accessoryGroup.add(bowL, bowR);
    } else if (lookSpec.customSculpt === 'golden-mech-drummer') {
      const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2, metalness: 0.92 });
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.08, 12), accentMat);
      core.rotation.x = Math.PI * 0.5;
      core.position.set(0, 0.64, 0.25);
      [-0.56, 0.56].forEach((sx) => {
        const pauldron = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.24, 0.54), chromeMat);
        pauldron.position.set(sx, 0.96, 0);
        accessoryGroup.add(pauldron);
      });
      accessoryGroup.add(core);
    } else if (lookSpec.customSculpt === 'gothic-vampire') {
      const crimsonMat = new THREE.MeshStandardMaterial({
        color: 0x991b1b,
        emissive: 0x450a0a,
        emissiveIntensity: 0.35,
        roughness: 0.55,
        side: THREE.DoubleSide,
      });
      const velvetMat = new THREE.MeshStandardMaterial({
        color: 0x09090b,
        roughness: 0.65,
        side: THREE.DoubleSide,
      });
      const cravatMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.35 });
      const highCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.36, 0.34, 12, 1, true, Math.PI * 0.68, Math.PI * 1.64), crimsonMat);
      highCollar.position.set(0, 1.08, -0.06);
      const capeOuter = new THREE.Mesh(new THREE.BoxGeometry(1.08, 1.46, 0.04), velvetMat);
      capeOuter.position.set(0, 0.22, -0.35);
      capeOuter.rotation.x = 0.14;
      const capeInner = new THREE.Mesh(new THREE.BoxGeometry(1.02, 1.42, 0.02), crimsonMat);
      capeInner.position.set(0, 0.22, -0.325);
      capeInner.rotation.x = 0.14;
      const cravat = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.44, 0.06), cravatMat);
      cravat.position.set(0, 0.72, 0.25);
      accessoryGroup.add(highCollar, capeOuter, capeInner, cravat);
    } else if (lookSpec.customSculpt === 'reggae-legend') {
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.45 });
      const redMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.5 });
      const sash = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.14, 0.52), goldMat);
      sash.position.set(0, 0.28, 0);
      const stripeRed = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.12, 0.52), redMat);
      stripeRed.position.set(0, 0.42, 0);
      accessoryGroup.add(sash, stripeRed);
    } else if (lookSpec.customSculpt === 'soul-funk-bassist') {
      const jabotMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.38 });
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.2, metalness: 0.9 });
      const jabot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.54, 0.07), jabotMat);
      jabot.position.set(0, 0.68, 0.25);
      const lapelL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.72, 0.06), goldMat);
      lapelL.position.set(-0.22, 0.62, 0.24);
      lapelL.rotation.z = -0.14;
      const lapelR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.72, 0.06), goldMat);
      lapelR.position.set(0.22, 0.62, 0.24);
      lapelR.rotation.z = 0.14;
      const goldBelt = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.12, 0.51), goldMat);
      goldBelt.position.set(0, 0.08, 0);
      accessoryGroup.add(jabot, lapelL, lapelR, goldBelt);
    } else if (lookSpec.customSculpt === 'kpop-main-dancer') {
      const jacketTrim = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.12, 0.52), accentMat);
      jacketTrim.position.set(0, 0.18, 0);
      const chestZip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.68, 0.05), accentMat);
      chestZip.position.set(0, 0.62, 0.25);
      accessoryGroup.add(jacketTrim, chestZip);
    } else if (lookSpec.customSculpt === 'cyber-samurai') {
      const armorMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.28, metalness: 0.75 });
      const glowBladeMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 0.9 });
      [-0.58, 0.58].forEach((sx) => {
        const pauldron = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.54), armorMat);
        pauldron.position.set(sx, 0.96, 0);
        pauldron.rotation.z = sx < 0 ? 0.24 : -0.24;
        accessoryGroup.add(pauldron);
      });
      const scabbard = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.38, 0.1), armorMat);
      scabbard.position.set(0.1, 0.64, -0.32);
      scabbard.rotation.z = -0.58;
      const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.12), glowBladeMat);
      hilt.position.set(-0.34, 1.18, -0.32);
      hilt.rotation.z = -0.58;
      accessoryGroup.add(scabbard, hilt);
    } else if (lookSpec.customSculpt === 'country-outlaw') {
      const vestMat = new THREE.MeshStandardMaterial({ color: 0x5c2b0a, roughness: 0.76 });
      const buckleMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.2, metalness: 0.92 });
      [-0.28, 0.28].forEach((vx) => {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.84, 0.51), vestMat);
        panel.position.set(vx, 0.54, 0);
        accessoryGroup.add(panel);
      });
      const belt = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.14, 0.52), new THREE.MeshStandardMaterial({ color: 0x291507, roughness: 0.6 }));
      belt.position.set(0, 0.08, 0);
      const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.08), buckleMat);
      buckle.position.set(0, 0.08, 0.26);
      accessoryGroup.add(belt, buckle);
    } else if (lookSpec.customSculpt === 'jpop-vocaloid-idol') {
      const aquaGlowMat = new THREE.MeshStandardMaterial({
        color: 0x2dd4bf,
        emissive: 0x14b8a6,
        emissiveIntensity: 0.85,
        roughness: 0.24,
        metalness: 0.42,
      });
      const magMat = new THREE.MeshStandardMaterial({
        color: 0xec4899,
        emissive: 0xdb2777,
        emissiveIntensity: 0.95,
        roughness: 0.24,
      });
      [-1, 1].forEach((side) => {
        const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), magMat);
        ribbon.position.set(side * 0.4, 0.58, -0.08);
        const tailA = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.68, 0.18), aquaGlowMat);
        tailA.position.set(side * 0.48, 0.28, -0.12);
        tailA.rotation.z = side * 0.2;
        const tailB = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.6, 0.16), aquaGlowMat);
        tailB.position.set(side * 0.58, -0.22, -0.14);
        tailB.rotation.z = side * 0.12;
        hairGroup.add(ribbon, tailA, tailB);
      });
      const cyberCollar = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.12, 0.5), magMat);
      cyberCollar.position.set(0, 0.98, 0);
      const idolTie = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.05), aquaGlowMat);
      idolTie.position.set(0, 0.54, 0.26);
      accessoryGroup.add(cyberCollar, idolTie);
    } else if (lookSpec.customSculpt === 'grunge-flannel') {
      const teeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.72 });
      const darkCheckMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.78 });
      const innerTee = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.88, 0.06), teeMat);
      innerTee.position.set(0, 0.52, 0.23);
      const checkA = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.1, 0.51), darkCheckMat);
      checkA.position.set(0, 0.72, 0);
      const checkB = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.1, 0.51), darkCheckMat);
      checkB.position.set(0, 0.38, 0);
      accessoryGroup.add(innerTee, checkA, checkB);
    } else if (lookSpec.customSculpt === 'steampunk-brass') {
      const brassMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.22, metalness: 0.9 });
      const strapMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.58 });
      const harness = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.12, 0.52), strapMat);
      harness.position.set(0, 0.58, 0);
      harness.rotation.z = -0.52;
      const chestGear = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.07, 8), brassMat);
      chestGear.rotation.x = Math.PI * 0.5;
      chestGear.position.set(0, 0.62, 0.26);
      const coatTail = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.54, 0.08), new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.65 }));
      coatTail.position.set(0, -0.14, -0.24);
      accessoryGroup.add(harness, chestGear, coatTail);
    }

    const face = lookSpec.face || {};
    const nextSet = bakeExpressionTextures({
      skin: skinHexStr,
      sunglasses: Boolean(face.sunglasses),
      sunglassesTint: face.sunglassesTint || null,
      smile: originalSpec.smile,
      eyeliner: Boolean(face.eyeliner),
      eyeshadow: face.eyeshadow || null,
      blush: face.blush || null,
      lipColor: face.lipColor || null,
      starMakeup: Boolean(face.starMakeup),
      mustache: Boolean(face.mustache),
      buckTeeth: lookSpec.customSculpt === 'sponge-rocker',
      visorLed: Boolean(face.visorLed),
      fangs: Boolean(face.fangs),
    });
    Object.keys(exprTextures).forEach((k) => {
      exprTextures[k]?.dispose?.();
      exprTextures[k] = nextSet[k];
      exprMats[k].map = nextSet[k];
      exprMats[k].needsUpdate = true;
    });
  }

  function setExpression(exprId = 'grin') {
    const resolved = exprMats[exprId] ? exprId : 'grin';
    if (activeExprId === resolved) return;
    activeExprId = resolved;
    headMesh.material[4] = exprMats[resolved];
  }

  return {
    root,
    upperBody,
    headGroup,
    headMesh,
    hairGroup,
    accessoryGroup,
    leftArmPivot,
    rightArmPivot,
    leftElbowPivot,
    rightElbowPivot,
    leftWristPivot,
    rightWristPivot,
    leftLegPivot,
    rightLegPivot,
    normalFaceMat: exprMats.grin,
    shockedFaceMat: exprMats.shocked,
    applyLook,
    getDanceStyle: () => currentDanceStyle,
    setExpression,
    setShocked(isShocked) {
      setExpression(isShocked ? 'shocked' : 'grin');
    },
    disposeTextures() {
      clearAndDisposeGroup(hairGroup);
      clearAndDisposeGroup(accessoryGroup);
      Object.values(exprTextures).forEach((tex) => tex?.dispose?.());
    },
  };
}

function buildMicStand() {
  const group = new THREE.Group();
  const chrome = new THREE.MeshStandardMaterial({ color: 0xdbeafe, roughness: 0.2, metalness: 0.9 });
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5, metalness: 0.5 });
  const foamMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.88, metalness: 0.08 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.08, 16), baseMat);
  base.position.y = 0.04;
  const poleLower = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, 1.34, 10), baseMat);
  poleLower.position.y = 0.71;
  const clutch = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.11, 10), chrome);
  clutch.position.y = 1.38;
  const poleUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.68, 10), chrome);
  poleUpper.position.y = 1.72;

  // Telescoping boom arm + counterweight + windscreen capsule
  const boomPivot = new THREE.Group();
  boomPivot.position.set(0, 2.04, 0);
  const boomKnuckle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.09, 10), baseMat);
  boomKnuckle.rotation.z = Math.PI * 0.5;
  const boomRod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.72, 8), chrome);
  boomRod.rotation.x = 1.24;
  boomRod.position.set(0, 0.04, -0.06);
  const counterweight = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.12, 10), baseMat);
  counterweight.rotation.x = 1.24;
  counterweight.position.set(0, -0.06, 0.28);
  const micClip = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.022, 0.14, 8), baseMat);
  micClip.rotation.x = 1.05;
  micClip.position.set(0, 0.14, -0.34);
  const micHead = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 12), foamMat);
  micHead.position.set(0, 0.18, -0.4);
  const chromeBand = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.01, 6, 14), chrome);
  chromeBand.rotation.x = 0.9;
  chromeBand.position.set(0, 0.165, -0.375);

  boomPivot.add(boomKnuckle, boomRod, counterweight, micClip, micHead, chromeBand);
  group.add(base, poleLower, clutch, poleUpper, boomPivot);
  return group;
}

/**
 * Builds a sleek wireless stage headset mic for the Pop Diva lineup preset.
 */
function buildVocalistHeadset() {
  const group = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.32, metalness: 0.8 });
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0xf472b6,
    emissive: 0xf472b6,
    emissiveIntensity: 1.4,
    roughness: 0.2,
  });

  const earLoop = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.18), frameMat);
  earLoop.position.set(0.37, 0.3, 0.06);
  const boomArm = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.36, 8), frameMat);
  boomArm.rotation.z = Math.PI * 0.42;
  boomArm.rotation.y = -0.62;
  boomArm.position.set(0.24, 0.2, 0.28);
  const micTip = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 10), glowMat);
  micTip.position.set(0.09, 0.17, 0.38);

  group.add(earLoop, boomArm, micTip);
  group.visible = false;
  return group;
}

function createBrushedMetalTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#181e2c';
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 2) {
    const shade = 20 + Math.floor(Math.sin(y * 0.45) * 6 + Math.random() * 10);
    ctx.fillStyle = `rgb(${shade}, ${shade + 5}, ${shade + 14})`;
    ctx.fillRect(0, y, 256, 1.5);
  }
  // Subtle deck panel seams
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 254, 254);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 4);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createDiamondPlateMaps() {
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 256;
  bumpCanvas.height = 256;
  const bCtx = bumpCanvas.getContext('2d');
  bCtx.fillStyle = '#383838';
  bCtx.fillRect(0, 0, 256, 256);

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = 256;
  roughCanvas.height = 256;
  const rCtx = roughCanvas.getContext('2d');
  rCtx.fillStyle = '#7a7a7a';
  rCtx.fillRect(0, 0, 256, 256);

  const step = 32;
  for (let y = 0; y < 256; y += step) {
    for (let x = 0; x < 256; x += step) {
      const diagA = ((x + y) / step) % 2 === 0;
      const cx = x + step * 0.5;
      const cy = y + step * 0.5;
      const ang = diagA ? Math.PI * 0.25 : -Math.PI * 0.25;

      [
        [bCtx, '#d8d8d8'],
        [rCtx, '#3e3e3e'],
      ].forEach(([c, col]) => {
        c.save();
        c.translate(cx, cy);
        c.rotate(ang);
        c.fillStyle = col;
        c.beginPath();
        c.ellipse(0, 0, 10, 3.4, 0, 0, Math.PI * 2);
        c.fill();
        c.restore();
      });
    }
  }

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(10, 7);
  bumpMap.colorSpace = THREE.NoColorSpace;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(10, 7);
  roughnessMap.colorSpace = THREE.NoColorSpace;

  return { bumpMap, roughnessMap };
}

function createPlankDeckMaps() {
  const diffCanvas = document.createElement('canvas');
  diffCanvas.width = 512;
  diffCanvas.height = 512;
  const dCtx = diffCanvas.getContext('2d');
  dCtx.fillStyle = '#181416';
  dCtx.fillRect(0, 0, 512, 512);

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 512;
  bumpCanvas.height = 512;
  const bCtx = bumpCanvas.getContext('2d');
  bCtx.fillStyle = '#888888';
  bCtx.fillRect(0, 0, 512, 512);

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = 512;
  roughCanvas.height = 512;
  const rCtx = roughCanvas.getContext('2d');
  rCtx.fillStyle = '#707070';
  rCtx.fillRect(0, 0, 512, 512);

  const plankH = 64;
  for (let row = 0; row < 8; row += 1) {
    const y0 = row * plankH;
    const shade = 20 + ((row * 7) % 10);
    dCtx.fillStyle = `rgb(${shade + 4}, ${shade}, ${shade + 2})`;
    dCtx.fillRect(0, y0 + 2, 512, plankH - 4);

    for (let g = 0; g < 16; g += 1) {
      const gy = y0 + 4 + g * 3.6;
      dCtx.strokeStyle = g % 3 === 0 ? 'rgba(0,0,0,0.28)' : 'rgba(110,92,80,0.12)';
      dCtx.lineWidth = 1.4;
      dCtx.beginPath();
      dCtx.moveTo(0, gy);
      dCtx.bezierCurveTo(170, gy + Math.sin(g + row) * 3, 340, gy - Math.cos(g) * 3, 512, gy);
      dCtx.stroke();
    }

    // Dark recessed plank seam
    bCtx.fillStyle = '#1c1c1c';
    bCtx.fillRect(0, y0, 512, 3);
    dCtx.fillStyle = '#090a0e';
    dCtx.fillRect(0, y0, 512, 2);

    // Staggered vertical plank butt-joint + roadcase scuff marks
    const jointX = ((row * 197 + 80) % 440) + 32;
    dCtx.fillRect(jointX, y0, 3, plankH);
    bCtx.fillRect(jointX, y0, 3, plankH);

    rCtx.fillStyle = row % 2 === 0 ? '#5c5c5c' : '#7c7c7c';
    rCtx.fillRect(0, y0 + 3, 512, plankH - 4);
  }

  // Stage-tour wear scuffs & subtle glossy polish lanes
  for (let s = 0; s < 36; s += 1) {
    const sx = (s * 137) % 512;
    const sy = (s * 211) % 512;
    dCtx.fillStyle = 'rgba(180, 192, 215, 0.05)';
    dCtx.fillRect(sx, sy, 28, 3);
    rCtx.fillStyle = '#9a9a9a';
    rCtx.fillRect(sx, sy, 28, 3);
  }

  const map = new THREE.CanvasTexture(diffCanvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(5, 3.5);
  map.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(5, 3.5);
  bumpMap.colorSpace = THREE.NoColorSpace;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(5, 3.5);
  roughnessMap.colorSpace = THREE.NoColorSpace;

  return { map, bumpMap, roughnessMap };
}

function createWoodGrainMaps() {
  const diffCanvas = document.createElement('canvas');
  diffCanvas.width = 256;
  diffCanvas.height = 256;
  const dCtx = diffCanvas.getContext('2d');
  dCtx.fillStyle = '#3c2415';
  dCtx.fillRect(0, 0, 256, 256);

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 256;
  bumpCanvas.height = 256;
  const bCtx = bumpCanvas.getContext('2d');
  bCtx.fillStyle = '#707070';
  bCtx.fillRect(0, 0, 256, 256);

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = 256;
  roughCanvas.height = 256;
  const rCtx = roughCanvas.getContext('2d');
  rCtx.fillStyle = '#9a9a9a';
  rCtx.fillRect(0, 0, 256, 256);

  for (let y = 0; y < 256; y += 3) {
    const wave = Math.sin(y * 0.14) * 6;
    const tone = (y * 17) % 5 === 0 ? 'rgba(20, 10, 4, 0.28)' : 'rgba(120, 74, 42, 0.18)';
    dCtx.strokeStyle = tone;
    dCtx.lineWidth = 2;
    dCtx.beginPath();
    dCtx.moveTo(0, y);
    dCtx.bezierCurveTo(85, y + wave, 170, y - wave, 256, y);
    dCtx.stroke();

    bCtx.strokeStyle = (y * 11) % 3 === 0 ? '#a8a8a8' : '#4a4a4a';
    bCtx.lineWidth = 1.6;
    bCtx.beginPath();
    bCtx.moveTo(0, y);
    bCtx.bezierCurveTo(85, y + wave, 170, y - wave, 256, y);
    bCtx.stroke();

    rCtx.strokeStyle = (y * 7) % 4 === 0 ? '#6e6e6e' : '#b2b2b2';
    rCtx.lineWidth = 1.6;
    rCtx.beginPath();
    rCtx.moveTo(0, y);
    rCtx.bezierCurveTo(85, y + wave, 170, y - wave, 256, y);
    rCtx.stroke();
  }

  const map = new THREE.CanvasTexture(diffCanvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 1);
  map.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(3, 1);
  bumpMap.colorSpace = THREE.NoColorSpace;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(3, 1);
  roughnessMap.colorSpace = THREE.NoColorSpace;

  return { map, bumpMap, roughnessMap };
}

function createAmpGrillTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#12151e';
  ctx.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 4) {
    for (let x = 0; x < 128; x += 4) {
      const alt = ((x + y) / 4) % 2 === 0;
      ctx.fillStyle = alt ? '#272c3a' : '#1b1f2a';
      ctx.fillRect(x, y, 2, 2);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createVolumetricSpotlightMaterial(hexColor, initialOpacity = 0.1) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: new THREE.Color(hexColor) },
      uOpacity: { value: initialOpacity },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewPos;
      void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPos = -mvPosition.xyz;
        vNormalView = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewPos;
      void main() {
        vec3 viewDir = normalize(vViewPos);
        float fresnel = pow(abs(dot(normalize(vNormalView), viewDir)), 1.75);
        float axialFade = smoothstep(0.0, 0.24, vUv.y) * smoothstep(1.0, 0.14, vUv.y);
        float alpha = fresnel * axialFade * uOpacity * 1.95;
        gl_FragColor = vec4(uColor, clamp(alpha, 0.0, 0.55));
      }
    `,
  });
}

function buildAmpStack(accentColor, grillTex, perfMaps = null) {
  const group = new THREE.Group();
  const cabMat = new THREE.MeshStandardMaterial({ color: 0x0e1118, roughness: 0.66, metalness: 0.24 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.24, metalness: 0.88 });
  const grillMat = new THREE.MeshStandardMaterial({
    map: grillTex,
    bumpMap: perfMaps?.bumpMap || null,
    bumpScale: perfMaps ? 0.035 : 0,
    color: 0xffffff,
    roughness: 0.54,
    metalness: 0.46,
  });
  const goldFaceMat = new THREE.MeshStandardMaterial({ color: 0xd4a017, roughness: 0.26, metalness: 0.86 });
  const ledMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 1.75,
  });
  const jewelMat = new THREE.MeshStandardMaterial({
    color: 0xff3b3b,
    emissive: 0xff1e1e,
    emissiveIntensity: 2.6,
    roughness: 0.14,
  });

  // Twin side-by-side Marshall/Ampeg 4x12 full-stack wall-of-sound!
  const subCones = [];
  [-0.92, 0.92].forEach((sx, idx) => {
    const colGroup = new THREE.Group();
    colGroup.position.x = sx;

    const lowerCab = new THREE.Mesh(new THREE.BoxGeometry(1.66, 1.42, 0.96), cabMat);
    lowerCab.position.y = 0.71;
    const lowerGrill = new THREE.Mesh(new THREE.BoxGeometry(1.46, 1.22, 0.06), grillMat);
    lowerGrill.position.set(0, 0.71, 0.47);
    const lowerPiping = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.04, 0.07), trimMat);
    lowerPiping.position.set(0, 1.38, 0.47);

    const upperCab = new THREE.Mesh(new THREE.BoxGeometry(1.64, 1.3, 0.9), cabMat);
    upperCab.position.y = 2.08;
    const upperGrill = new THREE.Mesh(new THREE.BoxGeometry(1.44, 1.1, 0.06), grillMat);
    upperGrill.position.set(0, 2.08, 0.44);

    const headAmp = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.52, 0.8), cabMat);
    headAmp.position.y = 2.98;
    const goldFace = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.16, 0.04), goldFaceMat);
    goldFace.position.set(0, 2.92, 0.4);
    const ledStrip = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.055, 0.06), ledMat);
    ledStrip.position.set(0, 3.12, 0.4);
    // Glowing ruby jewel power pilot lamp + rotary knobs on amp head
    const jewel = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 8), jewelMat);
    jewel.position.set(0.56, 2.92, 0.43);

    colGroup.add(lowerCab, lowerGrill, lowerPiping, upperCab, upperGrill, headAmp, goldFace, ledStrip, jewel);
    if (idx === 0) {
      const subCab = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.94, 0.94), cabMat);
      subCab.position.set(0.92, 0.47, 1.0);
      const subCone = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.24, 0.08, 16), grillMat);
      subCone.rotation.x = Math.PI * 0.5;
      subCone.position.set(0.92, 0.47, 1.48);
      colGroup.add(subCab, subCone);
      subCones.push(subCone);
    }
    group.add(colGroup);
  });

  return { group, ledMat, subCone: subCones[0], grillMat, jewelMat };
}

/**
 * Builds a towering curved 12-cabinet L-Acoustics/JBL-style hanging Line-Array PA banana
 * suspended from outrigger trusses, complete with flying hardware, waveguides & pulsing woofers.
 */
function buildLineArrayStack(side, ledMat, perfMaps = null) {
  const group = new THREE.Group();
  const woofers = [];
  const cabMat = new THREE.MeshStandardMaterial({ color: 0x0d111a, roughness: 0.48, metalness: 0.48 });
  const grillMat = new THREE.MeshStandardMaterial({
    map: perfMaps?.map || null,
    bumpMap: perfMaps?.bumpMap || null,
    bumpScale: perfMaps ? 0.032 : 0,
    color: 0x334155,
    roughness: 0.44,
    metalness: 0.7,
  });
  const wooferMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.46, metalness: 0.58 });
  const dustCapMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.28, metalness: 0.78 });
  const riggingMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.28, metalness: 0.9 });

  // Heavy-duty flying bumper frame + dual steel hoist chains
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.2, 1.12), riggingMat);
  bumper.position.set(0, 0.16, 0);
  const bumperSpine = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.34, 1.24), riggingMat);
  bumperSpine.position.set(0, 0.34, 0);
  group.add(bumper, bumperSpine);

  [-0.58, 0.58].forEach((cx) => {
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.85, 6), riggingMat);
    cable.position.set(cx, 1.12, 0);
    group.add(cable);
  });

  const wooferGeo = new THREE.CylinderGeometry(0.15, 0.095, 0.06, 12);
  const capGeo = new THREE.SphereGeometry(0.06, 8, 8);
  const splayLinkGeo = new THREE.BoxGeometry(0.06, 0.44, 0.12);

  // 12 curved L-Acoustics / JBL J-array PA cabinets forming an authentic stadium acoustic banana
  const count = 12;
  let curY = -0.34;
  let curZ = 0;
  for (let i = 0; i < count; i += 1) {
    const pitch = 0.03 + Math.pow(i / (count - 1), 1.55) * 0.72;
    const unit = new THREE.Group();
    unit.position.set(0, curY, curZ);
    unit.rotation.x = pitch;

    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.42, 0.88), cabMat);
    const grill = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.34, 0.05), grillMat);
    grill.position.z = 0.42;
    const waveguide = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.34, 0.07), riggingMat);
    waveguide.position.z = 0.43;
    const accent = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.34, 0.09), ledMat);
    accent.position.set(side * -0.68, 0, 0.42);
    const linkL = new THREE.Mesh(splayLinkGeo, riggingMat);
    linkL.position.set(-0.76, 0, 0.24);
    const linkR = new THREE.Mesh(splayLinkGeo, riggingMat);
    linkR.position.set(0.76, 0, 0.24);

    // Dual pulsing 12" woofer cones per curved line-array cabinet
    [-0.38, 0.38].forEach((wx) => {
      const coneGroup = new THREE.Group();
      coneGroup.position.set(wx, 0, 0.44);
      const cone = new THREE.Mesh(wooferGeo, wooferMat);
      cone.rotation.x = Math.PI * 0.5;
      const cap = new THREE.Mesh(capGeo, dustCapMat);
      cap.position.z = 0.02;
      coneGroup.add(cone, cap);
      unit.add(coneGroup);
      woofers.push(coneGroup);
    });

    unit.add(cab, grill, waveguide, accent, linkL, linkR);
    group.add(unit);

    curY -= Math.cos(pitch) * 0.46;
    curZ -= Math.sin(pitch) * 0.44;
  }

  return { group, woofers };
}

/**
 * 100% Procedural WebAudio Stadium Crowd Sing-Along, Acoustic Clap-Along & Cheer Engine.
 * Hosted inside StageBand and clocked by game audio context & crowd volume slider.
 */
export class StageCrowdAmbience {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.compressor = null;
    this.noiseBuffer = null;
    this.roarGain = null;
    this.roarFilter = null;
    this.roarSource = null;
    this.choirGain = null;
    this.choirOscA = null;
    this.choirOscB = null;
    this.choirFilterA = null;
    this.choirFilterB = null;
    this.volume = 0.75;
    this.lastClapBeat = -999;
    this.lastClapHalf = -999;
    this.initialized = false;
    this.muted = false;
  }

  attachAudioContext(ctx) {
    if (!ctx || this.ctx === ctx) return;
    this.dispose();
    this.ctx = ctx;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 18;
    comp.ratio.value = 6;
    comp.attack.value = 0.008;
    comp.release.value = 0.22;

    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : this.volume * 0.34;
    comp.connect(master);
    master.connect(ctx.destination);

    this.compressor = comp;
    this.masterGain = master;

    // 3-second seamless pink-noise buffer (reused cleanly for claps, roars & stadium air)
    const len = Math.floor(ctx.sampleRate * 3.0);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch += 1) {
      const data = buf.getChannelData(ch);
      let b0 = 0; let b1 = 0; let b2 = 0; let b3 = 0; let b4 = 0; let b5 = 0; let b6 = 0;
      for (let i = 0; i < len; i += 1) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        const val = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.09;
        b6 = white * 0.115926;
        data[i] = val;
      }
    }
    this.noiseBuffer = buf;

    // Continuous stadium crowd roar bed (starts silent)
    const roarSrc = ctx.createBufferSource();
    roarSrc.buffer = buf;
    roarSrc.loop = true;
    const roarFilter = ctx.createBiquadFilter();
    roarFilter.type = 'bandpass';
    roarFilter.frequency.value = 780;
    roarFilter.Q.value = 0.85;
    const roarGain = ctx.createGain();
    roarGain.gain.value = 0;
    roarSrc.connect(roarFilter);
    roarFilter.connect(roarGain);
    roarGain.connect(comp);
    roarSrc.start();
    this.roarSource = roarSrc;
    this.roarFilter = roarFilter;
    this.roarGain = roarGain;

    // Dual-formant "WHOA-OH" stadium sing-along choir bed
    const oscA = ctx.createOscillator();
    oscA.type = 'sawtooth';
    oscA.frequency.value = 196; // G3
    const oscB = ctx.createOscillator();
    oscB.type = 'sawtooth';
    oscB.frequency.value = 293.66; // D4 fifth harmony

    const fA = ctx.createBiquadFilter();
    fA.type = 'bandpass';
    fA.frequency.value = 460;
    fA.Q.value = 3.2;

    const fB = ctx.createBiquadFilter();
    fB.type = 'bandpass';
    fB.frequency.value = 1120;
    fB.Q.value = 3.5;

    const choirGain = ctx.createGain();
    choirGain.gain.value = 0;

    oscA.connect(fA);
    oscB.connect(fB);
    fA.connect(choirGain);
    fB.connect(choirGain);
    choirGain.connect(comp);
    oscA.start();
    oscB.start();

    this.choirOscA = oscA;
    this.choirOscB = oscB;
    this.choirFilterA = fA;
    this.choirFilterB = fB;
    this.choirGain = choirGain;
    this.initialized = true;
  }

  setVolume(vol, muted = false) {
    this.volume = Math.max(0, Math.min(1, Number(vol) || 0));
    this.muted = Boolean(muted);
    if (this.masterGain && this.ctx) {
      const target = this.muted ? 0 : this.volume * 0.34;
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
    }
  }

  silence() {
    if (!this.initialized || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.roarGain?.gain.setTargetAtTime(0, now, 0.08);
    this.choirGain?.gain.setTargetAtTime(0, now, 0.08);
  }

  triggerBeatClap(strength = 0.7, pan = 0) {
    if (!this.initialized || !this.ctx || !this.noiseBuffer || !this.compressor) return;
    if (this.muted || this.volume <= 0.02) return;
    const now = this.ctx.currentTime;
    const s = Math.max(0.15, Math.min(1.2, strength));
    // Layer 3 staggered palm hits across arena stereo width for acoustic room realism
    const offsets = [0, 0.015, 0.031];
    offsets.forEach((off, idx) => {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1150 + idx * 320;
      bp.Q.value = 1.4;
      const g = this.ctx.createGain();
      const peak = (0.14 * s) / (1 + idx * 0.35);
      g.gain.setValueAtTime(0.0001, now + off);
      g.gain.linearRampToValueAtTime(peak, now + off + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, now + off + 0.11);

      if (this.ctx.createStereoPanner) {
        const panner = this.ctx.createStereoPanner();
        panner.pan.value = Math.max(-0.85, Math.min(0.85, pan + (idx - 1) * 0.34));
        src.connect(bp);
        bp.connect(g);
        g.connect(panner);
        panner.connect(this.compressor);
      } else {
        src.connect(bp);
        bp.connect(g);
        g.connect(this.compressor);
      }
      src.start(now + off, Math.random() * 1.4, 0.14);
    });
  }

  triggerMilestoneRoar(intensity = 1.0) {
    if (!this.initialized || !this.ctx || !this.noiseBuffer || !this.compressor) return;
    if (this.muted || this.volume <= 0.02) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(620, now);
    bp.frequency.linearRampToValueAtTime(1450, now + 0.35);
    bp.frequency.linearRampToValueAtTime(840, now + 1.5);
    bp.Q.value = 0.9;
    const g = this.ctx.createGain();
    const peak = Math.min(0.45, 0.24 * Math.max(0.5, intensity));
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(peak, now + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0008, now + 1.65);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.compressor);
    src.start(now, Math.random() * 0.8, 1.75);
  }

  update({ playing = false, songTime = 0, bpm = 120, beatPhase = 0, combo = 0, hypeNorm = 0.55, sectionType = 'VERSE', fever = false, encore = false } = {}) {
    if (!this.initialized || !this.ctx || this.ctx.state !== 'running') return;
    if (!playing || songTime < -0.5) {
      this.silence();
      return;
    }

    const now = this.ctx.currentTime;
    const isSingSection = sectionType === 'CHORUS' || sectionType === 'OUTRO' || sectionType === 'PRE_CHORUS' || fever || encore;
    const isClapSection =
      sectionType === 'VERSE' ||
      sectionType === 'PRE_CHORUS' ||
      sectionType === 'BRIDGE' ||
      sectionType === 'OUTRO' ||
      encore;

    // 1. Dynamic crowd ambience roar swelling smoothly with hype & combo
    const roarLevel = Math.min(
      0.16,
      Math.max(0.012, (hypeNorm * 0.08 + Math.min(1, combo / 80) * 0.06) * (isSingSection || fever || encore ? 1.35 : 0.8))
    );
    this.roarGain?.gain.setTargetAtTime(roarLevel, now, 0.12);
    this.roarFilter?.frequency.setTargetAtTime(720 + hypeNorm * 580 + (fever ? 240 : 0), now, 0.16);

    // 2. Formant "WHOA-OH" choir swell during Choruses / High Streak / Fever / Encore
    const choirEligible = combo >= 20 || hypeNorm >= 0.72 || fever || encore;
    const targetChoir = choirEligible && isSingSection
      ? Math.min(0.055, 0.016 + Math.min(1, combo / 100) * 0.025 + (fever || encore ? 0.015 : 0))
      : 0;
    this.choirGain?.gain.setTargetAtTime(targetChoir, now, 0.18);
    if (targetChoir > 0.002 && this.choirFilterA && this.choirFilterB) {
      const vowelPhase = 0.5 + 0.5 * Math.sin(songTime * (bpm / 60) * Math.PI * 0.5);
      this.choirFilterA.frequency.setTargetAtTime(410 + vowelPhase * 150, now, 0.08);
      this.choirFilterB.frequency.setTargetAtTime(980 + vowelPhase * 620, now, 0.08);
    }

    // 3. Rhythmic beatPhase-locked acoustic palm clap-along (strict edge-trigger once per beat!)
    if (songTime >= 0 && isClapSection && hypeNorm >= 0.36) {
      const beatIndex = Math.floor(songTime * (bpm / 60) + 0.04);
      if (beatIndex > this.lastClapBeat) {
        this.lastClapBeat = beatIndex;
        // Double clap feel during Chorus/Outro/Encore, backbeat (2 & 4) during Verse/Bridge
        const isBackbeat = beatIndex % 2 === 1;
        if (sectionType === 'PRE_CHORUS' || sectionType === 'OUTRO' || encore || isBackbeat) {
          this.triggerBeatClap(0.55 + hypeNorm * 0.45, ((beatIndex % 3) - 1) * 0.25);
        }
      }
    } else if (songTime < 0) {
      this.lastClapBeat = -999;
    }
  }

  dispose() {
    try { this.roarSource?.stop?.(); } catch {}
    try { this.choirOscA?.stop?.(); } catch {}
    try { this.choirOscB?.stop?.(); } catch {}
    try { this.masterGain?.disconnect?.(); } catch {}
    this.roarSource = null;
    this.choirOscA = null;
    this.choirOscB = null;
    this.masterGain = null;
    this.compressor = null;
    this.initialized = false;
  }
}

export class StageBand {
  constructor(
    canvas,
    {
      venueId = 'philippine-arena',
      venueOverlayId = 'STANDARD',
      cameraMode = 'on',
      bandLineupId = 'arena-4piece',
      guitarModelId = 'les-paul-sunburst',
      bassModelId = 'precision-blonde',
      drumKitModelId = 'pop-single-kick',
      keyboardModelId = 'concert-grand',
      starLookId = 'default-band',
      instrumentSkinId = 'classic-sunburst',
      instrumentSkins = null,
      onFireworkLaunch = null,
      onFireworkBurst = null,
      onProjectileImpact = null,
    } = {}
  ) {
    this.canvas = canvas;
    this.disposed = false;
    this.isSoftwareGl = false;
    this.clock = 0;

    // Active venue, overlay, lineup, custom 3D gear, star looks, per-instrument PBR skins, camera director & lighting profiles
    this.venueId = venueId || 'philippine-arena';
    this.venueOverlayId = venueOverlayId || 'STANDARD';
    this.overlayMeta = getStageOverlayById(this.venueOverlayId);
    this.venueEnv = null;
    this.cameraMode = cameraMode; // 'on' | 'subtle' | 'locked'
    this.bandLineupId = bandLineupId;
    this.bandLineup = getBandLineupById(bandLineupId);
    this.guitarModelId = guitarModelId;
    this.bassModelId = bassModelId;
    this.drumKitModelId = drumKitModelId;
    this.keyboardModelId = keyboardModelId;
    this.starLookId = starLookId;
    this.instrumentSkinId = instrumentSkinId;
    this.instrumentSkins = {
      guitar: instrumentSkins?.guitar || instrumentSkinId,
      bass: instrumentSkins?.bass || instrumentSkinId,
      drums: instrumentSkins?.drums || instrumentSkinId,
      piano: instrumentSkins?.piano || instrumentSkinId,
    };
    this.onFireworkLaunch = onFireworkLaunch;
    this.onFireworkBurst = onFireworkBurst;
    this.onProjectileImpact = onProjectileImpact;

    // 60 FPS Adaptive Quality Guard & Angry Crowd Projectile / Flinch state
    this.adaptiveLowPower = false;
    this.flinchTimers = { guitar: 0, bass: 0, drums: 0, piano: 0, vocals: 0 };
    this.lastThrowClock = -10;
    this.projectilePool = [];
    this.splatParticles = [];
    this.splatCursor = 0;
    this.ampGrillMats = [];
    this.streakPyroCooldown = 0;
    this.breActive = false;
    this.playerGoldAura = null;
    this.playerGoldAuraRingMat = null;
    this.playerGoldAuraBeamMat = null;
    this.playerGoldAuraOpacity = 0;

    this.guitarAsset = null;
    this.bassAsset = null;
    this.drumKitAsset = null;
    this.keyboardAsset = null;
    this.pianoRigGroup = null;
    this.vocalistHeadsetGroup = null;

    this.cameraDirector = new CameraDirector();
    this.cameraDirector.setMode(cameraMode);
    this.lightingController = new LightingProfileController();
    this.lightingState = null;

    this.activeInstrument = 'guitar';
    this.activeInstruments = ['guitar'];
    this.feverActive = false;
    this.encorePerformanceActive = false;
    this.currentTrackTitle = 'ENCORE STAGE';
    this.missedInstrument = null;
    this.missedInstruments = new Set();
    this.crowdAmbience = new StageCrowdAmbience();

    // Encore Finale celebration state
    this.grandEncoreActive = false;
    this.encoreFinaleActive = false;
    this.encoreGrade = 'A';
    this.finaleFireworkTimer = 0;
    this.finaleConfettiTimer = 0;
    this.feverFireworkTimer = 0;
    this.hasActiveFireworks = false;
    this.pyroFlameIntensity = 0;
    this.pyroFlameTimer = 0;
    this.sparkEmitterTimer = 0;
    this._encoreNightColor = new THREE.Color(0x050816);
    this._venueSkyColor = new THREE.Color(0x050814);

    // Note-driven band animation impulses (deep instrument-matched performance)
    this.guitarStrumImpulse = 0;
    this.guitarStrumDir = 1;
    this.guitarFretPos = 0.5; // 0..1 along guitar neck from pitchNorm
    this.guitarHeadbangBoost = 0;

    this.bassPluckImpulse = 0;
    this.bassFretPos = 0.4;
    this.bassBounceImpulse = 0;

    this.drumLeftHit = 0;
    this.drumRightHit = 0;
    this.drumLeftTarget = 'snare';
    this.drumRightTarget = 'hihat';
    this.drumKickImpulse = 0;
    this.cymbalWobble = [0, 0, 0];
    this.cymbalPhase = [0, 0, 0];

    this.pianoHitImpulse = 0;
    this.pianoHandPos = 0.5;
    this.pianoGlissando = 0;
    this.pianoHandAlt = 1;
    this.lastPianoHand = 'right';
    this.lastTrackMeta = null;
    this.balladDustAlpha = 0;

    // Live LED backdrop screen + VIP Front-Row Banner update throttling + peak-hold caps
    this.ledUpdateTimer = 0;
    this.ledBarLevels = new Float32Array(24);
    this.ledPeakLevels = new Float32Array(24);
    this.cryoBurstTimer = 0;

    // Deterministic Crowd Event State Machine (Zero GC)
    this.crowdEvent = {
      type: 'NORMAL', // 'NORMAL' | 'MOSHPIT' | 'SUNTUKAN' | 'CRYING_SWAY' | 'CROWD_SURFING' | 'STADIUM_WAVE'
      timer: 0,
      duration: 0,
      cooldown: 4.5,
      seed: 4242,
      centerX: 0,
      centerZ: 14.8,
      fighterAIdx: -1,
      fighterBIdx: -1,
      surferX: -6.5,
      surferZ: 12.85,
    };
    this.activeCrowdEvent = { type: 'NORMAL' };
    this.crowdThrowerIdx = -1;
    this.crowdThrowWindup = 0;
    this.prevCrowdStreak = 0;
    this.crowdLastSection = null;
    this.crowdSurferDir = 1;

    // Dynamic Stage Roaming, Walking, Pacing, Power-Slide, Back-to-Back & Beat-Synced Jump State Machines
    const makeMotion = (x, z, rotY) => ({
      x,
      z,
      rotY,
      targetX: x,
      targetZ: z,
      targetRotY: rotY,
      vx: 0,
      vz: 0,
      vRotY: 0,
      walkPhase: 0,
      moveSpeed: 0,
      jumpY: 0,
      jumpVel: 0,
      crouchTimer: 0,
      pendingJumpVel: 0,
      squash: 0,
      kneeDrop: 0,
      vKneeDrop: 0,
      windmillTimer: 0,
      windmillPhase: 0,
      fistPumpWeight: 0,
      stanceMode: 'HOME', // 'HOME' | 'PACE' | 'EDGE_MONITOR' | 'BACK_TO_BACK' | 'MIC_CENTER' | 'POWER_STANCE' | 'POWER_SLIDE' | 'TRUSS_STRIDE' | 'KNEE_DROP_SOLO' | 'ENCORE_SLIDE'
      action: 'SPOTLIGHT_SWAY',
      actionHistory: [],
      actionTimer: 0,
      modeTimer: 0,
      spinRemaining: 0,
      sustainLean: 0,
    });
    this.memberMotion = {
      guitar: makeMotion(-4.5, 1.0, 0.24),
      bass: makeMotion(4.5, 1.0, -0.24),
      vocals: makeMotion(0, 2.0, 0),
    };
    this.stageChoreoTimer = 0;
    this.stageChoreoStep = 0;
    this.lastJumpBeat = -999;
    this.lastChoreoSectionId = null;
    this.markovSeed = 1337;

    // Live 30 FPS Offscreen IMAG RenderTarget & Telephoto Soloist Camera (zero per-frame heap allocations)
    this.jumbotronTarget = null;
    this.jumbotronCam = null;
    this.imagMeshes = [];
    this._imagFrameToggle = 0;
    this._imagLookTarget = new THREE.Vector3(0, 1.5, 0);
    this._imagLastSectionType = 'LIVE';
    this._imagLastBannerText = '';

    // Pre-allocated live world positions fed to CameraDirector & IMAG camera every frame (zero GC!)
    this.livePositions = {
      guitar: { x: -4.5, y: STAGE_DECK_TOP_Y, z: 1.0 },
      bass: { x: 4.5, y: STAGE_DECK_TOP_Y, z: 1.0 },
      drums: { x: 0, y: DRUM_RISER_TOP_Y, z: -2.8 },
      piano: { x: 6.5, y: KEYS_RISER_TOP_Y, z: -1.8 },
      vocals: { x: 0, y: STAGE_DECK_TOP_Y, z: 2.0 },
    };

    // Base home rig kept for immediate init framing before CameraDirector ticks
    this.cameraRig = {
      azimuth: 0,
      radius: 17.2,
      height: 5.2,
      target: new THREE.Vector3(0, 2.1, -1.2),
      desiredAzimuth: 0,
      desiredRadius: 17.2,
      desiredHeight: 5.2,
      desiredTarget: new THREE.Vector3(0, 2.1, -1.2),
      reverseSign: 1,
      modeTimer: 0,
      prevReverseActive: false,
    };

    // Reusable scratch math helpers
    this._dummy = new THREE.Object3D();
    this._colorA = new THREE.Color();
    this._colorB = new THREE.Color();
    this._colorC = new THREE.Color();

    this.initScene();
  }

  initScene() {
    const probeCanvas = document.createElement('canvas');
    const probeGl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (probeGl) {
      const ext = probeGl.getExtension('WEBGL_debug_renderer_info');
      const rStr = ext ? String(probeGl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
      this.isSoftwareGl = /swiftshader|llvmpipe|software/i.test(rStr);
    }

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: !this.isSoftwareGl,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.isSoftwareGl ? 1 : 1.5));

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050814);
    this.scene.fog = new THREE.FogExp2(0x060a18, 0.014);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRenderTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRenderTarget.texture;
    this.scene.environmentIntensity = 0.72;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.2, 900);
    this.applyCameraRigImmediate();

    this.glowTex = createGlowParticleTexture();

    this.jumbotronTarget = new THREE.WebGLRenderTarget(384, 216, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
    });
    this.jumbotronTarget.texture.colorSpace = THREE.SRGBColorSpace;
    this.jumbotronCam = new THREE.PerspectiveCamera(32, 384 / 216, 0.25, 95);

    this.buildLights();
    this.buildConcertStage();
    this.buildPerformingBand();
    this.buildFullBodiedCrowd3D();
    this.buildPyrotechnicsAndFX();
    this.buildCrowdProjectilePool();
    this.setVenue(this.venueId, this.venueOverlayId);

    this.resize();
  }

  applyCameraRigImmediate() {
    const r = this.cameraRig;
    const x = r.target.x + Math.sin(r.azimuth) * r.radius;
    const z = r.target.z + Math.cos(r.azimuth) * r.radius;
    this.camera.position.set(x, r.height, z);
    this.camera.lookAt(r.target);
  }

  buildLights() {
    this.hemiLight = new THREE.HemisphereLight(0x7dd3fc, 0x0f172a, 0.84);
    this.scene.add(this.hemiLight);

    this.frontKey = new THREE.DirectionalLight(0xe0f2fe, 0.82);
    this.frontKey.position.set(0, 13.5, 14.5);
    if (!this.isSoftwareGl) {
      this.frontKey.castShadow = true;
      this.frontKey.shadow.mapSize.set(1024, 1024);
      this.frontKey.shadow.camera.near = 2;
      this.frontKey.shadow.camera.far = 42;
      this.frontKey.shadow.camera.left = -16;
      this.frontKey.shadow.camera.right = 16;
      this.frontKey.shadow.camera.top = 14;
      this.frontKey.shadow.camera.bottom = -8;
      this.frontKey.shadow.bias = -0.0008;
    }
    this.scene.add(this.frontKey);

    // Balanced multi-angle rear & side rim lighting covering the 28m pro-touring stage
    this.bandRimLight = new THREE.DirectionalLight(0x93c5fd, 2.35);
    this.bandRimLight.position.set(0, 10.5, -12.5);
    this.scene.add(this.bandRimLight);

    this.bandRimSideL = new THREE.DirectionalLight(0x38bdf8, 1.35);
    this.bandRimSideL.position.set(-13.5, 8.5, -8.5);
    this.scene.add(this.bandRimSideL);

    this.bandRimSideR = new THREE.DirectionalLight(0xf59e0b, 1.35);
    this.bandRimSideR.position.set(13.5, 8.5, -8.5);
    this.scene.add(this.bandRimSideR);

    // Subtle crowd uplight so reverse behind-the-band angles showcase the 3D fans vividly!
    this.crowdLight = new THREE.PointLight(0x38bdf8, 18, 42, 1.25);
    this.crowdLight.position.set(0, 5.5, 14.5);
    this.scene.add(this.crowdLight);

    this.memberSpots = {};
    const spotConfigs = [
      { key: 'guitar', x: -4.5, z: 1.0, targetY: 1.2, color: THEME_COLORS.guitar },
      { key: 'bass', x: 4.5, z: 1.0, targetY: 1.2, color: THEME_COLORS.bass },
      { key: 'drums', x: 0.0, z: -2.8, targetY: 1.8, color: THEME_COLORS.drums },
      { key: 'piano', x: 6.5, z: -1.8, targetY: 1.5, color: THEME_COLORS.piano },
      { key: 'vocals', x: 0.0, z: 2.0, targetY: 1.3, color: 0xe2e8f0 },
    ];

    const coneGeo = new THREE.ConeGeometry(3.2, 13.8, 24, 1, true);
    coneGeo.translate(0, -6.9, 0);

    spotConfigs.forEach((cfg) => {
      const spot = new THREE.SpotLight(cfg.color, 42, 36, Math.PI / 4.8, 0.62, 1.15);
      spot.position.set(cfg.x * 1.15, 13.2, cfg.z + 2.2);
      // Strict 2-light shadow budget: frontKey + 1 primary hero spotlight ('guitar')
      if (!this.isSoftwareGl && cfg.key === 'guitar') {
        spot.castShadow = true;
        spot.shadow.mapSize.set(1024, 1024);
        spot.shadow.camera.near = 2;
        spot.shadow.camera.far = 32;
        spot.shadow.bias = -0.001;
      } else {
        spot.castShadow = false;
      }
      const target = new THREE.Object3D();
      target.position.set(cfg.x, cfg.targetY, cfg.z);
      this.scene.add(target);
      spot.target = target;
      this.scene.add(spot);

      // Soft-edge Fresnel volumetric beam shader (zero hard triangle clipping!)
      const coneMat = createVolumetricSpotlightMaterial(cfg.color, 0.11);
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.copy(spot.position);
      cone.lookAt(target.position);
      cone.rotateX(-Math.PI * 0.5);
      this.scene.add(cone);

      this.memberSpots[cfg.key] = {
        spot,
        target,
        baseTargetX: cfg.x,
        baseTargetZ: cfg.z,
        cone,
        coneMat,
        baseColor: new THREE.Color(cfg.color),
      };
    });
  }

  buildConcertStage() {
    const stageGroup = new THREE.Group();
    this.stageExtraDisposables = [];

    // Scuffed dark concert timber plank stage deck + diamond plate steel risers + perforated grilles
    this.deckTex = createBrushedMetalTexture();
    this.deckMaps = createDiamondPlateMaps();
    this.plankDeckMaps = createPlankDeckMaps();
    this.woodMaps = createWoodGrainMaps();
    this.perforatedMaps = createPerforatedSteelMaps();
    this.ampGrillTex = createAmpGrilleSkinTexture(this.instrumentSkinId);

    const maxAniso = Math.min(8, this.renderer?.capabilities?.getMaxAnisotropy?.() || 4);
    [
      this.deckTex,
      this.deckMaps.bumpMap,
      this.deckMaps.roughnessMap,
      this.plankDeckMaps.map,
      this.plankDeckMaps.bumpMap,
      this.plankDeckMaps.roughnessMap,
      this.woodMaps.map,
      this.woodMaps.bumpMap,
      this.woodMaps.roughnessMap,
      this.perforatedMaps.map,
      this.perforatedMaps.bumpMap,
      this.ampGrillTex,
    ].forEach((tex) => {
      if (tex) tex.anisotropy = maxAniso;
    });

    // Main timber plank deck material (top strictly at STAGE_DECK_TOP_Y = 0) with clearcoat sheen
    const plankDeckMat = new THREE.MeshPhysicalMaterial({
      map: this.plankDeckMaps.map,
      bumpMap: this.plankDeckMaps.bumpMap,
      bumpScale: 0.026,
      roughnessMap: this.plankDeckMaps.roughnessMap,
      color: 0xe2e8f0,
      roughness: 0.36,
      metalness: 0.16,
      clearcoat: 0.44,
      clearcoatRoughness: 0.26,
      reflectivity: 0.74,
    });
    const deckMat = new THREE.MeshStandardMaterial({
      map: this.deckTex,
      bumpMap: this.deckMaps.bumpMap,
      bumpScale: 0.032,
      roughnessMap: this.deckMaps.roughnessMap,
      color: 0xdbeafe,
      roughness: 0.34,
      metalness: 0.72,
    });

    // 1. EXPANDED 38m MULTI-WING STADIUM DECK
    //    Main performance deck: x: [-16, 16] (32m wide), z: [-8.5, 5.5] (14m deep), top strictly at y = 0
    const deck = new THREE.Mesh(new THREE.BoxGeometry(32.0, 2.2, 14.0), plankDeckMat);
    deck.position.set(0, -1.1, -1.5);
    deck.receiveShadow = true;
    stageGroup.add(deck);

    //    Angled Left & Right PA / Monitor Thrust Wings (x: [-21, -16] and [16, 21], flush at y = 0)
    [-1, 1].forEach((side) => {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(5.6, 2.2, 11.2), plankDeckMat);
      wing.position.set(side * 18.4, -1.1, -0.8);
      wing.rotation.y = side * -0.18;
      wing.receiveShadow = true;
      stageGroup.add(wing);

      const wingEdge = new THREE.Mesh(new THREE.BoxGeometry(5.7, 0.12, 0.14), deckMat);
      wingEdge.position.set(side * 18.4, -0.02, 4.72);
      wingEdge.rotation.y = side * -0.18;
      stageGroup.add(wingEdge);
    });

    //    Extended Center T-Catwalk (z: [5.5, 11.0], width 3.2m) terminating in Illuminated Octagonal B-Stage (radius: 3.4m, centered at z = 11.0)
    const catwalkShaft = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.2, 5.8), plankDeckMat);
    catwalkShaft.position.set(0, -1.1, 8.3);
    catwalkShaft.receiveShadow = true;

    const bStageGeo = new THREE.CylinderGeometry(3.4, 3.58, 2.2, 8);
    const bStageDeck = new THREE.Mesh(bStageGeo, plankDeckMat);
    bStageDeck.position.set(0, -1.1, 11.0);
    bStageDeck.rotation.y = Math.PI / 8;
    bStageDeck.receiveShadow = true;
    stageGroup.add(catwalkShaft, bStageDeck);

    // 2. INTERACTIVE ANIMATED LED STAGE FLOOR MATRIX + WARM ADDRESSABLE EDGE STEP-STRIPS
    this.stageFloorCanvas = document.createElement('canvas');
    this.stageFloorCanvas.width = 512;
    this.stageFloorCanvas.height = 512;
    this.stageFloorCtx = this.stageFloorCanvas.getContext('2d');
    this.stageFloorTex = new THREE.CanvasTexture(this.stageFloorCanvas);
    this.stageFloorTex.colorSpace = THREE.SRGBColorSpace;
    this.stageFloorTex.anisotropy = maxAniso;

    this.stageFloorMat = new THREE.MeshStandardMaterial({
      map: this.stageFloorTex,
      emissiveMap: this.stageFloorTex,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.94,
      roughness: 0.24,
      metalness: 0.32,
      transparent: true,
      opacity: 0.88,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    const mainLedFloor = new THREE.Mesh(new THREE.PlaneGeometry(25.6, 11.4), this.stageFloorMat);
    mainLedFloor.rotation.x = -Math.PI * 0.5;
    mainLedFloor.position.set(0, 0.012, -1.1);
    const catwalkLedFloor = new THREE.Mesh(new THREE.PlaneGeometry(2.45, 5.4), this.stageFloorMat);
    catwalkLedFloor.rotation.x = -Math.PI * 0.5;
    catwalkLedFloor.position.set(0, 0.014, 8.2);
    const bStageLedPad = new THREE.Mesh(new THREE.CircleGeometry(2.96, 8), this.stageFloorMat);
    bStageLedPad.rotation.x = -Math.PI * 0.5;
    bStageLedPad.rotation.z = Math.PI / 8;
    bStageLedPad.position.set(0, 0.016, 11.0);
    stageGroup.add(mainLedFloor, catwalkLedFloor, bStageLedPad);

    // Lower front stage apron fascia with wood-grain trim
    const apronMat = new THREE.MeshStandardMaterial({
      map: this.woodMaps.map,
      bumpMap: this.woodMaps.bumpMap,
      bumpScale: 0.024,
      roughnessMap: this.woodMaps.roughnessMap,
      color: 0x241a18,
      roughness: 0.56,
      metalness: 0.24,
    });
    [-8.9, 8.9].forEach((ax) => {
      const apronWing = new THREE.Mesh(new THREE.BoxGeometry(14.6, 0.56, 0.54), apronMat);
      apronWing.position.set(ax, -0.96, 5.64);
      stageGroup.add(apronWing);
    });

    // Primary beat-reactive LED trim + warm addressable edge step-strips
    this.stageRimMat = new THREE.MeshStandardMaterial({
      color: THEME_COLORS.guitar,
      emissive: THEME_COLORS.guitar,
      emissiveIntensity: 1.75,
      roughness: 0.2,
    });
    this.stepStripMat = new THREE.MeshStandardMaterial({
      color: 0xfff7ed,
      emissive: 0xffb347,
      emissiveIntensity: 1.45,
      roughness: 0.22,
    });
    this.venueTrussTrimMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x38bdf8,
      emissiveIntensity: 1.35,
      roughness: 0.22,
      metalness: 0.68,
    });
    this.riserFasciaMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.85,
      roughness: 0.16,
      metalness: 0.08,
      clearcoat: 1.0,
    });

    [-8.8, 8.8].forEach((rx) => {
      const wingRim = new THREE.Mesh(new THREE.BoxGeometry(14.5, 0.11, 0.12), this.stageRimMat);
      wingRim.position.set(rx, -0.02, 5.52);
      const wingStepStrip = new THREE.Mesh(new THREE.BoxGeometry(14.4, 0.04, 0.06), this.stepStripMat);
      wingStepStrip.position.set(rx, 0.022, 5.44);
      const wingApronRim = new THREE.Mesh(new THREE.BoxGeometry(14.5, 0.07, 0.09), this.stageRimMat);
      wingApronRim.position.set(rx, -0.74, 5.92);
      stageGroup.add(wingRim, wingStepStrip, wingApronRim);
    });
    [-1.62, 1.62].forEach((cx) => {
      const shaftRim = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.11, 5.1), this.stageRimMat);
      shaftRim.position.set(cx, -0.02, 8.0);
      const shaftStep = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 5.0), this.stepStripMat);
      shaftStep.position.set(cx * 0.94, 0.022, 8.0);
      stageGroup.add(shaftRim, shaftStep);
    });
    // Octagonal B-Stage glowing perimeter rim & step-strip halo
    const bStageRim = new THREE.Mesh(new THREE.TorusGeometry(3.42, 0.075, 8, 8), this.stageRimMat);
    bStageRim.rotation.x = Math.PI * 0.5;
    bStageRim.rotation.z = Math.PI / 8;
    bStageRim.position.set(0, -0.03, 11.0);
    const bStageStepHalo = new THREE.Mesh(new THREE.TorusGeometry(3.22, 0.035, 6, 8), this.stepStripMat);
    bStageStepHalo.rotation.x = Math.PI * 0.5;
    bStageStepHalo.rotation.z = Math.PI / 8;
    bStageStepHalo.position.set(0, 0.024, 11.0);
    const bStageApronHalo = new THREE.Mesh(new THREE.TorusGeometry(3.54, 0.055, 6, 8), this.stageRimMat);
    bStageApronHalo.rotation.x = Math.PI * 0.5;
    bStageApronHalo.rotation.z = Math.PI / 8;
    bStageApronHalo.position.set(0, -0.78, 11.0);
    stageGroup.add(bStageRim, bStageStepHalo, bStageApronHalo);

    // 3. GLOWING FRONT-ROW CROWD BARRICADE PERIMETER (strictly wrapping 38m stage + catwalk + circular B-stage)
    const barFrameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.38, metalness: 0.82 });
    const barPanelMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.75, metalness: 0.25 });
    const addBarricadeSegment = (x1, z1, x2, z2, posts = 4) => {
      const dx = x2 - x1;
      const dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      const ang = Math.atan2(dx, dz);
      const midX = (x1 + x2) * 0.5;
      const midZ = (z1 + z2) * 0.5;
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, len, 10), barFrameMat);
      rail.rotation.x = Math.PI * 0.5;
      rail.rotation.z = -ang;
      rail.position.set(midX, -0.04, midZ);
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.045, len), this.stageRimMat);
      led.rotation.y = ang;
      led.position.set(midX, -0.08, midZ);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.96, len), barPanelMat);
      panel.rotation.y = ang;
      panel.position.set(midX, -0.64, midZ);
      stageGroup.add(rail, led, panel);
      for (let p = 0; p < posts; p += 1) {
        const t = posts > 1 ? p / (posts - 1) : 0.5;
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.18, 0.14), barFrameMat);
        post.position.set(x1 + dx * t, -0.62, z1 + dz * t);
        stageGroup.add(post);
      }
    };
    addBarricadeSegment(-21.2, 5.2, -16.6, 6.25, 3);
    addBarricadeSegment(-16.6, 6.25, -2.4, 6.25, 6);
    addBarricadeSegment(2.4, 6.25, 16.6, 6.25, 6);
    addBarricadeSegment(16.6, 6.25, 21.2, 5.2, 3);
    addBarricadeSegment(-2.4, 6.25, -2.4, 8.2, 2);
    addBarricadeSegment(2.4, 6.25, 2.4, 8.2, 2);
    // Octagonal B-Stage wraparound barricade at radius 4.05m centered at (0, 11.0)
    const bBarR = 4.05;
    const bBarAngles = [-2.18, -1.52, -0.88, -0.3, 0.3, 0.88, 1.52, 2.18];
    const bBarPts = bBarAngles.map((a) => ({ x: Math.sin(a) * bBarR, z: 11.0 + Math.cos(a) * bBarR }));
    addBarricadeSegment(-2.4, 8.2, bBarPts[0].x, bBarPts[0].z, 2);
    for (let i = 0; i < bBarPts.length - 1; i += 1) {
      addBarricadeSegment(bBarPts[i].x, bBarPts[i].z, bBarPts[i + 1].x, bBarPts[i + 1].z, 2);
    }
    addBarricadeSegment(bBarPts[bBarPts.length - 1].x, bBarPts[bBarPts.length - 1].z, 2.4, 8.2, 2);

    // 4. MULTI-TIERED ILLUMINATED BAND RISERS (2-Tier Drum Riser at DRUM_RISER_TOP_Y = 0.65m + Flanking 0.45m Risers)
    const lowerDrumH = 0.28;
    const upperDrumH = DRUM_RISER_TOP_Y - lowerDrumH;
    const drumLowerPlinth = new THREE.Mesh(new THREE.BoxGeometry(7.2, lowerDrumH, 4.6), deckMat);
    drumLowerPlinth.position.set(0, lowerDrumH * 0.5, -2.8);
    drumLowerPlinth.receiveShadow = true;
    const drumLowerFascia = new THREE.Mesh(new THREE.BoxGeometry(7.24, lowerDrumH * 0.72, 0.08), this.riserFasciaMat);
    drumLowerFascia.position.set(0, lowerDrumH * 0.48, -0.49);
    const drumLowerStep = new THREE.Mesh(new THREE.BoxGeometry(7.26, 0.04, 0.06), this.stepStripMat);
    drumLowerStep.position.set(0, lowerDrumH + 0.01, -0.5);

    const riser = new THREE.Mesh(new THREE.BoxGeometry(5.6, upperDrumH, 3.8), deckMat);
    riser.position.set(0, lowerDrumH + upperDrumH * 0.5, -2.8);
    riser.receiveShadow = true;
    const drumUpperFascia = new THREE.Mesh(new THREE.BoxGeometry(5.64, upperDrumH * 0.72, 0.08), this.riserFasciaMat);
    drumUpperFascia.position.set(0, lowerDrumH + upperDrumH * 0.48, -0.89);
    stageGroup.add(drumLowerPlinth, drumLowerFascia, drumLowerStep, riser, drumUpperFascia);

    const rugMat = new THREE.MeshStandardMaterial({ color: 0x1e1b2e, roughness: 0.92, metalness: 0.04 });
    const drumRug = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.018, 2.8), rugMat);
    drumRug.position.set(0, DRUM_RISER_TOP_Y + 0.009, -2.82);
    drumRug.receiveShadow = true;
    stageGroup.add(drumRug);

    // Curved transparent Perspex acrylic acoustic drum shield
    const shieldMat = new THREE.MeshPhysicalMaterial({
      color: 0xdbeafe,
      transparent: true,
      opacity: 0.2,
      roughness: 0.08,
      metalness: 0.05,
      clearcoat: 1.0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const shieldArcGeo = new THREE.CylinderGeometry(1.95, 1.95, 1.44, 22, 1, true, -Math.PI * 0.34, Math.PI * 0.68);
    const drumShield = new THREE.Mesh(shieldArcGeo, shieldMat);
    drumShield.position.set(0, DRUM_RISER_TOP_Y + 0.72, -3.12);
    stageGroup.add(drumShield);

    const riserTrim = new THREE.Mesh(new THREE.BoxGeometry(5.66, 0.06, 0.07), this.stepStripMat);
    riserTrim.position.set(0, DRUM_RISER_TOP_Y - 0.01, -0.88);
    const riserBackTrim = new THREE.Mesh(new THREE.BoxGeometry(5.66, 0.06, 0.07), this.stageRimMat);
    riserBackTrim.position.set(0, DRUM_RISER_TOP_Y - 0.01, -4.71);
    stageGroup.add(riserTrim, riserBackTrim);

    const chromeRailMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.16, metalness: 0.94 });
    [-3.18, 3.18].forEach((sx) => {
      const stepLow = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.22, 1.15), deckMat);
      stepLow.position.set(sx, 0.11, -1.68);
      const stepMid = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.44, 0.78), deckMat);
      stepMid.position.set(sx, 0.22, -2.54);
      const stepLed = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.03, 0.05), this.stepStripMat);
      stepLed.position.set(sx, 0.44, -2.14);
      stageGroup.add(stepLow, stepMid, stepLed);
    });
    [-2.74, -1.35, 0, 1.35, 2.74].forEach((rx) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.88, 8), chromeRailMat);
      post.position.set(rx, DRUM_RISER_TOP_Y + 0.44, -4.64);
      stageGroup.add(post);
    });
    const backTopRail = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 5.56, 8), chromeRailMat);
    backTopRail.rotation.z = Math.PI * 0.5;
    backTopRail.position.set(0, DRUM_RISER_TOP_Y + 0.86, -4.64);
    const backMidRail = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 5.56, 8), chromeRailMat);
    backMidRail.rotation.z = Math.PI * 0.5;
    backMidRail.position.set(0, DRUM_RISER_TOP_Y + 0.48, -4.64);
    stageGroup.add(backTopRail, backMidRail);

    // Flanking Stage-Right Keyboard / Synth Riser (top surface strictly at KEYS_RISER_TOP_Y = 0.45m, x = +6.5, z = -1.8)
    const pianoRiser = new THREE.Mesh(new THREE.BoxGeometry(3.8, KEYS_RISER_TOP_Y, 3.2), deckMat);
    pianoRiser.position.set(6.5, KEYS_RISER_TOP_Y * 0.5, -1.8);
    pianoRiser.receiveShadow = true;
    const pianoFascia = new THREE.Mesh(new THREE.BoxGeometry(3.82, KEYS_RISER_TOP_Y * 0.72, 0.08), this.riserFasciaMat);
    pianoFascia.position.set(6.5, KEYS_RISER_TOP_Y * 0.48, -0.19);
    const pianoRiserTrim = new THREE.Mesh(new THREE.BoxGeometry(3.86, 0.05, 0.07), this.stepStripMat);
    pianoRiserTrim.position.set(6.5, KEYS_RISER_TOP_Y - 0.01, -0.18);
    const pianoStep = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.22, 1.05), deckMat);
    pianoStep.position.set(4.32, 0.11, -1.5);
    stageGroup.add(pianoRiser, pianoFascia, pianoRiserTrim, pianoStep);

    // Symmetric Stage-Left Backing / Tech Monitor Riser (0.45m, x = -6.5, z = -3.8)
    const leftBackRiser = new THREE.Mesh(new THREE.BoxGeometry(3.6, KEYS_RISER_TOP_Y, 2.8), deckMat);
    leftBackRiser.position.set(-6.5, KEYS_RISER_TOP_Y * 0.5, -3.8);
    leftBackRiser.receiveShadow = true;
    const leftBackFascia = new THREE.Mesh(new THREE.BoxGeometry(3.62, KEYS_RISER_TOP_Y * 0.72, 0.08), this.riserFasciaMat);
    leftBackFascia.position.set(-6.5, KEYS_RISER_TOP_Y * 0.48, -2.39);
    const leftBackTrim = new THREE.Mesh(new THREE.BoxGeometry(3.66, 0.05, 0.07), this.stepStripMat);
    leftBackTrim.position.set(-6.5, KEYS_RISER_TOP_Y - 0.01, -2.38);
    stageGroup.add(leftBackRiser, leftBackFascia, leftBackTrim);

    // 5. ARTICULATED 4-PILLAR 15.5m BOX-TRUSS ROOF SUPERSTRUCTURE + CATWALKS + HOISTS + 3 MOTORIZED LIGHT PODS
    const trussMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      bumpMap: this.deckMaps.bumpMap,
      bumpScale: 0.018,
      roughness: 0.26,
      metalness: 0.92,
      emissive: 0x000000,
      emissiveIntensity: 0,
    });
    this.stageTrussMat = trussMat;

    const TRUSS_H = 15.5;
    const towerCoords = [
      [-16.2, -8.4],
      [16.2, -8.4],
      [-16.2, 4.8],
      [16.2, 4.8],
    ];
    towerCoords.forEach(([tx, tz]) => {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(0.62, TRUSS_H, 0.62), trussMat);
      tower.position.set(tx, TRUSS_H * 0.5, tz);
      const basePlate = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.16, 1.45), barFrameMat);
      basePlate.position.set(tx, 0.08, tz);
      // Venue-adaptive vertical LED/metallic accent strip along each truss column
      const colTrim = new THREE.Mesh(new THREE.BoxGeometry(0.1, TRUSS_H - 1.2, 0.1), this.venueTrussTrimMat);
      colTrim.position.set(tx, TRUSS_H * 0.5, tz + (tz > 0 ? 0.34 : -0.34));
      stageGroup.add(tower, basePlate, colTrim);

      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 2.6, 10), barFrameMat);
      sleeve.position.set(tx * 1.032, 1.3, tz);
      const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 2.2, 10), chromeRailMat);
      piston.position.set(tx * 1.032, 3.1, tz);
      stageGroup.add(sleeve, piston);
    });

    // Overhead 32.8m primary steel box-truss bridges + venue accent fascia trim
    const frontBridge = new THREE.Mesh(new THREE.BoxGeometry(33.2, 0.54, 0.58), trussMat);
    frontBridge.position.set(0, TRUSS_H - 0.35, 4.8);
    const frontTrim = new THREE.Mesh(new THREE.BoxGeometry(32.8, 0.11, 0.08), this.venueTrussTrimMat);
    frontTrim.position.set(0, TRUSS_H - 0.08, 5.12);
    const midBridge = new THREE.Mesh(new THREE.BoxGeometry(33.2, 0.48, 0.52), trussMat);
    midBridge.position.set(0, TRUSS_H - 0.35, -1.8);
    const rearBridge = new THREE.Mesh(new THREE.BoxGeometry(33.2, 0.54, 0.58), trussMat);
    rearBridge.position.set(0, TRUSS_H - 0.35, -8.4);
    stageGroup.add(frontBridge, frontTrim, midBridge, rearBridge);

    // Side truss spans + Outrigger PA Cantilever Booms extending out to x = ±19.6m for curved Line-Arrays
    [-1, 1].forEach((side) => {
      const sideSpan = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.52, 13.8), trussMat);
      sideSpan.position.set(side * 16.2, TRUSS_H - 0.35, -1.8);
      const paBoom = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.46, 0.54), trussMat);
      paBoom.position.set(side * 18.2, TRUSS_H - 0.5, 3.2);
      const paStay = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 4.4, 6), chromeRailMat);
      paStay.position.set(side * 17.5, TRUSS_H + 0.55, 3.2);
      paStay.rotation.z = side * 0.52;
      stageGroup.add(sideSpan, paBoom, paStay);
    });

    // Overhead Rigging Catwalk grating & safety handrails + Chain Hoist motors
    const catwalkWalkway = new THREE.Mesh(new THREE.BoxGeometry(31.4, 0.08, 1.15), deckMat);
    catwalkWalkway.position.set(0, TRUSS_H + 0.04, 3.85);
    const catwalkRail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 31.4, 8), chromeRailMat);
    catwalkRail.rotation.z = Math.PI * 0.5;
    catwalkRail.position.set(0, TRUSS_H + 0.92, 4.38);
    stageGroup.add(catwalkWalkway, catwalkRail);

    [-14.5, -7.6, 0, 7.6, 14.5].forEach((hx) => {
      const hoistMotor = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.56, 0.46), barFrameMat);
      hoistMotor.position.set(hx, TRUSS_H + 0.35, -0.6);
      stageGroup.add(hoistMotor);
    });

    // Instanced 3D diagonal cross-bracing struts across 15.5m vertical towers & 33.2m roof bridges
    const braceGeo = new THREE.CylinderGeometry(0.036, 0.036, 0.9, 6);
    const braceInst = new THREE.InstancedMesh(braceGeo, chromeRailMat, 260);
    braceInst.frustumCulled = false;
    let braceIdx = 0;
    towerCoords.forEach(([tx, tz]) => {
      for (let b = 0; b < 15 && braceIdx < 260; b += 1) {
        this._dummy.position.set(tx, 0.72 + b * 0.98, tz + 0.34);
        this._dummy.rotation.set(0, 0, (b % 2 === 0 ? 1 : -1) * 0.72);
        this._dummy.scale.set(1, 1, 1);
        this._dummy.updateMatrix();
        braceInst.setMatrixAt(braceIdx, this._dummy.matrix);
        braceIdx += 1;
      }
    });
    [4.8, -1.8, -8.4].forEach((bz) => {
      for (let bx = -15.2; bx <= 15.2 && braceIdx < 260; bx += 1.25) {
        this._dummy.position.set(bx, TRUSS_H - 0.35, bz + 0.32);
        this._dummy.rotation.set(0, 0, ((Math.round(bx * 10) % 2 === 0) ? 1 : -1) * 0.78);
        this._dummy.scale.set(1, 1, 1);
        this._dummy.updateMatrix();
        braceInst.setMatrixAt(braceIdx, this._dummy.matrix);
        braceIdx += 1;
      }
    });
    braceInst.count = braceIdx;
    braceInst.instanceMatrix.needsUpdate = true;
    stageGroup.add(braceInst);
    this.stageExtraDisposables.push(braceGeo);

    // 3 Motorized Hexagonal / Triangular Moving-Head Light Pods suspended above the band
    const fixtureMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.82 });
    this.podRingMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x38bdf8,
      emissiveIntensity: 1.55,
      roughness: 0.2,
    });
    const podBeamMat = createVolumetricSpotlightMaterial(0x38bdf8, 0.08);
    this.podBeamMat = podBeamMat;
    this.motorizedLightPods = [];

    [
      { x: -7.8, y: 12.1, z: 0.9, radius: 1.85, sides: 3, phase: 0 },
      { x: 0.0, y: 12.65, z: -0.6, radius: 2.45, sides: 6, phase: 2.1 },
      { x: 7.8, y: 12.1, z: 0.9, radius: 1.85, sides: 3, phase: 4.2 },
    ].forEach((cfg) => {
      const podPivot = new THREE.Group();
      podPivot.position.set(cfg.x, cfg.y, cfg.z);

      // Suspension steel cables up to overhead 15.5m truss
      const cableLen = Math.max(1.2, TRUSS_H - 0.4 - cfg.y);
      [-cfg.radius * 0.55, cfg.radius * 0.55].forEach((cx) => {
        const hoistLine = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, cableLen, 5), chromeRailMat);
        hoistLine.position.set(cx, cableLen * 0.5, 0);
        podPivot.add(hoistLine);
      });

      const podBody = new THREE.Group();
      const trussFrame = new THREE.Mesh(new THREE.TorusGeometry(cfg.radius, 0.14, 6, cfg.sides), trussMat);
      trussFrame.rotation.x = Math.PI * 0.5;
      const ledRing = new THREE.Mesh(new THREE.TorusGeometry(cfg.radius * 0.92, 0.06, 6, cfg.sides), this.podRingMat);
      ledRing.rotation.x = Math.PI * 0.5;
      ledRing.position.y = -0.14;
      podBody.add(trussFrame, ledRing);

      // Articulated moving-head wash fixtures + volumetric beam cones mounted on pod vertices
      const headCount = cfg.sides === 6 ? 6 : 3;
      for (let h = 0; h < headCount; h += 1) {
        const ang = (h / headCount) * Math.PI * 2;
        const hx = Math.cos(ang) * cfg.radius;
        const hz = Math.sin(ang) * cfg.radius;
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.34, 0.36), fixtureMat);
        head.position.set(hx, -0.28, hz);
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.07, 10), this.podRingMat);
        lens.position.set(hx, -0.47, hz);
        const cone = new THREE.Mesh(new THREE.ConeGeometry(1.45, 7.6, 12, 1, true), podBeamMat);
        cone.position.set(hx, -4.3, hz);
        podBody.add(head, lens, cone);
      }

      podPivot.add(podBody);
      stageGroup.add(podPivot);
      this.motorizedLightPods.push({
        pivot: podPivot,
        body: podBody,
        baseY: cfg.y,
        phase: cfg.phase,
        isCenter: cfg.sides === 6,
      });
    });

    // Overhead front truss moving fixtures & warm tungsten Audience Blinders spanning 32m bridge
    [-13.2, -9.9, -6.6, -3.3, 0, 3.3, 6.6, 9.9, 13.2].forEach((fx) => {
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.4, 0.46), fixtureMat);
      head.position.set(fx, TRUSS_H - 0.72, 4.74);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.08, 10), this.stageRimMat);
      lens.position.set(fx, TRUSS_H - 0.94, 4.74);
      stageGroup.add(head, lens);
    });

    this.blinderMat = new THREE.MeshStandardMaterial({
      color: 0xfff3d1,
      emissive: 0xffb347,
      emissiveIntensity: 0.25,
      roughness: 0.18,
      metalness: 0.3,
    });
    [-11.8, -8.2, -4.6, -1.4, 1.4, 4.6, 8.2, 11.8].forEach((bx) => {
      const podHousing = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.38, 0.26), fixtureMat);
      podHousing.position.set(bx, TRUSS_H - 0.68, 5.06);
      podHousing.rotation.x = 0.35;
      const cellL = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 12), this.blinderMat);
      cellL.rotation.x = Math.PI * 0.5 + 0.35;
      cellL.position.set(bx - 0.2, TRUSS_H - 0.7, 5.18);
      const cellR = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 12), this.blinderMat);
      cellR.rotation.x = Math.PI * 0.5 + 0.35;
      cellR.position.set(bx + 0.2, TRUSS_H - 0.7, 5.18);
      stageGroup.add(podHousing, cellL, cellR);
    });
    this.blinderLight = new THREE.PointLight(0xffb85c, 0, 52, 1.3);
    this.blinderLight.position.set(0, 13.4, 6.2);
    this.scene.add(this.blinderLight);

    // 6. CURVED 12-CABINET LINE-ARRAY PA WINGS (x = ±17.8m) + CARDIOID SUBWOOFER ARRAYS + PA SCRIM BANNERS
    const leftArrayBuilt = buildLineArrayStack(-1, this.stageRimMat, this.perforatedMaps);
    leftArrayBuilt.group.position.set(-17.8, 13.4, 3.2);
    leftArrayBuilt.group.rotation.y = 0.24;
    stageGroup.add(leftArrayBuilt.group);

    const rightArrayBuilt = buildLineArrayStack(1, this.stageRimMat, this.perforatedMaps);
    rightArrayBuilt.group.position.set(17.8, 13.4, 3.2);
    rightArrayBuilt.group.rotation.y = -0.24;
    stageGroup.add(rightArrayBuilt.group);

    this.lineArrayWoofers = [...leftArrayBuilt.woofers, ...rightArrayBuilt.woofers];

    // Venue-Adaptive Side PA Scrim Banners hanging beside the outer line-arrays (x = ±19.8m)
    this.scrimBannerCanvas = document.createElement('canvas');
    this.scrimBannerCanvas.width = 256;
    this.scrimBannerCanvas.height = 768;
    this.scrimBannerCtx = this.scrimBannerCanvas.getContext('2d');
    this.scrimBannerTex = new THREE.CanvasTexture(this.scrimBannerCanvas);
    this.scrimBannerTex.colorSpace = THREE.SRGBColorSpace;
    this.scrimBannerTex.anisotropy = maxAniso;
    const scrimMat = new THREE.MeshStandardMaterial({
      map: this.scrimBannerTex,
      emissiveMap: this.scrimBannerTex,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.42,
      roughness: 0.65,
      metalness: 0.08,
      side: THREE.DoubleSide,
    });
    [-1, 1].forEach((side) => {
      const scrim = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 8.2), scrimMat);
      scrim.position.set(side * 19.7, 7.8, 2.2);
      scrim.rotation.y = side * -0.26;
      stageGroup.add(scrim);
    });

    // Twin Wall-of-Sound Marshall / Ampeg Amp Stack Risers (x = ±11.6, z = -3.8)
    [-11.6, 11.6].forEach((ax) => {
      const sideRiser = new THREE.Mesh(new THREE.BoxGeometry(4.2, KEYS_RISER_TOP_Y, 2.9), deckMat);
      sideRiser.position.set(ax, KEYS_RISER_TOP_Y * 0.5, -3.8);
      sideRiser.receiveShadow = true;
      const sideRiserLed = new THREE.Mesh(new THREE.BoxGeometry(4.24, 0.06, 0.08), this.stageRimMat);
      sideRiserLed.position.set(ax, KEYS_RISER_TOP_Y - 0.02, -2.34);
      stageGroup.add(sideRiser, sideRiserLed);
    });

    const leftAmp = buildAmpStack(THEME_COLORS.guitar, this.ampGrillTex, this.perforatedMaps);
    leftAmp.group.position.set(-11.6, KEYS_RISER_TOP_Y, -3.8);
    leftAmp.group.rotation.y = 0.34;
    stageGroup.add(leftAmp.group);

    const rightAmp = buildAmpStack(THEME_COLORS.bass, this.ampGrillTex, this.perforatedMaps);
    rightAmp.group.position.set(11.6, KEYS_RISER_TOP_Y, -3.8);
    rightAmp.group.rotation.y = -0.34;
    stageGroup.add(rightAmp.group);

    this.ampLedMats = [leftAmp.ledMat, rightAmp.ledMat];
    this.ampGrillMats = [leftAmp.grillMat, rightAmp.grillMat];
    this.subCones = [leftAmp.subCone, rightAmp.subCone];
    this.cardioidSubGrilles = [];

    // Ground-Stacked Cardioid Subwoofer Arrays beneath the angled PA Wings (x = ±17.8m, vibrate on 30-110Hz kick hits)
    const groundSubCabMat = new THREE.MeshStandardMaterial({ color: 0x090c14, roughness: 0.72, metalness: 0.3 });
    const groundSubGrillMat = new THREE.MeshStandardMaterial({
      map: this.perforatedMaps.map,
      bumpMap: this.perforatedMaps.bumpMap,
      bumpScale: 0.036,
      color: 0x1e293b,
      roughness: 0.5,
      metalness: 0.62,
    });
    [-1, 1].forEach((side) => {
      const subArrayGroup = new THREE.Group();
      subArrayGroup.position.set(side * 17.8, 0, 2.8);
      subArrayGroup.rotation.y = side * -0.18;
      for (let col = -1; col <= 1; col += 1) {
        for (let stack = 0; stack < 3; stack += 1) {
          const cx = col * 1.34;
          const cy = 0.4 + stack * 0.8;
          const subBox = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.76, 1.08), groundSubCabMat);
          subBox.position.set(cx, cy, 0);
          const subGrill = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.64, 0.06), groundSubGrillMat);
          subGrill.position.set(cx, cy, 0.55);
          const portLed = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.035, 0.04), this.stageRimMat);
          portLed.position.set(cx, cy - 0.31, 0.56);
          subArrayGroup.add(subBox, subGrill, portLed);
          this.cardioidSubGrilles.push(subGrill);
        }
      }
      stageGroup.add(subArrayGroup);
    });

    // Low-profile glowing Guitar & Bass Pedalboards + gaffer-tape XLR cable runs
    const pedalBoardMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5, metalness: 0.6 });
    const gafferMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9, metalness: 0.05 });
    [
      { x: -4.5, z: 1.65, col: THEME_COLORS.guitar },
      { x: 4.5, z: 1.65, col: THEME_COLORS.bass },
    ].forEach((pb) => {
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.045, 0.42), pedalBoardMat);
      board.position.set(pb.x, 0.022, pb.z);
      board.rotation.x = 0.08;
      const stompMat = new THREE.MeshStandardMaterial({ color: pb.col, emissive: pb.col, emissiveIntensity: 1.6 });
      for (let p = -1; p <= 1; p += 1) {
        const stomp = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.035, 0.18), stompMat);
        stomp.position.set(pb.x + p * 0.22, 0.052, pb.z);
        stageGroup.add(stomp);
      }
      const gaffer = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.008, 2.5), gafferMat);
      gaffer.position.set(pb.x * 1.15, 0.005, pb.z - 1.25);
      stageGroup.add(board, gaffer);
      this.stageExtraDisposables.push(stompMat);
    });

    // Stage Floor Monitor Wedges + Coiled XLR Cables along 32m main stage lip & circular B-Stage perimeter
    const wedgeMat = new THREE.MeshStandardMaterial({
      bumpMap: this.woodMaps.bumpMap,
      bumpScale: 0.02,
      roughnessMap: this.woodMaps.roughnessMap,
      color: 0x161b29,
      roughness: 0.68,
      metalness: 0.18,
    });
    const cableMat = new THREE.MeshStandardMaterial({ color: 0x090b10, roughness: 0.85, metalness: 0.1 });
    [
      { x: -13.2, z: 4.85, ry: 0.08 },
      { x: -9.8, z: 4.85, ry: 0.04 },
      { x: -6.2, z: 4.85, ry: 0 },
      { x: -3.0, z: 4.85, ry: 0 },
      { x: 3.0, z: 4.85, ry: 0 },
      { x: 6.2, z: 4.85, ry: 0 },
      { x: 9.8, z: 4.85, ry: -0.04 },
      { x: 13.2, z: 4.85, ry: -0.08 },
      // B-Stage octagon perimeter wedges facing inward toward the frontperson
      { x: -2.0, z: 13.0, ry: -0.62 },
      { x: 0.0, z: 13.65, ry: 0 },
      { x: 2.0, z: 13.0, ry: 0.62 },
    ].forEach((wPos) => {
      const wedgeGroup = new THREE.Group();
      wedgeGroup.position.set(wPos.x, 0.17, wPos.z);
      wedgeGroup.rotation.set(-0.34, wPos.ry, 0);
      const wedge = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.34, 0.5), wedgeMat);
      const wedgeLed = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.04, 0.04), this.stageRimMat);
      wedgeLed.position.set(0, 0.16, 0.25);
      wedgeGroup.add(wedge, wedgeLed);
      stageGroup.add(wedgeGroup);

      const cableCoil = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.02, 6, 16), cableMat);
      cableCoil.rotation.x = Math.PI * 0.5;
      cableCoil.position.set(wPos.x * 0.9, 0.02, wPos.z - 0.56);
      stageGroup.add(cableCoil);
    });

    // Spare Stage-Left & Stage-Right Pro Boom Mic Stands for backing vocals/stage detail
    [-6.5, -13.6, 13.6].forEach((mx, idx) => {
      const baseY = idx === 0 ? KEYS_RISER_TOP_Y : STAGE_DECK_TOP_Y;
      const mz = idx === 0 ? -3.1 : 2.2;
      const micBase = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.04, 12), barFrameMat);
      micBase.position.set(mx, baseY + 0.02, mz);
      const micPole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 1.52, 8), chromeRailMat);
      micPole.position.set(mx, baseY + 0.78, mz);
      const micCap = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), chromeRailMat);
      micCap.position.set(mx, baseY + 1.56, mz + 0.12);
      stageGroup.add(micBase, micPole, micCap);
    });

    this.stageExtraDisposables.push(
      plankDeckMat, deckMat, bStageGeo, this.stageFloorMat, apronMat, this.stepStripMat,
      this.venueTrussTrimMat, this.riserFasciaMat, barFrameMat, barPanelMat, rugMat,
      shieldMat, chromeRailMat, trussMat, fixtureMat, this.podRingMat, podBeamMat,
      this.blinderMat, scrimMat, groundSubCabMat, groundSubGrillMat, pedalBoardMat,
      gafferMat, wedgeMat, cableMat
    );

    // 7. PANORAMIC CURVED BACKWALL LED VIDEO WALL (24m x 9.5m) + CENTER 30 FPS LIVE IMAG JUMBOTRON + TWIN PORTRAIT SIDE SCREENS
    const ledFrameMat = new THREE.MeshStandardMaterial({ color: 0x0a0e18, roughness: 0.4, metalness: 0.8 });

    // 7A. Panoramic 24m x 9.5m Curved Backwall Concert Visual Wall (audio spectrum waves, tour graphics, venue themes)
    this.backwallLedCanvas = document.createElement('canvas');
    this.backwallLedCanvas.width = 768;
    this.backwallLedCanvas.height = 320;
    this.backwallLedCtx = this.backwallLedCanvas.getContext('2d');
    this.backwallLedTex = new THREE.CanvasTexture(this.backwallLedCanvas);
    this.backwallLedTex.colorSpace = THREE.SRGBColorSpace;

    const panoRadius = 28.0;
    const panoSpan = 0.86; // arc length = 28 * 0.86 = 24.08m wide x 9.5m tall!
    const panoFrameGeo = new THREE.CylinderGeometry(
      panoRadius + 0.22,
      panoRadius + 0.22,
      10.05,
      40,
      1,
      true,
      Math.PI - panoSpan * 0.5,
      panoSpan
    );
    const panoFrame = new THREE.Mesh(panoFrameGeo, ledFrameMat);
    panoFrame.position.set(0, 7.1, panoRadius - 8.55);
    stageGroup.add(panoFrame);

    const panoScreenGeo = new THREE.CylinderGeometry(
      panoRadius,
      panoRadius,
      9.5,
      40,
      1,
      true,
      Math.PI - (panoSpan - 0.018) * 0.5,
      panoSpan - 0.018
    );
    const panoUv = panoScreenGeo.attributes.uv;
    for (let i = 0; i < panoUv.count; i += 1) {
      panoUv.setX(i, 1 - panoUv.getX(i));
    }
    const panoMat = new THREE.MeshStandardMaterial({
      map: this.backwallLedTex,
      emissiveMap: this.backwallLedTex,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.96,
      roughness: 0.28,
      metalness: 0.1,
      toneMapped: false,
      side: THREE.BackSide,
    });
    const panoWallMesh = new THREE.Mesh(panoScreenGeo, panoMat);
    panoWallMesh.position.set(0, 7.1, panoRadius - 8.42);
    stageGroup.add(panoWallMesh);

    [-11.0, -5.5, 5.5, 11.0].forEach((lx) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.36, 2.6, 0.36), trussMat);
      leg.position.set(lx, 1.3, -8.2);
      stageGroup.add(leg);
    });

    // 7B. Center 30 FPS Live IMAG Jumbotron cleanly framed inside the panoramic backwall
    this.ledCanvas = document.createElement('canvas');
    this.ledCanvas.width = 512;
    this.ledCanvas.height = 288;
    this.ledCtx = this.ledCanvas.getContext('2d');
    this.ledTexture = new THREE.CanvasTexture(this.ledCanvas);
    this.ledTexture.colorSpace = THREE.SRGBColorSpace;

    const imagRadius = 27.4;
    const imagSpan = 0.44; // ~12.0m x 6.6m curved center IMAG window
    const curvedScreenGeo = new THREE.CylinderGeometry(
      imagRadius,
      imagRadius,
      6.6,
      28,
      1,
      true,
      Math.PI - imagSpan * 0.5,
      imagSpan
    );
    const uvAttr = curvedScreenGeo.attributes.uv;
    for (let i = 0; i < uvAttr.count; i += 1) {
      uvAttr.setX(i, 1 - uvAttr.getX(i));
    }
    const imagBezelGeo = new THREE.CylinderGeometry(
      imagRadius + 0.08,
      imagRadius + 0.08,
      6.95,
      28,
      1,
      true,
      Math.PI - (imagSpan + 0.016) * 0.5,
      imagSpan + 0.016
    );
    const imagBezel = new THREE.Mesh(imagBezelGeo, ledFrameMat);
    imagBezel.position.set(0, 7.1, imagRadius - 8.18);
    stageGroup.add(imagBezel);

    const imagVideoTex = this.jumbotronTarget ? this.jumbotronTarget.texture : null;
    const imagVideoMatBack = new THREE.MeshStandardMaterial({
      map: imagVideoTex,
      emissiveMap: imagVideoTex,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 1.0,
      roughness: 0.3,
      metalness: 0.05,
      toneMapped: false,
      side: THREE.BackSide,
    });
    const imagHudMatBack = new THREE.MeshBasicMaterial({
      map: this.ledTexture,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      side: THREE.BackSide,
    });
    const centerImagVideo = new THREE.Mesh(curvedScreenGeo, imagVideoMatBack);
    centerImagVideo.position.set(0, 7.1, imagRadius - 8.08);
    const centerImagHud = new THREE.Mesh(curvedScreenGeo, imagHudMatBack);
    centerImagHud.position.set(0, 7.1, imagRadius - 8.03);
    stageGroup.add(centerImagVideo, centerImagHud);

    // 7C. Twin Flanking Portrait IMAG Side Screens (4.0m x 6.4m) mounted cleanly on stage wings
    const sideScreenFrameGeo = new THREE.BoxGeometry(4.32, 6.72, 0.22);
    const sideScreenGeo = new THREE.PlaneGeometry(4.0, 6.4);
    const imagVideoMatFront = new THREE.MeshStandardMaterial({
      map: imagVideoTex,
      emissiveMap: imagVideoTex,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 1.0,
      roughness: 0.3,
      metalness: 0.05,
      toneMapped: false,
    });
    const imagHudMatFront = new THREE.MeshBasicMaterial({
      map: this.ledTexture,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });

    this.imagMeshes = [centerImagVideo, centerImagHud];
    [
      { x: -13.9, rotY: 0.34 },
      { x: 13.9, rotY: -0.34 },
    ].forEach((sideCfg) => {
      const wingGroup = new THREE.Group();
      wingGroup.position.set(sideCfg.x, 7.3, -4.6);
      wingGroup.rotation.y = sideCfg.rotY;

      const sFrame = new THREE.Mesh(sideScreenFrameGeo, ledFrameMat);
      const sTrim = new THREE.Mesh(new THREE.BoxGeometry(4.38, 0.09, 0.26), this.venueTrussTrimMat);
      sTrim.position.y = 3.38;
      const sVideo = new THREE.Mesh(sideScreenGeo, imagVideoMatFront);
      sVideo.position.z = 0.12;
      const sHud = new THREE.Mesh(sideScreenGeo, imagHudMatFront);
      sHud.position.z = 0.14;

      wingGroup.add(sFrame, sTrim, sVideo, sHud);
      stageGroup.add(wingGroup);
      this.imagMeshes.push(sVideo, sHud);
    });

    // World Tour Front-Row Stage Apron LED Banner wrapping the front octagon B-Stage face
    this.vipBannerCanvas = document.createElement('canvas');
    this.vipBannerCanvas.width = 1024;
    this.vipBannerCanvas.height = 96;
    this.vipBannerCtx = this.vipBannerCanvas.getContext('2d');
    this.vipBannerTex = new THREE.CanvasTexture(this.vipBannerCanvas);
    this.vipBannerTex.colorSpace = THREE.SRGBColorSpace;
    this.drawVipBanner();

    const vipBannerFrame = new THREE.Mesh(
      new THREE.CylinderGeometry(3.48, 3.52, 0.56, 8, 1, true, -Math.PI * 0.38, Math.PI * 0.76),
      ledFrameMat
    );
    vipBannerFrame.position.set(0, -0.38, 11.0);
    const vipBannerGeo = new THREE.CylinderGeometry(3.54, 3.56, 0.44, 16, 1, true, -Math.PI * 0.36, Math.PI * 0.72);
    const vipBannerMesh = new THREE.Mesh(
      vipBannerGeo,
      new THREE.MeshBasicMaterial({ map: this.vipBannerTex, side: THREE.FrontSide })
    );
    vipBannerMesh.position.set(0, -0.38, 11.0);
    stageGroup.add(vipBannerFrame, vipBannerMesh);

    this.stageExtraDisposables.push(
      ledFrameMat, panoFrameGeo, panoScreenGeo, panoMat, imagBezelGeo, curvedScreenGeo,
      sideScreenFrameGeo, sideScreenGeo, imagVideoMatBack, imagHudMatBack, imagVideoMatFront,
      imagHudMatFront, vipBannerFrame.geometry, vipBannerGeo, vipBannerMesh.material
    );

    this.drawScrimBanner();
    this.drawStageFloorLed(0.2, 0.2, 0.2, false, false);
    this.drawBackwallLed(0.2, 0.2, 0.2, false, false);
    this.drawLedBackdrop(0.2, 0.2, 0.2, false, false);

    this.scene.add(stageGroup);
  }

  /**
   * Renders venue/overlay-adaptive vertical PA Scrim Banners beside the curved Line-Array wings.
   */
  drawScrimBanner() {
    const ctx = this.scrimBannerCtx;
    if (!ctx) return;
    const w = 256;
    const h = 768;
    const theme = this.venueEnv?.stageTheme || {
      scrimBgCss: '#0b1020',
      scrimBorderCss: '#38bdf8',
      scrimTitle: 'STAGE HERO 3D',
      scrimSubtitle: 'WORLD TOUR LIVE',
      ledPrimaryCss: '#38bdf8',
      ledSecondaryCss: '#facc15',
      motif: 'STANDARD',
    };

    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, theme.scrimBgCss);
    bgGrad.addColorStop(0.5, '#090d1a');
    bgGrad.addColorStop(1, theme.scrimBgCss);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle acoustic speaker mesh weave pattern
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    for (let y = 0; y < h; y += 12) {
      ctx.fillRect(14, y, w - 28, 2);
    }

    // Double glowing border
    ctx.strokeStyle = theme.scrimBorderCss;
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.strokeStyle = theme.ledSecondaryCss || '#facc15';
    ctx.lineWidth = 2;
    ctx.strokeRect(22, 22, w - 44, h - 44);

    // Top & bottom emblem chevrons
    ctx.fillStyle = theme.ledPrimaryCss || '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(w * 0.5, 48);
    ctx.lineTo(w - 46, 102);
    ctx.lineTo(w * 0.5, 86);
    ctx.lineTo(46, 102);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(w * 0.5, h - 48);
    ctx.lineTo(w - 46, h - 102);
    ctx.lineTo(w * 0.5, h - 86);
    ctx.lineTo(46, h - 102);
    ctx.closePath();
    ctx.fill();

    // Vertical World Tour typography
    ctx.save();
    ctx.translate(w * 0.5, h * 0.5);
    ctx.rotate(-Math.PI * 0.5);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = theme.scrimBorderCss;
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 44px Oswald, sans-serif';
    ctx.fillText(theme.scrimTitle || 'WORLD TOUR', 0, -24);
    ctx.fillStyle = theme.ledSecondaryCss || '#facc15';
    ctx.font = '700 22px Oswald, sans-serif';
    ctx.fillText(`★ ${theme.scrimSubtitle || 'LIVE IN CONCERT'} ★`, 0, 26);
    ctx.restore();

    this.scrimBannerTex.needsUpdate = true;
  }

  /**
   * Draws the Interactive Animated LED Stage Floor Matrix across the main deck, catwalk, and octagonal B-Stage:
   * radial beat shockwaves, equalizer chevrons, and song-section color gradients.
   */
  drawStageFloorLed(bassE, midE, highE, feverActive, encoreActive) {
    const ctx = this.stageFloorCtx;
    if (!ctx) return;
    const w = 512;
    const h = 512;
    const theme = this.venueEnv?.stageTheme;
    const secType = this.lightingState?.sectionType || 'VERSE';
    const floorPulse = this.lightingState?.floorPulse ?? (bassE * 0.8);
    const waveSpeed = this.lightingState?.floorWaveSpeed ?? 1.0;

    let primary = theme?.ledPrimaryCss || '#38bdf8';
    let secondary = theme?.ledSecondaryCss || '#facc15';
    let bgDark = '#050814';
    if (feverActive) {
      primary = '#facc15';
      secondary = '#f97316';
      bgDark = '#1c1004';
    } else if (encoreActive) {
      primary = '#ec4899';
      secondary = '#38bdf8';
      bgDark = '#18071b';
    } else if (secType === 'GUITAR_SOLO') {
      primary = '#ef4444';
      secondary = '#facc15';
      bgDark = '#190608';
    } else if (secType === 'CHORUS') {
      primary = theme?.ledPrimaryCss || '#22d3ee';
      secondary = '#f43f5e';
      bgDark = '#081226';
    } else if (secType === 'INTRO' || secType === 'BRIDGE') {
      primary = '#6366f1';
      secondary = theme?.ledPrimaryCss || '#38bdf8';
      bgDark = '#060718';
    }

    const bgGrad = ctx.createRadialGradient(w * 0.5, h * 0.55, 18, w * 0.5, h * 0.5, w * 0.65);
    bgGrad.addColorStop(0, primary);
    bgGrad.addColorStop(0.28, bgDark);
    bgGrad.addColorStop(1, '#03050c');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle LED tile grid
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 16; i += 1) {
      const p = (i / 16) * w;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, h);
      ctx.moveTo(0, p);
      ctx.lineTo(w, p);
      ctx.stroke();
    }

    // Concentric beat-driven shockwave rings radiating out from center stage
    const phase = (this.clock * 0.9 * waveSpeed) % 1;
    for (let r = 0; r < 3; r += 1) {
      const rp = (phase + r / 3) % 1;
      const rad = 24 + rp * 230;
      const alpha = Math.max(0, (1 - rp) * (0.35 + floorPulse * 0.45));
      ctx.strokeStyle = r % 2 === 0 ? primary : secondary;
      ctx.globalAlpha = Math.min(0.92, alpha);
      ctx.lineWidth = 4 + floorPulse * 5;
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.52, rad, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Animated equalizer chevrons marching forward down the catwalk axis
    const chevCount = 5;
    for (let c = 0; c < chevCount; c += 1) {
      const cp = ((this.clock * 0.75 * waveSpeed + c / chevCount) % 1);
      const cy = cp * h;
      ctx.strokeStyle = c % 2 === 0 ? secondary : primary;
      ctx.globalAlpha = 0.25 + midE * 0.55;
      ctx.lineWidth = 4 + bassE * 4;
      ctx.beginPath();
      ctx.moveTo(w * 0.18, cy - 36);
      ctx.lineTo(w * 0.5, cy);
      ctx.lineTo(w * 0.82, cy - 36);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Symmetric side audio EQ bars along left & right wings
    const barCount = 12;
    for (let b = 0; b < barCount; b += 1) {
      const barH = Math.min(1, 0.16 + ((b % 3 === 0 ? bassE : b % 2 === 0 ? midE : highE) * (0.72 + Math.sin(this.clock * 8 + b) * 0.24)));
      const y = (b / barCount) * h + 8;
      const bw = 22 + barH * 88;
      ctx.fillStyle = b % 2 === 0 ? primary : secondary;
      ctx.globalAlpha = 0.55 + floorPulse * 0.35;
      ctx.fillRect(8, y, bw, 22);
      ctx.fillRect(w - 8 - bw, y, bw, 22);
    }
    ctx.globalAlpha = 1;

    this.stageFloorTex.needsUpdate = true;
  }

  /**
   * Draws the 24m x 9.5m Panoramic Curved Backwall LED Screen framing the live center IMAG Jumbotron:
   * sweeping audio spectrum waves, tour typography, song section graphics, and venue theme visuals.
   */
  drawBackwallLed(bassE, midE, highE, feverActive, encoreActive) {
    const ctx = this.backwallLedCtx;
    if (!ctx) return;
    const w = 768;
    const h = 320;
    const theme = this.venueEnv?.stageTheme;
    const secType = this.lightingState?.sectionType || 'LIVE';

    const c1 = feverActive ? '#facc15' : encoreActive ? '#ec4899' : (theme?.ledPrimaryCss || '#38bdf8');
    const c2 = feverActive ? '#f97316' : encoreActive ? '#38bdf8' : (theme?.ledSecondaryCss || '#facc15');
    const c3 = theme?.ledGoldCss || '#f43f5e';

    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#040713');
    bg.addColorStop(0.5, feverActive ? '#261404' : encoreActive ? '#230824' : '#0b1530');
    bg.addColorStop(1, '#03050d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Sweeping perspective synth horizon grid on outer wings (flanking center IMAG window)
    ctx.strokeStyle = c1;
    ctx.globalAlpha = 0.22 + bassE * 0.28;
    ctx.lineWidth = 2;
    for (let row = 0; row < 6; row += 1) {
      const y = h * 0.54 + Math.pow(row / 5, 1.5) * (h * 0.44);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Dual sweeping audio spectrum waveforms across the full 24m panoramic span
    const drawWave = (color, ampScale, freq, phaseShift, yCenter) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 12) {
        const u = x / w;
        const env = Math.sin(u * Math.PI);
        const y =
          yCenter +
          Math.sin(u * Math.PI * freq + this.clock * 4.2 + phaseShift) * (18 + bassE * 68) * ampScale * env +
          Math.cos(u * Math.PI * (freq * 1.8) - this.clock * 6.5) * (10 + highE * 34) * env;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };
    drawWave(c1, 1.0, 6, 0, h * 0.5);
    drawWave(c2, 0.78, 9, 1.8, h * 0.52);

    // Left & Right Panoramic Equalizer Towers (clearly visible beside the center IMAG Jumbotron)
    const barsPerSide = 10;
    for (let i = 0; i < barsPerSide; i += 1) {
      const e = i % 3 === 0 ? bassE : i % 2 === 0 ? midE : highE;
      const lvl = Math.min(1, 0.14 + e * (0.65 + 0.35 * Math.abs(Math.sin(this.clock * 7.5 + i * 0.7))));
      const bh = lvl * (h * 0.74);
      const bxL = 16 + i * 16;
      const bxR = w - 28 - i * 16;
      ctx.fillStyle = i % 2 === 0 ? c1 : c2;
      ctx.globalAlpha = 0.82;
      ctx.fillRect(bxL, h - 18 - bh, 11, bh);
      ctx.fillRect(bxR, h - 18 - bh, 11, bh);
    }
    ctx.globalAlpha = 1;

    // Top & Bottom Tour Typography + Active Song Section Graphics flanking the panoramic border
    ctx.fillStyle = 'rgba(2, 6, 23, 0.72)';
    ctx.fillRect(0, 0, w, 38);
    ctx.fillRect(0, h - 34, w, 34);
    ctx.fillStyle = c1;
    ctx.fillRect(0, 38, w, 3);
    ctx.fillStyle = c2;
    ctx.fillRect(0, h - 37, w, 3);

    const tourName = (theme?.venueName || 'STAGE HERO 3D WORLD TOUR').toUpperCase();
    const sectionLabel = feverActive ? '★ STAR POWER OVERDRIVE ★' : encoreActive ? '★ GRAND ENCORE ★' : secType.replace(/_/g, ' ');
    ctx.font = '800 20px Oswald, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'left';
    ctx.fillText(`⚡ ${tourName}`, 18, 20);
    ctx.fillStyle = c2;
    ctx.textAlign = 'right';
    ctx.fillText(`${sectionLabel} ⚡`, w - 18, 20);

    ctx.font = '700 16px Oswald, sans-serif';
    ctx.fillStyle = c3;
    ctx.textAlign = 'center';
    const trackBanner = (this.currentTrackTitle || 'LIVE IN CONCERT').toUpperCase().slice(0, 36);
    ctx.fillText(`STAGE HERO 3D  ·  ${trackBanner}  ·  ${(theme?.scrimSubtitle || 'WORLD TOUR').toUpperCase()}`, w * 0.5, h - 16);

    this.backwallLedTex.needsUpdate = true;
  }

  drawVipBanner() {
    const ctx = this.vipBannerCtx;
    if (!ctx) return;
    const w = 1024;
    const h = 96;
    const theme = this.venueEnv?.stageTheme;
    const accent = theme?.ledPrimaryCss || '#38bdf8';

    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#091124');
    grad.addColorStop(0.25, '#0c2742');
    grad.addColorStop(0.5, '#1e1b4b');
    grad.addColorStop(0.75, '#0c2742');
    grad.addColorStop(1, '#091124');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, w - 8, h - 8);

    const venueName = (this.venueEnv?.meta?.name || 'WORLD TOUR ARENA').toUpperCase();
    const songTitle = (this.currentTrackTitle || 'LIVE IN CONCERT').toUpperCase().slice(0, 26);
    ctx.save();
    ctx.shadowColor = accent;
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#fef08a';
    ctx.font = '700 36px Oswald, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`★   ${venueName}  ·  ${songTitle}   ★`, w * 0.5, h * 0.52);
    ctx.restore();

    this.vipBannerTex.needsUpdate = true;
  }

  /**
   * Draws the translucent broadcast IMAG HUD overlay (static ● LIVE CAM badge, scanlines,
   * active song/section banner, and compact bottom EQ) layered over the live 30 FPS camera feed.
   */
  drawLedBackdrop(bassE, midE, highE, feverActive, encoreActive) {
    const ctx = this.ledCtx;
    if (!ctx) return;
    const w = 512;
    const h = 288;
    const moodAccent = this.lightingState?.ledAccent;

    // Clear so live 30 FPS offscreen soloist video shows crisply underneath!
    ctx.clearRect(0, 0, w, h);

    const accent =
      encoreActive || feverActive
        ? '#facc15'
        : moodAccent ||
          (this.activeInstrument === 'bass'
            ? '#a855f7'
            : this.activeInstrument === 'drums'
              ? '#f59e0b'
              : '#22d3ee');

    // Top & bottom translucent broadcast scrims (keeping middle 72% wide open for live camera!)
    const topBar = ctx.createLinearGradient(0, 0, 0, 62);
    topBar.addColorStop(0, 'rgba(4, 8, 18, 0.84)');
    topBar.addColorStop(1, 'rgba(4, 8, 18, 0.0)');
    ctx.fillStyle = topBar;
    ctx.fillRect(0, 0, w, 62);

    const botBar = ctx.createLinearGradient(0, h - 76, 0, h);
    botBar.addColorStop(0, 'rgba(4, 8, 18, 0.0)');
    botBar.addColorStop(1, 'rgba(4, 8, 18, 0.88)');
    ctx.fillStyle = botBar;
    ctx.fillRect(0, h - 76, w, 76);

    // Subtle LED scanlines
    ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
    for (let y = 0; y < h; y += 6) {
      ctx.fillRect(0, y, w, 1.5);
    }

    // Top-left static ● LIVE CAM broadcast badge (steady, never pulsing)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    ctx.fillRect(14, 14, 96, 26);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(14, 14, 96, 26);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(28, 27, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 13px Oswald, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('LIVE CAM', 39, 27);

    // Top-right venue + section status tag
    const sectionLabel = this.breActive
      ? 'BIG ROCK ENDING'
      : encoreActive
        ? 'GRAND ENCORE'
        : feverActive
          ? 'FEVER 2X'
          : (this.lightingState?.sectionType || 'WORLD TOUR').replace(/_/g, ' ');
    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    ctx.fillRect(w - 166, 14, 152, 26);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(w - 166, 14, 152, 26);
    ctx.fillStyle = accent;
    ctx.font = '700 13px Oswald, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(sectionLabel.slice(0, 18), w - 90, 27);

    // Compact bottom 24-band equalizer along footer edge
    const bars = this.ledBarLevels.length;
    const gap = 4;
    const barW = (w - 36 - gap * (bars - 1)) / bars;
    for (let i = 0; i < bars; i += 1) {
      const distCenter = Math.abs(i - (bars - 1) * 0.5) / (bars * 0.5);
      const bandEnergy = distCenter < 0.35 ? bassE : distCenter < 0.7 ? midE : highE;
      const target = Math.min(
        1,
        0.16 + bandEnergy * (0.84 - distCenter * 0.2) + Math.abs(Math.sin(this.clock * 6.5 + i * 0.62)) * 0.16
      );
      this.ledBarLevels[i] += (target - this.ledBarLevels[i]) * 0.38;
      if (this.ledBarLevels[i] > this.ledPeakLevels[i]) {
        this.ledPeakLevels[i] = this.ledBarLevels[i];
      } else {
        this.ledPeakLevels[i] = Math.max(this.ledBarLevels[i], this.ledPeakLevels[i] - 0.032);
      }

      const bh = Math.max(4, this.ledBarLevels[i] * 36);
      const bx = 18 + i * (barW + gap);
      const by = h - 38 - bh;
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.36 + this.ledBarLevels[i] * 0.44;
      ctx.fillRect(bx, by, barW, bh);

      const peakY = h - 38 - Math.max(4, this.ledPeakLevels[i] * 36);
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.85;
      ctx.fillRect(bx, peakY - 2, barW, 2);
    }
    ctx.globalAlpha = 1;

    // Bottom concert song title + venue ticker strip
    const title = (this.currentTrackTitle || 'WORLD TOUR FINALE').toUpperCase().slice(0, 28);
    const venueName = (this.venueEnv?.meta?.name || 'STADIUM TOUR').toUpperCase();
    ctx.fillStyle = 'rgba(6, 10, 22, 0.88)';
    ctx.fillRect(14, h - 34, w - 28, 22);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(14, h - 34, w - 28, 22);

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 14px Oswald, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(title, 24, h - 22);

    ctx.fillStyle = '#fde047';
    ctx.font = '700 12px Oswald, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(venueName, w - 24, h - 22);

    // Outer frame border glow
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, w - 4, h - 4);

    this.ledTexture.needsUpdate = true;
  }

  /**
   * Renders a live 30 FPS telephoto close-up of the featured soloist onto the curved LED wall
   * and flanking IMAG screens, temporarily hiding IMAG meshes to prevent recursive feedback.
   */
  renderJumbotronImag(stageState, telemetry) {
    if (!this.jumbotronTarget || !this.jumbotronCam || !this.renderer) return;
    this._imagFrameToggle = (this._imagFrameToggle + 1) & 1;
    if (this._imagFrameToggle !== 1) return;

    const marks = this.getLineupMarks();
    const secType = this.lightingState?.sectionType || stageState?.currentSection?.type || 'VERSE';
    const vocalE = telemetry?.vocalEnergy || 0;
    let featuredRole = this.activeInstrument || 'guitar';
    if (secType === 'GUITAR_SOLO') {
      featuredRole = 'guitar';
    } else if (marks.vocals?.visible && (secType === 'CHORUS' || secType === 'BRIDGE' || vocalE > 0.4)) {
      featuredRole = 'vocals';
    }

    const pos = this.livePositions?.[featuredRole] || this.livePositions.guitar;
    const targetY = (pos.y || 0) + 1.5;
    this._imagLookTarget.set(pos.x, targetY, pos.z);

    const sideSign = featuredRole === 'guitar' ? -1 : featuredRole === 'bass' ? 1 : Math.sin(this.clock * 0.5) >= 0 ? 1 : -1;
    const camOffX = featuredRole === 'piano' ? -1.45 : sideSign * 0.88;
    const camOffZ = featuredRole === 'drums' ? 3.2 : 2.85;
    this.jumbotronCam.position.set(pos.x + camOffX, targetY + 0.28, pos.z + camOffZ);
    this.jumbotronCam.lookAt(this._imagLookTarget);

    for (let i = 0; i < this.imagMeshes.length; i += 1) {
      this.imagMeshes[i].visible = false;
    }
    const prevShadows = this.renderer.shadowMap.enabled;
    this.renderer.shadowMap.enabled = false;
    this.renderer.setRenderTarget(this.jumbotronTarget);
    this.renderer.render(this.scene, this.jumbotronCam);
    this.renderer.setRenderTarget(null);
    this.renderer.shadowMap.enabled = prevShadows;
    for (let i = 0; i < this.imagMeshes.length; i += 1) {
      this.imagMeshes[i].visible = true;
    }
  }

  buildPerformingBand() {
    this.clothingPbrMaps = createPbrClothingMaps();

    // 1. DRUMMER on elevated center riser
    this.drummer = buildRobloxCharacter({
      torsoColor: 0xd97706,
      pantsColor: 0x1e293b,
      skinColor: '#f3c598',
      hairColor: '#1f2937',
      hairStyle: 'headband',
      accentColor: THEME_COLORS.drums,
      smile: 'grin',
      seated: true,
      clothingPbrMaps: this.clothingPbrMaps,
    });
    this.drummer.root.position.set(0, DRUM_RISER_TOP_Y, -2.8);
    this.scene.add(this.drummer.root);

    const stickMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.42, metalness: 0.08 });
    const stickGeo = new THREE.CylinderGeometry(0.024, 0.03, 0.74, 8);
    this.leftDrumstick = new THREE.Mesh(stickGeo, stickMat);
    this.leftDrumstick.position.set(0, -0.05, 0.28);
    this.leftDrumstick.rotation.x = Math.PI * 0.44;
    this.drummer.leftWristPivot.add(this.leftDrumstick);

    this.rightDrumstick = new THREE.Mesh(stickGeo, stickMat);
    this.rightDrumstick.position.set(0, -0.05, 0.28);
    this.rightDrumstick.rotation.x = Math.PI * 0.44;
    this.drummer.rightWristPivot.add(this.rightDrumstick);

    // 2. LEAD GUITARIST (stage left or center in Singing Guitarist Power Trio)
    this.guitarist = buildRobloxCharacter({
      torsoColor: 0x0e7490,
      pantsColor: 0x111827,
      skinColor: '#f5cfa6',
      hairColor: '#0f172a',
      hairStyle: 'spiky',
      accentColor: THEME_COLORS.guitar,
      smile: 'grin',
      clothingPbrMaps: this.clothingPbrMaps,
    });
    this.guitarist.root.position.set(-4.5, STAGE_DECK_TOP_Y, 1.0);
    this.guitarist.root.rotation.y = 0.24;
    this.scene.add(this.guitarist.root);

    // 3. BASSIST (stage right)
    this.bassist = buildRobloxCharacter({
      torsoColor: 0x5b21b6,
      pantsColor: 0x18181b,
      skinColor: '#e9ba8e',
      hairColor: '#1e1b4b',
      hairStyle: 'mohawk',
      accentColor: THEME_COLORS.bass,
      sunglasses: true,
      smile: 'cool',
      clothingPbrMaps: this.clothingPbrMaps,
    });
    this.bassist.root.position.set(4.5, STAGE_DECK_TOP_Y, 1.0);
    this.bassist.root.rotation.y = -0.24;
    this.scene.add(this.bassist.root);

    // 4. VOCALIST (center front — hidden on Singing Guitarist & Rock Power Trio)
    this.vocalist = buildRobloxCharacter({
      torsoColor: 0xbe123c,
      pantsColor: 0x0f172a,
      skinColor: '#f4c79a',
      hairColor: '#27272a',
      hairStyle: 'long',
      accentColor: 0xf43f5e,
      smile: 'sing',
      clothingPbrMaps: this.clothingPbrMaps,
    });
    this.vocalist.root.position.set(0, STAGE_DECK_TOP_Y, 2.0);
    this.vocalistHeadsetGroup = buildVocalistHeadset();
    this.vocalist.headGroup.add(this.vocalistHeadsetGroup);
    this.scene.add(this.vocalist.root);

    this.micStand = buildMicStand();
    this.micStand.position.set(0, STAGE_DECK_TOP_Y, 2.6);
    this.scene.add(this.micStand);

    // 5. KEYBOARDIST + 3D Piano / Synth / Keytar Rig on dedicated 0.5m riser (+6.5, 0.5, -1.8)
    this.pianoRigGroup = new THREE.Group();
    this.pianoRigGroup.position.set(6.5, KEYS_RISER_TOP_Y, -1.8);
    this.pianoRigGroup.rotation.y = -0.44;
    this.scene.add(this.pianoRigGroup);

    this.keyboardist = buildRobloxCharacter({
      torsoColor: 0xbe185d,
      pantsColor: 0x0f172a,
      skinColor: '#f6d0ad',
      hairColor: '#312e81',
      hairStyle: 'spiky',
      accentColor: THEME_COLORS.piano,
      smile: 'grin',
      clothingPbrMaps: this.clothingPbrMaps,
    });
    this.keyboardist.root.position.set(0, 0, -0.92);
    this.pianoRigGroup.add(this.keyboardist.root);

    this.membersByRole = {
      guitar: this.guitarist,
      bass: this.bassist,
      drums: this.drummer,
      piano: this.keyboardist,
      vocals: this.vocalist,
    };

    // Strict shadow budget + disable frustum culling across all 5 performing musicians so closeups/orbits never clip!
    Object.values(this.membersByRole).forEach((member) => {
      if (!member?.root) return;
      setHierarchyFrustumCulled(member.root, false);
      if (!this.isSoftwareGl) {
        member.root.traverse((obj) => {
          if (obj.isMesh) {
            obj.castShadow = true;
            obj.receiveShadow = false;
          }
        });
      }
    });
    setHierarchyFrustumCulled(this.pianoRigGroup, false);

    // Mount initial custom 3D gear, star lookalike & lineup geometry
    this.swapGuitarMesh(this.guitarModelId);
    this.swapBassMesh(this.bassModelId);
    this.swapKeyboardMesh(this.keyboardModelId);
    this.applyBandLineup();
    this.applyStarLook(this.starLookId);
  }

  getLineupMarks() {
    const pos = this.bandLineup?.positions || {};
    const drumsPos = pos.drums || { x: 0, y: DRUM_RISER_TOP_Y, z: -2.8, rotY: 0 };
    const pianoPos = pos.piano || { x: 6.5, y: KEYS_RISER_TOP_Y, z: -1.8, rotY: -0.44 };
    const micPos = pos.micStand || { x: 0, y: STAGE_DECK_TOP_Y, z: 2.6 };
    return {
      guitar: pos.guitar || { x: -4.5, y: STAGE_DECK_TOP_Y, z: 1.0, rotY: 0.24 },
      bass: pos.bass || { x: 4.5, y: STAGE_DECK_TOP_Y, z: 1.0, rotY: -0.24 },
      drums: drumsPos,
      piano: pianoPos,
      micStand: micPos,
      vocals: {
        ...(pos.vocals || { x: 0, y: STAGE_DECK_TOP_Y, z: 2.0, rotY: 0 }),
        visible: this.bandLineup?.hasVocalist !== false,
        headset: Boolean(this.bandLineup?.vocalistHeadset),
      },
      micStandVisible: Boolean(this.bandLineup?.showMicStand ?? true),
      forceDoubleKick: Boolean(this.bandLineup?.forceDoubleKick),
    };
  }

  swapGuitarMesh(modelId) {
    this.guitarModelId = modelId || 'les-paul-sunburst';
    if (this.guitarAsset && this.guitarist) {
      this.guitarist.upperBody.remove(this.guitarAsset.group);
      this.guitarAsset.dispose?.();
      this.guitarAsset = null;
    }
    const skin = this.instrumentSkins?.guitar || this.instrumentSkinId;
    const built = buildCustomGuitarMesh(this.guitarModelId, skin);
    built.group.position.set(0.08, 0.42, 0.36);
    built.group.rotation.set(0.06, 0.08, 0.26);
    setHierarchyFrustumCulled(built.group, false);
    this.guitarAsset = built;
    this.electricGuitar = built.group;
    if (this.guitarist) {
      this.guitarist.upperBody.add(built.group);
    }
  }

  swapBassMesh(modelId) {
    this.bassModelId = modelId || 'precision-blonde';
    if (this.bassAsset && this.bassist) {
      this.bassist.upperBody.remove(this.bassAsset.group);
      this.bassAsset.dispose?.();
      this.bassAsset = null;
    }
    const skin = this.instrumentSkins?.bass || this.instrumentSkinId;
    const built = buildCustomBassMesh(this.bassModelId, skin);
    built.group.position.set(0.06, 0.44, 0.36);
    built.group.rotation.set(0.05, -0.08, 0.3);
    setHierarchyFrustumCulled(built.group, false);
    this.bassAsset = built;
    this.bassGuitar = built.group;
    if (this.bassist) {
      this.bassist.upperBody.add(built.group);
    }
  }

  swapDrumKitMesh(modelId, forceDoubleKick = false) {
    this.drumKitModelId = modelId || 'pop-single-kick';
    if (this.drumKitAsset) {
      this.scene.remove(this.drumKitAsset.group);
      this.drumKitAsset.dispose?.();
      this.drumKitAsset = null;
    }
    const skin = this.instrumentSkins?.drums || this.instrumentSkinId;
    const built = buildCustomDrumKitMesh(this.drumKitModelId, {
      forceDoubleKick,
      skinId: skin,
    });
    const marks = this.getLineupMarks();
    built.group.position.set(
      marks.drums?.x ?? 0,
      marks.drums?.y ?? DRUM_RISER_TOP_Y,
      (marks.drums?.z ?? -2.8) + 0.18
    );
    setHierarchyFrustumCulled(built.group, false);
    this.drumKitAsset = built;
    this.drumKit = built;
    this.scene.add(built.group);
  }

  swapKeyboardMesh(modelId) {
    this.keyboardModelId = modelId || 'concert-grand';
    if (this.keyboardAsset) {
      if (this.keyboardAsset.group.parent) {
        this.keyboardAsset.group.parent.remove(this.keyboardAsset.group);
      }
      this.keyboardAsset.dispose?.();
      this.keyboardAsset = null;
    }
    const skin = this.instrumentSkins?.piano || this.instrumentSkinId;
    const built = buildCustomKeyboardMesh(this.keyboardModelId, skin);
    setHierarchyFrustumCulled(built.group, false);
    this.keyboardAsset = built;

    if (built.isKeytar && this.keyboardist) {
      built.group.position.set(0.06, 0.44, 0.38);
      built.group.rotation.set(0.08, 0.06, 0.24);
      this.keyboardist.upperBody.add(built.group);
      this.keyboardist.root.position.set(0, 0, 0.15);
    } else if (this.pianoRigGroup) {
      built.group.position.set(0, 0, 0);
      this.pianoRigGroup.add(built.group);
      if (this.keyboardist) {
        const isGrand = this.keyboardModelId === 'concert-grand' || this.keyboardModelId === 'white-crystal-grand';
        this.keyboardist.root.position.set(0, 0, isGrand ? -0.92 : -0.68);
      }
    }
    setHierarchyFrustumCulled(this.pianoRigGroup, false);
  }

  applyStarLook(starLookId) {
    this.starLookId = starLookId || 'default-band';
    const look = getStarLookById(this.starLookId);

    // Always reset all 5 band members first so switching role-targeted looks never leaves leftovers
    const allMembers = [this.vocalist, this.guitarist, this.bassist, this.drummer, this.keyboardist];
    allMembers.forEach((m) => m?.applyLook(null));

    if (!look || look.id === 'default-band') {
      allMembers.forEach((m) => setHierarchyFrustumCulled(m?.root, false));
      return;
    }

    const marks = this.getLineupMarks();
    if (look.targetRole === 'all') {
      allMembers.forEach((m) => m?.applyLook(look));
    } else if (look.targetRole === 'guitar') {
      this.guitarist?.applyLook(look);
    } else if (look.targetRole === 'bass') {
      this.bassist?.applyLook(look);
    } else if (look.targetRole === 'drums') {
      this.drummer?.applyLook(look);
    } else if (look.targetRole === 'piano') {
      this.keyboardist?.applyLook(look);
    } else {
      // Frontperson look: apply to Vocalist if visible, else Singing Guitarist
      if (marks.vocals.visible && this.vocalist) {
        this.vocalist.applyLook(look);
      } else if (this.guitarist) {
        this.guitarist.applyLook(look);
      }
    }
    allMembers.forEach((m) => setHierarchyFrustumCulled(m?.root, false));
  }

  applyBandLineup() {
    const marks = this.getLineupMarks();
    if (this.drummer && marks.drums) {
      this.drummer.root.position.set(marks.drums.x ?? 0, marks.drums.y ?? DRUM_RISER_TOP_Y, marks.drums.z ?? -2.8);
      this.drummer.root.rotation.y = marks.drums.rotY ?? 0;
    }
    if (this.guitarist) {
      this.guitarist.root.position.set(marks.guitar.x, marks.guitar.y ?? STAGE_DECK_TOP_Y, marks.guitar.z);
      this.guitarist.root.rotation.y = marks.guitar.rotY;
    }
    if (this.bassist) {
      this.bassist.root.position.set(marks.bass.x, marks.bass.y ?? STAGE_DECK_TOP_Y, marks.bass.z);
      this.bassist.root.rotation.y = marks.bass.rotY;
    }
    if (this.pianoRigGroup && marks.piano) {
      this.pianoRigGroup.position.set(marks.piano.x, marks.piano.y ?? KEYS_RISER_TOP_Y, marks.piano.z);
      this.pianoRigGroup.rotation.y = marks.piano.rotY ?? -0.44;
    }
    if (this.vocalist) {
      this.vocalist.root.visible = marks.vocals.visible;
      this.vocalist.root.position.set(marks.vocals.x, marks.vocals.y ?? STAGE_DECK_TOP_Y, marks.vocals.z);
      this.vocalist.root.rotation.y = marks.vocals.rotY;
    }
    if (this.vocalistHeadsetGroup) {
      this.vocalistHeadsetGroup.visible = marks.vocals.headset;
    }
    if (this.micStand) {
      this.micStand.visible = marks.micStandVisible;
      if (marks.micStand) {
        this.micStand.position.set(marks.micStand.x ?? 0, marks.micStand.y ?? STAGE_DECK_TOP_Y, marks.micStand.z ?? 2.6);
      }
    }

    // Update member spotlight targets to match lineup coordinates!
    if (this.memberSpots?.guitar) {
      this.memberSpots.guitar.baseTargetX = marks.guitar.x;
      this.memberSpots.guitar.baseTargetZ = marks.guitar.z;
    }
    if (this.memberSpots?.bass) {
      this.memberSpots.bass.baseTargetX = marks.bass.x;
      this.memberSpots.bass.baseTargetZ = marks.bass.z;
    }
    if (this.memberSpots?.drums && marks.drums) {
      this.memberSpots.drums.baseTargetX = marks.drums.x ?? 0;
      this.memberSpots.drums.baseTargetZ = marks.drums.z ?? -2.8;
    }
    if (this.memberSpots?.piano && marks.piano) {
      this.memberSpots.piano.baseTargetX = marks.piano.x;
      this.memberSpots.piano.baseTargetZ = marks.piano.z;
    }

    // Reset roaming motion state cleanly to lineup home marks
    this.resetBandMotion(marks);

    // Rebuild drum kit if double-kick requirement changed for Rock Power Trio
    this.swapDrumKitMesh(this.drumKitModelId, marks.forceDoubleKick);
    // Re-apply active star look in case vocalist visibility changed
    this.applyStarLook(this.starLookId);
  }

  resetBandMotion(marks = this.getLineupMarks()) {
    const resetRole = (role, mark) => {
      const m = this.memberMotion?.[role];
      if (!m || !mark) return;
      m.x = mark.x;
      m.z = mark.z;
      m.rotY = mark.rotY;
      m.targetX = mark.x;
      m.targetZ = mark.z;
      m.targetRotY = mark.rotY;
      m.vx = 0;
      m.vz = 0;
      m.vRotY = 0;
      m.jumpY = 0;
      m.jumpVel = 0;
      m.crouchTimer = 0;
      m.pendingJumpVel = 0;
      m.squash = 0;
      m.kneeDrop = 0;
      m.vKneeDrop = 0;
      m.windmillTimer = 0;
      m.windmillPhase = 0;
      m.fistPumpWeight = 0;
      m.stanceMode = 'HOME';
      m.action = 'SPOTLIGHT_SWAY';
      m.actionHistory.length = 0;
      m.actionTimer = 0;
      m.modeTimer = 0;
      m.spinRemaining = 0;
      m.sustainLean = 0;
    };
    resetRole('guitar', marks.guitar);
    resetRole('bass', marks.bass);
    resetRole('vocals', marks.vocals);
    this.stageChoreoTimer = 0;
    this.stageChoreoStep = 0;
    this.lastJumpBeat = -999;
    this.lastChoreoSectionId = null;
  }

  /**
   * Triggers a coordinated beat-synced band jump with knee-bend anticipation and landing squash!
   */
  triggerBandJump(strength = 1.0, roles = ['guitar', 'bass', 'vocals']) {
    const launchVel = 5.1 + Math.min(1.8, strength * 1.15);
    for (let i = 0; i < roles.length; i += 1) {
      const m = this.memberMotion?.[roles[i]];
      if (!m || m.jumpY > 0.05 || m.crouchTimer > 0) continue;
      m.crouchTimer = 0.11; // crisp knee-bend anticipation dip before liftoff!
      m.pendingJumpVel = launchVel * (0.94 + i * 0.05);
    }
  }

  triggerCryoJets(durationSec = 1.65) {
    this.cryoBurstTimer = Math.max(this.cryoBurstTimer, durationSec);
  }

  setBandLineup(id) {
    this.bandLineupId = id || 'arena-4piece';
    this.bandLineup = getBandLineupById(this.bandLineupId);
    this.applyBandLineup();
  }

  setGuitarModel(id) {
    this.swapGuitarMesh(id);
  }

  setBassModel(id) {
    this.swapBassMesh(id);
  }

  setDrumKitModel(id) {
    const marks = this.getLineupMarks();
    this.swapDrumKitMesh(id, marks.forceDoubleKick);
  }

  setKeyboardModel(id) {
    this.swapKeyboardMesh(id);
  }

  setStarLook(id) {
    this.applyStarLook(id);
  }

  setInstrumentSkin(skinId, targetRole = 'all') {
    const cleanId = skinId || 'classic-sunburst';
    const marks = this.getLineupMarks();
    if (!this.instrumentSkins) {
      this.instrumentSkins = {
        guitar: this.instrumentSkinId,
        bass: this.instrumentSkinId,
        drums: this.instrumentSkinId,
        piano: this.instrumentSkinId,
      };
    }

    if (targetRole === 'all') {
      this.instrumentSkinId = cleanId;
      this.instrumentSkins.guitar = cleanId;
      this.instrumentSkins.bass = cleanId;
      this.instrumentSkins.drums = cleanId;
      this.instrumentSkins.piano = cleanId;
      this.swapGuitarMesh(this.guitarModelId);
      this.swapBassMesh(this.bassModelId);
      this.swapDrumKitMesh(this.drumKitModelId, marks.forceDoubleKick);
      this.swapKeyboardMesh(this.keyboardModelId);
    } else if (targetRole === 'guitar') {
      this.instrumentSkins.guitar = cleanId;
      this.swapGuitarMesh(this.guitarModelId);
    } else if (targetRole === 'bass') {
      this.instrumentSkins.bass = cleanId;
      this.swapBassMesh(this.bassModelId);
    } else if (targetRole === 'drums') {
      this.instrumentSkins.drums = cleanId;
      this.swapDrumKitMesh(this.drumKitModelId, marks.forceDoubleKick);
    } else if (targetRole === 'piano') {
      this.instrumentSkins.piano = cleanId;
      this.swapKeyboardMesh(this.keyboardModelId);
    }

    if (targetRole === 'all' || targetRole === 'guitar') {
      // Swap amp cabinet grille texture cleanly and dispose old texture
      const prevGrillTex = this.ampGrillTex;
      this.ampGrillTex = createAmpGrilleSkinTexture(this.instrumentSkins.guitar);
      for (let i = 0; i < this.ampGrillMats.length; i += 1) {
        this.ampGrillMats[i].map = this.ampGrillTex;
        this.ampGrillMats[i].needsUpdate = true;
      }
      prevGrillTex?.dispose?.();
    }
  }

  setAdaptiveQualityMode(lowPower) {
    const next = Boolean(lowPower);
    if (this.adaptiveLowPower === next) return;
    this.adaptiveLowPower = next;
    if (this.renderer) {
      const targetDpr = next ? 1 : Math.min(window.devicePixelRatio || 1, this.isSoftwareGl ? 1 : 1.5);
      this.renderer.setPixelRatio(targetDpr);
    }
  }

  resetCameraForSong() {
    this.resetBandMotion();
    this.cameraDirector?.resetForSong();
  }

  setBackstageFocus(focusKey) {
    this.cameraDirector?.setBackstageFocus(focusKey);
  }

  /**
   * Builds 1,652 Packed Arena Floor & Pit Fans using batched InstancedMesh layers at locked 60 FPS:
   *  - 192 Detailed 17-part Roblox R15 Front-Barricade Pit Fans (wrapping the T-catwalk & front barricade)
   *  - 1,460 Dense General Admission Standing Floor Fans packed wall-to-wall across x: [-28, 28], z: [6.0, 42.0]
   *    all the way back to the FOH sound/lighting booth, leaving a crisp 1.2m security barricade aisle around
   *    the stage lip (z = 5.0) and T-catwalk (x: [-3.2, 3.2], z: [5, 11.5]) with ZERO empty concrete patches!
   *  - Diverse concert merch tees/jackets, randomized 0.88x–1.14x scale, raised hands/devil horns, lightsticks & phones.
   */
  buildFullBodiedCrowd3D() {
    const count = 192;
    this.crowdCount = count;
    this.crowdSeeds = [];
    this.crowdPhase = new Float32Array(count);
    this.crowdRole = new Uint8Array(count);
    this.crowdColorState = new Uint8Array(count);
    this.crowdEventRole = new Uint8Array(count);

    const legsGeo = createBeveledBoxGeometry(0.56, 0.72, 0.34, 0.028);
    const beltGeo = createBeveledBoxGeometry(0.65, 0.16, 0.39, 0.02);
    const torsoGeo = createBeveledBoxGeometry(0.68, 0.64, 0.38, 0.036);
    const headGeo = createRobloxR15HeadGeometry();
    const hairGeo = createSpikyHairGeometry();
    const capGeo = createBaseballCapGeometry();
    const hpGeo = createHeadphonesGeometry();

    // Shoulder-jointed upper arm + elbow-jointed forearm for fluid R15 waving
    const upperArmGeo = createBeveledBoxGeometry(0.21, 0.36, 0.21, 0.022);
    upperArmGeo.translate(0, 0.17, 0);
    const forearmGeo = createBeveledBoxGeometry(0.18, 0.36, 0.18, 0.02);
    forearmGeo.translate(0, 0.17, 0);

    const stickGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.62, 6);
    stickGeo.translate(0, 0.31, 0);
    const backpackGeo = createBeveledBoxGeometry(0.42, 0.44, 0.16, 0.022);
    const phoneGeo = new THREE.BoxGeometry(0.11, 0.2, 0.035);
    phoneGeo.translate(0, 0.1, 0);
    const collarGeo = createBeveledBoxGeometry(0.74, 0.16, 0.42, 0.024);
    const wristbandGeo = new THREE.CylinderGeometry(0.115, 0.115, 0.07, 8);
    const foamFingerGeo = createBeveledBoxGeometry(0.22, 0.44, 0.08, 0.015);
    foamFingerGeo.translate(0, 0.22, 0);

    this.crowdFaceTex = createCrowdR15FaceTexture();
    const legsMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0.05 });
    const beltMat = new THREE.MeshStandardMaterial({ color: 0x0b0f19, roughness: 0.6, metalness: 0.28 });
    const torsoMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.56, metalness: 0.1 });
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this.crowdFaceTex,
      roughness: 0.45,
      metalness: 0.04,
    });
    const headwearMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.48, metalness: 0.18 });
    const backpackMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.66, metalness: 0.12 });
    const collarMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.65, metalness: 0.08 });
    const upperArmMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.58, metalness: 0.08 });
    const forearmMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.05 });
    this.lightstickMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.crowdPhoneMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.crowdWristbandMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const foamFingerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72, metalness: 0.05 });

    // Split headwear counts cleanly across the 192 front-pit hero fans
    this.hairIndices = [];
    this.capIndices = [];
    this.hpIndices = [];
    for (let i = 0; i < count; i += 1) {
      const style = i % 5;
      this.crowdRole[i] = style;
      if (style === 0 || style === 2) this.hairIndices.push(i);
      else if (style === 1 || style === 4) this.capIndices.push(i);
      else this.hpIndices.push(i);
    }

    this.crowdLegsMesh = new THREE.InstancedMesh(legsGeo, legsMat, count);
    this.crowdBeltMesh = new THREE.InstancedMesh(beltGeo, beltMat, count);
    this.crowdTorsoMesh = new THREE.InstancedMesh(torsoGeo, torsoMat, count);
    this.crowdBodyMesh = this.crowdTorsoMesh;
    this.crowdCollarMesh = new THREE.InstancedMesh(collarGeo, collarMat, count);
    this.crowdHeadMesh = new THREE.InstancedMesh(headGeo, headMat, count);
    this.crowdHairMesh = new THREE.InstancedMesh(hairGeo, headwearMat, this.hairIndices.length);
    this.crowdCapMesh = new THREE.InstancedMesh(capGeo, headwearMat, this.capIndices.length);
    this.crowdHpMesh = new THREE.InstancedMesh(hpGeo, headwearMat, this.hpIndices.length);
    this.crowdBackpackMesh = new THREE.InstancedMesh(backpackGeo, backpackMat, count);
    this.crowdUpperArmLMesh = new THREE.InstancedMesh(upperArmGeo, upperArmMat, count);
    this.crowdUpperArmRMesh = new THREE.InstancedMesh(upperArmGeo, upperArmMat, count);
    this.crowdForearmLMesh = new THREE.InstancedMesh(forearmGeo, forearmMat, count);
    this.crowdForearmRMesh = new THREE.InstancedMesh(forearmGeo, forearmMat, count);
    this.crowdWristbandMesh = new THREE.InstancedMesh(wristbandGeo, this.crowdWristbandMat, count);
    this.crowdFoamFingerMesh = new THREE.InstancedMesh(foamFingerGeo, foamFingerMat, count);
    this.lightstickMesh = new THREE.InstancedMesh(stickGeo, this.lightstickMat, count);
    this.glowstickMesh = this.lightstickMesh;
    this.crowdPhoneMesh = new THREE.InstancedMesh(phoneGeo, this.crowdPhoneMat, count);

    [
      this.crowdLegsMesh,
      this.crowdBeltMesh,
      this.crowdTorsoMesh,
      this.crowdCollarMesh,
      this.crowdHeadMesh,
      this.crowdHairMesh,
      this.crowdCapMesh,
      this.crowdHpMesh,
      this.crowdBackpackMesh,
      this.crowdUpperArmLMesh,
      this.crowdUpperArmRMesh,
      this.crowdForearmLMesh,
      this.crowdForearmRMesh,
      this.crowdWristbandMesh,
      this.crowdFoamFingerMesh,
      this.lightstickMesh,
      this.crowdPhoneMesh,
    ].forEach((m) => {
      m.frustumCulled = false;
    });

    // Helper: enforce barricade clearance around expanded 38m deck (z=5.5), extended catwalk (|x|>3.6), and circular B-Stage (center z=11.0, r=3.4 -> clear > 4.65m / z > 14.8)
    const enforceBarricadeClearance = (rawX, rawZ, seedIdx) => {
      let x = rawX;
      let z = Math.max(6.8 + (seedIdx % 3) * 0.16, rawZ);
      if (z < 11.0 && Math.abs(x) < 3.7) {
        const sign = x >= 0 ? 1 : -1;
        x = sign * (3.75 + (seedIdx % 5) * 0.34);
      }
      const distB = Math.hypot(x, z - 11.0);
      if (distB < 4.68) {
        const dz = z - 11.0;
        const pushR = 4.74 + (seedIdx % 4) * 0.28;
        if (dz < 0) {
          const sign = x >= 0 ? 1 : -1;
          const reqX = Math.sqrt(Math.max(0.25, pushR * pushR - dz * dz));
          x = sign * Math.max(Math.abs(x), reqX);
        } else {
          const ang = Math.atan2(x, Math.max(0.25, dz));
          x = Math.sin(ang) * pushR;
          z = Math.max(14.85, 11.0 + Math.cos(ang) * pushR);
        }
      }
      return { x, z };
    };

    // 1. Pack 192 Articulated Hero Pit Fans tightly along the front barricade & catwalk wings (x: [-16, 16], z: [6.2, 16.5])
    const rows = 8;
    const perRow = Math.ceil(count / rows);
    let idx = 0;
    for (let r = 0; r < rows && idx < count; r += 1) {
      const rowT = r / (rows - 1);
      const zBase = 6.25 + rowT * 10.2;
      const spreadX = 13.8 + rowT * 3.4;

      for (let c = 0; c < perRow && idx < count; c += 1) {
        const colT = perRow > 1 ? c / (perRow - 1) : 0.5;
        const jitterX = Math.sin(idx * 12.7 + r * 3.1) * 0.42;
        const jitterZ = Math.cos(idx * 9.3 + c * 2.7) * 0.38;
        const cleared = enforceBarricadeClearance((colT * 2 - 1) * spreadX + jitterX, zBase + jitterZ, idx);
        const x = cleared.x;
        const z = cleared.z;
        const floorY = -1.2 + Math.max(0, (z - 14.0) / 28.0) * 0.85;
        const facingY = Math.atan2(-x, -1.5 - z);
        const heightScale = 0.88 + ((idx * 19 + r * 7) % 27) * 0.01; // 0.88x - 1.14x
        const widthScale = 0.88 + ((idx * 23 + c * 5) % 27) * 0.01;
        const scale = heightScale;
        const poseVariant = (idx * 3 + r) % 4;
        const baseStickColorHex = CROWD_STICK_COLORS[(idx * 5 + r) % CROWD_STICK_COLORS.length];
        const phase = idx * 0.73 + (r % 3) * 0.41;
        const waveDelay = rowT * 0.65 + Math.abs(colT - 0.5) * 0.35;
        const hasStick = poseVariant === 2 || (poseVariant !== 0 && idx % 3 !== 0);
        const hasBackpack = idx % 5 === 1 || idx % 7 === 0;
        const hasPhone = poseVariant === 2 || idx % 3 === 1;
        const hasHoodie = idx % 2 === 0 || idx % 3 === 2;
        const hasFoamFinger = !hasStick && idx % 4 === 0;

        this.crowdPhase[idx] = phase;
        this.crowdSeeds.push({
          x,
          floorY,
          z,
          facingY,
          scale,
          heightScale,
          widthScale,
          poseVariant,
          baseStickColorHex,
          phase,
          waveDelay,
          hasStick,
          hasBackpack,
          hasPhone,
          hasHoodie,
          hasFoamFinger,
        });

        this._colorA.setHex(CROWD_SHIRT_COLORS[idx % CROWD_SHIRT_COLORS.length]);
        this.crowdTorsoMesh.setColorAt(idx, this._colorA);
        this.crowdUpperArmLMesh.setColorAt(idx, this._colorA);
        this.crowdUpperArmRMesh.setColorAt(idx, this._colorA);

        this._colorB.setHex(idx % 3 === 0 ? 0xf8fafc : 0x0f172a);
        this.crowdCollarMesh.setColorAt(idx, this._colorB);

        this._colorB.setHex(CROWD_PANTS_COLORS[(idx * 3) % CROWD_PANTS_COLORS.length]);
        this.crowdLegsMesh.setColorAt(idx, this._colorB);
        this._colorB.setHex(idx % 2 === 0 ? 0x1e293b : 0x334155);
        this.crowdBackpackMesh.setColorAt(idx, this._colorB);

        this._colorB.setHex(CROWD_SKIN_TONES[idx % CROWD_SKIN_TONES.length]);
        this.crowdHeadMesh.setColorAt(idx, this._colorB);
        this.crowdForearmLMesh.setColorAt(idx, this._colorB);
        this.crowdForearmRMesh.setColorAt(idx, this._colorB);

        this._colorA.setHex(baseStickColorHex);
        this.lightstickMesh.setColorAt(idx, this._colorA);
        this.crowdWristbandMesh.setColorAt(idx, this._colorA);
        this._colorB.setHex(idx % 2 === 0 ? 0xef4444 : 0x38bdf8);
        this.crowdFoamFingerMesh.setColorAt(idx, this._colorB);
        this._colorB.setHex(0xfef9c3);
        this.crowdPhoneMesh.setColorAt(idx, this._colorB);

        idx += 1;
      }
    }

    // Color headwear pools
    this.hairIndices.forEach((fanIdx, slot) => {
      this._colorA.setHex(CROWD_HAIR_COLORS[fanIdx % CROWD_HAIR_COLORS.length]);
      this.crowdHairMesh.setColorAt(slot, this._colorA);
    });
    this.capIndices.forEach((fanIdx, slot) => {
      this._colorA.setHex(CROWD_CAP_COLORS[fanIdx % CROWD_CAP_COLORS.length]);
      this.crowdCapMesh.setColorAt(slot, this._colorA);
    });
    this.hpIndices.forEach((fanIdx, slot) => {
      this._colorA.setHex(fanIdx % 2 === 0 ? 0x38bdf8 : 0xfacc15);
      this.crowdHpMesh.setColorAt(slot, this._colorA);
    });

    [
      this.crowdLegsMesh,
      this.crowdBeltMesh,
      this.crowdTorsoMesh,
      this.crowdCollarMesh,
      this.crowdHeadMesh,
      this.crowdHairMesh,
      this.crowdCapMesh,
      this.crowdHpMesh,
      this.crowdBackpackMesh,
      this.crowdUpperArmLMesh,
      this.crowdUpperArmRMesh,
      this.crowdForearmLMesh,
      this.crowdForearmRMesh,
      this.crowdWristbandMesh,
      this.crowdFoamFingerMesh,
      this.lightstickMesh,
      this.crowdPhoneMesh,
    ].forEach((m) => {
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.castShadow = false;
      m.receiveShadow = false;
      m.frustumCulled = false;
    });

    this.scene.add(
      this.crowdLegsMesh,
      this.crowdBeltMesh,
      this.crowdTorsoMesh,
      this.crowdCollarMesh,
      this.crowdHeadMesh,
      this.crowdHairMesh,
      this.crowdCapMesh,
      this.crowdHpMesh,
      this.crowdBackpackMesh,
      this.crowdUpperArmLMesh,
      this.crowdUpperArmRMesh,
      this.crowdForearmLMesh,
      this.crowdForearmRMesh,
      this.crowdWristbandMesh,
      this.crowdFoamFingerMesh,
      this.lightstickMesh,
      this.crowdPhoneMesh
    );

    // 2. Massive Packed General Admission Standing Arena Floor Crowd (1,460 instanced fans -> 1,652 total floor fans!)
    //    Fills x: [-28, 28], z: [6.0, 42.0] tightly around the catwalk & all the way back to the FOH booth at 60 FPS!
    const gaFloorSeeds = [];
    const gaMerchPalette = [
      0x111827, 0x1e293b, 0x18181b, 0x27272a, 0x3f1d2b, 0x7f1d1d,
      0x991b1b, 0x1d4ed8, 0x0f766e, 0x3730a3, 0x4c1d95, 0x854d0e,
      0xb45309, 0xbe123c, 0x0369a1, 0x334155, 0x581c87, 0x065f46,
      0xd97706, 0x475569, 0xe11d48, 0x2563eb, 0xf8fafc, 0x1f2937,
    ];
    let gaIdx = 0;

    // 2A. Dense front-barricade outer wings & mid-pit infill (z: 6.2..17.6, x: -28..28) so front standing floor is wall-to-wall!
    const frontBandRows = 12;
    for (let r = 0; r < frontBandRows; r += 1) {
      const zRow = 6.3 + r * 0.96;
      const stepX = zRow < 12.6 ? 1.05 : 1.08;
      for (let gx = -27.6; gx <= 27.6; gx += stepX) {
        const hash = Math.sin(gaIdx * 17.31 + r * 5.7) * 43758.5453;
        const randA = hash - Math.floor(hash);
        const hashB = Math.cos(gaIdx * 11.17 + gx * 3.9) * 28461.231;
        const randB = hashB - Math.floor(hashB);
        const x = gx + (randA - 0.5) * 0.62;
        const z = zRow + (randB - 0.5) * 0.58;

        // Strictly respect security barricade aisle around 38m main stage lip (z > 6.7), catwalk (|x| > 3.6) & circular B-stage (r > 4.65 / z > 14.8)
        if (z < 6.75) continue;
        if (z < 11.0 && Math.abs(x) < 3.65) continue;
        if (Math.hypot(x, z - 11.0) < 4.62) continue;

        // Inside the inner hero pit (|x| < 16.0, z < 16.8), place interstitial fill fans on alternate slots so density is seamless without stacking
        const insideHeroZone = Math.abs(x) < 16.0 && z < 16.8;
        if (insideHeroZone && (r + Math.floor((gx + 30) * 0.9)) % 2 === 0) {
          gaIdx += 1;
          continue;
        }

        const scale = 0.88 + randA * 0.26; // 0.88x - 1.14x
        const widthScale = 0.88 + randB * 0.24;
        const floorY = -1.2 + Math.max(0, (z - 14.0) / 28.0) * 0.85;
        gaFloorSeeds.push({
          x,
          z,
          floorY,
          facingY: Math.atan2(-x, -1.5 - z),
          heightScale: scale,
          widthScale,
          phase: randA * Math.PI * 2 + gaIdx * 0.37,
          waveDelay: ((z - 6.0) / 36.0) * 1.1 + (Math.abs(x) / 28.0) * 0.45,
          shirtHex: gaMerchPalette[(gaIdx * 7 + r * 3) % gaMerchPalette.length],
          pantsHex: CROWD_PANTS_COLORS[(gaIdx * 5) % CROWD_PANTS_COLORS.length],
          skinHex: CROWD_SKIN_TONES[(gaIdx * 3) % CROWD_SKIN_TONES.length],
          stickHex: CROWD_STICK_COLORS[(gaIdx * 5 + r) % CROWD_STICK_COLORS.length],
          hasLight: randB > 0.34, // 66% carry glowing lightstick / phone light
          isDevilHorns: (gaIdx % 3) === 0,
        });
        gaIdx += 1;
      }
    }

    // 2B. Full-width General Admission standing floor extending back to the FOH booth (z: 17.8..41.8, x: -28..28)
    const backRows = 19;
    for (let r = 0; r < backRows; r += 1) {
      const zRow = 18.0 + r * 1.24;
      const stepX = 1.16 + (r / backRows) * 0.24;
      for (let gx = -27.8; gx <= 27.8; gx += stepX) {
        if (gaFloorSeeds.length >= 1460) break;
        const hash = Math.sin(gaIdx * 23.13 + r * 7.1) * 43758.5453;
        const randA = hash - Math.floor(hash);
        const hashB = Math.cos(gaIdx * 13.71 + gx * 2.3) * 19531.71;
        const randB = hashB - Math.floor(hashB);
        const x = gx + (randA - 0.5) * 0.72;
        const z = zRow + (randB - 0.5) * 0.68;
        if (Math.abs(x) > 28.1 || z > 42.0) continue;

        // Subtle cutout right around the FOH mixing desk footprint at far back center if present
        if (z > 39.2 && Math.abs(x) < 3.4) continue;

        const scale = 0.88 + randA * 0.26;
        const widthScale = 0.88 + randB * 0.24;
        const floorY = -1.2 + Math.max(0, (z - 14.0) / 28.0) * 0.92;
        gaFloorSeeds.push({
          x,
          z,
          floorY,
          facingY: Math.atan2(-x, -1.5 - z),
          heightScale: scale,
          widthScale,
          phase: randA * Math.PI * 2 + gaIdx * 0.41,
          waveDelay: ((z - 6.0) / 36.0) * 1.15 + (Math.abs(x) / 28.0) * 0.42,
          shirtHex: gaMerchPalette[(gaIdx * 11 + r * 5) % gaMerchPalette.length],
          pantsHex: CROWD_PANTS_COLORS[(gaIdx * 3) % CROWD_PANTS_COLORS.length],
          skinHex: CROWD_SKIN_TONES[(gaIdx * 5) % CROWD_SKIN_TONES.length],
          stickHex: CROWD_STICK_COLORS[(gaIdx * 7 + r) % CROWD_STICK_COLORS.length],
          hasLight: randB > 0.36,
          isDevilHorns: (gaIdx % 3) === 1,
        });
        gaIdx += 1;
      }
      if (gaFloorSeeds.length >= 1460) break;
    }

    this.floorCrowdSeeds = gaFloorSeeds;
    this.floorCrowdCount = gaFloorSeeds.length;
    this.floorCrowdColorState = -1;
    this._floorCrowdFrameTick = 0;

    // Stylized low-poly 5-layer InstancedMesh silhouettes for the 1,460 standing floor fans (5 draw calls total!)
    const gaLegsGeo = new THREE.BoxGeometry(0.54, 0.74, 0.32);
    const gaTorsoGeo = mergeSimpleGeometries([
      new THREE.BoxGeometry(0.7, 0.68, 0.38),
      (() => {
        const g = new THREE.BoxGeometry(0.74, 0.14, 0.4);
        g.translate(0, 0.3, 0);
        return g;
      })(),
    ]);
    const gaHeadGeo = mergeSimpleGeometries([
      new THREE.BoxGeometry(0.42, 0.44, 0.42),
      (() => {
        const cap = new THREE.BoxGeometry(0.45, 0.13, 0.46);
        cap.translate(0, 0.22, 0.02);
        return cap;
      })(),
    ]);
    // Dual raised concert arms with angled rock/devil-horns silhouette pivoted at shoulder y=0
    const gaArmParts = [];
    const leftArmG = new THREE.BoxGeometry(0.18, 0.66, 0.18);
    leftArmG.rotateZ(0.32);
    leftArmG.translate(-0.46, 0.28, 0.05);
    gaArmParts.push(leftArmG);
    const rightArmG = new THREE.BoxGeometry(0.18, 0.68, 0.18);
    rightArmG.rotateZ(-0.3);
    rightArmG.translate(0.46, 0.29, 0.05);
    gaArmParts.push(rightArmG);
    // Subtle raised devil-horns finger silhouettes on left & right hands
    const hornL = new THREE.BoxGeometry(0.16, 0.14, 0.08);
    hornL.translate(-0.58, 0.64, 0.08);
    gaArmParts.push(hornL);
    const hornR = new THREE.BoxGeometry(0.16, 0.14, 0.08);
    hornR.translate(0.58, 0.65, 0.08);
    gaArmParts.push(hornR);
    const gaArmsGeo = mergeSimpleGeometries(gaArmParts);
    gaArmParts.forEach((g) => g.dispose());

    const gaLightGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.52, 5);
    gaLightGeo.translate(0, 0.26, 0);

    const gaLegsMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, metalness: 0.04 });
    const gaTorsoMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.64, metalness: 0.08 });
    const gaHeadMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.56, metalness: 0.04 });
    const gaArmsMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, metalness: 0.06 });
    this.floorCrowdLightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    this.floorCrowdLegsMesh = new THREE.InstancedMesh(gaLegsGeo, gaLegsMat, this.floorCrowdCount);
    this.floorCrowdTorsoMesh = new THREE.InstancedMesh(gaTorsoGeo, gaTorsoMat, this.floorCrowdCount);
    this.floorCrowdHeadMesh = new THREE.InstancedMesh(gaHeadGeo, gaHeadMat, this.floorCrowdCount);
    this.floorCrowdArmsMesh = new THREE.InstancedMesh(gaArmsGeo, gaArmsMat, this.floorCrowdCount);
    this.floorCrowdLightMesh = new THREE.InstancedMesh(gaLightGeo, this.floorCrowdLightMat, this.floorCrowdCount);

    for (let i = 0; i < this.floorCrowdCount; i += 1) {
      const s = gaFloorSeeds[i];
      this._colorA.setHex(s.pantsHex);
      this.floorCrowdLegsMesh.setColorAt(i, this._colorA);
      this._colorA.setHex(s.shirtHex);
      this.floorCrowdTorsoMesh.setColorAt(i, this._colorA);
      this.floorCrowdArmsMesh.setColorAt(i, this._colorA);
      this._colorA.setHex(s.skinHex);
      this.floorCrowdHeadMesh.setColorAt(i, this._colorA);
      this._colorA.setHex(s.stickHex);
      this.floorCrowdLightMesh.setColorAt(i, this._colorA);
    }

    [
      this.floorCrowdLegsMesh,
      this.floorCrowdTorsoMesh,
      this.floorCrowdHeadMesh,
      this.floorCrowdArmsMesh,
      this.floorCrowdLightMesh,
    ].forEach((m) => {
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.castShadow = false;
      m.receiveShadow = false;
      m.frustumCulled = false;
      this.scene.add(m);
    });

    // Pre-allocated Crowd Surfer 3D R15 NPC (Zero GC!)
    const surferGroup = new THREE.Group();
    const sShirt = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.5 });
    const sPants = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
    const sSkin = new THREE.MeshStandardMaterial({ color: 0xf4c79a, roughness: 0.45 });
    const sTorso = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.72, 0.36), sShirt);
    const sHead = new THREE.Mesh(headGeo, sSkin);
    sHead.position.set(0, 0.6, 0);
    const sLegL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.68, 0.28), sPants);
    sLegL.position.set(-0.18, -0.68, 0);
    const sLegR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.68, 0.28), sPants);
    sLegR.position.set(0.18, -0.68, 0);
    const sArmL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), sSkin);
    sArmL.position.set(-0.46, 0.14, 0.08);
    sArmL.rotation.z = 0.55;
    const sArmR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), sSkin);
    sArmR.position.set(0.46, 0.14, 0.08);
    sArmR.rotation.z = -0.55;
    surferGroup.add(sTorso, sHead, sLegL, sLegR, sArmL, sArmR);
    surferGroup.rotation.x = Math.PI * 0.48;
    surferGroup.visible = false;
    this.crowdSurferGroup = surferGroup;
    this.scene.add(surferGroup);

    // Pre-allocated Cartoon Brawl Dust & Star Burst FX Group ('SUNTUKAN', Zero GC!)
    const brawlGroup = new THREE.Group();
    const dustMat = new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.72 });
    const starMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
    const puffGeo = new THREE.IcosahedronGeometry(0.32, 0);
    const starGeo = new THREE.OctahedronGeometry(0.18, 0);
    this.brawlPuffs = [];
    for (let p = 0; p < 5; p += 1) {
      const m = new THREE.Mesh(p < 2 ? puffGeo : starGeo, p < 2 ? dustMat : starMat);
      brawlGroup.add(m);
      this.brawlPuffs.push(m);
    }
    brawlGroup.visible = false;
    this.brawlFxGroup = brawlGroup;
    this.scene.add(brawlGroup);

    // Pre-allocated Blue Teardrop Particle Pool for Ballad Crying Sway (Zero GC!)
    this.crowdTearCount = 128;
    const tearPositions = new Float32Array(this.crowdTearCount * 3);
    for (let tIdx = 0; tIdx < this.crowdTearCount; tIdx += 1) {
      tearPositions[tIdx * 3 + 1] = -60;
    }
    const tearGeo = new THREE.BufferGeometry();
    tearGeo.setAttribute('position', new THREE.BufferAttribute(tearPositions, 3));
    const tearMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.16,
      map: this.glowTex,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.crowdTearPoints = new THREE.Points(tearGeo, tearMat);
    this.crowdTearPoints.frustumCulled = false;
    this.crowdTearPoints.visible = false;
    this.crowdTearParticles = Array.from({ length: this.crowdTearCount }, () => ({
      active: false,
      x: 0,
      y: -60,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 0,
      maxLife: 0.55,
    }));
    this.crowdTearCursor = 0;
    this.crowdTearSpawnTimer = 0;
    this.scene.add(this.crowdTearPoints);

    this.updateCrowd(
      0,
      { beatPhase: 0, bassE: 0.12, overallE: 0.25, bpm: 120, songTime: 0, hypeNorm: 0.55, feverOrEncore: false },
      'VERSE',
      0
    );
  }

  nextCrowdRand() {
    this.crowdEvent.seed = (this.crowdEvent.seed * 1664525 + 1013904223) >>> 0;
    return this.crowdEvent.seed / 4294967296;
  }

  updateCrowdEventState(dt, { playing, isWalkOn, hypeNorm, feverOrEncore, sectionType, ambianceType, streak = 0 }) {
    const ev = this.crowdEvent;
    if (!playing || isWalkOn) {
      ev.type = 'NORMAL';
      ev.timer = 0;
      ev.cooldown = 4.5;
      this.activeCrowdEvent.type = 'NORMAL';
      this.prevCrowdStreak = streak;
      this.crowdLastSection = sectionType;
      return;
    }

    if (ev.type !== 'NORMAL') {
      ev.timer -= dt;
      if (ev.timer <= 0) {
        ev.type = 'NORMAL';
        ev.cooldown = 10.0 + this.nextCrowdRand() * 8.0;
      }
      this.activeCrowdEvent.type = ev.type;
      this.prevCrowdStreak = streak;
      this.crowdLastSection = sectionType;
      return;
    }

    const sectionChangedPeak =
      sectionType &&
      sectionType !== this.crowdLastSection &&
      (sectionType === 'CHORUS' || sectionType === 'BRIDGE') &&
      ev.cooldown < 7.5;
    const crossed50Streak = streak >= 50 && this.prevCrowdStreak < 50;
    this.prevCrowdStreak = streak;
    this.crowdLastSection = sectionType;

    ev.cooldown -= dt;
    if (ev.cooldown > 0 && !sectionChangedPeak && !crossed50Streak) {
      this.activeCrowdEvent.type = 'NORMAL';
      return;
    }

    const r = this.nextCrowdRand();
    const isBallad = ambianceType === 'BALLAD_EMOTIONAL';
    if (isBallad || sectionType === 'BRIDGE') {
      ev.type = r < 0.36 ? 'HEART_HANDS' : 'CRYING_SWAY';
      ev.duration = 8.0 + this.nextCrowdRand() * 3.0;
      ev.centerX = 0;
      ev.centerZ = 15.2;
    } else if (hypeNorm < 0.44 || (ambianceType === 'METAL_CHAOS' && r < 0.32)) {
      ev.type = 'SUNTUKAN';
      ev.duration = 6.0 + this.nextCrowdRand() * 2.0;
      let fA = -1;
      let fB = -1;
      for (let ci = 0; ci < this.crowdSeeds.length - 1; ci += 1) {
        const sa = this.crowdSeeds[ci];
        const sb = this.crowdSeeds[ci + 1];
        if (sa && sb && sa.z >= 12.4 && sb.z >= 12.4 && Math.abs(sa.x) <= 5.5 && Math.abs(sb.x) <= 5.5) {
          fA = ci;
          fB = ci + 1;
          break;
        }
      }
      ev.fighterAIdx = fA >= 0 ? fA : 60;
      ev.fighterBIdx = fB >= 0 ? fB : 61;
      const fa = this.crowdSeeds[ev.fighterAIdx];
      const fb = this.crowdSeeds[ev.fighterBIdx];
      if (fa && fb && fa.z >= 12.2 && fb.z >= 12.2) {
        ev.centerX = (fa.x + fb.x) * 0.5;
        ev.centerZ = Math.max(12.6, (fa.z + fb.z) * 0.5);
      } else {
        ev.centerX = 0;
        ev.centerZ = 14.8;
      }
    } else if (
      (ambianceType === 'METAL_CHAOS' || ambianceType === 'ROCK_ANTHEM' || sectionType === 'CHORUS' || sectionType === 'GUITAR_SOLO') &&
      r < 0.52
    ) {
      ev.type = r < 0.24 ? 'WALL_OF_DEATH' : 'MOSHPIT';
      ev.duration = ev.type === 'WALL_OF_DEATH' ? 7.0 : 7.5 + this.nextCrowdRand() * 2.5;
      ev.centerX = ev.type === 'WALL_OF_DEATH' ? 0 : (this.nextCrowdRand() - 0.5) * 2.4;
      ev.centerZ = 15.2;
    } else if (feverOrEncore || hypeNorm > 0.64 || sectionType === 'CHORUS' || crossed50Streak) {
      if (r < 0.36) {
        ev.type = 'CROWD_SURFING';
        ev.duration = 6.5;
      } else if (r < 0.72) {
        ev.type = 'STADIUM_WAVE';
        ev.duration = 7.6;
      } else {
        ev.type = 'HEART_HANDS';
        ev.duration = 7.0;
      }
      this.crowdSurferDir = this.nextCrowdRand() < 0.5 ? 1 : -1;
      ev.surferX = -6.5 * this.crowdSurferDir;
      ev.surferZ = 12.85;
      ev.centerX = 0;
      ev.centerZ = ev.type === 'CROWD_SURFING' ? 12.85 : 15.2;
    } else if (ambianceType === 'POP_UPBEAT' || r >= 0.52) {
      ev.type = r < 0.75 ? 'STADIUM_WAVE' : 'HEART_HANDS';
      ev.duration = 7.2;
      ev.centerX = 0;
      ev.centerZ = 15.2;
    } else {
      ev.cooldown = 10.0 + this.nextCrowdRand() * 8.0;
      this.activeCrowdEvent.type = 'NORMAL';
      return;
    }

    ev.timer = ev.duration;
    this.activeCrowdEvent.type = ev.type;
  }

  updateFullBodiedCrowd(
    songTime,
    bpm,
    bassE,
    hypeNorm,
    feverOrEncore,
    sectionType = 'VERSE',
    overallE = 0.35,
    streakTier = 0,
    multiplierColor = null,
    ambianceType = 'ROCK_ANTHEM'
  ) {
    const resolvedBeatPhase = (((songTime * (bpm / 60)) % 1) + 1) % 1;
    this.updateCrowd(
      0.016,
      {
        beatPhase: resolvedBeatPhase,
        bassE,
        overallE,
        bpm,
        songTime,
        hypeNorm,
        feverOrEncore,
        isBallad: ambianceType === 'BALLAD_EMOTIONAL',
        ambianceType,
        multiplierColor,
        streakTier,
      },
      sectionType,
      streakTier * 25
    );
  }

  updateCrowd(dt, audioState = {}, songSection = 'VERSE', streak = 0) {
    const t = this.clock;
    const bpm = Math.max(70, Math.min(200, audioState.bpm || 120));
    const songTime = audioState.songTime ?? t;
    const resolvedBeatPhase = Number.isFinite(audioState.beatPhase)
      ? audioState.beatPhase
      : (((songTime * (bpm / 60)) % 1) + 1) % 1;
    const barPhase = Number.isFinite(audioState.barPhase)
      ? audioState.barPhase
      : ((((songTime * (bpm / 60)) / 4) % 1) + 1) % 1;
    const lightstickBoost = audioState.lightstickBoost ?? 1.0;
    const beatRad = resolvedBeatPhase * Math.PI * 2;
    const bassE = audioState.bassE ?? 0.2;
    const overallE = audioState.overallE ?? 0.35;
    const hypeNorm = audioState.hypeNorm ?? 0.55;
    const feverOrEncore = Boolean(audioState.feverOrEncore);
    const ambianceType = audioState.ambianceType || 'ROCK_ANTHEM';
    const multiplierColor = audioState.multiplierColor || null;
    const streakTier =
      audioState.streakTier ?? (streak >= 100 ? 3 : streak >= 50 ? 2 : streak >= 25 ? 1 : 0);

    const ev = this.crowdEvent;
    const evType = ev.type;
    const isBalladMode =
      Boolean(audioState.isBallad) ||
      ambianceType === 'BALLAD_EMOTIONAL' ||
      evType === 'CRYING_SWAY' ||
      evType === 'BALLAD_TEARS';
    const isBalladSway =
      !feverOrEncore &&
      (isBalladMode ||
        (streakTier < 2 &&
          (bpm < 96 || ((songSection === 'INTRO' || songSection === 'BRIDGE') && overallE < 0.32))));
    const isChorusUnison = feverOrEncore || streakTier >= 2 || songSection === 'CHORUS' || songSection === 'OUTRO';
    const isHeartSwirl =
      !isBalladSway && (evType === 'STADIUM_WAVE' || evType === 'HEART_WAVE' || streakTier >= 2 || songSection === 'CHORUS' || feverOrEncore);
    const sectionEnergyMult =
      feverOrEncore ? 1.28 :
      songSection === 'CHORUS' || songSection === 'GUITAR_SOLO' || songSection === 'OUTRO' ? 1.15 :
      songSection === 'PRE_CHORUS' || songSection === 'VERSE' ? 0.85 :
      songSection === 'INTRO' || songSection === 'BRIDGE' ? 0.5 : 0.82;
    const energy = Math.min(
      1.5,
      (0.24 + bassE * 0.85 + hypeNorm * 0.38 + (feverOrEncore ? 0.36 : 0) + streakTier * 0.08) * sectionEnergyMult
    );
    const evProgress = ev.duration > 0 ? Math.max(0, Math.min(1, 1 - ev.timer / ev.duration)) : 0;
    const isHeartHands = evType === 'HEART_HANDS';
    const isWallOfDeath = evType === 'WALL_OF_DEATH';
    const isPeakJumpMoment =
      songSection === 'CHORUS' ||
      songSection === 'GUITAR_SOLO' ||
      feverOrEncore ||
      streak >= 50;
    const jumpPctThreshold = feverOrEncore || streak >= 100 ? 7 : isPeakJumpMoment ? 5 : 1;

    // Resolve live per-instance glowstick / smartphone / wristband color state
    let colorStateCode = 0;
    if (isHeartHands) {
      this._colorA.setHex(0xf472b6);
      colorStateCode = 5;
    } else if (feverOrEncore || streakTier >= 3) {
      this._colorA.setHex(0xfde047);
      colorStateCode = 4;
    } else if (isBalladSway) {
      this._colorA.setHex(0xfef3c7);
      colorStateCode = 1;
    } else if (streakTier >= 1 && multiplierColor) {
      this._colorA.copy(multiplierColor);
      colorStateCode = 3;
    } else if (isChorusUnison) {
      const hue = (t * 0.18) % 1;
      this._colorA.setHSL(hue, 0.92, 0.62);
      colorStateCode = 2;
    } else {
      this._colorA.setHex(THEME_COLORS[this.activeInstrument] || 0x38bdf8);
      colorStateCode = 0;
    }
    this.lightstickMat.color.setHex(0xffffff);
    if (this.crowdWristbandMat) {
      this.crowdWristbandMat.color.setHex(0xffffff);
    }

    // Update Crowd Surfer pooled NPC (sweeping left-to-right across front-row hands!)
    if (this.crowdSurferGroup) {
      if (evType === 'CROWD_SURFING' || evType === 'CROWD_SURF') {
        const startX = -6.5 * this.crowdSurferDir;
        const endX = 6.5 * this.crowdSurferDir;
        const surfX = THREE.MathUtils.lerp(startX, endX, evProgress);
        const surfZ = ev.surferZ + Math.sin(evProgress * Math.PI * 2) * 0.65;
        const surfY = 1.45 + Math.abs(Math.sin(t * 7.2)) * 0.24;
        this.crowdSurferGroup.visible = true;
        this.crowdSurferGroup.position.set(surfX, surfY, surfZ);
        this.crowdSurferGroup.rotation.set(
          Math.PI * 0.48 + Math.sin(t * 5.8) * 0.14,
          Math.sin(t * 3.4) * 0.24,
          Math.cos(t * 4.8) * 0.22
        );
        ev.centerX = surfX;
        ev.centerZ = surfZ;
      } else {
        this.crowdSurferGroup.visible = false;
      }
    }

    if (this.brawlFxGroup) {
      if (evType === 'SUNTUKAN') {
        this.brawlFxGroup.visible = true;
        this.brawlFxGroup.position.set(ev.centerX, 0.55, ev.centerZ);
        for (let p = 0; p < this.brawlPuffs.length; p += 1) {
          const m = this.brawlPuffs[p];
          const ang = t * (4.5 + p) + p * 1.3;
          const rad = p < 2 ? 0.38 : 0.72;
          m.position.set(Math.cos(ang) * rad, Math.sin(ang * 1.4) * 0.35 + (p >= 2 ? 0.38 : 0), Math.sin(ang) * rad);
          m.rotation.set(t * 5 + p, t * 4, p);
          const pScale = p < 2 ? 0.8 + Math.sin(t * 14 + p) * 0.25 : 0.9 + Math.cos(t * 12 + p) * 0.2;
          m.scale.set(pScale, pScale, pScale);
        }
      } else {
        this.brawlFxGroup.visible = false;
      }
    }

    // Stadium Wave sweeping across arena from x = -14 to x = +14 + synchronize 360° Stadium Bowl Spectators!
    const waveFrontX = evType === 'STADIUM_WAVE' || evType === 'HEART_WAVE' ? -14.0 + evProgress * 28.0 : -999;
    const isPhoneLightsEvent = evType === 'PHONE_LIGHTS';
    this.venueEnv?.dynamicElements?.updateBowl?.(
      t,
      waveFrontX,
      evType === 'STADIUM_WAVE' || evType === 'HEART_WAVE',
      isBalladMode || evType === 'CRYING_SWAY',
      resolvedBeatPhase,
      barPhase,
      isChorusUnison,
      lightstickBoost,
      isPhoneLightsEvent
    );

    let hairSlot = 0;
    let capSlot = 0;
    let hpSlot = 0;
    let instanceColorDirty = false;

    for (let i = 0; i < this.crowdCount; i += 1) {
      const s = this.crowdSeeds[i];
      const scH = s.heightScale ?? s.scale;
      const scW = s.widthScale ?? s.scale;
      const scHead = (scH + scW) * 0.5;
      const sc = scH;
      const poseVariant = s.poseVariant ?? (i % 4);
      const fanPhase = this.crowdPhase[i];
      let fanX = s.x;
      let fanZ = s.z;
      let fanFacingY = s.facingY;
      let eventRole = 0;

      if (evType === 'MOSHPIT') {
        if (Math.hypot(s.x - ev.centerX, s.z - ev.centerZ) < 4.4 && s.z >= 12.4) {
          eventRole = 1; // Mosh runner clearing pit & orbiting rapidly outside T-catwalk
          const dx = s.x - ev.centerX;
          const dz = s.z - ev.centerZ;
          const baseDist = Math.hypot(dx, dz);
          const angle = Math.atan2(dz, dx) + t * 3.1;
          const pitR = Math.max(2.4, Math.min(4.0, baseDist + 0.9));
          fanX = ev.centerX + Math.cos(angle) * pitR;
          fanZ = Math.max(12.25, ev.centerZ + Math.sin(angle) * pitR);
          fanFacingY = angle + Math.PI * 0.5;
        }
      } else if (isWallOfDeath && Math.abs(s.x) < 5.2 && s.z >= 12.6 && s.z <= 19.0) {
        eventRole = 7; // Wall of Death split (< -2.4 vs > 2.4) then downbeat collision charge
        const sideSign = s.x >= 0 ? 1 : -1;
        if (evProgress < 0.45) {
          const splitEase = Math.min(1, evProgress / 0.25);
          fanX = THREE.MathUtils.lerp(s.x, sideSign * (2.6 + Math.abs(s.x) * 0.45), splitEase);
          fanFacingY = -sideSign * Math.PI * 0.5;
        } else {
          const chargeT = Math.min(1, (evProgress - 0.45) / 0.35);
          fanX = THREE.MathUtils.lerp(sideSign * 3.0, sideSign * (0.42 + (i % 3) * 0.25), chargeT);
          fanFacingY = -sideSign * Math.PI * 0.5;
        }
      } else if (evType === 'SUNTUKAN') {
        if (i === ev.fighterAIdx) {
          eventRole = 2;
          fanX = ev.centerX - 0.56 + Math.sin(t * 7.5) * 0.14;
          fanZ = ev.centerZ + Math.cos(t * 6.0) * 0.08;
          fanFacingY = Math.PI * 0.5;
        } else if (i === ev.fighterBIdx) {
          eventRole = 3;
          fanX = ev.centerX + 0.56 - Math.sin(t * 7.5) * 0.14;
          fanZ = ev.centerZ - Math.cos(t * 6.0) * 0.08;
          fanFacingY = -Math.PI * 0.5;
        } else {
          const dx = ev.centerX - s.x;
          const dz = ev.centerZ - s.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 4.5) {
            eventRole = 4; // Brawl spectator filming inward
            fanFacingY = Math.atan2(dx, dz);
          }
        }
      } else if ((evType === 'CROWD_SURFING' || evType === 'CROWD_SURF') && this.crowdSurferGroup) {
        const dx = fanX - this.crowdSurferGroup.position.x;
        const dz = fanZ - this.crowdSurferGroup.position.z;
        if (dx * dx + dz * dz < 6.5) {
          eventRole = 5; // Surfer carrier
        }
      } else if (isBalladMode) {
        eventRole = 6;
      }
      this.crowdEventRole[i] = eventRole;

      if (this.crowdColorState[i] !== colorStateCode || colorStateCode === 2) {
        this.crowdColorState[i] = colorStateCode;
        if (colorStateCode === 0) {
          this._colorB.setHex(s.baseStickColorHex || 0x38bdf8).lerp(this._colorA, 0.28);
        } else if (colorStateCode === 2) {
          const fanHue = ((t * 0.18) + (i % 12) * 0.083) % 1;
          this._colorB.setHSL(fanHue, 0.92, 0.62);
        } else {
          this._colorB.copy(this._colorA);
        }
        this.lightstickMesh.setColorAt(i, this._colorB);
        this.crowdWristbandMesh.setColorAt(i, this._colorB);
        instanceColorDirty = true;
      }

      const isMoshRunner = eventRole === 1;
      const isFighterA = eventRole === 2;
      const isFighterB = eventRole === 3;
      const isBrawlSpectator = eventRole === 4;
      const isSurferCarrier = eventRole === 5;
      const isWallRunner = eventRole === 7;
      const isThrower = i === this.crowdThrowerIdx && this.crowdThrowWindup > 0;

      const cosF = Math.cos(fanFacingY);
      const sinF = Math.sin(fanFacingY);

      // Sync staggered crowd bounce, fist pumps, claps, rock horns & glowstick waves to live 192 PPQ beatPhase
      const wavePhase = isBalladSway
        ? beatRad * 0.5 - s.waveDelay * 0.35
        : beatRad - s.waveDelay * 2.2;
      const bounceWave = isBalladSway
        ? 0
        : Math.pow(Math.abs(Math.sin(wavePhase * (poseVariant === 3 ? 1.0 : 0.5) + fanPhase * 0.34)), 1.35);
      const stadiumWaveBump =
        evType === 'STADIUM_WAVE' || evType === 'HEART_WAVE'
          ? Math.exp(-Math.pow((s.x - waveFrontX) / 2.25, 2)) * 0.58 * scH
          : 0;
      const canNormalJump = isPeakJumpMoment ? (i % 10) < jumpPctThreshold : poseVariant === 3 && (i % 6 === 0);
      const jumpY =
        isFighterA || isFighterB
          ? Math.abs(Math.sin(t * 11)) * 0.14 * scH
          : isMoshRunner || isWallRunner
            ? Math.abs(Math.sin(beatRad * 2 + fanPhase)) * 0.28 * scH
            : isBrawlSpectator
              ? Math.abs(Math.sin(t * 9.5 + fanPhase)) * 0.16 * scH
              : isBalladSway
                ? 0
                : (canNormalJump ? bounceWave * (0.09 + energy * 0.34) * scH : Math.abs(Math.sin(beatRad + fanPhase)) * 0.04 * energy * scH) + stadiumWaveBump;
      const baseY = s.floorY + Math.max(0, jumpY);

      // 1. Legs / Pants (planted firmly on baseY)
      this._dummy.position.set(fanX, baseY + 0.36 * scH, fanZ);
      this._dummy.rotation.set(0, fanFacingY, 0);
      this._dummy.scale.set(scW, scH, scW);
      this._dummy.updateMatrix();
      this.crowdLegsMesh.setMatrixAt(i, this._dummy.matrix);

      // 2. Waist / Belt detail
      const torsoLean = isFighterA || isFighterB
        ? 0.32 + Math.sin(t * 16 + (isFighterA ? 0 : Math.PI)) * 0.16
        : isMoshRunner || isWallRunner
          ? 0.22
          : isThrower
            ? -0.25 + (1 - this.crowdThrowWindup / 0.42) * 0.48
            : isBalladSway
              ? 0.04
              : Math.sin(wavePhase + fanPhase * 0.42) * (poseVariant === 1 ? 0.12 : 0.08) * energy;
      this._dummy.position.set(fanX, baseY + 0.78 * scH, fanZ);
      this._dummy.rotation.set(torsoLean * 0.5, fanFacingY, 0);
      this._dummy.scale.set(scW, scH, scW);
      this._dummy.updateMatrix();
      this.crowdBeltMesh.setMatrixAt(i, this._dummy.matrix);

      // 3. Upper R15 Torso + Hoodie Collar Accent
      const hugOffset = eventRole === 6 ? (i % 2 === 0 ? 0.12 : -0.12) : 0;
      const swayZ = isBalladSway
        ? Math.sin(beatRad * 0.5 + fanPhase * 0.15) * 0.18 + hugOffset
        : Math.sin(beatRad * 0.5 + fanPhase * 0.52) * (poseVariant === 1 ? 0.12 : 0.08) * (0.65 + energy * 0.45);
      this._dummy.position.set(fanX, baseY + 1.15 * scH, fanZ);
      this._dummy.rotation.set(torsoLean, fanFacingY, swayZ);
      this._dummy.scale.set(scW, scH, scW);
      this._dummy.updateMatrix();
      this.crowdTorsoMesh.setMatrixAt(i, this._dummy.matrix);

      if (s.hasHoodie) {
        this._dummy.position.set(fanX, baseY + 1.44 * scH, fanZ);
        this._dummy.rotation.set(torsoLean, fanFacingY, swayZ);
        this._dummy.scale.set(scW, scH, scW);
      } else {
        this._dummy.position.set(0, -40, 0);
        this._dummy.scale.set(0, 0, 0);
      }
      this._dummy.updateMatrix();
      this.crowdCollarMesh.setMatrixAt(i, this._dummy.matrix);

      // 3B. Optional Streetwear Backpack
      if (s.hasBackpack) {
        this._dummy.position.set(fanX - sinF * 0.24 * scW, baseY + 1.12 * scH, fanZ - cosF * 0.24 * scW);
        this._dummy.rotation.set(torsoLean, fanFacingY, swayZ);
        this._dummy.scale.set(scW, scH, scW);
      } else {
        this._dummy.position.set(0, -40, 0);
        this._dummy.scale.set(0, 0, 0);
      }
      this._dummy.updateMatrix();
      this.crowdBackpackMesh.setMatrixAt(i, this._dummy.matrix);

      // 4. Rounded Roblox R15 Head with Face Decal
      const headX = fanX;
      const headY = baseY + 1.72 * scH;
      const headZ = fanZ;
      const headPitch = isBalladSway
        ? -0.05 + Math.sin(beatRad * 0.5) * 0.05
        : -0.07 + Math.sin(beatRad + fanPhase * 0.6) * (0.1 + energy * 0.12);
      const headYaw = isBalladSway ? 0 : Math.sin(t * 1.4 + fanPhase) * 0.14;
      this._dummy.position.set(headX, headY, headZ);
      this._dummy.rotation.set(headPitch, fanFacingY + headYaw, swayZ * 0.85);
      this._dummy.scale.set(scHead, scHead, scHead);
      this._dummy.updateMatrix();
      this.crowdHeadMesh.setMatrixAt(i, this._dummy.matrix);

      // 5. Distinct Headwear (Spiky Hair / Baseball Cap / Headphones) locked to head transform!
      const style = this.crowdRole[i];
      if (style === 0 || style === 2) {
        this.crowdHairMesh.setMatrixAt(hairSlot, this._dummy.matrix);
        hairSlot += 1;
      } else if (style === 1 || style === 4) {
        this.crowdCapMesh.setMatrixAt(capSlot, this._dummy.matrix);
        capSlot += 1;
      } else {
        this.crowdHpMesh.setMatrixAt(hpSlot, this._dummy.matrix);
        hpSlot += 1;
      }

      // 6. Shoulder-Jointed Upper Arms + Elbow-Jointed Forearms across 4 varied pose states
      const armOffset = 0.45 * scW;
      const shoulderY = baseY + 1.4 * scH;
      const upperLen = 0.34 * scH;
      const foreLen = 0.34 * scH;

      const clapFan = !isBalladSway && (poseVariant === 0 || (!s.hasStick && i % 3 === 0));
      const clapPulse = clapFan ? Math.pow(Math.max(0, Math.sin(beatRad + fanPhase * 0.15)), 3.2) * 0.5 : 0;

      const heartSwirl = isHeartSwirl ? Math.sin(beatRad * 0.5 + (i % 2 === 0 ? 0 : Math.PI * 0.5)) * 0.32 : 0;
      let waveL;
      let waveR;
      let armFrontTiltL = 0.16;
      let armFrontTiltR = 0.18;

      if (isBalladSway) {
        waveL = Math.sin(beatRad * 0.5 + fanPhase * 0.15) * 0.44;
        waveR = Math.sin(beatRad * 0.5 + fanPhase * 0.15) * 0.48;
      } else if (poseVariant === 0 && !s.hasStick) {
        // Variant 0: Enthusiastic chest-level clap or alternating single-arm fist-pump
        if (i % 2 === 0) {
          waveL = -0.34 - clapPulse;
          waveR = 0.34 + clapPulse;
          armFrontTiltL = 0.42;
          armFrontTiltR = 0.42;
        } else {
          waveL = -0.18 + Math.sin(beatRad + fanPhase) * 0.14;
          waveR = 0.18 + Math.sin(wavePhase + fanPhase) * (0.28 + energy * 0.4);
          armFrontTiltL = -0.45;
          armFrontTiltR = 0.28 + Math.abs(Math.sin(beatRad + fanPhase)) * 0.45;
        }
      } else if (poseVariant === 1) {
        // Variant 1: Dual-arm V-shaped rock sway / devil-horns energy
        const rockSway = Math.sin(wavePhase * 0.5 + fanPhase * 0.4) * (0.28 + energy * 0.25);
        waveL = -0.36 + rockSway + heartSwirl * 0.5;
        waveR = 0.36 + rockSway - heartSwirl * 0.5;
        armFrontTiltL = 0.22;
        armFrontTiltR = 0.22;
      } else if (poseVariant === 2) {
        // Variant 2: Focused lightstick / smartphone wave aloft while left arm grooving
        waveL = -0.16 + Math.sin(wavePhase + fanPhase) * 0.22;
        waveR = Math.sin(wavePhase * 0.5 + fanPhase * 0.3) * (0.42 + energy * 0.35) - heartSwirl;
        armFrontTiltL = -0.3;
        armFrontTiltR = 0.26;
      } else {
        // Variant 3: Staggered hype pump & double-time groove
        waveL = Math.sin(wavePhase + fanPhase * 0.25) * (0.32 + energy * 0.42) + heartSwirl;
        waveR = Math.sin(wavePhase + fanPhase * 0.25 + (isChorusUnison ? 0 : 0.55)) * (0.38 + energy * 0.48) - heartSwirl;
      }

      if (isFighterA || isFighterB) {
        const swing = Math.sin(t * 17 + (isFighterA ? 0 : Math.PI));
        waveL = -0.35 + swing * 0.58;
        waveR = 0.35 - swing * 0.58;
        armFrontTiltL = 1.1 + swing * 0.52;
        armFrontTiltR = 1.1 - swing * 0.52;
      } else if (isHeartHands) {
        // Overhead Heart Arch hands raised toward band!
        waveL = -0.62;
        waveR = 0.62;
        armFrontTiltL = -0.18;
        armFrontTiltR = -0.18;
      } else if (isThrower) {
        const throwP = 1 - Math.max(0, Math.min(1, this.crowdThrowWindup / 0.42));
        armFrontTiltR = throwP < 0.45 ? -1.15 : THREE.MathUtils.lerp(-1.15, 1.45, (throwP - 0.45) / 0.55);
        waveR = -0.2;
      } else if (isSurferCarrier) {
        waveL = -0.15;
        waveR = 0.15;
        armFrontTiltL = 0.08;
        armFrontTiltR = 0.08;
      } else if (evType === 'STADIUM_WAVE' || evType === 'HEART_WAVE') {
        const boost = stadiumWaveBump * 1.4;
        waveL = -0.32 - boost;
        waveR = 0.32 + boost;
      } else if (isBrawlSpectator) {
        armFrontTiltR = 0.68;
        waveL = Math.sin(t * 10 + fanPhase) * 0.45;
        waveR = 0.12;
      }

      // Left Upper Arm
      const lx = fanX - cosF * armOffset;
      const lz = fanZ + sinF * armOffset;
      const lTiltZ = 0.24 + waveL;
      this._dummy.position.set(lx, shoulderY, lz);
      this._dummy.rotation.set(armFrontTiltL, fanFacingY, lTiltZ);
      this._dummy.scale.set(scW, scH, scW);
      this._dummy.updateMatrix();
      this.crowdUpperArmLMesh.setMatrixAt(i, this._dummy.matrix);

      // Left Elbow -> Forearm
      const lElbowX = lx - Math.sin(lTiltZ) * upperLen * cosF;
      const lElbowZ = lz + Math.sin(lTiltZ) * upperLen * sinF;
      const lElbowY = shoulderY + Math.cos(lTiltZ) * upperLen;
      const lForeTiltZ = isHeartHands
        ? 0.52
        : lTiltZ * 0.85 - 0.14 + Math.cos(wavePhase * 1.2 + fanPhase) * (isBalladSway ? 0.06 : 0.18);
      this._dummy.position.set(lElbowX, lElbowY, lElbowZ);
      this._dummy.rotation.set(armFrontTiltL + 0.08, fanFacingY, lForeTiltZ);
      this._dummy.scale.set(scW, scH, scW);
      this._dummy.updateMatrix();
      this.crowdForearmLMesh.setMatrixAt(i, this._dummy.matrix);

      // Right Upper Arm
      const rx = fanX + cosF * armOffset;
      const rz = fanZ - sinF * armOffset;
      const rTiltZ = -0.24 + waveR;
      this._dummy.position.set(rx, shoulderY, rz);
      this._dummy.rotation.set(armFrontTiltR, fanFacingY, rTiltZ);
      this._dummy.scale.set(scW, scH, scW);
      this._dummy.updateMatrix();
      this.crowdUpperArmRMesh.setMatrixAt(i, this._dummy.matrix);

      // Right Elbow -> Forearm
      const rElbowX = rx - Math.sin(rTiltZ) * upperLen * cosF;
      const rElbowZ = rz + Math.sin(rTiltZ) * upperLen * sinF;
      const rElbowY = shoulderY + Math.cos(rTiltZ) * upperLen;
      const rForeTiltZ = isHeartHands
        ? -0.52
        : rTiltZ * 0.85 + 0.16 + Math.sin(wavePhase * 1.2 + fanPhase) * (isBalladSway ? 0.06 : 0.2);
      this._dummy.position.set(rElbowX, rElbowY, rElbowZ);
      this._dummy.rotation.set(armFrontTiltR + 0.08, fanFacingY, rForeTiltZ);
      this._dummy.scale.set(scW, scH, scW);
      this._dummy.updateMatrix();
      this.crowdForearmRMesh.setMatrixAt(i, this._dummy.matrix);

      // Glowing Concert Wristband aligned to right forearm
      const tipX = rElbowX - Math.sin(rForeTiltZ) * foreLen * cosF;
      const tipZ = rElbowZ + Math.sin(rForeTiltZ) * foreLen * sinF;
      const tipY = rElbowY + Math.cos(rForeTiltZ) * foreLen;
      this._dummy.position.set(tipX, tipY - 0.06 * scH, tipZ);
      this._dummy.rotation.set(armFrontTiltR + 0.08, fanFacingY, rForeTiltZ);
      this._dummy.scale.set(scW, scH, scW);
      this._dummy.updateMatrix();
      this.crowdWristbandMesh.setMatrixAt(i, this._dummy.matrix);

      // 7. Glowing Smartphone Flashlights (on BALLAD_EMOTIONAL / PHONE_LIGHTS / CRYING_SWAY / Brawl filming), Foam Fingers, or Neon Glowsticks
      const showPhone =
        (isPhoneLightsEvent && !isFighterA && !isFighterB && (s.hasPhone || i % 3 !== 0)) ||
        ((isBalladMode || isBrawlSpectator || (poseVariant === 2 && !s.hasStick)) && s.hasPhone && !isFighterA && !isFighterB);
      if (showPhone) {
        this._dummy.position.set(tipX, tipY, tipZ);
        this._dummy.rotation.set(0.12, fanFacingY, rForeTiltZ * 0.9);
        this._dummy.scale.set(scHead, scHead, scHead);
        this._dummy.updateMatrix();
        this.crowdPhoneMesh.setMatrixAt(i, this._dummy.matrix);

        this._dummy.position.set(0, -40, 0);
        this._dummy.scale.set(0, 0, 0);
        this._dummy.updateMatrix();
        this.lightstickMesh.setMatrixAt(i, this._dummy.matrix);
        this.crowdFoamFingerMesh.setMatrixAt(i, this._dummy.matrix);
      } else if (s.hasFoamFinger && !isFighterA && !isFighterB && !isSurferCarrier && !isHeartHands) {
        this._dummy.position.set(tipX, tipY, tipZ);
        this._dummy.rotation.set(0.08, fanFacingY, rForeTiltZ * 0.95);
        this._dummy.scale.set(scHead, scHead, scHead);
        this._dummy.updateMatrix();
        this.crowdFoamFingerMesh.setMatrixAt(i, this._dummy.matrix);

        this._dummy.position.set(0, -40, 0);
        this._dummy.scale.set(0, 0, 0);
        this._dummy.updateMatrix();
        this.lightstickMesh.setMatrixAt(i, this._dummy.matrix);
        this.crowdPhoneMesh.setMatrixAt(i, this._dummy.matrix);
      } else if (s.hasStick && !isFighterA && !isFighterB && !isSurferCarrier && !isHeartHands) {
        this._dummy.position.set(tipX, tipY, tipZ);
        this._dummy.rotation.set(0.18, fanFacingY, rForeTiltZ * 1.18);
        this._dummy.scale.set(scHead, scHead * (0.95 + bassE * 0.35 + (isChorusUnison ? 0.18 : 0)), scHead);
        this._dummy.updateMatrix();
        this.lightstickMesh.setMatrixAt(i, this._dummy.matrix);

        this._dummy.position.set(0, -40, 0);
        this._dummy.scale.set(0, 0, 0);
        this._dummy.updateMatrix();
        this.crowdPhoneMesh.setMatrixAt(i, this._dummy.matrix);
        this.crowdFoamFingerMesh.setMatrixAt(i, this._dummy.matrix);
      } else {
        this._dummy.position.set(0, -40, 0);
        this._dummy.scale.set(0, 0, 0);
        this._dummy.updateMatrix();
        this.lightstickMesh.setMatrixAt(i, this._dummy.matrix);
        this.crowdPhoneMesh.setMatrixAt(i, this._dummy.matrix);
        this.crowdFoamFingerMesh.setMatrixAt(i, this._dummy.matrix);
      }
    }

    // 8. Animated Blue Teardrop Particle Pool for Crying Ballad Sway
    if (this.crowdTearPoints) {
      const tearsActive = evType === 'CRYING_SWAY' || evType === 'BALLAD_TEARS' || isBalladMode;
      const posAttr = this.crowdTearPoints.geometry.attributes.position;
      const posArr = posAttr.array;

      if (tearsActive) {
        this.crowdTearPoints.visible = true;
        this.crowdTearSpawnTimer += dt;
        while (this.crowdTearSpawnTimer >= 0.045) {
          this.crowdTearSpawnTimer -= 0.045;
          const fanIdx = Math.floor(this.nextCrowdRand() * Math.min(64, this.crowdCount));
          const fs = this.crowdSeeds[fanIdx];
          if (fs) {
            const side = this.nextCrowdRand() < 0.5 ? -0.09 : 0.09;
            const cosF = Math.cos(fs.facingY);
            const sinF = Math.sin(fs.facingY);
            const tp = this.crowdTearParticles[this.crowdTearCursor];
            this.crowdTearCursor = (this.crowdTearCursor + 1) % this.crowdTearCount;
            tp.active = true;
            tp.x = fs.x + sinF * 0.24 * fs.scale + cosF * side * fs.scale;
            tp.y = fs.floorY + 1.68 * fs.scale;
            tp.z = fs.z + cosF * 0.24 * fs.scale - sinF * side * fs.scale;
            tp.vx = sinF * 0.35 + (this.nextCrowdRand() - 0.5) * 0.16;
            tp.vy = -1.45 - this.nextCrowdRand() * 0.55;
            tp.vz = cosF * 0.35 + (this.nextCrowdRand() - 0.5) * 0.16;
            tp.life = 0;
            tp.maxLife = 0.52 + this.nextCrowdRand() * 0.25;
          }
        }
      }

      let anyTearUpdated = false;
      for (let k = 0; k < this.crowdTearCount; k += 1) {
        const tp = this.crowdTearParticles[k];
        if (!tp.active) continue;
        tp.life += dt;
        if (tp.life >= tp.maxLife || !tearsActive) {
          tp.active = false;
          posArr[k * 3 + 1] = -60;
          anyTearUpdated = true;
          continue;
        }
        tp.vy -= 2.2 * dt;
        tp.x += tp.vx * dt;
        tp.y += tp.vy * dt;
        tp.z += tp.vz * dt;
        posArr[k * 3] = tp.x;
        posArr[k * 3 + 1] = tp.y;
        posArr[k * 3 + 2] = tp.z;
        anyTearUpdated = true;
      }

      if (!tearsActive && !anyTearUpdated) {
        this.crowdTearPoints.visible = false;
      }
      if (anyTearUpdated) {
        posAttr.needsUpdate = true;
      }
    }

    // 8B. Animate 1,460 Packed General Admission Standing Arena Floor Fans (x: [-28, 28], z: [6.0, 42.0])
    //     Reacts dynamically to ALL 6 pit events (Moshpit, Suntukan, Crying/Phone Sway, Crowd Surfing, Wall of Death, Stadium Wave)!
    if (this.floorCrowdCount > 0 && this.floorCrowdTorsoMesh) {
      this._floorCrowdFrameTick = (this._floorCrowdFrameTick + 1) % 2;
      const shouldUpdateFloor = !this.adaptiveLowPower || this._floorCrowdFrameTick === 0 || dt === 0;
      if (shouldUpdateFloor) {
        const gaWaveFrontX = evType === 'STADIUM_WAVE' || evType === 'HEART_WAVE' ? -28.0 + evProgress * 56.0 : -999;
        const updateGaLightsColor =
          this.floorCrowdColorState !== colorStateCode || colorStateCode === 2 || isPhoneLightsEvent;
        if (updateGaLightsColor) {
          this.floorCrowdColorState = colorStateCode;
        }

        const surferX = this.crowdSurferGroup?.visible ? this.crowdSurferGroup.position.x : 999;
        const surferZ = this.crowdSurferGroup?.visible ? this.crowdSurferGroup.position.z : 999;

        for (let i = 0; i < this.floorCrowdCount; i += 1) {
          const s = this.floorCrowdSeeds[i];
          const scH = s.heightScale;
          const scW = s.widthScale;
          const phase = s.phase;
          let fx = s.x;
          let fz = s.z;
          let fYaw = s.facingY;
          let extraPump = 0;
          let extraJump = 0;

          // Dynamic parting & surging for all 6 random pit events within the dense standing floor!
          if (evType === 'MOSHPIT' && fz >= 12.6 && fz <= 25.5 && Math.abs(fx - ev.centerX) < 7.2) {
            const dx = fx - ev.centerX;
            const dz = fz - ev.centerZ;
            const dist = Math.hypot(dx, dz);
            if (dist < 6.2) {
              const ang = Math.atan2(dz, dx) + t * 2.85;
              const pitR = Math.max(3.6, Math.min(6.0, dist + 1.4));
              fx = ev.centerX + Math.cos(ang) * pitR;
              fz = Math.max(12.65, ev.centerZ + Math.sin(ang) * pitR);
              fYaw = ang + Math.PI * 0.5;
              extraJump = Math.abs(Math.sin(beatRad * 2 + phase)) * 0.24 * scH;
              extraPump = 0.35;
            }
          } else if (isWallOfDeath && Math.abs(fx) < 7.4 && fz >= 12.7 && fz <= 26.5) {
            const side = fx >= 0 ? 1 : -1;
            if (evProgress < 0.45) {
              const splitEase = Math.min(1, evProgress / 0.25);
              fx = THREE.MathUtils.lerp(fx, side * (4.2 + Math.abs(fx) * 0.52), splitEase);
              fYaw = -side * Math.PI * 0.5;
            } else {
              const chargeT = Math.min(1, (evProgress - 0.45) / 0.35);
              fx = THREE.MathUtils.lerp(side * (4.4 + Math.abs(s.x) * 0.3), side * (0.55 + (i % 5) * 0.32), chargeT);
              fYaw = -side * Math.PI * 0.5;
              extraJump = Math.abs(Math.sin(beatRad * 2 + phase)) * 0.26 * scH;
              extraPump = 0.42;
            }
          } else if (evType === 'SUNTUKAN') {
            const dx = ev.centerX - fx;
            const dz = ev.centerZ - fz;
            const dist = Math.hypot(dx, dz);
            if (dist < 5.6 && fz >= 12.6) {
              if (dist < 2.2) {
                const push = (2.4 - dist) / Math.max(0.25, dist);
                fx -= dx * push * 0.7;
                fz = Math.max(12.7, fz - dz * push * 0.7);
              }
              fYaw = Math.atan2(dx, dz);
              extraJump = Math.abs(Math.sin(t * 9.0 + phase)) * 0.14 * scH;
              extraPump = 0.25;
            }
          } else if (evType === 'CROWD_SURFING' || evType === 'CROWD_SURF') {
            const dx = fx - surferX;
            const dz = fz - surferZ;
            if (dx * dx + dz * dz < 8.5) {
              extraPump = 0.55;
            }
          }

          const waveBump =
            evType === 'STADIUM_WAVE' || evType === 'HEART_WAVE'
              ? Math.exp(-Math.pow((fx - gaWaveFrontX) / 3.4, 2)) * 0.62 * scH
              : 0;
          const fanWave = isBalladSway
            ? beatRad * 0.5 - s.waveDelay * 0.35
            : beatRad - s.waveDelay * 2.1;
          const jump = isBalladSway
            ? 0
            : (Math.pow(Math.abs(Math.sin(fanWave * 0.5 + phase * 0.4)), 1.6) * (0.06 + energy * 0.22) * scH) +
              waveBump +
              extraJump;
          const baseY = s.floorY + jump;
          const swayZ = isBalladSway
            ? Math.sin(beatRad * 0.5 + phase * 0.16) * 0.17
            : Math.sin(beatRad * 0.5 + phase * 0.5) * 0.08 * (0.6 + energy * 0.4);

          // 1. Legs
          this._dummy.position.set(fx, baseY + 0.37 * scH, fz);
          this._dummy.rotation.set(0, fYaw, 0);
          this._dummy.scale.set(scW, scH, scW);
          this._dummy.updateMatrix();
          this.floorCrowdLegsMesh.setMatrixAt(i, this._dummy.matrix);

          // 2. Merch Tee / Jacket Torso
          this._dummy.position.set(fx, baseY + 1.08 * scH, fz);
          this._dummy.rotation.set(isBalladSway ? 0.03 : 0.06 * energy, fYaw, swayZ);
          this._dummy.scale.set(scW, scH, scW);
          this._dummy.updateMatrix();
          this.floorCrowdTorsoMesh.setMatrixAt(i, this._dummy.matrix);

          // 3. Head + Hair/Cap Silhouette
          this._dummy.position.set(fx, baseY + 1.66 * scH, fz);
          this._dummy.rotation.set(
            isBalladSway ? -0.04 : Math.sin(beatRad + phase * 0.5) * 0.1 * energy,
            fYaw,
            swayZ * 0.85
          );
          this._dummy.scale.set(scW, scH, scW);
          this._dummy.updateMatrix();
          this.floorCrowdHeadMesh.setMatrixAt(i, this._dummy.matrix);

          // 4. Raised Hands / Devil-Horns Arms
          const armPump = isBalladSway
            ? Math.sin(beatRad * 0.5 + phase * 0.2) * 0.14
            : Math.sin(fanWave + phase * 0.35) * (0.18 + energy * 0.24) + waveBump * 0.9 + extraPump;
          this._dummy.position.set(fx, baseY + 1.38 * scH + Math.max(0, armPump * 0.14), fz);
          this._dummy.rotation.set(0.18 + armPump * 0.25, fYaw, swayZ * 1.45);
          this._dummy.scale.set(scW, scH * (0.94 + Math.max(0, armPump * 0.18)), scW);
          this._dummy.updateMatrix();
          this.floorCrowdArmsMesh.setMatrixAt(i, this._dummy.matrix);

          // 5. Glowing Lightstick / Smartphone Light held aloft
          const showLight = s.hasLight || isBalladMode || isPhoneLightsEvent || feverOrEncore || waveBump > 0.15;
          if (showLight) {
            const cosF = Math.cos(fYaw);
            const sinF = Math.sin(fYaw);
            const lx = fx + cosF * 0.52 * scW;
            const lz = fz - sinF * 0.52 * scW;
            const ly = baseY + (1.98 + Math.max(0, armPump * 0.18)) * scH;
            const phoneMode = isBalladMode || isPhoneLightsEvent || evType === 'CRYING_SWAY';
            this._dummy.position.set(lx, ly, lz);
            this._dummy.rotation.set(0.16, fYaw, swayZ * 1.8);
            this._dummy.scale.set(
              phoneMode ? scW * 1.65 : scW * 0.95,
              phoneMode ? scH * 0.42 : scH * (0.85 + bassE * 0.32 + (lightstickBoost - 1) * 0.2),
              phoneMode ? scW * 0.55 : scW * 0.95
            );
            this._dummy.updateMatrix();
            this.floorCrowdLightMesh.setMatrixAt(i, this._dummy.matrix);
          } else {
            this._dummy.position.set(0, -60, 0);
            this._dummy.scale.set(0, 0, 0);
            this._dummy.updateMatrix();
            this.floorCrowdLightMesh.setMatrixAt(i, this._dummy.matrix);
          }

          if (updateGaLightsColor) {
            if (isBalladMode || isPhoneLightsEvent || evType === 'CRYING_SWAY') {
              this._colorB.setHex(0xfef3c7);
            } else if (colorStateCode === 0) {
              this._colorB.setHex(s.stickHex).lerp(this._colorA, 0.28);
            } else if (colorStateCode === 2) {
              const fanHue = (t * 0.18 + (i % 16) * 0.0625) % 1;
              this._colorB.setHSL(fanHue, 0.92, 0.62);
            } else {
              this._colorB.copy(this._colorA);
            }
            this.floorCrowdLightMesh.setColorAt(i, this._colorB);
          }
        }

        this.floorCrowdLegsMesh.instanceMatrix.needsUpdate = true;
        this.floorCrowdTorsoMesh.instanceMatrix.needsUpdate = true;
        this.floorCrowdHeadMesh.instanceMatrix.needsUpdate = true;
        this.floorCrowdArmsMesh.instanceMatrix.needsUpdate = true;
        this.floorCrowdLightMesh.instanceMatrix.needsUpdate = true;
        if (updateGaLightsColor && this.floorCrowdLightMesh.instanceColor) {
          this.floorCrowdLightMesh.instanceColor.needsUpdate = true;
        }
      }
    }

    this.crowdLegsMesh.instanceMatrix.needsUpdate = true;
    this.crowdBeltMesh.instanceMatrix.needsUpdate = true;
    this.crowdTorsoMesh.instanceMatrix.needsUpdate = true;
    this.crowdBodyMesh.instanceMatrix.needsUpdate = true;
    this.crowdCollarMesh.instanceMatrix.needsUpdate = true;
    this.crowdHeadMesh.instanceMatrix.needsUpdate = true;
    this.crowdHairMesh.instanceMatrix.needsUpdate = true;
    this.crowdCapMesh.instanceMatrix.needsUpdate = true;
    this.crowdHpMesh.instanceMatrix.needsUpdate = true;
    this.crowdBackpackMesh.instanceMatrix.needsUpdate = true;
    this.crowdUpperArmLMesh.instanceMatrix.needsUpdate = true;
    this.crowdUpperArmRMesh.instanceMatrix.needsUpdate = true;
    this.crowdForearmLMesh.instanceMatrix.needsUpdate = true;
    this.crowdForearmRMesh.instanceMatrix.needsUpdate = true;
    this.crowdWristbandMesh.instanceMatrix.needsUpdate = true;
    this.crowdFoamFingerMesh.instanceMatrix.needsUpdate = true;
    this.lightstickMesh.instanceMatrix.needsUpdate = true;
    this.glowstickMesh.instanceMatrix.needsUpdate = true;
    this.crowdPhoneMesh.instanceMatrix.needsUpdate = true;
    if (instanceColorDirty && this.lightstickMesh.instanceColor) {
      this.lightstickMesh.instanceColor.needsUpdate = true;
    }
    if (instanceColorDirty && this.crowdWristbandMesh.instanceColor) {
      this.crowdWristbandMesh.instanceColor.needsUpdate = true;
    }
    if (this.crowdPhoneMesh.instanceColor && (isBalladMode || isPhoneLightsEvent)) {
      this.crowdPhoneMesh.instanceColor.needsUpdate = true;
    }
  }

  buildPyrotechnicsAndFX() {
    // 1. Tier-1 Stage-Lip & Catwalk/B-Stage Perimeter V-Angled Gold/Crimson Flame Columns (y: 1.5m–9m)
    this.pyroNozzleXs = [-12.4, -8.8, -5.6, -2.5, 2.5, 5.6, 8.8, 12.4];
    this.catwalkSparkNozzles = [
      { x: -1.72, z: 6.5, tiltX: -0.18 },
      { x: 1.72, z: 6.5, tiltX: 0.18 },
      { x: -1.72, z: 8.8, tiltX: -0.2 },
      { x: 1.72, z: 8.8, tiltX: 0.2 },
      { x: -2.85, z: 11.2, tiltX: -0.24 },
      { x: 2.85, z: 11.2, tiltX: 0.24 },
      { x: -2.25, z: 13.1, tiltX: -0.2 },
      { x: 2.25, z: 13.1, tiltX: 0.2 },
    ];
    this.flamePillars = [];

    const outerConeGeo = new THREE.ConeGeometry(0.62, 6.2, 10, 1, true);
    outerConeGeo.translate(0, 3.1, 0);
    const innerConeGeo = new THREE.ConeGeometry(0.32, 4.4, 8, 1, true);
    innerConeGeo.translate(0, 2.2, 0);

    const outerFlameMat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const innerFlameMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.outerFlameMat = outerFlameMat;
    this.innerFlameMat = innerFlameMat;

    const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.8 });
    const nozzleGeo = new THREE.CylinderGeometry(0.14, 0.18, 0.16, 8);

    const flamePods = [
      ...this.pyroNozzleXs.map((nx, idx) => ({
        x: nx,
        z: 5.18,
        vTilt: (idx % 2 === 0 ? 1 : -1) * 0.24 + (nx < 0 ? 0.08 : -0.08),
        xTilt: 0.08,
        heightMult: 1.15,
      })),
      // Catwalk & B-Stage perimeter V-angled flame pods angled safely outward away from performers
      { x: -1.82, z: 7.4, vTilt: 0.32, xTilt: 0.06, heightMult: 0.92 },
      { x: 1.82, z: 7.4, vTilt: -0.32, xTilt: 0.06, heightMult: 0.92 },
      { x: -2.92, z: 11.4, vTilt: 0.36, xTilt: 0.14, heightMult: 1.02 },
      { x: 2.92, z: 11.4, vTilt: -0.36, xTilt: 0.14, heightMult: 1.02 },
    ];

    flamePods.forEach((pod, idx) => {
      const nozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
      nozzle.position.set(pod.x, 0.08, pod.z);
      nozzle.rotation.z = pod.vTilt;
      this.scene.add(nozzle);

      const pillar = new THREE.Group();
      pillar.position.set(pod.x, 0.12, pod.z);
      pillar.rotation.z = pod.vTilt;
      pillar.rotation.x = pod.xTilt;
      const outer = new THREE.Mesh(outerConeGeo, outerFlameMat);
      const inner = new THREE.Mesh(innerConeGeo, innerFlameMat);
      pillar.add(outer, inner);
      pillar.visible = false;
      this.scene.add(pillar);
      this.flamePillars.push({
        group: pillar,
        outer,
        inner,
        vTilt: pod.vTilt,
        xTilt: pod.xTilt,
        heightMult: pod.heightMult,
        phase: idx * 1.13,
      });
    });

    this.pyroGlowLight = new THREE.PointLight(0xfb923c, 0, 42, 1.25);
    this.pyroGlowLight.position.set(0, 3.2, 6.2);
    this.scene.add(this.pyroGlowLight);

    // 1B. Stage-Edge CO2 Cryo-Jets (6 vertical frosty white mist columns across expanded 32m lip)
    this.cryoJets = [];
    this.cryoJetIntensity = 0;
    const cryoConeGeo = new THREE.ConeGeometry(0.64, 5.4, 14, 1, true);
    cryoConeGeo.translate(0, 2.7, 0);
    this.cryoJetMat = createVolumetricSpotlightMaterial(0xe0f2fe, 0);
    [-11.0, -7.2, -3.2, 3.2, 7.2, 11.0].forEach((cx, idx) => {
      const jet = new THREE.Mesh(cryoConeGeo, this.cryoJetMat);
      jet.position.set(cx, 0.08, 5.22);
      jet.rotation.x = 0.08;
      jet.visible = false;
      this.scene.add(jet);
      this.cryoJets.push({ mesh: jet, phase: idx * 1.4 });
    });

    // 1C. Drifting Atmospheric Concert Haze Particles suspended in the spotlight air
    this.hazeCount = 96;
    this.hazePositions = new Float32Array(this.hazeCount * 3);
    this.hazeSeeds = [];
    for (let i = 0; i < this.hazeCount; i += 1) {
      const hx = (Math.random() - 0.5) * 20;
      const hy = 0.8 + Math.random() * 7.6;
      const hz = -6.5 + Math.random() * 14;
      this.hazePositions[i * 3] = hx;
      this.hazePositions[i * 3 + 1] = hy;
      this.hazePositions[i * 3 + 2] = hz;
      this.hazeSeeds.push({ baseX: hx, baseY: hy, baseZ: hz, speed: 0.25 + Math.random() * 0.45, phase: Math.random() * Math.PI * 2 });
    }
    const hazeGeo = new THREE.BufferGeometry();
    hazeGeo.setAttribute('position', new THREE.BufferAttribute(this.hazePositions, 3));
    const hazeMat = new THREE.PointsMaterial({
      size: 1.55,
      map: this.glowTex,
      color: 0x94a3b8,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.hazePoints = new THREE.Points(hazeGeo, hazeMat);
    this.scene.add(this.hazePoints);

    // 1D. Ballad Atmospheric Golden & Indigo Light Motes (fade in during BALLAD_EMOTIONAL)
    this.balladDustCount = 90;
    this.balladDustPositions = new Float32Array(this.balladDustCount * 3);
    const balladDustColors = new Float32Array(this.balladDustCount * 3);
    this.balladDustSeeds = [];
    for (let i = 0; i < this.balladDustCount; i += 1) {
      const bx = (Math.random() - 0.5) * 18;
      const by = 0.4 + Math.random() * 6.8;
      const bz = -5.5 + Math.random() * 14;
      this.balladDustPositions[i * 3] = bx;
      this.balladDustPositions[i * 3 + 1] = by;
      this.balladDustPositions[i * 3 + 2] = bz;
      const isWarm = i % 3 !== 0;
      this._colorA.setHex(isWarm ? 0xfef08a : 0x818cf8);
      balladDustColors[i * 3] = this._colorA.r;
      balladDustColors[i * 3 + 1] = this._colorA.g;
      balladDustColors[i * 3 + 2] = this._colorA.b;
      this.balladDustSeeds.push({
        baseX: bx,
        baseY: by,
        baseZ: bz,
        speed: 0.28 + Math.random() * 0.35,
        phase: Math.random() * Math.PI * 2,
      });
    }
    const balladDustGeo = new THREE.BufferGeometry();
    balladDustGeo.setAttribute('position', new THREE.BufferAttribute(this.balladDustPositions, 3));
    balladDustGeo.setAttribute('color', new THREE.BufferAttribute(balladDustColors, 3));
    this.balladDustMat = new THREE.PointsMaterial({
      size: 0.42,
      map: this.glowTex,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.balladDustPoints = new THREE.Points(balladDustGeo, this.balladDustMat);
    this.balladDustPoints.visible = false;
    this.scene.add(this.balladDustPoints);

    // 2. 3D Golden Spark Fountains (Points, 180 particles)
    // Procedural CanvasTextures for crisp velocity-stretched streaks, 4-pt star cores & volumetric smoke clouds
    this.fwStreakTex = createFireworkStreakTexture();
    this.fwStarTex = createFireworkStarCoreTexture();
    this.fwSmokeTex = createFireworkSmokeTexture();

    const unitQuad = new THREE.PlaneGeometry(1, 1);
    const initAspect = this.camera?.aspect || 16 / 9;
    const initProjScale = 1 / Math.tan(THREE.MathUtils.degToRad((this.camera?.fov || 46) * 0.5));

    // Shared velocity-aligned additive billboard ShaderMaterial (ACESFilmic HDR core bloom, zero depthWrite)
    this.fwStreakUniforms = {
      uStreakTex: { value: this.fwStreakTex },
      uStarTex: { value: this.fwStarTex },
      uAspect: { value: initAspect },
      uProjScale: { value: initProjScale },
    };
    const fwStreakMat = new THREE.ShaderMaterial({
      uniforms: this.fwStreakUniforms,
      vertexShader: FW_STREAK_VERTEX_SHADER,
      fragmentShader: FW_STREAK_FRAGMENT_SHADER,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    // 2. Towering 8.5m Stage-Lip & Catwalk/B-Stage Cold-Spark Gerb Fountains (480 titanium sparks, single draw call)
    this.sparkCount = 480;
    this.sparkPositions = new Float32Array(this.sparkCount * 3);
    this.sparkVelocities = new Float32Array(this.sparkCount * 3);
    this.sparkColors = new Float32Array(this.sparkCount * 3);
    this.sparkMeta = new Float32Array(this.sparkCount * 4);
    this.sparks = Array.from({ length: this.sparkCount }, () => ({
      active: false,
      x: 0,
      y: -50,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      r: 1.0,
      g: 0.92,
      b: 0.72,
      size: 0.52,
      life: 0,
      maxLife: 1.15,
    }));
    for (let i = 0; i < this.sparkCount; i += 1) {
      this.sparkPositions[i * 3 + 1] = -50;
      this.sparkMeta[i * 4 + 1] = 0;
    }
    this.sparkCursor = 0;

    const sparkGeo = new THREE.InstancedBufferGeometry();
    sparkGeo.index = unitQuad.index;
    sparkGeo.setAttribute('position', unitQuad.attributes.position);
    sparkGeo.setAttribute('uv', unitQuad.attributes.uv);
    sparkGeo.instanceCount = this.sparkCount;
    const sparkPosAttr = new THREE.InstancedBufferAttribute(this.sparkPositions, 3);
    const sparkVelAttr = new THREE.InstancedBufferAttribute(this.sparkVelocities, 3);
    const sparkColAttr = new THREE.InstancedBufferAttribute(this.sparkColors, 3);
    const sparkMetaAttr = new THREE.InstancedBufferAttribute(this.sparkMeta, 4);
    sparkPosAttr.setUsage(THREE.DynamicDrawUsage);
    sparkVelAttr.setUsage(THREE.DynamicDrawUsage);
    sparkColAttr.setUsage(THREE.DynamicDrawUsage);
    sparkMetaAttr.setUsage(THREE.DynamicDrawUsage);
    sparkGeo.setAttribute('aPos', sparkPosAttr);
    sparkGeo.setAttribute('aVel', sparkVelAttr);
    sparkGeo.setAttribute('aColor', sparkColAttr);
    sparkGeo.setAttribute('aMeta', sparkMetaAttr);

    this.sparkPoints = new THREE.Mesh(sparkGeo, fwStreakMat);
    this.sparkPoints.frustumCulled = false;
    this.sparkPoints.renderOrder = 14;
    this.scene.add(this.sparkPoints);

    // 3. Engrande Olympic-Scale 4-Tier Pyromusical Aerial Fireworks Engine (6,400 velocity-stretched instanced particles)
    this.fwParticleCount = 6400;
    this.fwPositions = new Float32Array(this.fwParticleCount * 3);
    this.fwVelocities = new Float32Array(this.fwParticleCount * 3);
    this.fwColors = new Float32Array(this.fwParticleCount * 3);
    this.fwMeta = new Float32Array(this.fwParticleCount * 4);
    this.fwParticles = Array.from({ length: this.fwParticleCount }, () => ({
      active: false,
      x: 0,
      y: -80,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      r0: 1,
      g0: 0.98,
      b0: 0.92,
      r: 1,
      g: 0.9,
      b: 0.4,
      r2: 1,
      g2: 0.45,
      b2: 0.1,
      size: 1.0,
      stretch: 1.4,
      spriteMode: 0,
      hdrBoost: 1.35,
      isCore: false,
      drag: 0.24,
      gravity: 3.8,
      burstType: 'chrysanthemum',
      secondaryTimer: 0,
      trailTimer: 0,
      strobeTail: false,
      spinOmega: 0,
      spinRadius: 0,
      spinPhase: 0,
      subColorHex: 0xfacc15,
      life: 0,
      maxLife: 1.4,
    }));
    for (let i = 0; i < this.fwParticleCount; i += 1) {
      this.fwPositions[i * 3 + 1] = -80;
      this.fwMeta[i * 4 + 1] = 0;
    }
    this.fwCursor = 0;
    this.fwShells = [];
    this.fwGirandolas = [];
    this.fwRomanQueue = [];
    this._fwTypeCycleIndex = 0;
    this._fwRomanPatternIdx = 0;
    this._lastChorusDownbeatBar = -1;
    this._lastFwSubdiv8 = -1;
    this._lastFwSubdiv16 = -1;
    this._lastFwBeatIdx = -1;

    // 6 Pooled Dynamic Sky & Stadium-Bowl PointLights + Shared Smoke-Flash Uniform Buffers (zero per-frame GC)
    this.fwBurstLights = [];
    this.fwBurstLightCursor = 0;
    this.fwFlashUniformPos = [];
    this.fwFlashUniformCol = [];
    for (let l = 0; l < 6; l += 1) {
      const pl = new THREE.PointLight(0xfde047, 0, 240, 0.95);
      pl.position.set(0, 38, -22);
      this.scene.add(pl);
      this.fwBurstLights.push(pl);
      this.fwFlashUniformPos.push(new THREE.Vector3(0, -100, 0));
      this.fwFlashUniformCol.push(new THREE.Vector3(0, 0, 0));
    }
    this.fireworkFlashState = {
      color: new THREE.Color(0xfacc15),
      secondaryColor: new THREE.Color(0xec4899),
      intensity: 0,
      skyBloom: 0,
      subBassFlash: 0,
    };
    this._fwSubBassFlashDecay = 0;
    this._fwScratchVecA = new THREE.Vector3();
    this._fwScratchVecB = new THREE.Vector3();
    this._fwScratchVecC = new THREE.Vector3();
    this._fwFlashAggColor = new THREE.Color(0xfacc15);
    this._fwFlashSecondColor = new THREE.Color(0xec4899);

    const fwGeo = new THREE.InstancedBufferGeometry();
    fwGeo.index = unitQuad.index;
    fwGeo.setAttribute('position', unitQuad.attributes.position);
    fwGeo.setAttribute('uv', unitQuad.attributes.uv);
    fwGeo.instanceCount = this.fwParticleCount;
    const fwPosAttr = new THREE.InstancedBufferAttribute(this.fwPositions, 3);
    const fwVelAttr = new THREE.InstancedBufferAttribute(this.fwVelocities, 3);
    const fwColAttr = new THREE.InstancedBufferAttribute(this.fwColors, 3);
    const fwMetaAttr = new THREE.InstancedBufferAttribute(this.fwMeta, 4);
    fwPosAttr.setUsage(THREE.DynamicDrawUsage);
    fwVelAttr.setUsage(THREE.DynamicDrawUsage);
    fwColAttr.setUsage(THREE.DynamicDrawUsage);
    fwMetaAttr.setUsage(THREE.DynamicDrawUsage);
    fwGeo.setAttribute('aPos', fwPosAttr);
    fwGeo.setAttribute('aVel', fwVelAttr);
    fwGeo.setAttribute('aColor', fwColAttr);
    fwGeo.setAttribute('aMeta', fwMetaAttr);

    this.fwPoints = new THREE.Mesh(fwGeo, fwStreakMat);
    this.fwPoints.frustumCulled = false;
    this.fwPoints.renderOrder = 16;
    this.scene.add(this.fwPoints);

    // 3B. Illuminated Volumetric Apex Smoke Plumes (220 soft cloud puffs catching neighboring explosion colors)
    this.fwSmokeCount = 220;
    this.fwSmokePositions = new Float32Array(this.fwSmokeCount * 3);
    this.fwSmokeMeta = new Float32Array(this.fwSmokeCount * 4);
    this.fwSmokeParticles = Array.from({ length: this.fwSmokeCount }, () => ({
      active: false,
      x: 0,
      y: -90,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      size: 6.5,
      growRate: 2.2,
      rot: 0,
      vRot: 0,
      baseAlpha: 0.24,
      baseGrey: 0.85,
      life: 0,
      maxLife: 3.8,
    }));
    for (let i = 0; i < this.fwSmokeCount; i += 1) {
      this.fwSmokePositions[i * 3 + 1] = -90;
      this.fwSmokeMeta[i * 4 + 1] = 0;
    }
    this.fwSmokeCursor = 0;

    const fwSmokeGeo = new THREE.InstancedBufferGeometry();
    fwSmokeGeo.index = unitQuad.index;
    fwSmokeGeo.setAttribute('position', unitQuad.attributes.position);
    fwSmokeGeo.setAttribute('uv', unitQuad.attributes.uv);
    fwSmokeGeo.instanceCount = this.fwSmokeCount;
    const smokePosAttr = new THREE.InstancedBufferAttribute(this.fwSmokePositions, 3);
    const smokeMetaAttr = new THREE.InstancedBufferAttribute(this.fwSmokeMeta, 4);
    smokePosAttr.setUsage(THREE.DynamicDrawUsage);
    smokeMetaAttr.setUsage(THREE.DynamicDrawUsage);
    fwSmokeGeo.setAttribute('aPos', smokePosAttr);
    fwSmokeGeo.setAttribute('aMeta', smokeMetaAttr);

    this.fwSmokeUniforms = {
      uSmokeTex: { value: this.fwSmokeTex },
      uAspect: { value: initAspect },
      uProjScale: { value: initProjScale },
      uFlashPos: { value: this.fwFlashUniformPos },
      uFlashCol: { value: this.fwFlashUniformCol },
    };
    const fwSmokeMat = new THREE.ShaderMaterial({
      uniforms: this.fwSmokeUniforms,
      vertexShader: FW_SMOKE_VERTEX_SHADER,
      fragmentShader: FW_SMOKE_FRAGMENT_SHADER,
      transparent: true,
      blending: THREE.NormalBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.fwSmokePoints = new THREE.Mesh(fwSmokeGeo, fwSmokeMat);
    this.fwSmokePoints.frustumCulled = false;
    this.fwSmokePoints.renderOrder = 15;
    this.scene.add(this.fwSmokePoints);
    unitQuad.dispose();

    // 4. 3D Fluttering Confetti Cannons (InstancedMesh, 1,200 metallic paper cards)
    this.confettiCount = 1200;
    const confettiGeo = new THREE.PlaneGeometry(0.24, 0.13);
    const confettiMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.24,
      metalness: 0.78,
      emissive: 0x1e293b,
      emissiveIntensity: 0.25,
      side: THREE.DoubleSide,
    });
    this.confettiMesh = new THREE.InstancedMesh(confettiGeo, confettiMat, this.confettiCount);
    this.confettiMesh.frustumCulled = false;
    this.confettiItems = [];

    for (let i = 0; i < this.confettiCount; i += 1) {
      this.confettiItems.push({
        active: false,
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        rx: 0,
        ry: 0,
        rz: 0,
        vrx: 0,
        vry: 0,
        vrz: 0,
        life: 0,
        maxLife: 3.5,
        phase: i * 0.71,
      });
      this._colorA.setHex(CONFETTI_COLORS[i % CONFETTI_COLORS.length]);
      this.confettiMesh.setColorAt(i, this._colorA);
      this._dummy.position.set(0, -50, 0);
      this._dummy.scale.set(0, 0, 0);
      this._dummy.updateMatrix();
      this.confettiMesh.setMatrixAt(i, this._dummy.matrix);
    }
    this.confettiMesh.instanceMatrix.needsUpdate = true;
    if (this.confettiMesh.instanceColor) this.confettiMesh.instanceColor.needsUpdate = true;
    this.scene.add(this.confettiMesh);

    // 5. Multi-Beam 3D Concert Laser Sweeps (6 overhead beams fanning across crowd & stage)
    this.laserBeams = [];
    const laserGeo = new THREE.CylinderGeometry(0.035, 0.22, 28, 8, 1, true);
    laserGeo.translate(0, -14, 0);

    const laserXs = [-10.5, -6.2, -2.0, 2.0, 6.2, 10.5];
    laserXs.forEach((lx, idx) => {
      const pivot = new THREE.Group();
      pivot.position.set(lx, 14.4, -1.8);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const beam = new THREE.Mesh(laserGeo, mat);
      pivot.add(beam);
      this.scene.add(pivot);
      this.laserBeams.push({ pivot, mat, index: idx });
    });

    // 6. Pre-allocated 100x+ Streak Player Gold Aura (zero per-frame heap allocations!)
    const auraGroup = new THREE.Group();
    const auraRingGeo = new THREE.RingGeometry(0.66, 1.12, 28);
    auraRingGeo.rotateX(-Math.PI * 0.5);
    this.playerGoldAuraRingMat = new THREE.MeshBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const auraRing = new THREE.Mesh(auraRingGeo, this.playerGoldAuraRingMat);
    auraRing.position.y = 0.04;

    const auraBeamGeo = new THREE.CylinderGeometry(0.72, 1.02, 2.55, 24, 1, true);
    auraBeamGeo.translate(0, 1.28, 0);
    this.playerGoldAuraBeamMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const auraBeam = new THREE.Mesh(auraBeamGeo, this.playerGoldAuraBeamMat);
    auraGroup.add(auraRing, auraBeam);
    auraGroup.visible = false;
    this.playerGoldAura = auraGroup;
    this.scene.add(auraGroup);
  }

  /**
   * Pre-allocates 10 pooled theme-aware Angry Crowd Projectiles + 120 pooled stage splat particles
   * for zero per-frame allocations during gameplay.
   */
  buildCrowdProjectilePool() {
    this.projectilePool = [];
    const poolSize = 10;

    // Shared geometries & materials across pool (minimal draw calls & zero GC)
    const tomatoGeo = new THREE.SphereGeometry(0.16, 10, 8);
    const stemGeo = new THREE.ConeGeometry(0.05, 0.08, 5);
    const cupGeo = new THREE.CylinderGeometry(0.11, 0.075, 0.24, 10);
    const snowGeo = new THREE.IcosahedronGeometry(0.16, 1);
    const pumpkinGeo = new THREE.SphereGeometry(0.18, 10, 8);
    const fanGeo = new THREE.ConeGeometry(0.22, 0.24, 8);
    const ballGeo = new THREE.SphereGeometry(0.22, 12, 10);

    const tomatoMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.32, metalness: 0.05 });
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.65 });
    const cupMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.52, metalness: 0.08 });
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.45, emissive: 0x38bdf8, emissiveIntensity: 0.18 });
    const pumpkinMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.48, emissive: 0x7c2d12, emissiveIntensity: 0.2 });
    const sakuraMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.35, emissive: 0xbe185d, emissiveIntensity: 0.25 });
    const ballMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.25, emissive: 0xfacc15, emissiveIntensity: 0.22 });

    for (let i = 0; i < poolSize; i += 1) {
      const root = new THREE.Group();
      root.visible = false;

      // Variant 1: Tomato
      const tomatoGroup = new THREE.Group();
      const tBody = new THREE.Mesh(tomatoGeo, tomatoMat);
      tBody.scale.set(1.1, 0.88, 1.1);
      const tStem = new THREE.Mesh(stemGeo, stemMat);
      tStem.position.y = 0.15;
      tomatoGroup.add(tBody, tStem);

      // Variant 2: Crumpled Cup
      const cupMesh = new THREE.Mesh(cupGeo, cupMat);
      cupMesh.scale.set(1, 1, 0.72);

      // Variant 3: Snowball (Christmas Wonderland)
      const snowMesh = new THREE.Mesh(snowGeo, snowMat);

      // Variant 4: Mini Pumpkin (Halloween Cathedral)
      const pumpkinGroup = new THREE.Group();
      const pBody = new THREE.Mesh(pumpkinGeo, pumpkinMat);
      pBody.scale.set(1.15, 0.86, 1.15);
      const pStem = new THREE.Mesh(stemGeo, stemMat);
      pStem.position.y = 0.17;
      pumpkinGroup.add(pBody, pStem);

      // Variant 5: Sakura Fan (Sakura Festival)
      const fanMesh = new THREE.Mesh(fanGeo, sakuraMat);
      fanMesh.scale.set(1.2, 1.0, 0.24);

      // Variant 6: Beach Ball (Tropical Beach)
      const ballMesh = new THREE.Mesh(ballGeo, ballMat);

      const variants = {
        tomato: tomatoGroup,
        cup: cupMesh,
        snowball: snowMesh,
        pumpkin: pumpkinGroup,
        sakuraFan: fanMesh,
        beachBall: ballMesh,
      };
      Object.values(variants).forEach((v) => {
        v.visible = false;
        root.add(v);
      });

      this.scene.add(root);
      this.projectilePool.push({
        active: false,
        bouncing: false,
        root,
        variants,
        activeVariant: 'tomato',
        splatHex: 0xef4444,
        targetRole: 'guitar',
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        spinX: 0,
        spinY: 0,
        spinZ: 0,
        life: 0,
        maxLife: 1.8,
      });
    }

    // Pre-allocated 120-slot stage splat particle buffer
    this.splatCount = 120;
    const splatPos = new Float32Array(this.splatCount * 3);
    const splatCol = new Float32Array(this.splatCount * 3);
    this.splatParticles = [];
    for (let i = 0; i < this.splatCount; i += 1) {
      splatPos[i * 3 + 1] = -999;
      this.splatParticles.push({
        active: false,
        x: 0,
        y: -999,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        r: 1,
        g: 0.25,
        b: 0.25,
        life: 0,
        maxLife: 0.65,
      });
    }
    const splatGeo = new THREE.BufferGeometry();
    splatGeo.setAttribute('position', new THREE.BufferAttribute(splatPos, 3));
    splatGeo.setAttribute('color', new THREE.BufferAttribute(splatCol, 3));
    const splatMat = new THREE.PointsMaterial({
      size: 0.34,
      map: this.glowTex,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });
    this.splatPoints = new THREE.Points(splatGeo, splatMat);
    this.splatPoints.frustumCulled = false;
    this.scene.add(this.splatPoints);
  }

  /**
   * Launches a pooled theme-aware projectile from the front-row crowd toward a band member.
   */
  triggerCrowdThrow({ targetRole = null, laneIndex = 2, forced = false } = {}) {
    if (!this.projectilePool || this.projectilePool.length === 0) return;
    if (!forced && this.clock - this.lastThrowClock < 0.55) return;
    this.lastThrowClock = this.clock;

    const slot = this.projectilePool.find((p) => !p.active);
    if (!slot) return;

    const role = targetRole || this.activeInstrument || 'guitar';
    const targetPos = this.livePositions?.[role] || { x: 0, y: 0, z: -1.1 };

    // Pick a front-row crowd fan seed as the launch point and animate their throwing arm wind-up
    const frontCount = Math.min(28, this.crowdSeeds.length);
    const throwerIdx = frontCount > 0 ? Math.floor(Math.random() * frontCount) : -1;
    const seed = throwerIdx >= 0 ? this.crowdSeeds[throwerIdx] : null;
    if (throwerIdx >= 0) {
      this.crowdThrowerIdx = throwerIdx;
      this.crowdThrowWindup = 0.42;
    }
    const startX = seed ? seed.x * 0.72 : (laneIndex - 2) * 2.2 + (Math.random() - 0.5) * 1.6;
    const startY = seed ? seed.floorY + 1.55 : 0.6;
    const startZ = seed ? Math.max(6.2, Math.min(13.5, seed.z)) : 12.2;

    const flightTime = 0.52 + Math.random() * 0.14;
    const gravity = 15.8;
    const aimX = targetPos.x + (Math.random() - 0.5) * 0.45;
    const aimY = targetPos.y + 1.15 + (Math.random() - 0.5) * 0.25;
    const aimZ = targetPos.z;

    // Pick theme-aware prop matching the current concert stage overlay or venue
    let variant = Math.random() < 0.62 ? 'tomato' : 'cup';
    let splatHex = variant === 'tomato' ? 0xef4444 : 0xe2e8f0;
    if (this.venueOverlayId === 'CHRISTMAS' || this.venueId === 'christmas-wonderland') {
      variant = 'snowball';
      splatHex = 0xe0f2fe;
    } else if (this.venueOverlayId === 'HALLOWEEN' || this.venueId === 'halloween-cathedral') {
      variant = 'pumpkin';
      splatHex = 0xf97316;
    } else if (this.venueOverlayId === 'SAKURA' || this.venueId === 'sakura-festival') {
      variant = 'sakuraFan';
      splatHex = 0xf472b6;
    } else if (this.venueOverlayId === 'TROPICAL' || this.venueId === 'tropical-beach') {
      variant = 'beachBall';
      splatHex = 0x38bdf8;
    }

    Object.entries(slot.variants).forEach(([k, mesh]) => {
      mesh.visible = k === variant;
    });

    slot.active = true;
    slot.bouncing = false;
    slot.activeVariant = variant;
    slot.splatHex = splatHex;
    slot.targetRole = role;
    slot.x = startX;
    slot.y = startY;
    slot.z = startZ;
    slot.vx = (aimX - startX) / flightTime;
    slot.vz = (aimZ - startZ) / flightTime;
    slot.vy = (aimY - startY + 0.5 * gravity * flightTime * flightTime) / flightTime;
    slot.spinX = (Math.random() - 0.5) * 14;
    slot.spinY = (Math.random() - 0.5) * 14;
    slot.spinZ = (Math.random() - 0.5) * 14;
    slot.life = 0;
    slot.maxLife = flightTime + 0.55;

    slot.root.position.set(startX, startY, startZ);
    slot.root.visible = true;
  }

  spawnSplatBurst(x, y, z, hexColor) {
    const count = this.adaptiveLowPower ? 8 : 16;
    this._colorC.setHex(hexColor);
    for (let i = 0; i < count; i += 1) {
      const p = this.splatParticles[this.splatCursor];
      this.splatCursor = (this.splatCursor + 1) % this.splatCount;
      const a = Math.random() * Math.PI * 2;
      const spd = 1.2 + Math.random() * 2.8;
      p.active = true;
      p.x = x;
      p.y = Math.max(0.15, y);
      p.z = z;
      p.vx = Math.cos(a) * spd;
      p.vy = 1.4 + Math.random() * 2.6;
      p.vz = Math.sin(a) * spd;
      p.r = this._colorC.r;
      p.g = this._colorC.g;
      p.b = this._colorC.b;
      p.life = 0;
      p.maxLife = 0.36 + Math.random() * 0.28;
    }
  }

  updateCrowdProjectiles(dt) {
    const gravity = 15.8;

    if (this.crowdThrowWindup > 0) {
      this.crowdThrowWindup = Math.max(0, this.crowdThrowWindup - dt);
      if (this.crowdThrowWindup <= 0) {
        this.crowdThrowerIdx = -1;
      }
    }

    // 1. Decay musician flinch timers
    Object.keys(this.flinchTimers).forEach((k) => {
      if (this.flinchTimers[k] > 0) {
        this.flinchTimers[k] = Math.max(0, this.flinchTimers[k] - dt);
      }
    });

    // 2. Step pooled flying projectiles
    for (let i = 0; i < this.projectilePool.length; i += 1) {
      const p = this.projectilePool[i];
      if (!p.active) continue;

      p.life += dt;
      p.vy -= gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      p.root.position.set(p.x, p.y, p.z);
      p.root.rotation.x += p.spinX * dt;
      p.root.rotation.y += p.spinY * dt;
      p.root.rotation.z += p.spinZ * dt;

      const targetPos = this.livePositions?.[p.targetRole] || { x: 0, y: 0, z: -1.1 };
      const dx = p.x - targetPos.x;
      const dz = p.z - targetPos.z;
      const dy = p.y - (targetPos.y + 1.15);
      const hitMusician = !p.bouncing && dx * dx + dz * dz < 0.78 && Math.abs(dy) < 0.95;
      const hitFloor = !p.bouncing && p.y <= 0.14;

      if (hitMusician || hitFloor) {
        p.bouncing = true;
        p.y = Math.max(0.14, p.y);
        p.vy = hitMusician ? 2.4 : 2.8;
        p.vx *= -0.35;
        p.vz = Math.abs(p.vz) * 0.38;
        this.spawnSplatBurst(p.x, p.y, p.z, p.splatHex);
        if (hitMusician && this.flinchTimers[p.targetRole] !== undefined) {
          this.flinchTimers[p.targetRole] = 0.35;
        }
        if (typeof this.onProjectileImpact === 'function') {
          const pan = Math.max(-0.85, Math.min(0.85, p.x / 6.5));
          this.onProjectileImpact(pan);
        }
      }

      if (p.life >= p.maxLife || p.y < -2.0) {
        p.active = false;
        p.root.visible = false;
      }
    }

    // 3. Step pre-allocated splat particle buffer
    if (this.splatPoints) {
      const posArr = this.splatPoints.geometry.attributes.position.array;
      const colArr = this.splatPoints.geometry.attributes.color.array;
      let anyUpdated = false;
      for (let i = 0; i < this.splatCount; i += 1) {
        const sp = this.splatParticles[i];
        if (!sp.active) continue;
        anyUpdated = true;
        sp.life += dt;
        if (sp.life >= sp.maxLife) {
          sp.active = false;
          posArr[i * 3 + 1] = -999;
          continue;
        }
        sp.vy -= 11.5 * dt;
        sp.x += sp.vx * dt;
        sp.y = Math.max(0.05, sp.y + sp.vy * dt);
        sp.z += sp.vz * dt;
        const fade = 1 - sp.life / sp.maxLife;
        posArr[i * 3] = sp.x;
        posArr[i * 3 + 1] = sp.y;
        posArr[i * 3 + 2] = sp.z;
        colArr[i * 3] = sp.r * fade;
        colArr[i * 3 + 1] = sp.g * fade;
        colArr[i * 3 + 2] = sp.b * fade;
      }
      if (anyUpdated) {
        this.splatPoints.geometry.attributes.position.needsUpdate = true;
        this.splatPoints.geometry.attributes.color.needsUpdate = true;
      }
    }
  }

  /**
   * Called on real note hits to drive instrument-matched physical animation impulses!
   */
  notifyNoteEvent({ instrument, lane = 1, pitchNorm = 0.5, drumPart = null, isChord = false, pianoHand = null } = {}) {
    if (instrument === 'guitar') {
      this.guitarStrumImpulse = isChord ? 1.35 : 1.0;
      this.guitarStrumDir = -this.guitarStrumDir;
      this.guitarFretPos = Math.max(0, Math.min(1, Number.isFinite(pitchNorm) ? pitchNorm : lane / 4));
      this.guitarHeadbangBoost = Math.min(1.2, this.guitarHeadbangBoost + (isChord ? 0.55 : 0.32));
      if (isChord && this.cameraDirector) {
        this.cameraDirector.triggerKickImpulse(0.42);
      }
    } else if (instrument === 'bass') {
      this.bassPluckImpulse = 1.0;
      this.bassBounceImpulse = Math.min(1.1, this.bassBounceImpulse + 0.55);
      this.bassFretPos = Math.max(0, Math.min(1, Number.isFinite(pitchNorm) ? pitchNorm : lane / 4));
      if (this.cameraDirector) {
        this.cameraDirector.triggerKickImpulse(0.28);
      }
    } else if (instrument === 'drums') {
      const part = drumPart || (lane === 0 ? 'kick' : lane === 1 ? 'snare' : lane === 2 ? 'hihat' : 'crash');
      if (part === 'kick') {
        this.drumKickImpulse = 1.0;
        this.drumRightHit = Math.max(this.drumRightHit, 0.75);
        this.drumRightTarget = 'tom';
        if (this.cameraDirector) {
          this.cameraDirector.triggerKickImpulse(0.75);
        }
      } else if (part === 'snare') {
        this.drumLeftHit = 1.15;
        this.drumLeftTarget = 'snare';
        if (this.cameraDirector) {
          this.cameraDirector.triggerKickImpulse(0.32);
        }
      } else if (part === 'hihat') {
        this.drumLeftHit = Math.max(this.drumLeftHit, 0.95);
        this.drumLeftTarget = 'hihat';
        this.cymbalWobble[0] = Math.min(1.0, this.cymbalWobble[0] + 0.65);
      } else if (part === 'crash') {
        this.drumRightHit = 1.25;
        this.drumRightTarget = 'crash';
        this.cymbalWobble[2] = 1.0;
        this.cymbalWobble[1] = Math.max(this.cymbalWobble[1], 0.72);
        if (this.cameraDirector) {
          this.cameraDirector.triggerKickImpulse(0.58);
        }
        // Big crash hits during Chorus / Fever launch coordinated band jumps!
        const moodId = this.lightingState?.moodId;
        if (moodId === 'CHORUS_EXPLOSION' || moodId === 'FEVER_OVERDRIVE' || moodId === 'ENCORE_FINALE') {
          this.triggerBandJump(0.95);
        }
      }
      if (isChord) {
        this.drumLeftHit = 1.2;
        this.drumRightHit = 1.2;
        this.cymbalWobble[1] = 1.0;
        if (this.cameraDirector) {
          this.cameraDirector.triggerKickImpulse(0.68);
        }
      }
    } else if (instrument === 'piano') {
      const nextPos = Math.max(0, Math.min(1, Number.isFinite(pitchNorm) ? pitchNorm : lane / 4));
      if (Math.abs(nextPos - this.pianoHandPos) > 0.32 || isChord) {
        this.pianoGlissando = 1.0;
      }
      this.pianoHandPos = nextPos;
      this.pianoHitImpulse = isChord ? 1.35 : 1.0;
      this.lastPianoHand = pianoHand || (lane <= 1 ? 'left' : 'right');
      this.pianoHandAlt = this.lastPianoHand === 'left' ? 1 : -1;
    }
  }

  setVenue(venueId, overlayId = this.venueOverlayId || 'STANDARD') {
    this.venueId = venueId || this.venueId || 'philippine-arena';
    this.venueOverlayId = overlayId || this.venueOverlayId || 'STANDARD';
    this.overlayMeta = getStageOverlayById(this.venueOverlayId);
    if (this.venueEnv) {
      this.scene.remove(this.venueEnv.group);
      this.venueEnv.dispose();
      this.venueEnv = null;
    }

    const built = buildVenueEnvironment(this.venueId, this.venueOverlayId);
    this.venueEnv = built;
    this.scene.add(built.group);

    // Cache waterfront surfaces (Manila Bay / Sydney Harbour) & metallic roof trusses for live firework color reflections
    this._venueWaterMats = [];
    this._venueTrussMats = [];
    const seenWater = new Set();
    const seenTruss = new Set();
    built.group.traverse((obj) => {
      if (!obj.isMesh || !obj.material || Array.isArray(obj.material)) return;
      const mat = obj.material;
      if (!mat.emissive) return;
      const geomParams = obj.geometry?.parameters;
      const isWaterPlane =
        geomParams &&
        geomParams.width >= 180 &&
        geomParams.height >= 120 &&
        obj.position.y < -1.0 &&
        mat.metalness >= 0.4;
      if (isWaterPlane && !seenWater.has(mat)) {
        seenWater.add(mat);
        this._venueWaterMats.push({
          mat,
          baseEmissive: mat.emissive.clone(),
          baseIntensity: mat.emissiveIntensity ?? 0.3,
        });
      } else if (mat.metalness >= 0.78 && mat.roughness <= 0.42 && obj.position.y > 6 && !seenTruss.has(mat)) {
        seenTruss.add(mat);
        this._venueTrussMats.push({
          mat,
          baseEmissive: mat.emissive.clone(),
          baseIntensity: mat.emissiveIntensity ?? 0,
        });
      }
    });

    const meta = built.meta;
    this._venueSkyColor.setHex(meta.skyColor);
    this.scene.background = new THREE.Color(meta.skyColor);
    this.scene.fog = new THREE.FogExp2(meta.fogColor, meta.fogDensity);
    this.hemiLight.color.setHex(meta.hemiSky);
    this.hemiLight.groundColor.setHex(meta.hemiGround);
    this.frontKey.color.setHex(meta.keyColor);
    this.frontKey.intensity = meta.keyIntensity;

    const palette = meta.laserColors || [0x38bdf8, 0xfacc15, 0xf43f5e];
    this.laserBeams.forEach((lb, i) => {
      lb.mat.color.setHex(palette[i % palette.length]);
    });

    // Apply venue & overlay stage skinning to truss accent trim, riser fascias, PA scrim banners & LED floor/backwall
    const stageTheme = built.stageTheme;
    if (stageTheme) {
      if (this.venueTrussTrimMat) {
        this.venueTrussTrimMat.color.setHex(stageTheme.trussAccentHex);
        this.venueTrussTrimMat.emissive.setHex(stageTheme.trussAccentHex);
      }
      if (this.riserFasciaMat) {
        this.riserFasciaMat.color.setHex(stageTheme.trussAccentHex);
        this.riserFasciaMat.emissive.setHex(stageTheme.trussSecondaryHex ?? stageTheme.trussAccentHex);
      }
      if (this.podRingMat) {
        this.podRingMat.color.setHex(stageTheme.trussAccentHex);
        this.podRingMat.emissive.setHex(stageTheme.trussAccentHex);
      }
      this.drawScrimBanner();
      this.drawVipBanner();
      this.drawStageFloorLed(0.25, 0.25, 0.2, this.feverActive, this.encorePerformanceActive || this.grandEncoreActive);
      this.drawBackwallLed(0.25, 0.25, 0.2, this.feverActive, this.encorePerformanceActive || this.grandEncoreActive);
    }
  }

  setCameraMode(mode) {
    const validModes = [
      'on',
      'pit-steadicam',
      'crowd-pov',
      'pit-surf',
      'hero-closeup',
      'stadium-crane',
      'aerial-drone',
      'subtle',
      'locked',
    ];
    if (validModes.includes(mode)) {
      this.cameraMode = mode;
      this.cameraDirector?.setMode(mode);
    }
  }

  setTrackTitle(title) {
    this.currentTrackTitle = title || 'ENCORE STAGE';
    this.drawLedBackdrop(0.25, 0.25, 0.2, this.feverActive, this.encorePerformanceActive || this.grandEncoreActive);
  }

  /**
   * Shifts stage lighting, LED backdrop, and pyrotechnics into blazing Gold-and-Pyro Final Encore mode!
   */
  setEncorePerformance(active, trackTitle = null) {
    this.encorePerformanceActive = Boolean(active);
    if (trackTitle) this.currentTrackTitle = trackTitle;
    this.setInstrumentTheme(this.activeInstrument, this.feverActive);
    this.drawLedBackdrop(0.45, 0.4, 0.35, this.feverActive, this.encorePerformanceActive || this.grandEncoreActive);

    if (this.encorePerformanceActive) {
      this.triggerStagePyro(1.35);
      this.triggerConfettiBurst();
      this.launchFireworkShell();
    }
  }

  /**
   * Engages the Grand Encore Finale: open-air stadium sky reveal, retracted indoor ceilings,
   * locked ENCORE_AERIAL_HELICOPTER sweep, and continuous multi-stage aerial mortar barrages.
   */
  setGrandEncore(active) {
    const next = Boolean(active);
    const was = this.grandEncoreActive;
    this.grandEncoreActive = next;
    this.setInstrumentTheme(this.activeInstrument, this.feverActive);
    this.drawLedBackdrop(0.5, 0.45, 0.4, this.feverActive, this.encorePerformanceActive || this.grandEncoreActive);

    if (next && !was) {
      this.finaleFireworkTimer = 0.12;
      this.triggerStagePyro(1.45);
      this.triggerConfettiBurst();
      this.launchFireworkShell(true);
      this.launchFireworkShell(true);
    }
  }

  setInstrumentTheme(instrument, feverActive = false) {
    this.activeInstrument = instrument;
    this.feverActive = Boolean(feverActive);

    const hex =
      this.feverActive || this.encorePerformanceActive
        ? THEME_COLORS.fever
        : (THEME_COLORS[instrument] || THEME_COLORS.guitar);
    this._colorA.setHex(hex);

    this.stageRimMat.color.copy(this._colorA);
    this.stageRimMat.emissive.copy(this._colorA);
    this.lightstickMat.color.copy(this._colorA);
    if (this.crowdLight) this.crowdLight.color.copy(this._colorA);

    this.ampLedMats.forEach((m) => {
      m.color.copy(this._colorA);
      m.emissive.copy(this._colorA);
    });
  }

  setActivePlayers(roles = ['guitar'], feverActive = false) {
    const clean = Array.isArray(roles) && roles.length ? roles : ['guitar'];
    this.activeInstruments = clean;
    this.setInstrumentTheme(clean[0], feverActive);
  }

  setPlayersMissed(missedRoles = []) {
    this.missedInstruments = new Set(Array.isArray(missedRoles) ? missedRoles : []);
    this.missedInstrument = this.missedInstruments.size > 0 ? [...this.missedInstruments][0] : null;
    ['guitar', 'bass', 'drums', 'piano'].forEach((role) => {
      const member = this.membersByRole[role];
      if (member) {
        member.setShocked(this.missedInstruments.has(role));
      }
    });
  }

  setMemberMissed(instrument, missed) {
    if (missed && instrument) {
      this.missedInstruments.add(instrument);
    } else if (instrument) {
      this.missedInstruments.delete(instrument);
    }
    this.missedInstrument = this.missedInstruments.size > 0 ? [...this.missedInstruments][0] : null;

    ['guitar', 'bass', 'drums', 'piano'].forEach((role) => {
      const member = this.membersByRole[role];
      if (member) {
        member.setShocked(this.missedInstruments.has(role));
      }
    });
  }

  triggerStagePyro(intensity = 1.0) {
    this.pyroFlameIntensity = Math.max(this.pyroFlameIntensity, Math.min(1.65, intensity));
    this.pyroFlameTimer = Math.max(this.pyroFlameTimer, 0.95 + intensity * 0.45);
    this.sparkEmitterTimer = Math.max(this.sparkEmitterTimer, 1.6 + intensity * 0.65);
    if (intensity >= 0.85) {
      this.launchStageTrussMines(intensity);
    }
    if (intensity >= 1.0) {
      this.triggerCryoJets(1.4 + intensity * 0.35);
      this.triggerBandJump(intensity);
    }
  }

  triggerManualPyroAndSparks() {
    this.pyroFlameIntensity = Math.max(this.pyroFlameIntensity, 1.5);
    this.pyroFlameTimer = Math.max(this.pyroFlameTimer, 1.65);
    this.sparkEmitterTimer = Math.max(this.sparkEmitterTimer, 2.2);
    this.launchStageTrussMines(1.25);
    this.launchRomanCandleSalvo(Math.random() < 0.5 ? 'patriot' : 'cyber', 8, 5);
    this.launchFireworkShell(true);
    this.triggerBandJump(1.08);
    this.crowdAmbience?.triggerMilestoneRoar?.(0.95);
  }

  triggerCrowdEvent(requestedType = 'CYCLE') {
    const ev = this.crowdEvent;
    const cycleOrder = ['STADIUM_WAVE', 'MOSHPIT', 'PHONE_LIGHTS', 'HEART_HANDS'];
    let nextType = requestedType;
    if (!requestedType || requestedType === 'CYCLE') {
      const curIdx = cycleOrder.indexOf(ev.type);
      nextType = cycleOrder[(curIdx + 1) % cycleOrder.length];
    }
    ev.type = nextType;
    ev.duration = nextType === 'PHONE_LIGHTS' ? 9.5 : 8.0;
    ev.timer = ev.duration;
    ev.cooldown = 10.0;
    ev.centerX = 0;
    ev.centerZ = nextType === 'MOSHPIT' ? 15.2 : 14.8;
    this.activeCrowdEvent.type = nextType;
    this.crowdAmbience?.triggerMilestoneRoar?.(1.1);
    return nextType;
  }

  triggerConfettiBurst(cannonMode = false) {
    let spawned = 0;
    const perBurst = cannonMode ? 320 : 120;
    for (let i = 0; i < this.confettiCount && spawned < perBurst; i += 1) {
      const c = this.confettiItems[i];
      if (c.active && c.life < c.maxLife * 0.65) continue;

      const side = spawned % 2 === 0 ? -1 : 1;
      c.active = true;
      c.x = side * (5.2 + Math.random() * (cannonMode ? 3.2 : 1.4));
      c.y = 0.35 + Math.random() * 0.5;
      c.z = 2.0 + (Math.random() - 0.5) * (cannonMode ? 2.4 : 1.2);

      c.vx = -side * ((cannonMode ? 3.0 : 2.2) + Math.random() * 5.2) + (Math.random() - 0.5) * 2.8;
      c.vy = (cannonMode ? 9.2 : 6.9) + Math.random() * (cannonMode ? 6.4 : 4.8);
      c.vz = -1.2 + (Math.random() - 0.5) * (cannonMode ? 5.8 : 4.2);

      c.rx = Math.random() * Math.PI * 2;
      c.ry = Math.random() * Math.PI * 2;
      c.rz = Math.random() * Math.PI * 2;
      c.vrx = (Math.random() - 0.5) * 10;
      c.vry = (Math.random() - 0.5) * 10;
      c.vrz = (Math.random() - 0.5) * 8;
      c.life = 0;
      c.maxLife = (cannonMode ? 4.4 : 3.2) + Math.random() * 1.9;
      spawned += 1;
    }
    if (cannonMode) {
      this.crowdAmbience?.triggerMilestoneRoar?.(1.0);
    }
  }

  /**
   * Registers a live firework sky/rim PointLight flash for stadium trusses, water reflections & illuminated smoke clouds.
   */
  registerFireworkFlash(x, y, z, hexColor, intensity = 175, isSubBassSalute = false) {
    if (this.fwBurstLights?.length) {
      const pl = this.fwBurstLights[this.fwBurstLightCursor % this.fwBurstLights.length];
      this.fwBurstLightCursor += 1;
      pl.position.set(x, Math.min(74, Math.max(8, y)), z);
      pl.color.setHex(hexColor);
      pl.intensity = intensity;
    }
    if (isSubBassSalute) {
      this._fwSubBassFlashDecay = Math.max(this._fwSubBassFlashDecay, 1.0);
    }
  }

  /**
   * Zero-GC pooled particle writer for the 6,400-instance velocity-stretched firework shader mesh.
   */
  spawnFireworkParticle(cfg) {
    const p = this.fwParticles[this.fwCursor];
    this.fwCursor = (this.fwCursor + 1) % this.fwParticleCount;
    p.active = true;
    p.x = cfg.x;
    p.y = cfg.y;
    p.z = cfg.z;
    p.vx = cfg.vx;
    p.vy = cfg.vy;
    p.vz = cfg.vz;
    p.r0 = cfg.r0 ?? 1.0;
    p.g0 = cfg.g0 ?? 0.98;
    p.b0 = cfg.b0 ?? 0.92;
    p.r = cfg.r;
    p.g = cfg.g;
    p.b = cfg.b;
    p.r2 = cfg.r2 ?? cfg.r;
    p.g2 = cfg.g2 ?? cfg.g;
    p.b2 = cfg.b2 ?? cfg.b;
    p.size = cfg.size ?? 1.1;
    p.stretch = cfg.stretch ?? 1.4;
    p.spriteMode = cfg.spriteMode ?? 0;
    p.hdrBoost = cfg.hdrBoost ?? 1.45;
    p.isCore = Boolean(cfg.isCore);
    p.drag = cfg.drag ?? 0.24;
    p.gravity = cfg.gravity ?? 4.2;
    p.burstType = cfg.burstType || 'chrysanthemum';
    p.secondaryTimer = cfg.secondaryTimer ?? 0;
    p.trailTimer = cfg.trailTimer ?? 0;
    p.strobeTail = Boolean(cfg.strobeTail);
    p.spinOmega = cfg.spinOmega ?? 0;
    p.spinRadius = cfg.spinRadius ?? 0;
    p.spinPhase = cfg.spinPhase ?? 0;
    p.subColorHex = cfg.subColorHex ?? 0xfacc15;
    p.life = 0;
    p.maxLife = cfg.maxLife ?? 1.5;
    this.hasActiveFireworks = true;
    return p;
  }

  /**
   * Spawns illuminated apex smoke clouds that dynamically catch the colored glow of nearby shell detonations.
   */
  spawnFireworkSmoke(x, y, z, count = 6, windAx = 0, scaleMult = 1.0) {
    const n = this.adaptiveLowPower ? Math.max(2, Math.floor(count * 0.5)) : count;
    for (let s = 0; s < n; s += 1) {
      const sm = this.fwSmokeParticles[this.fwSmokeCursor];
      this.fwSmokeCursor = (this.fwSmokeCursor + 1) % this.fwSmokeCount;
      sm.active = true;
      sm.x = x + (Math.random() - 0.5) * 4.2 * scaleMult;
      sm.y = y + (Math.random() - 0.5) * 3.4 * scaleMult;
      sm.z = z + (Math.random() - 0.5) * 4.2 * scaleMult;
      sm.vx = windAx * 0.38 + (Math.random() - 0.5) * 1.1;
      sm.vy = 0.45 + Math.random() * 0.7;
      sm.vz = (Math.random() - 0.5) * 0.95;
      sm.size = (6.8 + Math.random() * 5.0) * scaleMult;
      sm.growRate = (2.0 + Math.random() * 1.5) * scaleMult;
      sm.rot = Math.random() * Math.PI * 2;
      sm.vRot = (Math.random() - 0.5) * 0.28;
      sm.baseAlpha = 0.17 + Math.random() * 0.1;
      sm.baseGrey = 0.78 + Math.random() * 0.22;
      sm.life = 0;
      sm.maxLife = 3.4 + Math.random() * 1.9;
    }
  }

  /**
   * TIER 1 — Stage-Lip, Catwalk Perimeter & Roof-Truss V-Angled Silver/Gold Mines + Cold-Spark Fountains (y: 1.5m–16m).
   */
  launchStageTrussMines(intensity = 1.0) {
    const trussXs = [-14.2, -9.8, -5.2, -1.8, 1.8, 5.2, 9.8, 14.2];
    const perMortar = this.adaptiveLowPower ? 12 : Math.round(22 * Math.min(1.4, intensity));
    for (let m = 0; m < trussXs.length; m += 1) {
      const mx = trussXs[m];
      const mz = -6.2;
      const my = 14.2;
      const isGold = m % 2 === 1;
      const fanDir = mx < 0 ? -0.38 : 0.38;
      for (let i = 0; i < perMortar; i += 1) {
        const spread = (Math.random() - 0.5) * 0.68 + fanDir * (0.35 + Math.random() * 0.85);
        const speed = 14.2 + Math.random() * 10.0;
        this._colorA.setHex(isGold ? 0xfef08a : 0xf8fafc);
        this._colorB.setHex(isGold ? 0xd97706 : 0x38bdf8);
        this.spawnFireworkParticle({
          x: mx + (Math.random() - 0.5) * 0.35,
          y: my,
          z: mz + (Math.random() - 0.5) * 0.35,
          vx: Math.sin(spread) * speed * 0.88,
          vy: Math.cos(spread * 0.58) * speed,
          vz: (Math.random() - 0.5) * 4.5 - 1.2,
          r0: 1.0,
          g0: 0.99,
          b0: 0.96,
          r: this._colorA.r,
          g: this._colorA.g,
          b: this._colorA.b,
          r2: this._colorB.r,
          g2: this._colorB.g,
          b2: this._colorB.b,
          size: 0.82 + Math.random() * 0.44,
          stretch: 2.45,
          spriteMode: i % 4 === 0 ? 1 : 0,
          hdrBoost: 1.9,
          drag: 0.35,
          gravity: 10.0,
          burstType: 'stage_mine',
          life: 0,
          maxLife: 0.68 + Math.random() * 0.44,
        });
      }
    }
    this.registerFireworkFlash(0, 17, -5, 0xfef08a, 155);
    this.sparkEmitterTimer = Math.max(this.sparkEmitterTimer, 2.0);
  }

  /**
   * TIER 2 — Stadium Rim Rapid Roman Candle & Comet Batteries (11 angled mortar pods, y: 18m–32m).
   * Fires rapid 1/8-note and 1/16-note musical sweeps: LEFT_TO_RIGHT, RIGHT_TO_LEFT, CENTER_OUT_V, CRISS_CROSS_X.
   */
  launchRomanCandleSalvo(paletteMode = 'patriot', subdiv = 8, shotsPerSweep = 11, forcedPattern = null) {
    if (this.fwRomanQueue.length >= 36) return;
    const rimPods = [
      { x: -30, y: 18.2, z: -21, aimX: 0.36 },
      { x: -24, y: 19.0, z: -22, aimX: 0.28 },
      { x: -18, y: 19.8, z: -23, aimX: 0.2 },
      { x: -12, y: 20.4, z: -24, aimX: 0.13 },
      { x: -6, y: 21.0, z: -24.5, aimX: 0.06 },
      { x: 0, y: 21.4, z: -25, aimX: 0.0 },
      { x: 6, y: 21.0, z: -24.5, aimX: -0.06 },
      { x: 12, y: 20.4, z: -24, aimX: -0.13 },
      { x: 18, y: 19.8, z: -23, aimX: -0.2 },
      { x: 24, y: 19.0, z: -22, aimX: -0.28 },
      { x: 30, y: 18.2, z: -21, aimX: -0.36 },
    ];
    const colors =
      paletteMode === 'cyber'
        ? [0xfacc15, 0x22d3ee, 0xe879f9, 0x38bdf8]
        : paletteMode === 'gold'
          ? [0xfef08a, 0xfacc15, 0xf59e0b, 0xf8fafc]
          : [0xff2e55, 0xf8fafc, 0x38bdf8, 0xfacc15];

    const patterns = ['LEFT_TO_RIGHT', 'RIGHT_TO_LEFT', 'CENTER_OUT_V', 'CRISS_CROSS_X'];
    const pattern = forcedPattern || patterns[this._fwRomanPatternIdx % patterns.length];
    this._fwRomanPatternIdx += 1;

    if (pattern === 'LEFT_TO_RIGHT') {
      const steps = Math.min(11, Math.max(6, shotsPerSweep));
      for (let s = 0; s < steps; s += 1) {
        const pod = rimPods[s % 11];
        this.fwRomanQueue.push({
          subdiv,
          colorHex: colors[s % colors.length],
          tubes: [{ ...pod, aimX: pod.aimX + 0.14 }],
        });
      }
    } else if (pattern === 'RIGHT_TO_LEFT') {
      const steps = Math.min(11, Math.max(6, shotsPerSweep));
      for (let s = 0; s < steps; s += 1) {
        const pod = rimPods[10 - (s % 11)];
        this.fwRomanQueue.push({
          subdiv,
          colorHex: colors[s % colors.length],
          tubes: [{ ...pod, aimX: pod.aimX - 0.14 }],
        });
      }
    } else if (pattern === 'CENTER_OUT_V') {
      // Symmetrical V-fan expanding outward from center pod (5) to outer rim pods (0 & 10)
      for (let step = 0; step <= 5; step += 1) {
        const hex = colors[step % colors.length];
        if (step === 0) {
          this.fwRomanQueue.push({
            subdiv,
            colorHex: hex,
            tubes: [
              { ...rimPods[5], aimX: -0.18 },
              { ...rimPods[5], aimX: 0.18 },
            ],
          });
        } else {
          const leftPod = rimPods[5 - step];
          const rightPod = rimPods[5 + step];
          this.fwRomanQueue.push({
            subdiv,
            colorHex: hex,
            tubes: [
              { ...leftPod, aimX: -0.22 - step * 0.04 },
              { ...rightPod, aimX: 0.22 + step * 0.04 },
            ],
          });
        }
      }
    } else {
      // CRISS_CROSS_X: opposing rim pods fire inward across each other in crisp X-trails
      for (let step = 0; step < 6; step += 1) {
        const leftPod = rimPods[step];
        const rightPod = rimPods[10 - step];
        const hexA = colors[step % colors.length];
        this.fwRomanQueue.push({
          subdiv,
          colorHex: hexA,
          tubes: [
            { ...leftPod, aimX: 0.34 - step * 0.03 },
            { ...rightPod, aimX: -0.34 + step * 0.03 },
          ],
        });
      }
    }
  }

  /**
   * TIER 3 — Ground-Launched Girandola (Flying Spinning Firework Wheel lifting to y: 38m–48m -> Silver Crown burst).
   */
  launchGirandolaWheel(x = null, z = null) {
    if (this.fwGirandolas.length >= 3) return;
    const gx = x !== null ? x : (Math.random() - 0.5) * 32;
    const gz = z !== null ? z : -17 - Math.random() * 7;
    const apexY = 38 + Math.random() * 10;
    this.fwGirandolas.push({
      x: gx,
      y: 2.5,
      z: gz,
      vy: 20.5,
      apexY,
      angle: Math.random() * Math.PI * 2,
      spinSpeed: 22.0,
      radius: 1.85,
      emitAccum: 0,
      life: 0,
      maxLife: 2.35,
    });
    if (typeof this.onFireworkLaunch === 'function') {
      this.onFireworkLaunch(Math.max(-0.85, Math.min(0.85, gx / 20)));
    }
    this.hasActiveFireworks = true;
  }

  launchFireworkShell(force = false, forcedType = null, forcedTier = null) {
    const meta = this.venueEnv?.meta;
    const isGrandEncore = this.grandEncoreActive || this.encoreFinaleActive;
    if (!force && !isGrandEncore && !meta?.supportsAerialFireworks && !this.encorePerformanceActive) return;
    const maxShells = isGrandEncore ? 16 : 12;
    if (this.fwShells.length >= maxShells) return;

    // Cycle across all rich authentic Tier-3 (shaped/multi-break) & Tier-4 (mega-canopy) shell types
    const tier3Roster = [
      'double_ring_saturn',
      'crossette',
      'tourbillon',
      'heart_3d',
      'star_5pt',
      'shell_of_shells',
    ];
    const tier4Roster = [
      'kamuro_willow',
      'peony_strobe',
      'chrysanthemum',
      'dragon_egg_salute',
    ];
    const shellRoster = [
      'chrysanthemum',
      'peony_strobe',
      'kamuro_willow',
      'crossette',
      'tourbillon',
      'heart_3d',
      'double_ring_saturn',
      'star_5pt',
      'shell_of_shells',
      'dragon_egg_salute',
    ];
    let burstType = forcedType;
    if (!burstType) {
      if (forcedTier === 3) {
        burstType = tier3Roster[this._fwTypeCycleIndex % tier3Roster.length];
      } else if (forcedTier === 4) {
        burstType = tier4Roster[this._fwTypeCycleIndex % tier4Roster.length];
      } else {
        burstType = shellRoster[this._fwTypeCycleIndex % shellRoster.length];
      }
      this._fwTypeCycleIndex += 1;
      // Extra weighting toward massive Kamuro/Strobe/Dragon-Egg spectacles in Grand Encore
      if (!forcedTier && isGrandEncore && Math.random() < 0.3) {
        burstType = tier4Roster[Math.floor(Math.random() * tier4Roster.length)];
      }
    }

    const resolvedTier =
      forcedTier ||
      (tier4Roster.includes(burstType) ? 4 : 3);

    // Pair Girandola UFO wheels in Tier 3
    if (burstType === 'girandola') {
      this.launchGirandolaWheel((Math.random() - 0.5) * 30, -18 - Math.random() * 6);
      return;
    }

    const x = (Math.random() - 0.5) * (resolvedTier === 4 ? 58 : 48);
    const z = (resolvedTier === 4 ? -24 : -19) - Math.random() * 12;
    let apexY;
    if (isGrandEncore || force || meta?.supportsAerialFireworks) {
      // Tier 3 Mid-Sky: y = 38m–52m | Tier 4 High-Altitude Mega-Canopy: y = 55m–75m
      apexY =
        resolvedTier === 4
          ? 55 + Math.random() * 20
          : 38 + Math.random() * 14;
    } else {
      apexY = Math.max(20, (meta?.fireworksCeilingY || 24) + Math.random() * 8);
    }

    const flightSec = resolvedTier === 4 ? 1.08 + Math.random() * 0.34 : 0.92 + Math.random() * 0.28;
    const shellGrav = 6.6;
    const vy0 = apexY / flightSec + 0.5 * shellGrav * flightSec;
    const windAx = (Math.random() - 0.5) * 2.8;

    const palette =
      burstType === 'kamuro_willow'
        ? FIREWORK_PALETTES[0]
        : burstType === 'heart_3d'
          ? FIREWORK_PALETTES[3]
          : burstType === 'peony_strobe'
            ? [0xe879f9, 0xf8fafc, 0xf43f5e]
            : FIREWORK_PALETTES[Math.floor(Math.random() * FIREWORK_PALETTES.length)];

    const pan = Math.max(-0.85, Math.min(0.85, x / 24));
    if (typeof this.onFireworkLaunch === 'function') {
      this.onFireworkLaunch(pan);
    }

    this.fwShells.push({
      x,
      y: 0.4,
      z,
      vx: (Math.random() - 0.5) * 2.2,
      vy: vy0,
      vz: (Math.random() - 0.5) * 1.4,
      ax: windAx,
      gravity: shellGrav,
      apexY,
      tier: resolvedTier,
      palette,
      burstType,
      trailAccum: 0,
      flightAge: 0,
      flightSec,
    });
  }

  detonateFireworkShell(shell) {
    const burstType = shell.burstType || 'chrysanthemum';
    const pal = shell.palette || FIREWORK_PALETTES[0];
    const sx = shell.x;
    const sy = shell.y;
    const sz = shell.z;
    const low = Boolean(this.adaptiveLowPower);
    const pan = Math.max(-0.85, Math.min(0.85, sx / 20));
    if (typeof this.onFireworkBurst === 'function') {
      this.onFireworkBurst(pan);
    }

    const isSalute = burstType === 'dragon_egg_salute';
    const flashHex =
      burstType === 'kamuro_willow'
        ? 0xfacc15
        : isSalute
          ? 0xfffbeb
          : pal[0];
    this.registerFireworkFlash(sx, sy, sz, flashHex, isSalute ? 260 : 185, isSalute);

    // Spawn illuminated translucent smoke clouds at apex (catch neighboring explosions' light!)
    this.spawnFireworkSmoke(sx, sy, sz, isSalute ? 10 : 7, shell.ax || 0, burstType === 'kamuro_willow' ? 1.35 : 1.05);

    // Volumetric incandescent core bloom flash at detonation apex
    this._colorA.setHex(flashHex);
    this.spawnFireworkParticle({
      x: sx,
      y: sy,
      z: sz,
      vx: 0,
      vy: 0,
      vz: 0,
      r0: 1.0,
      g0: 0.99,
      b0: 0.95,
      r: this._colorA.r,
      g: this._colorA.g,
      b: this._colorA.b,
      r2: this._colorA.r * 0.4,
      g2: this._colorA.g * 0.4,
      b2: this._colorA.b * 0.4,
      size: isSalute ? 19.0 : 13.5,
      stretch: 0.0,
      spriteMode: 3,
      hdrBoost: isSalute ? 2.4 : 1.7,
      isCore: true,
      drag: 0.9,
      gravity: 0,
      burstType: 'apex_bloom',
      maxLife: isSalute ? 0.42 : 0.32,
    });

    const goldenAngle = Math.PI * (1 + Math.sqrt(5));
    // Compute horizontal camera-facing basis (right & up) so 3D Heart, 5-Point Star & Saturn Rings stay crystal clear
    const camX = this.camera?.position?.x ?? 0;
    const camZ = this.camera?.position?.z ?? 26;
    const yawToCam = Math.atan2(camX - sx, camZ - sz);
    const cosY = Math.cos(yawToCam);
    const sinY = Math.sin(yawToCam);

    // ── EFFECT #1: CHRYSANTHEMUM (180–260 symmetrical stars, long velocity trails, 3-stage burn color shift) ──
    if (burstType === 'chrysanthemum') {
      const count = low ? 115 : 195 + Math.floor(Math.random() * 65);
      for (let i = 0; i < count; i += 1) {
        const tNorm = (i + 0.5) / count;
        const phi = Math.acos(1 - 2 * tNorm) + (Math.random() - 0.5) * 0.05;
        const theta = goldenAngle * i + (Math.random() - 0.5) * 0.08;
        const speed = 15.5 + Math.random() * 3.8;
        this._colorA.setHex(pal[0]);
        this._colorB.setHex(pal[2] ?? pal[1]);
        this.spawnFireworkParticle({
          x: sx,
          y: sy,
          z: sz,
          vx: Math.sin(phi) * Math.cos(theta) * speed,
          vy: Math.cos(phi) * speed + 1.4,
          vz: Math.sin(phi) * Math.sin(theta) * speed,
          r0: 1.0,
          g0: 0.99,
          b0: 0.96,
          r: this._colorA.r,
          g: this._colorA.g,
          b: this._colorA.b,
          r2: this._colorB.r,
          g2: this._colorB.g,
          b2: this._colorB.b,
          size: 1.15 + Math.random() * 0.35,
          stretch: 2.75,
          spriteMode: 0,
          hdrBoost: 1.75,
          drag: 0.28,
          gravity: 4.5,
          burstType: 'chrysanthemum',
          trailTimer: 0.045 + Math.random() * 0.04,
          maxLife: 1.65 + Math.random() * 0.48,
        });
      }
      return;
    }

    // ── TIER 4: SILVER / MAGENTA STROBE-TIPPED PEONY (high-altitude crisp spherical burst + high-freq strobe twinkle) ──
    if (burstType === 'peony_strobe') {
      const count = low ? 115 : 195 + Math.floor(Math.random() * 50);
      const tierScale = shell.tier === 4 ? 1.24 : 1.0;
      for (let i = 0; i < count; i += 1) {
        const tNorm = (i + 0.5) / count;
        const phi = Math.acos(1 - 2 * tNorm) + (Math.random() - 0.5) * 0.04;
        const theta = goldenAngle * i;
        const isInner = i % 4 === 0;
        const speed = (isInner ? 10.2 + Math.random() * 2.8 : 16.5 + Math.random() * 3.4) * tierScale;
        this._colorA.setHex(isInner ? 0xf8fafc : (i % 2 === 0 ? 0xe879f9 : pal[0]));
        this._colorB.setHex(isInner ? 0xe0f2fe : 0xf43f5e);
        this.spawnFireworkParticle({
          x: sx,
          y: sy,
          z: sz,
          vx: Math.sin(phi) * Math.cos(theta) * speed,
          vy: Math.cos(phi) * speed + 1.2,
          vz: Math.sin(phi) * Math.sin(theta) * speed,
          r0: 1.0,
          g0: 0.99,
          b0: 0.98,
          r: this._colorA.r,
          g: this._colorA.g,
          b: this._colorA.b,
          r2: this._colorB.r,
          g2: this._colorB.g,
          b2: this._colorB.b,
          size: (isInner ? 1.2 : 1.55) * tierScale,
          stretch: 0.65,
          spriteMode: 1,
          hdrBoost: 2.0,
          drag: 0.25,
          gravity: 3.6,
          burstType: 'peony_strobe',
          strobeTail: true,
          maxLife: 2.1 + Math.random() * 0.45,
        });
      }
      return;
    }

    // ── TIER 4: MEGA-CANOPY 24m-RADIUS 24k GOLD WEEPING KAMURO BROCADE CROWN (4.2s drooping charcoal-sparkle canopy) ──
    if (burstType === 'kamuro_willow') {
      const count = low ? 145 : 250 + Math.floor(Math.random() * 55);
      for (let i = 0; i < count; i += 1) {
        const tNorm = (i + 0.5) / count;
        const phi = Math.acos(1 - 2 * tNorm) + (Math.random() - 0.5) * 0.07;
        const theta = goldenAngle * i + (Math.random() - 0.5) * 0.09;
        // Massive 24m-radius high-altitude brocade canopy arresting via air drag and weeping gracefully for ~4.2s
        const speed = 21.5 + Math.random() * 7.5;
        this._colorA.setHex(i % 4 === 0 ? 0xfef9c3 : 0xfacc15);
        this._colorB.setHex(0xb45309);
        this.spawnFireworkParticle({
          x: sx,
          y: sy,
          z: sz,
          vx: Math.sin(phi) * Math.cos(theta) * speed,
          vy: Math.cos(phi) * speed * 0.94 + 4.2,
          vz: Math.sin(phi) * Math.sin(theta) * speed,
          r0: 1.0,
          g0: 0.98,
          b0: 0.85,
          r: this._colorA.r,
          g: this._colorA.g,
          b: this._colorA.b,
          r2: this._colorB.r,
          g2: this._colorB.g,
          b2: this._colorB.b,
          size: 1.42 + Math.random() * 0.48,
          stretch: 3.45,
          spriteMode: 0,
          hdrBoost: 1.85,
          drag: 0.35,
          gravity: 5.4,
          burstType: 'kamuro_willow',
          trailTimer: 0.048 + Math.random() * 0.05,
          maxLife: 3.95 + Math.random() * 0.65, // ~4.2s weeping 24k gold charcoal-sparkle canopy!
        });
      }
      return;
    }

    // ── EFFECT #5: CROSSETTE (large comet stars flying 0.45s then splitting perpendicularly into 4 cross micro-comets) ──
    if (burstType === 'crossette') {
      const count = low ? 18 : 26 + Math.floor(Math.random() * 8);
      for (let i = 0; i < count; i += 1) {
        const tNorm = (i + 0.5) / count;
        const phi = Math.acos(1 - 2 * tNorm);
        const theta = goldenAngle * i;
        const speed = 15.8 + Math.random() * 3.6;
        this._colorA.setHex(pal[i % pal.length]);
        this._colorB.setHex(pal[(i + 1) % pal.length]);
        this.spawnFireworkParticle({
          x: sx,
          y: sy,
          z: sz,
          vx: Math.sin(phi) * Math.cos(theta) * speed,
          vy: Math.cos(phi) * speed + 1.5,
          vz: Math.sin(phi) * Math.sin(theta) * speed,
          r0: 1.0,
          g0: 0.99,
          b0: 0.94,
          r: this._colorA.r,
          g: this._colorA.g,
          b: this._colorA.b,
          r2: this._colorB.r,
          g2: this._colorB.g,
          b2: this._colorB.b,
          size: 1.95,
          stretch: 2.1,
          spriteMode: 1,
          hdrBoost: 2.0,
          drag: 0.44,
          gravity: 4.0,
          burstType: 'crossette',
          secondaryTimer: 0.44 + Math.random() * 0.04,
          trailTimer: 0.04,
          subColorHex: pal[(i + 1) % pal.length],
          maxLife: 0.95,
        });
      }
      return;
    }

    // ── EFFECT #6: TOURBILLON / SPINNING VORTEX SERPENTS & FISH (helical corkscrew darting rockets) ──
    if (burstType === 'tourbillon') {
      const count = low ? 20 : 32 + Math.floor(Math.random() * 8);
      for (let i = 0; i < count; i += 1) {
        const tNorm = (i + 0.5) / count;
        const phi = Math.acos(1 - 2 * tNorm) + (Math.random() - 0.5) * 0.22;
        const theta = goldenAngle * i + (Math.random() - 0.5) * 0.25;
        const speed = 11.5 + Math.random() * 6.5;
        const isSilver = i % 2 === 0;
        this._colorA.setHex(isSilver ? 0xf8fafc : pal[i % pal.length]);
        this._colorB.setHex(isSilver ? 0x38bdf8 : 0xe879f9);
        this.spawnFireworkParticle({
          x: sx,
          y: sy,
          z: sz,
          vx: Math.sin(phi) * Math.cos(theta) * speed,
          vy: Math.cos(phi) * speed + 2.2,
          vz: Math.sin(phi) * Math.sin(theta) * speed,
          r0: 1.0,
          g0: 1.0,
          b0: 1.0,
          r: this._colorA.r,
          g: this._colorA.g,
          b: this._colorA.b,
          r2: this._colorB.r,
          g2: this._colorB.g,
          b2: this._colorB.b,
          size: 1.38,
          stretch: 2.5,
          spriteMode: 1,
          hdrBoost: 1.95,
          drag: 0.56,
          gravity: 2.4,
          burstType: 'tourbillon',
          spinOmega: (i % 2 === 0 ? 1 : -1) * (15 + Math.random() * 10),
          spinRadius: 11 + Math.random() * 8,
          spinPhase: Math.random() * Math.PI * 2,
          trailTimer: 0.028,
          secondaryTimer: 1.15 + Math.random() * 0.45,
          subColorHex: pal[(i + 1) % pal.length],
          maxLife: 1.45 + Math.random() * 0.45,
        });
      }
      return;
    }

    // ── EFFECT #7A: DOUBLE-RING & TILTED SATURN RING SHELL ──
    if (burstType === 'double_ring_saturn') {
      const outerCount = low ? 54 : 88;
      const innerCount = low ? 34 : 56;
      const tilt = 0.42 + (Math.random() - 0.5) * 0.35;
      const cosT = Math.cos(tilt);
      const sinT = Math.sin(tilt);
      // Outer Saturn Ring
      for (let i = 0; i < outerCount; i += 1) {
        const a = (i / outerCount) * Math.PI * 2;
        const lx = Math.cos(a) * 18.0;
        const ly = Math.sin(a) * 18.0 * sinT;
        const lz = Math.sin(a) * 18.0 * cosT;
        const wx = lx * cosY + lz * sinY;
        const wz = -lx * sinY + lz * cosY;
        this._colorA.setHex(pal[0]);
        this._colorB.setHex(pal[1]);
        this.spawnFireworkParticle({
          x: sx,
          y: sy,
          z: sz,
          vx: wx,
          vy: ly + 1.2,
          vz: wz,
          r: this._colorA.r,
          g: this._colorA.g,
          b: this._colorA.b,
          r2: this._colorB.r,
          g2: this._colorB.g,
          b2: this._colorB.b,
          size: 1.35,
          stretch: 1.85,
          spriteMode: 1,
          hdrBoost: 1.9,
          drag: 0.26,
          gravity: 3.4,
          burstType: 'ring_star',
          strobeTail: true,
          maxLife: 2.0 + Math.random() * 0.25,
        });
      }
      // Concentric Inner Core Planet Sphere
      for (let i = 0; i < innerCount; i += 1) {
        const tNorm = (i + 0.5) / innerCount;
        const phi = Math.acos(1 - 2 * tNorm);
        const theta = goldenAngle * i;
        const speed = 8.4 + Math.random() * 1.4;
        this._colorA.setHex(pal[2] ?? 0xfacc15);
        this._colorB.setHex(0xffffff);
        this.spawnFireworkParticle({
          x: sx,
          y: sy,
          z: sz,
          vx: Math.sin(phi) * Math.cos(theta) * speed,
          vy: Math.cos(phi) * speed + 1.2,
          vz: Math.sin(phi) * Math.sin(theta) * speed,
          r: this._colorA.r,
          g: this._colorA.g,
          b: this._colorA.b,
          r2: this._colorB.r,
          g2: this._colorB.g,
          b2: this._colorB.b,
          size: 1.22,
          stretch: 1.0,
          spriteMode: 1,
          hdrBoost: 1.85,
          drag: 0.26,
          gravity: 3.4,
          burstType: 'ring_core',
          maxLife: 1.85 + Math.random() * 0.25,
        });
      }
      return;
    }

    // ── EFFECT #7B: UPRIGHT 3D HEART FORMATION ORIENTED TOWARD STADIUM CAMERA ──
    if (burstType === 'heart_3d') {
      const heartPts = low ? 64 : 110;
      const scale = 1.02;
      for (let i = 0; i < heartPts; i += 1) {
        const a = (i / heartPts) * Math.PI * 2;
        const hx = 16 * Math.pow(Math.sin(a), 3) * scale;
        const hy = (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) * scale;
        const hz = (Math.random() - 0.5) * 1.6;
        const wx = hx * cosY + hz * sinY;
        const wz = -hx * sinY + hz * cosY;
        this._colorA.setHex(i % 3 === 0 ? 0xfda4af : 0xf43f5e);
        this._colorB.setHex(0xf472b6);
        this.spawnFireworkParticle({
          x: sx,
          y: sy,
          z: sz,
          vx: wx,
          vy: hy + 2.0,
          vz: wz,
          r0: 1.0,
          g0: 0.92,
          b0: 0.96,
          r: this._colorA.r,
          g: this._colorA.g,
          b: this._colorA.b,
          r2: this._colorB.r,
          g2: this._colorB.g,
          b2: this._colorB.b,
          size: 1.48,
          stretch: 1.25,
          spriteMode: 1,
          hdrBoost: 2.05,
          drag: 0.22,
          gravity: 2.6,
          burstType: 'heart_3d',
          strobeTail: true,
          maxLife: 2.25 + Math.random() * 0.25,
        });
      }
      // Subtle gold outer sparkle ring framing the Heart
      const ringPts = low ? 26 : 44;
      for (let i = 0; i < ringPts; i += 1) {
        const a = (i / ringPts) * Math.PI * 2;
        const lx = Math.cos(a) * 19.5;
        const ly = Math.sin(a) * 19.5;
        this._colorA.setHex(0xfef08a);
        this._colorB.setHex(0xf59e0b);
        this.spawnFireworkParticle({
          x: sx,
          y: sy,
          z: sz,
          vx: lx * cosY,
          vy: ly + 2.0,
          vz: -lx * sinY,
          r: this._colorA.r,
          g: this._colorA.g,
          b: this._colorA.b,
          r2: this._colorB.r,
          g2: this._colorB.g,
          b2: this._colorB.b,
          size: 0.95,
          stretch: 1.6,
          spriteMode: 0,
          hdrBoost: 1.6,
          drag: 0.24,
          gravity: 3.1,
          burstType: 'ring_frame',
          maxLife: 1.85,
        });
      }
      return;
    }

    // ── EFFECT #7C: UPRIGHT 5-POINT STAR FORMATION ORIENTED TOWARD STADIUM CAMERA ──
    if (burstType === 'star_5pt') {
      const verts = [];
      for (let k = 0; k < 10; k += 1) {
        const rad = k % 2 === 0 ? 18.5 : 7.6;
        const ang = Math.PI * 0.5 + (k * Math.PI) / 5;
        verts.push({ x: Math.cos(ang) * rad, y: Math.sin(ang) * rad });
      }
      const perEdge = low ? 7 : 12;
      for (let e = 0; e < 10; e += 1) {
        const v0 = verts[e];
        const v1 = verts[(e + 1) % 10];
        for (let s = 0; s < perEdge; s += 1) {
          const frac = s / perEdge;
          const lx = v0.x + (v1.x - v0.x) * frac;
          const ly = v0.y + (v1.y - v0.y) * frac;
          const lz = (Math.random() - 0.5) * 1.2;
          const wx = lx * cosY + lz * sinY;
          const wz = -lx * sinY + lz * cosY;
          this._colorA.setHex(pal[0]);
          this._colorB.setHex(0xfef08a);
          this.spawnFireworkParticle({
            x: sx,
            y: sy,
            z: sz,
            vx: wx,
            vy: ly + 1.8,
            vz: wz,
            r0: 1.0,
            g0: 0.99,
            b0: 0.94,
            r: this._colorA.r,
            g: this._colorA.g,
            b: this._colorA.b,
            r2: this._colorB.r,
            g2: this._colorB.g,
            b2: this._colorB.b,
            size: 1.42,
            stretch: 1.2,
            spriteMode: 1,
            hdrBoost: 2.0,
            drag: 0.22,
            gravity: 2.7,
            burstType: 'star_5pt',
            strobeTail: true,
            maxLife: 2.15 + Math.random() * 0.2,
          });
        }
      }
      return;
    }

    // ── EFFECT #7D: MULTI-BREAK "SHELL-OF-SHELLS" (outer cluster of sub-shells detonating into synchronized peonies) ──
    if (burstType === 'shell_of_shells') {
      const subCount = low ? 5 : 8;
      // Inner glittering pistachio core
      const coreStars = low ? 35 : 65;
      for (let i = 0; i < coreStars; i += 1) {
        const tNorm = (i + 0.5) / coreStars;
        const phi = Math.acos(1 - 2 * tNorm);
        const theta = goldenAngle * i;
        const speed = 7.2 + Math.random() * 2.4;
        this._colorA.setHex(0xfef08a);
        this._colorB.setHex(pal[0]);
        this.spawnFireworkParticle({
          x: sx,
          y: sy,
          z: sz,
          vx: Math.sin(phi) * Math.cos(theta) * speed,
          vy: Math.cos(phi) * speed + 1.0,
          vz: Math.sin(phi) * Math.sin(theta) * speed,
          r: this._colorA.r,
          g: this._colorA.g,
          b: this._colorA.b,
          r2: this._colorB.r,
          g2: this._colorB.g,
          b2: this._colorB.b,
          size: 1.15,
          stretch: 1.35,
          spriteMode: 1,
          hdrBoost: 1.85,
          drag: 0.26,
          gravity: 3.6,
          burstType: 'peony_core',
          maxLife: 1.35,
        });
      }
      // 8 outer sub-shells that fly outward for 0.52s and each burst into a crisp miniature peony!
      for (let k = 0; k < subCount; k += 1) {
        const ang = (k / subCount) * Math.PI * 2;
        const elev = (k % 2 === 0 ? 0.35 : -0.22);
        const speed = 15.5 + Math.random() * 2.5;
        const subPal = FIREWORK_PALETTES[(k + 1) % FIREWORK_PALETTES.length];
        this._colorA.setHex(subPal[0]);
        this.spawnFireworkParticle({
          x: sx,
          y: sy,
          z: sz,
          vx: Math.cos(ang) * Math.cos(elev) * speed,
          vy: Math.sin(elev) * speed + 3.2,
          vz: Math.sin(ang) * Math.cos(elev) * speed,
          r: this._colorA.r,
          g: this._colorA.g,
          b: this._colorA.b,
          r2: 1.0,
          g2: 0.98,
          b2: 0.9,
          size: 1.8,
          stretch: 2.2,
          spriteMode: 1,
          hdrBoost: 2.1,
          drag: 0.45,
          gravity: 4.5,
          burstType: 'sub_shell_carrier',
          secondaryTimer: 0.5 + k * 0.025,
          trailTimer: 0.035,
          subColorHex: subPal[0],
          maxLife: 0.72 + k * 0.025,
        });
      }
      return;
    }

    // ── EFFECT #10: DRAGON-EGG CRACKLING FINALE SALUTE (delayed gold micro-sparks -> white-hot popcorn crackle + sub-bass flash) ──
    const eggCount = low ? 75 : 130 + Math.floor(Math.random() * 30);
    for (let i = 0; i < eggCount; i += 1) {
      const tNorm = (i + 0.5) / eggCount;
      const phi = Math.acos(1 - 2 * tNorm) + (Math.random() - 0.5) * 0.14;
      const theta = goldenAngle * i + (Math.random() - 0.5) * 0.2;
      const speed = 11.0 + Math.random() * 9.5;
      this._colorA.setHex(0xfde047);
      this._colorB.setHex(0xd97706);
      this.spawnFireworkParticle({
        x: sx,
        y: sy,
        z: sz,
        vx: Math.sin(phi) * Math.cos(theta) * speed,
        vy: Math.cos(phi) * speed + 1.6,
        vz: Math.sin(phi) * Math.sin(theta) * speed,
        r0: 1.0,
        g0: 0.99,
        b0: 0.92,
        r: this._colorA.r,
        g: this._colorA.g,
        b: this._colorA.b,
        r2: this._colorB.r,
        g2: this._colorB.g,
        b2: this._colorB.b,
        size: 1.15,
        stretch: 2.0,
        spriteMode: 0,
        hdrBoost: 1.85,
        drag: 0.34,
        gravity: 5.2,
        burstType: 'dragon_egg',
        secondaryTimer: 0.38 + Math.random() * 0.36, // staggered delayed popcorn crackle!
        maxLife: 1.05,
      });
    }
  }

  setEncoreFinale(active, grade = 'A') {
    this.encoreFinaleActive = Boolean(active);
    this.encoreGrade = grade || 'A';
    this.finaleFireworkTimer = 0.08;
    this.finaleConfettiTimer = 0.15;

    if (this.encoreFinaleActive) {
      this.triggerStagePyro(grade === 'S' ? 1.55 : 1.25);
      this.launchStageTrussMines(1.35);
      if (grade === 'S' || grade === 'A' || this.encorePerformanceActive) {
        this.triggerConfettiBurst();
      }
      // Engrande 4-Tier Opening Salvo: Tier 4 Kamuro + Strobe Peony layered over Tier 3 Heart + Girandola & Tier 2 11-Pod Sweep!
      this.launchFireworkShell(true, 'kamuro_willow', 4);
      this.launchFireworkShell(true, 'peony_strobe', 4);
      this.launchFireworkShell(true, 'heart_3d', 3);
      this.launchRomanCandleSalvo('patriot', 8, 11, 'CENTER_OUT_V');
      this.launchGirandolaWheel(0, -18);
    }
  }

  resize() {
    if (this.disposed) return;
    const parent = this.canvas.parentElement;
    const w = Math.max(320, parent ? parent.clientWidth : window.innerWidth);
    const h = Math.max(240, parent ? parent.clientHeight : window.innerHeight);

    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  /**
   * Delegates concert framing to the Neversoft-style Rule-Based CameraDirector:
   *  - Beat-synced cuts every 8 or 16 bars on downbeats
   *  - Active musician close-ups on 25x+ streaks (and avoids silent/gated musicians!)
   *  - Sweeping cranes & behind-band reverse crowd views during Fever / Final Encore
   */
  updateCamera(dt, stageState, telemetry) {
    const marks = this.getLineupMarks();
    // Feed actual live animated world positions so GUITAR_HERO_LOW_ANGLE & BASS_POCKET_DOLLY track roaming & jumps!
    if (this.guitarist) {
      this.livePositions.guitar.x = this.guitarist.root.position.x;
      this.livePositions.guitar.y = this.guitarist.root.position.y;
      this.livePositions.guitar.z = this.guitarist.root.position.z;
    }
    if (this.bassist) {
      this.livePositions.bass.x = this.bassist.root.position.x;
      this.livePositions.bass.y = this.bassist.root.position.y;
      this.livePositions.bass.z = this.bassist.root.position.z;
    }
    if (this.drummer) {
      this.livePositions.drums.x = this.drummer.root.position.x;
      this.livePositions.drums.y = this.drummer.root.position.y;
      this.livePositions.drums.z = this.drummer.root.position.z;
    }
    if (this.pianoRigGroup) {
      this.livePositions.piano.x = this.pianoRigGroup.position.x;
      this.livePositions.piano.y = this.pianoRigGroup.position.y;
      this.livePositions.piano.z = this.pianoRigGroup.position.z;
    }
    if (this.vocalist) {
      this.livePositions.vocals.x = this.vocalist.root.position.x;
      this.livePositions.vocals.y = this.vocalist.root.position.y;
      this.livePositions.vocals.z = this.vocalist.root.position.z;
    }

    const te = stageState?.transientEnergy;
    const isGrandEncoreCam = Boolean(
      stageState?.isEncoreActive || this.grandEncoreActive || this.encoreFinaleActive
    );
    this.cameraDirector.update(this.camera, dt, {
      clock: this.clock,
      playing: Boolean(stageState?.playing),
      songTime: stageState?.songTime ?? this.clock,
      bpm: Math.max(70, Math.min(200, stageState?.bpm || 120)),
      combo: stageState?.combo || 0,
      fever: Boolean(stageState?.feverActive),
      encore: Boolean(stageState?.isEncore || this.encorePerformanceActive),
      isEncoreActive: isGrandEncoreCam,
      encoreFinaleActive: this.encoreFinaleActive,
      stemDropped: Boolean(stageState?.stemDropped),
      activeInstrument: stageState?.instrument || this.activeInstrument,
      activeInstruments: stageState?.activeInstruments || this.activeInstruments,
      overallEnergy: telemetry?.overallEnergy || 0,
      bassEnergy: telemetry?.bassEnergy || 0,
      drumEnergy: telemetry?.drumEnergy || 0,
      kickTransient: telemetry?.kickTransient || 0,
      snareTransient: telemetry?.snareTransient || 0,
      kickImpulse: te?.kickImpulse ?? telemetry?.kickTransient ?? 0,
      snareImpulse: te?.snareImpulse ?? telemetry?.snareTransient ?? 0,
      guitarRiffEnergy: te?.guitarRiffEnergy ?? telemetry?.guitarEnergy ?? 0,
      stemActivity: stageState?.stemActivity || { drums: true, bass: true, guitar: true, piano: true },
      lineupPositions: {
        guitar: marks.guitar,
        bass: marks.bass,
        piano: marks.piano,
        vocalist: marks.vocals,
        drums: marks.drums || { x: 0, y: DRUM_RISER_TOP_Y, z: -2.8 },
      },
      livePositions: this.livePositions,
      hasVocalist: Boolean(marks.vocals?.visible),
      currentSection: stageState?.currentSection || null,
      beatGrid: stageState?.beatGrid || null,
      currentTick: stageState?.currentTick,
      beatIndex: stageState?.beatIndex,
      beatPhase: stageState?.beatPhase,
      isDownbeat: Boolean(stageState?.isDownbeat || te?.isDownbeat),
      isPhraseBoundary: Boolean(stageState?.isPhraseBoundary || te?.isPhraseBoundary),
      fireworksGrandActive: Boolean(
        isGrandEncoreCam || this.fwShells.length >= 3 || (this.fireworkFlashState?.intensity || 0) > 0.35
      ),
      crowdEventType: this.crowdEvent?.type || 'NORMAL',
      crowdEventCenter: { x: this.crowdEvent?.centerX || 0, z: this.crowdEvent?.centerZ || 14.8 },
      trackMeta: this.lastTrackMeta,
    });
  }

  /**
   * Advances pyromusical mortar launches, beat-locked Roman Candles, Girandola UFO wheels,
   * all 10 multi-stage firework physics types, illuminated volumetric smoke plumes,
   * pooled sky-flash PointLights, and indoor roof retraction for Grand Encore.
   */
  updateFireworks(dt, t, stageState) {
    const playing = Boolean(stageState?.playing);
    const fever = Boolean(stageState?.feverActive);
    const encore = Boolean(stageState?.isEncore || this.encorePerformanceActive);
    const isGrandEncore = Boolean(stageState?.isEncoreActive || this.grandEncoreActive || this.encoreFinaleActive);
    const combo = stageState?.combo || 0;
    const bpm = Math.max(60, Math.min(220, stageState?.bpm || 120));
    const songTime = Number.isFinite(stageState?.songTime) ? stageState.songTime : t;
    const beatPos = playing ? songTime * (bpm / 60) : t * (bpm / 60);
    const subdiv8 = Math.floor(beatPos * 2);
    const subdiv16 = Math.floor(beatPos * 4);
    const beatIdx = Math.floor(beatPos);
    const newSubdiv8 = subdiv8 !== this._lastFwSubdiv8;
    const newSubdiv16 = subdiv16 !== this._lastFwSubdiv16;
    const newBeat = beatIdx !== this._lastFwBeatIdx;
    this._lastFwSubdiv8 = subdiv8;
    this._lastFwSubdiv16 = subdiv16;
    this._lastFwBeatIdx = beatIdx;

    // Sync camera aspect & projection scale into custom velocity-streak & smoke shaders
    const camAspect = this.camera?.aspect || 16 / 9;
    const camProjScale = 1 / Math.tan(THREE.MathUtils.degToRad((this.camera?.fov || 46) * 0.5));
    if (this.fwStreakUniforms) {
      this.fwStreakUniforms.uAspect.value = camAspect;
      this.fwStreakUniforms.uProjScale.value = camProjScale;
    }
    if (this.fwSmokeUniforms) {
      this.fwSmokeUniforms.uAspect.value = camAspect;
      this.fwSmokeUniforms.uProjScale.value = camProjScale;
    }

    // A. Engrande 4-Tier Musical & Pyromusical Choreography (Chorus Downbeats, Phrase Sweeps, Fever, Final 16-Bar Grand Encore)
    const te = stageState?.transientEnergy;
    const isDownbeat = Boolean(stageState?.isDownbeat || te?.isDownbeat);
    const isPhraseBoundary = Boolean(stageState?.isPhraseBoundary || te?.isPhraseBoundary);
    const barIndex = Math.floor(beatIdx / 4);
    const isChorusOrPeak =
      this.lightingState?.sectionType === 'CHORUS' ||
      this.lightingState?.sectionType === 'OUTRO' ||
      fever ||
      encore ||
      isGrandEncore;
    const songDuration = Number(stageState?.songDuration || this.lastTrackMeta?.duration || 0);
    const isFinal16Bars =
      isGrandEncore ||
      (encore && songDuration > 24 && songTime >= Math.max(0, songDuration - (16 * 4 * 60) / bpm));

    if (this.lightingState?.chorusDropTriggered && playing) {
      // Chorus drop ignites Tier 1 + Tier 2 + Tier 3 + Tier 4 simultaneously!
      this.triggerStagePyro(1.35);
      this.launchStageTrussMines(1.35);
      this.launchRomanCandleSalvo(fever ? 'cyber' : 'patriot', 8, 11);
      this.launchFireworkShell(true, 'double_ring_saturn', 3);
      this.launchFireworkShell(true, 'chrysanthemum', 4);
      this._lastChorusDownbeatBar = barIndex;
    } else if (playing && isChorusOrPeak && isDownbeat && barIndex !== this._lastChorusDownbeatBar) {
      // Tier 1 Stage-Lip & Catwalk V-Flames, Cold-Sparks & Truss Silver Mines on every Chorus Downbeat
      this._lastChorusDownbeatBar = barIndex;
      this.launchStageTrussMines(isGrandEncore ? 1.25 : 1.0);
      this.pyroFlameIntensity = Math.max(this.pyroFlameIntensity, isGrandEncore ? 1.15 : 0.85);
      this.pyroFlameTimer = Math.max(this.pyroFlameTimer, 0.72);
      if (isPhraseBoundary && this.fwRomanQueue.length === 0) {
        this.launchRomanCandleSalvo(fever ? 'cyber' : 'patriot', isFinal16Bars ? 16 : 8, 11);
      }
    } else if (this.lightingState?.pyroDownbeatAccent && newBeat) {
      this.launchStageTrussMines(0.95);
    }

    if (isFinal16Bars) {
      // Engrande Pyromusical Finale: Layer Tier-4 Kamuro Willows over Silver/Magenta Strobe Peonies, Tier-3 Shaped Shells,
      // Tier-2 1/16-note 11-Pod Roman Candle Sweeps, and Dragon-Egg Crackling Finale Barrages!
      this.finaleFireworkTimer -= dt;
      if (this.finaleFireworkTimer <= 0) {
        const roll = Math.random();
        if (roll < 0.34) {
          // Layered Mega-Canopy Pair: 24m Gold Kamuro Willow + Silver/Magenta Strobe Peony!
          this.launchFireworkShell(true, 'kamuro_willow', 4);
          this.launchFireworkShell(true, 'peony_strobe', 4);
        } else if (roll < 0.62) {
          // Mid-sky Tier-3 Shaped Shell + High-altitude Dragon-Egg Crackling Barrage!
          this.launchFireworkShell(true, null, 3);
          this.launchFireworkShell(true, 'dragon_egg_salute', 4);
        } else {
          this.launchFireworkShell(true, null, 3);
          this.launchFireworkShell(true, 'chrysanthemum', 4);
        }
        if (Math.random() < 0.28) {
          this.launchGirandolaWheel();
        }
        if (this.fwRomanQueue.length === 0) {
          this.launchRomanCandleSalvo(
            Math.random() < 0.45 ? 'gold' : Math.random() < 0.5 ? 'patriot' : 'cyber',
            Math.random() < 0.55 ? 16 : 8,
            11
          );
        }
        this.finaleFireworkTimer = 0.48 + Math.random() * 0.34;
      }
    } else if (playing && (fever || (encore && combo >= 15))) {
      this.feverFireworkTimer -= dt;
      if (this.feverFireworkTimer <= 0) {
        this.launchFireworkShell(encore, null, Math.random() < 0.5 ? 3 : 4);
        if (fever && Math.random() < 0.4 && this.fwRomanQueue.length === 0) {
          this.launchRomanCandleSalvo('cyber', 8, 11);
        }
        this.feverFireworkTimer = fever ? 0.88 : 1.45;
      }
    }

    // A2. Drain Beat-Locked Roman Candle Queue on exact 1/8-note and 1/16-note musical subdivisions!
    if (this.fwRomanQueue.length > 0) {
      const nextShot = this.fwRomanQueue[0];
      const fireNow = nextShot.subdiv === 16 ? newSubdiv16 : newSubdiv8;
      if (fireNow) {
        this.fwRomanQueue.shift();
        this._colorA.setHex(nextShot.colorHex);
        this._colorB.setHex(nextShot.colorHex).lerp(this._colorC.setHex(0xffffff), 0.35);
        for (let tb = 0; tb < nextShot.tubes.length; tb += 1) {
          const tube = nextShot.tubes[tb];
          const speed = 26 + Math.random() * 5;
          this.spawnFireworkParticle({
            x: tube.x,
            y: tube.y,
            z: tube.z,
            vx: tube.aimX * speed + (Math.random() - 0.5) * 1.4,
            vy: speed * 0.94,
            vz: -1.8 + (Math.random() - 0.5) * 1.5,
            r0: 1.0,
            g0: 0.99,
            b0: 0.96,
            r: this._colorA.r,
            g: this._colorA.g,
            b: this._colorA.b,
            r2: this._colorB.r,
            g2: this._colorB.g,
            b2: this._colorB.b,
            size: 1.65,
            stretch: 2.3,
            spriteMode: 1,
            hdrBoost: 2.15,
            drag: 0.62,
            gravity: 11.2,
            burstType: 'roman_pearl',
            trailTimer: 0.018,
            maxLife: 1.45,
          });
        }
        this.registerFireworkFlash(0, 22, -17, nextShot.colorHex, 105);
      }
    }

    // A3. Advance Ground-Launched Girandola Spinning UFO Wheels -> Silver Crown Burst
    for (let g = this.fwGirandolas.length - 1; g >= 0; g -= 1) {
      const wheel = this.fwGirandolas[g];
      wheel.life += dt;
      wheel.y += wheel.vy * dt;
      wheel.vy = Math.max(4.5, wheel.vy - 3.6 * dt);
      wheel.angle += wheel.spinSpeed * dt;
      wheel.emitAccum += dt;

      while (wheel.emitAccum >= 0.016) {
        wheel.emitAccum -= 0.016;
        // Emit two opposing tangential golden rocket jets around the horizontal spinning wheel
        for (let side = 0; side < 2; side += 1) {
          const ang = wheel.angle + side * Math.PI;
          const ox = Math.cos(ang) * wheel.radius;
          const oz = Math.sin(ang) * wheel.radius;
          const tx = -Math.sin(ang);
          const tz = Math.cos(ang);
          this._colorA.setHex(0xfef08a);
          this._colorB.setHex(0xd97706);
          this.spawnFireworkParticle({
            x: wheel.x + ox,
            y: wheel.y,
            z: wheel.z + oz,
            vx: tx * 11.5 + ox * 1.2,
            vy: -1.8 + (Math.random() - 0.5) * 0.8,
            vz: tz * 11.5 + oz * 1.2,
            r0: 1.0,
            g0: 0.98,
            b0: 0.9,
            r: this._colorA.r,
            g: this._colorA.g,
            b: this._colorA.b,
            r2: this._colorB.r,
            g2: this._colorB.g,
            b2: this._colorB.b,
            size: 1.05,
            stretch: 2.6,
            spriteMode: 0,
            hdrBoost: 1.85,
            drag: 0.42,
            gravity: 3.4,
            burstType: 'girandola_jet',
            maxLife: 0.42,
          });
        }
      }

      if (wheel.y >= wheel.apexY || wheel.life >= wheel.maxLife) {
        // Detonate Girandola into a brilliant glittering Silver Crown!
        this.registerFireworkFlash(wheel.x, wheel.y, wheel.z, 0xe0f2fe, 195);
        this.spawnFireworkSmoke(wheel.x, wheel.y, wheel.z, 5, 0, 0.95);
        if (typeof this.onFireworkBurst === 'function') {
          this.onFireworkBurst(Math.max(-0.85, Math.min(0.85, wheel.x / 20)));
        }
        const crownCount = this.adaptiveLowPower ? 52 : 92;
        const goldenAngle = Math.PI * (1 + Math.sqrt(5));
        for (let k = 0; k < crownCount; k += 1) {
          const tNorm = (k + 0.5) / crownCount;
          const phi = Math.acos(1 - 2 * tNorm);
          const theta = goldenAngle * k;
          const speed = 12.5 + Math.random() * 4.5;
          this.spawnFireworkParticle({
            x: wheel.x,
            y: wheel.y,
            z: wheel.z,
            vx: Math.sin(phi) * Math.cos(theta) * speed,
            vy: Math.cos(phi) * speed + 2.0,
            vz: Math.sin(phi) * Math.sin(theta) * speed,
            r0: 1.0,
            g0: 1.0,
            b0: 1.0,
            r: 0.92,
            g: 0.97,
            b: 1.0,
            r2: 0.56,
            g2: 0.78,
            b2: 1.0,
            size: 1.28,
            stretch: 1.9,
            spriteMode: 1,
            hdrBoost: 2.0,
            drag: 0.28,
            gravity: 4.8,
            burstType: 'silver_crown',
            strobeTail: true,
            maxLife: 1.7 + Math.random() * 0.4,
          });
        }
        this.fwGirandolas.splice(g, 1);
      }
    }

    // B. Advance rising whistling mortar shells with wind-drift curve & glowing comet tail
    for (let i = this.fwShells.length - 1; i >= 0; i -= 1) {
      const sh = this.fwShells[i];
      sh.flightAge += dt;
      sh.vx += (sh.ax || 0) * dt;
      sh.x += sh.vx * dt;
      sh.y += sh.vy * dt;
      sh.z += (sh.vz || 0) * dt;
      sh.vy -= (sh.gravity || 6.4) * dt;
      sh.trailAccum += dt;

      if (sh.trailAccum >= 0.014) {
        sh.trailAccum = 0;
        this.spawnFireworkParticle({
          x: sh.x + (Math.random() - 0.5) * 0.16,
          y: sh.y,
          z: sh.z + (Math.random() - 0.5) * 0.16,
          vx: sh.vx * 0.15 + (Math.random() - 0.5) * 0.9,
          vy: sh.vy * 0.12 - 2.2 - Math.random() * 1.1,
          vz: sh.vz * 0.15 + (Math.random() - 0.5) * 0.9,
          r0: 1.0,
          g0: 0.99,
          b0: 0.9,
          r: 1.0,
          g: 0.86,
          b: 0.44,
          r2: 0.95,
          g2: 0.34,
          b2: 0.06,
          size: 0.92,
          stretch: 2.4,
          spriteMode: 0,
          hdrBoost: 1.7,
          drag: 0.34,
          gravity: 5.5,
          burstType: 'comet_tail',
          maxLife: 0.42,
        });
      }

      if (sh.y >= sh.apexY || sh.flightAge >= sh.flightSec || sh.vy <= 1.2) {
        this.detonateFireworkShell(sh);
        this.fwShells.splice(i, 1);
      }
    }

    // C. Decay 6 pooled sky/rim PointLights, populate illuminated smoke flash uniforms & multi-color Stadium Bowl wash!
    let totalFlashWeight = 0;
    let aggR = 0;
    let aggG = 0;
    let aggB = 0;
    let secWeight = 0;
    let secR = 0;
    let secG = 0;
    let secB = 0;
    let peakNorm = 0;
    if (this.fwBurstLights?.length) {
      for (let l = 0; l < this.fwBurstLights.length; l += 1) {
        const pl = this.fwBurstLights[l];
        if (pl.intensity > 0.08) {
          pl.intensity = THREE.MathUtils.damp(pl.intensity, 0, 4.6, dt);
        } else if (pl.intensity > 0) {
          pl.intensity = 0;
        }
        const norm = Math.min(1.6, pl.intensity / 155);
        this.fwFlashUniformPos[l].copy(pl.position);
        this.fwFlashUniformCol[l].set(pl.color.r * norm * 1.55, pl.color.g * norm * 1.55, pl.color.b * norm * 1.55);
        if (norm > 0.01) {
          totalFlashWeight += norm;
          aggR += pl.color.r * norm;
          aggG += pl.color.g * norm;
          aggB += pl.color.b * norm;
          if (l % 2 === 1) {
            secWeight += norm;
            secR += pl.color.r * norm;
            secG += pl.color.g * norm;
            secB += pl.color.b * norm;
          }
          if (norm > peakNorm) peakNorm = norm;
        }
      }
    }
    this._fwSubBassFlashDecay = THREE.MathUtils.damp(this._fwSubBassFlashDecay, 0, 8.5, dt);
    if (totalFlashWeight > 0.01) {
      this._fwFlashAggColor.setRGB(
        Math.min(1, aggR / totalFlashWeight),
        Math.min(1, aggG / totalFlashWeight),
        Math.min(1, aggB / totalFlashWeight)
      );
      this.fireworkFlashState.color.copy(this._fwFlashAggColor);
      if (secWeight > 0.01) {
        this._fwFlashSecondColor.setRGB(
          Math.min(1, secR / secWeight),
          Math.min(1, secG / secWeight),
          Math.min(1, secB / secWeight)
        );
        this.fireworkFlashState.secondaryColor.copy(this._fwFlashSecondColor);
      } else {
        this.fireworkFlashState.secondaryColor.copy(this._fwFlashAggColor);
      }
      this.fireworkFlashState.intensity = Math.min(1.65, peakNorm + totalFlashWeight * 0.28);
      this.fireworkFlashState.skyBloom = Math.min(1.35, totalFlashWeight * 0.58);
    } else {
      this.fireworkFlashState.intensity = 0;
      this.fireworkFlashState.skyBloom = 0;
    }
    this.fireworkFlashState.subBassFlash = this._fwSubBassFlashDecay;

    // D. Retract & hide Indoor Arena Roofs cleanly during Grand Encore / BRE so open starry sky is unobstructed
    const roofs = this.venueEnv?.dynamicElements?.retractableRoofMeshes;
    if (roofs?.length) {
      const roofOpen = Boolean(
        isGrandEncore || this.breActive || (this.encorePerformanceActive && playing)
      );
      for (let r = 0; r < roofs.length; r += 1) {
        const mesh = roofs[r];
        const baseX = mesh.userData?.baseX ?? mesh.position.x;
        const baseY = mesh.userData?.baseY ?? mesh.position.y;
        const baseZ = mesh.userData?.baseZ ?? mesh.position.z;
        const slideX = mesh.userData?.slideDirX ?? 0;
        const slideZ = mesh.userData?.slideDirZ ?? 0;
        const offsetY = mesh.userData?.openOffsetY ?? 24;
        mesh.position.x = THREE.MathUtils.damp(mesh.position.x, roofOpen ? baseX + slideX : baseX, 3.8, dt);
        mesh.position.y = THREE.MathUtils.damp(mesh.position.y, roofOpen ? baseY + offsetY : baseY, 4.2, dt);
        mesh.position.z = THREE.MathUtils.damp(mesh.position.z, roofOpen ? baseZ + slideZ : baseZ, 3.8, dt);
        const hasSlide = Math.abs(slideX) > 1 || Math.abs(slideZ) > 1;
        mesh.visible =
          !roofOpen ||
          (hasSlide
            ? Math.abs(mesh.position.y - baseY) < offsetY * 0.92
            : mesh.position.y < baseY + offsetY * 0.45);
      }
    }

    // D2. Advance pooled illuminated volumetric smoke clouds (zero GC)
    if (this.fwSmokePoints) {
      let smokeDirty = false;
      for (let s = 0; s < this.fwSmokeCount; s += 1) {
        const sm = this.fwSmokeParticles[s];
        const s3 = s * 3;
        const s4 = s * 4;
        if (!sm.active) {
          if (this.fwSmokeMeta[s4 + 1] > 0) {
            this.fwSmokePositions[s3 + 1] = -90;
            this.fwSmokeMeta[s4 + 1] = 0;
            smokeDirty = true;
          }
          continue;
        }
        sm.life += dt;
        if (sm.life >= sm.maxLife) {
          sm.active = false;
          this.fwSmokePositions[s3 + 1] = -90;
          this.fwSmokeMeta[s4 + 1] = 0;
          smokeDirty = true;
          continue;
        }
        const dragSmoke = Math.pow(0.68, dt);
        sm.vx *= dragSmoke;
        sm.vz *= dragSmoke;
        sm.x += sm.vx * dt;
        sm.y += sm.vy * dt;
        sm.z += sm.vz * dt;
        sm.size += sm.growRate * dt;
        sm.rot += sm.vRot * dt;

        const progress = sm.life / sm.maxLife;
        const fadeIn = Math.min(1, progress * 5.0);
        const fadeOut = Math.pow(Math.max(0, 1 - progress), 1.45);
        this.fwSmokePositions[s3] = sm.x;
        this.fwSmokePositions[s3 + 1] = sm.y;
        this.fwSmokePositions[s3 + 2] = sm.z;
        this.fwSmokeMeta[s4] = sm.size;
        this.fwSmokeMeta[s4 + 1] = sm.baseAlpha * fadeIn * fadeOut;
        this.fwSmokeMeta[s4 + 2] = sm.rot;
        this.fwSmokeMeta[s4 + 3] = sm.baseGrey;
        smokeDirty = true;
      }
      if (smokeDirty) {
        this.fwSmokePoints.geometry.attributes.aPos.needsUpdate = true;
        this.fwSmokePoints.geometry.attributes.aMeta.needsUpdate = true;
      }
    }

    // E. Integrate all 5,600 active velocity-stretched firework particles (zero runtime heap allocations)
    if (!this.hasActiveFireworks && this.fwShells.length === 0 && this.fwGirandolas.length === 0) return;

    let anyFwUpdated = false;
    let stillActive = false;
    const vFwd = this._fwScratchVecA;
    const vU = this._fwScratchVecB;
    const vV = this._fwScratchVecC;

    for (let i = 0; i < this.fwParticleCount; i += 1) {
      const p = this.fwParticles[i];
      const idx3 = i * 3;
      const idx4 = i * 4;
      if (!p.active) {
        if (this.fwMeta[idx4 + 1] > 0) {
          this.fwPositions[idx3 + 1] = -80;
          this.fwMeta[idx4 + 1] = 0;
          anyFwUpdated = true;
        }
        continue;
      }
      anyFwUpdated = true;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        this.fwPositions[idx3 + 1] = -80;
        this.fwMeta[idx4 + 1] = 0;
        continue;
      }
      stillActive = true;

      // Multi-stage mid-air splits (Crossette 4-way orthogonal cross, Shell-of-Shells mini-peony, Dragon-Egg popcorn crackle, Tourbillon pop)
      if (p.secondaryTimer > 0 && p.life >= p.secondaryTimer) {
        p.secondaryTimer = 0;

        if (p.burstType === 'crossette') {
          // True perpendicular 4-way cross split via orthonormal basis (u, v) orthogonal to velocity!
          vFwd.set(p.vx, p.vy, p.vz);
          if (vFwd.lengthSq() < 0.01) vFwd.set(0, 1, 0);
          else vFwd.normalize();
          if (Math.abs(vFwd.y) < 0.9) vU.set(0, 1, 0).cross(vFwd).normalize();
          else vU.set(1, 0, 0).cross(vFwd).normalize();
          vV.copy(vFwd).cross(vU).normalize();

          this._colorA.setHex(p.subColorHex || 0xfacc15);
          const splitSpeed = 8.4;
          for (let k = 0; k < 4; k += 1) {
            const sign = k < 2 ? (k === 0 ? 1 : -1) : (k === 2 ? 1 : -1);
            const axis = k < 2 ? vU : vV;
            this.spawnFireworkParticle({
              x: p.x,
              y: p.y,
              z: p.z,
              vx: p.vx * 0.25 + axis.x * sign * splitSpeed,
              vy: p.vy * 0.25 + axis.y * sign * splitSpeed,
              vz: p.vz * 0.25 + axis.z * sign * splitSpeed,
              r0: 1.0,
              g0: 0.99,
              b0: 0.94,
              r: this._colorA.r,
              g: this._colorA.g,
              b: this._colorA.b,
              r2: p.r2,
              g2: p.g2,
              b2: p.b2,
              size: 1.12,
              stretch: 2.25,
              spriteMode: 1,
              hdrBoost: 1.9,
              drag: 0.24,
              gravity: 4.5,
              burstType: 'crossette_sub',
              maxLife: 0.62 + Math.random() * 0.22,
            });
          }
          // Crisp crackle flash at cross split center
          p.vx *= 0.15;
          p.vy *= 0.15;
          p.vz *= 0.15;
          p.spriteMode = 2;
          p.size = 2.4;
          p.stretch = 0;
          p.hdrBoost = 2.5;
          p.life = p.maxLife - 0.14;
        } else if (p.burstType === 'sub_shell_carrier') {
          // Shell-of-Shells synchronized miniature peony sub-detonation!
          const subStars = this.adaptiveLowPower ? 14 : 26;
          const ga = Math.PI * (1 + Math.sqrt(5));
          this._colorA.setHex(p.subColorHex || 0x38bdf8);
          for (let k = 0; k < subStars; k += 1) {
            const tn = (k + 0.5) / subStars;
            const phi = Math.acos(1 - 2 * tn);
            const th = ga * k;
            const spd = 6.2 + Math.random() * 2.2;
            this.spawnFireworkParticle({
              x: p.x,
              y: p.y,
              z: p.z,
              vx: p.vx * 0.18 + Math.sin(phi) * Math.cos(th) * spd,
              vy: p.vy * 0.18 + Math.cos(phi) * spd,
              vz: p.vz * 0.18 + Math.sin(phi) * Math.sin(th) * spd,
              r0: 1.0,
              g0: 0.98,
              b0: 0.92,
              r: this._colorA.r,
              g: this._colorA.g,
              b: this._colorA.b,
              r2: 1.0,
              g2: 0.95,
              b2: 0.78,
              size: 1.15,
              stretch: 1.35,
              spriteMode: 1,
              hdrBoost: 1.95,
              drag: 0.22,
              gravity: 3.6,
              burstType: 'peony_sub',
              strobeTail: true,
              maxLife: 0.95 + Math.random() * 0.3,
            });
          }
          this.registerFireworkFlash(p.x, p.y, p.z, p.subColorHex || 0x38bdf8, 95);
          p.active = false;
          this.fwPositions[idx3 + 1] = -80;
          this.fwMeta[idx4 + 1] = 0;
          continue;
        } else if (p.burstType === 'dragon_egg') {
          // Dragon-Egg delayed white-hot popcorn strobe crackle burst!
          const crackles = this.adaptiveLowPower ? 2 : 3;
          for (let k = 0; k < crackles; k += 1) {
            const ang = Math.random() * Math.PI * 2;
            const elev = (Math.random() - 0.5) * Math.PI;
            const spd = 3.8 + Math.random() * 4.8;
            this.spawnFireworkParticle({
              x: p.x + (Math.random() - 0.5) * 0.6,
              y: p.y + (Math.random() - 0.5) * 0.6,
              z: p.z + (Math.random() - 0.5) * 0.6,
              vx: Math.cos(ang) * Math.cos(elev) * spd,
              vy: Math.sin(elev) * spd,
              vz: Math.sin(ang) * Math.cos(elev) * spd,
              r0: 1.0,
              g0: 1.0,
              b0: 0.98,
              r: 1.0,
              g: 0.98,
              b: 0.9,
              r2: 1.0,
              g2: 0.8,
              b2: 0.35,
              size: 1.85 + Math.random() * 0.7,
              stretch: 0.4,
              spriteMode: 2,
              hdrBoost: 2.65,
              drag: 0.16,
              gravity: 3.2,
              burstType: 'crackle_pop',
              maxLife: 0.2 + Math.random() * 0.18,
            });
          }
          p.active = false;
          this.fwPositions[idx3 + 1] = -80;
          this.fwMeta[idx4 + 1] = 0;
          continue;
        } else if (p.burstType === 'tourbillon') {
          // Neon pop at the end of a Tourbillon serpent spiral!
          this._colorA.setHex(p.subColorHex || 0xe879f9);
          for (let k = 0; k < 4; k += 1) {
            const ang = (k / 4) * Math.PI * 2 + Math.random();
            this.spawnFireworkParticle({
              x: p.x,
              y: p.y,
              z: p.z,
              vx: Math.cos(ang) * 5.2,
              vy: (Math.random() - 0.3) * 5.2,
              vz: Math.sin(ang) * 5.2,
              r: this._colorA.r,
              g: this._colorA.g,
              b: this._colorA.b,
              r2: 1.0,
              g2: 1.0,
              b2: 1.0,
              size: 1.5,
              stretch: 0.6,
              spriteMode: 2,
              hdrBoost: 2.3,
              drag: 0.2,
              gravity: 3.0,
              burstType: 'crackle_pop',
              maxLife: 0.28,
            });
          }
        }
      }

      // Helical self-propelled Tourbillon vortex serpent acceleration!
      if (p.burstType === 'tourbillon' && p.spinOmega !== 0) {
        p.spinPhase += p.spinOmega * dt;
        const c = Math.cos(p.spinPhase);
        const s = Math.sin(p.spinPhase);
        p.vx += c * p.spinRadius * dt;
        p.vy += s * p.spinRadius * 0.85 * dt;
        p.vz += Math.sin(p.spinPhase * 0.7 + i) * p.spinRadius * 0.75 * dt;
      }

      // Lingering trailing ember sparks for Kamuro/Willow, Chrysanthemum, Roman Pearls & Tourbillon serpents
      if (p.trailTimer > 0) {
        p.trailTimer -= dt;
        if (p.trailTimer <= 0 && p.life < p.maxLife * 0.78) {
          p.trailTimer =
            p.burstType === 'roman_pearl'
              ? 0.022
              : p.burstType === 'tourbillon'
                ? 0.032
                : p.burstType === 'kamuro_willow'
                  ? 0.075
                  : 0.095;
          this.spawnFireworkParticle({
            x: p.x,
            y: p.y,
            z: p.z,
            vx: p.vx * 0.14 + (Math.random() - 0.5) * 0.6,
            vy: p.vy * 0.12 - 0.7,
            vz: p.vz * 0.14 + (Math.random() - 0.5) * 0.6,
            r0: p.r,
            g0: p.g,
            b0: p.b,
            r: p.r,
            g: p.g,
            b: p.b,
            r2: p.r2,
            g2: p.g2,
            b2: p.b2,
            size: p.burstType === 'kamuro_willow' ? 0.85 : 0.72,
            stretch: p.burstType === 'kamuro_willow' ? 2.2 : 1.65,
            spriteMode: 0,
            hdrBoost: 1.25,
            drag: 0.36,
            gravity: p.burstType === 'kamuro_willow' ? 5.8 : 4.2,
            burstType: 'trail_ember',
            maxLife: p.burstType === 'kamuro_willow' ? 0.72 : 0.34,
          });
        }
      }

      const drag = Math.pow(p.drag || 0.24, dt);
      p.vx *= drag;
      p.vz *= drag;
      p.vy = p.vy * drag - (p.gravity || 3.8) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      const progress = p.life / p.maxLife;
      const timeLeft = p.maxLife - p.life;

      // 3-Stage Chemical Burn Color Shift: incandescent white core (0..0.14) -> primary -> deep secondary fade
      let cr;
      let cg;
      let cb;
      if (progress < 0.14) {
        const k = progress / 0.14;
        cr = p.r0 + (p.r - p.r0) * k;
        cg = p.g0 + (p.g - p.g0) * k;
        cb = p.b0 + (p.b - p.b0) * k;
      } else {
        const k = (progress - 0.14) / 0.86;
        cr = p.r + (p.r2 - p.r) * k;
        cg = p.g + (p.g2 - p.g) * k;
        cb = p.b + (p.b2 - p.b) * k;
      }

      let fade = Math.max(0, 1 - Math.pow(progress, p.burstType === 'kamuro_willow' ? 1.55 : 1.32));
      let hdr = p.hdrBoost;
      let curMode = p.spriteMode;

      // Strobe-Tipped Peony / Heart / Star / Crown high-frequency silver/gold twinkle during final 0.6s!
      if (p.strobeTail && timeLeft <= 0.62) {
        const strobeWave = Math.sin(t * 58 + i * 4.1);
        if (strobeWave > 0.25) {
          cr = 1.0;
          cg = 0.98;
          cb = 0.88;
          hdr = 2.4;
          curMode = 2;
          fade = Math.max(fade, 0.72 * (timeLeft / 0.62));
        } else {
          fade *= 0.14;
        }
      } else if (p.burstType === 'crackle_pop') {
        const popFlash = Math.abs(Math.sin(t * 74 + i * 5.3));
        fade *= 0.4 + 0.6 * popFlash;
      } else if (p.burstType === 'kamuro_willow') {
        // Gentle golden charcoal shimmer across 4s willow hang time
        fade *= 0.82 + 0.18 * Math.sin(t * 24 + i * 2.9);
      }

      this.fwPositions[idx3] = p.x;
      this.fwPositions[idx3 + 1] = p.y;
      this.fwPositions[idx3 + 2] = p.z;
      this.fwVelocities[idx3] = p.vx;
      this.fwVelocities[idx3 + 1] = p.vy;
      this.fwVelocities[idx3 + 2] = p.vz;
      this.fwColors[idx3] = cr * hdr;
      this.fwColors[idx3 + 1] = cg * hdr;
      this.fwColors[idx3 + 2] = cb * hdr;
      this.fwMeta[idx4] = p.size * (p.burstType === 'apex_bloom' ? 1 + progress * 1.4 : 0.72 + fade * 0.35);
      this.fwMeta[idx4 + 1] = Math.min(1, fade);
      this.fwMeta[idx4 + 2] = p.stretch;
      this.fwMeta[idx4 + 3] = curMode;
    }

    this.hasActiveFireworks =
      stillActive || this.fwShells.length > 0 || this.fwGirandolas.length > 0 || this.fwRomanQueue.length > 0;
    if (anyFwUpdated) {
      this.fwPoints.geometry.attributes.aPos.needsUpdate = true;
      this.fwPoints.geometry.attributes.aVel.needsUpdate = true;
      this.fwPoints.geometry.attributes.aColor.needsUpdate = true;
      this.fwPoints.geometry.attributes.aMeta.needsUpdate = true;
    }
  }

  updatePyrotechnics(dt, stageState, telemetry) {
    const t = this.clock;
    const playing = Boolean(stageState?.playing);
    const fever = Boolean(stageState?.feverActive);
    const encore = Boolean(stageState?.isEncore || this.encorePerformanceActive);
    const isGrandEncore = Boolean(stageState?.isEncoreActive || this.grandEncoreActive || this.encoreFinaleActive);
    const combo = stageState?.combo || 0;
    const overallE = telemetry?.overallEnergy || 0;

    // A. Continuous celebration confetti during Grand Encore / Finale
    if (isGrandEncore && (this.encoreGrade === 'S' || this.encoreGrade === 'A' || encore || this.grandEncoreActive)) {
      this.finaleConfettiTimer -= dt;
      if (this.finaleConfettiTimer <= 0) {
        this.triggerConfettiBurst();
        this.finaleConfettiTimer = 2.4;
      }
    }

    // B. Stage-Lip & Catwalk Perimeter V-Angled Gold/Crimson Flame Columns (y: 1.5m–9m)
    if (this.pyroFlameTimer > 0) {
      this.pyroFlameTimer = Math.max(0, this.pyroFlameTimer - dt);
      const env = Math.min(1, this.pyroFlameTimer * 2.2) * this.pyroFlameIntensity;
      this.outerFlameMat.opacity = Math.min(0.88, env * 0.76);
      this.innerFlameMat.opacity = Math.min(0.96, env * 0.92);
      this.pyroGlowLight.intensity = env * 44;

      for (let i = 0; i < this.flamePillars.length; i += 1) {
        const fp = this.flamePillars[i];
        fp.group.visible = true;
        const flicker = 0.8 + Math.sin(t * 28 + fp.phase) * 0.24;
        const scaleY = Math.max(0.24, env * flicker * (fp.heightMult || 1.1));
        const scaleXZ = 0.78 + env * 0.36;
        fp.group.scale.set(scaleXZ, scaleY, scaleXZ);
        fp.group.rotation.z = fp.vTilt || 0;
        fp.group.rotation.x = fp.xTilt || 0;
        if (fp.outer) fp.outer.rotation.y = t * 3.2 + fp.phase;
        if (fp.inner) fp.inner.rotation.y = -t * 4.4 + fp.phase;
      }
    } else if (this.pyroGlowLight.intensity > 0.01) {
      this.pyroFlameIntensity = 0;
      this.outerFlameMat.opacity = 0;
      this.innerFlameMat.opacity = 0;
      this.pyroGlowLight.intensity = 0;
      for (let i = 0; i < this.flamePillars.length; i += 1) {
        this.flamePillars[i].group.visible = false;
      }
    }

    // C. Towering 8.5m Stage-Lip & Catwalk/B-Stage Titanium Cold-Spark Fountains (single GPU draw call)
    const continuousFountains = Boolean(
      this.venueEnv?.meta?.continuousIndoorFountains || this.venueOverlayId === 'ROYAL_OPERA'
    );
    if (continuousFountains && (playing || this.encoreFinaleActive)) {
      this.sparkEmitterTimer = Math.max(this.sparkEmitterTimer, 0.25);
    }
    if (this.sparkEmitterTimer > 0) {
      this.sparkEmitterTimer = Math.max(0, this.sparkEmitterTimer - dt);
      const emitPerFrame = Math.min(28, Math.ceil(dt * (continuousFountains ? 115 : 260)));
      const catNozzles = this.catwalkSparkNozzles || [];
      const totalNozzles = this.pyroNozzleXs.length + catNozzles.length;
      for (let e = 0; e < emitPerFrame; e += 1) {
        const slotIdx = Math.floor(Math.random() * totalNozzles);
        let nozzleX = 0;
        let nozzleZ = 5.18;
        let tiltVx = 0;
        if (slotIdx < this.pyroNozzleXs.length) {
          nozzleX = this.pyroNozzleXs[slotIdx];
        } else {
          const cn = catNozzles[slotIdx - this.pyroNozzleXs.length];
          nozzleX = cn.x;
          nozzleZ = cn.z;
          tiltVx = (cn.tiltX || 0) * 6.5;
        }
        const sp = this.sparks[this.sparkCursor];
        this.sparkCursor = (this.sparkCursor + 1) % this.sparkCount;
        const isSilverTitanium = (e + slotIdx) % 3 === 0;
        sp.active = true;
        sp.x = nozzleX + (Math.random() - 0.5) * 0.22;
        sp.y = 0.16;
        sp.z = nozzleZ + (Math.random() - 0.5) * 0.2;
        sp.vx = tiltVx + (Math.random() - 0.5) * 1.45;
        // Peak height v^2 / (2*g) with vy=12.4..14.6 & g=11.6 => towering 6.8m - 9.0m cold-spark fountains!
        sp.vy = 11.8 + Math.random() * 3.4;
        sp.vz = (Math.random() - 0.5) * 1.25;
        sp.r = isSilverTitanium ? 0.98 : 1.0;
        sp.g = isSilverTitanium ? 0.99 : 0.88;
        sp.b = isSilverTitanium ? 1.0 : 0.52;
        sp.size = 0.44 + Math.random() * 0.28;
        sp.life = 0;
        sp.maxLife = 0.78 + Math.random() * 0.42;
      }
    }

    let anySparkUpdated = false;
    for (let i = 0; i < this.sparkCount; i += 1) {
      const sp = this.sparks[i];
      const idx3 = i * 3;
      const idx4 = i * 4;
      if (!sp.active) {
        if (this.sparkMeta[idx4 + 1] > 0) {
          this.sparkPositions[idx3 + 1] = -50;
          this.sparkMeta[idx4 + 1] = 0;
          anySparkUpdated = true;
        }
        continue;
      }
      anySparkUpdated = true;
      sp.life += dt;
      if (sp.life >= sp.maxLife || sp.y < 0.05) {
        sp.active = false;
        this.sparkPositions[idx3 + 1] = -50;
        this.sparkMeta[idx4 + 1] = 0;
        continue;
      }
      const drag = Math.pow(0.55, dt);
      sp.vx *= drag;
      sp.vz *= drag;
      sp.vy -= 11.6 * dt;
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.z += sp.vz * dt;

      const progress = sp.life / sp.maxLife;
      const fade = Math.max(0, 1 - Math.pow(progress, 1.35));
      const sparkle = 0.72 + 0.48 * Math.abs(Math.sin(t * 52 + i * 3.3));
      const hdr = 1.95 * sparkle;
      this.sparkPositions[idx3] = sp.x;
      this.sparkPositions[idx3 + 1] = sp.y;
      this.sparkPositions[idx3 + 2] = sp.z;
      this.sparkVelocities[idx3] = sp.vx;
      this.sparkVelocities[idx3 + 1] = sp.vy;
      this.sparkVelocities[idx3 + 2] = sp.vz;
      this.sparkColors[idx3] = sp.r * hdr;
      this.sparkColors[idx3 + 1] = (sp.g - progress * 0.24) * hdr;
      this.sparkColors[idx3 + 2] = Math.max(0.08, sp.b - progress * 0.35) * hdr;
      this.sparkMeta[idx4] = sp.size * (0.7 + fade * 0.45);
      this.sparkMeta[idx4 + 1] = fade;
      this.sparkMeta[idx4 + 2] = 2.4;
      this.sparkMeta[idx4 + 3] = i % 5 === 0 ? 1 : 0;
    }
    if (anySparkUpdated) {
      this.sparkPoints.geometry.attributes.aPos.needsUpdate = true;
      this.sparkPoints.geometry.attributes.aVel.needsUpdate = true;
      this.sparkPoints.geometry.attributes.aColor.needsUpdate = true;
      this.sparkPoints.geometry.attributes.aMeta.needsUpdate = true;
    }

    // D2. Ballad Floating Light Motes
    if (this.balladDustPoints && this.balladDustMat) {
      const targetDustAlpha = this.lightingState?.isBallad && playing ? 0.56 : 0;
      this.balladDustAlpha = THREE.MathUtils.damp(this.balladDustAlpha, targetDustAlpha, 2.5, dt);
      if (this.balladDustAlpha > 0.015) {
        this.balladDustPoints.visible = true;
        this.balladDustMat.opacity = this.balladDustAlpha;
        for (let i = 0; i < this.balladDustCount; i += 1) {
          const s = this.balladDustSeeds[i];
          const rise = ((t * s.speed + s.phase) % 6.5);
          this.balladDustPositions[i * 3] = s.baseX + Math.sin(t * 0.8 + s.phase) * 0.55;
          this.balladDustPositions[i * 3 + 1] = 0.5 + rise;
          this.balladDustPositions[i * 3 + 2] = s.baseZ + Math.cos(t * 0.7 + s.phase) * 0.45;
        }
        this.balladDustPoints.geometry.attributes.position.needsUpdate = true;
      } else {
        this.balladDustPoints.visible = false;
      }
    }

    // E. 3D Fluttering Metallic Confetti Cards
    let anyConfettiUpdated = false;
    for (let i = 0; i < this.confettiCount; i += 1) {
      const c = this.confettiItems[i];
      if (!c.active) continue;
      anyConfettiUpdated = true;
      c.life += dt;
      if (c.life >= c.maxLife || c.y < -1.8) {
        c.active = false;
        this._dummy.position.set(0, -50, 0);
        this._dummy.scale.set(0, 0, 0);
        this._dummy.updateMatrix();
        this.confettiMesh.setMatrixAt(i, this._dummy.matrix);
        continue;
      }

      const airDrag = Math.pow(0.22, dt);
      c.vx *= airDrag;
      c.vz *= airDrag;
      c.vy = Math.max(-2.1, c.vy - 6.8 * dt);

      c.x += (c.vx + Math.sin(t * 4.5 + c.phase) * 0.9) * dt;
      c.y += c.vy * dt;
      c.z += (c.vz + Math.cos(t * 3.8 + c.phase) * 0.7) * dt;
      c.rx += c.vrx * dt;
      c.ry += c.vry * dt;
      c.rz += c.vrz * dt;

      const fadeScale =
        c.life > c.maxLife * 0.8 ? Math.max(0.01, (c.maxLife - c.life) / (c.maxLife * 0.2)) : 1;
      this._dummy.position.set(c.x, c.y, c.z);
      this._dummy.rotation.set(c.rx, c.ry, c.rz);
      this._dummy.scale.set(fadeScale, fadeScale, fadeScale);
      this._dummy.updateMatrix();
      this.confettiMesh.setMatrixAt(i, this._dummy.matrix);
    }
    if (anyConfettiUpdated) {
      this.confettiMesh.instanceMatrix.needsUpdate = true;
    }

    // F. Multi-Beam 3D Concert Laser Sweeps (Activated at 50x+ Streak, BRE, Fever, Encore!)
    const streakTier = this.lightingState?.streakTier || 0;
    const laserFanActive = Boolean(this.lightingState?.laserFanActive) || this.breActive;
    const isHighTechVenue =
      this.venueId === 'tokyo-dome' ||
      this.venueId === 'coachella' ||
      this.venueOverlayId === 'CYBER_NEON' ||
      this.venueOverlayId === 'ROYAL_OPERA' ||
      this.venueId === 'cyber-tokyo' ||
      this.venueId === 'royal-opera';
    const isFinaleLaser =
      (this.encoreFinaleActive || this.grandEncoreActive) &&
      (this.encoreGrade === 'S' || this.encoreGrade === 'A' || encore || this.grandEncoreActive);
    const laserStrength = isFinaleLaser || this.breActive
      ? 0.46
      : fever || encore
        ? 0.4
        : playing && (laserFanActive || combo >= 50)
          ? 0.34
          : isHighTechVenue && playing
            ? 0.14 + overallE * 0.12
            : 0;

    // 100x+ Continuous Corner Spark Fountains!
    if (playing && (streakTier >= 3 || this.breActive)) {
      this.streakPyroCooldown -= dt;
      if (this.streakPyroCooldown <= 0) {
        this.streakPyroCooldown = this.breActive ? 0.65 : 1.35;
        this.sparkEmitterTimer = Math.max(this.sparkEmitterTimer, 0.95);
        this.pyroFlameIntensity = Math.max(this.pyroFlameIntensity, 0.72);
      }
    } else {
      this.streakPyroCooldown = 0;
    }

    for (let i = 0; i < this.laserBeams.length; i += 1) {
      const lb = this.laserBeams[i];
      lb.mat.opacity = THREE.MathUtils.damp(lb.mat.opacity, laserStrength, 4.5, dt);
      if (streakTier >= 2 && this.lightingState?.multiplierColor) {
        lb.mat.color.lerp(this.lightingState.multiplierColor, 0.12);
      }
      if (lb.mat.opacity > 0.005) {
        const dir = i < 3 ? 1 : -1;
        const speed = fever || isFinaleLaser || encore || this.breActive ? 2.25 : streakTier >= 2 ? 1.75 : 1.35;
        lb.pivot.rotation.z = Math.sin(t * speed + i * 0.85) * 0.84 * dir;
        lb.pivot.rotation.x = 0.28 + Math.cos(t * (speed * 0.75) + i * 0.6) * 0.48;
      }
    }

    // G. CO2 Cryo-Jets blasting frosty vertical plumes on Fever, Encore & Chorus Drops
    this.cryoBurstTimer = Math.max(0, this.cryoBurstTimer - dt);
    const cryoTarget =
      fever || encore || this.encoreFinaleActive || this.grandEncoreActive || this.cryoBurstTimer > 0
        ? 0.48
        : playing && overallE > 0.54 && combo >= 20
          ? 0.3
          : 0;
    this.cryoJetIntensity = THREE.MathUtils.damp(this.cryoJetIntensity, cryoTarget, 4.2, dt);
    if (this.cryoJetMat && this.cryoJets) {
      this.cryoJetMat.uniforms.uOpacity.value = this.cryoJetIntensity;
      for (let i = 0; i < this.cryoJets.length; i += 1) {
        const cj = this.cryoJets[i];
        cj.mesh.visible = this.cryoJetIntensity > 0.015;
        if (cj.mesh.visible) {
          const flutter = 0.86 + Math.sin(t * 24 + cj.phase) * 0.14;
          cj.mesh.scale.set(
            0.85 + this.cryoJetIntensity * 0.72,
            (0.65 + this.cryoJetIntensity * 1.18) * flutter,
            0.85 + this.cryoJetIntensity * 0.72
          );
        }
      }
    }

    // H. Drifting Atmospheric Concert Haze Particles
    if (this.hazePoints) {
      for (let i = 0; i < this.hazeCount; i += 1) {
        const s = this.hazeSeeds[i];
        this.hazePositions[i * 3] = s.baseX + Math.sin(t * s.speed + s.phase) * 0.85;
        this.hazePositions[i * 3 + 1] = s.baseY + Math.cos(t * s.speed * 0.7 + s.phase) * 0.35;
      }
      this.hazePoints.geometry.attributes.position.needsUpdate = true;
    }

    // I. Cardioid Floor Subwoofers + Curved 12-Cabinet Line-Array Woofer Excursions + Motorized Roof Pods
    const bassHit = Math.min(1, telemetry?.bassEnergy || 0);
    const subKick = Math.min(1.25, this.lightingState?.subKickPunch ?? bassHit);
    if (this.subCones) {
      const push = 1.48 + subKick * 0.11;
      for (let i = 0; i < this.subCones.length; i += 1) {
        if (this.subCones[i]) this.subCones[i].position.z = push;
      }
    }
    if (this.cardioidSubGrilles) {
      const cardioidPush = 0.55 + subKick * 0.075;
      const cardioidScale = 1 + subKick * 0.032;
      for (let i = 0; i < this.cardioidSubGrilles.length; i += 1) {
        this.cardioidSubGrilles[i].position.z = cardioidPush;
        this.cardioidSubGrilles[i].scale.set(cardioidScale, cardioidScale, 1);
      }
    }
    if (this.lineArrayWoofers) {
      const wooferZ = 0.44 + subKick * 0.055;
      const wooferS = 1 + subKick * 0.095;
      for (let i = 0; i < this.lineArrayWoofers.length; i += 1) {
        this.lineArrayWoofers[i].position.z = wooferZ;
        this.lineArrayWoofers[i].scale.set(wooferS, wooferS, 1);
      }
    }
    if (this.motorizedLightPods && this.lightingState) {
      const ls = this.lightingState;
      const podTilt = ls.podTiltX || 0;
      const podRoll = ls.podRollZ || 0;
      const podSpin = ls.podSpinY || 0;
      const podLift = ls.podLiftY || 0;
      if (this.podRingMat) {
        this.podRingMat.emissiveIntensity = ls.podRingIntensity ?? 1.4;
        if (ls.spotPrimary) {
          this.podRingMat.emissive.lerp(ls.spotPrimary, 0.14);
          this.podRingMat.color.lerp(ls.spotPrimary, 0.14);
        }
      }
      if (this.podBeamMat?.uniforms) {
        if (ls.spotSecondary) this.podBeamMat.uniforms.uColor.value.lerp(ls.spotSecondary, 0.14);
        this.podBeamMat.uniforms.uOpacity.value = Math.min(0.2, 0.055 + (ls.floorPulse || 0) * 0.075);
      }
      for (let i = 0; i < this.motorizedLightPods.length; i += 1) {
        const pod = this.motorizedLightPods[i];
        const sideSign = i === 0 ? -1 : i === 2 ? 1 : 0;
        pod.pivot.position.y = pod.baseY + podLift * (pod.isCenter ? 1.0 : -0.65) + Math.sin(t * 1.1 + pod.phase) * 0.14;
        pod.body.rotation.x = podTilt * (pod.isCenter ? 1.0 : 0.85) + Math.sin(t * 0.9 + pod.phase) * 0.06;
        pod.body.rotation.z = podRoll * (sideSign !== 0 ? sideSign : 1.0);
        pod.body.rotation.y = podSpin * (pod.isCenter ? 1.0 : -0.8) + pod.phase;
      }
    }
  }

  /**
   * Deterministic fast PRNG for organic non-repeating Markov stage choreography.
   */
  nextChoreoRand() {
    this.markovSeed = (this.markovSeed * 1664525 + 1013904223) >>> 0;
    return this.markovSeed / 4294967296;
  }

  /**
   * Selects the next action from a 22-action weighted Markov pool for the current
   * detected Song Section, strictly forbidding repeats of the last 2 actions!
   */
  pickNextMarkovAction(m, sectionType, role) {
    const GUITAR_POOLS = {
      INTRO: [
        ['SPOTLIGHT_SWAY', 3.0],
        ['SLOW_NOD_FRETWORK', 3.0],
        ['AMP_LEAN_INTRO', 2.2],
        ['EDGE_APPROACH_SLOW', 2.0],
      ],
      VERSE: [
        ['POCKET_GROOVE', 2.8],
        ['SIDESTEP_SHUFFLE_L', 2.5],
        ['SIDESTEP_SHUFFLE_R', 2.5],
        ['MONITOR_FOOT_REST', 2.2],
        ['MIC_APPROACH', 1.8],
        ['HEAD_BOB_STANCE', 2.2],
      ],
      PRE_CHORUS: [
        ['BUILD_CROWD_CLAP', 2.8],
        ['EDGE_SURGE', 2.8],
        ['WIDE_STANCE_BUILD', 2.6],
        ['NECK_LIFT_THRUST', 2.2],
      ],
      CHORUS: [
        ['WINDMILL_STRUM', 3.2],
        ['WIDE_POWER_STANCE', 2.8],
        ['TRUSS_STRIDE_L', 2.4],
        ['TRUSS_STRIDE_R', 2.4],
        ['CROWD_FIST_PUMP', 2.2],
        ['POWER_LUNGE_FRONT', 2.6],
        ['ROCK_SPIN_FLOURISH', 1.9],
      ],
      GUITAR_SOLO: [
        ['KNEE_DROP_SOLO', 4.5],
        ['BACK_LEAN_BEND', 3.2],
        ['CENTER_MONITOR_SHRED', 3.4],
        ['NECK_SKY_SOLO', 2.8],
      ],
      BRIDGE: [
        ['BACK_TO_BACK_DUET', 4.0],
        ['INTIMATE_SPOTLIGHT', 2.6],
        ['SLOW_SWAY_DUET', 2.4],
        ['EDGE_LEAN_BRIDGE', 2.2],
      ],
      OUTRO: [
        ['ENCORE_POWER_SLIDE', 4.0],
        ['WINDMILL_FINALE', 3.2],
        ['CROWD_SALUTE_JUMP', 2.8],
        ['WIDE_POWER_STANCE', 2.2],
      ],
    };

    const BASS_POOLS = {
      INTRO: [
        ['SPOTLIGHT_SWAY', 3.0],
        ['POCKET_NOD_IDLE', 3.0],
        ['AMP_BACK_STANCE', 2.2],
      ],
      VERSE: [
        ['POCKET_GROOVE', 3.2],
        ['SIDESTEP_SHUFFLE_R', 2.6],
        ['DEEP_KNEE_BOUNCE', 2.8],
        ['DRUM_RISER_LOCK', 2.4],
        ['MONITOR_GROOVE', 2.2],
      ],
      PRE_CHORUS: [
        ['WIDE_STANCE_BUILD', 2.8],
        ['EDGE_SURGE', 2.6],
        ['CROWD_FIST_PUMP', 2.2],
      ],
      CHORUS: [
        ['WIDE_POWER_STANCE', 3.0],
        ['POWER_LUNGE_FRONT', 2.8],
        ['TRUSS_STRIDE_R', 2.5],
        ['CROWD_FIST_PUMP', 2.4],
        ['ROCK_SPIN_FLOURISH', 1.8],
      ],
      GUITAR_SOLO: [
        ['DRUM_RISER_LOCK', 3.4],
        ['POCKET_GROOVE', 3.2],
        ['DEEP_KNEE_BOUNCE', 2.6],
        ['SUPPORT_STEP_OUT', 2.2],
      ],
      BRIDGE: [
        ['BACK_TO_BACK_DUET', 4.2],
        ['SLOW_SWAY_DUET', 2.6],
        ['INTIMATE_SPOTLIGHT', 2.4],
      ],
      OUTRO: [
        ['ENCORE_POWER_SLIDE', 3.6],
        ['WIDE_POWER_STANCE', 2.8],
        ['CROWD_SALUTE_JUMP', 3.0],
      ],
    };

    const VOCAL_POOLS = {
      INTRO: [
        ['SPOTLIGHT_SWAY', 3.0],
        ['MIC_STAND_STANCE', 3.2],
        ['CROWD_WAVE_INTRO', 2.2],
      ],
      VERSE: [
        ['MIC_CENTER_SING', 3.4],
        ['STAGE_LEFT_PACE', 2.4],
        ['STAGE_RIGHT_PACE', 2.4],
        ['EDGE_MONITOR_LEAN', 2.4],
      ],
      PRE_CHORUS: [
        ['BUILD_CROWD_CLAP', 3.2],
        ['EDGE_SURGE', 2.8],
        ['MIC_CENTER_SING', 2.4],
      ],
      CHORUS: [
        ['CROWD_FIST_PUMP', 3.2],
        ['TRUSS_STRIDE_L', 2.6],
        ['TRUSS_STRIDE_R', 2.6],
        ['CENTER_ANTHEM_BELT', 3.0],
      ],
      GUITAR_SOLO: [
        ['HYPE_SOLOIST_L', 3.5],
        ['STAGE_RIGHT_PACE', 2.8],
        ['CROWD_FIST_PUMP', 2.4],
      ],
      BRIDGE: [
        ['INTIMATE_SPOTLIGHT', 3.5],
        ['MIC_CENTER_SING', 3.0],
        ['EDGE_LEAN_BRIDGE', 2.4],
      ],
      OUTRO: [
        ['CROWD_SALUTE_JUMP', 3.6],
        ['CENTER_ANTHEM_BELT', 3.0],
        ['TRUSS_STRIDE_L', 2.4],
      ],
    };

    const table = role === 'guitar' ? GUITAR_POOLS : role === 'bass' ? BASS_POOLS : VOCAL_POOLS;
    const pool = table[sectionType] || table.VERSE;

    // Strictly exclude the last 2 actions from m.actionHistory to guarantee non-repeating choreography!
    const h = m.actionHistory;
    const recent1 = h.length > 0 ? h[h.length - 1] : null;
    const recent2 = h.length > 1 ? h[h.length - 2] : null;
    let candidates = pool.filter(([act]) => act !== recent1 && act !== recent2);
    if (candidates.length === 0) {
      candidates = pool.filter(([act]) => act !== recent1);
    }
    if (candidates.length === 0) candidates = pool;

    let totalWeight = 0;
    for (let i = 0; i < candidates.length; i += 1) totalWeight += candidates[i][1];
    let r = this.nextChoreoRand() * totalWeight;
    let chosen = candidates[0][0];
    for (let i = 0; i < candidates.length; i += 1) {
      r -= candidates[i][1];
      if (r <= 0) {
        chosen = candidates[i][0];
        break;
      }
    }

    m.action = chosen;
    h.push(chosen);
    if (h.length > 4) h.shift();
    return chosen;
  }

  /**
   * Resolves a dynamic beat index from the DP beatGrid (or falls back to BPM beat count).
   */
  resolveDynamicBeatIndex(songTime, beatGrid, bpm) {
    if (songTime < 0) return -1;
    if (Array.isArray(beatGrid) && beatGrid.length >= 4) {
      let lo = 0;
      let hi = beatGrid.length - 1;
      let idx = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (beatGrid[mid].timeSec <= songTime + 0.03) {
          idx = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      return idx;
    }
    return Math.floor(songTime * (bpm / 60));
  }

  /**
   * Section-Aligned, Non-Repeating Markov Choreography + Critically Damped Spring-Damper
   * stage physics across all 7 musical sections (INTRO, VERSE, PRE_CHORUS, CHORUS,
   * GUITAR_SOLO, BRIDGE, OUTRO).
   */
  updateBandStageMotion(
    dt,
    { playing, songTime, bpm, moodId, currentSection, beatGrid, marks, guitarE, bassE, vocalE, fever, encore, sustainHeld, combo = 0 }
  ) {
    const gM = this.memberMotion.guitar;
    const bM = this.memberMotion.bass;
    const vM = this.memberMotion.vocals;
    const isSingingGuitarist = this.bandLineupId === 'singing-guitarist';
    const isPopDiva = this.bandLineupId === 'pop-diva';
    const secType =
      currentSection?.type ||
      (moodId === 'SOLO_SPOTLIGHT'
        ? 'GUITAR_SOLO'
        : moodId === 'CHORUS_EXPLOSION' || moodId === 'FEVER_OVERDRIVE'
          ? 'CHORUS'
          : moodId === 'ENCORE_FINALE'
            ? 'OUTRO'
            : moodId === 'INTRO_MOOD'
              ? 'INTRO'
              : 'VERSE');
    const secId = currentSection?.id || secType;
    const isHighEnergy =
      secType === 'CHORUS' ||
      secType === 'GUITAR_SOLO' ||
      secType === 'OUTRO' ||
      fever ||
      encore;

    // Critically damped spring-damper integrator (smooth natural momentum, zero overshoot!)
    const stepSpring1D = (pos, vel, target, omega, h) => {
      const f = 1 + 2 * h * omega;
      const oo = omega * omega;
      const hoo = h * oo;
      const hhoo = h * hoo;
      const detInv = 1 / (f + hhoo);
      const nextPos = (f * pos + h * vel + hhoo * target) * detInv;
      const nextVel = (vel + hoo * (target - pos)) * detInv;
      return [nextPos, nextVel];
    };

    if (!playing) {
      const roles = [
        { m: gM, mark: marks.guitar },
        { m: bM, mark: marks.bass },
        { m: vM, mark: marks.vocals },
      ];
      roles.forEach(({ m, mark }) => {
        m.targetX = mark.x;
        m.targetZ = mark.z;
        m.targetRotY = mark.rotY;
        m.stanceMode = 'HOME';
        const [nx, nvx] = stepSpring1D(m.x, m.vx, m.targetX, 4.5, dt);
        const [nz, nvz] = stepSpring1D(m.z, m.vz, m.targetZ, 4.5, dt);
        const [nr, nvr] = stepSpring1D(m.rotY, m.vRotY, m.targetRotY, 5.2, dt);
        m.x = nx;
        m.vx = nvx;
        m.z = nz;
        m.vz = nvz;
        m.rotY = nr;
        m.vRotY = nvr;
        m.kneeDrop = THREE.MathUtils.damp(m.kneeDrop, 0, 7, dt);
        m.windmillTimer = 0;
        m.fistPumpWeight = THREE.MathUtils.damp(m.fistPumpWeight, 0, 8, dt);
        m.jumpY = THREE.MathUtils.damp(m.jumpY, 0, 8, dt);
        m.squash = THREE.MathUtils.damp(m.squash, 0, 8, dt);
        m.moveSpeed = 0;
      });
      this.lastChoreoSectionId = null;
      return;
    }

    const sectionChanged = secId !== this.lastChoreoSectionId;
    if (sectionChanged) {
      this.lastChoreoSectionId = secId;
      // Immediately transition every performer into a fresh action suited to the new song section!
      gM.actionTimer = 0;
      bM.actionTimer = 0;
      vM.actionTimer = 0;

      // Special section-entry flourishes!
      if (secType === 'OUTRO') {
        gM.action = 'ENCORE_POWER_SLIDE';
        bM.action = 'ENCORE_POWER_SLIDE';
        this.triggerBandJump(1.18);
      } else if (secType === 'GUITAR_SOLO') {
        gM.action = 'KNEE_DROP_SOLO';
        gM.actionHistory.push('KNEE_DROP_SOLO');
        gM.actionTimer = 3.8 + this.nextChoreoRand() * 2.2;
      } else if (secType === 'BRIDGE') {
        gM.action = 'BACK_TO_BACK_DUET';
        bM.action = 'BACK_TO_BACK_DUET';
        gM.actionTimer = 4.2 + this.nextChoreoRand() * 2.4;
        bM.actionTimer = gM.actionTimer;
      }
    }

    // Per-performer asynchronous non-repeating Markov action timers (3.2s–6.8s, never locked to a 5s loop!)
    const updatePerformerAction = (m, role) => {
      m.actionTimer -= dt;
      if (m.actionTimer <= 0) {
        const chosen = this.pickNextMarkovAction(m, secType, role);
        const minDur = secType === 'CHORUS' || fever ? 2.8 : secType === 'INTRO' ? 4.4 : 3.4;
        const spanDur = secType === 'CHORUS' || fever ? 2.6 : 3.2;
        m.actionTimer = minDur + this.nextChoreoRand() * spanDur;

        if (chosen === 'ROCK_SPIN_FLOURISH') {
          m.spinRemaining = role === 'guitar' ? Math.PI * 2 : -Math.PI * 2;
        }
        if (chosen === 'WINDMILL_STRUM' || chosen === 'WINDMILL_FINALE') {
          m.windmillTimer = 1.65 + this.nextChoreoRand() * 0.9;
        }
        if (chosen === 'CROWD_SALUTE_JUMP' && songTime > 1.0) {
          this.triggerBandJump(1.05, [role]);
        }
      }
      if (m.windmillTimer > 0) {
        m.windmillTimer = Math.max(0, m.windmillTimer - dt);
        m.windmillPhase += dt * (11.5 + (bpm / 120) * 3.5);
      }
    };

    updatePerformerAction(gM, 'guitar');
    updatePerformerAction(bM, 'bass');
    if (marks.vocals.visible) updatePerformerAction(vM, 'vocals');

    // 1. Map Lead Guitarist Markov Action + Section to World Stage Coordinates & Stance
    if (isSingingGuitarist && vocalE > 0.24 && secType !== 'GUITAR_SOLO' && secType !== 'OUTRO') {
      gM.stanceMode = 'MIC_CENTER';
      gM.targetX = 0;
      gM.targetZ = -0.68;
      gM.targetRotY = 0;
    } else {
      switch (gM.action) {
        case 'KNEE_DROP_SOLO':
        case 'CENTER_MONITOR_SHRED':
          gM.stanceMode = gM.action === 'KNEE_DROP_SOLO' ? 'KNEE_DROP_SOLO' : 'EDGE_MONITOR';
          gM.targetX = isSingingGuitarist ? 0 : gM.action === 'KNEE_DROP_SOLO' ? 0 : 0.45;
          gM.targetZ = gM.action === 'KNEE_DROP_SOLO' ? 9.45 : 9.35;
          gM.targetRotY = 0.08;
          break;
        case 'BACK_LEAN_BEND':
        case 'NECK_SKY_SOLO':
          gM.stanceMode = 'POWER_STANCE';
          gM.targetX = -0.55;
          gM.targetZ = 1.24;
          gM.targetRotY = 0.24;
          break;
        case 'BACK_TO_BACK_DUET':
        case 'SLOW_SWAY_DUET':
          gM.stanceMode = 'BACK_TO_BACK';
          gM.targetX = -0.84;
          gM.targetZ = 0.12;
          gM.targetRotY = -0.68;
          break;
        case 'ENCORE_POWER_SLIDE':
          gM.stanceMode = 'ENCORE_SLIDE';
          gM.targetX = -0.55;
          gM.targetZ = 9.55;
          gM.targetRotY = 0.14;
          break;
        case 'WINDMILL_STRUM':
        case 'WINDMILL_FINALE':
          gM.stanceMode = 'POWER_STANCE';
          gM.targetX = isSingingGuitarist ? -1.2 : -2.15;
          gM.targetZ = 1.05;
          gM.targetRotY = 0.18;
          break;
        case 'POWER_LUNGE_FRONT':
        case 'EDGE_SURGE':
          gM.stanceMode = 'POWER_SLIDE';
          gM.targetX = isSingingGuitarist ? -1.45 : -2.45;
          gM.targetZ = 1.24;
          gM.targetRotY = 0.2;
          break;
        case 'TRUSS_STRIDE_L':
          gM.stanceMode = 'TRUSS_STRIDE';
          gM.targetX = -4.1;
          gM.targetZ = 0.96;
          gM.targetRotY = 0.36;
          break;
        case 'TRUSS_STRIDE_R':
          gM.stanceMode = 'TRUSS_STRIDE';
          gM.targetX = -0.95;
          gM.targetZ = 0.92;
          gM.targetRotY = -0.18;
          break;
        case 'SIDESTEP_SHUFFLE_L':
          gM.stanceMode = 'PACE';
          gM.targetX = marks.guitar.x - 0.85;
          gM.targetZ = marks.guitar.z + 0.35;
          gM.targetRotY = 0.28;
          break;
        case 'SIDESTEP_SHUFFLE_R':
          gM.stanceMode = 'PACE';
          gM.targetX = marks.guitar.x + 1.05;
          gM.targetZ = marks.guitar.z + 0.52;
          gM.targetRotY = 0.12;
          break;
        case 'MONITOR_FOOT_REST':
        case 'EDGE_APPROACH_SLOW':
        case 'EDGE_LEAN_BRIDGE':
          gM.stanceMode = 'EDGE_MONITOR';
          gM.targetX = isSingingGuitarist ? -0.9 : -2.75;
          gM.targetZ = 1.18;
          gM.targetRotY = 0.22;
          break;
        case 'AMP_LEAN_INTRO':
          gM.stanceMode = 'HOME';
          gM.targetX = marks.guitar.x - 0.55;
          gM.targetZ = marks.guitar.z - 0.45;
          gM.targetRotY = 0.38;
          break;
        case 'WIDE_POWER_STANCE':
        case 'WIDE_STANCE_BUILD':
        case 'CROWD_FIST_PUMP':
        case 'CROWD_SALUTE_JUMP':
        case 'BUILD_CROWD_CLAP':
          gM.stanceMode = 'POWER_STANCE';
          gM.targetX = isSingingGuitarist ? -0.95 : -2.25;
          gM.targetZ = 0.72;
          gM.targetRotY = 0.14;
          break;
        default:
          gM.stanceMode = secType === 'INTRO' ? 'HOME' : 'PACE';
          gM.targetX = marks.guitar.x + (secType === 'INTRO' ? 0 : 0.4);
          gM.targetZ = marks.guitar.z + (secType === 'INTRO' ? 0 : 0.28);
          gM.targetRotY = marks.guitar.rotY;
          break;
      }
    }

    // 2. Map Bassist Markov Action + Section to World Stage Coordinates & Stance
    switch (bM.action) {
      case 'BACK_TO_BACK_DUET':
      case 'SLOW_SWAY_DUET':
        bM.stanceMode = 'BACK_TO_BACK';
        bM.targetX = 0.84;
        bM.targetZ = 0.12;
        bM.targetRotY = 0.68;
        break;
      case 'ENCORE_POWER_SLIDE':
        bM.stanceMode = 'ENCORE_SLIDE';
        bM.targetX = 2.05;
        bM.targetZ = 1.32;
        bM.targetRotY = -0.22;
        break;
      case 'DRUM_RISER_LOCK':
        bM.stanceMode = 'PACE';
        bM.targetX = 3.15;
        bM.targetZ = -0.35;
        bM.targetRotY = -0.45;
        break;
      case 'POWER_LUNGE_FRONT':
      case 'EDGE_SURGE':
        bM.stanceMode = 'POWER_SLIDE';
        bM.targetX = 2.55;
        bM.targetZ = 1.65;
        bM.targetRotY = -0.24;
        break;
      case 'TRUSS_STRIDE_R':
        bM.stanceMode = 'TRUSS_STRIDE';
        bM.targetX = 4.25;
        bM.targetZ = 1.15;
        bM.targetRotY = -0.34;
        break;
      case 'MONITOR_GROOVE':
      case 'SUPPORT_STEP_OUT':
        bM.stanceMode = 'EDGE_MONITOR';
        bM.targetX = 2.85;
        bM.targetZ = 1.48;
        bM.targetRotY = -0.22;
        break;
      case 'WIDE_POWER_STANCE':
      case 'WIDE_STANCE_BUILD':
      case 'CROWD_FIST_PUMP':
      case 'CROWD_SALUTE_JUMP':
        bM.stanceMode = 'POWER_STANCE';
        bM.targetX = 2.65;
        bM.targetZ = 1.1;
        bM.targetRotY = -0.18;
        break;
      case 'SIDESTEP_SHUFFLE_R':
        bM.stanceMode = 'PACE';
        bM.targetX = marks.bass.x - 0.65;
        bM.targetZ = marks.bass.z + 0.52;
        bM.targetRotY = -0.18;
        break;
      case 'AMP_BACK_STANCE':
        bM.stanceMode = 'HOME';
        bM.targetX = marks.bass.x + 0.25;
        bM.targetZ = Math.max(-0.1, marks.bass.z - 0.35);
        bM.targetRotY = -0.34;
        break;
      default:
        bM.stanceMode = secType === 'INTRO' ? 'HOME' : 'PACE';
        bM.targetX = marks.bass.x;
        bM.targetZ = marks.bass.z + (secType === 'INTRO' ? 0 : 0.25);
        bM.targetRotY = marks.bass.rotY;
        break;
    }

    // 3. Map Vocalist Markov Action + Section
    if (marks.vocals.visible) {
      if (secType === 'GUITAR_SOLO') {
        // Step gracefully aside to let Lead Guitarist own the T-catwalk spotlight during solos!
        vM.stanceMode = 'PACE';
        vM.targetX = 2.6;
        vM.targetZ = 2.0;
        vM.targetRotY = -0.48;
      } else if (!isPopDiva && vocalE > 0.28 && (vM.action === 'MIC_CENTER_SING' || secType === 'VERSE')) {
        vM.stanceMode = 'MIC_CENTER';
        vM.targetX = 0;
        vM.targetZ = marks.vocals.z ?? 2.0;
        vM.targetRotY = 0;
      } else if (vM.action === 'TRUSS_STRIDE_L' || vM.action === 'STAGE_LEFT_PACE') {
        vM.stanceMode = isHighEnergy ? 'TRUSS_STRIDE' : 'PACE';
        vM.targetX = isPopDiva ? -2.05 : -1.55;
        vM.targetZ = isHighEnergy ? 2.45 : 1.9;
        vM.targetRotY = 0.22;
      } else if (vM.action === 'TRUSS_STRIDE_R' || vM.action === 'STAGE_RIGHT_PACE') {
        vM.stanceMode = isHighEnergy ? 'TRUSS_STRIDE' : 'PACE';
        vM.targetX = isPopDiva ? 2.05 : 1.55;
        vM.targetZ = isHighEnergy ? 2.45 : 1.9;
        vM.targetRotY = -0.22;
      } else if (vM.action === 'EDGE_MONITOR_LEAN' || vM.action === 'EDGE_SURGE' || vM.action === 'CENTER_ANTHEM_BELT') {
        vM.stanceMode = 'EDGE_MONITOR';
        vM.targetX = 0;
        vM.targetZ = 10.6;
        vM.targetRotY = 0;
      } else {
        vM.stanceMode = 'MIC_CENTER';
        vM.targetX = 0;
        vM.targetZ = marks.vocals.z ?? 2.0;
        vM.targetRotY = 0;
      }
    }

    // Chorus Catwalk Strut, 8× Fever streak, or Guitar Solo extended T-catwalk -> Illuminated Circular B-Stage showcase!
    const isChorusBStage = secType === 'CHORUS' && (fever || encore || guitarE > 0.42 || vocalE > 0.42);
    if ((fever && combo >= 30) || secType === 'GUITAR_SOLO' || isChorusBStage) {
      if (this.activeInstrument === 'guitar' || secType === 'GUITAR_SOLO' || (secType === 'CHORUS' && guitarE > 0.45)) {
        gM.stanceMode = secType === 'GUITAR_SOLO' ? 'KNEE_DROP_SOLO' : 'EDGE_MONITOR';
        gM.targetX = isSingingGuitarist ? 0 : secType === 'GUITAR_SOLO' ? -0.45 : -0.82;
        gM.targetZ = secType === 'GUITAR_SOLO' ? 12.1 : 10.6;
        gM.targetRotY = 0.08;
      } else if (this.activeInstrument === 'bass' && fever && combo >= 30) {
        bM.stanceMode = 'EDGE_MONITOR';
        bM.targetX = 0.56;
        bM.targetZ = 11.75;
        bM.targetRotY = -0.08;
      }
      if (marks.vocals.visible && secType !== 'GUITAR_SOLO' && ((fever && combo >= 30) || (secType === 'CHORUS' && vocalE > 0.38))) {
        vM.stanceMode = 'EDGE_MONITOR';
        vM.targetX = secType === 'CHORUS' ? 0.22 : 0;
        vM.targetZ = 12.15;
        vM.targetRotY = 0;
      }
    }

    // Track sustain lean-back & knee-drop / fist-pump weights smoothly
    gM.sustainLean = THREE.MathUtils.damp(
      gM.sustainLean,
      sustainHeld && this.activeInstrument === 'guitar' ? 1.15 : gM.action === 'BACK_LEAN_BEND' ? 0.72 : 0,
      7.5,
      dt
    );
    bM.sustainLean = THREE.MathUtils.damp(
      bM.sustainLean,
      sustainHeld && this.activeInstrument === 'bass' ? 1.15 : 0,
      7.5,
      dt
    );

    const gTargetKneeDrop = gM.stanceMode === 'KNEE_DROP_SOLO' ? 1.0 : gM.stanceMode === 'ENCORE_SLIDE' ? 0.85 : 0;
    const [gKD, gVKD] = stepSpring1D(gM.kneeDrop, gM.vKneeDrop, gTargetKneeDrop, 7.2, dt);
    gM.kneeDrop = Math.max(0, gKD);
    gM.vKneeDrop = gVKD;

    const bTargetKneeDrop = bM.stanceMode === 'ENCORE_SLIDE' ? 0.7 : 0;
    const [bKD, bVKD] = stepSpring1D(bM.kneeDrop, bM.vKneeDrop, bTargetKneeDrop, 7.2, dt);
    bM.kneeDrop = Math.max(0, bKD);
    bM.vKneeDrop = bVKD;

    gM.fistPumpWeight = THREE.MathUtils.damp(
      gM.fistPumpWeight,
      gM.action === 'CROWD_FIST_PUMP' || gM.action === 'BUILD_CROWD_CLAP' ? 1.0 : 0,
      7.5,
      dt
    );
    bM.fistPumpWeight = THREE.MathUtils.damp(
      bM.fistPumpWeight,
      bM.action === 'CROWD_FIST_PUMP' ? 1.0 : 0,
      7.5,
      dt
    );

    // 4. Critically Damped Spring-Damper stage traversal (with T-catwalk shaft-safe waypoint routing) + jumps!
    const stepMemberSpring = (m, springFreq) => {
      let goalX = m.targetX;
      let goalZ = m.targetZ;
      if (m.targetZ > 4.8 && m.z < 4.7 && Math.abs(m.x) > 1.3) {
        goalX = THREE.MathUtils.clamp(m.targetX, -1.1, 1.1);
        goalZ = 4.2;
      } else if (m.targetZ < 4.6 && m.z > 4.75 && Math.abs(m.targetX) > 1.35) {
        goalX = THREE.MathUtils.clamp(m.x, -1.1, 1.1);
        goalZ = 4.1;
      }

      const dx = goalX - m.x;
      const dz = goalZ - m.z;
      const dist = Math.hypot(dx, dz);

      const [nx, nvx] = stepSpring1D(m.x, m.vx, goalX, springFreq, dt);
      const [nz, nvz] = stepSpring1D(m.z, m.vz, goalZ, springFreq, dt);
      m.x = nx;
      m.vx = nvx;
      m.z = nz;
      m.vz = nvz;
      if (m.z > 5.15 && m.z < 8.6) {
        m.x = THREE.MathUtils.clamp(m.x, -1.18, 1.18);
      } else if (m.z >= 8.6) {
        // Keep roaming stars strictly inside the illuminated octagonal B-Stage (center z=11.0, safe radius 2.65m)
        const bx = m.x;
        const bz = m.z - 11.0;
        const bDist = Math.hypot(bx, bz);
        if (bDist > 2.65) {
          const s = 2.65 / bDist;
          m.x = bx * s;
          m.z = 11.0 + bz * s;
        }
      }

      const planarSpeed = Math.hypot(m.vx, m.vz);
      const normalizedSpeed = Math.min(1, planarSpeed / 2.2);
      m.moveSpeed = THREE.MathUtils.damp(m.moveSpeed, dist > 0.05 ? normalizedSpeed : 0, 10, dt);
      if (m.moveSpeed > 0.03) {
        m.walkPhase += dt * (6.8 + m.moveSpeed * 5.2);
      }

      const travelYaw = dist > 0.55 ? Math.atan2(dx, dz) : m.targetRotY;
      const desiredYaw = dist > 0.55 ? THREE.MathUtils.lerp(m.targetRotY, travelYaw, 0.52) : m.targetRotY;
      const [nr, nvr] = stepSpring1D(m.rotY, m.vRotY, desiredYaw, 6.2, dt);
      m.rotY = nr;
      m.vRotY = nvr;

      if (Math.abs(m.spinRemaining) > 0.02) {
        const dir = Math.sign(m.spinRemaining);
        const dSpin = Math.min(Math.abs(m.spinRemaining), dt * 9.8);
        m.rotY += dir * dSpin;
        m.spinRemaining -= dir * dSpin;
      }

      if (m.crouchTimer > 0) {
        m.crouchTimer -= dt;
        m.squash = THREE.MathUtils.damp(m.squash, 0.34, 22, dt);
        if (m.crouchTimer <= 0) {
          m.jumpVel = m.pendingJumpVel || 5.6;
          m.pendingJumpVel = 0;
          m.squash = -0.14;
        }
      } else if (m.jumpY > 0 || m.jumpVel > 0) {
        m.jumpY += m.jumpVel * dt;
        m.jumpVel -= 17.5 * dt;
        m.squash = THREE.MathUtils.damp(m.squash, 0, 8, dt);
        if (m.jumpY <= 0) {
          m.jumpY = 0;
          m.jumpVel = 0;
          m.squash = 0.32;
        }
      } else {
        m.squash = THREE.MathUtils.damp(m.squash, 0, 10, dt);
      }
    };

    const springOmega =
      secType === 'CHORUS' || secType === 'OUTRO' || fever
        ? 3.8
        : secType === 'GUITAR_SOLO'
          ? 3.4
          : secType === 'INTRO'
            ? 2.1
            : 2.85;
    stepMemberSpring(gM, springOmega);
    stepMemberSpring(bM, springOmega * 0.94);
    if (marks.vocals.visible) {
      stepMemberSpring(vM, springOmega * (isPopDiva ? 1.12 : 0.96));
    }

    // 5. Dynamic Beat-Grid Synchronized Chorus / Fever / Outro Downbeat Jumps (every 2 measures)!
    if ((secType === 'CHORUS' || secType === 'OUTRO' || fever || encore) && songTime > 1.0 && (guitarE > 0.32 || bassE > 0.32)) {
      const beatIdx = this.resolveDynamicBeatIndex(songTime, beatGrid, bpm);
      const isDownbeat =
        Array.isArray(beatGrid) && beatIdx >= 0 && beatIdx < beatGrid.length
          ? Boolean(beatGrid[beatIdx].isMeasure)
          : beatIdx >= 0 && beatIdx % 4 === 0;
      if (isDownbeat && beatIdx - this.lastJumpBeat >= 8) {
        this.lastJumpBeat = beatIdx;
        // Skip jumping if guitarist is locked in a Knee-Drop Solo
        const jumpRoles = gM.kneeDrop > 0.35 ? ['bass', 'vocals'] : ['guitar', 'bass', 'vocals'];
        this.triggerBandJump(fever || encore || secType === 'OUTRO' ? 1.18 : 0.92, jumpRoles);
      }
    }
  }

  /**
   * Advances all 4 expressive Roblox musicians, live LED backdrop, full-bodied 3D crowd,
   * orbital concert camera, moving spotlights, and pyrotechnics/fireworks/confetti/lasers.
   */
  update(dt, stageState, telemetry) {
    if (this.disposed) return;
    this.clock += dt;
    const t = this.clock;

    const playing = Boolean(stageState?.playing);
    const bpm = Math.max(70, Math.min(200, stageState?.bpm || 120));
    const songTime = stageState?.songTime ?? t;
    const hypeNorm = Math.max(0, Math.min(1, (stageState?.hype ?? 58) / 100));
    const encore = Boolean(stageState?.isEncore || this.encorePerformanceActive);
    const fever = Boolean(stageState?.feverActive);
    const combo = stageState?.combo || 0;
    const currentSection = stageState?.currentSection || null;
    const beatGrid = stageState?.beatGrid || null;
    if (stageState?.trackMeta !== undefined) {
      this.lastTrackMeta = stageState.trackMeta;
    }
    const trackMeta = this.lastTrackMeta;

    // Real-time smoothed-attack / natural-decay per-stem telemetry from beatScheduler.js
    const te = stageState?.transientEnergy;
    const kickImpulse = playing ? Math.max(0, Math.min(1, te?.kickImpulse ?? telemetry?.kickTransient ?? 0)) : 0;
    const snareImpulse = playing ? Math.max(0, Math.min(1, te?.snareImpulse ?? telemetry?.snareTransient ?? 0)) : 0;
    const bassGroove = playing ? Math.max(0, Math.min(1, te?.bassGroove ?? telemetry?.bassEnergy ?? 0)) : 0.08;
    const guitarRiffEnergy = playing ? Math.max(0, Math.min(1, te?.guitarRiffEnergy ?? telemetry?.guitarEnergy ?? 0)) : 0.1;
    const guitarBendPulse = playing ? Math.max(0, Math.min(1, te?.guitarBendPulse ?? 0)) : 0;
    const vocalKeysEnergy = playing ? Math.max(0, Math.min(1, te?.vocalKeysEnergy ?? telemetry?.vocalEnergy ?? 0)) : 0.08;
    const isDownbeat = Boolean(stageState?.isDownbeat || te?.isDownbeat);
    const isSnareHit = Boolean(stageState?.isSnareHit || te?.isSnareHit);
    const isPhraseBoundary = Boolean(stageState?.isPhraseBoundary || te?.isPhraseBoundary);

    const drumE = playing ? Math.min(1, Math.max((telemetry?.drumEnergy || 0) * 1.65, (kickImpulse + snareImpulse) * 0.72)) : 0.12;
    const bassE = playing ? Math.min(1, Math.max((telemetry?.bassEnergy || 0) * 1.55, bassGroove)) : 0.1;
    const guitarE = playing ? Math.min(1, Math.max((telemetry?.guitarEnergy || 0) * 1.65, guitarRiffEnergy)) : 0.12;
    const pianoE = playing ? Math.min(1, Math.max((telemetry?.pianoEnergy || guitarE * 0.72) * 1.6, vocalKeysEnergy)) : 0.12;
    const vocalE = playing ? Math.min(1, Math.max((telemetry?.vocalEnergy || 0) * 1.5, vocalKeysEnergy)) : 0.1;
    const hypeBoost = fever || encore || this.encoreFinaleActive ? 1.35 : 1.0;

    // Decay note-driven animation impulses smoothly
    this.guitarStrumImpulse = Math.max(0, this.guitarStrumImpulse - dt * 5.8);
    this.guitarHeadbangBoost = Math.max(0, this.guitarHeadbangBoost - dt * 1.6);
    this.bassPluckImpulse = Math.max(0, this.bassPluckImpulse - dt * 5.2);
    this.bassBounceImpulse = Math.max(0, this.bassBounceImpulse - dt * 3.8);
    this.drumLeftHit = Math.max(0, this.drumLeftHit - dt * 6.5);
    this.drumRightHit = Math.max(0, this.drumRightHit - dt * 6.5);
    this.drumKickImpulse = Math.max(0, this.drumKickImpulse - dt * 7.5);
    this.pianoHitImpulse = Math.max(0, this.pianoHitImpulse - dt * 5.5);
    this.pianoGlissando = Math.max(0, this.pianoGlissando - dt * 2.8);
    for (let c = 0; c < 3; c += 1) {
      this.cymbalWobble[c] = Math.max(0, this.cymbalWobble[c] - dt * 2.1);
      this.cymbalPhase[c] += dt * (14 + c * 2.5);
    }

    // Trigger crash cymbal wobble automatically on musical phrase boundaries!
    if (playing && isPhraseBoundary && drumE > 0.18) {
      this.cymbalWobble[1] = Math.max(this.cymbalWobble[1], 0.92);
      this.cymbalWobble[2] = Math.max(this.cymbalWobble[2], 1.0);
    }

    // PHASE 1 — CINEMATIC STAGE WALK-ON & GEAR SETUP (-4.5s to -2.0s)!
    const isWalkOn = playing && songTime < -2.0;
    const walkP = isWalkOn ? Math.max(0, Math.min(1, (songTime + 4.5) / 2.5)) : 1;
    const walkEase = 1 - Math.pow(1 - walkP, 2.6);
    const metaKeyInt = this.venueEnv?.meta?.keyIntensity ?? 0.74;
    const marks = this.getLineupMarks();
    const stemActivity = stageState?.stemActivity || { drums: true, bass: true, guitar: true };

    const resolvedBeatPhase = Number.isFinite(stageState?.beatPhase)
      ? stageState.beatPhase
      : (((songTime * (bpm / 60)) % 1) + 1) % 1;
    const resolvedEighthPhase = Number.isFinite(te?.eighthPhase)
      ? te.eighthPhase
      : (resolvedBeatPhase * 2) % 1;
    const resolvedSixteenthPhase = Number.isFinite(stageState?.sixteenthPhase)
      ? stageState.sixteenthPhase
      : (resolvedBeatPhase * 4) % 1;

    // Dynamic Stage Lighting & Section-Driven Mood Profile interpolation (with multi-color Firework Stadium Bowl Wash)
    const isGrandEncore = Boolean(stageState?.isEncoreActive || this.grandEncoreActive || this.encoreFinaleActive);
    const lightState = this.lightingController.update(dt, {
      playing,
      songTime,
      bpm,
      combo: stageState?.combo || 0,
      fever,
      encore,
      isEncoreActive: isGrandEncore,
      encoreFinaleActive: this.encoreFinaleActive,
      overallEnergy: telemetry?.overallEnergy || 0,
      bassEnergy: bassE,
      stemDropped: Boolean(stageState?.stemDropped),
      isWalkOn,
      instrument: this.activeInstrument,
      venueMeta: this.venueEnv?.meta,
      overlayMeta: this.venueEnv?.overlayMeta || this.overlayMeta || null,
      currentSection,
      trackMeta,
      beatPhase: resolvedBeatPhase,
      barPhase: stageState?.barPhase,
      phraseProgress: stageState?.phraseProgress,
      isDownbeat,
      isSnareHit,
      transientEnergy: te,
      fireworkFlash: this.fireworkFlashState,
    });
    this.lightingState = lightState;
    this.breActive = Boolean(stageState?.breActive);
    const streakTier = lightState.streakTier || 0;

    // Advance Crowd Event State Machine
    this.updateCrowdEventState(dt, {
      playing,
      isWalkOn,
      hypeNorm,
      feverOrEncore: fever || encore || isGrandEncore || this.breActive,
      sectionType: lightState.sectionType,
      ambianceType: lightState.ambianceType,
      streak: combo,
    });

    // Grand Piano / Crystal Grand animated lidGroup & propStick driven by ballad/chorus dynamics
    if (this.keyboardAsset?.lidGroup) {
      const closedAngle = this.keyboardAsset.lidClosedAngle ?? 0.04;
      const openAngle = this.keyboardAsset.lidOpenAngle ?? 0.64;
      const targetLidAngle = !playing && !this.encoreFinaleActive && !isGrandEncore
        ? closedAngle
        : lightState.isBallad ||
            lightState.sectionType === 'CHORUS' ||
            lightState.sectionType === 'OUTRO' ||
            fever ||
            encore ||
            isGrandEncore
          ? openAngle
          : 0.38;
      this.keyboardAsset.lidGroup.rotation.z = THREE.MathUtils.damp(
        this.keyboardAsset.lidGroup.rotation.z,
        targetLidAngle,
        4.2,
        dt
      );
      if (this.keyboardAsset.propStick) {
        const openRatio = Math.max(
          0,
          Math.min(1, (this.keyboardAsset.lidGroup.rotation.z - closedAngle) / Math.max(0.01, openAngle - closedAngle))
        );
        this.keyboardAsset.propStick.visible = openRatio > 0.08;
        this.keyboardAsset.propStick.scale.y = Math.max(0.15, openRatio);
      }
    }

    // Apply mood lighting + Shader Sky Dome + Grand Encore deep starry sky (#050816) & firework sky bloom
    const fwReflect = lightState.fireworkReflectionBoost || 0;
    if (this.scene.background) {
      if (isGrandEncore) {
        this._colorC.copy(this._encoreNightColor);
        if (fwReflect > 0.01 && lightState.fireworkSkyColor) {
          this._colorC.lerp(lightState.fireworkSkyColor, Math.min(0.42, fwReflect * 0.28));
        }
        this.scene.background.lerp(this._colorC, 1 - Math.exp(-3.4 * dt));
      } else {
        this.scene.background.lerp(
          lightState.skyHorizonColor || this._venueSkyColor,
          1 - Math.exp(-3.0 * dt)
        );
      }
    }
    if (this.venueEnv?.dynamicElements?.updateAtmosphere) {
      this.venueEnv.dynamicElements.updateAtmosphere(lightState, isGrandEncore, dt);
    } else if (this.venueEnv?.dynamicElements?.skyMat?.color) {
      const skyMat = this.venueEnv.dynamicElements.skyMat;
      skyMat.color.lerp(isGrandEncore ? this._encoreNightColor.setHex(0x6b7db3) : this._colorA.setHex(0xffffff), 1 - Math.exp(-3.5 * dt));
      this._encoreNightColor.setHex(0x050816);
    }
    if (this.scene.fog && this.venueEnv?.meta) {
      if (isGrandEncore) {
        this._colorC.copy(this._encoreNightColor);
        if (fwReflect > 0.01 && lightState.fireworkSkyColor) {
          this._colorC.lerp(lightState.fireworkSkyColor, Math.min(0.35, fwReflect * 0.24));
        }
        this.scene.fog.color.lerp(this._colorC, 1 - Math.exp(-3.8 * dt));
        const encoreFogDensity = Math.max(
          0.0011,
          (this.venueEnv.meta.fogDensity || 0.003) * (lightState.fogDensityMult || 0.38)
        );
        this.scene.fog.density = THREE.MathUtils.damp(this.scene.fog.density, encoreFogDensity, 4.2, dt);
      } else {
        this._colorC.setHex(this.venueEnv.meta.fogColor).lerp(lightState.skyHorizonColor || lightState.fogColor, 0.38);
        this.scene.fog.color.copy(this._colorC);
        const targetFogDensity = this.venueEnv.meta.fogDensity * (1 + (lightState.hazeBoost || 0) * 0.35);
        this.scene.fog.density = THREE.MathUtils.damp(this.scene.fog.density, targetFogDensity, 3.5, dt);
      }
    }
    if (this.hazePoints?.material) {
      const targetHazeOp = Math.max(0.12, (lightState.hazeShaftOpacity || 0.16) + (lightState.hazeBoost || 0) * 0.14);
      this.hazePoints.material.opacity = THREE.MathUtils.damp(this.hazePoints.material.opacity, targetHazeOp, 4.0, dt);
    }
    if (this.hemiLight) {
      this.hemiLight.color.copy(lightState.hemiSky);
      this.hemiLight.groundColor.copy(lightState.hemiGround);
      this.hemiLight.intensity = 0.82 * (lightState.hemiMult || 1.0);
    }
    if (this.frontKey) {
      this.frontKey.color.copy(lightState.keyColor);
    }
    if (this.bandRimLight) {
      this.bandRimLight.color.copy(lightState.bandRimColor);
      this.bandRimLight.intensity = lightState.bandRimIntensity + lightState.strobeFlash * 1.1;
    }
    const bowlWash = lightState.stadiumBowlWash || 0;
    if (this.bandRimSideL) {
      this.bandRimSideL.color.copy(lightState.spotPrimary);
      if (bowlWash > 0.02 && lightState.fireworkRimColor) {
        this.bandRimSideL.color.lerp(lightState.fireworkRimColor, Math.min(0.75, bowlWash * 0.65));
      }
      this.bandRimSideL.intensity = (1.1 + lightState.rimMult * 0.45) + lightState.strobeFlash * 0.65 + bowlWash * 1.4;
    }
    if (this.bandRimSideR) {
      this.bandRimSideR.color.copy(lightState.spotSecondary);
      if (bowlWash > 0.02 && lightState.fireworkSecondaryColor) {
        this.bandRimSideR.color.lerp(lightState.fireworkSecondaryColor, Math.min(0.75, bowlWash * 0.65));
      }
      this.bandRimSideR.intensity = (1.1 + lightState.rimMult * 0.45) + lightState.strobeFlash * 0.65 + bowlWash * 1.4;
    }
    if (this.crowdLight) {
      this.crowdLight.color.copy(lightState.crowdGlow);
      if (bowlWash > 0.02 && lightState.fireworkSecondaryColor) {
        this.crowdLight.color.lerp(lightState.fireworkSecondaryColor, Math.min(0.6, bowlWash * 0.52));
      }
      this.crowdLight.intensity = 16 * lightState.crowdGlowMult + lightState.strobeFlash * 10 + bowlWash * 18;
    }
    if (this.blinderMat) {
      const bp = lightState.blinderPulse || 0;
      this.blinderMat.emissiveIntensity = 0.22 + bp * 4.8;
      if (this.blinderLight) {
        this.blinderLight.intensity = bp * 58;
      }
    }

    // Dynamic Multi-Color Firework Overhead Reflections on Stage Roof Trusses, Stadium Arches & Waterfronts
    if (this.stageTrussMat) {
      if (fwReflect > 0.01 && lightState.fireworkRimColor) {
        this.stageTrussMat.emissive.copy(lightState.fireworkRimColor);
        this.stageTrussMat.emissiveIntensity = Math.min(0.95, fwReflect * 0.58);
      } else if (this.stageTrussMat.emissiveIntensity > 0.001) {
        this.stageTrussMat.emissiveIntensity = THREE.MathUtils.damp(this.stageTrussMat.emissiveIntensity, 0, 6.0, dt);
      }
    }
    if (this._venueTrussMats?.length) {
      for (let i = 0; i < this._venueTrussMats.length; i += 1) {
        const entry = this._venueTrussMats[i];
        const washCol = i % 2 === 1 && lightState.fireworkSecondaryColor
          ? lightState.fireworkSecondaryColor
          : lightState.fireworkRimColor;
        if (fwReflect > 0.01 && washCol) {
          entry.mat.emissive.copy(entry.baseEmissive).lerp(washCol, Math.min(0.88, fwReflect * 0.76));
          entry.mat.emissiveIntensity = entry.baseIntensity + Math.min(0.75, fwReflect * 0.48);
        } else if (entry.mat.emissiveIntensity > entry.baseIntensity + 0.002) {
          entry.mat.emissive.lerp(entry.baseEmissive, 1 - Math.exp(-5.0 * dt));
          entry.mat.emissiveIntensity = THREE.MathUtils.damp(entry.mat.emissiveIntensity, entry.baseIntensity, 5.5, dt);
        }
      }
    }
    if (this._venueWaterMats?.length) {
      for (let i = 0; i < this._venueWaterMats.length; i += 1) {
        const entry = this._venueWaterMats[i];
        const waterWash = i % 2 === 1 && lightState.fireworkSecondaryColor
          ? lightState.fireworkSecondaryColor
          : lightState.fireworkSkyColor;
        if (fwReflect > 0.01 && waterWash) {
          const shimmer = 0.85 + 0.15 * Math.sin(t * 14 + i * 2.1);
          entry.mat.emissive
            .copy(entry.baseEmissive)
            .lerp(waterWash, Math.min(0.86, fwReflect * 0.72));
          entry.mat.emissiveIntensity = entry.baseIntensity + fwReflect * 1.05 * shimmer;
        } else if (entry.mat.emissiveIntensity > entry.baseIntensity + 0.002) {
          entry.mat.emissive.lerp(entry.baseEmissive, 1 - Math.exp(-4.5 * dt));
          entry.mat.emissiveIntensity = THREE.MathUtils.damp(entry.mat.emissiveIntensity, entry.baseIntensity, 4.5, dt);
        }
      }
    }
    if (this.stageRimMat) {
      if (streakTier >= 1 && lightState.multiplierColor && !fever && !encore) {
        this.stageRimMat.color.lerp(lightState.multiplierColor, 0.14);
        this.stageRimMat.emissive.lerp(lightState.multiplierColor, 0.14);
      }
      this.stageRimMat.emissiveIntensity = 1.45 * lightState.rimMult + lightState.strobeFlash * 0.9;
    }

    // 100x+ Streak Player Gold Aura positioned smoothly beneath active player's musician!
    if (this.playerGoldAura) {
      const auraTarget = playing && !isWalkOn && (streakTier >= 3 || this.breActive) ? 1 : 0;
      this.playerGoldAuraOpacity = THREE.MathUtils.damp(this.playerGoldAuraOpacity, auraTarget, 5.0, dt);
      if (this.playerGoldAuraOpacity > 0.015) {
        const activeRole = this.activeInstrument || 'guitar';
        const anchorObj = activeRole === 'piano' ? this.pianoRigGroup : this.membersByRole?.[activeRole]?.root;
        if (anchorObj) {
          this.playerGoldAura.position.set(
            anchorObj.position.x,
            activeRole === 'drums'
              ? DRUM_RISER_TOP_Y
              : activeRole === 'piano'
                ? KEYS_RISER_TOP_Y + 0.01
                : STAGE_DECK_TOP_Y + 0.02,
            anchorObj.position.z
          );
        }
        this.playerGoldAura.visible = true;
        this.playerGoldAura.rotation.y += dt * 1.4;
        const pulse = 0.85 + Math.sin(t * 7.5) * 0.15;
        this.playerGoldAuraRingMat.opacity = 0.68 * this.playerGoldAuraOpacity * pulse;
        this.playerGoldAuraBeamMat.opacity = 0.22 * this.playerGoldAuraOpacity * pulse;
      } else {
        this.playerGoldAura.visible = false;
      }
    }

    // Automatically fire stage spark fountains, CO2 cryo-jets & coordinated band jumps on Chorus drops, Solos, Outros & Fever!
    if (playing && !isWalkOn && (lightState.chorusDropTriggered || lightState.feverEntered || lightState.outroEntered)) {
      this.triggerStagePyro(lightState.feverEntered || lightState.outroEntered ? 1.35 : 1.1);
      this.triggerCryoJets(lightState.feverEntered ? 2.15 : 1.7);
      this.triggerBandJump(lightState.feverEntered ? 1.2 : 1.05);
    } else if (playing && !isWalkOn && lightState.soloEntered) {
      this.triggerCryoJets(1.1);
    }

    if (isWalkOn) {
      // Dim house lights while overhead spotlights sweep dramatically across the stage!
      const dimFactor = 0.24 + walkEase * 0.76;
      this.hemiLight.intensity = 0.82 * dimFactor * lightState.hemiMult;
      this.frontKey.intensity = metaKeyInt * dimFactor * lightState.keyMult;

      const stride = Math.sin(t * 14);
      const movingFactor = Math.max(0, 1 - Math.max(0, (walkP - 0.68) / 0.18));

      // 1. DRUMMER jogs from rear wing, hops onto the elevated drum riser, sits, and spins drumsticks!
      const drumMove = Math.min(1, walkP / 0.62);
      const drumEase = 1 - Math.pow(1 - drumMove, 2.2);
      const riserHop = drumMove > 0.55 && drumMove < 0.92 ? Math.sin(((drumMove - 0.55) / 0.37) * Math.PI) * 0.48 : 0;
      const targetDrumY = marks.drums?.y ?? DRUM_RISER_TOP_Y;
      const drumY = (drumMove < 0.65 ? (drumMove / 0.65) * targetDrumY : targetDrumY) + riserHop;
      this.drummer.root.position.set(
        THREE.MathUtils.lerp(-6.4, marks.drums?.x ?? 0, drumEase),
        drumY,
        THREE.MathUtils.lerp(-4.6, marks.drums?.z ?? -2.8, drumEase)
      );
      this.drummer.root.rotation.y = THREE.MathUtils.lerp(1.35, 0, drumEase);
      const seatedLerp = Math.max(0, Math.min(1, (walkP - 0.58) / 0.22));
      this.drummer.leftLegPivot.rotation.x = THREE.MathUtils.lerp(stride * 0.55 * (1 - seatedLerp), -1.15, seatedLerp);
      this.drummer.rightLegPivot.rotation.x = THREE.MathUtils.lerp(-stride * 0.55 * (1 - seatedLerp), -1.15, seatedLerp);
      this.drummer.upperBody.position.y = THREE.MathUtils.lerp(0.96, 0.72, seatedLerp);
      this.drummer.upperBody.rotation.x = 0.08;
      this.drummer.headGroup.rotation.x = Math.sin(t * 6) * 0.1;
      if (seatedLerp > 0.6) {
        this.drummer.leftArmPivot.rotation.set(-0.62, 0, 0.24);
        this.drummer.rightArmPivot.rotation.set(-0.66, 0, -0.24);
        this.drummer.leftElbowPivot.rotation.x = -0.78;
        this.drummer.rightElbowPivot.rotation.x = -0.82;
        if (this.leftDrumstick) this.leftDrumstick.rotation.x = Math.PI * 0.44 + t * 18;
        if (this.rightDrumstick) this.rightDrumstick.rotation.x = Math.PI * 0.44 - t * 18;
      } else {
        this.drummer.leftArmPivot.rotation.set(-stride * 0.6, 0, 0.1);
        this.drummer.rightArmPivot.rotation.set(stride * 0.6, 0, -0.1);
        this.drummer.leftElbowPivot.rotation.x = -0.28;
        this.drummer.rightElbowPivot.rotation.x = -0.28;
      }

      // 2. LEAD GUITARIST walks in from stage left to lineup mark (left wing or center mic for Singing Guitarist)
      const guitMove = Math.min(1, walkP / 0.66);
      const guitEase = 1 - Math.pow(1 - guitMove, 2.2);
      this.guitarist.root.position.set(
        THREE.MathUtils.lerp(-9.4, marks.guitar.x, guitEase),
        Math.abs(stride) * 0.1 * movingFactor,
        THREE.MathUtils.lerp(-1.5, marks.guitar.z, guitEase)
      );
      this.guitarist.root.rotation.y = THREE.MathUtils.lerp(1.45, marks.guitar.rotY, guitEase);
      this.guitarist.leftLegPivot.rotation.set(stride * 0.58 * movingFactor, 0, 0);
      this.guitarist.rightLegPivot.rotation.set(-stride * 0.58 * movingFactor, 0, 0);
      const strapLerp = Math.max(0, Math.min(1, (walkP - 0.55) / 0.35));
      this.electricGuitar.rotation.set(0.06, 0.08, THREE.MathUtils.lerp(-0.95, 0.26, strapLerp));
      this.guitarist.leftArmPivot.rotation.set(THREE.MathUtils.lerp(-0.4, -0.72, strapLerp), 0, 0.26);
      this.guitarist.rightArmPivot.rotation.set(THREE.MathUtils.lerp(-0.35, -0.64, strapLerp), 0, -0.35);
      this.guitarist.leftElbowPivot.rotation.x = THREE.MathUtils.lerp(-0.22, -0.62, strapLerp);
      this.guitarist.rightElbowPivot.rotation.x = THREE.MathUtils.lerp(-0.22, -0.56, strapLerp);

      // 3. BASSIST walks in from stage right to lineup mark
      const bassMove = Math.min(1, walkP / 0.68);
      const bassEase = 1 - Math.pow(1 - bassMove, 2.2);
      this.bassist.root.position.set(
        THREE.MathUtils.lerp(9.4, marks.bass.x, bassEase),
        Math.abs(stride) * 0.1 * movingFactor,
        THREE.MathUtils.lerp(-1.5, marks.bass.z, bassEase)
      );
      this.bassist.root.rotation.y = THREE.MathUtils.lerp(-1.45, marks.bass.rotY, bassEase);
      this.bassist.leftLegPivot.rotation.set(-stride * 0.56 * movingFactor, 0, 0);
      this.bassist.rightLegPivot.rotation.set(stride * 0.56 * movingFactor, 0, 0);
      this.bassist.upperBody.position.y = 0.96;
      this.bassGuitar.rotation.set(0.05, -0.08, THREE.MathUtils.lerp(-0.9, 0.3, strapLerp));
      this.bassist.leftArmPivot.rotation.set(THREE.MathUtils.lerp(-0.4, -0.68, strapLerp), 0, 0.28);
      this.bassist.rightArmPivot.rotation.set(THREE.MathUtils.lerp(-0.35, -0.6, strapLerp), 0, -0.32);
      this.bassist.leftElbowPivot.rotation.x = THREE.MathUtils.lerp(-0.22, -0.58, strapLerp);
      this.bassist.rightElbowPivot.rotation.x = THREE.MathUtils.lerp(-0.22, -0.52, strapLerp);

      // Flash amp LEDs brightly when plugging cables in (~walkP 0.58..0.78)
      const ampPowerFlash = walkP > 0.54 && walkP < 0.82 ? 3.8 : 0.6 + walkEase * 1.1;
      this.ampLedMats.forEach((m) => {
        m.emissiveIntensity = ampPowerFlash;
      });

      // 4. VOCALIST strides out to center mark (when lineup includes vocalist)
      if (marks.vocals.visible) {
        const vocMove = Math.min(1, walkP / 0.64);
        const vocEase = 1 - Math.pow(1 - vocMove, 2.2);
        this.vocalist.root.position.set(
          THREE.MathUtils.lerp(6.2, marks.vocals.x, vocEase),
          Math.abs(stride) * 0.09 * movingFactor,
          THREE.MathUtils.lerp(-2.8, marks.vocals.z, vocEase)
        );
        this.vocalist.root.rotation.y = THREE.MathUtils.lerp(-1.1, marks.vocals.rotY, vocEase);
        this.vocalist.leftLegPivot.rotation.set(stride * 0.52 * movingFactor, 0, 0);
        this.vocalist.rightLegPivot.rotation.set(-stride * 0.52 * movingFactor, 0, 0);
        const waveAmp = Math.sin(t * 10) * 0.36;
        this.vocalist.leftArmPivot.rotation.set(vocEase > 0.72 ? -2.2 : -stride * 0.5, 0, vocEase > 0.72 ? -0.45 + waveAmp : 0.1);
        this.vocalist.rightArmPivot.rotation.set(vocEase > 0.72 ? -2.25 : stride * 0.5, 0, vocEase > 0.72 ? 0.45 - waveAmp : -0.1);
        this.vocalist.leftElbowPivot.rotation.x = vocEase > 0.72 ? -0.35 : -0.25;
        this.vocalist.rightElbowPivot.rotation.x = vocEase > 0.72 ? -0.35 : -0.25;
        this.vocalist.headGroup.rotation.y = Math.sin(t * 3.5) * 0.28;
      }
    } else {
      // Restore concert lighting blended with active LightingProfileController mood!
      this.hemiLight.intensity = THREE.MathUtils.damp(this.hemiLight.intensity, 0.82 * lightState.hemiMult, 6, dt);
      this.frontKey.intensity = THREE.MathUtils.damp(
        this.frontKey.intensity,
        metaKeyInt * lightState.keyMult + lightState.strobeFlash * 0.42,
        6,
        dt
      );
      this.ampLedMats.forEach((m) => {
        m.emissiveIntensity = THREE.MathUtils.damp(m.emissiveIntensity, 1.5 * lightState.rimMult, 6, dt);
      });

      // Advance section-aligned non-repeating Markov choreography + spring-damper physics!
      this.updateBandStageMotion(dt, {
        playing,
        songTime,
        bpm,
        moodId: lightState.moodId,
        currentSection,
        beatGrid,
        marks,
        guitarE,
        bassE,
        vocalE,
        fever,
        encore,
        sustainHeld: Boolean(stageState?.sustainHeld),
        combo,
      });

      const isSlowBallad = bpm < 95 || Boolean(lightState.isBallad);
      const isHeavyRock =
        bpm > 132 ||
        lightState.ambianceType === 'METAL_CHAOS' ||
        lightState.ambianceType === 'ROCK_ANTHEM';
      const moodIntensity = isSlowBallad ? 0.58 : isHeavyRock ? 1.28 : 0.92;

      const gM = this.memberMotion.guitar;
      const bM = this.memberMotion.bass;
      const vM = this.memberMotion.vocals;
      const bpmBeatPhase = resolvedBeatPhase * Math.PI * 2;
      const bpmEighthPhase = resolvedEighthPhase * Math.PI * 2;
      const bpmSixteenthPhase = resolvedSixteenthPhase * Math.PI * 2;
      const bpmHalfPhase = songTime * (bpm / 60) * Math.PI;
      // Multi-frequency organic sway using irrational frequency ratios (1.0, φ=1.618, e=2.718) so body sway never loops!
      const organicSwayG =
        (Math.sin(t * 1.15) * 0.52 + Math.sin(t * 1.8607) * 0.31 + Math.sin(t * 3.1257) * 0.17);
      const organicSwayB =
        (Math.sin(t * 1.05 + 1.4) * 0.52 + Math.sin(t * 1.6989 + 0.7) * 0.31 + Math.sin(t * 2.854 + 2.1) * 0.17);
      const organicSwayV =
        (Math.sin(t * 1.25 + 2.3) * 0.52 + Math.sin(t * 2.0225 + 1.1) * 0.31 + Math.sin(t * 3.3975 + 0.4) * 0.17);

      // Dynamic Band Facial Expressions driven by section, misses, flinches & song ambiance!
      if (this.membersByRole) {
        const isIntenseMoment =
          lightState.sectionType === 'GUITAR_SOLO' || isHeavyRock;
        const isClosedBalladMoment =
          isSlowBallad && (Boolean(stageState?.sustainHeld) || vocalE > 0.3);
        const isBeltMoment =
          lightState.isBallad ||
          Boolean(stageState?.sustainHeld) ||
          (lightState.sectionType === 'BRIDGE' && vocalE > 0.35);
        ['guitar', 'bass', 'drums', 'piano', 'vocals'].forEach((role) => {
          const member = this.membersByRole[role];
          if (!member?.setExpression) return;
          const isHurt =
            this.missedInstruments?.has(role) ||
            (this.missedInstrument && role === this.missedInstrument) ||
            (this.flinchTimers?.[role] || 0) > 0;
          if (isHurt) {
            member.setExpression('shocked');
          } else if (isClosedBalladMoment && (role === 'vocals' || role === this.activeInstrument || role === 'piano')) {
            member.setExpression('closed');
          } else if (role === 'vocals' && (isBeltMoment || vocalE > 0.48)) {
            member.setExpression('belt');
          } else if (isBeltMoment && (role === this.activeInstrument || role === 'piano')) {
            member.setExpression('belt');
          } else if (isIntenseMoment && (role === 'guitar' || role === 'drums' || role === 'bass')) {
            member.setExpression('intense');
          } else {
            member.setExpression('grin');
          }
        });
      }

      // Drummer stays strictly planted on elevated rear drum riser (kick-drum pedal leg pump + phrase-boundary crash stand-up!)
      const isCountIn = playing && songTime > -2.0 && songTime < -0.05;
      const combinedKick = Math.min(1.25, Math.max(this.drumKickImpulse, kickImpulse));
      const combinedSnare = Math.min(1.25, Math.max(this.drumLeftHit, snareImpulse, isSnareHit ? 0.85 : 0));
      const crashTrigger =
        !isCountIn &&
        ((this.drumRightTarget === 'crash' && this.drumRightHit > 0.22) ||
          (isPhraseBoundary && drumE > 0.25 && (lightState.sectionType === 'OUTRO' || lightState.sectionType === 'CHORUS' || this.breActive || fever)));
      const crashStandUp = crashTrigger
        ? Math.max(Math.sin(Math.min(1, this.drumRightHit) * Math.PI) * 0.16, isPhraseBoundary ? 0.13 : 0)
        : 0;
      const kickPedalLeg = combinedKick * 0.26 + Math.sin(bpmBeatPhase) * 0.04;
      const hihatPedalLeg = Math.sin(bpmEighthPhase) * (0.06 + drumE * 0.08);
      this.drummer.root.position.set(
        marks.drums?.x ?? 0,
        (marks.drums?.y ?? DRUM_RISER_TOP_Y) + crashStandUp,
        marks.drums?.z ?? -2.8
      );
      this.drummer.root.rotation.y = 0;
      this.drummer.leftLegPivot.rotation.set(-1.15 + hihatPedalLeg, 0, 0);
      this.drummer.rightLegPivot.rotation.set(-1.15 - kickPedalLeg, 0, 0);
      this.drummer.upperBody.position.y = 0.72 + crashStandUp * 0.55;
      if (this.leftDrumstick) this.leftDrumstick.rotation.x = Math.PI * 0.45;
      if (this.rightDrumstick) this.rightDrumstick.rotation.x = Math.PI * 0.45;

      // Apply live roaming X / Jump Y / Z / Yaw to Guitarist, Bassist & Vocalist!
      const gStepBounce = Math.abs(Math.sin(gM.walkPhase)) * 0.09 * gM.moveSpeed * (1 - gM.kneeDrop * 0.85);
      const bStepBounce = Math.abs(Math.sin(bM.walkPhase)) * 0.085 * bM.moveSpeed * (1 - bM.kneeDrop * 0.85);
      const vStepBounce = Math.abs(Math.sin(vM.walkPhase)) * 0.09 * vM.moveSpeed;

      this.guitarist.root.position.set(gM.x, Math.max(0, gM.jumpY + gStepBounce), gM.z);
      this.guitarist.root.rotation.y = gM.rotY;

      this.bassist.root.position.set(bM.x, Math.max(0, bM.jumpY + bStepBounce), bM.z);
      this.bassist.root.rotation.y = bM.rotY;

      this.vocalist.root.position.set(vM.x, Math.max(0, vM.jumpY + vStepBounce), vM.z);
      this.vocalist.root.rotation.y = vM.rotY;

      // 1. DRUMMER — True Audio-Locked Snare (Beats 2&4 + snareImpulse), Ride/Hi-Hat (eighthPhase), Crash (phraseBoundary) & Kick Pulse!
      const drumMissed = this.missedInstrument === 'drums';
      const drumSilentIdle = playing && songTime >= 0 && stemActivity.drums === false && this.drumLeftHit < 0.05 && this.drumRightHit < 0.05 && combinedKick < 0.08 && combinedSnare < 0.08;
      if (drumMissed) {
        this.drummer.upperBody.rotation.x = THREE.MathUtils.damp(this.drummer.upperBody.rotation.x, 0.36, 10, dt);
        this.drummer.headGroup.rotation.x = THREE.MathUtils.damp(this.drummer.headGroup.rotation.x, 0.28, 10, dt);
        this.drummer.leftArmPivot.rotation.x = THREE.MathUtils.damp(this.drummer.leftArmPivot.rotation.x, 0.15, 10, dt);
        this.drummer.rightArmPivot.rotation.x = THREE.MathUtils.damp(this.drummer.rightArmPivot.rotation.x, 0.15, 10, dt);
        this.drummer.leftElbowPivot.rotation.x = THREE.MathUtils.damp(this.drummer.leftElbowPivot.rotation.x, -0.2, 10, dt);
        this.drummer.rightElbowPivot.rotation.x = THREE.MathUtils.damp(this.drummer.rightElbowPivot.rotation.x, -0.2, 10, dt);
      } else if (isCountIn) {
        const clickPulse = Math.pow(Math.max(0, Math.sin(songTime * (bpm / 60) * Math.PI * 2)), 4);
        this.drummer.upperBody.rotation.x = THREE.MathUtils.damp(this.drummer.upperBody.rotation.x, 0.05, 10, dt);
        this.drummer.headGroup.rotation.x = Math.sin(songTime * (bpm / 60) * Math.PI * 2) * 0.14;
        this.drummer.leftArmPivot.rotation.set(-1.95, 0, -0.26 + clickPulse * 0.22);
        this.drummer.rightArmPivot.rotation.set(-1.95, 0, 0.26 - clickPulse * 0.22);
        this.drummer.leftElbowPivot.rotation.x = -0.35;
        this.drummer.rightElbowPivot.rotation.x = -0.35;
      } else if (drumSilentIdle) {
        const nod = Math.sin(bpmBeatPhase) * (isSlowBallad ? 0.07 : 0.11);
        this.drummer.upperBody.rotation.x = THREE.MathUtils.damp(this.drummer.upperBody.rotation.x, 0.06 + Math.abs(nod) * 0.12, 8, dt);
        this.drummer.headGroup.rotation.x = THREE.MathUtils.damp(this.drummer.headGroup.rotation.x, nod, 9, dt);
        this.drummer.leftArmPivot.rotation.x = THREE.MathUtils.damp(this.drummer.leftArmPivot.rotation.x, -0.44, 8, dt);
        this.drummer.leftArmPivot.rotation.z = THREE.MathUtils.damp(this.drummer.leftArmPivot.rotation.z, 0.14, 8, dt);
        this.drummer.rightArmPivot.rotation.x = THREE.MathUtils.damp(this.drummer.rightArmPivot.rotation.x, -0.46, 8, dt);
        this.drummer.rightArmPivot.rotation.z = THREE.MathUtils.damp(this.drummer.rightArmPivot.rotation.z, -0.14, 8, dt);
        this.drummer.leftElbowPivot.rotation.x = THREE.MathUtils.damp(this.drummer.leftElbowPivot.rotation.x, -0.68, 8, dt);
        this.drummer.rightElbowPivot.rotation.x = THREE.MathUtils.damp(this.drummer.rightElbowPivot.rotation.x, -0.7, 8, dt);
        if (this.rightDrumstick) this.rightDrumstick.rotation.x = Math.PI * 0.44;
        if (this.leftDrumstick) this.leftDrumstick.rotation.x = Math.PI * 0.44;
        if (this.drumKit?.kick) this.drumKit.kick.scale.set(1, 1, 1);
      } else {
        // Left arm snaps snare on Beats 2 & 4 (isSnareHit) + snareImpulse peaks with realistic recoil
        const snareSnap =
          this.drumLeftHit > 0.05
            ? -Math.sin(this.drumLeftHit * Math.PI) * 0.96
            : -Math.sin(Math.min(1, combinedSnare) * Math.PI * 0.85) * (0.85 * moodIntensity);
        // Right arm drives ride/hi-hat strictly on eighthPhase + sweeps up to crash on phrase boundaries
        const eighthHiHat = Math.sin(bpmEighthPhase) * (0.24 + drumE * 0.36) * moodIntensity;
        const strikeR =
          this.drumRightHit > 0.05
            ? -Math.sin(this.drumRightHit * Math.PI) * 1.0
            : crashTrigger
              ? -0.92
              : eighthHiHat;

        const leftAimZ = this.drumLeftTarget === 'hihat' ? 0.36 : -0.14;
        const rightAimZ = this.drumRightTarget === 'crash' || crashTrigger ? -0.46 : 0.14;
        const rightLiftX = (this.drumRightTarget === 'crash' && this.drumRightHit > 0.1) || crashTrigger ? -0.58 : 0;

        this.drummer.upperBody.rotation.x = THREE.MathUtils.damp(
          this.drummer.upperBody.rotation.x,
          0.07 + (drumE * 0.1 + combinedKick * 0.12 + combinedSnare * 0.1) * moodIntensity + crashStandUp * 0.32,
          14,
          dt
        );
        this.drummer.headGroup.rotation.x = Math.sin(bpmBeatPhase) * (0.08 + combinedKick * 0.14 + drumE * 0.14) * moodIntensity;
        this.drummer.leftArmPivot.rotation.x = -0.46 + snareSnap * 0.56 * hypeBoost;
        this.drummer.leftArmPivot.rotation.z = THREE.MathUtils.damp(this.drummer.leftArmPivot.rotation.z, leftAimZ, 14, dt);
        this.drummer.rightArmPivot.rotation.x = -0.48 + rightLiftX * 0.65 + strikeR * 0.52 * hypeBoost;
        this.drummer.rightArmPivot.rotation.z = THREE.MathUtils.damp(this.drummer.rightArmPivot.rotation.z, rightAimZ, 14, dt);
        this.drummer.leftElbowPivot.rotation.x = -0.68 + snareSnap * 0.48;
        this.drummer.rightElbowPivot.rotation.x = -0.68 + rightLiftX * 0.35 + strikeR * 0.45;
        this.drummer.leftWristPivot.rotation.x = snareSnap * 0.44;
        this.drummer.rightWristPivot.rotation.x = strikeR * 0.4;

        if (this.drumKit?.cymbals?.length >= 3) {
          this.drumKit.cymbals[0].rotation.z = Math.sin(this.cymbalPhase[0]) * (drumE * 0.1 + this.cymbalWobble[0] * 0.28 + Math.abs(eighthHiHat) * 0.08);
          this.drumKit.cymbals[1].rotation.x = Math.sin(this.cymbalPhase[1]) * (drumE * 0.12 + this.cymbalWobble[1] * 0.4);
          this.drumKit.cymbals[2].rotation.x = Math.cos(this.cymbalPhase[2]) * (drumE * 0.12 + this.cymbalWobble[2] * 0.44);
          this.drumKit.cymbals[2].rotation.z = Math.sin(this.cymbalPhase[2] * 0.7) * this.cymbalWobble[2] * 0.26;
        }

        // Animated kick-drum beater/head pulse directly synced to kickImpulse
        const kickScale = 1 + combinedKick * 0.13 + drumE * 0.035;
        if (this.drumKit?.kick) this.drumKit.kick.scale.set(kickScale, 1 + combinedKick * 0.04, kickScale);
      }

      // 2. LEAD GUITARIST — Riff-Locked Strumming, Pitch/Bend Fretting Slide, Beat-Phase Headbang & Dramatic Back-Arch Solo Lean!
      const guitarMissed = this.missedInstrument === 'guitar';
      const guitarSilentIdle = playing && songTime >= 0 && stemActivity.guitar === false && this.guitarStrumImpulse < 0.05 && guitarRiffEnergy < 0.08;
      const isSingingGuitarist = this.bandLineupId === 'singing-guitarist';
      const gAirborne = gM.jumpY > 0.05;
      const gKneeDrop = gM.kneeDrop;
      const gPowerSpread =
        gM.stanceMode === 'POWER_SLIDE' || gM.stanceMode === 'ENCORE_SLIDE' ? 0.32 :
        gM.stanceMode === 'POWER_STANCE' ? 0.28 :
        gM.stanceMode === 'EDGE_MONITOR' || gM.stanceMode === 'BACK_TO_BACK' ? 0.24 :
        gM.stanceMode === 'TRUSS_STRIDE' ? 0.18 : 0.12;
      const gStride = Math.sin(gM.walkPhase) * 0.62 * gM.moveSpeed * (1 - gKneeDrop * 0.8);
      const gRockStanceBend = !gAirborne && playing ? Math.max(0, Math.sin(bpmBeatPhase)) * (0.1 + guitarRiffEnergy * 0.18) : 0;
      const gKneeTuck = gAirborne ? -0.58 : -Math.max(0, gM.squash) * 0.65 - gRockStanceBend;
      const gLungeOffset = gM.stanceMode === 'POWER_SLIDE' ? 0.28 : gM.stanceMode === 'EDGE_MONITOR' ? 0.16 : 0;

      const gLeftLegTargetX = gAirborne
        ? gKneeTuck
        : gStride - gLungeOffset + gKneeTuck - gKneeDrop * 0.92;
      const gRightLegTargetX = gAirborne
        ? gKneeTuck * 0.85
        : -gStride + gLungeOffset * 0.85 + gKneeTuck + gKneeDrop * 0.82;

      this.guitarist.leftLegPivot.rotation.x = THREE.MathUtils.damp(this.guitarist.leftLegPivot.rotation.x, gLeftLegTargetX, 14, dt);
      this.guitarist.rightLegPivot.rotation.x = THREE.MathUtils.damp(this.guitarist.rightLegPivot.rotation.x, gRightLegTargetX, 14, dt);
      this.guitarist.leftLegPivot.rotation.z = THREE.MathUtils.damp(
        this.guitarist.leftLegPivot.rotation.z,
        gPowerSpread * (1 - gM.moveSpeed * 0.65) + gKneeDrop * 0.16,
        10,
        dt
      );
      this.guitarist.rightLegPivot.rotation.z = THREE.MathUtils.damp(
        this.guitarist.rightLegPivot.rotation.z,
        -gPowerSpread * (1 - gM.moveSpeed * 0.65) - gKneeDrop * 0.14,
        10,
        dt
      );
      const gSquashDip = Math.max(-0.08, gM.squash * 0.24) + gLungeOffset * 0.22 + gKneeDrop * 0.34 + gRockStanceBend * 0.22;
      this.guitarist.upperBody.position.y = THREE.MathUtils.damp(
        this.guitarist.upperBody.position.y,
        0.96 - gSquashDip,
        14,
        dt
      );

      if (guitarMissed) {
        this.guitarist.upperBody.rotation.x = THREE.MathUtils.damp(this.guitarist.upperBody.rotation.x, 0.46, 10, dt);
        this.guitarist.upperBody.rotation.z = THREE.MathUtils.damp(this.guitarist.upperBody.rotation.z, -0.14, 10, dt);
        this.guitarist.headGroup.rotation.x = THREE.MathUtils.damp(this.guitarist.headGroup.rotation.x, 0.32, 10, dt);
        this.guitarist.rightArmPivot.rotation.x = THREE.MathUtils.damp(this.guitarist.rightArmPivot.rotation.x, 0.1, 10, dt);
        this.guitarist.leftArmPivot.rotation.x = THREE.MathUtils.damp(this.guitarist.leftArmPivot.rotation.x, 0.1, 10, dt);
        this.guitarist.leftElbowPivot.rotation.x = THREE.MathUtils.damp(this.guitarist.leftElbowPivot.rotation.x, -0.15, 10, dt);
        this.guitarist.rightElbowPivot.rotation.x = THREE.MathUtils.damp(this.guitarist.rightElbowPivot.rotation.x, -0.15, 10, dt);
      } else if (guitarSilentIdle) {
        const nod = Math.sin(bpmBeatPhase) * (isSlowBallad ? 0.07 : 0.11);
        const footTap = Math.max(0, Math.sin(bpmBeatPhase)) * 0.08;
        this.electricGuitar.position.set(0.08, 0.42, 0.38);
        this.electricGuitar.rotation.set(0.06, 0.08, THREE.MathUtils.damp(this.electricGuitar.rotation.z, 0.14, 6, dt));
        if (gM.moveSpeed < 0.08) {
          this.guitarist.rightLegPivot.rotation.x = THREE.MathUtils.damp(this.guitarist.rightLegPivot.rotation.x, footTap, 10, dt);
        }
        this.guitarist.upperBody.rotation.x = THREE.MathUtils.damp(this.guitarist.upperBody.rotation.x, 0.04, 6, dt);
        this.guitarist.upperBody.rotation.z = THREE.MathUtils.damp(this.guitarist.upperBody.rotation.z, organicSwayG * 0.06 * moodIntensity, 6, dt);
        this.guitarist.headGroup.rotation.x = THREE.MathUtils.damp(this.guitarist.headGroup.rotation.x, nod, 9, dt);
        this.guitarist.rightArmPivot.rotation.x = THREE.MathUtils.damp(this.guitarist.rightArmPivot.rotation.x, -0.34, 8, dt);
        this.guitarist.rightArmPivot.rotation.z = THREE.MathUtils.damp(this.guitarist.rightArmPivot.rotation.z, -0.26, 8, dt);
        this.guitarist.leftArmPivot.rotation.x = THREE.MathUtils.damp(this.guitarist.leftArmPivot.rotation.x, -0.44, 7, dt);
        this.guitarist.leftArmPivot.rotation.z = THREE.MathUtils.damp(this.guitarist.leftArmPivot.rotation.z, 0.16, 7, dt);
        this.guitarist.leftElbowPivot.rotation.x = THREE.MathUtils.damp(this.guitarist.leftElbowPivot.rotation.x, -0.44, 8, dt);
        this.guitarist.rightElbowPivot.rotation.x = THREE.MathUtils.damp(this.guitarist.rightElbowPivot.rotation.x, -0.42, 8, dt);
      } else {
        const isSoloSec = lightState.sectionType === 'GUITAR_SOLO' || te?.overallIntensity === 'GUITAR SOLO';
        const behindHeadSolo = isSoloSec && combo >= 25 && !isSingingGuitarist && gKneeDrop < 0.2;
        const neckSkyBoost = (gM.action === 'NECK_SKY_SOLO' ? 0.34 : isSoloSec ? 0.24 : 0) + guitarBendPulse * 0.22;
        const guitarNeckTilt = 0.26 + gM.sustainLean * 0.26 + gKneeDrop * 0.28 + neckSkyBoost + (gAirborne ? 0.18 : 0);
        if (behindHeadSolo) {
          this.electricGuitar.position.set(0.02, 1.06, -0.06);
          this.electricGuitar.rotation.set(0.18, 0.04, 0.14);
        } else {
          this.electricGuitar.position.set(0.08, 0.42, 0.38);
          this.electricGuitar.rotation.set(0.06, 0.08, THREE.MathUtils.damp(this.electricGuitar.rotation.z, guitarNeckTilt, 10, dt));
        }

        // Strumming arm snaps downward on guitarRiffEnergy transients & note impulses
        const chugPulse =
          (lightState.sectionType === 'CHORUS' || lightState.sectionType === 'OUTRO')
            ? Math.sin(bpmBeatPhase) * 0.09 * moodIntensity
            : 0;
        const riffStrumSnap = guitarRiffEnergy * 0.54 * Math.sin(bpmEighthPhase);
        const impulseStrum = this.guitarStrumImpulse * 0.62 * this.guitarStrumDir;
        const headBangAmp = ((lightState.sectionType === 'INTRO' ? 0.06 : 0.12) + guitarRiffEnergy * 0.24 + this.guitarHeadbangBoost * 0.22) * moodIntensity;
        const bob = Math.sin(bpmBeatPhase) * headBangAmp;
        const singLean = isSingingGuitarist ? 0.1 + vocalE * 0.15 : 0;
        const slideForwardLean = gM.stanceMode === 'POWER_SLIDE' ? 0.2 : gM.stanceMode === 'EDGE_MONITOR' ? 0.14 : 0;
        // Dramatic back-arch solo lean during GUITAR SOLO driven by guitarBendPulse!
        const soloBackArch = isSoloSec ? -(0.24 + guitarBendPulse * 0.22) : -(guitarBendPulse * 0.14);
        const sustainBackLean = -(gM.sustainLean * 0.26 + gKneeDrop * 0.22) + soloBackArch;

        this.guitarist.upperBody.rotation.x = THREE.MathUtils.damp(
          this.guitarist.upperBody.rotation.x,
          Math.abs(bob) * 0.34 + this.guitarHeadbangBoost * 0.12 + singLean + slideForwardLean + sustainBackLean + chugPulse,
          12,
          dt
        );
        this.guitarist.upperBody.rotation.z = THREE.MathUtils.damp(
          this.guitarist.upperBody.rotation.z,
          organicSwayG * (0.07 + guitarRiffEnergy * 0.14) - gStride * 0.12,
          10,
          dt
        );
        this.guitarist.headGroup.rotation.x = isSingingGuitarist
          ? -0.08 + Math.sin(bpmBeatPhase) * (0.05 + vocalE * 0.14)
          : bob - gM.sustainLean * 0.2 - gKneeDrop * 0.2 + soloBackArch * 0.55;
        this.guitarist.headGroup.rotation.y = isSingingGuitarist ? organicSwayG * 0.08 : organicSwayG * 0.24;

        // Fretting hand slides smoothly along guitar neck proportional to pitch/guitarFretPos + guitarRiffEnergy + guitarBendPulse vibrato
        const dynamicFretPos = Math.max(
          0,
          Math.min(1, this.guitarFretPos * 0.65 + guitarRiffEnergy * 0.25 + guitarBendPulse * 0.2)
        );
        const vibratoShake = (isSoloSec || guitarBendPulse > 0.25) ? Math.sin(t * 22.0) * (0.05 + guitarBendPulse * 0.1) : 0;

        if (behindHeadSolo) {
          this.guitarist.rightArmPivot.rotation.set(-2.15 + Math.sin(bpmEighthPhase) * 0.2, 0, -0.45);
          this.guitarist.leftArmPivot.rotation.set(-2.22 + vibratoShake, 0, 0.48);
          this.guitarist.leftElbowPivot.rotation.x = -0.65;
          this.guitarist.rightElbowPivot.rotation.x = -0.65;
        } else if (gM.windmillTimer > 0) {
          this.guitarist.rightArmPivot.rotation.x = -0.9 + gM.windmillPhase;
          this.guitarist.rightArmPivot.rotation.z = -0.42 + Math.sin(gM.windmillPhase) * 0.18;
          this.guitarist.rightElbowPivot.rotation.x = -0.14;
          const targetFretZ = 0.12 + dynamicFretPos * 0.46 + vibratoShake;
          const targetFretX = -0.64 + dynamicFretPos * 0.24 - gM.sustainLean * 0.14 - gKneeDrop * 0.12;
          this.guitarist.leftArmPivot.rotation.x = THREE.MathUtils.damp(this.guitarist.leftArmPivot.rotation.x, targetFretX, 14, dt);
          this.guitarist.leftArmPivot.rotation.z = THREE.MathUtils.damp(this.guitarist.leftArmPivot.rotation.z, targetFretZ, 14, dt);
          this.guitarist.leftElbowPivot.rotation.x = THREE.MathUtils.damp(this.guitarist.leftElbowPivot.rotation.x, -0.72, 14, dt);
        } else if (gM.fistPumpWeight > 0.35 && this.guitarStrumImpulse < 0.15 && guitarRiffEnergy < 0.35) {
          this.guitarist.rightArmPivot.rotation.x = THREE.MathUtils.lerp(
            -0.55 + riffStrumSnap * 0.55,
            -2.1 + Math.sin(bpmBeatPhase) * 0.35,
            gM.fistPumpWeight
          );
          this.guitarist.rightArmPivot.rotation.z = -0.35;
          this.guitarist.rightElbowPivot.rotation.x = THREE.MathUtils.lerp(-0.62, -0.25, gM.fistPumpWeight);
          this.guitarist.leftArmPivot.rotation.x = THREE.MathUtils.damp(this.guitarist.leftArmPivot.rotation.x, -0.64 + dynamicFretPos * 0.24, 14, dt);
          this.guitarist.leftArmPivot.rotation.z = THREE.MathUtils.damp(this.guitarist.leftArmPivot.rotation.z, 0.12 + dynamicFretPos * 0.46, 14, dt);
          this.guitarist.leftElbowPivot.rotation.x = THREE.MathUtils.damp(this.guitarist.leftElbowPivot.rotation.x, -0.72, 14, dt);
        } else {
          const strumDelta = (riffStrumSnap + impulseStrum) * hypeBoost;
          this.guitarist.rightArmPivot.rotation.x = -0.54 + strumDelta * 0.58;
          this.guitarist.rightArmPivot.rotation.z = -0.35;
          this.guitarist.rightElbowPivot.rotation.x = -0.64 + strumDelta * 0.54;
          this.guitarist.rightWristPivot.rotation.x = strumDelta * 0.3;
          const targetFretZ = 0.12 + dynamicFretPos * 0.46 + vibratoShake;
          const targetFretX = -0.64 + dynamicFretPos * 0.24 - gM.sustainLean * 0.14 - gKneeDrop * 0.12;
          this.guitarist.leftArmPivot.rotation.x = THREE.MathUtils.damp(this.guitarist.leftArmPivot.rotation.x, targetFretX, 14, dt);
          this.guitarist.leftArmPivot.rotation.z = THREE.MathUtils.damp(this.guitarist.leftArmPivot.rotation.z, targetFretZ, 14, dt);
          this.guitarist.leftElbowPivot.rotation.x = THREE.MathUtils.damp(this.guitarist.leftElbowPivot.rotation.x, -0.72 + dynamicFretPos * 0.14, 14, dt);
        }
      }

      // 3. BASSIST — Heavy Pocket Head-Nod (beatPhase), BassGroove-Synced Finger/Pick Plucking & Tight Pocket Sway!
      const bassMissed = this.missedInstrument === 'bass';
      const bassSilentIdle = playing && songTime >= 0 && stemActivity.bass === false && this.bassPluckImpulse < 0.05 && bassGroove < 0.08;
      const bAirborne = bM.jumpY > 0.05;
      const bKneeDrop = bM.kneeDrop;
      const bPowerSpread =
        bM.stanceMode === 'POWER_SLIDE' || bM.stanceMode === 'ENCORE_SLIDE' ? 0.3 :
        bM.stanceMode === 'POWER_STANCE' ? 0.25 :
        bM.stanceMode === 'BACK_TO_BACK' || bM.stanceMode === 'EDGE_MONITOR' ? 0.22 : 0.12;
      const bStride = Math.sin(bM.walkPhase) * 0.58 * bM.moveSpeed * (1 - bKneeDrop * 0.8);
      const bKneeTuck = bAirborne ? -0.55 : -Math.max(0, bM.squash) * 0.62;

      this.bassist.leftLegPivot.rotation.z = THREE.MathUtils.damp(
        this.bassist.leftLegPivot.rotation.z,
        bPowerSpread * (1 - bM.moveSpeed * 0.65),
        10,
        dt
      );
      this.bassist.rightLegPivot.rotation.z = THREE.MathUtils.damp(
        this.bassist.rightLegPivot.rotation.z,
        -bPowerSpread * (1 - bM.moveSpeed * 0.65),
        10,
        dt
      );

      if (bassMissed) {
        this.bassist.upperBody.rotation.x = THREE.MathUtils.damp(this.bassist.upperBody.rotation.x, 0.45, 10, dt);
        this.bassist.upperBody.rotation.z = THREE.MathUtils.damp(this.bassist.upperBody.rotation.z, 0.12, 10, dt);
        this.bassist.headGroup.rotation.x = THREE.MathUtils.damp(this.bassist.headGroup.rotation.x, 0.3, 10, dt);
        this.bassist.leftLegPivot.rotation.x = THREE.MathUtils.damp(this.bassist.leftLegPivot.rotation.x, 0, 10, dt);
        this.bassist.rightLegPivot.rotation.x = THREE.MathUtils.damp(this.bassist.rightLegPivot.rotation.x, 0, 10, dt);
        this.bassist.leftElbowPivot.rotation.x = THREE.MathUtils.damp(this.bassist.leftElbowPivot.rotation.x, -0.15, 10, dt);
        this.bassist.rightElbowPivot.rotation.x = THREE.MathUtils.damp(this.bassist.rightElbowPivot.rotation.x, -0.15, 10, dt);
      } else if (bassSilentIdle) {
        const nod = Math.sin(bpmBeatPhase) * (isSlowBallad ? 0.07 : 0.11);
        const footTap = Math.max(0, Math.sin(bpmBeatPhase)) * 0.08;
        this.bassGuitar.rotation.set(0.05, -0.08, THREE.MathUtils.damp(this.bassGuitar.rotation.z, 0.16, 6, dt));
        this.bassist.leftLegPivot.rotation.x = THREE.MathUtils.damp(this.bassist.leftLegPivot.rotation.x, bStride + bKneeTuck, 10, dt);
        this.bassist.rightLegPivot.rotation.x = THREE.MathUtils.damp(this.bassist.rightLegPivot.rotation.x, bM.moveSpeed < 0.08 ? footTap : -bStride + bKneeTuck, 10, dt);
        this.bassist.upperBody.position.y = THREE.MathUtils.damp(this.bassist.upperBody.position.y, 0.96 - Math.max(0, bM.squash * 0.22), 9, dt);
        this.bassist.upperBody.rotation.x = THREE.MathUtils.damp(this.bassist.upperBody.rotation.x, 0.04, 6, dt);
        this.bassist.upperBody.rotation.z = THREE.MathUtils.damp(this.bassist.upperBody.rotation.z, organicSwayB * 0.06 * moodIntensity, 6, dt);
        this.bassist.headGroup.rotation.x = THREE.MathUtils.damp(this.bassist.headGroup.rotation.x, nod, 9, dt);
        this.bassist.rightArmPivot.rotation.x = THREE.MathUtils.damp(this.bassist.rightArmPivot.rotation.x, -0.34, 8, dt);
        this.bassist.rightArmPivot.rotation.z = THREE.MathUtils.damp(this.bassist.rightArmPivot.rotation.z, -0.24, 8, dt);
        this.bassist.leftArmPivot.rotation.x = THREE.MathUtils.damp(this.bassist.leftArmPivot.rotation.x, -0.44, 7, dt);
        this.bassist.leftArmPivot.rotation.z = THREE.MathUtils.damp(this.bassist.leftArmPivot.rotation.z, 0.16, 7, dt);
        this.bassist.leftElbowPivot.rotation.x = THREE.MathUtils.damp(this.bassist.leftElbowPivot.rotation.x, -0.42, 8, dt);
        this.bassist.rightElbowPivot.rotation.x = THREE.MathUtils.damp(this.bassist.rightElbowPivot.rotation.x, -0.4, 8, dt);
      } else {
        const bassNeckTilt = 0.3 + bM.sustainLean * 0.24 + bKneeDrop * 0.18 + (bAirborne ? 0.16 : 0);
        this.bassGuitar.rotation.set(0.05, -0.08, THREE.MathUtils.damp(this.bassGuitar.rotation.z, bassNeckTilt, 9, dt));
        // Heavy quarter/half-time pocket lock synced with drummer's kick & beatPhase
        const pocketPhase = isSlowBallad ? bpmHalfPhase : bpmBeatPhase;
        const deepBounceMult = bM.action === 'DEEP_KNEE_BOUNCE' ? 1.45 : 1.0;
        const kneeBend = Math.abs(Math.sin(pocketPhase)) * (0.14 + bassGroove * 0.3 + combinedKick * 0.14 + this.bassBounceImpulse * 0.18) * deepBounceMult * moodIntensity;
        const grooveSway = Math.sin(bpmHalfPhase) * (0.1 + bassGroove * 0.22) * hypeBoost * moodIntensity;
        const pluck = Math.sin(bpmEighthPhase) * (0.14 + bassGroove * 0.42) * moodIntensity + this.bassPluckImpulse * 0.48;
        const bSlideLean = bM.stanceMode === 'POWER_SLIDE' ? 0.2 : 0;

        this.bassist.leftLegPivot.rotation.x = THREE.MathUtils.damp(
          this.bassist.leftLegPivot.rotation.x,
          bAirborne ? bKneeTuck : bStride - kneeBend * 0.85 * (1 - bM.moveSpeed * 0.65) + bKneeTuck - bKneeDrop * 0.8,
          14,
          dt
        );
        this.bassist.rightLegPivot.rotation.x = THREE.MathUtils.damp(
          this.bassist.rightLegPivot.rotation.x,
          bAirborne ? bKneeTuck * 0.85 : -bStride - kneeBend * 0.85 * (1 - bM.moveSpeed * 0.65) + bKneeTuck + bKneeDrop * 0.72,
          14,
          dt
        );
        this.bassist.upperBody.position.y = THREE.MathUtils.damp(
          this.bassist.upperBody.position.y,
          0.96 - kneeBend * 0.22 - Math.max(-0.06, bM.squash * 0.24) - bKneeDrop * 0.28,
          14,
          dt
        );
        this.bassist.upperBody.rotation.x = THREE.MathUtils.damp(
          this.bassist.upperBody.rotation.x,
          0.08 + kneeBend * 0.36 + bSlideLean - bM.sustainLean * 0.3 - bKneeDrop * 0.16,
          12,
          dt
        );
        this.bassist.upperBody.rotation.z = THREE.MathUtils.damp(this.bassist.upperBody.rotation.z, grooveSway * 0.68, 10, dt);
        this.bassist.headGroup.rotation.x = Math.sin(pocketPhase) * (0.12 + bassGroove * 0.26) * moodIntensity - bM.sustainLean * 0.18;

        this.bassist.rightArmPivot.rotation.x = -0.52 + pluck * 0.54;
        this.bassist.rightArmPivot.rotation.z = -0.32;
        this.bassist.rightElbowPivot.rotation.x = -0.6 + pluck * 0.48;
        this.bassist.rightWristPivot.rotation.x = pluck * 0.32;
        const bassFretZ = 0.14 + Math.min(1, this.bassFretPos * 0.7 + bassGroove * 0.3) * 0.42;
        this.bassist.leftArmPivot.rotation.x = THREE.MathUtils.damp(this.bassist.leftArmPivot.rotation.x, -0.6 + this.bassFretPos * 0.2, 12, dt);
        this.bassist.leftArmPivot.rotation.z = THREE.MathUtils.damp(this.bassist.leftArmPivot.rotation.z, bassFretZ, 12, dt);
        this.bassist.leftElbowPivot.rotation.x = THREE.MathUtils.damp(this.bassist.leftElbowPivot.rotation.x, -0.66 + this.bassFretPos * 0.12, 12, dt);
      }

      // 4. FRONTPERSON / VOCALIST — Mic-Stand Lean & Chest-Pump (vocalKeysEnergy), Downbeat Crowd Hype Pump & B-Stage Run!
      if (marks.vocals.visible) {
        const isPopDiva = this.bandLineupId === 'pop-diva';
        const vAirborne = vM.jumpY > 0.05;
        const vEdgeKneel = !vAirborne && vM.stanceMode === 'EDGE_MONITOR' && (lightState.sectionType === 'BRIDGE' || lightState.sectionType === 'CHORUS');
        const vPopHeart = isPopDiva && (lightState.sectionType === 'BRIDGE' || streakTier >= 2);
        const vStride = Math.sin(vM.walkPhase) * 0.56 * vM.moveSpeed * (vEdgeKneel ? 0.1 : 1);
        const vKneeTuck = vAirborne ? -0.52 : -Math.max(0, vM.squash) * 0.55;
        const downbeatHype = isDownbeat ? 0.38 : Math.max(0, Math.cos(bpmBeatPhase)) * 0.24;
        const crowdHypeRaise =
          fever ||
          encore ||
          this.encoreFinaleActive ||
          lightState.sectionType === 'CHORUS' ||
          lightState.sectionType === 'OUTRO' ||
          vocalKeysEnergy > 0.52 ||
          isDownbeat;
        const danceSway = isPopDiva
          ? organicSwayV * (0.14 + vocalKeysEnergy * 0.18)
          : organicSwayV * (0.08 + vocalKeysEnergy * 0.15);

        this.vocalist.leftLegPivot.rotation.x = THREE.MathUtils.damp(
          this.vocalist.leftLegPivot.rotation.x,
          vAirborne ? vKneeTuck : vEdgeKneel ? -0.82 : vStride + vKneeTuck,
          13,
          dt
        );
        this.vocalist.rightLegPivot.rotation.x = THREE.MathUtils.damp(
          this.vocalist.rightLegPivot.rotation.x,
          vAirborne ? vKneeTuck * 0.85 : vEdgeKneel ? 0.72 : -vStride + vKneeTuck,
          13,
          dt
        );
        this.vocalist.upperBody.position.y = THREE.MathUtils.damp(
          this.vocalist.upperBody.position.y,
          0.96 - Math.max(-0.06, vM.squash * 0.22) - (vEdgeKneel ? 0.24 : 0) + downbeatHype * 0.05,
          14,
          dt
        );
        this.vocalist.upperBody.rotation.z = danceSway;
        this.vocalist.upperBody.rotation.x = THREE.MathUtils.damp(
          this.vocalist.upperBody.rotation.x,
          (vEdgeKneel ? 0.22 : 0.06) + vocalKeysEnergy * 0.24 + downbeatHype * 0.12,
          11,
          dt
        );
        this.vocalist.headGroup.rotation.x = -0.06 + Math.sin(bpmBeatPhase) * (0.06 + vocalKeysEnergy * 0.18);
        this.vocalist.headGroup.rotation.y = Math.sin(t * 2.4) * 0.16;

        // Expressive Mic-Stand Tilt synced to vocalKeysEnergy phrases when singing at center mark
        if (this.micStand && this.micStand.visible) {
          const micTiltTarget = !isPopDiva && vM.stanceMode === 'MIC_CENTER' ? -0.14 - vocalKeysEnergy * 0.22 : 0;
          this.micStand.rotation.x = THREE.MathUtils.damp(this.micStand.rotation.x, micTiltTarget, 9, dt);
        }

        if (vPopHeart) {
          this.vocalist.leftArmPivot.rotation.x = THREE.MathUtils.damp(this.vocalist.leftArmPivot.rotation.x, -1.7, 9, dt);
          this.vocalist.leftArmPivot.rotation.z = THREE.MathUtils.damp(this.vocalist.leftArmPivot.rotation.z, -0.58, 9, dt);
          this.vocalist.rightArmPivot.rotation.x = THREE.MathUtils.damp(this.vocalist.rightArmPivot.rotation.x, -1.7, 9, dt);
          this.vocalist.rightArmPivot.rotation.z = THREE.MathUtils.damp(this.vocalist.rightArmPivot.rotation.z, 0.58, 9, dt);
          this.vocalist.leftElbowPivot.rotation.x = THREE.MathUtils.damp(this.vocalist.leftElbowPivot.rotation.x, -0.55, 9, dt);
          this.vocalist.rightElbowPivot.rotation.x = THREE.MathUtils.damp(this.vocalist.rightElbowPivot.rotation.x, -0.55, 9, dt);
        } else if (vEdgeKneel) {
          this.vocalist.leftArmPivot.rotation.x = THREE.MathUtils.damp(this.vocalist.leftArmPivot.rotation.x, -1.25, 9, dt);
          this.vocalist.leftArmPivot.rotation.z = THREE.MathUtils.damp(this.vocalist.leftArmPivot.rotation.z, -0.18, 9, dt);
          this.vocalist.rightArmPivot.rotation.x = THREE.MathUtils.damp(this.vocalist.rightArmPivot.rotation.x, -1.35 - downbeatHype * 0.45, 9, dt);
          this.vocalist.rightArmPivot.rotation.z = THREE.MathUtils.damp(this.vocalist.rightArmPivot.rotation.z, 0.22, 9, dt);
          this.vocalist.leftElbowPivot.rotation.x = THREE.MathUtils.damp(this.vocalist.leftElbowPivot.rotation.x, -0.35, 9, dt);
          this.vocalist.rightElbowPivot.rotation.x = THREE.MathUtils.damp(this.vocalist.rightElbowPivot.rotation.x, -0.25, 9, dt);
        } else if (isPopDiva || vM.stanceMode !== 'MIC_CENTER') {
          this.vocalist.leftArmPivot.rotation.x = THREE.MathUtils.damp(
            this.vocalist.leftArmPivot.rotation.x,
            crowdHypeRaise ? -2.05 - downbeatHype * 0.35 : -0.7 - vocalKeysEnergy * 0.55,
            9,
            dt
          );
          this.vocalist.leftArmPivot.rotation.z = THREE.MathUtils.damp(
            this.vocalist.leftArmPivot.rotation.z,
            crowdHypeRaise ? -0.46 : -0.25 - vocalKeysEnergy * 0.2,
            8,
            dt
          );
          const rightArmTargetX = crowdHypeRaise ? -2.15 - downbeatHype * 0.45 : -0.65 - vocalKeysEnergy * 0.68;
          const rightArmTargetZ = crowdHypeRaise ? 0.48 : 0.25 + vocalKeysEnergy * 0.24;
          this.vocalist.rightArmPivot.rotation.x = THREE.MathUtils.damp(this.vocalist.rightArmPivot.rotation.x, rightArmTargetX, 9, dt);
          this.vocalist.rightArmPivot.rotation.z = THREE.MathUtils.damp(this.vocalist.rightArmPivot.rotation.z, rightArmTargetZ, 8, dt);
          this.vocalist.leftElbowPivot.rotation.x = THREE.MathUtils.damp(this.vocalist.leftElbowPivot.rotation.x, -0.45, 8, dt);
          this.vocalist.rightElbowPivot.rotation.x = THREE.MathUtils.damp(this.vocalist.rightElbowPivot.rotation.x, -0.42, 8, dt);
        } else {
          // Left hand holds mic at stand; free right arm pumps skyward on isDownbeat!
          this.vocalist.leftArmPivot.rotation.x = -0.68 - vocalKeysEnergy * 0.14;
          this.vocalist.leftArmPivot.rotation.z = -0.2;
          this.vocalist.leftElbowPivot.rotation.x = -0.52;
          const rightArmTargetX = crowdHypeRaise ? -2.15 - downbeatHype * 0.48 : -0.65 - vocalKeysEnergy * 0.68;
          const rightArmTargetZ = crowdHypeRaise ? 0.48 : 0.25 + vocalKeysEnergy * 0.24;
          this.vocalist.rightArmPivot.rotation.x = THREE.MathUtils.damp(this.vocalist.rightArmPivot.rotation.x, rightArmTargetX, 9, dt);
          this.vocalist.rightArmPivot.rotation.z = THREE.MathUtils.damp(this.vocalist.rightArmPivot.rotation.z, rightArmTargetZ, 8, dt);
          this.vocalist.rightElbowPivot.rotation.x = THREE.MathUtils.damp(this.vocalist.rightElbowPivot.rotation.x, -0.42, 8, dt);
        }
      }

      // 4B. KEYBOARDIST / SYNTH — Alternating L/R Chord Strikes Locked to vocalKeysEnergy & sixteenthPhase + Rhythmic Shoulder Bounce!
      if (this.keyboardist) {
        const pianoMissed = this.missedInstrument === 'piano';
        const isKeytar = Boolean(this.keyboardAsset?.isKeytar);
        const isSeatedGrand = this.keyboardModelId === 'concert-grand' || this.keyboardModelId === 'white-crystal-grand';
        const pianoSilentClap = playing && songTime >= 0 && stemActivity.piano === false && this.pianoHitImpulse < 0.05 && vocalKeysEnergy < 0.08;
        const keyCenterShift = (this.pianoHandPos - 0.5) * 0.42;

        if (isKeytar) {
          const walkFwdTargetZ =
            playing && (lightState.sectionType === 'CHORUS' || lightState.sectionType === 'GUITAR_SOLO' || this.breActive)
              ? 1.35
              : 0.15;
          this.keyboardist.root.position.z = THREE.MathUtils.damp(this.keyboardist.root.position.z, walkFwdTargetZ, 3.2, dt);
        }

        const shoulderBounce = Math.abs(Math.sin(bpmBeatPhase)) * (0.04 + vocalKeysEnergy * 0.06);
        if (isSeatedGrand) {
          const chorusBenchRise = lightState.sectionType === 'CHORUS' || this.breActive ? 0.07 : 0;
          this.keyboardist.leftLegPivot.rotation.set(-1.12, 0, 0);
          this.keyboardist.rightLegPivot.rotation.set(-1.12 + Math.sin(bpmBeatPhase) * 0.08, 0, 0);
          this.keyboardist.upperBody.position.y = THREE.MathUtils.damp(this.keyboardist.upperBody.position.y, 0.74 + chorusBenchRise + shoulderBounce * 0.5, 12, dt);
        } else {
          const stepTap = Math.sin(bpmBeatPhase) * (isKeytar ? 0.22 : 0.08);
          this.keyboardist.leftLegPivot.rotation.set(stepTap, 0, isKeytar ? 0.14 : 0.06);
          this.keyboardist.rightLegPivot.rotation.set(-stepTap, 0, isKeytar ? -0.14 : -0.06);
          this.keyboardist.upperBody.position.y = THREE.MathUtils.damp(this.keyboardist.upperBody.position.y, 0.96 - shoulderBounce * 0.55, 12, dt);
        }

        if (pianoMissed) {
          this.keyboardist.upperBody.rotation.x = THREE.MathUtils.damp(this.keyboardist.upperBody.rotation.x, 0.36, 10, dt);
          this.keyboardist.headGroup.rotation.x = THREE.MathUtils.damp(this.keyboardist.headGroup.rotation.x, 0.28, 10, dt);
          this.keyboardist.leftArmPivot.rotation.x = THREE.MathUtils.damp(this.keyboardist.leftArmPivot.rotation.x, 0.12, 10, dt);
          this.keyboardist.rightArmPivot.rotation.x = THREE.MathUtils.damp(this.keyboardist.rightArmPivot.rotation.x, 0.12, 10, dt);
          this.keyboardist.leftElbowPivot.rotation.x = THREE.MathUtils.damp(this.keyboardist.leftElbowPivot.rotation.x, -0.15, 10, dt);
          this.keyboardist.rightElbowPivot.rotation.x = THREE.MathUtils.damp(this.keyboardist.rightElbowPivot.rotation.x, -0.15, 10, dt);
        } else if (pianoSilentClap && !isKeytar) {
          const nod = Math.sin(bpmBeatPhase) * (isSlowBallad ? 0.07 : 0.1);
          this.keyboardist.upperBody.rotation.x = THREE.MathUtils.damp(this.keyboardist.upperBody.rotation.x, 0.06, 8, dt);
          this.keyboardist.upperBody.rotation.z = THREE.MathUtils.damp(this.keyboardist.upperBody.rotation.z, Math.sin(bpmHalfPhase) * 0.07 * moodIntensity, 8, dt);
          this.keyboardist.headGroup.rotation.x = THREE.MathUtils.damp(this.keyboardist.headGroup.rotation.x, nod, 9, dt);
          this.keyboardist.leftArmPivot.rotation.x = THREE.MathUtils.damp(this.keyboardist.leftArmPivot.rotation.x, -0.48, 8, dt);
          this.keyboardist.leftArmPivot.rotation.z = THREE.MathUtils.damp(this.keyboardist.leftArmPivot.rotation.z, 0.14, 8, dt);
          this.keyboardist.rightArmPivot.rotation.x = THREE.MathUtils.damp(this.keyboardist.rightArmPivot.rotation.x, -0.48, 8, dt);
          this.keyboardist.rightArmPivot.rotation.z = THREE.MathUtils.damp(this.keyboardist.rightArmPivot.rotation.z, -0.14, 8, dt);
          this.keyboardist.leftElbowPivot.rotation.x = THREE.MathUtils.damp(this.keyboardist.leftElbowPivot.rotation.x, -0.58, 8, dt);
          this.keyboardist.rightElbowPivot.rotation.x = THREE.MathUtils.damp(this.keyboardist.rightElbowPivot.rotation.x, -0.58, 8, dt);
        } else {
          const playEnergy = Math.max(pianoE, vocalKeysEnergy, this.pianoHitImpulse * 0.85);
          const sway = Math.sin(bpmHalfPhase) * (0.09 + playEnergy * 0.16) + keyCenterShift * 0.5;
          const glissLean = this.pianoGlissando * 0.24 * (this.pianoHandPos > 0.5 ? 1 : -1);

          this.keyboardist.upperBody.rotation.x = THREE.MathUtils.damp(
            this.keyboardist.upperBody.rotation.x,
            (isKeytar ? 0.06 : 0.16) + playEnergy * 0.14 + shoulderBounce * 0.4,
            11,
            dt
          );
          this.keyboardist.upperBody.rotation.z = THREE.MathUtils.damp(
            this.keyboardist.upperBody.rotation.z,
            sway + glissLean,
            10,
            dt
          );
          this.keyboardist.headGroup.rotation.x = Math.sin(bpmBeatPhase) * (0.09 + playEnergy * 0.18);
          this.keyboardist.headGroup.rotation.y = -keyCenterShift * 0.7;

          // Alternating L/R chord strikes strictly locked to sixteenthPhase + vocalKeysEnergy transients
          const chordWave = Math.sin(bpmSixteenthPhase) * (0.14 + playEnergy * 0.34);
          const strikeBoost = Math.max(this.pianoHitImpulse, vocalKeysEnergy * 0.72) * 0.38;
          const isLeftLead = this.lastPianoHand === 'left' || resolvedEighthPhase < 0.5;
          const octaveLean = isLeftLead ? -0.14 : 0.12;
          if (isKeytar) {
            this.keyboardist.leftArmPivot.rotation.set(-0.68 + this.pianoHandPos * 0.2, 0, 0.2 + this.pianoHandPos * 0.35);
            this.keyboardist.rightArmPivot.rotation.set(-0.62 + chordWave * 0.58 + strikeBoost * 0.5 * this.pianoHandAlt, 0, -0.32);
            this.keyboardist.leftElbowPivot.rotation.x = -0.68;
            this.keyboardist.rightElbowPivot.rotation.x = -0.62 + chordWave * 0.48;
          } else {
            this.keyboardist.leftArmPivot.rotation.set(
              -0.65 + chordWave * 0.46 + (isLeftLead ? strikeBoost * 0.48 : strikeBoost * 0.2),
              0,
              0.12 - keyCenterShift * 0.55 + octaveLean * 0.35
            );
            this.keyboardist.rightArmPivot.rotation.set(
              -0.65 - chordWave * 0.46 + (!isLeftLead ? strikeBoost * 0.48 : strikeBoost * 0.2),
              0,
              -0.12 - keyCenterShift * 0.55 + octaveLean * 0.35
            );
            this.keyboardist.leftElbowPivot.rotation.x = -0.74 + chordWave * 0.44;
            this.keyboardist.rightElbowPivot.rotation.x = -0.74 - chordWave * 0.44;
            this.keyboardist.leftWristPivot.rotation.x = chordWave * 0.4;
            this.keyboardist.rightWristPivot.rotation.x = -chordWave * 0.4;
          }
        }

        if (this.keyboardAsset?.ledMat) {
          this.keyboardAsset.ledMat.emissiveIntensity = 0.85 + pianoE * 1.45 + this.pianoHitImpulse * 0.9;
        }
      }

      // 4C. Signature Star Dance-Style Flourishes, Bounded Flinch & Strict Character Rig Clamping
      const applyDanceFlourish = (member, active) => {
        if (!member) return;
        const dance = active ? (member.getDanceStyle?.() || 'standard') : 'standard';
        let targetRotY = 0;
        let targetHeadZ = 0;
        if (dance === 'samurai-shred') {
          member.leftLegPivot.rotation.z += 0.08;
          member.rightLegPivot.rotation.z -= 0.08;
          member.upperBody.rotation.x += 0.08 + Math.sin(bpmBeatPhase) * 0.06;
        } else if (dance === 'country-twang') {
          member.upperBody.rotation.z += Math.sin(bpmHalfPhase) * 0.09;
          member.headGroup.rotation.x += Math.sin(bpmBeatPhase) * 0.06;
        } else if (dance === 'funk-spin') {
          targetRotY = Math.sin(bpmHalfPhase) * 0.22;
          member.upperBody.rotation.z += Math.cos(bpmBeatPhase) * 0.08;
        } else if (dance === 'reggae-groove') {
          member.upperBody.rotation.z += Math.sin(bpmHalfPhase + 0.5) * 0.14;
          targetHeadZ = Math.sin(bpmHalfPhase) * 0.12;
        } else if (dance === 'kpop-choreo') {
          const snap = Math.tanh(Math.sin(bpmBeatPhase * 2) * 3.0);
          member.upperBody.rotation.z += snap * 0.11;
          targetRotY = snap * 0.16;
        } else if (dance === 'grunge-nod') {
          member.upperBody.rotation.x += 0.12 + Math.max(0, Math.sin(bpmHalfPhase)) * 0.14;
          member.headGroup.rotation.x += Math.sin(bpmHalfPhase) * 0.18;
        } else if (dance === 'idol-jump') {
          member.upperBody.position.y += Math.abs(Math.sin(bpmBeatPhase)) * 0.09;
          targetHeadZ = Math.sin(bpmHalfPhase) * 0.14;
        } else if (dance === 'steampunk-bow') {
          member.upperBody.rotation.x += Math.sin(bpmHalfPhase) * 0.08;
          targetRotY = Math.cos(bpmHalfPhase * 0.5) * 0.14;
        }
        member.upperBody.rotation.y = THREE.MathUtils.damp(member.upperBody.rotation.y, targetRotY, 10, dt);
        if ((this.flinchTimers?.[member === this.guitarist ? 'guitar' : member === this.bassist ? 'bass' : member === this.keyboardist ? 'piano' : 'vocals'] || 0) <= 0) {
          member.headGroup.rotation.z = THREE.MathUtils.damp(member.headGroup.rotation.z, targetHeadZ, 10, dt);
        }
      };

      applyDanceFlourish(this.guitarist, !guitarMissed && !guitarSilentIdle);
      applyDanceFlourish(this.bassist, !bassMissed && !bassSilentIdle);
      applyDanceFlourish(this.vocalist, Boolean(marks.vocals.visible));
      applyDanceFlourish(this.keyboardist, this.missedInstrument !== 'piano');

      const rigClampRoles = [
        ['guitar', STAGE_DECK_TOP_Y],
        ['bass', STAGE_DECK_TOP_Y],
        ['drums', DRUM_RISER_TOP_Y],
        ['piano', STAGE_DECK_TOP_Y],
        ['vocals', STAGE_DECK_TOP_Y],
      ];
      for (let r = 0; r < rigClampRoles.length; r += 1) {
        const [role, minRootY] = rigClampRoles[r];
        const member = this.membersByRole?.[role];
        if (!member) continue;
        const ft = this.flinchTimers?.[role] || 0;
        if (ft > 0) {
          // Bounded, non-cumulative 0.35s recoil blended directly toward clamped flinch posture
          const pulse = Math.sin(Math.min(1, ft / 0.35) * Math.PI);
          member.upperBody.rotation.x = THREE.MathUtils.lerp(member.upperBody.rotation.x, -0.32, pulse * 0.72);
          member.headGroup.rotation.z = THREE.MathUtils.lerp(member.headGroup.rotation.z, 0.28, pulse * 0.75);
        }
        // Strict hard Euler & root-origin clamping on every single frame
        member.upperBody.rotation.x = THREE.MathUtils.clamp(member.upperBody.rotation.x, -0.45, 0.45);
        member.upperBody.rotation.y = THREE.MathUtils.clamp(member.upperBody.rotation.y, -0.45, 0.45);
        member.upperBody.rotation.z = THREE.MathUtils.clamp(member.upperBody.rotation.z, -0.45, 0.45);
        member.headGroup.rotation.x = THREE.MathUtils.clamp(member.headGroup.rotation.x, -0.45, 0.45);
        member.headGroup.rotation.z = THREE.MathUtils.clamp(member.headGroup.rotation.z, -0.45, 0.45);
        member.upperBody.position.y = THREE.MathUtils.clamp(member.upperBody.position.y, 0.62, 1.04);
        if (member.root.position.y < minRootY) {
          member.root.position.y = minRootY;
        }
      }
    }

    // 5. Moving Overhead SpotLights + Soft Volumetric Fresnel Cones that dynamically follow roaming musicians!
    const flashPulse = 0.55 + 0.45 * Math.sin(t * 24);
    const activeThemeHex =
      fever || encore
        ? THEME_COLORS.fever
        : (THEME_COLORS[this.activeInstrument] || THEME_COLORS.guitar);

    Object.entries(this.memberSpots).forEach(([role, bundle], idx) => {
      const isMissed = this.missedInstruments?.has(role) || this.missedInstrument === role;
      const isPlayerRole = Array.isArray(this.activeInstruments)
        ? this.activeInstruments.includes(role)
        : this.activeInstrument === role;
      const trackedMember = role === 'piano' ? this.pianoRigGroup : this.membersByRole?.[role]?.root;

      const sweepAmp = isWalkOn ? 2.4 : lightState.beamSweepAmp * 0.45;
      const sweepFreq = isWalkOn ? 2.4 : lightState.beamSweepSpeed + idx * 0.22;
      const panOffset = Math.sin(t * sweepFreq + idx * 1.4) * sweepAmp;

      // Dynamically follow each roaming musician's live stage position during performance!
      const anchorX = !isWalkOn && trackedMember ? trackedMember.position.x : bundle.baseTargetX;
      const anchorZ = !isWalkOn && trackedMember ? trackedMember.position.z : bundle.baseTargetZ;
      bundle.target.position.x = THREE.MathUtils.damp(bundle.target.position.x, anchorX + panOffset, 7.5, dt);
      bundle.target.position.z = THREE.MathUtils.damp(bundle.target.position.z, anchorZ, 7.5, dt);
      bundle.cone.lookAt(bundle.target.position);
      bundle.cone.rotateX(-Math.PI * 0.5);

      if (isWalkOn) {
        bundle.spot.color.copy(this._colorB.setHex(activeThemeHex)).lerp(lightState.spotPrimary, 0.35);
        bundle.coneMat.uniforms.uColor.value.copy(bundle.spot.color);
        bundle.spot.intensity = (42 + Math.sin(t * 5 + idx) * 14) * lightState.spotIntensityMult;
        bundle.coneMat.uniforms.uOpacity.value = 0.16;
      } else if (isMissed) {
        this._colorB.setHex(THEME_COLORS.miss);
        bundle.spot.color.copy(this._colorB);
        bundle.coneMat.uniforms.uColor.value.copy(this._colorB);
        bundle.spot.intensity = 18 + flashPulse * 48;
        bundle.coneMat.uniforms.uOpacity.value = 0.08 + flashPulse * 0.22;
      } else if (fever || encore || this.encoreFinaleActive) {
        bundle.spot.color.copy(idx % 2 === 0 ? lightState.spotPrimary : lightState.spotSecondary);
        bundle.coneMat.uniforms.uColor.value.copy(bundle.spot.color);
        bundle.spot.intensity = (44 + (telemetry?.overallEnergy || 0) * 30) * lightState.spotIntensityMult + lightState.strobeFlash * 22;
        bundle.coneMat.uniforms.uOpacity.value = Math.min(0.3, (0.13 + (telemetry?.overallEnergy || 0) * 0.09) * lightState.beamOpacityMult);
      } else {
        const moodTint = idx % 2 === 0 ? lightState.spotPrimary : lightState.spotSecondary;
        const roleHex = THEME_COLORS[role] || activeThemeHex;
        bundle.spot.color
          .copy(isPlayerRole ? this._colorB.setHex(roleHex) : bundle.baseColor)
          .lerp(moodTint, 0.42);
        bundle.coneMat.uniforms.uColor.value.copy(bundle.spot.color);
        const roleEnergy =
          role === 'drums' ? drumE : role === 'bass' ? bassE : role === 'guitar' ? guitarE : role === 'piano' ? pianoE : vocalE;
        const roleActive = role === 'vocals' ? marks.vocals.visible : stemActivity[role] !== false;
        const idleDim = playing && songTime >= 0 && !roleActive ? 0.45 : 1.0;
        const baseI = isPlayerRole ? 40 : 24;
        bundle.spot.intensity = (baseI + roleEnergy * 26) * lightState.spotIntensityMult * idleDim + lightState.strobeFlash * 16;
        bundle.coneMat.uniforms.uOpacity.value = Math.min(
          0.26,
          ((isPlayerRole ? 0.12 : 0.072) + roleEnergy * 0.072) * lightState.beamOpacityMult * idleDim
        );
      }
    });

    // 6. Animate venue-specific dynamic LED ribbons, rotating rigs & extravagant themed weather/particles!
    if (this.venueEnv?.dynamicElements) {
      const dyn = this.venueEnv.dynamicElements;
      const pulseLevel = (1.0 + bassE * 1.45 + (fever || encore ? 0.65 : 0)) * lightState.rimMult;
      for (let i = 0; i < dyn.pulseMaterials.length; i += 1) {
        dyn.pulseMaterials[i].emissiveIntensity = pulseLevel;
      }
      for (let i = 0; i < dyn.rotatingRings.length; i += 1) {
        dyn.rotatingRings[i].rotation.y += dt * (0.08 + bassE * 0.18);
      }
      if (typeof dyn.update === 'function') {
        dyn.update(dt, t, telemetry?.overallEnergy || 0, {
          lightState,
          beatPhase: resolvedBeatPhase,
          barPhase: lightState.barPhase,
          isGrandEncore,
          feverOrEncore: fever || encore || isGrandEncore,
        });
      }
    }

    // 7. Update Animated Live LED Backdrop, Interactive LED Stage Floor, 24m Panoramic Backwall & VIP Banner (throttled for 60 FPS)
    this.ledUpdateTimer += dt;
    const ledInterval = this.adaptiveLowPower ? 0.115 : 0.062;
    if (this.ledUpdateTimer >= ledInterval) {
      this.ledUpdateTimer = 0;
      const isEncoreVisual = encore || isGrandEncore;
      this.drawLedBackdrop(bassE, guitarE, drumE, fever, isEncoreVisual);
      this.drawStageFloorLed(bassE, guitarE, drumE, fever, isEncoreVisual);
      this.drawBackwallLed(bassE, guitarE, drumE, fever, isEncoreVisual);
      this.drawVipBanner();
    }

    // 8. Animate 152 Detailed Roblox R15 Fans & Glowsticks synced to 192 PPQ beatPhase + Crowd Events
    const activeCamPreset = this.cameraDirector?.currentPreset || '';
    const isCrowdAngle =
      activeCamPreset === 'CROWD_POV_FAN_CAM' ||
      activeCamPreset === 'CROWD_PIT_SURF' ||
      activeCamPreset === 'STAGE_TO_CROWD_REVERSE' ||
      activeCamPreset === 'ARENA_UPPER_BOWL_SWEEP' ||
      activeCamPreset === 'CROWD_PIT_MOSH_CAM' ||
      activeCamPreset === 'REVERSE_SILHOUETTE_SPOTLIGHT';
    const crowdAngleBoost = isCrowdAngle ? 1.18 : 1.0;

    this.updateCrowd(
      dt,
      {
        beatPhase: resolvedBeatPhase,
        barPhase: lightState.barPhase,
        lightstickBoost: (lightState.crowdLightstickBoost ?? 1.0) * crowdAngleBoost,
        bassE: isWalkOn ? 0.45 : bassE,
        overallE: telemetry?.overallEnergy || 0,
        bpm,
        songTime,
        hypeNorm: isWalkOn ? 0.85 : hypeNorm,
        feverOrEncore: fever || encore || isGrandEncore || this.breActive,
        isBallad: lightState.isBallad,
        ambianceType: lightState.ambianceType,
        multiplierColor: lightState.multiplierColor,
        streakTier,
      },
      lightState.sectionType,
      combo
    );

    // 8B. Procedural WebAudio Crowd Sing-Along Choir & Beat-Locked Acoustic Clap-Along
    this.crowdAmbience?.update({
      playing,
      songTime,
      bpm,
      beatPhase: resolvedBeatPhase,
      combo,
      hypeNorm,
      sectionType: lightState.sectionType,
      fever,
      encore: encore || isGrandEncore,
    });

    // 9. Update 3D Aerial Fireworks, Pyrotechnics, Confetti, Lasers & Pooled Angry Crowd Projectiles
    if (isGrandEncore || this.encoreFinaleActive || this.fwShells.length > 0 || this.hasActiveFireworks || playing) {
      this.updateFireworks(dt, t, stageState);
    }
    this.updatePyrotechnics(dt, stageState, telemetry);
    this.updateCrowdProjectiles(dt);

    // 10. Update Neversoft-Style Rule-Based Concert Camera Director
    this.updateCamera(dt, stageState, telemetry);

    // 10B. Render Live 30 FPS Offscreen Telephoto IMAG Feed to Jumbotron & Side Screens
    this.renderJumbotronImag(stageState, telemetry);

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true;
    this.crowdAmbience?.dispose?.();
    this.venueEnv?.dispose?.();
    Object.values(this.membersByRole || {}).forEach((m) => m.disposeTextures?.());
    this.guitarAsset?.dispose?.();
    this.bassAsset?.dispose?.();
    this.drumKitAsset?.dispose?.();
    this.keyboardAsset?.dispose?.();
    if (this.playerGoldAura) {
      this.playerGoldAura.traverse((obj) => {
        obj.geometry?.dispose?.();
        obj.material?.dispose?.();
      });
    }
    if (this.crowdSurferGroup) {
      this.crowdSurferGroup.traverse((obj) => {
        obj.geometry?.dispose?.();
        obj.material?.dispose?.();
      });
    }
    if (this.brawlFxGroup) {
      this.brawlFxGroup.traverse((obj) => {
        obj.geometry?.dispose?.();
        obj.material?.dispose?.();
      });
    }
    [
      this.crowdBackpackMesh,
      this.crowdPhoneMesh,
      this.crowdCollarMesh,
      this.crowdWristbandMesh,
      this.crowdFoamFingerMesh,
      this.floorCrowdLegsMesh,
      this.floorCrowdTorsoMesh,
      this.floorCrowdHeadMesh,
      this.floorCrowdArmsMesh,
      this.floorCrowdLightMesh,
    ].forEach((m) => {
      m?.geometry?.dispose?.();
      m?.material?.dispose?.();
    });
    if (this.stageExtraDisposables) {
      this.stageExtraDisposables.forEach((d) => d?.dispose?.());
    }
    this.balladDustPoints?.geometry?.dispose?.();
    this.balladDustPoints?.material?.dispose?.();
    this.crowdTearPoints?.geometry?.dispose?.();
    this.crowdTearPoints?.material?.dispose?.();
    this.sparkPoints?.geometry?.dispose?.();
    this.fwPoints?.geometry?.dispose?.();
    this.fwPoints?.material?.dispose?.();
    this.fwSmokePoints?.geometry?.dispose?.();
    this.fwSmokePoints?.material?.dispose?.();
    this.fwStreakTex?.dispose?.();
    this.fwStarTex?.dispose?.();
    this.fwSmokeTex?.dispose?.();
    this.splatPoints?.geometry?.dispose?.();
    this.splatPoints?.material?.dispose?.();
    Object.values(this.clothingPbrMaps || {}).forEach((pack) => {
      pack?.map?.dispose?.();
      pack?.bumpMap?.dispose?.();
      pack?.roughnessMap?.dispose?.();
    });
    this.crowdFaceTex?.dispose();
    this.ledTexture?.dispose();
    this.backwallLedTex?.dispose();
    this.stageFloorTex?.dispose();
    this.scrimBannerTex?.dispose();
    this.vipBannerTex?.dispose();
    this.deckTex?.dispose();
    this.deckMaps?.bumpMap?.dispose?.();
    this.deckMaps?.roughnessMap?.dispose?.();
    this.plankDeckMaps?.map?.dispose?.();
    this.plankDeckMaps?.bumpMap?.dispose?.();
    this.plankDeckMaps?.roughnessMap?.dispose?.();
    this.woodMaps?.map?.dispose?.();
    this.woodMaps?.bumpMap?.dispose?.();
    this.woodMaps?.roughnessMap?.dispose?.();
    this.perforatedMaps?.map?.dispose?.();
    this.perforatedMaps?.bumpMap?.dispose?.();
    this.ampGrillTex?.dispose();
    this.glowTex?.dispose();
    this.jumbotronTarget?.dispose?.();
    this.envRenderTarget?.dispose();
    this.renderer?.dispose();
  }
}

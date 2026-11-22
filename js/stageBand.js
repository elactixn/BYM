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
import { buildVenueEnvironment } from './venues.js';
import {
  getBandLineupById,
  buildCustomGuitarMesh,
  buildCustomBassMesh,
  buildCustomDrumKitMesh,
  buildCustomKeyboardMesh,
  getStarLookById,
  createAmpGrilleSkinTexture,
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
  [0xfacc15, 0xfef08a, 0xf97316],
  [0x38bdf8, 0x06b6d4, 0xe0f2fe],
  [0xf43f5e, 0xf472b6, 0xfde047],
  [0xa855f7, 0xc084fc, 0x38bdf8],
  [0x4ade80, 0x22d3ee, 0xfef9c3],
];

const CONFETTI_COLORS = [0xfacc15, 0x38bdf8, 0xf43f5e, 0xc084fc, 0x4ade80, 0xf8fafc, 0xfb923c];

const CROWD_SHIRT_COLORS = [
  0x1d4ed8, 0x0891b2, 0x7c3aed, 0xbe123c, 0xd97706, 0x059669, 0x334155, 0xec4899, 0x2563eb, 0xf97316,
  0x14b8a6, 0xe11d48,
];

const CROWD_PANTS_COLORS = [0x0f172a, 0x1e293b, 0x1f2937, 0x172554, 0x27272a, 0x312e81];
const CROWD_HAIR_COLORS = [0x111827, 0x27272a, 0x451a03, 0x78350f, 0x0f172a, 0x3f3f46, 0x1e1b4b];
const CROWD_CAP_COLORS = [0xef4444, 0x0284c7, 0xf59e0b, 0x111827, 0x7c3aed, 0x10b981, 0xf43f5e];
const CROWD_SKIN_TONES = [0xf4c79a, 0xe8b587, 0xd69e72, 0xf9d8b8, 0xc68b59, 0xf0be91];

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
  sunglasses = false,
  sunglassesTint = null,
  smile = 'grin',
  eyeliner = false,
  eyeshadow = null,
  blush = null,
  lipColor = null,
  starMakeup = false,
  mustache = false,
}) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = skin;
  ctx.fillRect(0, 0, 256, 256);

  const grad = ctx.createRadialGradient(128, 128, 24, 128, 128, 150);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.14)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.1)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  if (blush && !shocked) {
    ctx.fillStyle = blush;
    ctx.beginPath();
    ctx.ellipse(58, 142, 26, 15, 0, 0, Math.PI * 2);
    ctx.ellipse(198, 142, 26, 15, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  if (starMakeup && !shocked) {
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

  if (shocked) {
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

      [82, 174].forEach((ex, i) => {
        ctx.fillStyle = '#111827';
        ctx.beginPath();
        ctx.ellipse(ex, 110, 14, 18, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex - 4, 103, 5, 0, Math.PI * 2);
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

      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = eyeliner ? 6 : 8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(58, 82);
      ctx.lineTo(104, 86);
      ctx.moveTo(198, 82);
      ctx.lineTo(152, 86);
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

    if (lipColor) {
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

  const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.42, metalness: 0.05 });
  const torsoMat = new THREE.MeshStandardMaterial({ color: torsoColor, roughness: 0.48, metalness: 0.14 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.65, metalness: 0.08 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x0f121a, roughness: 0.55, metalness: 0.2 });
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 0.55,
    roughness: 0.3,
    metalness: 0.3,
  });
  accentMat.userData.shared = true;

  let normalTex = createRobloxFaceTexture({ skin: skinColor, shocked: false, sunglasses, smile });
  let shockedTex = createRobloxFaceTexture({ skin: skinColor, shocked: true, sunglasses: false, smile });

  const normalFaceMat = new THREE.MeshStandardMaterial({ map: normalTex, roughness: 0.4, metalness: 0.04 });
  const shockedFaceMat = new THREE.MeshStandardMaterial({ map: shockedTex, roughness: 0.4, metalness: 0.04 });
  const headMaterials = [skinMat, skinMat, skinMat, skinMat, normalFaceMat, skinMat];

  const legGeo = new THREE.BoxGeometry(0.42, 0.94, 0.44);
  const shoeGeo = new THREE.BoxGeometry(0.44, 0.16, 0.52);

  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.23, 0.96, 0);
  const leftLeg = new THREE.Mesh(legGeo, pantsMat);
  leftLeg.position.y = -0.47;
  const leftShoe = new THREE.Mesh(shoeGeo, shoeMat);
  leftShoe.position.set(0, -0.88, 0.04);
  leftLegPivot.add(leftLeg, leftShoe);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.23, 0.96, 0);
  const rightLeg = new THREE.Mesh(legGeo, pantsMat);
  rightLeg.position.y = -0.47;
  const rightShoe = new THREE.Mesh(shoeGeo, shoeMat);
  rightShoe.position.set(0, -0.88, 0.04);
  rightLegPivot.add(rightLeg, rightShoe);

  if (seated) {
    leftLegPivot.rotation.x = -1.15;
    rightLegPivot.rotation.x = -1.15;
    leftLegPivot.position.y = 0.72;
    rightLegPivot.position.y = 0.72;
  }

  root.add(leftLegPivot, rightLegPivot);

  const upperBody = new THREE.Group();
  upperBody.position.set(0, seated ? 0.72 : 0.96, 0);
  root.add(upperBody);

  const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.92, 1.02, 0.48), torsoMat);
  torsoMesh.position.y = 0.51;
  upperBody.add(torsoMesh);

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.12, 0.5), accentMat);
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

  const armGeo = new THREE.BoxGeometry(0.36, 0.92, 0.38);
  const sleeveGeo = new THREE.BoxGeometry(0.38, 0.44, 0.4);

  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.66, 0.94, 0);
  const leftArmMesh = new THREE.Mesh(armGeo, skinMat);
  leftArmMesh.position.y = -0.38;
  const leftSleeve = new THREE.Mesh(sleeveGeo, torsoMat);
  leftSleeve.position.y = -0.14;
  leftArmPivot.add(leftArmMesh, leftSleeve);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.66, 0.94, 0);
  const rightArmMesh = new THREE.Mesh(armGeo, skinMat);
  rightArmMesh.position.y = -0.38;
  const rightSleeve = new THREE.Mesh(sleeveGeo, torsoMat);
  rightSleeve.position.y = -0.14;
  rightArmPivot.add(rightArmMesh, rightSleeve);

  upperBody.add(leftArmPivot, rightArmPivot);

  function applyLook(lookSpec) {
    clearAndDisposeGroup(hairGroup);
    clearAndDisposeGroup(accessoryGroup);

    if (!lookSpec || lookSpec.id === 'default-band') {
      skinMat.color.set(originalSpec.skinColor);
      torsoMat.color.set(originalSpec.torsoColor);
      torsoMat.emissive.setHex(0x000000);
      torsoMat.emissiveIntensity = 0;
      torsoMat.roughness = 0.48;
      torsoMat.metalness = 0.14;
      pantsMat.color.set(originalSpec.pantsColor);
      shoeMat.color.setHex(0x0f121a);
      accentMat.color.set(originalSpec.accentColor);
      accentMat.emissive.set(originalSpec.accentColor);
      accentMat.emissiveIntensity = 0.55;

      populateHairGroup(hairGroup, originalSpec.hairStyle, originalSpec.hairColor, accentMat);

      const nextNormal = createRobloxFaceTexture({
        skin: originalSpec.skinColor,
        shocked: false,
        sunglasses: originalSpec.sunglasses,
        smile: originalSpec.smile,
      });
      const nextShocked = createRobloxFaceTexture({
        skin: originalSpec.skinColor,
        shocked: true,
        sunglasses: false,
        smile: originalSpec.smile,
      });
      normalTex.dispose();
      shockedTex.dispose();
      normalTex = nextNormal;
      shockedTex = nextShocked;
      normalFaceMat.map = normalTex;
      normalFaceMat.needsUpdate = true;
      shockedFaceMat.map = shockedTex;
      shockedFaceMat.needsUpdate = true;
      return;
    }

    const skinHexStr = `#${new THREE.Color(lookSpec.skinColor).getHexString()}`;
    skinMat.color.setHex(lookSpec.skinColor);
    torsoMat.color.setHex(lookSpec.torsoColor);
    torsoMat.emissive.setHex(lookSpec.torsoEmissive || 0x000000);
    torsoMat.emissiveIntensity = lookSpec.glitter ? 0.52 : 0.24;
    torsoMat.roughness = lookSpec.glitter ? 0.2 : 0.42;
    torsoMat.metalness = lookSpec.glitter ? 0.62 : 0.18;
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

    const face = lookSpec.face || {};
    const nextNormal = createRobloxFaceTexture({
      skin: skinHexStr,
      shocked: false,
      sunglasses: Boolean(face.sunglasses),
      sunglassesTint: face.sunglassesTint || null,
      smile: originalSpec.smile,
      eyeliner: Boolean(face.eyeliner),
      eyeshadow: face.eyeshadow || null,
      blush: face.blush || null,
      lipColor: face.lipColor || null,
      starMakeup: Boolean(face.starMakeup),
      mustache: Boolean(face.mustache),
    });
    const nextShocked = createRobloxFaceTexture({
      skin: skinHexStr,
      shocked: true,
      sunglasses: false,
      smile: originalSpec.smile,
    });
    normalTex.dispose();
    shockedTex.dispose();
    normalTex = nextNormal;
    shockedTex = nextShocked;
    normalFaceMat.map = normalTex;
    normalFaceMat.needsUpdate = true;
    shockedFaceMat.map = shockedTex;
    shockedFaceMat.needsUpdate = true;
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
    leftLegPivot,
    rightLegPivot,
    normalFaceMat,
    shockedFaceMat,
    applyLook,
    setShocked(isShocked) {
      headMesh.material[4] = isShocked ? shockedFaceMat : normalFaceMat;
    },
    disposeTextures() {
      clearAndDisposeGroup(hairGroup);
      clearAndDisposeGroup(accessoryGroup);
      normalTex.dispose();
      shockedTex.dispose();
    },
  };
}

function buildMicStand() {
  const group = new THREE.Group();
  const chrome = new THREE.MeshStandardMaterial({ color: 0xdbeafe, roughness: 0.2, metalness: 0.9 });
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5, metalness: 0.5 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.08, 16), baseMat);
  base.position.y = 0.04;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 2.02, 10), chrome);
  pole.position.y = 1.04;
  const micHead = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), chrome);
  micHead.position.set(0, 2.08, -0.12);
  const micStem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.24, 8), baseMat);
  micStem.rotation.x = 1.1;
  micStem.position.set(0, 2.04, -0.04);

  group.add(base, pole, micHead, micStem);
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

function buildAmpStack(accentColor, grillTex) {
  const group = new THREE.Group();
  const cabMat = new THREE.MeshStandardMaterial({ color: 0x10131b, roughness: 0.68, metalness: 0.22 });
  const grillMat = new THREE.MeshStandardMaterial({
    map: grillTex,
    color: 0xffffff,
    roughness: 0.82,
    metalness: 0.15,
  });
  const goldFaceMat = new THREE.MeshStandardMaterial({ color: 0xd4a017, roughness: 0.28, metalness: 0.82 });
  const ledMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 1.5,
  });

  const lowerCab = new THREE.Mesh(new THREE.BoxGeometry(1.62, 1.38, 0.94), cabMat);
  lowerCab.position.y = 0.69;
  const lowerGrill = new THREE.Mesh(new THREE.BoxGeometry(1.42, 1.18, 0.06), grillMat);
  lowerGrill.position.set(0, 0.69, 0.46);

  const upperCab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.26, 0.88), cabMat);
  upperCab.position.y = 2.0;
  const upperGrill = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.06, 0.06), grillMat);
  upperGrill.position.set(0, 2.0, 0.43);

  const headAmp = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.48, 0.78), cabMat);
  headAmp.position.y = 2.86;
  const goldFace = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.14, 0.04), goldFaceMat);
  goldFace.position.set(0, 2.8, 0.39);
  const ledStrip = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.06, 0.06), ledMat);
  ledStrip.position.set(0, 2.97, 0.39);

  // Pulsing floor subwoofer cabinet tucked beside the amp stack
  const subCab = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.92, 0.92), cabMat);
  subCab.position.set(0, 0.46, 0.98);
  const subCone = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.22, 0.08, 16), grillMat);
  subCone.rotation.x = Math.PI * 0.5;
  subCone.position.set(0, 0.46, 1.44);

  group.add(lowerCab, lowerGrill, upperCab, upperGrill, headAmp, goldFace, ledStrip, subCab, subCone);
  return { group, ledMat, subCone, grillMat };
}

/**
 * Builds a towering curved hanging Line-Array Concert Speaker Stack suspended from the truss,
 * complete with dual bass-reactive pulsing woofer cones per cabinet!
 */
function buildLineArrayStack(side, ledMat) {
  const group = new THREE.Group();
  const woofers = [];
  const cabMat = new THREE.MeshStandardMaterial({ color: 0x0f131d, roughness: 0.56, metalness: 0.42 });
  const grillMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.72, metalness: 0.32 });
  const wooferMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.48, metalness: 0.55 });
  const dustCapMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.3, metalness: 0.75 });
  const riggingMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.32, metalness: 0.88 });

  // Top bumper rigging frame + cables
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.16, 0.94), riggingMat);
  bumper.position.set(0, 0.15, 0);
  group.add(bumper);

  [-0.5, 0.5].forEach((cx) => {
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.5, 6), riggingMat);
    cable.position.set(cx, 0.92, 0);
    group.add(cable);
  });

  const wooferGeo = new THREE.CylinderGeometry(0.135, 0.085, 0.06, 12);
  const capGeo = new THREE.SphereGeometry(0.055, 8, 8);

  // 7 curved J-array speaker cabinets descending downward
  const count = 7;
  for (let i = 0; i < count; i += 1) {
    const pitch = i * 0.085;
    const y = -0.32 - i * 0.46;
    const zOffset = -Math.pow(i, 1.45) * 0.045;

    const unit = new THREE.Group();
    unit.position.set(0, y, zOffset);
    unit.rotation.x = pitch;

    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.39, 0.78), cabMat);
    const grill = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.32, 0.05), grillMat);
    grill.position.z = 0.37;
    const accent = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.32, 0.08), ledMat);
    accent.position.set(side * -0.58, 0, 0.37);

    // Dual pulsing woofer drivers per curved line-array cabinet
    [-0.3, 0.3].forEach((wx) => {
      const coneGroup = new THREE.Group();
      coneGroup.position.set(wx, 0, 0.39);
      const cone = new THREE.Mesh(wooferGeo, wooferMat);
      cone.rotation.x = Math.PI * 0.5;
      const cap = new THREE.Mesh(capGeo, dustCapMat);
      cap.position.z = 0.02;
      coneGroup.add(cone, cap);
      unit.add(coneGroup);
      woofers.push(coneGroup);
    });

    unit.add(cab, grill, accent);
    group.add(unit);
  }

  return { group, woofers };
}

export class StageBand {
  constructor(
    canvas,
    {
      venueId = 'christmas-wonderland',
      cameraMode = 'on',
      bandLineupId = 'arena-4piece',
      guitarModelId = 'les-paul-sunburst',
      bassModelId = 'precision-blonde',
      drumKitModelId = 'pop-single-kick',
      keyboardModelId = 'concert-grand',
      starLookId = 'default-band',
      instrumentSkinId = 'classic-sunburst',
      onFireworkBurst = null,
      onProjectileImpact = null,
    } = {}
  ) {
    this.canvas = canvas;
    this.disposed = false;
    this.isSoftwareGl = false;
    this.clock = 0;

    // Active venue, lineup, custom 3D gear, star looks, PBR skins, camera director & lighting profiles
    this.venueId = venueId;
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
    this.feverActive = false;
    this.encorePerformanceActive = false;
    this.currentTrackTitle = 'ENCORE STAGE';
    this.missedInstrument = null;

    // Encore Finale celebration state
    this.encoreFinaleActive = false;
    this.encoreGrade = 'A';
    this.finaleFireworkTimer = 0;
    this.finaleConfettiTimer = 0;
    this.feverFireworkTimer = 0;
    this.pyroFlameIntensity = 0;
    this.pyroFlameTimer = 0;
    this.sparkEmitterTimer = 0;

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

    // Live LED backdrop screen + VIP Front-Row Banner update throttling + peak-hold caps
    this.ledUpdateTimer = 0;
    this.ledBarLevels = new Float32Array(24);
    this.ledPeakLevels = new Float32Array(24);
    this.cryoBurstTimer = 0;

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
      guitar: makeMotion(-3.55, -1.1, 0.24),
      bass: makeMotion(3.55, -1.1, -0.24),
      vocals: makeMotion(0, -0.78, 0),
    };
    this.stageChoreoTimer = 0;
    this.stageChoreoStep = 0;
    this.lastJumpBeat = -999;
    this.lastChoreoSectionId = null;
    this.markovSeed = 1337;

    // Pre-allocated live world positions fed to CameraDirector every frame (zero GC!)
    this.livePositions = {
      guitar: { x: -3.55, y: 0, z: -1.1 },
      bass: { x: 3.55, y: 0, z: -1.1 },
      drums: { x: 0, y: 0.64, z: -3.56 },
      piano: { x: -2.45, y: 0, z: -2.65 },
      vocals: { x: 0, y: 0, z: -0.78 },
    };

    // Base home rig kept for immediate init framing before CameraDirector ticks
    this.cameraRig = {
      azimuth: 0,
      radius: 11.4,
      height: 3.9,
      target: new THREE.Vector3(0, 1.85, -1.6),
      desiredAzimuth: 0,
      desiredRadius: 11.4,
      desiredHeight: 3.9,
      desiredTarget: new THREE.Vector3(0, 1.85, -1.6),
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
    this.renderer.toneMappingExposure = 1.18;
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

    this.camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.2, 145);
    this.applyCameraRigImmediate();

    this.glowTex = createGlowParticleTexture();

    this.buildLights();
    this.buildConcertStage();
    this.buildPerformingBand();
    this.buildFullBodiedCrowd3D();
    this.buildPyrotechnicsAndFX();
    this.buildCrowdProjectilePool();
    this.setVenue(this.venueId);

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
    this.hemiLight = new THREE.HemisphereLight(0x7dd3fc, 0x0f172a, 0.82);
    this.scene.add(this.hemiLight);

    this.frontKey = new THREE.DirectionalLight(0xe0f2fe, 0.78);
    this.frontKey.position.set(0, 9.2, 10.5);
    if (!this.isSoftwareGl) {
      this.frontKey.castShadow = true;
      this.frontKey.shadow.mapSize.set(1024, 1024);
      this.frontKey.shadow.camera.near = 2;
      this.frontKey.shadow.camera.far = 32;
      this.frontKey.shadow.camera.left = -10;
      this.frontKey.shadow.camera.right = 10;
      this.frontKey.shadow.camera.top = 10;
      this.frontKey.shadow.camera.bottom = -6;
      this.frontKey.shadow.bias = -0.0008;
    }
    this.scene.add(this.frontKey);

    // Strong rear band rim light so roaming Roblox performers pop crisply against stage haze!
    this.bandRimLight = new THREE.DirectionalLight(0x93c5fd, 2.3);
    this.bandRimLight.position.set(0, 7.6, -9.8);
    this.scene.add(this.bandRimLight);

    // Subtle crowd uplight so reverse behind-the-band angles showcase the 3D fans vividly!
    this.crowdLight = new THREE.PointLight(0x38bdf8, 18, 30, 1.3);
    this.crowdLight.position.set(0, 4.2, 9.5);
    this.scene.add(this.crowdLight);

    this.memberSpots = {};
    const spotConfigs = [
      { key: 'guitar', x: -3.55, z: -1.1, targetY: 1.2, color: THEME_COLORS.guitar },
      { key: 'bass', x: 3.55, z: -1.1, targetY: 1.2, color: THEME_COLORS.bass },
      { key: 'drums', x: 0.0, z: -3.4, targetY: 1.6, color: THEME_COLORS.drums },
      { key: 'piano', x: -2.45, z: -2.65, targetY: 1.3, color: THEME_COLORS.piano },
      { key: 'vocals', x: 0.0, z: -0.55, targetY: 1.3, color: 0xe2e8f0 },
    ];

    const coneGeo = new THREE.ConeGeometry(2.45, 9.2, 24, 1, true);
    coneGeo.translate(0, -4.6, 0);

    spotConfigs.forEach((cfg) => {
      const spot = new THREE.SpotLight(cfg.color, 38, 28, Math.PI / 5.0, 0.62, 1.2);
      spot.position.set(cfg.x * 1.05, 8.6, cfg.z + 1.4);
      // Strict 2-light shadow budget: frontKey + 1 primary hero spotlight ('guitar')
      if (!this.isSoftwareGl && cfg.key === 'guitar') {
        spot.castShadow = true;
        spot.shadow.mapSize.set(1024, 1024);
        spot.shadow.camera.near = 2;
        spot.shadow.camera.far = 24;
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

    // Glossy dark brushed-metal concert stage deck (top surface strictly at y = 0)
    this.deckTex = createBrushedMetalTexture();
    this.ampGrillTex = createAmpGrilleSkinTexture(this.instrumentSkinId);
    const deckMat = new THREE.MeshStandardMaterial({
      map: this.deckTex,
      color: 0xdbeafe,
      roughness: 0.24,
      metalness: 0.68,
    });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(16.4, 1.2, 10.8), deckMat);
    deck.position.set(0, -0.6, -2.2);
    deck.receiveShadow = true;
    stageGroup.add(deck);

    // Lower front stage apron lip for multi-tiered stadium presence
    const apronMat = new THREE.MeshStandardMaterial({ color: 0x0b0e18, roughness: 0.45, metalness: 0.55 });
    const apron = new THREE.Mesh(new THREE.BoxGeometry(17.2, 0.42, 0.55), apronMat);
    apron.position.set(0, -0.98, 3.35);
    stageGroup.add(apron);

    // Glowing stage LED trim (front apron + riser + speaker strips)
    this.stageRimMat = new THREE.MeshStandardMaterial({
      color: THEME_COLORS.guitar,
      emissive: THEME_COLORS.guitar,
      emissiveIntensity: 1.7,
      roughness: 0.22,
    });
    const frontRim = new THREE.Mesh(new THREE.BoxGeometry(16.4, 0.11, 0.12), this.stageRimMat);
    frontRim.position.set(0, -0.02, 3.2);
    stageGroup.add(frontRim);

    // Elevated center drum riser (top surface strictly at y = 0.64) + chrome safety rails & steps
    const riser = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.64, 3.3), deckMat);
    riser.position.set(0, 0.32, -3.4);
    riser.receiveShadow = true;
    stageGroup.add(riser);

    const riserTrim = new THREE.Mesh(new THREE.BoxGeometry(4.64, 0.09, 0.09), this.stageRimMat);
    riserTrim.position.set(0, 0.62, -1.74);
    stageGroup.add(riserTrim);

    const chromeRailMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.18, metalness: 0.92 });
    // Drum riser steps on left and right sides
    [-2.58, 2.58].forEach((sx) => {
      const stepLow = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.22, 0.96), deckMat);
      stepLow.position.set(sx, 0.11, -2.55);
      const stepMid = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.44, 0.64), deckMat);
      stepMid.position.set(sx, 0.22, -3.22);
      stageGroup.add(stepLow, stepMid);
    });
    // Back & side safety chrome rails on drum riser
    [-2.24, 0, 2.24].forEach((rx) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.82, 8), chromeRailMat);
      post.position.set(rx, 1.05, -4.98);
      stageGroup.add(post);
    });
    const backTopRail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 4.52, 8), chromeRailMat);
    backTopRail.rotation.z = Math.PI * 0.5;
    backTopRail.position.set(0, 1.44, -4.98);
    stageGroup.add(backTopRail);

    // Geometric Overhead Aluminum Box-Truss Rig + diagonal cross-bracing
    const trussMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.28,
      metalness: 0.9,
    });

    [
      [-7.6, -5.8],
      [7.6, -5.8],
      [-7.6, 2.2],
      [7.6, 2.2],
    ].forEach(([tx, tz]) => {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(0.38, 9.2, 0.38), trussMat);
      tower.position.set(tx, 4.2, tz);
      stageGroup.add(tower);
    });

    const frontBridge = new THREE.Mesh(new THREE.BoxGeometry(15.6, 0.34, 0.38), trussMat);
    frontBridge.position.set(0, 8.7, 2.2);
    const midBridge = new THREE.Mesh(new THREE.BoxGeometry(15.6, 0.32, 0.36), trussMat);
    midBridge.position.set(0, 8.7, -2.0);
    const rearBridge = new THREE.Mesh(new THREE.BoxGeometry(15.6, 0.34, 0.38), trussMat);
    rearBridge.position.set(0, 8.7, -5.8);
    stageGroup.add(frontBridge, midBridge, rearBridge);

    [-7.6, 7.6].forEach((sx) => {
      const sideSpan = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 8.4), trussMat);
      sideSpan.position.set(sx, 8.7, -1.8);
      stageGroup.add(sideSpan);
    });

    const fixtureMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.8 });
    [-5.2, -2.6, 0, 2.6, 5.2].forEach((fx) => {
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.34, 0.38), fixtureMat);
      head.position.set(fx, 8.42, 2.15);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 10), this.stageRimMat);
      lens.position.set(fx, 8.24, 2.15);
      stageGroup.add(head, lens);
    });

    // Glowing Multi-Tier Stage Risers: rear drum riser + glowing side amp wing risers
    const riserBackTrim = new THREE.Mesh(new THREE.BoxGeometry(4.64, 0.07, 0.08), this.stageRimMat);
    riserBackTrim.position.set(0, 0.62, -5.04);
    stageGroup.add(riserBackTrim);

    [-5.7, 5.7].forEach((ax) => {
      const sideRiser = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.24, 2.65), deckMat);
      sideRiser.position.set(ax, 0.12, -2.25);
      sideRiser.receiveShadow = true;
      const sideRiserLed = new THREE.Mesh(new THREE.BoxGeometry(2.74, 0.06, 0.08), this.stageRimMat);
      sideRiserLed.position.set(ax, 0.23, -0.92);
      stageGroup.add(sideRiser, sideRiserLed);
    });

    // Lower front apron secondary glow strip for multi-tier depth
    const apronRim = new THREE.Mesh(new THREE.BoxGeometry(17.2, 0.07, 0.09), this.stageRimMat);
    apronRim.position.set(0, -0.78, 3.63);
    stageGroup.add(apronRim);

    // Towering Left & Right Hanging Curved Line-Array Speaker Stacks with pulsing woofers
    const leftArrayBuilt = buildLineArrayStack(-1, this.stageRimMat);
    leftArrayBuilt.group.position.set(-7.35, 7.1, 1.55);
    leftArrayBuilt.group.rotation.y = 0.24;
    stageGroup.add(leftArrayBuilt.group);

    const rightArrayBuilt = buildLineArrayStack(1, this.stageRimMat);
    rightArrayBuilt.group.position.set(7.35, 7.1, 1.55);
    rightArrayBuilt.group.rotation.y = -0.24;
    stageGroup.add(rightArrayBuilt.group);

    this.lineArrayWoofers = [...leftArrayBuilt.woofers, ...rightArrayBuilt.woofers];

    // Marshall-style woven-grille amp stacks + pulsing floor subwoofers seated on glowing side risers
    const leftAmp = buildAmpStack(THEME_COLORS.guitar, this.ampGrillTex);
    leftAmp.group.position.set(-5.7, 0.24, -2.5);
    leftAmp.group.rotation.y = 0.32;
    stageGroup.add(leftAmp.group);

    const rightAmp = buildAmpStack(THEME_COLORS.bass, this.ampGrillTex);
    rightAmp.group.position.set(5.7, 0.24, -2.5);
    rightAmp.group.rotation.y = -0.32;
    stageGroup.add(rightAmp.group);

    this.ampLedMats = [leftAmp.ledMat, rightAmp.ledMat];
    this.ampGrillMats = [leftAmp.grillMat, rightAmp.grillMat];
    this.subCones = [leftAmp.subCone, rightAmp.subCone];

    // Stage Floor Monitor Wedges + realistic coiled stage mic cables
    const wedgeMat = new THREE.MeshStandardMaterial({ color: 0x161b29, roughness: 0.65, metalness: 0.22 });
    const cableMat = new THREE.MeshStandardMaterial({ color: 0x090b10, roughness: 0.85, metalness: 0.1 });
    [-3.6, -1.5, 1.5, 3.6].forEach((wx) => {
      const wedgeGroup = new THREE.Group();
      wedgeGroup.position.set(wx, 0.17, 2.28);
      wedgeGroup.rotation.x = -0.34;
      const wedge = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.34, 0.5), wedgeMat);
      const wedgeLed = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.04, 0.04), this.stageRimMat);
      wedgeLed.position.set(0, 0.16, 0.25);
      wedgeGroup.add(wedge, wedgeLed);
      stageGroup.add(wedgeGroup);

      // Floor cable curving back toward amp wing
      const cableCoil = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.02, 6, 16), cableMat);
      cableCoil.rotation.x = Math.PI * 0.5;
      cableCoil.position.set(wx * 0.85, 0.02, 1.72);
      stageGroup.add(cableCoil);
    });

    // Giant Curved Rear LED Video Wall Jumbotron (concave arc facing the stadium!)
    this.ledCanvas = document.createElement('canvas');
    this.ledCanvas.width = 512;
    this.ledCanvas.height = 200;
    this.ledCtx = this.ledCanvas.getContext('2d');
    this.ledTexture = new THREE.CanvasTexture(this.ledCanvas);
    this.ledTexture.colorSpace = THREE.SRGBColorSpace;

    const ledFrameMat = new THREE.MeshStandardMaterial({ color: 0x0b0f1a, roughness: 0.42, metalness: 0.78 });
    const curveRadius = 15.2;
    const curveSpan = 0.84;
    const curvedFrameGeo = new THREE.CylinderGeometry(curveRadius + 0.14, curveRadius + 0.14, 4.9, 28, 1, true, Math.PI - curveSpan * 0.5, curveSpan);
    const ledFrame = new THREE.Mesh(curvedFrameGeo, ledFrameMat);
    ledFrame.position.set(0, 4.45, curveRadius - 8.45);
    stageGroup.add(ledFrame);

    [-5.1, 5.1].forEach((lx) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.26, 2.3, 0.26), trussMat);
      leg.position.set(lx, 1.05, -7.85);
      stageGroup.add(leg);
    });

    const curvedScreenGeo = new THREE.CylinderGeometry(curveRadius, curveRadius, 4.5, 28, 1, true, Math.PI - (curveSpan - 0.04) * 0.5, curveSpan - 0.04);
    // Flip horizontal UV so text reads cleanly left-to-right from the front!
    const uvAttr = curvedScreenGeo.attributes.uv;
    for (let i = 0; i < uvAttr.count; i += 1) {
      uvAttr.setX(i, 1 - uvAttr.getX(i));
    }
    const ledPanelMat = new THREE.MeshBasicMaterial({
      map: this.ledTexture,
      side: THREE.BackSide,
    });
    const ledPanel = new THREE.Mesh(curvedScreenGeo, ledPanelMat);
    ledPanel.position.set(0, 4.45, curveRadius - 8.32);
    stageGroup.add(ledPanel);

    // Glowing VIP Front-Row Stage Apron LED Shoutout Banner ("Hello Carmen, and Carmelo! 🎸✨")
    this.vipBannerCanvas = document.createElement('canvas');
    this.vipBannerCanvas.width = 1024;
    this.vipBannerCanvas.height = 96;
    this.vipBannerCtx = this.vipBannerCanvas.getContext('2d');
    this.vipBannerTex = new THREE.CanvasTexture(this.vipBannerCanvas);
    this.vipBannerTex.colorSpace = THREE.SRGBColorSpace;
    this.drawVipBanner();

    const vipBannerFrame = new THREE.Mesh(
      new THREE.BoxGeometry(10.2, 0.62, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x0b0f1a, roughness: 0.35, metalness: 0.8 })
    );
    vipBannerFrame.position.set(0, -0.34, 3.22);
    const vipBannerMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(9.9, 0.5),
      new THREE.MeshBasicMaterial({ map: this.vipBannerTex })
    );
    vipBannerMesh.position.set(0, -0.34, 3.27);
    stageGroup.add(vipBannerFrame, vipBannerMesh);

    this.drawLedBackdrop(0.2, 0.2, 0.2, false, false);

    this.scene.add(stageGroup);
  }

  drawVipBanner() {
    const ctx = this.vipBannerCtx;
    if (!ctx) return;
    const w = 1024;
    const h = 96;

    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#1e1038');
    grad.addColorStop(0.25, '#3b0764');
    grad.addColorStop(0.5, '#500724');
    grad.addColorStop(0.75, '#3b0764');
    grad.addColorStop(1, '#1e1038');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, w - 8, h - 8);

    const pulse = 0.85 + Math.sin(this.clock * 4.5) * 0.15;
    ctx.save();
    ctx.shadowColor = '#f472b6';
    ctx.shadowBlur = 16 * pulse;
    ctx.fillStyle = '#fef08a';
    ctx.font = '700 40px Oswald, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★   HELLO CARMEN, AND CARMELO!  🎸✨   ★', w * 0.5, h * 0.52);
    ctx.restore();

    this.vipBannerTex.needsUpdate = true;
  }

  /**
   * Draws live beat-reactive Canvas LED equalizer wall with mood gradients,
   * concentric bass shockwave rings, peak-hold spectrum bars, and song title.
   */
  drawLedBackdrop(bassE, midE, highE, feverActive, encoreActive) {
    const ctx = this.ledCtx;
    if (!ctx) return;
    const w = 512;
    const h = 200;
    const moodTop = this.lightingState?.ledBgTop;
    const moodAccent = this.lightingState?.ledAccent;

    // Mood-aware concert background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    if (encoreActive || feverActive) {
      bgGrad.addColorStop(0, '#361a04');
      bgGrad.addColorStop(0.55, '#180c05');
      bgGrad.addColorStop(1, '#070910');
    } else if (moodTop) {
      bgGrad.addColorStop(0, moodTop);
      bgGrad.addColorStop(0.68, '#0b1022');
      bgGrad.addColorStop(1, '#050811');
    } else {
      bgGrad.addColorStop(0, '#072230');
      bgGrad.addColorStop(1, '#060912');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Primary color driven by Fever/Encore, active mood, or instrument
    const accent =
      encoreActive || feverActive
        ? '#facc15'
        : moodAccent ||
          (this.activeInstrument === 'bass'
            ? '#a855f7'
            : this.activeInstrument === 'drums'
              ? '#f59e0b'
              : '#22d3ee');

    // Beat-reactive concentric shockwave rings behind the equalizer
    ctx.save();
    ctx.strokeStyle = accent;
    for (let r = 0; r < 3; r += 1) {
      const phase = ((this.clock * 1.15 + r * 0.33) % 1);
      const rad = 36 + phase * (165 + bassE * 65);
      ctx.globalAlpha = (1 - phase) * (0.12 + bassE * 0.22);
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.56, rad, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // Animated 24-band equalizer spectrum with glowing peak-hold caps
    const bars = this.ledBarLevels.length;
    const gap = 4;
    const barW = (w - 32 - gap * (bars - 1)) / bars;
    for (let i = 0; i < bars; i += 1) {
      const distCenter = Math.abs(i - (bars - 1) * 0.5) / (bars * 0.5);
      const bandEnergy = distCenter < 0.35 ? bassE : distCenter < 0.7 ? midE : highE;
      const target = Math.min(
        1,
        0.14 + bandEnergy * (0.88 - distCenter * 0.22) + Math.abs(Math.sin(this.clock * 6.5 + i * 0.62)) * 0.19
      );
      this.ledBarLevels[i] += (target - this.ledBarLevels[i]) * 0.38;
      if (this.ledBarLevels[i] > this.ledPeakLevels[i]) {
        this.ledPeakLevels[i] = this.ledBarLevels[i];
      } else {
        this.ledPeakLevels[i] = Math.max(this.ledBarLevels[i], this.ledPeakLevels[i] - 0.032);
      }

      const bh = Math.max(8, this.ledBarLevels[i] * (h - 70));
      const bx = 16 + i * (barW + gap);
      const by = h - 14 - bh;

      const barGrad = ctx.createLinearGradient(0, by, 0, h - 14);
      barGrad.addColorStop(0, '#ffffff');
      barGrad.addColorStop(0.2, accent);
      barGrad.addColorStop(1, 'rgba(15, 23, 42, 0.35)');
      ctx.fillStyle = barGrad;
      ctx.globalAlpha = 0.32 + this.ledBarLevels[i] * 0.56;
      ctx.fillRect(bx, by, barW, bh);

      // Peak-hold floating LED cap
      const peakY = h - 14 - Math.max(8, this.ledPeakLevels[i] * (h - 70));
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.88;
      ctx.fillRect(bx, peakY - 3, barW, 3);
    }
    ctx.globalAlpha = 1;

    // Subtle LED scanline grid overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    for (let y = 0; y < h; y += 6) {
      ctx.fillRect(0, y, w, 1.5);
    }

    // Center headline text (Song title or FINAL ENCORE banner)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (encoreActive) {
      ctx.fillStyle = '#fde047';
      ctx.font = '700 20px Oswald, sans-serif';
      ctx.fillText('★  FINAL ENCORE PERFORMANCE  ★', w * 0.5, 42);
    } else if (feverActive) {
      ctx.fillStyle = '#fde047';
      ctx.font = '700 20px Oswald, sans-serif';
      ctx.fillText('FEVER 2× OVERDRIVE', w * 0.5, 42);
    } else {
      ctx.fillStyle = 'rgba(226, 232, 240, 0.78)';
      ctx.font = '600 14px Oswald, sans-serif';
      ctx.fillText('LIVE IN CONCERT', w * 0.5, 38);
    }

    const title = (this.currentTrackTitle || 'ENCORE STAGE').toUpperCase().slice(0, 28);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 38px Oswald, sans-serif';
    ctx.fillText(title, w * 0.5, 82);

    // Glowing Friend Shoutout Ticker Ribbon across bottom of rear Jumbotron!
    ctx.fillStyle = 'rgba(20, 8, 36, 0.84)';
    ctx.fillRect(8, h - 38, w - 16, 30);
    ctx.strokeStyle = '#f472b6';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(8, h - 38, w - 16, 30);

    ctx.save();
    ctx.beginPath();
    ctx.rect(10, h - 37, w - 20, 28);
    ctx.clip();
    const tickerMsg = '★  Hello Carmen, and Carmelo! 🎸✨   •   VIP FRONT ROW   •   Hello Carmen, and Carmelo! 🎸✨  ★';
    ctx.font = '700 16px Oswald, sans-serif';
    ctx.fillStyle = '#fde047';
    ctx.textAlign = 'left';
    const scrollSpan = 640;
    const offset = ((this.clock * 46) % scrollSpan);
    ctx.fillText(tickerMsg, 20 - offset, h - 22);
    ctx.fillText(tickerMsg, 20 - offset + scrollSpan, h - 22);
    ctx.restore();

    // Frame border glow
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, w - 4, h - 4);

    this.ledTexture.needsUpdate = true;
  }

  buildPerformingBand() {
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
    });
    this.drummer.root.position.set(0, 0.64, -3.56);
    this.scene.add(this.drummer.root);

    const stickMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.45 });
    const stickGeo = new THREE.CylinderGeometry(0.025, 0.03, 0.74, 8);
    this.leftDrumstick = new THREE.Mesh(stickGeo, stickMat);
    this.leftDrumstick.position.set(0, -0.82, 0.34);
    this.leftDrumstick.rotation.x = Math.PI * 0.45;
    this.drummer.leftArmPivot.add(this.leftDrumstick);

    this.rightDrumstick = new THREE.Mesh(stickGeo, stickMat);
    this.rightDrumstick.position.set(0, -0.82, 0.34);
    this.rightDrumstick.rotation.x = Math.PI * 0.45;
    this.drummer.rightArmPivot.add(this.rightDrumstick);

    // 2. LEAD GUITARIST (stage left or center in Singing Guitarist Power Trio)
    this.guitarist = buildRobloxCharacter({
      torsoColor: 0x0e7490,
      pantsColor: 0x111827,
      skinColor: '#f5cfa6',
      hairColor: '#0f172a',
      hairStyle: 'spiky',
      accentColor: THEME_COLORS.guitar,
      smile: 'grin',
    });
    this.guitarist.root.position.set(-3.55, 0, -1.1);
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
    });
    this.bassist.root.position.set(3.55, 0, -1.1);
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
    });
    this.vocalist.root.position.set(0, 0, -0.78);
    this.vocalistHeadsetGroup = buildVocalistHeadset();
    this.vocalist.headGroup.add(this.vocalistHeadsetGroup);
    this.scene.add(this.vocalist.root);

    this.micStand = buildMicStand();
    this.micStand.position.set(0, 0, -0.18);
    this.scene.add(this.micStand);

    // 5. KEYBOARDIST + 3D Piano / Synth / Keytar Rig
    this.pianoRigGroup = new THREE.Group();
    this.pianoRigGroup.position.set(-2.45, 0, -2.65);
    this.pianoRigGroup.rotation.y = 0.42;
    this.scene.add(this.pianoRigGroup);

    this.keyboardist = buildRobloxCharacter({
      torsoColor: 0xbe185d,
      pantsColor: 0x0f172a,
      skinColor: '#f6d0ad',
      hairColor: '#312e81',
      hairStyle: 'spiky',
      accentColor: THEME_COLORS.piano,
      smile: 'grin',
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

    // Strict shadow budget: castShadow = true strictly on the 5 performing band members
    if (!this.isSoftwareGl) {
      Object.values(this.membersByRole).forEach((member) => {
        member?.root?.traverse((obj) => {
          if (obj.isMesh) {
            obj.castShadow = true;
            obj.receiveShadow = false;
          }
        });
      });
    }

    // Mount initial custom 3D gear, star lookalike & lineup geometry
    this.swapGuitarMesh(this.guitarModelId);
    this.swapBassMesh(this.bassModelId);
    this.swapKeyboardMesh(this.keyboardModelId);
    this.applyBandLineup();
    this.applyStarLook(this.starLookId);
  }

  getLineupMarks() {
    const id = this.bandLineupId;
    const pianoPos = this.bandLineup?.positions?.piano || { x: -2.45, z: -2.65, rotY: 0.42 };
    if (id === 'singing-guitarist') {
      return {
        guitar: { x: 0, z: -0.82, rotY: 0 },
        bass: { x: 3.3, z: -1.15, rotY: -0.26 },
        piano: pianoPos,
        vocals: { x: 0, z: -0.78, rotY: 0, visible: false, headset: false },
        micStandVisible: true,
        forceDoubleKick: false,
      };
    }
    if (id === 'pop-diva') {
      return {
        guitar: { x: -3.75, z: -1.35, rotY: 0.28 },
        bass: { x: 3.75, z: -1.35, rotY: -0.28 },
        piano: pianoPos,
        vocals: { x: 0, z: -0.68, rotY: 0, visible: true, headset: true },
        micStandVisible: false,
        forceDoubleKick: false,
      };
    }
    if (id === 'rock-power-trio') {
      return {
        guitar: { x: -3.15, z: -1.05, rotY: 0.22 },
        bass: { x: 3.15, z: -1.05, rotY: -0.22 },
        piano: pianoPos,
        vocals: { x: 0, z: -0.78, rotY: 0, visible: false, headset: false },
        micStandVisible: false,
        forceDoubleKick: true,
      };
    }
    // Default: 4-Piece Arena Band
    return {
      guitar: { x: -3.55, z: -1.1, rotY: 0.24 },
      bass: { x: 3.55, z: -1.1, rotY: -0.24 },
      piano: pianoPos,
      vocals: { x: 0, z: -0.78, rotY: 0, visible: true, headset: false },
      micStandVisible: true,
      forceDoubleKick: false,
    };
  }

  swapGuitarMesh(modelId) {
    this.guitarModelId = modelId || 'les-paul-sunburst';
    if (this.guitarAsset && this.guitarist) {
      this.guitarist.upperBody.remove(this.guitarAsset.group);
      this.guitarAsset.dispose?.();
      this.guitarAsset = null;
    }
    const built = buildCustomGuitarMesh(this.guitarModelId, this.instrumentSkinId);
    built.group.position.set(0.08, 0.42, 0.36);
    built.group.rotation.set(0.06, 0.08, 0.26);
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
    const built = buildCustomBassMesh(this.bassModelId, this.instrumentSkinId);
    built.group.position.set(0.06, 0.44, 0.36);
    built.group.rotation.set(0.05, -0.08, 0.3);
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
    const built = buildCustomDrumKitMesh(this.drumKitModelId, {
      forceDoubleKick,
      skinId: this.instrumentSkinId,
    });
    built.group.position.set(0, 0.64, -3.4);
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
    const built = buildCustomKeyboardMesh(this.keyboardModelId, this.instrumentSkinId);
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
        this.keyboardist.root.position.set(0, 0, this.keyboardModelId === 'concert-grand' ? -0.92 : -0.68);
      }
    }
  }

  applyStarLook(starLookId) {
    this.starLookId = starLookId || 'default-band';
    const look = getStarLookById(this.starLookId);

    // Always reset vocalist & guitarist first so switching looks stays clean
    this.vocalist?.applyLook(null);
    this.guitarist?.applyLook(null);

    if (!look || look.id === 'default-band') return;

    const marks = this.getLineupMarks();
    if (look.targetRole === 'guitar') {
      this.guitarist?.applyLook(look);
    } else {
      // Frontperson look: apply to Vocalist if visible, else Singing Guitarist
      if (marks.vocals.visible && this.vocalist) {
        this.vocalist.applyLook(look);
      } else if (this.guitarist) {
        this.guitarist.applyLook(look);
      }
    }
  }

  applyBandLineup() {
    const marks = this.getLineupMarks();
    if (this.guitarist) {
      this.guitarist.root.position.set(marks.guitar.x, 0, marks.guitar.z);
      this.guitarist.root.rotation.y = marks.guitar.rotY;
    }
    if (this.bassist) {
      this.bassist.root.position.set(marks.bass.x, 0, marks.bass.z);
      this.bassist.root.rotation.y = marks.bass.rotY;
    }
    if (this.pianoRigGroup && marks.piano) {
      this.pianoRigGroup.position.set(marks.piano.x, 0, marks.piano.z);
      this.pianoRigGroup.rotation.y = marks.piano.rotY ?? 0.42;
    }
    if (this.vocalist) {
      this.vocalist.root.visible = marks.vocals.visible;
      this.vocalist.root.position.set(marks.vocals.x, 0, marks.vocals.z);
      this.vocalist.root.rotation.y = marks.vocals.rotY;
    }
    if (this.vocalistHeadsetGroup) {
      this.vocalistHeadsetGroup.visible = marks.vocals.headset;
    }
    if (this.micStand) {
      this.micStand.visible = marks.micStandVisible;
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

  setInstrumentSkin(skinId) {
    this.instrumentSkinId = skinId || 'classic-sunburst';
    const marks = this.getLineupMarks();
    this.swapGuitarMesh(this.guitarModelId);
    this.swapBassMesh(this.bassModelId);
    this.swapDrumKitMesh(this.drumKitModelId, marks.forceDoubleKick);
    this.swapKeyboardMesh(this.keyboardModelId);

    // Swap amp cabinet grille texture cleanly and dispose old texture
    const prevGrillTex = this.ampGrillTex;
    this.ampGrillTex = createAmpGrilleSkinTexture(this.instrumentSkinId);
    for (let i = 0; i < this.ampGrillMats.length; i += 1) {
      this.ampGrillMats[i].map = this.ampGrillTex;
      this.ampGrillMats[i].needsUpdate = true;
    }
    prevGrillTex?.dispose?.();
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
   * Builds 152 Detailed Roblox R15-Style Crowd Characters using batched InstancedMesh layers:
   *  - Rounded cylindrical LatheGeometry Roblox heads + classic smile/eyes face texture decals
   *  - Randomized headwear pools: spiky hair, baseball caps with brims, and over-ear headphones
   *  - Multi-part R15 torsos (upper chest + waist belt) in vibrant concert streetwear + distinct pants
   *  - Shoulder & elbow-jointed waving arms propagating in smooth front-to-back stadium waves
   *  - Glowing neon lightsticks held aloft facing stage spotlights
   */
  buildFullBodiedCrowd3D() {
    const count = 152;
    this.crowdCount = count;
    this.crowdSeeds = [];

    const legsGeo = new THREE.BoxGeometry(0.56, 0.72, 0.34);
    const beltGeo = new THREE.BoxGeometry(0.65, 0.16, 0.39);
    const torsoGeo = new THREE.BoxGeometry(0.68, 0.64, 0.38);
    const headGeo = createRobloxR15HeadGeometry();
    const hairGeo = createSpikyHairGeometry();
    const capGeo = createBaseballCapGeometry();
    const hpGeo = createHeadphonesGeometry();

    // Shoulder-jointed upper arm + elbow-jointed forearm for fluid R15 waving
    const upperArmGeo = new THREE.BoxGeometry(0.21, 0.36, 0.21);
    upperArmGeo.translate(0, 0.17, 0);
    const forearmGeo = new THREE.BoxGeometry(0.18, 0.36, 0.18);
    forearmGeo.translate(0, 0.17, 0);

    const stickGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.62, 6);
    stickGeo.translate(0, 0.31, 0);

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
    const upperArmMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.58, metalness: 0.08 });
    const forearmMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.05 });
    this.lightstickMat = new THREE.MeshBasicMaterial({ color: THEME_COLORS.guitar });

    // Split headwear counts cleanly across the 152 fans
    this.hairIndices = [];
    this.capIndices = [];
    this.hpIndices = [];
    for (let i = 0; i < count; i += 1) {
      const style = i % 5;
      if (style === 0 || style === 2) this.hairIndices.push(i);
      else if (style === 1 || style === 4) this.capIndices.push(i);
      else this.hpIndices.push(i);
    }

    this.crowdLegsMesh = new THREE.InstancedMesh(legsGeo, legsMat, count);
    this.crowdBeltMesh = new THREE.InstancedMesh(beltGeo, beltMat, count);
    this.crowdTorsoMesh = new THREE.InstancedMesh(torsoGeo, torsoMat, count);
    this.crowdHeadMesh = new THREE.InstancedMesh(headGeo, headMat, count);
    this.crowdHairMesh = new THREE.InstancedMesh(hairGeo, headwearMat, this.hairIndices.length);
    this.crowdCapMesh = new THREE.InstancedMesh(capGeo, headwearMat, this.capIndices.length);
    this.crowdHpMesh = new THREE.InstancedMesh(hpGeo, headwearMat, this.hpIndices.length);
    this.crowdUpperArmLMesh = new THREE.InstancedMesh(upperArmGeo, upperArmMat, count);
    this.crowdUpperArmRMesh = new THREE.InstancedMesh(upperArmGeo, upperArmMat, count);
    this.crowdForearmLMesh = new THREE.InstancedMesh(forearmGeo, forearmMat, count);
    this.crowdForearmRMesh = new THREE.InstancedMesh(forearmGeo, forearmMat, count);
    this.lightstickMesh = new THREE.InstancedMesh(stickGeo, this.lightstickMat, count);

    [
      this.crowdLegsMesh,
      this.crowdBeltMesh,
      this.crowdTorsoMesh,
      this.crowdHeadMesh,
      this.crowdHairMesh,
      this.crowdCapMesh,
      this.crowdHpMesh,
      this.crowdUpperArmLMesh,
      this.crowdUpperArmRMesh,
      this.crowdForearmLMesh,
      this.crowdForearmRMesh,
      this.lightstickMesh,
    ].forEach((m) => {
      m.frustumCulled = false;
    });

    // Arrange 152 R15 fans in stadium pit & rising bowl arcs from z = +4.4 out to z = +20.8
    const rows = 8;
    const perRow = Math.ceil(count / rows);
    let idx = 0;
    for (let r = 0; r < rows && idx < count; r += 1) {
      const rowT = r / (rows - 1);
      const zBase = 4.45 + rowT * 15.8;
      const spreadX = 9.6 + rowT * 7.4;

      for (let c = 0; c < perRow && idx < count; c += 1) {
        const colT = perRow > 1 ? c / (perRow - 1) : 0.5;
        const jitterX = Math.sin(idx * 12.7) * 0.4;
        const jitterZ = Math.cos(idx * 9.3) * 0.42;
        const x = (colT * 2 - 1) * spreadX + jitterX;
        const z = zBase + jitterZ;
        const floorY = -1.2 + Math.max(0, rowT - 0.32) * 1.15;
        const facingY = Math.atan2(-x, -1.5 - z);
        const scale = 0.88 + (idx % 5) * 0.052;
        const phase = idx * 0.67;
        const waveDelay = rowT * 0.72 + Math.abs(colT - 0.5) * 0.35;
        const hasStick = idx % 3 !== 0;

        this.crowdSeeds.push({ x, floorY, z, facingY, scale, phase, waveDelay, hasStick });

        // Randomized streetwear shirt, pants, and skin tone per fan
        this._colorA.setHex(CROWD_SHIRT_COLORS[idx % CROWD_SHIRT_COLORS.length]);
        this.crowdTorsoMesh.setColorAt(idx, this._colorA);
        this.crowdUpperArmLMesh.setColorAt(idx, this._colorA);
        this.crowdUpperArmRMesh.setColorAt(idx, this._colorA);

        this._colorB.setHex(CROWD_PANTS_COLORS[(idx * 3) % CROWD_PANTS_COLORS.length]);
        this.crowdLegsMesh.setColorAt(idx, this._colorB);

        this._colorB.setHex(CROWD_SKIN_TONES[idx % CROWD_SKIN_TONES.length]);
        this.crowdHeadMesh.setColorAt(idx, this._colorB);
        this.crowdForearmLMesh.setColorAt(idx, this._colorB);
        this.crowdForearmRMesh.setColorAt(idx, this._colorB);

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
      this.crowdHeadMesh,
      this.crowdHairMesh,
      this.crowdCapMesh,
      this.crowdHpMesh,
      this.crowdUpperArmLMesh,
      this.crowdUpperArmRMesh,
      this.crowdForearmLMesh,
      this.crowdForearmRMesh,
      this.lightstickMesh,
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
      this.crowdHeadMesh,
      this.crowdHairMesh,
      this.crowdCapMesh,
      this.crowdHpMesh,
      this.crowdUpperArmLMesh,
      this.crowdUpperArmRMesh,
      this.crowdForearmLMesh,
      this.crowdForearmRMesh,
      this.lightstickMesh
    );

    this.updateFullBodiedCrowd(0, 120, 0.12, 0.55, false);
  }

  updateFullBodiedCrowd(songTime, bpm, bassE, hypeNorm, feverOrEncore, sectionType = 'VERSE', overallE = 0.35) {
    const t = this.clock;
    const beatRad = songTime * (bpm / 60) * Math.PI * 2;
    const isBalladSway =
      !feverOrEncore &&
      (bpm < 96 || ((sectionType === 'INTRO' || sectionType === 'BRIDGE') && overallE < 0.32));
    const isChorusUnison = feverOrEncore || sectionType === 'CHORUS' || sectionType === 'OUTRO';
    const energy = Math.min(1.45, 0.24 + bassE * 0.85 + hypeNorm * 0.38 + (feverOrEncore ? 0.36 : 0));

    // Synchronize crowd lightstick glow in unison on Choruses / Fever / Encore!
    if (this.lightstickMat) {
      if (feverOrEncore) {
        this._colorA.setHex(0xfde047);
      } else if (isChorusUnison) {
        const hue = (t * 0.16) % 1;
        this._colorA.setHSL(hue, 0.92, 0.62);
      } else if (isBalladSway) {
        this._colorA.setHex(0xfef3c7);
      } else {
        this._colorA.setHex(THEME_COLORS[this.activeInstrument] || 0x38bdf8);
      }
      this.lightstickMat.color.lerp(this._colorA, 0.12);
    }

    let hairSlot = 0;
    let capSlot = 0;
    let hpSlot = 0;

    for (let i = 0; i < this.crowdCount; i += 1) {
      const s = this.crowdSeeds[i];
      const sc = s.scale;
      const cosF = Math.cos(s.facingY);
      const sinF = Math.sin(s.facingY);

      // Slow ballad unison side-to-side sway vs. energetic staggered stadium-wave jump & overhead clap!
      const wavePhase = isBalladSway
        ? beatRad * 0.25 - s.waveDelay * 0.4
        : beatRad * 0.5 - s.waveDelay * 2.4;
      const bounceWave = isBalladSway ? 0 : Math.abs(Math.sin(wavePhase + s.phase * 0.25));
      const jumpY = isBalladSway
        ? Math.sin(beatRad * 0.5 + s.phase * 0.2) * 0.025 * sc
        : bounceWave * (0.09 + energy * 0.4) * sc;
      const baseY = s.floorY + Math.max(0, jumpY);

      // 1. Legs / Pants
      this._dummy.position.set(s.x, baseY + 0.36 * sc, s.z);
      this._dummy.rotation.set(0, s.facingY, 0);
      this._dummy.scale.set(sc, sc, sc);
      this._dummy.updateMatrix();
      this.crowdLegsMesh.setMatrixAt(i, this._dummy.matrix);

      // 2. Waist / Belt detail
      const torsoLean = isBalladSway ? 0.03 : Math.sin(wavePhase + s.phase * 0.4) * 0.09 * energy;
      this._dummy.position.set(s.x, baseY + 0.78 * sc, s.z);
      this._dummy.rotation.set(torsoLean * 0.5, s.facingY, 0);
      this._dummy.scale.set(sc, sc, sc);
      this._dummy.updateMatrix();
      this.crowdBeltMesh.setMatrixAt(i, this._dummy.matrix);

      // 3. Upper R15 Torso (gentle unison sway during ballads, bouncy groove during rock sections)
      const swayZ = isBalladSway
        ? Math.sin(beatRad * 0.25) * 0.16
        : Math.sin(t * 2.4 + s.phase) * 0.07;
      this._dummy.position.set(s.x, baseY + 1.15 * sc, s.z);
      this._dummy.rotation.set(torsoLean, s.facingY, swayZ);
      this._dummy.scale.set(sc, sc, sc);
      this._dummy.updateMatrix();
      this.crowdTorsoMesh.setMatrixAt(i, this._dummy.matrix);

      // 4. Rounded Roblox R15 Head with Face Decal
      const headX = s.x;
      const headY = baseY + 1.72 * sc;
      const headZ = s.z;
      const headPitch = isBalladSway
        ? -0.05 + Math.sin(beatRad * 0.5) * 0.05
        : -0.07 + Math.sin(beatRad + s.phase * 0.5) * 0.13 * energy;
      this._dummy.position.set(headX, headY, headZ);
      this._dummy.rotation.set(headPitch, s.facingY, swayZ * 0.85);
      this._dummy.scale.set(sc, sc, sc);
      this._dummy.updateMatrix();
      this.crowdHeadMesh.setMatrixAt(i, this._dummy.matrix);

      // 5. Distinct Headwear (Spiky Hair / Baseball Cap / Headphones) locked to head transform!
      const style = i % 5;
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

      // 6. Shoulder-Jointed Upper Arms + Elbow-Jointed Forearms (ballad sway / overhead clap / fist pump!)
      const armOffset = 0.45 * sc;
      const shoulderY = baseY + 1.4 * sc;
      const upperLen = 0.34 * sc;
      const foreLen = 0.34 * sc;

      const clapFan = !isBalladSway && !s.hasStick && (i % 3 === 0);
      const clapPulse = clapFan ? Math.pow(Math.max(0, Math.sin(beatRad * 0.5)), 4) * 0.45 : 0;

      const waveL = isBalladSway
        ? Math.sin(beatRad * 0.25) * 0.42
        : clapFan
          ? -0.28 - clapPulse
          : Math.sin(wavePhase + s.phase * 0.3) * (0.28 + energy * 0.38);
      const waveR = isBalladSway
        ? Math.sin(beatRad * 0.25) * 0.46
        : clapFan
          ? 0.28 + clapPulse
          : Math.sin(wavePhase + s.phase * 0.3 + (isChorusUnison ? 0 : 0.55)) * (0.34 + energy * 0.44);

      // Left Upper Arm
      const lx = s.x - cosF * armOffset;
      const lz = s.z + sinF * armOffset;
      const lTiltZ = 0.24 + waveL;
      this._dummy.position.set(lx, shoulderY, lz);
      this._dummy.rotation.set(0.16, s.facingY, lTiltZ);
      this._dummy.scale.set(sc, sc, sc);
      this._dummy.updateMatrix();
      this.crowdUpperArmLMesh.setMatrixAt(i, this._dummy.matrix);

      // Left Elbow -> Forearm
      const lElbowX = lx - Math.sin(lTiltZ) * upperLen * cosF;
      const lElbowZ = lz + Math.sin(lTiltZ) * upperLen * sinF;
      const lElbowY = shoulderY + Math.cos(lTiltZ) * upperLen;
      const lForeTiltZ = lTiltZ * 0.85 - 0.14 + Math.cos(wavePhase * 1.2 + s.phase) * (isBalladSway ? 0.06 : 0.18);
      this._dummy.position.set(lElbowX, lElbowY, lElbowZ);
      this._dummy.rotation.set(0.24, s.facingY, lForeTiltZ);
      this._dummy.scale.set(sc, sc, sc);
      this._dummy.updateMatrix();
      this.crowdForearmLMesh.setMatrixAt(i, this._dummy.matrix);

      // Right Upper Arm
      const rx = s.x + cosF * armOffset;
      const rz = s.z - sinF * armOffset;
      const rTiltZ = -0.24 + waveR;
      this._dummy.position.set(rx, shoulderY, rz);
      this._dummy.rotation.set(0.18, s.facingY, rTiltZ);
      this._dummy.scale.set(sc, sc, sc);
      this._dummy.updateMatrix();
      this.crowdUpperArmRMesh.setMatrixAt(i, this._dummy.matrix);

      // Right Elbow -> Forearm
      const rElbowX = rx - Math.sin(rTiltZ) * upperLen * cosF;
      const rElbowZ = rz + Math.sin(rTiltZ) * upperLen * sinF;
      const rElbowY = shoulderY + Math.cos(rTiltZ) * upperLen;
      const rForeTiltZ = rTiltZ * 0.85 + 0.16 + Math.sin(wavePhase * 1.2 + s.phase) * (isBalladSway ? 0.06 : 0.2);
      this._dummy.position.set(rElbowX, rElbowY, rElbowZ);
      this._dummy.rotation.set(0.26, s.facingY, rForeTiltZ);
      this._dummy.scale.set(sc, sc, sc);
      this._dummy.updateMatrix();
      this.crowdForearmRMesh.setMatrixAt(i, this._dummy.matrix);

      // 7. Glowing Neon Lightstick held in raised right hand
      if (s.hasStick) {
        const tipX = rElbowX - Math.sin(rForeTiltZ) * foreLen * cosF;
        const tipZ = rElbowZ + Math.sin(rForeTiltZ) * foreLen * sinF;
        const tipY = rElbowY + Math.cos(rForeTiltZ) * foreLen;
        this._dummy.position.set(tipX, tipY, tipZ);
        this._dummy.rotation.set(0.18, s.facingY, rForeTiltZ * 1.18);
        this._dummy.scale.set(sc, sc * (0.95 + bassE * 0.35 + (isChorusUnison ? 0.18 : 0)), sc);
      } else {
        this._dummy.position.set(0, -40, 0);
        this._dummy.scale.set(0, 0, 0);
      }
      this._dummy.updateMatrix();
      this.lightstickMesh.setMatrixAt(i, this._dummy.matrix);
    }

    this.crowdLegsMesh.instanceMatrix.needsUpdate = true;
    this.crowdBeltMesh.instanceMatrix.needsUpdate = true;
    this.crowdTorsoMesh.instanceMatrix.needsUpdate = true;
    this.crowdHeadMesh.instanceMatrix.needsUpdate = true;
    this.crowdHairMesh.instanceMatrix.needsUpdate = true;
    this.crowdCapMesh.instanceMatrix.needsUpdate = true;
    this.crowdHpMesh.instanceMatrix.needsUpdate = true;
    this.crowdUpperArmLMesh.instanceMatrix.needsUpdate = true;
    this.crowdUpperArmRMesh.instanceMatrix.needsUpdate = true;
    this.crowdForearmLMesh.instanceMatrix.needsUpdate = true;
    this.crowdForearmRMesh.instanceMatrix.needsUpdate = true;
    this.lightstickMesh.instanceMatrix.needsUpdate = true;
  }

  buildPyrotechnicsAndFX() {
    // 1. 6 Front-Apron Volumetric 3D Flame Pillars + Pyro Light
    this.pyroNozzleXs = [-6.4, -4.2, -2.2, 2.2, 4.2, 6.4];
    this.flamePillars = [];

    const outerConeGeo = new THREE.ConeGeometry(0.52, 4.3, 10, 1, true);
    outerConeGeo.translate(0, 2.15, 0);
    const innerConeGeo = new THREE.ConeGeometry(0.28, 3.1, 8, 1, true);
    innerConeGeo.translate(0, 1.55, 0);

    const outerFlameMat = new THREE.MeshBasicMaterial({
      color: 0xf97316,
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

    this.pyroNozzleXs.forEach((nx, idx) => {
      const nozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
      nozzle.position.set(nx, 0.08, 2.86);
      this.scene.add(nozzle);

      const pillar = new THREE.Group();
      pillar.position.set(nx, 0.12, 2.86);
      const outer = new THREE.Mesh(outerConeGeo, outerFlameMat);
      const inner = new THREE.Mesh(innerConeGeo, innerFlameMat);
      pillar.add(outer, inner);
      pillar.visible = false;
      this.scene.add(pillar);
      this.flamePillars.push({ group: pillar, phase: idx * 1.13 });
    });

    this.pyroGlowLight = new THREE.PointLight(0xfb923c, 0, 26, 1.4);
    this.pyroGlowLight.position.set(0, 2.4, 3.2);
    this.scene.add(this.pyroGlowLight);

    // 1B. Stage-Edge CO2 Cryo-Jets (4 vertical frosty white mist columns firing on Fever & Chorus drops!)
    this.cryoJets = [];
    this.cryoJetIntensity = 0;
    const cryoConeGeo = new THREE.ConeGeometry(0.62, 5.0, 14, 1, true);
    cryoConeGeo.translate(0, 2.5, 0);
    this.cryoJetMat = createVolumetricSpotlightMaterial(0xe0f2fe, 0);
    [-5.3, -1.8, 1.8, 5.3].forEach((cx, idx) => {
      const jet = new THREE.Mesh(cryoConeGeo, this.cryoJetMat);
      jet.position.set(cx, 0.08, 2.95);
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

    // 2. 3D Golden Spark Fountains (Points, 180 particles)
    this.sparkCount = 180;
    this.sparkPositions = new Float32Array(this.sparkCount * 3);
    this.sparkColors = new Float32Array(this.sparkCount * 3);
    this.sparks = Array.from({ length: this.sparkCount }, () => ({
      active: false,
      x: 0,
      y: -50,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 0,
      maxLife: 1,
    }));
    this.sparkCursor = 0;

    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(this.sparkPositions, 3));
    sparkGeo.setAttribute('color', new THREE.BufferAttribute(this.sparkColors, 3));
    const sparkMat = new THREE.PointsMaterial({
      size: 0.56,
      map: this.glowTex,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.sparkPoints = new THREE.Points(sparkGeo, sparkMat);
    this.sparkPoints.frustumCulled = false;
    this.scene.add(this.sparkPoints);

    // 3. 3D Stadium Aerial Fireworks (Rising shells + 3D spherical star bursts, 280 particles)
    this.fwParticleCount = 280;
    this.fwPositions = new Float32Array(this.fwParticleCount * 3);
    this.fwColors = new Float32Array(this.fwParticleCount * 3);
    this.fwParticles = Array.from({ length: this.fwParticleCount }, () => ({
      active: false,
      x: 0,
      y: -60,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      r: 1,
      g: 0.9,
      b: 0.4,
      life: 0,
      maxLife: 1.4,
    }));
    this.fwCursor = 0;
    this.fwShells = [];

    const fwGeo = new THREE.BufferGeometry();
    fwGeo.setAttribute('position', new THREE.BufferAttribute(this.fwPositions, 3));
    fwGeo.setAttribute('color', new THREE.BufferAttribute(this.fwColors, 3));
    const fwMat = new THREE.PointsMaterial({
      size: 0.96,
      map: this.glowTex,
      vertexColors: true,
      transparent: true,
      opacity: 0.98,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.fwPoints = new THREE.Points(fwGeo, fwMat);
    this.fwPoints.frustumCulled = false;
    this.scene.add(this.fwPoints);

    // 4. 3D Fluttering Confetti Cannons (InstancedMesh, 160 metallic cards)
    this.confettiCount = 160;
    const confettiGeo = new THREE.PlaneGeometry(0.24, 0.13);
    const confettiMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
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

    const laserXs = [-5.8, -3.5, -1.2, 1.2, 3.5, 5.8];
    laserXs.forEach((lx, idx) => {
      const pivot = new THREE.Group();
      pivot.position.set(lx, 8.6, -2.0);
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

    // Pick a front-row crowd fan seed as the launch point
    const frontCount = Math.min(28, this.crowdSeeds.length);
    const seed = frontCount > 0 ? this.crowdSeeds[Math.floor(Math.random() * frontCount)] : null;
    const startX = seed ? seed.x * 0.72 : (laneIndex - 2) * 2.2 + (Math.random() - 0.5) * 1.6;
    const startY = seed ? seed.floorY + 1.55 : 0.6;
    const startZ = seed ? Math.min(8.5, seed.z) : 6.2;

    const flightTime = 0.52 + Math.random() * 0.14;
    const gravity = 15.8;
    const aimX = targetPos.x + (Math.random() - 0.5) * 0.45;
    const aimY = targetPos.y + 1.15 + (Math.random() - 0.5) * 0.25;
    const aimZ = targetPos.z;

    // Pick theme-aware prop matching the current concert venue
    let variant = Math.random() < 0.62 ? 'tomato' : 'cup';
    let splatHex = variant === 'tomato' ? 0xef4444 : 0xe2e8f0;
    if (this.venueId === 'christmas-wonderland') {
      variant = 'snowball';
      splatHex = 0xe0f2fe;
    } else if (this.venueId === 'halloween-cathedral') {
      variant = 'pumpkin';
      splatHex = 0xf97316;
    } else if (this.venueId === 'sakura-festival') {
      variant = 'sakuraFan';
      splatHex = 0xf472b6;
    } else if (this.venueId === 'tropical-beach') {
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
          this.flinchTimers[p.targetRole] = 0.48;
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
  notifyNoteEvent({ instrument, lane = 1, pitchNorm = 0.5, drumPart = null, isChord = false } = {}) {
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
      this.pianoHandAlt = -this.pianoHandAlt;
    }
  }

  setVenue(venueId) {
    this.venueId = venueId;
    if (this.venueEnv) {
      this.scene.remove(this.venueEnv.group);
      this.venueEnv.dispose();
      this.venueEnv = null;
    }

    const built = buildVenueEnvironment(venueId);
    this.venueEnv = built;
    this.scene.add(built.group);

    const meta = built.meta;
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
  }

  setCameraMode(mode) {
    if (mode === 'on' || mode === 'subtle' || mode === 'locked') {
      this.cameraMode = mode;
      this.cameraDirector?.setMode(mode);
    }
  }

  setTrackTitle(title) {
    this.currentTrackTitle = title || 'ENCORE STAGE';
    this.drawLedBackdrop(0.25, 0.25, 0.2, this.feverActive, this.encorePerformanceActive);
  }

  /**
   * Shifts stage lighting, LED backdrop, and pyrotechnics into blazing Gold-and-Pyro Final Encore mode!
   */
  setEncorePerformance(active, trackTitle = null) {
    this.encorePerformanceActive = Boolean(active);
    if (trackTitle) this.currentTrackTitle = trackTitle;
    this.setInstrumentTheme(this.activeInstrument, this.feverActive);
    this.drawLedBackdrop(0.45, 0.4, 0.35, this.feverActive, this.encorePerformanceActive);

    if (this.encorePerformanceActive) {
      this.triggerStagePyro(1.35);
      this.triggerConfettiBurst();
      this.launchFireworkShell();
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

  setMemberMissed(instrument, missed) {
    this.missedInstrument = missed ? instrument : null;

    ['guitar', 'bass', 'drums'].forEach((role) => {
      const member = this.membersByRole[role];
      if (member) {
        member.setShocked(missed && role === instrument);
      }
    });
  }

  triggerStagePyro(intensity = 1.0) {
    this.pyroFlameIntensity = Math.max(this.pyroFlameIntensity, Math.min(1.65, intensity));
    this.pyroFlameTimer = Math.max(this.pyroFlameTimer, 0.95 + intensity * 0.45);
    this.sparkEmitterTimer = Math.max(this.sparkEmitterTimer, 1.25 + intensity * 0.5);
    if (intensity >= 1.0) {
      this.triggerCryoJets(1.4 + intensity * 0.35);
      this.triggerBandJump(intensity);
    }
  }

  triggerConfettiBurst() {
    let spawned = 0;
    const perBurst = 90;
    for (let i = 0; i < this.confettiCount && spawned < perBurst; i += 1) {
      const c = this.confettiItems[i];
      if (c.active && c.life < c.maxLife * 0.65) continue;

      const side = spawned % 2 === 0 ? -1 : 1;
      c.active = true;
      c.x = side * (5.8 + Math.random() * 1.4);
      c.y = 0.35 + Math.random() * 0.4;
      c.z = 2.2 + (Math.random() - 0.5) * 1.2;

      c.vx = -side * (2.2 + Math.random() * 4.8) + (Math.random() - 0.5) * 2.2;
      c.vy = 6.9 + Math.random() * 4.8;
      c.vz = -1.2 + (Math.random() - 0.5) * 4.2;

      c.rx = Math.random() * Math.PI * 2;
      c.ry = Math.random() * Math.PI * 2;
      c.rz = Math.random() * Math.PI * 2;
      c.vrx = (Math.random() - 0.5) * 9;
      c.vry = (Math.random() - 0.5) * 9;
      c.vrz = (Math.random() - 0.5) * 7;
      c.life = 0;
      c.maxLife = 3.2 + Math.random() * 1.8;
      spawned += 1;
    }
  }

  launchFireworkShell(force = false) {
    const meta = this.venueEnv?.meta;
    if (!force && !meta?.supportsAerialFireworks && !this.encorePerformanceActive) return;
    if (this.fwShells.length >= 6) return;

    const x = (Math.random() - 0.5) * 22;
    const z = -10.5 - Math.random() * 8.5;
    const ceiling = meta?.fireworksCeilingY || 16.5;
    const apexY = Math.max(9.5, ceiling - 4.0 + Math.random() * 3.2);
    const palette = FIREWORK_PALETTES[Math.floor(Math.random() * FIREWORK_PALETTES.length)];

    this.fwShells.push({
      x,
      y: 1.6,
      z,
      vx: (Math.random() - 0.5) * 1.8,
      vy: 13.5 + Math.random() * 4.5,
      apexY,
      palette,
      trailAccum: 0,
    });
  }

  detonateFireworkShell(shell) {
    const starCount = this.adaptiveLowPower ? 24 : 46;
    const pal = shell.palette;
    const pan = Math.max(-0.85, Math.min(0.85, shell.x / 13));
    if (typeof this.onFireworkBurst === 'function') {
      this.onFireworkBurst(pan);
    }

    for (let i = 0; i < starCount; i += 1) {
      const p = this.fwParticles[this.fwCursor];
      this.fwCursor = (this.fwCursor + 1) % this.fwParticleCount;

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 3.6 + Math.random() * 5.2;

      p.active = true;
      p.x = shell.x;
      p.y = shell.y;
      p.z = shell.z;
      p.vx = Math.sin(phi) * Math.cos(theta) * speed;
      p.vy = Math.cos(phi) * speed + 0.8;
      p.vz = Math.sin(phi) * Math.sin(theta) * speed;
      p.life = 0;
      p.maxLife = 1.05 + Math.random() * 0.65;

      this._colorA.setHex(pal[i % pal.length]);
      p.r = this._colorA.r;
      p.g = this._colorA.g;
      p.b = this._colorA.b;
    }
  }

  setEncoreFinale(active, grade = 'A') {
    this.encoreFinaleActive = Boolean(active);
    this.encoreGrade = grade || 'A';
    this.finaleFireworkTimer = 0.08;
    this.finaleConfettiTimer = 0.15;

    if (this.encoreFinaleActive) {
      this.triggerStagePyro(grade === 'S' ? 1.55 : 1.2);
      if (grade === 'S' || grade === 'A' || this.encorePerformanceActive) {
        this.triggerConfettiBurst();
      }
      if (this.venueEnv?.meta?.supportsAerialFireworks || this.encorePerformanceActive) {
        this.launchFireworkShell(true);
        this.launchFireworkShell(true);
      }
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

    this.cameraDirector.update(this.camera, dt, {
      clock: this.clock,
      playing: Boolean(stageState?.playing),
      songTime: stageState?.songTime ?? this.clock,
      bpm: Math.max(70, Math.min(200, stageState?.bpm || 120)),
      combo: stageState?.combo || 0,
      fever: Boolean(stageState?.feverActive),
      encore: Boolean(stageState?.isEncore || this.encorePerformanceActive),
      encoreFinaleActive: this.encoreFinaleActive,
      stemDropped: Boolean(stageState?.stemDropped),
      activeInstrument: stageState?.instrument || this.activeInstrument,
      overallEnergy: telemetry?.overallEnergy || 0,
      bassEnergy: telemetry?.bassEnergy || 0,
      stemActivity: stageState?.stemActivity || { drums: true, bass: true, guitar: true, piano: true },
      lineupPositions: {
        guitar: marks.guitar,
        bass: marks.bass,
        piano: marks.piano,
        vocalist: marks.vocals,
        drums: { x: 0, y: 0.64, z: -3.56 },
      },
      livePositions: this.livePositions,
      hasVocalist: Boolean(marks.vocals?.visible),
      currentSection: stageState?.currentSection || null,
      beatGrid: stageState?.beatGrid || null,
    });
  }

  updatePyrotechnics(dt, stageState, telemetry) {
    const t = this.clock;
    const playing = Boolean(stageState?.playing);
    const fever = Boolean(stageState?.feverActive);
    const encore = Boolean(stageState?.isEncore || this.encorePerformanceActive);
    const combo = stageState?.combo || 0;
    const overallE = telemetry?.overallEnergy || 0;

    // A. Auto-launch periodic aerial fireworks during Fever Mode, Final Encore & Encore Results!
    if (this.encoreFinaleActive) {
      this.finaleFireworkTimer -= dt;
      if (this.finaleFireworkTimer <= 0) {
        this.launchFireworkShell(true);
        this.finaleFireworkTimer = this.encoreGrade === 'S' ? 0.58 : 0.92;
      }
      if (this.encoreGrade === 'S' || this.encoreGrade === 'A' || encore) {
        this.finaleConfettiTimer -= dt;
        if (this.finaleConfettiTimer <= 0) {
          this.triggerConfettiBurst();
          this.finaleConfettiTimer = 2.5;
        }
      }
    } else if (playing && (fever || (encore && combo >= 15))) {
      this.feverFireworkTimer -= dt;
      if (this.feverFireworkTimer <= 0) {
        this.launchFireworkShell(encore);
        this.feverFireworkTimer = fever ? 1.05 : 1.8;
      }
    }

    // B. Stage Front Volumetric Flame Pillars
    if (this.pyroFlameTimer > 0) {
      this.pyroFlameTimer = Math.max(0, this.pyroFlameTimer - dt);
      const env = Math.min(1, this.pyroFlameTimer * 2.2) * this.pyroFlameIntensity;
      this.outerFlameMat.opacity = Math.min(0.85, env * 0.72);
      this.innerFlameMat.opacity = Math.min(0.95, env * 0.88);
      this.pyroGlowLight.intensity = env * 36;

      for (let i = 0; i < this.flamePillars.length; i += 1) {
        const fp = this.flamePillars[i];
        fp.group.visible = true;
        const flicker = 0.78 + Math.sin(t * 28 + fp.phase) * 0.24;
        const scaleY = Math.max(0.15, env * flicker);
        const scaleXZ = 0.75 + env * 0.35;
        fp.group.scale.set(scaleXZ, scaleY, scaleXZ);
        fp.group.rotation.y = t * 3 + fp.phase;
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

    // C. Golden Spark Fountains (plus continuous indoor fountains at Royal Opera House!)
    if (this.venueEnv?.meta?.continuousIndoorFountains && (playing || this.encoreFinaleActive)) {
      this.sparkEmitterTimer = Math.max(this.sparkEmitterTimer, 0.2);
    }
    if (this.sparkEmitterTimer > 0) {
      this.sparkEmitterTimer = Math.max(0, this.sparkEmitterTimer - dt);
      const emitPerFrame = Math.min(12, Math.ceil(dt * (this.venueEnv?.meta?.continuousIndoorFountains ? 64 : 120)));
      for (let e = 0; e < emitPerFrame; e += 1) {
        const nozzleX = this.pyroNozzleXs[Math.floor(Math.random() * this.pyroNozzleXs.length)];
        const sp = this.sparks[this.sparkCursor];
        this.sparkCursor = (this.sparkCursor + 1) % this.sparkCount;
        sp.active = true;
        sp.x = nozzleX + (Math.random() - 0.5) * 0.25;
        sp.y = 0.16;
        sp.z = 2.86 + (Math.random() - 0.5) * 0.25;
        sp.vx = (Math.random() - 0.5) * 1.9;
        sp.vy = 5.5 + Math.random() * 4.4;
        sp.vz = (Math.random() - 0.5) * 1.6;
        sp.life = 0;
        sp.maxLife = 0.65 + Math.random() * 0.45;
      }
    }

    let anySparkUpdated = false;
    for (let i = 0; i < this.sparkCount; i += 1) {
      const sp = this.sparks[i];
      const idx3 = i * 3;
      if (!sp.active) {
        if (this.sparkPositions[idx3 + 1] > -40) {
          this.sparkPositions[idx3 + 1] = -50;
          anySparkUpdated = true;
        }
        continue;
      }
      anySparkUpdated = true;
      sp.life += dt;
      if (sp.life >= sp.maxLife) {
        sp.active = false;
        this.sparkPositions[idx3 + 1] = -50;
        continue;
      }
      sp.vy -= 9.8 * dt;
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.z += sp.vz * dt;

      const fade = 1 - sp.life / sp.maxLife;
      this.sparkPositions[idx3] = sp.x;
      this.sparkPositions[idx3 + 1] = sp.y;
      this.sparkPositions[idx3 + 2] = sp.z;
      this.sparkColors[idx3] = 1.0 * fade;
      this.sparkColors[idx3 + 1] = (0.72 + fade * 0.28) * fade;
      this.sparkColors[idx3 + 2] = (0.2 + fade * 0.45) * fade;
    }
    if (anySparkUpdated) {
      this.sparkPoints.geometry.attributes.position.needsUpdate = true;
      this.sparkPoints.geometry.attributes.color.needsUpdate = true;
    }

    // D. 3D Stadium Aerial Fireworks
    for (let i = this.fwShells.length - 1; i >= 0; i -= 1) {
      const sh = this.fwShells[i];
      sh.x += sh.vx * dt;
      sh.y += sh.vy * dt;
      sh.vy = Math.max(4.5, sh.vy - 5.2 * dt);
      sh.trailAccum += dt;

      if (sh.trailAccum >= 0.025) {
        sh.trailAccum = 0;
        const p = this.fwParticles[this.fwCursor];
        this.fwCursor = (this.fwCursor + 1) % this.fwParticleCount;
        p.active = true;
        p.x = sh.x + (Math.random() - 0.5) * 0.14;
        p.y = sh.y;
        p.z = sh.z;
        p.vx = (Math.random() - 0.5) * 0.4;
        p.vy = -1.2;
        p.vz = (Math.random() - 0.5) * 0.4;
        p.r = 1.0;
        p.g = 0.88;
        p.b = 0.55;
        p.life = 0;
        p.maxLife = 0.28;
      }

      if (sh.y >= sh.apexY) {
        this.detonateFireworkShell(sh);
        this.fwShells.splice(i, 1);
      }
    }

    let anyFwUpdated = false;
    for (let i = 0; i < this.fwParticleCount; i += 1) {
      const p = this.fwParticles[i];
      const idx3 = i * 3;
      if (!p.active) {
        if (this.fwPositions[idx3 + 1] > -50) {
          this.fwPositions[idx3 + 1] = -60;
          anyFwUpdated = true;
        }
        continue;
      }
      anyFwUpdated = true;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        this.fwPositions[idx3 + 1] = -60;
        continue;
      }
      const drag = Math.pow(0.26, dt);
      p.vx *= drag;
      p.vz *= drag;
      p.vy = p.vy * drag - 3.6 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      const fade = Math.max(0, 1 - p.life / p.maxLife);
      const twinkle = 0.82 + 0.18 * Math.sin(t * 32 + i * 2.1);
      this.fwPositions[idx3] = p.x;
      this.fwPositions[idx3 + 1] = p.y;
      this.fwPositions[idx3 + 2] = p.z;
      this.fwColors[idx3] = p.r * fade * twinkle;
      this.fwColors[idx3 + 1] = p.g * fade * twinkle;
      this.fwColors[idx3 + 2] = p.b * fade * twinkle;
    }
    if (anyFwUpdated) {
      this.fwPoints.geometry.attributes.position.needsUpdate = true;
      this.fwPoints.geometry.attributes.color.needsUpdate = true;
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

    // F. Multi-Beam 3D Concert Laser Sweeps
    const isHighTechVenue =
      this.venueId === 'tokyo-dome' ||
      this.venueId === 'coachella' ||
      this.venueId === 'cyber-tokyo' ||
      this.venueId === 'royal-opera';
    const isFinaleLaser = this.encoreFinaleActive && (this.encoreGrade === 'S' || this.encoreGrade === 'A' || encore);
    const laserStrength = isFinaleLaser
      ? 0.44
      : fever || encore
        ? 0.38
        : playing && combo >= 50
          ? 0.3
          : isHighTechVenue && playing
            ? 0.14 + overallE * 0.12
            : 0;

    for (let i = 0; i < this.laserBeams.length; i += 1) {
      const lb = this.laserBeams[i];
      lb.mat.opacity = THREE.MathUtils.damp(lb.mat.opacity, laserStrength, 4.5, dt);
      if (lb.mat.opacity > 0.005) {
        const dir = i < 3 ? 1 : -1;
        const speed = fever || isFinaleLaser || encore ? 2.15 : 1.35;
        lb.pivot.rotation.z = Math.sin(t * speed + i * 0.85) * 0.82 * dir;
        lb.pivot.rotation.x = 0.28 + Math.cos(t * (speed * 0.75) + i * 0.6) * 0.48;
      }
    }

    // G. CO2 Cryo-Jets blasting frosty vertical plumes on Fever, Encore & Chorus Drops
    this.cryoBurstTimer = Math.max(0, this.cryoBurstTimer - dt);
    const cryoTarget =
      fever || encore || this.encoreFinaleActive || this.cryoBurstTimer > 0
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

    // I. Floor Subwoofers + Curved Hanging Line-Array Woofer Excursions synced to Bass energy
    const bassHit = Math.min(1, telemetry?.bassEnergy || 0);
    if (this.subCones) {
      const push = 1.44 + bassHit * 0.1;
      for (let i = 0; i < this.subCones.length; i += 1) {
        this.subCones[i].position.z = push;
      }
    }
    if (this.lineArrayWoofers) {
      const wooferZ = 0.39 + bassHit * 0.048;
      const wooferS = 1 + bassHit * 0.08;
      for (let i = 0; i < this.lineArrayWoofers.length; i += 1) {
        this.lineArrayWoofers[i].position.z = wooferZ;
        this.lineArrayWoofers[i].scale.set(wooferS, wooferS, 1);
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
    { playing, songTime, bpm, moodId, currentSection, beatGrid, marks, guitarE, bassE, vocalE, fever, encore, sustainHeld }
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
          gM.targetX = isSingingGuitarist ? 0 : -0.18;
          gM.targetZ = 1.38;
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
          gM.targetX = -0.65;
          gM.targetZ = 1.42;
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
        bM.targetX = 2.35;
        bM.targetZ = -2.15;
        bM.targetRotY = -0.45;
        break;
      case 'POWER_LUNGE_FRONT':
      case 'EDGE_SURGE':
        bM.stanceMode = 'POWER_SLIDE';
        bM.targetX = 2.55;
        bM.targetZ = 1.15;
        bM.targetRotY = -0.24;
        break;
      case 'TRUSS_STRIDE_R':
        bM.stanceMode = 'TRUSS_STRIDE';
        bM.targetX = 4.0;
        bM.targetZ = 0.96;
        bM.targetRotY = -0.34;
        break;
      case 'MONITOR_GROOVE':
      case 'SUPPORT_STEP_OUT':
        bM.stanceMode = 'EDGE_MONITOR';
        bM.targetX = 2.85;
        bM.targetZ = 1.08;
        bM.targetRotY = -0.22;
        break;
      case 'WIDE_POWER_STANCE':
      case 'WIDE_STANCE_BUILD':
      case 'CROWD_FIST_PUMP':
      case 'CROWD_SALUTE_JUMP':
        bM.stanceMode = 'POWER_STANCE';
        bM.targetX = 2.45;
        bM.targetZ = 0.68;
        bM.targetRotY = -0.18;
        break;
      case 'SIDESTEP_SHUFFLE_R':
        bM.stanceMode = 'PACE';
        bM.targetX = marks.bass.x - 0.72;
        bM.targetZ = marks.bass.z + 0.55;
        bM.targetRotY = -0.18;
        break;
      case 'AMP_BACK_STANCE':
        bM.stanceMode = 'HOME';
        bM.targetX = marks.bass.x + 0.48;
        bM.targetZ = marks.bass.z - 0.42;
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
        // Step gracefully aside to let Lead Guitarist own the center monitor spotlight during solos!
        vM.stanceMode = 'PACE';
        vM.targetX = 2.15;
        vM.targetZ = -0.25;
        vM.targetRotY = -0.48;
      } else if (!isPopDiva && vocalE > 0.28 && (vM.action === 'MIC_CENTER_SING' || secType === 'VERSE')) {
        vM.stanceMode = 'MIC_CENTER';
        vM.targetX = 0;
        vM.targetZ = -0.68;
        vM.targetRotY = 0;
      } else if (vM.action === 'TRUSS_STRIDE_L' || vM.action === 'STAGE_LEFT_PACE') {
        vM.stanceMode = isHighEnergy ? 'TRUSS_STRIDE' : 'PACE';
        vM.targetX = isPopDiva ? -2.05 : -1.55;
        vM.targetZ = isHighEnergy ? 1.28 : 0.52;
        vM.targetRotY = 0.22;
      } else if (vM.action === 'TRUSS_STRIDE_R' || vM.action === 'STAGE_RIGHT_PACE') {
        vM.stanceMode = isHighEnergy ? 'TRUSS_STRIDE' : 'PACE';
        vM.targetX = isPopDiva ? 2.05 : 1.55;
        vM.targetZ = isHighEnergy ? 1.28 : 0.52;
        vM.targetRotY = -0.22;
      } else if (vM.action === 'EDGE_MONITOR_LEAN' || vM.action === 'EDGE_SURGE' || vM.action === 'CENTER_ANTHEM_BELT') {
        vM.stanceMode = 'EDGE_MONITOR';
        vM.targetX = 0;
        vM.targetZ = 1.24;
        vM.targetRotY = 0;
      } else {
        vM.stanceMode = 'MIC_CENTER';
        vM.targetX = 0;
        vM.targetZ = -0.55;
        vM.targetRotY = 0;
      }
    }

    // Track sustain lean-back & knee-drop / fist-pump weights smoothly
    gM.sustainLean = THREE.MathUtils.damp(
      gM.sustainLean,
      sustainHeld && this.activeInstrument === 'guitar' ? 1.0 : gM.action === 'BACK_LEAN_BEND' ? 0.72 : 0,
      7.5,
      dt
    );
    bM.sustainLean = THREE.MathUtils.damp(
      bM.sustainLean,
      sustainHeld && this.activeInstrument === 'bass' ? 1.0 : 0,
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

    // 4. Critically Damped Spring-Damper stage traversal + walking stride + spins + jumps!
    const stepMemberSpring = (m, springFreq) => {
      const dx = m.targetX - m.x;
      const dz = m.targetZ - m.z;
      const dist = Math.hypot(dx, dz);

      const [nx, nvx] = stepSpring1D(m.x, m.vx, m.targetX, springFreq, dt);
      const [nz, nvz] = stepSpring1D(m.z, m.vz, m.targetZ, springFreq, dt);
      m.x = nx;
      m.vx = nvx;
      m.z = nz;
      m.vz = nvz;

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
    const currentSection = stageState?.currentSection || null;
    const beatGrid = stageState?.beatGrid || null;

    const drumE = playing ? Math.min(1, (telemetry?.drumEnergy || 0) * 1.65) : 0.12;
    const bassE = playing ? Math.min(1, (telemetry?.bassEnergy || 0) * 1.55) : 0.1;
    const guitarE = playing ? Math.min(1, (telemetry?.guitarEnergy || 0) * 1.65) : 0.12;
    const pianoE = playing ? Math.min(1, (telemetry?.pianoEnergy || guitarE * 0.72) * 1.6) : 0.12;
    const vocalE = playing ? Math.min(1, (telemetry?.vocalEnergy || 0) * 1.5) : 0.1;
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

    // PHASE 1 — CINEMATIC STAGE WALK-ON & GEAR SETUP (-4.5s to -2.0s)!
    const isWalkOn = playing && songTime < -2.0;
    const walkP = isWalkOn ? Math.max(0, Math.min(1, (songTime + 4.5) / 2.5)) : 1;
    const walkEase = 1 - Math.pow(1 - walkP, 2.6);
    const metaKeyInt = this.venueEnv?.meta?.keyIntensity ?? 0.74;
    const marks = this.getLineupMarks();
    const stemActivity = stageState?.stemActivity || { drums: true, bass: true, guitar: true };

    // Dynamic Stage Lighting & Section-Driven Mood Profile interpolation
    const lightState = this.lightingController.update(dt, {
      playing,
      songTime,
      bpm,
      combo: stageState?.combo || 0,
      fever,
      encore,
      encoreFinaleActive: this.encoreFinaleActive,
      overallEnergy: telemetry?.overallEnergy || 0,
      bassEnergy: bassE,
      stemDropped: Boolean(stageState?.stemDropped),
      isWalkOn,
      instrument: this.activeInstrument,
      venueMeta: this.venueEnv?.meta,
      currentSection,
    });
    this.lightingState = lightState;

    // Apply mood lighting to fog tint, rear band rim light, crowd glow & stage rim
    if (this.scene.fog && this.venueEnv?.meta) {
      this._colorC.setHex(this.venueEnv.meta.fogColor).lerp(lightState.fogColor, 0.36);
      this.scene.fog.color.copy(this._colorC);
    }
    if (this.bandRimLight) {
      this.bandRimLight.color.copy(lightState.bandRimColor);
      this.bandRimLight.intensity = lightState.bandRimIntensity + lightState.strobeFlash * 1.1;
    }
    if (this.crowdLight) {
      this.crowdLight.intensity = 16 * lightState.crowdGlowMult + lightState.strobeFlash * 10;
    }
    if (this.stageRimMat) {
      this.stageRimMat.emissiveIntensity = 1.45 * lightState.rimMult + lightState.strobeFlash * 0.9;
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
      const drumY = (drumMove < 0.65 ? (drumMove / 0.65) * 0.64 : 0.64) + riserHop;
      this.drummer.root.position.set(
        THREE.MathUtils.lerp(-6.4, 0, drumEase),
        drumY,
        THREE.MathUtils.lerp(-4.6, -3.56, drumEase)
      );
      this.drummer.root.rotation.y = THREE.MathUtils.lerp(1.35, 0, drumEase);
      const seatedLerp = Math.max(0, Math.min(1, (walkP - 0.58) / 0.22));
      this.drummer.leftLegPivot.rotation.x = THREE.MathUtils.lerp(stride * 0.55 * (1 - seatedLerp), -1.15, seatedLerp);
      this.drummer.rightLegPivot.rotation.x = THREE.MathUtils.lerp(-stride * 0.55 * (1 - seatedLerp), -1.15, seatedLerp);
      this.drummer.upperBody.position.y = THREE.MathUtils.lerp(0.96, 0.72, seatedLerp);
      this.drummer.upperBody.rotation.x = 0.08;
      this.drummer.headGroup.rotation.x = Math.sin(t * 6) * 0.1;
      if (seatedLerp > 0.6) {
        this.drummer.leftArmPivot.rotation.set(-1.05, 0, 0.25);
        this.drummer.rightArmPivot.rotation.set(-1.15, 0, -0.25);
        if (this.leftDrumstick) this.leftDrumstick.rotation.x = Math.PI * 0.45 + t * 18;
        if (this.rightDrumstick) this.rightDrumstick.rotation.x = Math.PI * 0.45 - t * 18;
      } else {
        this.drummer.leftArmPivot.rotation.set(-stride * 0.6, 0, 0.1);
        this.drummer.rightArmPivot.rotation.set(stride * 0.6, 0, -0.1);
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
      this.guitarist.leftArmPivot.rotation.set(THREE.MathUtils.lerp(-0.4, -1.05, strapLerp), 0, 0.26);
      this.guitarist.rightArmPivot.rotation.set(THREE.MathUtils.lerp(-0.35, -0.92, strapLerp), 0, -0.35);

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
      this.bassist.leftArmPivot.rotation.set(THREE.MathUtils.lerp(-0.4, -1.0, strapLerp), 0, 0.28);
      this.bassist.rightArmPivot.rotation.set(THREE.MathUtils.lerp(-0.35, -0.88, strapLerp), 0, -0.32);

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
        this.vocalist.leftArmPivot.rotation.set(vocEase > 0.72 ? -2.35 : -stride * 0.5, 0, vocEase > 0.72 ? -0.45 + waveAmp : 0.1);
        this.vocalist.rightArmPivot.rotation.set(vocEase > 0.72 ? -2.4 : stride * 0.5, 0, vocEase > 0.72 ? 0.45 - waveAmp : -0.1);
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
      });

      const gM = this.memberMotion.guitar;
      const bM = this.memberMotion.bass;
      const vM = this.memberMotion.vocals;
      const bpmBeatPhase = songTime * (bpm / 60) * Math.PI * 2;
      const bpmHalfPhase = bpmBeatPhase * 0.5;
      // Multi-frequency organic sway using irrational frequency ratios (1.0, φ=1.618, e=2.718) so body sway never loops!
      const organicSwayG =
        (Math.sin(t * 1.15) * 0.52 + Math.sin(t * 1.8607) * 0.31 + Math.sin(t * 3.1257) * 0.17);
      const organicSwayB =
        (Math.sin(t * 1.05 + 1.4) * 0.52 + Math.sin(t * 1.6989 + 0.7) * 0.31 + Math.sin(t * 2.854 + 2.1) * 0.17);
      const organicSwayV =
        (Math.sin(t * 1.25 + 2.3) * 0.52 + Math.sin(t * 2.0225 + 1.1) * 0.31 + Math.sin(t * 3.3975 + 0.4) * 0.17);

      // Drummer stays seated on the elevated rear drum riser
      this.drummer.root.position.set(0, 0.64, -3.56);
      this.drummer.root.rotation.y = 0;
      this.drummer.leftLegPivot.rotation.set(-1.15, 0, 0);
      this.drummer.rightLegPivot.rotation.set(-1.15, 0, 0);
      this.drummer.upperBody.position.y = 0.72;
      if (this.leftDrumstick) this.leftDrumstick.rotation.x = Math.PI * 0.45;
      if (this.rightDrumstick) this.rightDrumstick.rotation.x = Math.PI * 0.45;

      // Apply live roaming X / Jump Y / Z / Yaw to Guitarist, Bassist & Vocalist!
      const gStepBounce = Math.abs(Math.sin(gM.walkPhase)) * 0.09 * gM.moveSpeed * (1 - gM.kneeDrop * 0.85);
      const bStepBounce = Math.abs(Math.sin(bM.walkPhase)) * 0.085 * bM.moveSpeed * (1 - bM.kneeDrop * 0.85);
      const vStepBounce = Math.abs(Math.sin(vM.walkPhase)) * 0.09 * vM.moveSpeed;

      this.guitarist.root.position.set(gM.x, gM.jumpY + gStepBounce, gM.z);
      this.guitarist.root.rotation.y = gM.rotY;

      this.bassist.root.position.set(bM.x, bM.jumpY + bStepBounce, bM.z);
      this.bassist.root.rotation.y = bM.rotY;

      this.vocalist.root.position.set(vM.x, vM.jumpY + vStepBounce, vM.z);
      this.vocalist.root.rotation.y = vM.rotY;

      // 1. DRUMMER — Stick-twirl + slow nod during INTRO/silent breaks; full stick/cymbal animation when active!
      const drumMissed = this.missedInstrument === 'drums';
      const drumSilentIdle = playing && songTime >= 0 && stemActivity.drums === false && this.drumLeftHit < 0.05 && this.drumRightHit < 0.05;
      if (drumMissed) {
        this.drummer.upperBody.rotation.x = THREE.MathUtils.damp(this.drummer.upperBody.rotation.x, 0.44, 10, dt);
        this.drummer.headGroup.rotation.x = THREE.MathUtils.damp(this.drummer.headGroup.rotation.x, 0.35, 10, dt);
        this.drummer.leftArmPivot.rotation.x = THREE.MathUtils.damp(this.drummer.leftArmPivot.rotation.x, 0.15, 10, dt);
        this.drummer.rightArmPivot.rotation.x = THREE.MathUtils.damp(this.drummer.rightArmPivot.rotation.x, 0.15, 10, dt);
      } else if (drumSilentIdle) {
        // Intro/silent stick-twirl & relaxed BPM head-nod (or crowd fist-pump in higher energy sections)!
        const nod = Math.sin(bpmBeatPhase) * 0.16;
        const isIntroQuiet = lightState.sectionType === 'INTRO' || lightState.sectionType === 'BRIDGE';
        const rightLift = isIntroQuiet ? -1.18 + Math.sin(bpmHalfPhase) * 0.14 : -2.15 + Math.sin(bpmBeatPhase) * 0.34;
        this.drummer.upperBody.rotation.x = THREE.MathUtils.damp(this.drummer.upperBody.rotation.x, 0.04 + Math.abs(nod) * 0.2, 8, dt);
        this.drummer.headGroup.rotation.x = THREE.MathUtils.damp(this.drummer.headGroup.rotation.x, nod, 10, dt);
        this.drummer.leftArmPivot.rotation.x = THREE.MathUtils.damp(this.drummer.leftArmPivot.rotation.x, isIntroQuiet ? -0.92 : -0.45, 7, dt);
        this.drummer.leftArmPivot.rotation.z = THREE.MathUtils.damp(this.drummer.leftArmPivot.rotation.z, 0.18, 7, dt);
        this.drummer.rightArmPivot.rotation.x = THREE.MathUtils.damp(this.drummer.rightArmPivot.rotation.x, rightLift, 9, dt);
        this.drummer.rightArmPivot.rotation.z = THREE.MathUtils.damp(this.drummer.rightArmPivot.rotation.z, -0.26, 9, dt);
        if (isIntroQuiet) {
          if (this.rightDrumstick) this.rightDrumstick.rotation.x = Math.PI * 0.45 + t * 14.5;
          if (this.leftDrumstick) this.leftDrumstick.rotation.x = Math.PI * 0.45 - Math.sin(bpmHalfPhase) * 0.45;
        }
        if (this.drumKit?.kick) this.drumKit.kick.scale.set(1, 1, 1);
      } else {
        const autoL = Math.sin(bpmBeatPhase) * (0.2 + drumE * 0.45);
        const autoR = Math.sin(bpmBeatPhase + Math.PI) * (0.2 + drumE * 0.45);

        const strikeL = this.drumLeftHit > 0.05 ? -Math.sin(this.drumLeftHit * Math.PI) * 0.92 : autoL;
        const strikeR = this.drumRightHit > 0.05 ? -Math.sin(this.drumRightHit * Math.PI) * 0.98 : autoR;

        const leftAimZ = this.drumLeftTarget === 'hihat' ? 0.38 : -0.14;
        const rightAimZ = this.drumRightTarget === 'crash' ? -0.45 : 0.12;
        const rightLiftX = this.drumRightTarget === 'crash' && this.drumRightHit > 0.1 ? -0.55 : 0;

        this.drummer.upperBody.rotation.x = THREE.MathUtils.damp(
          this.drummer.upperBody.rotation.x,
          0.07 + drumE * 0.15 + this.drumKickImpulse * 0.12,
          12,
          dt
        );
        this.drummer.headGroup.rotation.x = Math.sin(bpmHalfPhase) * (0.1 + drumE * 0.25);
        this.drummer.leftArmPivot.rotation.x = -0.82 + strikeL * hypeBoost;
        this.drummer.leftArmPivot.rotation.z = THREE.MathUtils.damp(this.drummer.leftArmPivot.rotation.z, leftAimZ, 14, dt);
        this.drummer.rightArmPivot.rotation.x = -0.82 + rightLiftX + strikeR * hypeBoost;
        this.drummer.rightArmPivot.rotation.z = THREE.MathUtils.damp(this.drummer.rightArmPivot.rotation.z, rightAimZ, 14, dt);

        if (this.drumKit?.cymbals?.length >= 3) {
          this.drumKit.cymbals[0].rotation.z = Math.sin(this.cymbalPhase[0]) * (drumE * 0.1 + this.cymbalWobble[0] * 0.26);
          this.drumKit.cymbals[1].rotation.x = Math.sin(this.cymbalPhase[1]) * (drumE * 0.12 + this.cymbalWobble[1] * 0.38);
          this.drumKit.cymbals[2].rotation.x = Math.cos(this.cymbalPhase[2]) * (drumE * 0.12 + this.cymbalWobble[2] * 0.42);
          this.drumKit.cymbals[2].rotation.z = Math.sin(this.cymbalPhase[2] * 0.7) * this.cymbalWobble[2] * 0.24;
        }

        const kickScale = 1 + drumE * 0.055 + this.drumKickImpulse * 0.095;
        if (this.drumKit?.kick) this.drumKit.kick.scale.set(kickScale, 1, kickScale);
      }

      // 2. LEAD GUITARIST — Knee-Drop Solo, Windmill Strums, Power Slides, Back-to-Back Duets & Organic Sway!
      const guitarMissed = this.missedInstrument === 'guitar';
      const guitarSilentIdle = playing && songTime >= 0 && stemActivity.guitar === false && this.guitarStrumImpulse < 0.05;
      const isSingingGuitarist = this.bandLineupId === 'singing-guitarist';
      const gAirborne = gM.jumpY > 0.05;
      const gKneeDrop = gM.kneeDrop;
      const gPowerSpread =
        gM.stanceMode === 'POWER_SLIDE' || gM.stanceMode === 'ENCORE_SLIDE' ? 0.32 :
        gM.stanceMode === 'POWER_STANCE' ? 0.26 :
        gM.stanceMode === 'EDGE_MONITOR' || gM.stanceMode === 'BACK_TO_BACK' ? 0.22 :
        gM.stanceMode === 'TRUSS_STRIDE' ? 0.18 : 0.08;
      const gStride = Math.sin(gM.walkPhase) * 0.62 * gM.moveSpeed * (1 - gKneeDrop * 0.8);
      const gKneeTuck = gAirborne ? -0.58 : -Math.max(0, gM.squash) * 0.65;
      const gLungeOffset = gM.stanceMode === 'POWER_SLIDE' ? 0.28 : gM.stanceMode === 'EDGE_MONITOR' ? 0.16 : 0;

      // Knee-Drop Solo splits front leg forward (-0.95 rad) and drops back knee behind (+0.85 rad) & lowers torso!
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
      const gSquashDip = Math.max(-0.08, gM.squash * 0.24) + gLungeOffset * 0.22 + gKneeDrop * 0.34;
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
      } else if (guitarSilentIdle) {
        const nod = Math.sin(bpmBeatPhase) * 0.15;
        const hypeFist = -2.2 + Math.sin(bpmBeatPhase) * 0.32;
        this.electricGuitar.rotation.set(0.06, 0.08, THREE.MathUtils.damp(this.electricGuitar.rotation.z, -0.12, 6, dt));
        this.guitarist.upperBody.rotation.x = THREE.MathUtils.damp(this.guitarist.upperBody.rotation.x, 0.04, 6, dt);
        this.guitarist.upperBody.rotation.z = THREE.MathUtils.damp(this.guitarist.upperBody.rotation.z, organicSwayG * 0.07, 6, dt);
        this.guitarist.headGroup.rotation.x = THREE.MathUtils.damp(this.guitarist.headGroup.rotation.x, nod, 10, dt);
        this.guitarist.rightArmPivot.rotation.x = THREE.MathUtils.damp(this.guitarist.rightArmPivot.rotation.x, hypeFist, 8, dt);
        this.guitarist.rightArmPivot.rotation.z = THREE.MathUtils.damp(this.guitarist.rightArmPivot.rotation.z, -0.34, 8, dt);
        this.guitarist.leftArmPivot.rotation.x = THREE.MathUtils.damp(this.guitarist.leftArmPivot.rotation.x, -0.62, 7, dt);
        this.guitarist.leftArmPivot.rotation.z = THREE.MathUtils.damp(this.guitarist.leftArmPivot.rotation.z, 0.16, 7, dt);
      } else {
        const isSoloSec = lightState.sectionType === 'GUITAR_SOLO';
        const neckSkyBoost = gM.action === 'NECK_SKY_SOLO' ? 0.34 : isSoloSec ? 0.22 : 0;
        const guitarNeckTilt = 0.26 + gM.sustainLean * 0.26 + gKneeDrop * 0.28 + neckSkyBoost + (gAirborne ? 0.18 : 0);
        this.electricGuitar.rotation.set(0.06, 0.08, THREE.MathUtils.damp(this.electricGuitar.rotation.z, guitarNeckTilt, 9, dt));

        const strumSpeed = (isSoloSec ? 16 : 10) + guitarE * 14;
        const baseStrum = Math.sin(t * strumSpeed) * (0.16 + guitarE * 0.48);
        const impulseStrum = this.guitarStrumImpulse * 0.62 * this.guitarStrumDir;
        const headBangAmp = (lightState.sectionType === 'INTRO' ? 0.06 : 0.1) + guitarE * 0.22 + this.guitarHeadbangBoost * 0.26;
        const bob = Math.sin(bpmHalfPhase) * headBangAmp;
        const singLean = isSingingGuitarist ? 0.1 + vocalE * 0.18 : 0;
        const slideForwardLean = gM.stanceMode === 'POWER_SLIDE' ? 0.22 : gM.stanceMode === 'EDGE_MONITOR' ? 0.14 : 0;
        const sustainBackLean = -(gM.sustainLean * 0.34 + gKneeDrop * 0.28);

        this.guitarist.upperBody.rotation.x = THREE.MathUtils.damp(
          this.guitarist.upperBody.rotation.x,
          Math.abs(bob) * 0.42 + this.guitarHeadbangBoost * 0.14 + singLean + slideForwardLean + sustainBackLean,
          11,
          dt
        );
        this.guitarist.upperBody.rotation.z = THREE.MathUtils.damp(
          this.guitarist.upperBody.rotation.z,
          organicSwayG * (0.07 + guitarE * 0.14) - gStride * 0.12,
          10,
          dt
        );
        this.guitarist.headGroup.rotation.x = isSingingGuitarist
          ? -0.08 + Math.sin(t * 6.0) * (0.05 + vocalE * 0.14)
          : bob - gM.sustainLean * 0.22 - gKneeDrop * 0.24;
        this.guitarist.headGroup.rotation.y = isSingingGuitarist ? organicSwayG * 0.08 : organicSwayG * 0.24;

        // Windmill 360° arm strum flourish during Chorus / Outro!
        if (gM.windmillTimer > 0) {
          this.guitarist.rightArmPivot.rotation.x = -0.9 + gM.windmillPhase;
          this.guitarist.rightArmPivot.rotation.z = -0.42 + Math.sin(gM.windmillPhase) * 0.18;
        } else if (gM.fistPumpWeight > 0.35 && this.guitarStrumImpulse < 0.15) {
          this.guitarist.rightArmPivot.rotation.x = THREE.MathUtils.lerp(
            -0.94 + baseStrum,
            -2.3 + Math.sin(bpmBeatPhase) * 0.35,
            gM.fistPumpWeight
          );
          this.guitarist.rightArmPivot.rotation.z = -0.35;
        } else {
          this.guitarist.rightArmPivot.rotation.x = -0.94 + (baseStrum + impulseStrum) * hypeBoost;
          this.guitarist.rightArmPivot.rotation.z = -0.35;
        }

        const soloShredOsc = isSoloSec ? Math.sin(t * 17.5) * 0.12 : 0;
        const targetFretZ = 0.12 + this.guitarFretPos * 0.44 + soloShredOsc;
        const targetFretX = -1.16 + this.guitarFretPos * 0.26 - gM.sustainLean * 0.16 - gKneeDrop * 0.14;
        this.guitarist.leftArmPivot.rotation.x = THREE.MathUtils.damp(this.guitarist.leftArmPivot.rotation.x, targetFretX, 14, dt);
        this.guitarist.leftArmPivot.rotation.z = THREE.MathUtils.damp(this.guitarist.leftArmPivot.rotation.z, targetFretZ, 14, dt);
      }

      // 3. BASSIST — Dynamic roaming strides, groove knee-bends, back-to-back duets, Encore slide & organic sway!
      const bassMissed = this.missedInstrument === 'bass';
      const bassSilentIdle = playing && songTime >= 0 && stemActivity.bass === false && this.bassPluckImpulse < 0.05;
      const bAirborne = bM.jumpY > 0.05;
      const bKneeDrop = bM.kneeDrop;
      const bPowerSpread =
        bM.stanceMode === 'POWER_SLIDE' || bM.stanceMode === 'ENCORE_SLIDE' ? 0.3 :
        bM.stanceMode === 'POWER_STANCE' ? 0.25 :
        bM.stanceMode === 'BACK_TO_BACK' || bM.stanceMode === 'EDGE_MONITOR' ? 0.22 : 0.1;
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
      } else if (bassSilentIdle) {
        const nod = Math.sin(bpmBeatPhase) * 0.16;
        const hypeFist = -2.15 + Math.sin(bpmBeatPhase) * 0.3;
        this.bassGuitar.rotation.set(0.05, -0.08, THREE.MathUtils.damp(this.bassGuitar.rotation.z, -0.06, 6, dt));
        this.bassist.leftLegPivot.rotation.x = THREE.MathUtils.damp(this.bassist.leftLegPivot.rotation.x, bStride + bKneeTuck, 10, dt);
        this.bassist.rightLegPivot.rotation.x = THREE.MathUtils.damp(this.bassist.rightLegPivot.rotation.x, -bStride + bKneeTuck, 10, dt);
        this.bassist.upperBody.position.y = THREE.MathUtils.damp(this.bassist.upperBody.position.y, 0.96 - Math.max(0, bM.squash * 0.22), 9, dt);
        this.bassist.upperBody.rotation.x = THREE.MathUtils.damp(this.bassist.upperBody.rotation.x, 0.04, 6, dt);
        this.bassist.upperBody.rotation.z = THREE.MathUtils.damp(this.bassist.upperBody.rotation.z, organicSwayB * 0.07, 6, dt);
        this.bassist.headGroup.rotation.x = THREE.MathUtils.damp(this.bassist.headGroup.rotation.x, nod, 10, dt);
        this.bassist.rightArmPivot.rotation.x = THREE.MathUtils.damp(this.bassist.rightArmPivot.rotation.x, hypeFist, 8, dt);
        this.bassist.rightArmPivot.rotation.z = THREE.MathUtils.damp(this.bassist.rightArmPivot.rotation.z, -0.32, 8, dt);
        this.bassist.leftArmPivot.rotation.x = THREE.MathUtils.damp(this.bassist.leftArmPivot.rotation.x, -0.62, 7, dt);
        this.bassist.leftArmPivot.rotation.z = THREE.MathUtils.damp(this.bassist.leftArmPivot.rotation.z, 0.18, 7, dt);
      } else {
        const bassNeckTilt = 0.3 + bM.sustainLean * 0.24 + bKneeDrop * 0.18 + (bAirborne ? 0.16 : 0);
        this.bassGuitar.rotation.set(0.05, -0.08, THREE.MathUtils.damp(this.bassGuitar.rotation.z, bassNeckTilt, 9, dt));
        const groovePhase = bpmHalfPhase;
        const deepBounceMult = bM.action === 'DEEP_KNEE_BOUNCE' ? 1.45 : 1.0;
        const kneeBend = Math.abs(Math.sin(groovePhase)) * (0.14 + bassE * 0.28 + this.bassBounceImpulse * 0.2) * deepBounceMult;
        const grooveSway = organicSwayB * (0.09 + bassE * 0.22) * hypeBoost;
        const pluck = Math.sin(t * (7 + bassE * 8)) * (0.12 + bassE * 0.32) + this.bassPluckImpulse * 0.48;
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
          0.08 + kneeBend * 0.38 + bSlideLean - bM.sustainLean * 0.3 - bKneeDrop * 0.16,
          12,
          dt
        );
        this.bassist.upperBody.rotation.z = THREE.MathUtils.damp(this.bassist.upperBody.rotation.z, grooveSway * 0.65, 10, dt);
        this.bassist.headGroup.rotation.x = Math.sin(groovePhase) * (0.1 + bassE * 0.26) - bM.sustainLean * 0.18;

        this.bassist.rightArmPivot.rotation.x = -0.88 + pluck;
        this.bassist.rightArmPivot.rotation.z = -0.32;
        const bassFretZ = 0.14 + this.bassFretPos * 0.4;
        this.bassist.leftArmPivot.rotation.x = THREE.MathUtils.damp(this.bassist.leftArmPivot.rotation.x, -1.08 + this.bassFretPos * 0.22, 12, dt);
        this.bassist.leftArmPivot.rotation.z = THREE.MathUtils.damp(this.bassist.leftArmPivot.rotation.z, bassFretZ, 12, dt);
      }

      // 4. VOCALIST — Section-aligned Pop Diva / Rock Frontperson choreography with organic non-repeating sway!
      if (marks.vocals.visible) {
        const isPopDiva = this.bandLineupId === 'pop-diva';
        const vAirborne = vM.jumpY > 0.05;
        const vStride = Math.sin(vM.walkPhase) * 0.56 * vM.moveSpeed;
        const vKneeTuck = vAirborne ? -0.52 : -Math.max(0, vM.squash) * 0.55;
        const crowdHypeRaise =
          fever ||
          encore ||
          this.encoreFinaleActive ||
          lightState.sectionType === 'CHORUS' ||
          lightState.sectionType === 'OUTRO' ||
          vocalE > 0.55;
        const danceSway = isPopDiva ? organicSwayV * (0.14 + vocalE * 0.18) : organicSwayV * (0.08 + vocalE * 0.14);

        this.vocalist.leftLegPivot.rotation.x = THREE.MathUtils.damp(this.vocalist.leftLegPivot.rotation.x, vAirborne ? vKneeTuck : vStride + vKneeTuck, 13, dt);
        this.vocalist.rightLegPivot.rotation.x = THREE.MathUtils.damp(this.vocalist.rightLegPivot.rotation.x, vAirborne ? vKneeTuck * 0.85 : -vStride + vKneeTuck, 13, dt);
        this.vocalist.upperBody.position.y = THREE.MathUtils.damp(this.vocalist.upperBody.position.y, 0.96 - Math.max(-0.06, vM.squash * 0.22), 14, dt);
        this.vocalist.upperBody.rotation.z = danceSway;
        this.vocalist.upperBody.rotation.x = THREE.MathUtils.damp(
          this.vocalist.upperBody.rotation.x,
          0.06 + vocalE * 0.24,
          10,
          dt
        );
        this.vocalist.headGroup.rotation.x = -0.06 + Math.sin(t * 6.2) * (0.06 + vocalE * 0.18);
        this.vocalist.headGroup.rotation.y = Math.sin(t * 2.4) * 0.16;

        if (isPopDiva || vM.stanceMode !== 'MIC_CENTER') {
          this.vocalist.leftArmPivot.rotation.x = THREE.MathUtils.damp(
            this.vocalist.leftArmPivot.rotation.x,
            crowdHypeRaise ? -2.25 + Math.cos(t * 5.2) * 0.28 : -0.95 - vocalE * 0.75,
            8,
            dt
          );
          this.vocalist.leftArmPivot.rotation.z = THREE.MathUtils.damp(
            this.vocalist.leftArmPivot.rotation.z,
            crowdHypeRaise ? -0.46 : -0.25 - vocalE * 0.2,
            8,
            dt
          );
        } else {
          this.vocalist.leftArmPivot.rotation.x = -0.96;
          this.vocalist.leftArmPivot.rotation.z = -0.2;
        }
        const rightArmTargetX = crowdHypeRaise ? -2.35 + Math.sin(t * 5.2) * 0.32 : -0.85 - vocalE * 0.85;
        const rightArmTargetZ = crowdHypeRaise ? 0.48 : 0.25 + vocalE * 0.24;
        this.vocalist.rightArmPivot.rotation.x = THREE.MathUtils.damp(this.vocalist.rightArmPivot.rotation.x, rightArmTargetX, 8, dt);
        this.vocalist.rightArmPivot.rotation.z = THREE.MathUtils.damp(this.vocalist.rightArmPivot.rotation.z, rightArmTargetZ, 8, dt);
      }

      // 4B. KEYBOARDIST — Expressive two-hand chord strikes, glissando leans, seated Concert Grand vs. standing Keytar shred!
      if (this.keyboardist) {
        const pianoMissed = this.missedInstrument === 'piano';
        const isKeytar = Boolean(this.keyboardAsset?.isKeytar);
        const isSeatedGrand = this.keyboardModelId === 'concert-grand';
        const keyCenterShift = (this.pianoHandPos - 0.5) * 0.42;

        if (isSeatedGrand) {
          this.keyboardist.leftLegPivot.rotation.set(-1.12, 0, 0);
          this.keyboardist.rightLegPivot.rotation.set(-1.12 + Math.sin(bpmBeatPhase) * 0.08, 0, 0);
          this.keyboardist.upperBody.position.y = THREE.MathUtils.damp(this.keyboardist.upperBody.position.y, 0.74, 12, dt);
        } else {
          const stepTap = Math.sin(bpmBeatPhase) * (isKeytar ? 0.16 : 0.08);
          this.keyboardist.leftLegPivot.rotation.set(stepTap, 0, isKeytar ? 0.14 : 0.06);
          this.keyboardist.rightLegPivot.rotation.set(-stepTap, 0, isKeytar ? -0.14 : -0.06);
          this.keyboardist.upperBody.position.y = THREE.MathUtils.damp(this.keyboardist.upperBody.position.y, 0.96, 12, dt);
        }

        if (pianoMissed) {
          this.keyboardist.upperBody.rotation.x = THREE.MathUtils.damp(this.keyboardist.upperBody.rotation.x, 0.44, 10, dt);
          this.keyboardist.headGroup.rotation.x = THREE.MathUtils.damp(this.keyboardist.headGroup.rotation.x, 0.34, 10, dt);
          this.keyboardist.leftArmPivot.rotation.x = THREE.MathUtils.damp(this.keyboardist.leftArmPivot.rotation.x, 0.12, 10, dt);
          this.keyboardist.rightArmPivot.rotation.x = THREE.MathUtils.damp(this.keyboardist.rightArmPivot.rotation.x, 0.12, 10, dt);
        } else {
          const playEnergy = Math.max(pianoE, this.pianoHitImpulse * 0.85);
          const sway = Math.sin(bpmHalfPhase) * (0.09 + playEnergy * 0.16) + keyCenterShift * 0.55;
          const glissLean = this.pianoGlissando * 0.24 * (this.pianoHandPos > 0.5 ? 1 : -1);

          this.keyboardist.upperBody.rotation.x = THREE.MathUtils.damp(
            this.keyboardist.upperBody.rotation.x,
            (isKeytar ? 0.06 : 0.16) + playEnergy * 0.14,
            11,
            dt
          );
          this.keyboardist.upperBody.rotation.z = THREE.MathUtils.damp(
            this.keyboardist.upperBody.rotation.z,
            sway + glissLean,
            10,
            dt
          );
          this.keyboardist.headGroup.rotation.x = Math.sin(bpmBeatPhase) * (0.08 + playEnergy * 0.18);
          this.keyboardist.headGroup.rotation.y = -keyCenterShift * 0.7;

          const fastKeys = Math.sin(t * (11 + playEnergy * 12)) * (0.12 + playEnergy * 0.28);
          const strikeBoost = this.pianoHitImpulse * 0.34;
          if (isKeytar) {
            this.keyboardist.leftArmPivot.rotation.set(-1.12 + this.pianoHandPos * 0.22, 0, 0.2 + this.pianoHandPos * 0.35);
            this.keyboardist.rightArmPivot.rotation.set(-0.98 + fastKeys + strikeBoost * this.pianoHandAlt, 0, -0.32);
          } else {
            this.keyboardist.leftArmPivot.rotation.set(
              -1.15 + fastKeys * 0.8 + (this.pianoHandAlt > 0 ? strikeBoost : 0),
              0,
              0.12 - keyCenterShift * 0.55
            );
            this.keyboardist.rightArmPivot.rotation.set(
              -1.15 - fastKeys * 0.8 + (this.pianoHandAlt < 0 ? strikeBoost : 0),
              0,
              -0.12 - keyCenterShift * 0.55
            );
          }
        }

        if (this.keyboardAsset?.ledMat) {
          this.keyboardAsset.ledMat.emissiveIntensity = 0.85 + pianoE * 1.45 + this.pianoHitImpulse * 0.9;
        }
      }

      // 4C. Musician flinch recoil when struck by an angry crowd projectile
      ['guitar', 'bass', 'drums', 'piano', 'vocals'].forEach((role) => {
        const ft = this.flinchTimers?.[role] || 0;
        const member = this.membersByRole?.[role];
        if (ft > 0 && member) {
          const pulse = Math.sin((ft / 0.48) * Math.PI);
          member.upperBody.rotation.x += pulse * 0.34;
          member.headGroup.rotation.z += pulse * 0.28;
        }
      });
    }

    // 5. Moving Overhead SpotLights + Soft Volumetric Fresnel Cones that dynamically follow roaming musicians!
    const flashPulse = 0.55 + 0.45 * Math.sin(t * 24);
    const activeThemeHex =
      fever || encore
        ? THEME_COLORS.fever
        : (THEME_COLORS[this.activeInstrument] || THEME_COLORS.guitar);

    Object.entries(this.memberSpots).forEach(([role, bundle], idx) => {
      const isMissed = this.missedInstrument === role;
      const isPlayerRole = this.activeInstrument === role;
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
        bundle.spot.color
          .copy(isPlayerRole ? this._colorB.setHex(activeThemeHex) : bundle.baseColor)
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
        dyn.update(dt, t, telemetry?.overallEnergy || 0);
      }
    }

    // 7. Update Animated Live LED Backdrop Screen & VIP Front-Row Banner (throttled under Adaptive Quality Guard)
    this.ledUpdateTimer += dt;
    const ledInterval = this.adaptiveLowPower ? 0.115 : 0.062;
    if (this.ledUpdateTimer >= ledInterval) {
      this.ledUpdateTimer = 0;
      this.drawLedBackdrop(bassE, guitarE, drumE, fever, encore);
      this.drawVipBanner();
    }

    // 8. Animate 152 Detailed Roblox R15 Fans & Lightsticks synced to BPM + Ballad Sway / Chorus Unison
    this.updateFullBodiedCrowd(
      songTime,
      bpm,
      isWalkOn ? 0.45 : bassE,
      isWalkOn ? 0.85 : hypeNorm,
      fever || encore || this.encoreFinaleActive,
      lightState.sectionType,
      telemetry?.overallEnergy || 0
    );

    // 9. Update 3D Pyrotechnics, Aerial Fireworks, Confetti, Lasers & Pooled Angry Crowd Projectiles
    this.updatePyrotechnics(dt, stageState, telemetry);
    this.updateCrowdProjectiles(dt);

    // 10. Update Neversoft-Style Rule-Based Concert Camera Director
    this.updateCamera(dt, stageState, telemetry);

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true;
    this.venueEnv?.dispose?.();
    Object.values(this.membersByRole || {}).forEach((m) => m.disposeTextures?.());
    this.guitarAsset?.dispose?.();
    this.bassAsset?.dispose?.();
    this.drumKitAsset?.dispose?.();
    this.keyboardAsset?.dispose?.();
    this.splatPoints?.geometry?.dispose?.();
    this.splatPoints?.material?.dispose?.();
    this.crowdFaceTex?.dispose();
    this.ledTexture?.dispose();
    this.vipBannerTex?.dispose();
    this.deckTex?.dispose();
    this.ampGrillTex?.dispose();
    this.glowTex?.dispose();
    this.envRenderTarget?.dispose();
    this.renderer?.dispose();
  }
}

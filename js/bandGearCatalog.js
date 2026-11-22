/**
 * bandGearCatalog.js
 * Guitar Hero: World Tour Definitive Edition-inspired ID registries for:
 *  - Band Lineup Presets (ID_Bands)
 *  - Highway / Fretboard Skins (ID_Highways)
 *  - 3D Guitars, Basses & Drum Kits (ID_Instrument_Guitars / Basses / Drums)
 *  - Procedural composite 3D Three.js mesh builders with bevelled ExtrudeGeometry
 *    and clean resource disposal so players can swap gear live on stage.
 */

import * as THREE from 'three';

/* ==========================================================================
   1. BAND LINEUP PRESETS (ID_Bands Registry)
   ========================================================================== */

export const BAND_LINEUPS = [
  {
    id: 'arena-4piece',
    registryId: 'Band_Arena_4Piece',
    name: '4-Piece Arena Band',
    shortName: '4-Piece Arena',
    description: 'Lead Guitarist, Bassist, Drummer, and Frontperson Vocalist at the center mic stand.',
    svgIcon: '<svg viewBox="0 0 64 36" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="11" r="4" fill="currentColor"/><rect x="8" y="17" width="8" height="12" rx="2" fill="currentColor"/><circle cx="26" cy="9" r="4.2" fill="currentColor"/><rect x="22" y="15" width="8" height="14" rx="2" fill="currentColor"/><circle cx="38" cy="13" r="3.6" fill="currentColor" opacity="0.75"/><rect x="33" y="19" width="10" height="10" rx="2" fill="currentColor" opacity="0.75"/><circle cx="52" cy="11" r="4" fill="currentColor"/><rect x="48" y="17" width="8" height="12" rx="2" fill="currentColor"/></svg>',
    hasVocalist: true,
    vocalistHeadset: false,
    guitaristSings: false,
    showMicStand: true,
    forceDoubleKick: false,
    positions: {
      guitar: { x: -3.55, y: 0, z: -1.1, rotY: 0.24 },
      bass: { x: 3.55, y: 0, z: -1.1, rotY: -0.24 },
      drums: { x: 0, y: 0.64, z: -3.56, rotY: 0 },
      vocals: { x: 0, y: 0, z: -0.78, rotY: 0 },
      micStand: { x: 0, y: 0, z: -0.18 },
    },
  },
  {
    id: 'pop-diva',
    registryId: 'Band_Pop_Diva',
    name: 'Pop Diva & Backing Band',
    shortName: 'Pop Diva',
    description: 'Center Pop Star Vocalist with wireless headset mic & choreography, backed by full band.',
    svgIcon: '<svg viewBox="0 0 64 36" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="13" cy="13" r="3.5" fill="currentColor" opacity="0.6"/><rect x="10" y="18" width="6" height="11" rx="2" fill="currentColor" opacity="0.6"/><path d="M32 4l2 4 4.5.6-3.2 3.1.8 4.4-4.1-2.1-4.1 2.1.8-4.4-3.2-3.1L30 8l2-4z" fill="#facc15"/><rect x="27" y="17" width="10" height="13" rx="3" fill="currentColor"/><circle cx="51" cy="13" r="3.5" fill="currentColor" opacity="0.6"/><rect x="48" y="18" width="6" height="11" rx="2" fill="currentColor" opacity="0.6"/></svg>',
    hasVocalist: true,
    vocalistHeadset: true,
    guitaristSings: false,
    showMicStand: false,
    forceDoubleKick: false,
    positions: {
      guitar: { x: -3.9, y: 0, z: -1.45, rotY: 0.3 },
      bass: { x: 3.9, y: 0, z: -1.45, rotY: -0.3 },
      drums: { x: 0, y: 0.64, z: -3.65, rotY: 0 },
      vocals: { x: 0, y: 0, z: -0.35, rotY: 0 },
      micStand: { x: 0, y: 0, z: -0.18 },
    },
  },
  {
    id: 'singing-guitarist',
    registryId: 'Band_Singing_Guitarist',
    name: 'Singing Guitarist Power Trio',
    shortName: 'Singing Guitarist',
    description: 'Lead Guitarist steps up to center mic stand to sing & shred, flanked by Bassist & Drummer.',
    svgIcon: '<svg viewBox="0 0 64 36" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="15" cy="14" r="3.5" fill="currentColor" opacity="0.65"/><rect x="11" y="19" width="8" height="10" rx="2" fill="currentColor" opacity="0.65"/><circle cx="32" cy="9" r="4.5" fill="currentColor"/><rect x="27" y="15" width="10" height="14" rx="2" fill="currentColor"/><path d="M21 25l22-7" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round"/><line x1="39" y1="8" x2="39" y2="29" stroke="currentColor" stroke-width="1.8"/><circle cx="51" cy="13" r="3.8" fill="currentColor" opacity="0.8"/><rect x="47" y="18" width="8" height="11" rx="2" fill="currentColor" opacity="0.8"/></svg>',
    hasVocalist: false,
    vocalistHeadset: false,
    guitaristSings: true,
    showMicStand: true,
    forceDoubleKick: false,
    positions: {
      guitar: { x: 0, y: 0, z: -0.82, rotY: 0.04 },
      bass: { x: 3.45, y: 0, z: -1.35, rotY: -0.26 },
      drums: { x: -1.15, y: 0.64, z: -3.56, rotY: 0.1 },
      vocals: { x: 0, y: 0, z: -0.78, rotY: 0 },
      micStand: { x: 0, y: 0, z: -0.18 },
    },
  },
  {
    id: 'rock-power-trio',
    registryId: 'Band_Rock_Power_Trio',
    name: 'Rock Power Trio',
    shortName: 'Rock Power Trio',
    description: 'Instrumental powerhouse: Lead Guitarist, Bassist, and thunderous Double-Bass Drummer.',
    svgIcon: '<svg viewBox="0 0 64 36" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="15" cy="11" r="4.2" fill="currentColor"/><rect x="11" y="17" width="8" height="12" rx="2" fill="currentColor"/><circle cx="32" cy="13" r="4" fill="#ef4444"/><rect x="25" y="19" width="14" height="10" rx="2" fill="#ef4444"/><circle cx="49" cy="11" r="4.2" fill="currentColor"/><rect x="45" y="17" width="8" height="12" rx="2" fill="currentColor"/></svg>',
    hasVocalist: false,
    vocalistHeadset: false,
    guitaristSings: false,
    showMicStand: false,
    forceDoubleKick: true,
    positions: {
      guitar: { x: -2.95, y: 0, z: -1.05, rotY: 0.2 },
      bass: { x: 2.95, y: 0, z: -1.05, rotY: -0.2 },
      drums: { x: 0, y: 0.64, z: -3.45, rotY: 0 },
      vocals: { x: 0, y: 0, z: -0.78, rotY: 0 },
      micStand: { x: 0, y: 0, z: -0.18 },
    },
  },
];

/* ==========================================================================
   2. HIGHWAY / FRETBOARD SKINS (ID_Highways Registry)
   ========================================================================== */

export const HIGHWAY_SKINS = [
  {
    id: 'smoked-glass',
    registryId: 'Highway_Smoked_Glass',
    name: 'Smoked Concert Glass',
    shortName: 'Smoked Glass',
    swatch: ['#0f172a', '#06b6d4'],
    stripeColor: '#38bdf8',
    description: 'Translucent obsidian concert glass with clean neon lane trims.',
  },
  {
    id: 'inferno-flames',
    registryId: 'Highway_Inferno_Flames',
    name: 'Inferno Flames',
    shortName: 'Inferno Flames',
    swatch: ['#7f1d1d', '#f97316'],
    stripeColor: '#facc15',
    description: 'Animated ember borders, glowing lava rails, and fiery hit-line sparks.',
  },
  {
    id: 'cyber-synth',
    registryId: 'Highway_Cyber_Synth',
    name: 'Cyber Synth Grid',
    shortName: 'Cyber Synth',
    swatch: ['#2e1065', '#ec4899'],
    stripeColor: '#22d3ee',
    description: 'Retro-futuristic magenta and cyan laser perspective grid lines.',
  },
  {
    id: 'royal-gold',
    registryId: 'Highway_Royal_Gold',
    name: 'Royal Gold Encore',
    shortName: 'Royal Gold',
    swatch: ['#451a03', '#facc15'],
    stripeColor: '#fef08a',
    description: 'Metallic gold filigree borders, warm ivory dividers, and encore diamond inlays.',
  },
  {
    id: 'rosewood-classic',
    registryId: 'Highway_Rosewood_Classic',
    name: 'Rosewood Classic',
    shortName: 'Rosewood Classic',
    swatch: ['#3b1d12', '#d6b07c'],
    stripeColor: '#f5deb3',
    description: 'Warm dark rosewood grain texture with pearl trapezoid fret markers.',
  },
];

/* ==========================================================================
   3. 3D INSTRUMENT GEAR MODELS (ID_Instrument_Guitars / Basses / Drums)
   ========================================================================== */

export const GUITAR_MODELS = [
  {
    id: 'les-paul-sunburst',
    registryId: 'Guitar_Sunburst_LesPaul',
    name: 'Classic Sunburst Les Paul',
    shortName: 'Sunburst Les Paul',
    swatch: ['#7c2d12', '#f59e0b'],
    svgIcon: '<svg viewBox="0 0 88 38" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M56 12c-5-6-13-5-16 0-3-2-8-1-10 3-2 4-1 11 4 14 4 2 8 2 11 0 4 4 13 4 17-1 4-5 3-13-6-16z" fill="#ea580c" stroke="#fde047" stroke-width="1.8"/><rect x="11" y="16.5" width="24" height="4.5" rx="1" fill="#5c3a21"/><path d="M4 15h8v7H4l-2-3.5L4 15z" fill="#1c0a05" stroke="#f59e0b" stroke-width="1"/><rect x="44" y="15" width="4" height="8" rx="1" fill="#e2e8f0"/><rect x="52" y="15" width="4" height="8" rx="1" fill="#e2e8f0"/></svg>',
  },
  {
    id: 'flying-v',
    registryId: 'Guitar_Flying_V',
    name: 'Flying V',
    shortName: 'Flying V',
    swatch: ['#991b1b', '#f8fafc'],
    svgIcon: '<svg viewBox="0 0 88 38" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M34 19L76 5l4 5-24 9 24 9-4 5-42-14z" fill="#dc2626" stroke="#f8fafc" stroke-width="1.6"/><path d="M40 19l21-7v14l-21-7z" fill="#f8fafc" opacity="0.9"/><rect x="11" y="16.5" width="25" height="4.5" rx="1" fill="#5c3a21"/><path d="M3 15l9 1.5v5L3 23l1.5-4L3 15z" fill="#dc2626" stroke="#f8fafc" stroke-width="1"/></svg>',
  },
  {
    id: 'star-pop',
    registryId: 'Guitar_Star_Pop',
    name: 'Star-Shaped Pop Guitar',
    shortName: 'Star Pop Guitar',
    swatch: ['#db2777', '#22d3ee'],
    svgIcon: '<svg viewBox="0 0 88 38" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M56 3l5 10 12 2-9 8 2 12-10-6-10 6 2-12-9-8 12-2 5-10z" fill="#ec4899" stroke="#22d3ee" stroke-width="1.8"/><circle cx="56" cy="20" r="4.5" fill="#22d3ee"/><rect x="12" y="17" width="28" height="4.2" rx="1" fill="#1e293b"/><path d="M4 15h8v8H4l2-4-2-4z" fill="#ec4899" stroke="#22d3ee" stroke-width="1"/></svg>',
  },
  {
    id: 'xplorer',
    registryId: 'Guitar_Xplorer',
    name: 'Xplorer',
    shortName: 'Xplorer',
    swatch: ['#e2e8f0', '#0ea5e9'],
    svgIcon: '<svg viewBox="0 0 88 38" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M34 14l16-6 26-3-6 13 10 11-26 4-20-9V14z" fill="#f1f5f9" stroke="#0ea5e9" stroke-width="1.8"/><path d="M41 21l27-7" stroke="#0ea5e9" stroke-width="3.2" stroke-linecap="round"/><rect x="11" y="16.5" width="24" height="4.5" rx="1" fill="#475569"/><path d="M2 14l10 2v6L2 20l2-6z" fill="#f1f5f9" stroke="#0ea5e9" stroke-width="1"/></svg>',
  },
];

export const BASS_MODELS = [
  {
    id: 'precision-blonde',
    registryId: 'Bass_Precision_Blonde',
    name: 'Precision Blonde Bass',
    shortName: 'Precision Blonde',
    swatch: ['#eab308', '#78350f'],
    svgIcon: '<svg viewBox="0 0 92 38" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M46 11c4-5 11-5 14-1 5-3 14-1 17 5 3 7-1 14-8 16-6 2-12 0-16-4-4 3-11 2-13-3-2-5 1-10 6-13z" fill="#eab308" stroke="#fef08a" stroke-width="1.5"/><path d="M51 15c5-2 11 0 13 4s-1 8-6 9-10-2-10-6 0-5 3-7z" fill="#78350f"/><rect x="10" y="16.8" width="34" height="4.2" rx="1" fill="#e7c58a"/><path d="M3 15h8v7.5H3c-1.5-2-1.5-5.5 0-7.5z" fill="#e7c58a" stroke="#78350f" stroke-width="1"/></svg>',
  },
  {
    id: 'axe-bass',
    registryId: 'Bass_Battle_Axe',
    name: 'Axe Bass',
    shortName: 'Axe Bass',
    swatch: ['#cbd5e1', '#b91c1c'],
    svgIcon: '<svg viewBox="0 0 92 38" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M44 18c8-13 24-16 36-9-6 6-6 14 0 20-12 7-28 4-36-9v-2z" fill="#dbeafe" stroke="#94a3b8" stroke-width="1.6"/><rect x="52" y="14" width="18" height="10" rx="2" fill="#b91c1c"/><rect x="10" y="16.8" width="35" height="4.2" rx="1" fill="#334155"/><path d="M3 14l8 2.5v5L3 24l2-5-2-5z" fill="#b91c1c" stroke="#dbeafe" stroke-width="1"/></svg>',
  },
  {
    id: 'neon-5string',
    registryId: 'Bass_Modern_5String_Neon',
    name: 'Modern 5-String Neon Bass',
    shortName: '5-String Neon',
    swatch: ['#1e1b4b', '#a855f7'],
    svgIcon: '<svg viewBox="0 0 92 38" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M45 11c5-5 12-4 16 0 6-3 15 0 18 6 2 7-2 14-10 15-6 1-12-1-16-5-4 2-10 1-12-4-2-5 0-9 4-12z" fill="#181826" stroke="#a855f7" stroke-width="2"/><rect x="55" y="14.5" width="4" height="9" rx="1" fill="#a855f7"/><rect x="63" y="14.5" width="4" height="9" rx="1" fill="#a855f7"/><rect x="10" y="16.5" width="34" height="5" rx="1" fill="#1e1b4b" stroke="#a855f7" stroke-width="1"/><path d="M3 14.5h8v9H3l1.5-4.5L3 14.5z" fill="#181826" stroke="#a855f7" stroke-width="1.2"/></svg>',
  },
];

export const DRUM_KIT_MODELS = [
  {
    id: 'pop-single-kick',
    registryId: 'Drums_Pop_SingleKick',
    name: 'Pop Arena Single-Kick',
    shortName: 'Pop Single-Kick',
    swatch: ['#d97706', '#f8fafc'],
    svgIcon: '<svg viewBox="0 0 84 38" fill="none" xmlns="http://www.w3.org/2000/svg"><ellipse cx="18" cy="10" rx="11" ry="2.6" fill="#fbbf24"/><line x1="18" y1="12" x2="18" y2="33" stroke="#cbd5e1" stroke-width="2"/><ellipse cx="66" cy="10" rx="11" ry="2.6" fill="#fbbf24"/><line x1="66" y1="12" x2="66" y2="33" stroke="#cbd5e1" stroke-width="2"/><circle cx="42" cy="24" r="11" fill="#0f172a" stroke="#f59e0b" stroke-width="3"/><rect x="29" y="11" width="10" height="7" rx="2" fill="#d97706" stroke="#f8fafc" stroke-width="1"/><rect x="45" y="11" width="10" height="7" rx="2" fill="#d97706" stroke="#f8fafc" stroke-width="1"/></svg>',
  },
  {
    id: 'metal-double-bass',
    registryId: 'Drums_Metal_DoubleBass',
    name: 'Metal Double-Bass Monster Kit',
    shortName: 'Double-Bass Monster',
    swatch: ['#18181b', '#dc2626'],
    svgIcon: '<svg viewBox="0 0 84 38" fill="none" xmlns="http://www.w3.org/2000/svg"><ellipse cx="14" cy="9" rx="10" ry="2.4" fill="#fbbf24"/><ellipse cx="70" cy="9" rx="10" ry="2.4" fill="#fbbf24"/><ellipse cx="42" cy="6" rx="9" ry="2.2" fill="#f59e0b"/><circle cx="30" cy="25" r="9.5" fill="#09090b" stroke="#dc2626" stroke-width="2.8"/><circle cx="54" cy="25" r="9.5" fill="#09090b" stroke="#dc2626" stroke-width="2.8"/><rect x="22" y="12" width="10" height="6" rx="1.5" fill="#18181b" stroke="#dc2626" stroke-width="1.2"/><rect x="37" y="11" width="10" height="6" rx="1.5" fill="#18181b" stroke="#dc2626" stroke-width="1.2"/><rect x="52" y="12" width="10" height="6" rx="1.5" fill="#18181b" stroke="#dc2626" stroke-width="1.2"/></svg>',
  },
  {
    id: 'acrylic-led',
    registryId: 'Drums_Acrylic_LED',
    name: 'Acrylic LED Stage Kit',
    shortName: 'Acrylic LED Kit',
    swatch: ['#06b6d4', '#a855f7'],
    svgIcon: '<svg viewBox="0 0 84 38" fill="none" xmlns="http://www.w3.org/2000/svg"><ellipse cx="17" cy="10" rx="11" ry="2.6" fill="#67e8f9"/><line x1="17" y1="12" x2="17" y2="33" stroke="#94a3b8" stroke-width="2"/><ellipse cx="67" cy="10" rx="11" ry="2.6" fill="#c084fc"/><line x1="67" y1="12" x2="67" y2="33" stroke="#94a3b8" stroke-width="2"/><circle cx="42" cy="24" r="11" fill="rgba(6,182,212,0.22)" stroke="#22d3ee" stroke-width="3"/><circle cx="42" cy="24" r="6.5" stroke="#a855f7" stroke-width="1.8"/><rect x="29" y="11" width="10" height="7" rx="2" fill="rgba(168,85,247,0.35)" stroke="#22d3ee" stroke-width="1.3"/><rect x="45" y="11" width="10" height="7" rx="2" fill="rgba(168,85,247,0.35)" stroke="#22d3ee" stroke-width="1.3"/></svg>',
  },
];

export function getBandLineupById(id) {
  return BAND_LINEUPS.find((b) => b.id === id) || BAND_LINEUPS[0];
}

export function getHighwaySkinById(id) {
  return HIGHWAY_SKINS.find((h) => h.id === id) || HIGHWAY_SKINS[0];
}

export function getGuitarModelById(id) {
  return GUITAR_MODELS.find((g) => g.id === id) || GUITAR_MODELS[0];
}

export function getBassModelById(id) {
  return BASS_MODELS.find((b) => b.id === id) || BASS_MODELS[0];
}

export function getDrumKitModelById(id) {
  return DRUM_KIT_MODELS.find((d) => d.id === id) || DRUM_KIT_MODELS[0];
}

/* ==========================================================================
   4. PROCEDURAL TEXTURES & COMPOSITE 3D INSTRUMENT MESH BUILDERS
   ========================================================================== */

function createSunburstTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(128, 128, 16, 128, 128, 134);
  grad.addColorStop(0, '#fde047');
  grad.addColorStop(0.42, '#ea580c');
  grad.addColorStop(0.75, '#7c2d12');
  grad.addColorStop(1, '#1c0a05');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  // Subtle flame-maple grain lines
  ctx.strokeStyle = 'rgba(255, 224, 150, 0.12)';
  ctx.lineWidth = 2;
  for (let y = 0; y < 256; y += 7) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(80, y + 4, 170, y - 4, 256, y);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createDrumheadCanvasTexture(accentHex = '#f59e0b', subLabel = 'LIVE') {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#0f1320';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(128, 128, 112, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(128, 128, 96, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 42px Oswald, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ENCORE', 128, 118);

  ctx.fillStyle = accentHex;
  ctx.font = 'bold 20px Oswald, sans-serif';
  ctx.fillText(subLabel, 128, 162);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function disposeGroupResources(group, extraTextures = []) {
  const geometries = new Set();
  const materials = new Set();
  group.traverse((obj) => {
    if (obj.geometry) geometries.add(obj.geometry);
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach((m) => materials.add(m));
      else materials.add(obj.material);
    }
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
  extraTextures.forEach((t) => t?.dispose?.());
}

function makeExtrudedBody(shape, depth = 0.11, bevel = 0.022) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 10,
  });
  geo.center();
  return geo;
}

/**
 * Builds one of 4 distinct composite 3D Electric Guitar meshes.
 */
export function buildCustomGuitarMesh(modelId = 'les-paul-sunburst') {
  const group = new THREE.Group();
  const textures = [];

  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.18, metalness: 0.92 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.34, metalness: 0.85 });
  const neckMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.56, metalness: 0.06 });
  const fretboardMat = new THREE.MeshStandardMaterial({ color: 0x1f1410, roughness: 0.68, metalness: 0.04 });
  const inlayMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25, metalness: 0.2 });

  let bodyMesh = null;
  let headstockMat = null;
  let neckOffsetX = -0.3;

  if (modelId === 'flying-v') {
    const shape = new THREE.Shape();
    shape.moveTo(-0.42, 0);
    shape.lineTo(0.46, 0.42);
    shape.lineTo(0.52, 0.26);
    shape.lineTo(0.08, 0.04);
    shape.lineTo(0.08, -0.04);
    shape.lineTo(0.52, -0.26);
    shape.lineTo(0.46, -0.42);
    shape.closePath();

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xb91c1c,
      roughness: 0.22,
      metalness: 0.42,
      emissive: 0x450a0a,
      emissiveIntensity: 0.35,
    });
    headstockMat = bodyMat;
    bodyMesh = new THREE.Mesh(makeExtrudedBody(shape, 0.1, 0.018), bodyMat);
    group.add(bodyMesh);

    const guardMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.32, metalness: 0.1 });
    const guardShape = new THREE.Shape();
    guardShape.moveTo(-0.34, 0);
    guardShape.lineTo(0.18, 0.22);
    guardShape.lineTo(0.18, -0.22);
    guardShape.closePath();
    const guard = new THREE.Mesh(makeExtrudedBody(guardShape, 0.02, 0.005), guardMat);
    guard.position.set(0.02, 0, 0.072);
    group.add(guard);
    neckOffsetX = -0.38;
  } else if (modelId === 'star-pop') {
    const shape = new THREE.Shape();
    const spikes = 5;
    const outerR = 0.48;
    const innerR = 0.22;
    for (let i = 0; i < spikes * 2; i += 1) {
      const r = i % 2 === 0 ? outerR : innerR;
      const a = (i * Math.PI) / spikes;
      const sx = Math.cos(a) * r;
      const sy = Math.sin(a) * r;
      if (i === 0) shape.moveTo(sx, sy);
      else shape.lineTo(sx, sy);
    }
    shape.closePath();

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xec4899,
      roughness: 0.18,
      metalness: 0.55,
      emissive: 0xdb2777,
      emissiveIntensity: 0.42,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x22d3ee,
      emissiveIntensity: 1.25,
      roughness: 0.2,
    });
    headstockMat = bodyMat;
    bodyMesh = new THREE.Mesh(makeExtrudedBody(shape, 0.1, 0.022), bodyMat);
    group.add(bodyMesh);

    const centerGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), trimMat);
    centerGem.position.set(0.14, 0, 0.08);
    group.add(centerGem);

    const trimRing = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.02, 8, 20), trimMat);
    trimRing.position.set(0, 0, 0.075);
    group.add(trimRing);
    neckOffsetX = -0.34;
  } else if (modelId === 'xplorer') {
    const shape = new THREE.Shape();
    shape.moveTo(-0.36, 0.14);
    shape.lineTo(0.06, 0.28);
    shape.lineTo(0.5, 0.42);
    shape.lineTo(0.42, 0.06);
    shape.lineTo(0.56, -0.22);
    shape.lineTo(0.04, -0.38);
    shape.lineTo(-0.38, -0.16);
    shape.closePath();

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.24,
      metalness: 0.28,
      emissive: 0x0c4a6e,
      emissiveIntensity: 0.16,
    });
    const stripeMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.75,
      roughness: 0.22,
    });
    headstockMat = bodyMat;
    bodyMesh = new THREE.Mesh(makeExtrudedBody(shape, 0.1, 0.018), bodyMat);
    group.add(bodyMesh);

    const boltStripe = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.07, 0.145), stripeMat);
    boltStripe.rotation.z = 0.26;
    boltStripe.position.set(0.08, 0.04, 0.005);
    group.add(boltStripe);
    neckOffsetX = -0.36;
  } else {
    // Classic Sunburst Les Paul (single-cut rounded body with cream binding & sunburst top)
    const shape = new THREE.Shape();
    shape.moveTo(-0.36, 0.08);
    shape.quadraticCurveTo(-0.22, 0.28, 0.02, 0.24);
    shape.quadraticCurveTo(0.32, 0.36, 0.44, 0.12);
    shape.quadraticCurveTo(0.48, -0.16, 0.26, -0.32);
    shape.quadraticCurveTo(-0.02, -0.36, -0.22, -0.22);
    shape.quadraticCurveTo(-0.32, -0.3, -0.4, -0.12);
    shape.closePath();

    const burstTex = createSunburstTexture();
    textures.push(burstTex);
    const bodyMat = new THREE.MeshStandardMaterial({
      map: burstTex,
      roughness: 0.22,
      metalness: 0.24,
    });
    headstockMat = new THREE.MeshStandardMaterial({ color: 0x1c0a05, roughness: 0.32, metalness: 0.2 });
    bodyMesh = new THREE.Mesh(makeExtrudedBody(shape, 0.11, 0.024), bodyMat);
    group.add(bodyMesh);

    const guardMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.38, metalness: 0.08 });
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.02), guardMat);
    guard.position.set(0.02, -0.16, 0.078);
    guard.rotation.z = 0.16;
    group.add(guard);
    neckOffsetX = -0.32;
  }

  // Dual Humbucker pickups + Tune-O-Matic bridge
  const pickup1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.21, 0.04), modelId === 'les-paul-sunburst' ? chromeMat : darkMetal);
  pickup1.position.set(0.08, 0, 0.075);
  const pickup2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.21, 0.04), modelId === 'les-paul-sunburst' ? chromeMat : darkMetal);
  pickup2.position.set(-0.09, 0, 0.075);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.04), chromeMat);
  bridge.position.set(0.22, 0, 0.075);
  group.add(pickup1, pickup2, bridge);

  // Neck, fretboard, pearl inlays & sculpted headstock
  const neckLen = 0.98;
  const neck = new THREE.Mesh(new THREE.BoxGeometry(neckLen, 0.125, 0.068), neckMat);
  neck.position.set(neckOffsetX - neckLen * 0.5, 0.01, -0.01);
  const board = new THREE.Mesh(new THREE.BoxGeometry(neckLen, 0.118, 0.022), fretboardMat);
  board.position.set(neckOffsetX - neckLen * 0.5, 0.01, 0.032);
  group.add(neck, board);

  for (let f = 0; f < 4; f += 1) {
    const inlay = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.055, 0.008), inlayMat);
    inlay.position.set(neckOffsetX - 0.18 - f * 0.2, 0.01, 0.045);
    group.add(inlay);
  }

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(modelId === 'xplorer' ? 0.36 : 0.28, modelId === 'flying-v' ? 0.24 : 0.18, 0.072),
    headstockMat
  );
  head.position.set(neckOffsetX - neckLen - 0.12, modelId === 'xplorer' ? 0.04 : 0.02, -0.01);
  if (modelId === 'xplorer') head.rotation.z = -0.18;
  group.add(head);

  // Chrome tuning pegs
  for (let p = 0; p < 3; p += 1) {
    const pegTop = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.06, 6), chromeMat);
    pegTop.position.set(neckOffsetX - neckLen - 0.04 - p * 0.075, 0.13, -0.01);
    group.add(pegTop);
  }

  return {
    group,
    dispose() {
      disposeGroupResources(group, textures);
    },
  };
}

/**
 * Builds one of 3 distinct composite 3D Bass Guitar meshes.
 */
export function buildCustomBassMesh(modelId = 'precision-blonde') {
  const group = new THREE.Group();
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.18, metalness: 0.92 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.32, metalness: 0.85 });
  const mapleMat = new THREE.MeshStandardMaterial({ color: 0xe7c58a, roughness: 0.45, metalness: 0.06 });
  const rosewoodMat = new THREE.MeshStandardMaterial({ color: 0x261712, roughness: 0.62, metalness: 0.05 });

  let headstockMat = mapleMat;
  let neckOffsetX = -0.34;

  if (modelId === 'axe-bass') {
    // Double-blade chrome Battle Axe Bass!
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(-0.36, 0.09);
    bladeShape.quadraticCurveTo(0.05, 0.56, 0.56, 0.36);
    bladeShape.quadraticCurveTo(0.42, 0, 0.56, -0.36);
    bladeShape.quadraticCurveTo(0.05, -0.56, -0.36, -0.09);
    bladeShape.closePath();

    const silverMat = new THREE.MeshStandardMaterial({
      color: 0xdbeafe,
      roughness: 0.16,
      metalness: 0.92,
    });
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      roughness: 0.28,
      metalness: 0.45,
      emissive: 0x450a0a,
      emissiveIntensity: 0.4,
    });
    headstockMat = coreMat;

    const blade = new THREE.Mesh(makeExtrudedBody(bladeShape, 0.075, 0.025), silverMat);
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.26, 0.13), coreMat);
    core.position.set(0.04, 0, 0);
    group.add(blade, core);
    neckOffsetX = -0.36;
  } else if (modelId === 'neon-5string') {
    const shape = new THREE.Shape();
    shape.moveTo(-0.38, 0.08);
    shape.quadraticCurveTo(-0.26, 0.36, 0.02, 0.26);
    shape.quadraticCurveTo(0.36, 0.36, 0.48, 0.1);
    shape.quadraticCurveTo(0.5, -0.18, 0.26, -0.34);
    shape.quadraticCurveTo(-0.04, -0.32, -0.26, -0.22);
    shape.closePath();

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x181826,
      roughness: 0.22,
      metalness: 0.52,
    });
    const neonMat = new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      emissive: 0xa855f7,
      emissiveIntensity: 1.4,
      roughness: 0.2,
    });
    headstockMat = bodyMat;

    const body = new THREE.Mesh(makeExtrudedBody(shape, 0.11, 0.02), bodyMat);
    const ledStripTop = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.04, 0.145), neonMat);
    ledStripTop.position.set(0.04, 0.17, 0);
    const ledStripBot = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.04, 0.145), neonMat);
    ledStripBot.position.set(0.06, -0.17, 0);
    group.add(body, ledStripTop, ledStripBot);
    neckOffsetX = -0.34;
  } else {
    // Classic Precision Blonde Bass
    const shape = new THREE.Shape();
    shape.moveTo(-0.38, 0.06);
    shape.quadraticCurveTo(-0.34, 0.34, -0.06, 0.24);
    shape.quadraticCurveTo(0.28, 0.38, 0.46, 0.14);
    shape.quadraticCurveTo(0.52, -0.18, 0.22, -0.34);
    shape.quadraticCurveTo(-0.1, -0.36, -0.32, -0.18);
    shape.closePath();

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xeab308,
      roughness: 0.24,
      metalness: 0.18,
    });
    const guardMat = new THREE.MeshStandardMaterial({
      color: 0x6b1d14,
      roughness: 0.36,
      metalness: 0.12,
    });
    headstockMat = mapleMat;

    const body = new THREE.Mesh(makeExtrudedBody(shape, 0.11, 0.022), bodyMat);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.025), guardMat);
    guard.position.set(-0.04, -0.04, 0.072);
    group.add(body, guard);
    neckOffsetX = -0.34;
  }

  // Heavy Bass Pickups & Bridge
  const pu1 = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.22, 0.045), darkMetal);
  pu1.position.set(0.05, 0, 0.08);
  const pu2 = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.22, 0.045), darkMetal);
  pu2.position.set(-0.12, 0, 0.08);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.24, 0.045), chromeMat);
  bridge.position.set(0.25, 0, 0.08);
  group.add(pu1, pu2, bridge);

  // Longer Bass Scale Neck (1.28 units)
  const neckLen = 1.28;
  const neck = new THREE.Mesh(new THREE.BoxGeometry(neckLen, 0.135, 0.072), mapleMat);
  neck.position.set(neckOffsetX - neckLen * 0.5, 0.01, -0.01);
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(neckLen, 0.128, 0.022),
    modelId === 'precision-blonde' ? mapleMat : rosewoodMat
  );
  board.position.set(neckOffsetX - neckLen * 0.5, 0.01, 0.032);
  group.add(neck, board);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.21, 0.075), headstockMat);
  head.position.set(neckOffsetX - neckLen - 0.14, 0.04, -0.01);
  group.add(head);

  const pegCount = modelId === 'neon-5string' ? 5 : 4;
  for (let p = 0; p < pegCount; p += 1) {
    const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.08, 6), chromeMat);
    peg.position.set(neckOffsetX - neckLen - 0.02 - p * 0.065, 0.16, -0.01);
    group.add(peg);
  }

  return {
    group,
    dispose() {
      disposeGroupResources(group);
    },
  };
}

/**
 * Builds one of 3 distinct composite 3D Drum Kits:
 *  - pop-single-kick
 *  - metal-double-bass (twin kick drums, rack frame, extra floor tom & china cymbal!)
 *  - acrylic-led (translucent glowing cyan/violet acrylic shells with LED inner rings!)
 */
export function buildCustomDrumKitMesh(modelId = 'pop-single-kick', { forceDoubleKick = false } = {}) {
  const effectiveModel = forceDoubleKick && modelId === 'pop-single-kick' ? 'metal-double-bass' : modelId;
  const group = new THREE.Group();
  const textures = [];

  const isDouble = effectiveModel === 'metal-double-bass';
  const isAcrylic = effectiveModel === 'acrylic-led';

  const shellMat = isAcrylic
    ? new THREE.MeshStandardMaterial({
        color: 0x22d3ee,
        emissive: 0x06b6d4,
        emissiveIntensity: 0.65,
        roughness: 0.12,
        metalness: 0.2,
        transparent: true,
        opacity: 0.68,
      })
    : isDouble
      ? new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.22, metalness: 0.62 })
      : new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.26, metalness: 0.42 });

  const ledRingMat = new THREE.MeshStandardMaterial({
    color: isAcrylic ? 0xa855f7 : isDouble ? 0xef4444 : 0xf59e0b,
    emissive: isAcrylic ? 0xa855f7 : isDouble ? 0xef4444 : 0xf59e0b,
    emissiveIntensity: isAcrylic ? 1.85 : 0.85,
    roughness: 0.2,
  });

  const rimMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2, metalness: 0.9 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.62, metalness: 0.05 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.22, metalness: 0.88 });

  const drumheadTex = createDrumheadCanvasTexture(
    isAcrylic ? '#22d3ee' : isDouble ? '#ef4444' : '#f59e0b',
    isDouble ? 'METAL' : isAcrylic ? 'LED' : 'LIVE'
  );
  textures.push(drumheadTex);
  const frontKickMat = new THREE.MeshStandardMaterial({ map: drumheadTex, roughness: 0.5, metalness: 0.1 });

  // Kick drum(s)
  const kicks = [];
  const kickXs = isDouble ? [-0.56, 0.56] : [0];
  kickXs.forEach((kx) => {
    const kickGeo = new THREE.CylinderGeometry(isDouble ? 0.6 : 0.68, isDouble ? 0.6 : 0.68, 0.62, 20);
    const kick = new THREE.Mesh(kickGeo, [shellMat, frontKickMat, headMat]);
    kick.rotation.x = Math.PI * 0.5;
    kick.position.set(kx, isDouble ? 0.6 : 0.68, 0.56);
    group.add(kick);
    kicks.push(kick);

    if (isAcrylic || isDouble) {
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(isDouble ? 0.6 : 0.68, 0.032, 8, 24), ledRingMat);
      hoop.position.set(kx, isDouble ? 0.6 : 0.68, 0.87);
      group.add(hoop);
    }
  });

  // Curved chrome drum rack for the Double-Bass Monster Kit
  if (isDouble) {
    const rackBar = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.04, 8, 22, Math.PI * 0.9), rimMat);
    rackBar.rotation.x = Math.PI * 0.5;
    rackBar.position.set(0, 1.15, 0.08);
    group.add(rackBar);

    [-1.12, 1.12].forEach((px) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.18, 8), rimMat);
      leg.position.set(px, 0.59, 0.2);
      group.add(leg);
    });
  }

  // Snare
  const snare = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 16), [shellMat, headMat, rimMat]);
  snare.position.set(-0.66, 0.84, 0.34);
  const snareStand = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.78, 8), rimMat);
  snareStand.position.set(-0.66, 0.4, 0.34);
  group.add(snare, snareStand);

  // Rack Toms (3 on Double-Bass Monster Kit, 2 on others)
  const toms = [];
  const tomXs = isDouble ? [-0.46, 0, 0.46] : [-0.3, 0.3];
  tomXs.forEach((tx, idx) => {
    const r = isDouble ? 0.21 + idx * 0.02 : 0.24;
    const tom = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.26, 14), [shellMat, headMat, rimMat]);
    tom.position.set(tx, 1.38 + (isDouble && idx === 1 ? 0.06 : 0), 0.52);
    tom.rotation.x = 0.28;
    group.add(tom);
    toms.push(tom);
  });

  // Floor Tom(s)
  const floorTom = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.58, 16), [shellMat, headMat, rimMat]);
  floorTom.position.set(0.84, 0.62, 0.2);
  group.add(floorTom);

  if (isDouble) {
    const floorTom2 = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.58, 16), [shellMat, headMat, rimMat]);
    floorTom2.position.set(1.24, 0.58, -0.14);
    group.add(floorTom2);
  }

  // Cymbals (Hi-hat, Left Crash, Right Crash/Ride + optional Metal China Cymbal)
  const cymbals = [];
  const cymbalSpecs = [
    { x: -1.06, y: 1.48, z: 0.16, r: 0.34 }, // 0: Hi-hat
    { x: -0.82, y: 1.9, z: 0.62, r: 0.42 }, // 1: Left Crash
    { x: 0.96, y: 1.84, z: 0.56, r: 0.46 }, // 2: Right Crash/Ride
  ];
  if (isDouble) {
    cymbalSpecs.push({ x: 1.34, y: 1.96, z: 0.18, r: 0.44 }); // 3: Extra China Cymbal
  }

  cymbalSpecs.forEach((c) => {
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, c.y, 8), rimMat);
    stand.position.set(c.x, c.y * 0.5, c.z);
    group.add(stand);

    const disc = new THREE.Mesh(new THREE.CylinderGeometry(c.r, c.r * 1.04, 0.035, 18), brassMat);
    disc.position.set(c.x, c.y, c.z);
    group.add(disc);
    cymbals.push(disc);
  });

  // Drum throne
  const stoolTop = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.32, 0.14, 14),
    new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.7 })
  );
  stoolTop.position.set(0, 0.66, -0.18);
  const stoolPost = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.66, 8), rimMat);
  stoolPost.position.set(0, 0.33, -0.18);
  group.add(stoolTop, stoolPost);

  return {
    group,
    cymbals,
    toms,
    snare,
    kick: kicks[0],
    kicks,
    ledRingMat,
    dispose() {
      disposeGroupResources(group, textures);
    },
  };
}

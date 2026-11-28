/**
 * venues.js
 * 10 Full-Scale 360° Real-Life Iconic Concert Stadiums + Independent Stage Theme / Event Overlay Engine:
 *   Selector A (10 Iconic Real-Life Stadiums):
 *     - Philippine Arena (Bulacan)
 *     - SM Mall of Asia Arena (Pasay / Manila Bay)
 *     - Wembley Stadium (London)
 *     - Madison Square Garden (New York)
 *     - Tokyo Dome (Tokyo)
 *     - Red Rocks Amphitheatre (Colorado)
 *     - Maracanã Stadium (Rio de Janeiro)
 *     - Sydney Harbour Open-Air Stage (Sydney)
 *     - Stade de France (Paris)
 *     - Seoul Olympic Stadium (Seoul)
 *   Selector B (9 Composable Stage Theme / Event Overlays):
 *     - STANDARD, CHRISTMAS, HALLOWEEN, SAKURA, CYBER_NEON, ROYAL_OPERA, TROPICAL_SUMMER, FIESTA_PINOY, APOCALYPSE_HELLFIRE
 *
 * 100% client-side pure JavaScript / Three.js:
 *   - Dynamic procedural atmospheric ShaderMaterial sky dome (r = 780u, cloud drift + twinkling stars)
 *   - 3-tier stepped elliptical seating bowls with concrete stair aisles, safety railings,
 *     glowing glass VIP luxury suites, recessed lit vomitories, 360° scrolling LED ribbon boards,
 *     perimeter catwalk trusses, delay speaker clusters, sky-tracker searchlights & 2,000+ instanced spectators
 *   - Smooth radially parting retractable dome roofs for Grand Encore aerial fireworks
 *   - Rich architectural landmark cityscapes & waterfronts for all 10 venues
 *   - Unobstructed central 38m multi-wing stage deck (x: [-21, 21], z: [-8.5, 5.5]) & extended B-Stage catwalk (z: [5.5, 14.4])
 *   - Venue-adaptive stageTheme skinning (truss trim, PA scrim banners, LED palettes & architectural accents)
 *   - Full GPU resource tracking & disposal
 */

import * as THREE from 'three';
import { getVenuePalette, getStageOverlayPalette } from './bandGearCatalog.js';

export const VENUES = [
  {
    id: 'philippine-arena',
    name: 'Philippine Arena',
    location: 'Bulacan, PH',
    type: 'Mega Dome',
    supportsAerialFireworks: true,
    skyColor: 0x050814,
    fogColor: 0x070d1e,
    fogDensity: 0.0021,
    hemiSky: 0x7dd3fc,
    hemiGround: 0x0f172a,
    keyColor: 0xe0f2fe,
    keyIntensity: 0.8,
    accentHex: 0x38bdf8,
    laserColors: [0x38bdf8, 0xf43f5e, 0xfacc15, 0xa855f7],
    fireworksCeilingY: 24.0,
    description: 'World-record radial steel dome trusses, 360° lightstick bowls, NLEX light trails & Metro Manila horizon.',
  },
  {
    id: 'moa-arena',
    name: 'SM Mall of Asia Arena',
    location: 'Pasay, PH',
    type: 'Bayfront Arena',
    supportsAerialFireworks: true,
    skyColor: 0x040916,
    fogColor: 0x061026,
    fogDensity: 0.0023,
    hemiSky: 0x38bdf8,
    hemiGround: 0x0c1428,
    keyColor: 0xbae6fd,
    keyIntensity: 0.82,
    accentHex: 0x06b6d4,
    laserColors: [0x06b6d4, 0x3b82f6, 0x22d3ee, 0xe0f2fe],
    fireworksCeilingY: 22.0,
    description: 'Retractable eye-shaped arena roof, wrap-around cyan LED ribbons, Manila Bay waves & rotating MOA Eye wheel.',
  },
  {
    id: 'wembley',
    name: 'Wembley Stadium',
    location: 'London, UK',
    type: 'Open Stadium',
    supportsAerialFireworks: true,
    skyColor: 0x050814,
    fogColor: 0x080f24,
    fogDensity: 0.0019,
    hemiSky: 0x93c5fd,
    hemiGround: 0x0f172a,
    keyColor: 0xe0f2fe,
    keyIntensity: 0.8,
    accentHex: 0xef4444,
    laserColors: [0xef4444, 0x38bdf8, 0xf8fafc, 0xfacc15],
    fireworksCeilingY: 25.0,
    description: '360° multi-tier London stadium crowned by the illuminated Wembley Arch, Olympic Way & Shard skyline.',
  },
  {
    id: 'madison-square-garden',
    name: 'Madison Square Garden',
    location: 'New York, USA',
    type: 'Iconic Arena',
    supportsAerialFireworks: true,
    skyColor: 0x070814,
    fogColor: 0x0d0c1c,
    fogDensity: 0.0024,
    hemiSky: 0xa5b4fc,
    hemiGround: 0x12101d,
    keyColor: 0xf1f5f9,
    keyIntensity: 0.8,
    accentHex: 0x6366f1,
    laserColors: [0x818cf8, 0xf43f5e, 0x38bdf8, 0xfacc15],
    fireworksCeilingY: 22.0,
    description: 'Retractable cable-net arena roof, circular Penn Plaza drum, Times Square glow & Empire State skyline.',
  },
  {
    id: 'tokyo-dome',
    name: 'Tokyo Dome',
    location: 'Tokyo, Japan',
    type: 'Air-Dome',
    supportsAerialFireworks: true,
    skyColor: 0x070b1a,
    fogColor: 0x0a1128,
    fogDensity: 0.0022,
    hemiSky: 0xc4b5fd,
    hemiGround: 0x0f172a,
    keyColor: 0xf8fafc,
    keyIntensity: 0.84,
    accentHex: 0xc084fc,
    laserColors: [0xe879f9, 0x38bdf8, 0x22d3ee, 0xf43f5e],
    fireworksCeilingY: 23.0,
    description: 'Retractable Big Egg quilted dome, Thunder Dolphin coaster lights, Big-O wheel & Tokyo Skytree skyline.',
  },
  {
    id: 'red-rocks',
    name: 'Red Rocks Amphitheatre',
    location: 'Colorado, USA',
    type: 'Canyon Open-Air',
    supportsAerialFireworks: true,
    skyColor: 0x070614,
    fogColor: 0x140b1c,
    fogDensity: 0.0018,
    hemiSky: 0xfb923c,
    hemiGround: 0x26120e,
    keyColor: 0xffedd5,
    keyIntensity: 0.84,
    accentHex: 0xea580c,
    laserColors: [0xf97316, 0xfacc15, 0xf43f5e, 0x38bdf8],
    fireworksCeilingY: 25.0,
    description: 'Stratified Creation Rock & Ship Rock sandstone monoliths, pine canyon ridges & distant Denver plains glow.',
  },
  {
    id: 'maracana',
    name: 'Maracanã Stadium',
    location: 'Rio de Janeiro, Brazil',
    type: 'Carnival Bowl',
    supportsAerialFireworks: true,
    skyColor: 0x040b18,
    fogColor: 0x07172a,
    fogDensity: 0.0019,
    hemiSky: 0xfacc15,
    hemiGround: 0x064e3b,
    keyColor: 0xfef9c3,
    keyIntensity: 0.86,
    accentHex: 0x22c55e,
    laserColors: [0x22c55e, 0xfacc15, 0x38bdf8, 0x4ade80],
    fireworksCeilingY: 26.0,
    description: 'Tensioned white ring canopy over a lush green & gold stadium rimmed by Christ the Redeemer & Guanabara Bay.',
  },
  {
    id: 'sydney-harbour',
    name: 'Sydney Harbour Stage',
    location: 'Sydney, Australia',
    type: 'Harbourfront',
    supportsAerialFireworks: true,
    skyColor: 0x04091a,
    fogColor: 0x081630,
    fogDensity: 0.0018,
    hemiSky: 0x38bdf8,
    hemiGround: 0x0c192c,
    keyColor: 0xe0f2fe,
    keyIntensity: 0.85,
    accentHex: 0x38bdf8,
    laserColors: [0x38bdf8, 0xfacc15, 0xf472b6, 0xffffff],
    fireworksCeilingY: 26.5,
    description: 'Waterfront amphitheatre overlooking animated harbour waves, illuminated Opera shells & Sydney Harbour Bridge.',
  },
  {
    id: 'stade-de-france',
    name: 'Stade de France',
    location: 'Paris, France',
    type: 'Floating Canopy',
    supportsAerialFireworks: true,
    skyColor: 0x050716,
    fogColor: 0x0a1026,
    fogDensity: 0.0019,
    hemiSky: 0x60a5fa,
    hemiGround: 0x111827,
    keyColor: 0xf1f5f9,
    keyIntensity: 0.84,
    accentHex: 0x3b82f6,
    laserColors: [0x3b82f6, 0xffffff, 0xef4444, 0xfacc15],
    fireworksCeilingY: 25.0,
    description: 'Elliptical suspended Paris canopy halo on stay-cable masts, tricolor fasciae & sparkling Eiffel Tower horizon.',
  },
  {
    id: 'seoul-olympic',
    name: 'Seoul Olympic Stadium',
    location: 'Seoul, South Korea',
    type: 'Porcelain Bowl',
    supportsAerialFireworks: true,
    skyColor: 0x060718,
    fogColor: 0x0f122b,
    fogDensity: 0.002,
    hemiSky: 0xc084fc,
    hemiGround: 0x111827,
    keyColor: 0xf8fafc,
    keyIntensity: 0.85,
    accentHex: 0xec4899,
    laserColors: [0xec4899, 0x22d3ee, 0xc084fc, 0xfacc15],
    fireworksCeilingY: 25.5,
    description: 'Sweeping Joseon-porcelain curved canopy, Olympic cauldron flame, Han River bridge & Lotte World Tower.',
  },
];

export const STAGE_OVERLAYS = [
  {
    id: 'STANDARD',
    name: 'Standard Tour Rig',
    shortName: 'Standard',
    badge: 'WORLD TOUR',
    accentCss: '#38bdf8',
    accentHex: 0x38bdf8,
    secondaryHex: 0xfacc15,
    rimHex: null,
    laserColors: null,
    continuousIndoorFountains: false,
    description: 'Pure stadium architecture and chrome pro-touring festival truss rig.',
  },
  {
    id: 'CHRISTMAS',
    name: 'Christmas Wonderland',
    shortName: 'Christmas',
    badge: 'HOLIDAY OVERLAY',
    accentCss: '#38bdf8',
    accentHex: 0x38bdf8,
    secondaryHex: 0xfacc15,
    rimHex: 0xef4444,
    laserColors: [0x38bdf8, 0xfacc15, 0xef4444, 0x4ade80],
    continuousIndoorFountains: false,
    description: 'Giant 3D lit Christmas tree, candy-cane perimeter trusses, gift stacks & falling snow.',
  },
  {
    id: 'HALLOWEEN',
    name: 'Haunted Cathedral',
    shortName: 'Halloween',
    badge: 'SPOOKY OVERLAY',
    accentCss: '#a855f7',
    accentHex: 0xa855f7,
    secondaryHex: 0xf97316,
    rimHex: 0x4ade80,
    laserColors: [0xa855f7, 0x4ade80, 0xf97316, 0xe879f9],
    continuousIndoorFountains: false,
    description: 'Harvest moon, gothic wing spires, jack-o’-lanterns, toxic cauldrons & floating candles.',
  },
  {
    id: 'SAKURA',
    name: 'Sakura Blossom',
    shortName: 'Sakura',
    badge: 'MATSURI OVERLAY',
    accentCss: '#f472b6',
    accentHex: 0xf472b6,
    secondaryHex: 0xfef08a,
    rimHex: 0xfb7185,
    laserColors: [0xf472b6, 0xfef08a, 0xfb7185, 0x38bdf8],
    continuousIndoorFountains: false,
    description: 'Crimson Torii side shrines, glowing festival lanterns, blossom trees & drifting sakura petals.',
  },
  {
    id: 'CYBER_NEON',
    name: 'Cyber Neon 2099',
    shortName: 'Cyber Neon',
    badge: 'FUTURE OVERLAY',
    accentCss: '#22d3ee',
    accentHex: 0x22d3ee,
    secondaryHex: 0xec4899,
    rimHex: 0xa855f7,
    laserColors: [0x22d3ee, 0xec4899, 0xa855f7, 0xfacc15],
    continuousIndoorFountains: false,
    description: 'Holographic kanji billboards, cyan laser-grid floor ring & falling neon digital rain.',
  },
  {
    id: 'ROYAL_OPERA',
    name: 'Royal Gold Opera',
    shortName: 'Royal Opera',
    badge: 'GALA OVERLAY',
    accentCss: '#facc15',
    accentHex: 0xfacc15,
    secondaryHex: 0xf43f5e,
    rimHex: 0xfef08a,
    laserColors: [0xfacc15, 0xf43f5e, 0xfef08a, 0xfb923c],
    continuousIndoorFountains: true,
    description: 'Crimson velvet proscenium drapes, marble columns, spinning crystal chandeliers & golden gala fountains.',
  },
  {
    id: 'TROPICAL_SUMMER',
    name: 'Tropical Summer Fest',
    shortName: 'Tropical Fest',
    badge: 'BEACH OVERLAY',
    accentCss: '#f97316',
    accentHex: 0xf97316,
    secondaryHex: 0x22d3ee,
    rimHex: 0xfacc15,
    laserColors: [0xf97316, 0xfacc15, 0x22d3ee, 0xf472b6],
    continuousIndoorFountains: false,
    description: 'Swaying coastal palms, surfboards, flickering bamboo tiki torches & sunset ember warmth.',
  },
  {
    id: 'FIESTA_PINOY',
    name: 'Fiesta Pinoy Plaza',
    shortName: 'Fiesta Pinoy',
    badge: 'FIESTA OVERLAY',
    accentCss: '#facc15',
    accentHex: 0xfacc15,
    secondaryHex: 0xec4899,
    rimHex: 0x3b82f6,
    laserColors: [0xfacc15, 0xec4899, 0x3b82f6, 0x22c55e],
    continuousIndoorFountains: false,
    description: 'Glowing capiz star parol lanterns on wing trusses & festive multicolor overhead banderitas.',
  },
  {
    id: 'APOCALYPSE_HELLFIRE',
    name: 'Apocalypse Hellfire',
    shortName: 'Hellfire',
    badge: 'INFERNO OVERLAY',
    accentCss: '#ef4444',
    accentHex: 0xef4444,
    secondaryHex: 0xf97316,
    rimHex: 0xfb923c,
    laserColors: [0xef4444, 0xf97316, 0xfacc15, 0xdc2626],
    continuousIndoorFountains: true,
    description: 'Jagged obsidian wing monoliths, glowing molten floor fissures & rising volcanic embers.',
  },
];

const LEGACY_VENUE_CHOICE_MAP = {
  'christmas-wonderland': { venueId: 'philippine-arena', overlayId: 'CHRISTMAS' },
  'halloween-cathedral': { venueId: 'wembley', overlayId: 'HALLOWEEN' },
  'sakura-festival': { venueId: 'tokyo-dome', overlayId: 'SAKURA' },
  'cyber-tokyo': { venueId: 'tokyo-dome', overlayId: 'CYBER_NEON' },
  'royal-opera': { venueId: 'madison-square-garden', overlayId: 'ROYAL_OPERA' },
  'tropical-beach': { venueId: 'moa-arena', overlayId: 'TROPICAL_SUMMER' },
  araneta: { venueId: 'philippine-arena', overlayId: 'STANDARD' },
  'araneta-coliseum': { venueId: 'philippine-arena', overlayId: 'STANDARD' },
  'up-sunken-garden': { venueId: 'red-rocks', overlayId: 'STANDARD' },
  intramuros: { venueId: 'wembley', overlayId: 'STANDARD' },
  coachella: { venueId: 'red-rocks', overlayId: 'TROPICAL_SUMMER' },
};

export function resolveLegacyVenueChoice(rawVenueId, explicitOverlayId = null) {
  const legacy = LEGACY_VENUE_CHOICE_MAP[rawVenueId];
  if (legacy) {
    return {
      venueId: legacy.venueId,
      overlayId: explicitOverlayId || legacy.overlayId,
    };
  }
  return {
    venueId: VENUES.some((v) => v.id === rawVenueId) ? rawVenueId : VENUES[0].id,
    overlayId: STAGE_OVERLAYS.some((o) => o.id === explicitOverlayId) ? explicitOverlayId : 'STANDARD',
  };
}

export function getVenueById(venueId) {
  const resolved = LEGACY_VENUE_CHOICE_MAP[venueId]?.venueId || venueId;
  return VENUES.find((v) => v.id === resolved) || VENUES[0];
}

export function getStageOverlayById(overlayId) {
  return STAGE_OVERLAYS.find((o) => o.id === overlayId) || STAGE_OVERLAYS[0];
}

// Pre-allocated scratch helpers shared across bowl & city animations (zero GC!)
const _bowlDummy = new THREE.Object3D();
const _bowlColor = new THREE.Color();
const _bowlWaveColor = new THREE.Color(0xfde047);
const _bowlPhoneColor = new THREE.Color(0xfffbeb);
const _bowlChorusAltColor = new THREE.Color(0x38bdf8);
const _tmpSkyColor = new THREE.Color();

/* ============================================================================
   PROCEDURAL CANVAS PBR TEXTURE GENERATORS (100% PURE JS / ZERO NETWORK)
   ============================================================================ */

function createLedScreenTexture(title, accentHex, secondaryHex) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 512, 256);
  grad.addColorStop(0, '#070b18');
  grad.addColorStop(0.5, accentHex);
  grad.addColorStop(1, '#070b18');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  for (let i = 0; i < 32; i += 1) {
    const h = 36 + Math.abs(Math.sin(i * 0.45)) * 130;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.22)' : secondaryHex;
    ctx.fillRect(14 + i * 15.2, 236 - h, 10, h);
  }

  ctx.fillStyle = 'rgba(4, 7, 15, 0.62)';
  ctx.fillRect(0, 82, 512, 92);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 42px Oswald, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title.toUpperCase(), 256, 118);

  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 18px Oswald, sans-serif';
  ctx.fillText('WORLD TOUR CONCERT EDITION', 256, 154);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createLedRibbonTexture(title, accentHex = '#38bdf8', secondaryHex = '#facc15') {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 1024, 0);
  grad.addColorStop(0, '#050816');
  grad.addColorStop(0.22, accentHex);
  grad.addColorStop(0.5, '#090d1f');
  grad.addColorStop(0.76, secondaryHex);
  grad.addColorStop(1, '#050816');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 128);

  // Diagonal kinetic chevron bars + spectrum equalizer ticks
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  for (let x = -64; x < 1080; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 128);
    ctx.lineTo(x + 28, 0);
    ctx.lineTo(x + 42, 0);
    ctx.lineTo(x + 14, 128);
    ctx.closePath();
    ctx.fill();
  }

  for (let i = 0; i < 64; i += 1) {
    const eqH = 18 + Math.abs(Math.sin(i * 0.52)) * 58;
    ctx.fillStyle = i % 3 === 0 ? '#ffffff' : i % 2 === 0 ? accentHex : secondaryHex;
    ctx.fillRect(i * 16 + 3, 122 - eqH, 9, eqH);
  }

  ctx.fillStyle = 'rgba(3, 6, 16, 0.72)';
  ctx.fillRect(0, 32, 1024, 62);

  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 32);
  ctx.lineTo(1024, 32);
  ctx.moveTo(0, 94);
  ctx.lineTo(1024, 94);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px Oswald, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`★ ${title.toUpperCase()} ★ WORLD TOUR LIVE ★`, 512, 64);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(6, 1);
  return tex;
}

function createGlassSuiteTexture(accentHex = '#fbbf24') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#070d1b';
  ctx.fillRect(0, 0, 512, 128);

  const suiteCount = 8;
  const w = 512 / suiteCount;
  for (let s = 0; s < suiteCount; s += 1) {
    const gx = s * w;
    const warmLit = s % 3 !== 1;
    const glowGrad = ctx.createLinearGradient(gx, 14, gx, 114);
    glowGrad.addColorStop(0, warmLit ? accentHex : '#38bdf8');
    glowGrad.addColorStop(0.55, warmLit ? 'rgba(253, 224, 71, 0.42)' : 'rgba(56, 189, 248, 0.28)');
    glowGrad.addColorStop(1, '#091124');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(gx + 5, 16, w - 10, 96);

    // Subtle interior suite ceiling track + people silhouettes
    ctx.fillStyle = 'rgba(10, 14, 26, 0.58)';
    ctx.fillRect(gx + 16, 72, 12, 40);
    ctx.fillRect(gx + 34, 76, 10, 36);

    // Steel window mullion
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(gx, 0, 6, 128);
  }

  ctx.fillStyle = '#334155';
  ctx.fillRect(0, 0, 512, 12);
  ctx.fillRect(0, 116, 512, 12);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(8, 1);
  return tex;
}

function createSandstoneTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  const strata = ['#6b2717', '#8c351e', '#a94826', '#722c1a', '#531d12', '#9e4122', '#7a2f1a', '#b6542b'];
  let y = 0;
  let idx = 0;
  while (y < 256) {
    const h = 10 + ((idx * 13) % 18);
    ctx.fillStyle = strata[idx % strata.length];
    ctx.fillRect(0, y, 256, h + 2);
    // Wavy sedimentary vein
    ctx.fillStyle = 'rgba(30, 10, 6, 0.26)';
    ctx.fillRect(0, y + h - 2, 256, 3);
    y += h;
    idx += 1;
  }
  for (let i = 0; i < 450; i += 1) {
    const x = (i * 73) % 256;
    const yy = (i * 137) % 256;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 200, 160, 0.08)' : 'rgba(20, 6, 4, 0.14)';
    ctx.fillRect(x, yy, 12 + (i % 24), 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 3);
  return tex;
}

function createStoneTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#5c4d3e';
  ctx.fillRect(0, 0, 256, 256);

  const rows = 8;
  const rowH = 256 / rows;
  for (let r = 0; r < rows; r += 1) {
    const offset = (r % 2) * 32;
    for (let c = -1; c < 5; c += 1) {
      const shade = 72 + ((r * 17 + c * 29) & 31);
      ctx.fillStyle = `rgb(${shade + 18}, ${shade + 6}, ${shade - 8})`;
      ctx.fillRect(c * 64 + offset + 2, r * rowH + 2, 60, rowH - 4);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 2);
  return tex;
}

function createCandyCaneTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 26;
  for (let i = -128; i < 256; i += 54) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 128, 128);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 5);
  return tex;
}

function createKanjiBillboardTexture(mainText, subText, accentHex = '#22d3ee', bgHex = '#110624') {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, bgHex);
  grad.addColorStop(0.5, '#1e0b36');
  grad.addColorStop(1, bgHex);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 512);

  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 10;
  ctx.strokeRect(10, 10, 236, 492);
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  for (let y = 0; y < 512; y += 8) {
    ctx.fillRect(16, y, 224, 2);
  }

  ctx.fillStyle = accentHex;
  ctx.shadowColor = accentHex;
  ctx.shadowBlur = 18;
  ctx.font = 'bold 74px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  Array.from(mainText).forEach((ch, idx) => {
    ctx.fillText(ch, 128, 92 + idx * 96);
  });

  ctx.shadowBlur = 8;
  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 26px Oswald, sans-serif';
  ctx.fillText(subText, 128, 466);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createNeonGridTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#070416';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.55)';
  ctx.lineWidth = 3;
  for (let i = 0; i <= 256; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 256);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(256, i);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(32, 32);
  return tex;
}

function createSkyscraperWindowTexture(accentHex = '#38bdf8', warmBias = false) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#070b17';
  ctx.fillRect(0, 0, 128, 256);
  for (let y = 8; y < 250; y += 10) {
    const floorLitBand = ((y * 7) % 19) > 3;
    for (let x = 6; x < 122; x += 12) {
      const lit = floorLitBand && ((x * 17 + y * 31) % 11) > 4;
      if (!lit) continue;
      ctx.fillStyle =
        (x + y) % 9 === 0
          ? accentHex
          : warmBias || (x * y) % 4 === 0
            ? '#fde68a'
            : '#bae6fd';
      ctx.globalAlpha = 0.48 + ((x + y) % 4) * 0.13;
      ctx.fillRect(x, y, 7, 5);
    }
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/* ============================================================================
   ATMOSPHERIC SHADER SKY DOME + EXTENDED HORIZON GROUND + ANIMATED OCEAN
   ============================================================================ */

/**
 * Full-Scale Procedural Shader Sky Dome (radius 780u inside camera.far = 900).
 * Renders dynamic zenith-mid-horizon atmospheric gradient, drifting FBM night clouds,
 * twinkling upper-hemisphere stars, and Grand Encore sky reveal without external assets.
 */
function addSkyDome(group, disposables, topHex, midHex, horizonHex, addStars = true, dynamicElements = null) {
  const topColor = new THREE.Color(topHex);
  const midColor = new THREE.Color(midHex);
  const horizonColor = new THREE.Color(horizonHex);

  const geo = new THREE.SphereGeometry(780, 36, 24);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTopColor: { value: topColor.clone() },
      uMidColor: { value: midColor.clone() },
      uHorizonColor: { value: horizonColor.clone() },
      uTime: { value: 0 },
      uStarIntensity: { value: addStars ? 1.0 : 0.18 },
      uGrandEncoreMix: { value: 0 },
    },
    vertexShader: `
      varying vec3 vWorldDir;
      void main() {
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uTopColor;
      uniform vec3 uMidColor;
      uniform vec3 uHorizonColor;
      uniform float uTime;
      uniform float uStarIntensity;
      uniform float uGrandEncoreMix;
      varying vec3 vWorldDir;

      float hash21(vec2 p) {
        p = fract(p * vec2(234.34, 435.345));
        p += dot(p, p + 34.23);
        return fract(p.x * p.y);
      }

      float noise2(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 4; i++) {
          v += a * noise2(p);
          p = p * 2.03 + vec2(17.1, 31.7);
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec3 d = normalize(vWorldDir);
        float h = clamp(d.y, 0.0, 1.0);

        // 3-stop twilight/night sky gradient blended smoothly to horizon
        vec3 sky = mix(uHorizonColor, uMidColor, smoothstep(0.0, 0.28, h));
        sky = mix(sky, uTopColor, smoothstep(0.24, 0.85, h));

        // Subtle high-altitude drifting stadium clouds lit from below by arena glow
        float az = atan(d.z, d.x);
        vec2 cloudUv = vec2(az * 1.9 + uTime * 0.012, h * 5.2 - uTime * 0.004);
        float cloud = fbm(cloudUv * 2.4);
        float cloudMask = smoothstep(0.48, 0.82, cloud) * smoothstep(0.04, 0.25, h) * smoothstep(0.88, 0.25, h);
        vec3 cloudColor = mix(uMidColor * 1.35, uHorizonColor * 1.45, 1.0 - h);
        sky = mix(sky, cloudColor, cloudMask * 0.42);

        // Sharp twinkling starfield across upper dome hemisphere
        if (h > 0.06 && uStarIntensity > 0.01) {
          vec2 starGrid = vec2(az * 42.0, asin(clamp(d.y, -1.0, 1.0)) * 42.0);
          vec2 cell = floor(starGrid);
          vec2 local = fract(starGrid) - 0.5;
          float rnd = hash21(cell);
          if (rnd > 0.915) {
            float dist = length(local);
            float twinkle = 0.65 + 0.35 * sin(uTime * (2.2 + rnd * 4.0) + rnd * 62.8);
            float starCore = smoothstep(0.16, 0.015, dist) * twinkle * smoothstep(0.06, 0.28, h);
            float grandBoost = 1.0 + uGrandEncoreMix * 0.95;
            vec3 starHue = mix(vec3(0.85, 0.93, 1.0), vec3(1.0, 0.94, 0.78), fract(rnd * 13.7));
            sky += starHue * starCore * uStarIntensity * grandBoost * (1.0 - cloudMask * 0.7);
          }
        }

        // Horizon atmospheric haze glow band
        float horizonGlow = pow(1.0 - smoothstep(0.0, 0.22, abs(d.y)), 2.2);
        sky += uHorizonColor * horizonGlow * 0.25;

        gl_FragColor = vec4(sky, 1.0);
      }
    `,
  });
  // Attach dummy .color property so legacy skyMat.color reads never throw
  mat.color = new THREE.Color(0xffffff);

  disposables.geometries.push(geo);
  disposables.materials.push(mat);
  const dome = new THREE.Mesh(geo, mat);
  dome.position.y = 8;
  group.add(dome);
  if (dynamicElements) {
    dynamicElements.skyDome = dome;
    dynamicElements.skyMat = mat;
  } else {
    group.userData.skyDome = dome;
    group.userData.skyMat = mat;
  }
  return dome;
}

/**
 * Extended Horizon Ground Plane (radius 740u, at y = -2.26m matching stadium base).
 */
function addOutdoorGround(group, disposables, groundColor = 0x0d1b12) {
  const geo = new THREE.CircleGeometry(740, 64);
  geo.rotateX(-Math.PI * 0.5);

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#888888';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 640; i += 1) {
    const x = (i * 53) % 128;
    const y = (i * 97) % 128;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.22)';
    ctx.fillRect(x, y, 2, 2);
  }
  const gritTex = new THREE.CanvasTexture(canvas);
  gritTex.colorSpace = THREE.NoColorSpace;
  gritTex.wrapS = THREE.RepeatWrapping;
  gritTex.wrapT = THREE.RepeatWrapping;
  gritTex.repeat.set(180, 180);
  disposables.textures.push(gritTex);

  const mat = new THREE.MeshStandardMaterial({
    color: groundColor,
    roughness: 0.92,
    roughnessMap: gritTex,
    bumpMap: gritTex,
    bumpScale: 0.045,
    metalness: 0.05,
  });
  disposables.geometries.push(geo);
  disposables.materials.push(mat);
  const ground = new THREE.Mesh(geo, mat);
  ground.position.y = -2.26;
  group.add(ground);
  return ground;
}

/**
 * Animated GLSL Wave Ocean via onBeforeCompile (zero per-frame JS vertex loops!).
 */
function createAnimatedOcean(group, disposables, {
  width = 580,
  depth = 340,
  x = 0,
  y = -2.08,
  z = -210,
  color = 0x0e7490,
  emissive = 0x075985,
  emissiveIntensity = 0.3,
}) {
  const uniforms = {
    uTime: { value: 0 },
  };
  const geo = new THREE.PlaneGeometry(width, depth, 72, 48);
  geo.rotateX(-Math.PI * 0.5);
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity,
    roughness: 0.14,
    metalness: 0.72,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = `
      uniform float uTime;
      varying float vWaveCrest;
    ` + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      float w1 = sin(transformed.x * 0.16 + uTime * 1.9) * cos(transformed.z * 0.2 + uTime * 1.4);
      float w2 = sin((transformed.x + transformed.z) * 0.32 - uTime * 2.5) * 0.45;
      float disp = (w1 + w2) * 0.44;
      transformed.y += disp;
      vWaveCrest = disp;
      `
    );
    shader.fragmentShader = `
      varying float vWaveCrest;
    ` + shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `
      #include <emissivemap_fragment>
      float crestGlow = smoothstep(0.14, 0.56, vWaveCrest);
      totalEmissiveRadiance += vec3(0.28, 0.54, 0.68) * crestGlow * 0.58;
      `
    );
  };
  mat.customProgramCacheKey = () => 'concert-ocean-waves-v2';

  disposables.geometries.push(geo);
  disposables.materials.push(mat);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  group.add(mesh);
  return { mesh, mat, uniforms };
}

/**
 * Instanced Glowing City Skyline Ring around stadium/arena horizons (radius ~140..310).
 */
function addDistantCitySkyline(group, disposables, {
  count = 96,
  minRadius = 140,
  maxRadius = 290,
  minHeight = 24,
  maxHeight = 86,
  accentHex = 0x38bdf8,
  baseColor = 0x0b1020,
  skipRearOceanArc = false,
  warmBias = false,
} = {}) {
  const winTex = createSkyscraperWindowTexture(`#${new THREE.Color(accentHex).getHexString()}`, warmBias);
  winTex.repeat.set(2, 4);
  disposables.textures.push(winTex);

  const bldgGeo = new THREE.BoxGeometry(1, 1, 1);
  const bldgMat = new THREE.MeshStandardMaterial({
    color: baseColor,
    map: winTex,
    emissive: accentHex,
    emissiveMap: winTex,
    emissiveIntensity: 0.82,
    roughness: 0.5,
    metalness: 0.42,
  });
  disposables.geometries.push(bldgGeo);
  disposables.materials.push(bldgMat);

  const towers = new THREE.InstancedMesh(bldgGeo, bldgMat, count);
  towers.frustumCulled = false;

  const beaconGeo = new THREE.BoxGeometry(1.04, 0.08, 1.04);
  const beaconMat = new THREE.MeshBasicMaterial({ color: accentHex });
  disposables.geometries.push(beaconGeo);
  disposables.materials.push(beaconMat);
  const beacons = new THREE.InstancedMesh(beaconGeo, beaconMat, count);
  beacons.frustumCulled = false;

  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i += 1) {
    let ang = (i / count) * Math.PI * 2 + Math.sin(i * 3.1) * 0.04;
    if (skipRearOceanArc) {
      const normA = Math.atan2(Math.sin(ang), Math.cos(ang));
      if (normA < -Math.PI * 0.16 && normA > -Math.PI * 0.84) {
        ang = Math.PI * 0.14 + (i / count) * Math.PI * 0.88;
      }
    }
    const r = minRadius + ((i * 37) % 100) / 100 * (maxRadius - minRadius);
    const h = minHeight + ((i * 53) % 100) / 100 * (maxHeight - minHeight);
    const w = 7.5 + ((i * 19) % 7) * 1.45;
    const d = 7.5 + ((i * 23) % 7) * 1.35;
    const x = Math.cos(ang) * r;
    const z = Math.sin(ang) * r;

    dummy.position.set(x, h * 0.5 - 2.3, z);
    dummy.rotation.set(0, -ang, 0);
    dummy.scale.set(w, h, d);
    dummy.updateMatrix();
    towers.setMatrixAt(i, dummy.matrix);

    dummy.position.set(x, h - 2.35, z);
    dummy.scale.set(w * 0.98, 6.2, d * 0.98);
    dummy.updateMatrix();
    beacons.setMatrixAt(i, dummy.matrix);
  }
  towers.instanceMatrix.needsUpdate = true;
  beacons.instanceMatrix.needsUpdate = true;
  group.add(towers, beacons);
  return { towers, beacons };
}

/**
 * Instanced Night Landscape Trees (palms or deciduous/pines) along stadium avenues/plazas.
 */
function addInstancedFoliageRing(group, disposables, {
  count = 42,
  minRadius = 72,
  maxRadius = 128,
  centerZ = 5.0,
  canopyColor = 0x14532d,
  isPine = false,
  skipRearArc = false,
} = {}) {
  const trunkGeo = new THREE.CylinderGeometry(0.28, 0.44, 4.4, 6);
  const crownGeo = isPine ? new THREE.ConeGeometry(2.4, 7.6, 7) : new THREE.DodecahedronGeometry(2.4, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3f2718, roughness: 0.9 });
  const crownMat = new THREE.MeshStandardMaterial({ color: canopyColor, roughness: 0.85, flatShading: true });
  disposables.geometries.push(trunkGeo, crownGeo);
  disposables.materials.push(trunkMat, crownMat);

  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, count);
  const d = new THREE.Object3D();

  for (let i = 0; i < count; i += 1) {
    let ang = (i / count) * Math.PI * 2 + (i % 3) * 0.05;
    if (skipRearArc) {
      const na = Math.atan2(Math.sin(ang), Math.cos(ang));
      if (na < -Math.PI * 0.16 && na > -Math.PI * 0.84) {
        ang += Math.PI;
      }
    }
    const r = minRadius + ((i * 41) % 100) / 100 * (maxRadius - minRadius);
    const sc = 0.8 + ((i * 17) % 5) * 0.16;
    const x = Math.cos(ang) * r;
    const z = centerZ + Math.sin(ang) * r;

    d.position.set(x, -2.2 + 2.2 * sc, z);
    d.rotation.set(0, ang, 0);
    d.scale.setScalar(sc);
    d.updateMatrix();
    trunks.setMatrixAt(i, d.matrix);

    d.position.set(x, -2.2 + (isPine ? 5.6 : 4.8) * sc, z);
    d.scale.set(sc * 1.05, sc * (isPine ? 1.15 : 0.86), sc * 1.05);
    d.updateMatrix();
    crowns.setMatrixAt(i, d.matrix);
  }
  trunks.instanceMatrix.needsUpdate = true;
  crowns.instanceMatrix.needsUpdate = true;
  group.add(trunks, crowns);
}

/**
 * Exterior Perimeter Sky-Tracker Searchlights shooting soft volumetric cones high into the night sky.
 */
function addPerimeterSearchlights(group, disposables, dynamicElements, {
  radius = 64,
  centerZ = 5.0,
  count = 6,
  colors = [0x38bdf8, 0xfacc15, 0xf472b6],
} = {}) {
  const housingGeo = new THREE.CylinderGeometry(0.65, 0.85, 1.6, 10);
  const housingMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.8 });
  const beamGeo = new THREE.CylinderGeometry(0.42, 4.6, 128, 16, 1, true);
  beamGeo.translate(0, 64, 0);
  disposables.geometries.push(housingGeo, beamGeo);
  disposables.materials.push(housingMat);

  const pivots = [];
  for (let i = 0; i < count; i += 1) {
    const ang = (i / count) * Math.PI * 2 + 0.45;
    const px = Math.cos(ang) * radius;
    const pz = centerZ + Math.sin(ang) * radius;
    const hex = colors[i % colors.length];

    const pod = new THREE.Group();
    pod.position.set(px, -1.5, pz);
    const housing = new THREE.Mesh(housingGeo, housingMat);
    pod.add(housing);

    const pivot = new THREE.Group();
    const beamMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uColor: { value: new THREE.Color(hex) },
        uIntensity: { value: 0.22 },
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
        uniform float uIntensity;
        varying vec2 vUv;
        varying vec3 vNormalView;
        varying vec3 vViewPos;
        void main() {
          vec3 vDir = normalize(vViewPos);
          float fresnel = pow(abs(dot(normalize(vNormalView), vDir)), 1.6);
          float axial = smoothstep(0.0, 0.1, vUv.y) * smoothstep(1.0, 0.15, vUv.y);
          float alpha = fresnel * axial * uIntensity * 0.22;
          gl_FragColor = vec4(uColor, clamp(alpha, 0.0, 0.35));
        }
      `,
    });
    disposables.materials.push(beamMat);
    const beam = new THREE.Mesh(beamGeo, beamMat);
    pivot.add(beam);
    pod.add(pivot);
    group.add(pod);
    pivots.push({ pivot, beamMat, baseAng: ang, phase: i * 1.15 });
  }

  if (dynamicElements) {
    dynamicElements.searchlights = pivots;
  }
  return pivots;
}

/* ============================================================================
   MONUMENTAL 3-TIERED 360° STADIUM SEATING BOWL + VIP SUITES + LED RIBBONS
   ============================================================================ */

/**
 * True 360° Elliptical Multi-Tier Stadium Bowl:
 *  - Stepped concrete seating terraces + radial concrete stair aisles + brushed steel guard railings
 *  - Dual 360° animated scrolling LED Ribbon Scoreboards
 *  - Glowing Glass-Fronted VIP Luxury Suites / Skyboxes with mullions
 *  - Recessed lit Vomitory / Concourse Exit Tunnels
 *  - Overhead perimeter catwalk lighting trusses & delay speaker clusters
 *  - 1,600–2,200 instanced seated spectators & dynamic wristbands/lightsticks/smartphones
 * Sized strictly outside the 28m x 16m stage deck (x: [-14, 14], z: [-11, 5])
 * and central T-catwalk (z: [5, 11.4]).
 */
function addStadiumSeatingBowl(group, disposables, {
  venueName = 'WORLD ARENA',
  radiusX = 35,
  radiusZ = 32,
  centerZ = 4.5,
  tiers = 3,
  lightstickPalette = [0x38bdf8, 0xf8fafc, 0xfacc15],
  seatColor = 0x111726,
  fasciaColor = 0x38bdf8,
  secondaryColor = 0xfacc15,
  exteriorWall = true,
  floodlightTowers = true,
  perimeterCatwalk = true,
  dynamicElements = null,
}) {
  const tierMat = new THREE.MeshStandardMaterial({
    color: seatColor,
    roughness: 0.78,
    metalness: 0.16,
    side: THREE.DoubleSide,
  });
  const concreteMat = new THREE.MeshStandardMaterial({
    color: 0x1a2234,
    roughness: 0.88,
    metalness: 0.12,
    side: THREE.DoubleSide,
  });
  const railSteelMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.28,
    metalness: 0.86,
  });
  const fasciaHexStr = `#${new THREE.Color(fasciaColor).getHexString()}`;
  const secHexStr = `#${new THREE.Color(secondaryColor).getHexString()}`;
  const ribbonTex = createLedRibbonTexture(venueName, fasciaHexStr, secHexStr);
  disposables.textures.push(ribbonTex);

  const ribbonMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: ribbonTex,
    emissive: 0xffffff,
    emissiveMap: ribbonTex,
    emissiveIntensity: 1.45,
    roughness: 0.25,
    metalness: 0.15,
    side: THREE.BackSide,
  });
  const suiteGlassTex = createGlassSuiteTexture(secHexStr);
  disposables.textures.push(suiteGlassTex);
  const suiteGlassMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: suiteGlassTex,
    emissive: 0xffffff,
    emissiveMap: suiteGlassTex,
    emissiveIntensity: 0.85,
    roughness: 0.14,
    metalness: 0.55,
    side: THREE.BackSide,
  });
  const concourseMat = new THREE.MeshStandardMaterial({
    color: 0x0b1120,
    roughness: 0.86,
    metalness: 0.14,
    side: THREE.DoubleSide,
  });
  disposables.materials.push(tierMat, concreteMat, railSteelMat, ribbonMat, suiteGlassMat, concourseMat);
  if (dynamicElements) {
    dynamicElements.pulseMaterials.push(ribbonMat);
    dynamicElements.scrollingRibbons.push(ribbonTex);
  }

  const ratioZ = radiusZ / Math.max(1, radiusX);

  // 1. Multi-Tier Stepped Seating Bowls + Safety Railings + Concourse Decks + 360° LED Ribbon Scoreboards
  for (let t = 0; t < tiers; t += 1) {
    const tierStep = 5.4;
    const innerR = radiusX + t * tierStep;
    const outerR = innerR + 4.8;
    const baseY = 0.6 + t * 4.4;

    // 3 concrete riser steps per tier for unmistakable architectural depth
    for (let st = 0; st < 3; st += 1) {
      const rIn = innerR + st * 1.55;
      const rOut = rIn + 1.62;
      const stY = baseY + st * 1.25;
      const wallGeo = new THREE.CylinderGeometry(rOut, rIn, 1.32, 60, 1, true);
      const wall = new THREE.Mesh(wallGeo, st === 0 ? concreteMat : tierMat);
      wall.scale.set(1, 1, ratioZ);
      wall.position.set(0, stY + 0.66, centerZ);
      disposables.geometries.push(wallGeo);
      group.add(wall);
    }

    // Upper tier concourse walkway ring
    const deckGeo = new THREE.RingGeometry(innerR, outerR + 0.65, 60);
    deckGeo.rotateX(-Math.PI * 0.5);
    const deck = new THREE.Mesh(deckGeo, concourseMat);
    deck.scale.set(1, 1, ratioZ);
    deck.position.set(0, baseY + 3.82, centerZ);
    disposables.geometries.push(deckGeo);
    group.add(deck);

    // Metallic safety guard railing along tier lip
    const railGeo = new THREE.TorusGeometry(innerR - 0.15, 0.08, 6, 64);
    railGeo.rotateX(Math.PI * 0.5);
    const rail = new THREE.Mesh(railGeo, railSteelMat);
    rail.scale.set(1, 1, ratioZ);
    rail.position.set(0, baseY + 0.65, centerZ);
    disposables.geometries.push(railGeo);
    group.add(rail);

    // Illuminated 360° Animated LED Ribbon Scoreboards wrapping Mezzanine & Upper Tiers
    if (t >= 1 || tiers <= 2) {
      const ribbonGeo = new THREE.CylinderGeometry(innerR - 0.1, innerR - 0.1, 1.05, 64, 1, true);
      const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
      ribbon.scale.set(1, 1, ratioZ);
      ribbon.position.set(0, baseY - 0.12, centerZ);
      disposables.geometries.push(ribbonGeo);
      group.add(ribbon);
    }
  }

  // 2. Glowing Glass-Fronted VIP Luxury Suites / Skyboxes band between Lower Bowl & Upper Deck
  const suiteR = radiusX + 4.95;
  const suiteY = 4.65;
  const suiteWallGeo = new THREE.CylinderGeometry(suiteR + 0.3, suiteR + 0.3, 2.25, 64, 1, true);
  const suiteWall = new THREE.Mesh(suiteWallGeo, suiteGlassMat);
  suiteWall.scale.set(1, 1, ratioZ);
  suiteWall.position.set(0, suiteY, centerZ);
  disposables.geometries.push(suiteWallGeo);
  group.add(suiteWall);

  // Instanced structural steel mullions separating VIP skybox bays
  const mullionCount = 32;
  const mullionGeo = new THREE.BoxGeometry(0.26, 2.4, 0.55);
  disposables.geometries.push(mullionGeo);
  const mullions = new THREE.InstancedMesh(mullionGeo, railSteelMat, mullionCount);
  for (let m = 0; m < mullionCount; m += 1) {
    const ang = (m / mullionCount) * Math.PI * 2;
    const mx = Math.cos(ang) * suiteR;
    const mz = centerZ + Math.sin(ang) * suiteR * ratioZ;
    _bowlDummy.position.set(mx, suiteY, mz);
    _bowlDummy.rotation.set(0, -ang + Math.PI * 0.5, 0);
    _bowlDummy.scale.set(1, 1, 1);
    _bowlDummy.updateMatrix();
    mullions.setMatrixAt(m, _bowlDummy.matrix);
  }
  mullions.instanceMatrix.needsUpdate = true;
  group.add(mullions);

  // 3. 16 Radial Concrete Stair Aisles with glowing amber aisle lights
  const aisleCount = 16;
  const aisleGeo = new THREE.BoxGeometry(1.15, 0.35, (tiers - 0.1) * 5.2);
  const aisleMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85, metalness: 0.1 });
  const stepLightGeo = new THREE.BoxGeometry(0.14, 0.08, (tiers - 0.1) * 5.0);
  const stepLightMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
  disposables.geometries.push(aisleGeo, stepLightGeo);
  disposables.materials.push(aisleMat, stepLightMat);
  const aisles = new THREE.InstancedMesh(aisleGeo, aisleMat, aisleCount);
  const stepLights = new THREE.InstancedMesh(stepLightGeo, stepLightMat, aisleCount);
  const midBowlR = radiusX + tiers * 2.4;
  const midBowlY = 1.6 + tiers * 1.9;
  for (let a = 0; a < aisleCount; a += 1) {
    const ang = (a / aisleCount) * Math.PI * 2 + Math.PI / 16;
    const ax = Math.cos(ang) * midBowlR;
    const az = centerZ + Math.sin(ang) * midBowlR * ratioZ;
    _bowlDummy.position.set(ax, midBowlY, az);
    _bowlDummy.rotation.set(0, -ang + Math.PI * 0.5, 0);
    _bowlDummy.rotateX(-0.62);
    _bowlDummy.scale.set(1, 1, 1);
    _bowlDummy.updateMatrix();
    aisles.setMatrixAt(a, _bowlDummy.matrix);
    _bowlDummy.position.set(ax, midBowlY + 0.18, az);
    _bowlDummy.updateMatrix();
    stepLights.setMatrixAt(a, _bowlDummy.matrix);
  }
  aisles.instanceMatrix.needsUpdate = true;
  stepLights.instanceMatrix.needsUpdate = true;
  group.add(aisles, stepLights);

  // 4. Exterior Stadium Facade Wall + 16 Recessed Lit Vomitory Concourse Tunnels
  const outerShellR = radiusX + tiers * 5.4 + 2.2;
  if (exteriorWall) {
    const shellH = 5.4 + tiers * 4.4;
    const shellGeo = new THREE.CylinderGeometry(outerShellR, outerShellR + 1.8, shellH, 60, 1, true);
    const shell = new THREE.Mesh(shellGeo, concourseMat);
    shell.scale.set(1, 1, ratioZ);
    shell.position.set(0, shellH * 0.5 - 2.2, centerZ);
    disposables.geometries.push(shellGeo);
    group.add(shell);
  }

  const vomCount = 16;
  const vomFrameGeo = new THREE.BoxGeometry(2.8, 2.7, 1.7);
  const vomGlowGeo = new THREE.BoxGeometry(2.1, 2.1, 0.35);
  const vomMat = new THREE.MeshStandardMaterial({ color: 0x050811, roughness: 0.8 });
  const vomGlowMat = new THREE.MeshBasicMaterial({ color: 0xfde68a });
  const exitStripGeo = new THREE.BoxGeometry(1.5, 0.18, 0.25);
  const exitStripMat = new THREE.MeshBasicMaterial({ color: 0x34d399 });
  disposables.geometries.push(vomFrameGeo, vomGlowGeo, exitStripGeo);
  disposables.materials.push(vomMat, vomGlowMat, exitStripMat);

  const voms = new THREE.InstancedMesh(vomFrameGeo, vomMat, vomCount);
  const vomGlows = new THREE.InstancedMesh(vomGlowGeo, vomGlowMat, vomCount);
  const vomExits = new THREE.InstancedMesh(exitStripGeo, exitStripMat, vomCount);
  for (let v = 0; v < vomCount; v += 1) {
    const ang = (v / vomCount) * Math.PI * 2;
    const vx = Math.cos(ang) * (radiusX + 2.3);
    const vz = centerZ + Math.sin(ang) * (radiusX + 2.3) * ratioZ;
    const rotY = -ang + Math.PI * 0.5;
    _bowlDummy.position.set(vx, 1.95, vz);
    _bowlDummy.rotation.set(0, rotY, 0);
    _bowlDummy.scale.set(1, 1, 1);
    _bowlDummy.updateMatrix();
    voms.setMatrixAt(v, _bowlDummy.matrix);

    const gx = Math.cos(ang) * (radiusX + 2.95);
    const gz = centerZ + Math.sin(ang) * (radiusX + 2.95) * ratioZ;
    _bowlDummy.position.set(gx, 1.95, gz);
    _bowlDummy.updateMatrix();
    vomGlows.setMatrixAt(v, _bowlDummy.matrix);

    const ex = Math.cos(ang) * (radiusX + 1.55);
    const ez = centerZ + Math.sin(ang) * (radiusX + 1.55) * ratioZ;
    _bowlDummy.position.set(ex, 3.12, ez);
    _bowlDummy.updateMatrix();
    vomExits.setMatrixAt(v, _bowlDummy.matrix);
  }
  voms.instanceMatrix.needsUpdate = true;
  vomGlows.instanceMatrix.needsUpdate = true;
  vomExits.instanceMatrix.needsUpdate = true;
  group.add(voms, vomGlows, vomExits);

  // 5. Overhead Perimeter Catwalk Truss Ring + Suspended Delay Speaker Clusters + Vent Ducts (kept clear of center oculus)
  const topBowlY = 1.6 + tiers * 4.4;
  if (perimeterCatwalk) {
    const catwalkR = radiusX + tiers * 4.1;
    const catwalkGeo = new THREE.TorusGeometry(catwalkR, 0.52, 6, 56);
    catwalkGeo.rotateX(Math.PI * 0.5);
    const catwalkMesh = new THREE.Mesh(catwalkGeo, railSteelMat);
    catwalkMesh.scale.set(1, 1, ratioZ);
    catwalkMesh.position.set(0, topBowlY + 3.2, centerZ);
    disposables.geometries.push(catwalkGeo);
    group.add(catwalkMesh);

    // 8 Suspended Delay Speaker & Floodlight Clusters hanging around upper bowl rim
    const delayCount = 8;
    const delayGeo = new THREE.BoxGeometry(1.9, 2.4, 1.2);
    const delayMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.55, metalness: 0.65 });
    const delayFaceGeo = new THREE.BoxGeometry(1.6, 1.9, 0.14);
    disposables.geometries.push(delayGeo, delayFaceGeo);
    disposables.materials.push(delayMat);
    const delayBoxes = new THREE.InstancedMesh(delayGeo, delayMat, delayCount);
    const delayFaces = new THREE.InstancedMesh(delayFaceGeo, ribbonMat, delayCount);
    for (let d = 0; d < delayCount; d += 1) {
      const ang = (d / delayCount) * Math.PI * 2 + 0.25;
      const dx = Math.cos(ang) * (catwalkR - 2.6);
      const dz = centerZ + Math.sin(ang) * (catwalkR - 2.6) * ratioZ;
      _bowlDummy.position.set(dx, topBowlY + 1.8, dz);
      _bowlDummy.rotation.set(0.28, -ang + Math.PI * 0.5, 0);
      _bowlDummy.scale.set(1, 1, 1);
      _bowlDummy.updateMatrix();
      delayBoxes.setMatrixAt(d, _bowlDummy.matrix);
      _bowlDummy.position.set(dx - Math.cos(ang) * 0.62, topBowlY + 1.75, dz - Math.sin(ang) * 0.62);
      _bowlDummy.updateMatrix();
      delayFaces.setMatrixAt(d, _bowlDummy.matrix);
    }
    delayBoxes.instanceMatrix.needsUpdate = true;
    delayFaces.instanceMatrix.needsUpdate = true;
    group.add(delayBoxes, delayFaces);
  }

  // 6. 8 Stadium Perimeter Floodlight Towers (outside exterior wall, ~42u tall)
  if (floodlightTowers) {
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.42, metalness: 0.85 });
    const bulbBankMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
    disposables.materials.push(steelMat, bulbBankMat);
    const towerPoleGeo = new THREE.CylinderGeometry(0.48, 0.82, 42, 8);
    const towerHeadGeo = new THREE.BoxGeometry(6.8, 3.1, 1.15);
    const bankGeo = new THREE.PlaneGeometry(6.0, 2.5);
    disposables.geometries.push(towerPoleGeo, towerHeadGeo, bankGeo);

    for (let f = 0; f < 8; f += 1) {
      const ang = (f / 8) * Math.PI * 2 + 0.22;
      const fx = Math.cos(ang) * (outerShellR + 5.8);
      const fz = centerZ + Math.sin(ang) * (outerShellR + 5.8) * ratioZ;
      const tower = new THREE.Group();
      tower.position.set(fx, -2.2, fz);
      tower.lookAt(0, 14, centerZ);

      const pole = new THREE.Mesh(towerPoleGeo, steelMat);
      pole.position.y = 21;
      const head = new THREE.Mesh(towerHeadGeo, steelMat);
      head.position.set(0, 42.2, 0.45);
      head.rotation.x = 0.44;
      const bank = new THREE.Mesh(bankGeo, bulbBankMat);
      bank.position.set(0, 42.0, 1.08);
      bank.rotation.x = 0.44;
      tower.add(pole, head, bank);
      group.add(tower);
    }
  }

  // 7. 1,620–2,160 Instanced Bowl Spectators (torso/heads) + Animated Glowing Lightsticks/Wristbands
  const perTierCount = 540;
  const count = tiers * perTierCount;
  const specGeo = new THREE.BoxGeometry(0.46, 0.72, 0.34);
  const specMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78, metalness: 0.08 });
  const dotGeo = new THREE.SphereGeometry(0.165, 6, 6);
  const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  disposables.geometries.push(specGeo, dotGeo);
  disposables.materials.push(specMat, dotMat);

  const bowlSpectators = new THREE.InstancedMesh(specGeo, specMat, count);
  const bowlLights = new THREE.InstancedMesh(dotGeo, dotMat, count);
  bowlSpectators.frustumCulled = false;
  bowlLights.frustumCulled = false;

  const bowlMeta = [];
  const seatPalette = [0x1d4ed8, 0xbe123c, 0x0f766e, 0x6d28d9, 0x334155, 0xd97706, 0x475569, 0x0284c7];

  for (let i = 0; i < count; i += 1) {
    const tierIdx = i % tiers;
    const slotInTier = Math.floor(i / tiers);
    const subRow = slotInTier % 3;
    const angSlot = Math.floor(slotInTier / 3);
    const colsPerRow = Math.max(1, Math.floor(perTierCount / 3));
    const ang = (angSlot / colsPerRow) * Math.PI * 2 + tierIdx * 0.11 + subRow * 0.017;
    const r = radiusX + tierIdx * 5.4 + 0.8 + subRow * 1.52;
    const x = Math.cos(ang) * r;
    const z = centerZ + Math.sin(ang) * r * ratioZ;
    const baseY = 1.15 + tierIdx * 4.4 + subRow * 1.25;
    const baseHex = lightstickPalette[i % lightstickPalette.length];

    bowlMeta.push({
      x,
      y: baseY,
      z,
      ang,
      tierIdx,
      baseHex,
      phase: (i * 0.37) % (Math.PI * 2),
      scale: 0.86 + (i % 4) * 0.11,
    });

    _bowlDummy.position.set(x, baseY, z);
    _bowlDummy.rotation.set(0, -ang + Math.PI * 0.5, 0);
    _bowlDummy.scale.setScalar(1);
    _bowlDummy.updateMatrix();
    bowlSpectators.setMatrixAt(i, _bowlDummy.matrix);
    _bowlColor.setHex(seatPalette[i % seatPalette.length]);
    bowlSpectators.setColorAt(i, _bowlColor);

    _bowlDummy.position.set(x, baseY + 0.74, z);
    _bowlDummy.scale.setScalar(bowlMeta[i].scale);
    _bowlDummy.updateMatrix();
    bowlLights.setMatrixAt(i, _bowlDummy.matrix);
    _bowlColor.setHex(baseHex);
    bowlLights.setColorAt(i, _bowlColor);
  }
  bowlSpectators.instanceMatrix.needsUpdate = true;
  if (bowlSpectators.instanceColor) bowlSpectators.instanceColor.needsUpdate = true;
  bowlLights.instanceMatrix.needsUpdate = true;
  if (bowlLights.instanceColor) bowlLights.instanceColor.needsUpdate = true;
  group.add(bowlSpectators, bowlLights);

  if (dynamicElements) {
    _bowlChorusAltColor.setHex(secondaryColor);
    dynamicElements.updateBowl = (
      t,
      waveFrontX = -999,
      waveActive = false,
      balladActive = false,
      beatPhase = 0,
      barPhase = 0,
      isChorusOrFever = false,
      lightstickBoost = 1.0,
      isPhoneLights = false
    ) => {
      const beatPulse = Math.pow(Math.max(0, 1 - beatPhase * 1.9), 1.6);
      const chorusPulse = isChorusOrFever ? 0.25 + beatPulse * 0.42 : beatPulse * 0.18;
      const barSweptAng = barPhase * Math.PI * 2;

      for (let i = 0; i < count; i += 1) {
        const m = bowlMeta[i];
        const tierShimmer = 0.92 + 0.14 * Math.sin(t * 3.2 + m.phase + m.tierIdx * 0.9);
        let lift = Math.sin(t * 2.8 + m.phase) * 0.09 + chorusPulse * 0.36;
        let sc = m.scale * tierShimmer * (0.94 + chorusPulse * 0.28) * Math.min(1.55, Math.max(0.75, lightstickBoost));

        if (waveActive) {
          const wavePulse = Math.exp(-Math.pow((m.x - waveFrontX) / 5.4, 2));
          lift += wavePulse * 1.55;
          _bowlColor.setHex(m.baseHex).lerp(_bowlWaveColor, Math.min(1, wavePulse * 1.3));
          sc *= 1 + wavePulse * 0.85;
        } else if (isPhoneLights || balladActive) {
          lift = Math.sin(t * 2.1 + m.ang) * 0.22;
          _bowlColor.copy(_bowlPhoneColor);
          const twinkle = isPhoneLights ? 1.32 + Math.sin(t * 4.2 + m.phase * 2.1) * 0.2 : 1.2 + Math.sin(t * 3.1 + m.phase) * 0.14;
          sc = m.scale * twinkle * Math.min(1.25, Math.max(0.95, lightstickBoost));
        } else if (isChorusOrFever) {
          const sweepMix = 0.5 + 0.5 * Math.sin(m.ang * 2.0 - barSweptAng);
          _bowlColor.setHex(m.baseHex).lerp(_bowlChorusAltColor, sweepMix * 0.55);
        } else {
          _bowlColor.setHex(m.baseHex);
        }

        _bowlDummy.position.set(m.x, m.y + 0.74 + lift, m.z);
        _bowlDummy.rotation.set(0, 0, 0);
        _bowlDummy.scale.setScalar(sc);
        _bowlDummy.updateMatrix();
        bowlLights.setMatrixAt(i, _bowlDummy.matrix);
        bowlLights.setColorAt(i, _bowlColor);
      }
      bowlLights.instanceMatrix.needsUpdate = true;
      if (bowlLights.instanceColor) bowlLights.instanceColor.needsUpdate = true;
    };
  }

  return bowlLights;
}

export function getVenueStageTheme(venueId, overlayId = 'STANDARD') {
  const venueMeta = getVenueById(venueId);
  const overlayMeta = getStageOverlayById(overlayId);
  const venueAccent = venueMeta?.accentHex ?? 0x38bdf8;
  const venueLasers = venueMeta?.laserColors || [0x38bdf8, 0xfacc15, 0xf43f5e];
  const toCss = (hex) => `#${(hex >>> 0).toString(16).padStart(6, '0')}`;

  const overlayThemes = {
    CHRISTMAS: {
      motif: 'CHRISTMAS',
      trussAccentHex: 0xfacc15,
      trussSecondaryHex: 0xdc2626,
      scrimBgCss: '#14261c',
      scrimBorderCss: '#facc15',
      scrimTitle: 'WINTER WONDER',
      scrimSubtitle: 'HOLIDAY WORLD TOUR',
      ledPrimaryCss: '#22c55e',
      ledSecondaryCss: '#ef4444',
      ledGoldCss: '#facc15',
    },
    HALLOWEEN: {
      motif: 'HALLOWEEN',
      trussAccentHex: 0xf97316,
      trussSecondaryHex: 0x9333ea,
      scrimBgCss: '#160b24',
      scrimBorderCss: '#f97316',
      scrimTitle: 'MIDNIGHT ROCK',
      scrimSubtitle: 'PHANTOM ENCORE',
      ledPrimaryCss: '#f97316',
      ledSecondaryCss: '#a855f7',
      ledGoldCss: '#4ade80',
    },
    SAKURA: {
      motif: 'SAKURA',
      trussAccentHex: 0xf9a8d4,
      trussSecondaryHex: 0xdc2626,
      scrimBgCss: '#220b1a',
      scrimBorderCss: '#f9a8d4',
      scrimTitle: 'SAKURA BLOOM',
      scrimSubtitle: 'SPRING FESTIVAL LIVE',
      ledPrimaryCss: '#f472b6',
      ledSecondaryCss: '#fde047',
      ledGoldCss: '#fbcfe8',
    },
    CYBER_NEON: {
      motif: 'CYBER_NEON',
      trussAccentHex: 0x22d3ee,
      trussSecondaryHex: 0xec4899,
      scrimBgCss: '#070b24',
      scrimBorderCss: '#22d3ee',
      scrimTitle: 'NEO OVERDRIVE',
      scrimSubtitle: 'CYBER ARENA 2099',
      ledPrimaryCss: '#22d3ee',
      ledSecondaryCss: '#ec4899',
      ledGoldCss: '#a855f7',
    },
    ROYAL_OPERA: {
      motif: 'ROYAL_OPERA',
      trussAccentHex: 0xfacc15,
      trussSecondaryHex: 0x9f1239,
      scrimBgCss: '#240712',
      scrimBorderCss: '#facc15',
      scrimTitle: 'ROYAL GALA',
      scrimSubtitle: 'SYMPHONIC ENCORE',
      ledPrimaryCss: '#facc15',
      ledSecondaryCss: '#e11d48',
      ledGoldCss: '#fef08a',
    },
    TROPICAL_SUMMER: {
      motif: 'TROPICAL_SUMMER',
      trussAccentHex: 0xfb923c,
      trussSecondaryHex: 0x14b8a6,
      scrimBgCss: '#092327',
      scrimBorderCss: '#fb923c',
      scrimTitle: 'SUMMER FEST',
      scrimSubtitle: 'SUNSET BEACH LIVE',
      ledPrimaryCss: '#fb923c',
      ledSecondaryCss: '#2dd4bf',
      ledGoldCss: '#facc15',
    },
    FIESTA_PINOY: {
      motif: 'FIESTA_PINOY',
      trussAccentHex: 0xfacc15,
      trussSecondaryHex: 0xec4899,
      scrimBgCss: '#1e1030',
      scrimBorderCss: '#facc15',
      scrimTitle: 'FIESTA LIVE!',
      scrimSubtitle: 'MABUHAY WORLD TOUR',
      ledPrimaryCss: '#facc15',
      ledSecondaryCss: '#ec4899',
      ledGoldCss: '#38bdf8',
    },
    APOCALYPSE_HELLFIRE: {
      motif: 'APOCALYPSE_HELLFIRE',
      trussAccentHex: 0xef4444,
      trussSecondaryHex: 0xf97316,
      scrimBgCss: '#1b0707',
      scrimBorderCss: '#ef4444',
      scrimTitle: 'INFERNO TOUR',
      scrimSubtitle: 'HELLFIRE STADIUM',
      ledPrimaryCss: '#ef4444',
      ledSecondaryCss: '#f97316',
      ledGoldCss: '#fde047',
    },
  };

  if (overlayMeta.id !== 'STANDARD' && overlayThemes[overlayMeta.id]) {
    return {
      ...overlayThemes[overlayMeta.id],
      venueName: venueMeta?.name || 'WORLD TOUR ARENA',
      venueLocation: venueMeta?.location || 'GLOBAL',
      overlayId: overlayMeta.id,
    };
  }

  return {
    motif: 'STANDARD',
    trussAccentHex: venueAccent,
    trussSecondaryHex: venueLasers[1] ?? 0xfacc15,
    scrimBgCss: '#0b1020',
    scrimBorderCss: toCss(venueAccent),
    scrimTitle: (venueMeta?.name || 'STAGE HERO').toUpperCase().slice(0, 16),
    scrimSubtitle: (venueMeta?.location || 'WORLD TOUR LIVE').toUpperCase(),
    ledPrimaryCss: toCss(venueLasers[0] ?? venueAccent),
    ledSecondaryCss: toCss(venueLasers[1] ?? 0xfacc15),
    ledGoldCss: toCss(venueLasers[2] ?? 0xf43f5e),
    venueName: venueMeta?.name || 'WORLD TOUR ARENA',
    venueLocation: venueMeta?.location || 'GLOBAL',
    overlayId: 'STANDARD',
  };
}

/**
 * Composable Stage Theme / Event Overlay layered cleanly onto perimeter trusses,
 * outer PA wings (|x| > 21.5), 15.5m roof truss arches, and stadium sky/air of ANY real-life stadium.
 */
function attachStageOverlay(group, disposables, overlayId, dynamicElements) {
  const overlayMeta = getStageOverlayById(overlayId);
  const trackGeo = (g) => { disposables.geometries.push(g); return g; };
  const trackMat = (m) => { disposables.materials.push(m); return m; };

  if (overlayMeta.id === 'STANDARD') {
    return null;
  }

  switch (overlayMeta.id) {
    case 'CHRISTMAS': {
      const snowMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.78, metalness: 0.08 }));
      const pineMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x0f5132, roughness: 0.8, metalness: 0.06 }));
      const trunkMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 }));
      const goldGlow = trackMat(new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xfacc15,
        emissiveIntensity: 2.0,
        roughness: 0.18,
      }));
      dynamicElements.pulseMaterials.push(goldGlow);

      // Giant illuminated 3D Christmas Tree soaring behind the rear stage wall (z = -15.6)
      const treeGroup = new THREE.Group();
      treeGroup.position.set(0, -2.2, -15.6);
      const trunk = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.75, 1.1, 3.6, 10)), trunkMat);
      trunk.position.y = 1.8;
      treeGroup.add(trunk);

      const tiers = [
        { y: 5.2, r: 5.2, h: 4.8 },
        { y: 8.4, r: 4.1, h: 4.2 },
        { y: 11.2, r: 3.1, h: 3.7 },
        { y: 13.7, r: 2.1, h: 3.2 },
        { y: 15.8, r: 1.2, h: 2.5 },
      ];
      tiers.forEach((t) => {
        const cone = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(t.r, t.h, 14)), pineMat);
        cone.position.y = t.y;
        const snowTrim = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(t.r * 0.92, 0.13, 6, 20)), snowMat);
        snowTrim.rotation.x = Math.PI * 0.5;
        snowTrim.position.y = t.y - t.h * 0.44;
        treeGroup.add(cone, snowTrim);
      });

      const starTop = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(0.95, 0)), goldGlow);
      starTop.position.set(0, 17.6, 0);
      treeGroup.add(starTop);
      dynamicElements.rotatingRings.push(starTop);

      const ornColors = [0xef4444, 0xfacc15, 0x38bdf8, 0xf472b6, 0x4ade80];
      const ornCount = 72;
      const ornGeo = trackGeo(new THREE.SphereGeometry(0.21, 8, 8));
      const ornMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xffffff }));
      const ornaments = new THREE.InstancedMesh(ornGeo, ornMat, ornCount);
      const ornDummy = new THREE.Object3D();
      const ornCol = new THREE.Color();
      for (let i = 0; i < ornCount; i += 1) {
        const frac = i / ornCount;
        const y = 3.6 + frac * 12.2;
        const radius = (1 - frac * 0.84) * 4.85;
        const ang = frac * Math.PI * 14;
        ornDummy.position.set(Math.cos(ang) * radius, y, Math.sin(ang) * radius);
        ornDummy.updateMatrix();
        ornaments.setMatrixAt(i, ornDummy.matrix);
        ornCol.setHex(ornColors[i % ornColors.length]);
        ornaments.setColorAt(i, ornCol);
      }
      ornaments.instanceMatrix.needsUpdate = true;
      if (ornaments.instanceColor) ornaments.instanceColor.needsUpdate = true;
      treeGroup.add(ornaments);
      group.add(treeGroup);

      const candyTex = createCandyCaneTexture();
      disposables.textures.push(candyTex);
      const candyMat = trackMat(new THREE.MeshStandardMaterial({ map: candyTex, roughness: 0.35, metalness: 0.12 }));
      [-21.8, 21.8].forEach((px) => {
        const pillar = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.48, 0.56, 15.2, 14)), candyMat);
        pillar.position.set(px, 5.4, -4.6);
        const cap = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.68, 12, 10)), goldGlow);
        cap.position.set(px, 13.2, -4.6);
        group.add(pillar, cap);
      });

      [
        { x: -22.2, z: 1.2, w: 1.9, h: 1.65, d: 1.8, col: 0xdc2626, rib: 0xfacc15, ry: 0.25 },
        { x: -21.5, z: -2.2, w: 1.35, h: 1.25, d: 1.35, col: 0x0284c7, rib: 0xf8fafc, ry: -0.35 },
        { x: 22.2, z: 1.2, w: 1.9, h: 1.65, d: 1.8, col: 0x16a34a, rib: 0xfacc15, ry: -0.22 },
        { x: 21.5, z: -2.2, w: 1.35, h: 1.35, d: 1.35, col: 0xec4899, rib: 0xfef08a, ry: 0.4 },
      ].forEach((gs) => {
        const boxGroup = new THREE.Group();
        const bMat = trackMat(new THREE.MeshStandardMaterial({ color: gs.col, roughness: 0.36, metalness: 0.16 }));
        const rMat = trackMat(new THREE.MeshStandardMaterial({ color: gs.rib, roughness: 0.26, metalness: 0.65 }));
        const box = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(gs.w, gs.h, gs.d)), bMat);
        box.position.y = gs.h * 0.5;
        const rib1 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(gs.w + 0.04, gs.h + 0.04, 0.22)), rMat);
        rib1.position.y = gs.h * 0.5;
        const rib2 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.22, gs.h + 0.04, gs.d + 0.04)), rMat);
        rib2.position.y = gs.h * 0.5;
        boxGroup.add(box, rib1, rib2);
        boxGroup.position.set(gs.x, -2.2, gs.z);
        boxGroup.rotation.y = gs.ry;
        group.add(boxGroup);
      });

      const snowCount = 240;
      const flakeGeo = trackGeo(new THREE.OctahedronGeometry(0.1, 0));
      const flakeMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.88 }));
      const snowMesh = new THREE.InstancedMesh(flakeGeo, flakeMat, snowCount);
      snowMesh.frustumCulled = false;
      const flakes = Array.from({ length: snowCount }, () => ({
        x: (Math.random() - 0.5) * 56,
        y: Math.random() * 24 - 1.5,
        z: (Math.random() - 0.5) * 46,
        vy: 1.25 + Math.random() * 1.5,
        phase: Math.random() * Math.PI * 2,
        scale: 0.7 + Math.random() * 0.9,
      }));
      group.add(snowMesh);

      const snowDummy = new THREE.Object3D();
      return (dt, t) => {
        for (let i = 0; i < snowCount; i += 1) {
          const f = flakes[i];
          f.y -= f.vy * dt;
          if (f.y < -2.2) f.y = 22.5;
          snowDummy.position.set(f.x + Math.sin(t * 0.9 + f.phase) * 0.7, f.y, f.z);
          snowDummy.rotation.set(t + f.phase, t * 0.7, 0);
          snowDummy.scale.setScalar(f.scale);
          snowDummy.updateMatrix();
          snowMesh.setMatrixAt(i, snowDummy.matrix);
        }
        snowMesh.instanceMatrix.needsUpdate = true;
      };
    }

    case 'HALLOWEEN': {
      const stoneTex = createStoneTexture();
      disposables.textures.push(stoneTex);
      const gothicMat = trackMat(new THREE.MeshStandardMaterial({
        map: stoneTex,
        color: 0x524663,
        roughness: 0.88,
        metalness: 0.14,
      }));
      const ironMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.4, metalness: 0.85 }));
      const toxicMat = trackMat(new THREE.MeshStandardMaterial({
        color: 0x4ade80,
        emissive: 0x22c55e,
        emissiveIntensity: 1.5,
        roughness: 0.2,
      }));
      const pumpkinGlowMat = trackMat(new THREE.MeshStandardMaterial({
        color: 0xf97316,
        emissive: 0xff6b00,
        emissiveIntensity: 1.85,
        roughness: 0.45,
      }));
      dynamicElements.pulseMaterials.push(toxicMat, pumpkinGlowMat);

      const moonMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xfef3c7, fog: false }));
      const moon = new THREE.Mesh(trackGeo(new THREE.CircleGeometry(22, 32)), moonMat);
      moon.position.set(-64, 118, -280);
      group.add(moon);

      [-22.0, 22.0].forEach((ax) => {
        const col = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.9, 14.8, 1.9)), gothicMat);
        col.position.set(ax, 5.2, -5.2);
        const spire = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(1.5, 5.4, 4)), ironMat);
        spire.position.set(ax, 15.1, -5.2);
        spire.rotation.y = Math.PI * 0.25;
        group.add(col, spire);
      });

      const stemMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.8 }));
      const eyeMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xfef08a }));
      [
        { x: -17.6, y: -1.65, z: 6.4 },
        { x: -5.2, y: -1.65, z: 14.2 },
        { x: 5.2, y: -1.65, z: 14.2 },
        { x: 17.6, y: -1.65, z: 6.4 },
      ].forEach((ps) => {
        const pGroup = new THREE.Group();
        const body = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.55, 10, 8)), pumpkinGlowMat);
        body.scale.set(1.18, 0.88, 1.05);
        const stem = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.06, 0.1, 0.25, 6)), stemMat);
        stem.position.y = 0.52;
        const eyeL = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.11, 0.18, 3)), eyeMat);
        eyeL.position.set(-0.19, 0.12, 0.53);
        const eyeR = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.11, 0.18, 3)), eyeMat);
        eyeR.position.set(0.19, 0.12, 0.53);
        pGroup.add(body, stem, eyeL, eyeR);
        pGroup.position.set(ps.x, ps.y, ps.z);
        group.add(pGroup);
      });

      [-22.2, 22.2].forEach((cx) => {
        const pool = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(1.5, 1.75, 0.35, 16)), toxicMat);
        pool.position.set(cx, -2.02, -0.4);
        group.add(pool);
      });

      const candleCount = 30;
      const candleBodyGeo = trackGeo(new THREE.CylinderGeometry(0.09, 0.1, 0.62, 8));
      const candleBodyMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.6 }));
      const flameGeo = trackGeo(new THREE.ConeGeometry(0.08, 0.24, 6));
      const flameMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
      const candleMesh = new THREE.InstancedMesh(candleBodyGeo, candleBodyMat, candleCount);
      const flameMesh = new THREE.InstancedMesh(flameGeo, flameMat, candleCount);
      const candles = Array.from({ length: candleCount }, () => ({
        x: (Math.random() - 0.5) * 34,
        baseY: 4.5 + Math.random() * 8.2,
        z: -8.5 + Math.random() * 14,
        phase: Math.random() * Math.PI * 2,
        speed: 0.8 + Math.random() * 0.8,
      }));
      group.add(candleMesh, flameMesh);
      const cDummy = new THREE.Object3D();
      return (dt, t) => {
        for (let i = 0; i < candleCount; i += 1) {
          const c = candles[i];
          const y = c.baseY + Math.sin(t * c.speed + c.phase) * 0.48;
          cDummy.position.set(c.x, y, c.z);
          cDummy.rotation.set(0, 0, Math.sin(t * 0.6 + c.phase) * 0.06);
          cDummy.scale.setScalar(1);
          cDummy.updateMatrix();
          candleMesh.setMatrixAt(i, cDummy.matrix);
          cDummy.position.set(c.x, y + 0.42, c.z);
          cDummy.scale.set(1, 0.85 + Math.sin(t * 14 + c.phase) * 0.22, 1);
          cDummy.updateMatrix();
          flameMesh.setMatrixAt(i, cDummy.matrix);
        }
        candleMesh.instanceMatrix.needsUpdate = true;
        flameMesh.instanceMatrix.needsUpdate = true;
      };
    }

    case 'SAKURA': {
      const toriiRed = trackMat(new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35, metalness: 0.14 }));
      const toriiCap = trackMat(new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.45, metalness: 0.25 }));
      const barkMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x3b2319, roughness: 0.9 }));
      const blossomMat = trackMat(new THREE.MeshStandardMaterial({
        color: 0xf9a8d4,
        emissive: 0xbe185d,
        emissiveIntensity: 0.34,
        roughness: 0.68,
      }));
      const lanternMat = trackMat(new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xf59e0b,
        emissiveIntensity: 1.75,
        roughness: 0.3,
      }));
      dynamicElements.pulseMaterials.push(lanternMat);

      [-22.2, 22.2].forEach((tx) => {
        const torii = new THREE.Group();
        torii.position.set(tx, -2.2, -3.2);
        torii.rotation.y = tx < 0 ? 0.34 : -0.34;
        [-2.2, 2.2].forEach((px) => {
          const p = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.28, 0.34, 9.2, 10)), toriiRed);
          p.position.set(px, 4.6, 0);
          torii.add(p);
        });
        const lBeam = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.2, 0.38, 0.44)), toriiRed);
        lBeam.position.set(0, 7.4, 0);
        const tBeam = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(7.2, 0.52, 0.64)), toriiCap);
        tBeam.position.set(0, 9.0, 0);
        torii.add(lBeam, tBeam);
        group.add(torii);

        const trunk = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.35, 0.52, 6.2, 8)), barkMat);
        trunk.position.set(tx * 1.04, 0.9, 3.0);
        const crown = new THREE.Mesh(trackGeo(new THREE.DodecahedronGeometry(3.2, 1)), blossomMat);
        crown.scale.set(1.25, 0.78, 1.25);
        crown.position.set(tx * 1.04, 4.9, 3.0);
        group.add(trunk, crown);
      });

      // Cherry-blossom garland wraps spiraling cleanly up the front 15.5m truss pillars (x = ±16.2, z = 4.8)
      [-16.2, 16.2].forEach((tx) => {
        for (let b = 0; b < 7; b += 1) {
          const ang = b * 1.1;
          const bCluster = new THREE.Mesh(trackGeo(new THREE.DodecahedronGeometry(0.62, 0)), blossomMat);
          bCluster.position.set(tx + Math.cos(ang) * 0.58, 2.0 + b * 1.85, 4.8 + Math.sin(ang) * 0.58);
          group.add(bCluster);
        }
      });

      [-14, -9.5, -4.8, 0, 4.8, 9.5, 14].forEach((lx) => {
        const lant = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.46, 10, 10)), lanternMat);
        lant.scale.set(0.88, 1.24, 0.88);
        lant.position.set(lx, 14.3, 4.7);
        group.add(lant);
      });

      const petalCount = 210;
      const petalGeo = trackGeo(new THREE.PlaneGeometry(0.2, 0.14));
      const petalMat = trackMat(new THREE.MeshBasicMaterial({
        color: 0xfbcfe8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
      }));
      const petalMesh = new THREE.InstancedMesh(petalGeo, petalMat, petalCount);
      petalMesh.frustumCulled = false;
      const petals = Array.from({ length: petalCount }, () => ({
        x: (Math.random() - 0.5) * 48,
        y: Math.random() * 19 - 1.0,
        z: (Math.random() - 0.5) * 38,
        vy: 0.7 + Math.random() * 0.9,
        vx: 0.6 + Math.random() * 0.65,
        phase: Math.random() * Math.PI * 2,
      }));
      group.add(petalMesh);
      const pDummy = new THREE.Object3D();
      return (dt, t) => {
        for (let i = 0; i < petalCount; i += 1) {
          const p = petals[i];
          p.y -= p.vy * dt;
          p.x += p.vx * dt;
          if (p.y < -2.1 || p.x > 25) {
            p.y = 18.2;
            p.x = -24 + Math.random() * 34;
          }
          pDummy.position.set(p.x, p.y, p.z + Math.sin(t * 1.4 + p.phase) * 0.55);
          pDummy.rotation.set(t * 1.8 + p.phase, t * 2.2, t + p.phase);
          pDummy.scale.setScalar(1);
          pDummy.updateMatrix();
          petalMesh.setMatrixAt(i, pDummy.matrix);
        }
        petalMesh.instanceMatrix.needsUpdate = true;
      };
    }

    case 'CYBER_NEON': {
      const gridTex = createNeonGridTexture();
      disposables.textures.push(gridTex);
      const gridRingMat = trackMat(new THREE.MeshBasicMaterial({
        map: gridTex,
        transparent: true,
        opacity: 0.52,
      }));
      const gridRing = new THREE.Mesh(trackGeo(new THREE.RingGeometry(19, 39, 48)), gridRingMat);
      gridRing.rotation.x = -Math.PI * 0.5;
      gridRing.position.set(0, -2.16, 4.5);
      group.add(gridRing);

      const kanjiTexL = createKanjiBillboardTexture('東京音楽', 'CYBER LIVE', '#22d3ee', '#070b24');
      const kanjiTexR = createKanjiBillboardTexture('電脳舞台', 'ENCORE 2099', '#ec4899', '#1d0624');
      disposables.textures.push(kanjiTexL, kanjiTexR);
      const billMatL = trackMat(new THREE.MeshBasicMaterial({ map: kanjiTexL, transparent: true, opacity: 0.94, side: THREE.DoubleSide }));
      const billMatR = trackMat(new THREE.MeshBasicMaterial({ map: kanjiTexR, transparent: true, opacity: 0.94, side: THREE.DoubleSide }));

      const billL = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(4.6, 9.8)), billMatL);
      billL.position.set(-22.2, 5.6, -3.2);
      billL.rotation.y = 0.34;
      const billR = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(4.6, 9.8)), billMatR);
      billR.position.set(22.2, 5.6, -3.2);
      billR.rotation.y = -0.34;
      group.add(billL, billR);

      const rainCount = 190;
      const rainGeo = trackGeo(new THREE.BoxGeometry(0.05, 0.65, 0.05));
      const rainMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.72 }));
      const rainMesh = new THREE.InstancedMesh(rainGeo, rainMat, rainCount);
      rainMesh.frustumCulled = false;
      const rainDrops = Array.from({ length: rainCount }, (_, i) => ({
        x: (Math.random() - 0.5) * 48,
        y: Math.random() * 22,
        z: (Math.random() - 0.5) * 38,
        vy: 10 + Math.random() * 8,
        hex: i % 2 === 0 ? 0x22d3ee : 0xec4899,
      }));
      const rainCol = new THREE.Color();
      rainDrops.forEach((d, i) => {
        rainCol.setHex(d.hex);
        rainMesh.setColorAt(i, rainCol);
      });
      if (rainMesh.instanceColor) rainMesh.instanceColor.needsUpdate = true;
      group.add(rainMesh);
      const rDummy = new THREE.Object3D();
      return (dt) => {
        for (let i = 0; i < rainCount; i += 1) {
          const d = rainDrops[i];
          d.y -= d.vy * dt;
          if (d.y < -2.2) d.y = 20.5;
          rDummy.position.set(d.x, d.y, d.z);
          rDummy.updateMatrix();
          rainMesh.setMatrixAt(i, rDummy.matrix);
        }
        rainMesh.instanceMatrix.needsUpdate = true;
      };
    }

    case 'ROYAL_OPERA': {
      const velvetMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x881337, roughness: 0.85, metalness: 0.08 }));
      const marbleMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.28, metalness: 0.12 }));
      const goldMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.2, metalness: 0.9 }));
      const crystalGlow = trackMat(new THREE.MeshStandardMaterial({
        color: 0xfef9c3,
        emissive: 0xfde047,
        emissiveIntensity: 1.85,
        roughness: 0.15,
      }));
      dynamicElements.pulseMaterials.push(crystalGlow);

      [-1, 1].forEach((side) => {
        for (let f = 0; f < 3; f += 1) {
          const drape = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.72, 0.9, 15.2, 10)), velvetMat);
          drape.position.set(side * (20.8 + f * 0.95), 5.4, -4.2 + f * 0.45);
          group.add(drape);
        }
        const col = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.68, 0.78, 15.6, 14)), marbleMat);
        col.position.set(side * 22.0, 5.6, -5.6);
        const cap = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.85, 0.64, 1.85)), goldMat);
        cap.position.set(side * 22.0, 13.5, -5.6);
        group.add(col, cap);
      });

      // Ornate gilded crimson & gold proscenium arch crowning the 15.5m roof truss front span
      const archCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-16.6, 13.8, 4.9),
        new THREE.Vector3(-9.5, 15.9, 4.9),
        new THREE.Vector3(0, 16.8, 4.9),
        new THREE.Vector3(9.5, 15.9, 4.9),
        new THREE.Vector3(16.6, 13.8, 4.9),
      ]);
      const gildedArch = new THREE.Mesh(trackGeo(new THREE.TubeGeometry(archCurve, 28, 0.34, 8, false)), goldMat);
      const velvetValance = new THREE.Mesh(trackGeo(new THREE.TubeGeometry(archCurve, 28, 0.24, 8, false)), velvetMat);
      velvetValance.position.y = -0.42;
      group.add(gildedArch, velvetValance);

      [-13.5, 0, 13.5].forEach((chx, idx) => {
        const chand = new THREE.Group();
        chand.position.set(chx, idx === 1 ? 15.8 : 14.4, idx === 1 ? 2.2 : -0.4);
        const chain = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.06, 0.06, 3.8, 6)), goldMat);
        chain.position.y = 1.9;
        const ring1 = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(1.55, 0.1, 8, 22)), goldMat);
        ring1.rotation.x = Math.PI * 0.5;
        const ring2 = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.92, 0.08, 8, 18)), goldMat);
        ring2.rotation.x = Math.PI * 0.5;
        ring2.position.y = -0.7;
        const drop = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(0.38, 0)), crystalGlow);
        drop.position.y = -1.2;
        chand.add(chain, ring1, ring2, drop);
        group.add(chand);
        dynamicElements.rotatingRings.push(chand);
      });
      return null;
    }

    case 'TROPICAL_SUMMER': {
      const palmTrunkMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.88 }));
      const palmLeafMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.72, side: THREE.DoubleSide }));
      [
        { x: -22.0, z: -4.2, h: 13.4, lean: 0.18 },
        { x: -23.4, z: 2.6, h: 11.4, lean: 0.14 },
        { x: 22.0, z: -4.2, h: 13.6, lean: -0.18 },
        { x: 23.4, z: 2.6, h: 11.6, lean: -0.14 },
      ].forEach((p) => {
        const palm = new THREE.Group();
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(p.lean * 4, p.h * 0.55, 0),
          new THREE.Vector3(p.lean * 6, p.h, 0),
        ]);
        palm.add(new THREE.Mesh(trackGeo(new THREE.TubeGeometry(curve, 12, 0.3, 7, false)), palmTrunkMat));
        const top = curve.getPoint(1);
        for (let f = 0; f < 8; f += 1) {
          const a = (f / 8) * Math.PI * 2;
          const frond = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.75, 4.2, 4)), palmLeafMat);
          frond.scale.set(1, 1, 0.22);
          frond.position.set(top.x + Math.cos(a) * 1.55, top.y - 0.35, top.z + Math.sin(a) * 1.55);
          frond.rotation.z = -Math.cos(a) * 1.15;
          frond.rotation.x = Math.sin(a) * 1.15;
          palm.add(frond);
        }
        palm.position.set(p.x, -2.2, p.z);
        group.add(palm);
      });

      const bambooMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.82 }));
      const flameMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xfb923c }));
      const tikiFlames = [];
      [
        { x: -17.6, z: 6.2 },
        { x: -5.4, z: 12.6 },
        { x: 5.4, z: 12.6 },
        { x: 17.6, z: 6.2 },
      ].forEach((ts, idx) => {
        const post = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.09, 0.12, 3.6, 8)), bambooMat);
        post.position.set(ts.x, -0.4, ts.z);
        const flame = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.22, 0.68, 7)), flameMat);
        flame.position.set(ts.x, 1.72, ts.z);
        group.add(post, flame);
        tikiFlames.push({ mesh: flame, phase: idx * 1.7 });
      });

      return (_dt, t) => {
        for (let i = 0; i < tikiFlames.length; i += 1) {
          const tf = tikiFlames[i];
          const flick = 0.82 + Math.sin(t * 16 + tf.phase) * 0.24 + Math.cos(t * 23 + tf.phase) * 0.12;
          tf.mesh.scale.set(0.92 + Math.sin(t * 12 + tf.phase) * 0.12, flick, 0.92);
        }
      };
    }

    case 'FIESTA_PINOY': {
      const parolGold = trackMat(new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xfacc15,
        emissiveIntensity: 1.85,
        roughness: 0.22,
      }));
      const parolMagenta = trackMat(new THREE.MeshStandardMaterial({
        color: 0xf9a8d4,
        emissive: 0xec4899,
        emissiveIntensity: 1.7,
        roughness: 0.22,
      }));
      const parolCyan = trackMat(new THREE.MeshStandardMaterial({
        color: 0x7dd3fc,
        emissive: 0x06b6d4,
        emissiveIntensity: 1.65,
        roughness: 0.22,
      }));
      const capizRingMat = trackMat(new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        emissive: 0xfde047,
        emissiveIntensity: 0.55,
        roughness: 0.35,
      }));
      const bambooMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x713f12, roughness: 0.82 }));
      dynamicElements.pulseMaterials.push(parolGold, parolMagenta, parolCyan);

      const parols = [];
      const parolCoords = [
        { x: -21.8, y: 9.2, z: -2.0, s: 1.5, mat: parolGold },
        { x: -20.6, y: 5.6, z: 3.6, s: 1.1, mat: parolMagenta },
        { x: 21.8, y: 9.2, z: -2.0, s: 1.5, mat: parolGold },
        { x: 20.6, y: 5.6, z: 3.6, s: 1.1, mat: parolCyan },
        { x: -11.5, y: 14.5, z: 4.7, s: 1.0, mat: parolCyan },
        { x: 0.0, y: 15.0, z: 4.7, s: 1.32, mat: parolGold },
        { x: 11.5, y: 14.5, z: 4.7, s: 1.0, mat: parolMagenta },
      ];
      parolCoords.forEach((pc, idx) => {
        const starGroup = new THREE.Group();
        starGroup.position.set(pc.x, pc.y, pc.z);
        starGroup.scale.setScalar(pc.s);
        const outerRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(1.15, 0.07, 8, 28)), capizRingMat);
        starGroup.add(outerRing);
        for (let pt = 0; pt < 5; pt += 1) {
          const ang = (pt / 5) * Math.PI * 2 + Math.PI * 0.5;
          const cone = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.28, 1.05, 4)), pc.mat);
          cone.position.set(Math.cos(ang) * 0.58, Math.sin(ang) * 0.58, 0);
          cone.rotation.z = ang - Math.PI * 0.5;
          starGroup.add(cone);
        }
        const core = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(0.36, 0)), pc.mat);
        starGroup.add(core);
        [-0.28, 0.28].forEach((tx) => {
          const tassel = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.05, 0.09, 0.65, 6)), parolGold);
          tassel.position.set(tx, -1.42, 0);
          starGroup.add(tassel);
        });
        if (Math.abs(pc.x) > 19) {
          const post = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.16, 0.22, pc.y + 2.4, 8)), bambooMat);
          post.position.set(pc.x, (pc.y - 2.2) * 0.5, pc.z);
          group.add(post);
        }
        group.add(starGroup);
        parols.push({ group: starGroup, phase: idx * 0.9 });
      });

      const bandColors = [0xef4444, 0xfacc15, 0x3b82f6, 0x22c55e, 0xec4899, 0xf97316];
      const flagGeo = trackGeo(new THREE.ConeGeometry(0.28, 0.58, 3));
      const flagMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
      const rowCount = 4;
      const flagsPerRow = 30;
      const totalFlags = rowCount * flagsPerRow;
      const bandMesh = new THREE.InstancedMesh(flagGeo, flagMat, totalFlags);
      bandMesh.frustumCulled = false;
      const bDummy = new THREE.Object3D();
      const bCol = new THREE.Color();
      const flagMeta = [];
      let fi = 0;
      for (let r = 0; r < rowCount; r += 1) {
        const z = -2.2 + r * 4.8;
        for (let k = 0; k < flagsPerRow; k += 1) {
          const u = k / (flagsPerRow - 1);
          const x = -21.5 + u * 43;
          const sag = Math.sin(u * Math.PI) * 1.55;
          const y = 15.1 - sag;
          flagMeta.push({ x, y, z, phase: k * 0.35 + r });
          bDummy.position.set(x, y, z);
          bDummy.rotation.set(Math.PI, 0, 0);
          bDummy.updateMatrix();
          bandMesh.setMatrixAt(fi, bDummy.matrix);
          bCol.setHex(bandColors[(k + r * 2) % bandColors.length]);
          bandMesh.setColorAt(fi, bCol);
          fi += 1;
        }
      }
      bandMesh.instanceMatrix.needsUpdate = true;
      if (bandMesh.instanceColor) bandMesh.instanceColor.needsUpdate = true;
      group.add(bandMesh);

      return (_dt, t) => {
        for (let i = 0; i < parols.length; i += 1) {
          parols[i].group.rotation.y = Math.sin(t * 0.7 + parols[i].phase) * 0.22;
        }
        for (let i = 0; i < totalFlags; i += 1) {
          const fm = flagMeta[i];
          bDummy.position.set(fm.x, fm.y, fm.z);
          bDummy.rotation.set(Math.PI + Math.sin(t * 2.4 + fm.phase) * 0.16, 0, Math.cos(t * 1.9 + fm.phase) * 0.1);
          bDummy.updateMatrix();
          bandMesh.setMatrixAt(i, bDummy.matrix);
        }
        bandMesh.instanceMatrix.needsUpdate = true;
      };
    }

    case 'APOCALYPSE_HELLFIRE': {
      const obsidianMat = trackMat(new THREE.MeshStandardMaterial({
        color: 0x111116,
        roughness: 0.78,
        metalness: 0.32,
        flatShading: true,
      }));
      const magmaMat = trackMat(new THREE.MeshStandardMaterial({
        color: 0xf97316,
        emissive: 0xef4444,
        emissiveIntensity: 2.1,
        roughness: 0.25,
      }));
      const emberRingMat = trackMat(new THREE.MeshBasicMaterial({
        color: 0xfb923c,
        transparent: true,
        opacity: 0.78,
        side: THREE.DoubleSide,
      }));
      dynamicElements.pulseMaterials.push(magmaMat);

      [
        { x: -22.2, y: 4.2, z: -4.2, sx: 2.0, sy: 12.4, sz: 2.2, rz: 0.16 },
        { x: -23.6, y: 2.2, z: 2.2, sx: 1.5, sy: 7.4, sz: 1.7, rz: 0.24 },
        { x: 22.2, y: 4.2, z: -4.2, sx: 2.0, sy: 12.4, sz: 2.2, rz: -0.16 },
        { x: 23.6, y: 2.2, z: 2.2, sx: 1.5, sy: 7.4, sz: 1.7, rz: -0.24 },
      ].forEach((sp) => {
        const pillar = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(1.1, 1.0, 5)), obsidianMat);
        pillar.scale.set(sp.sx, sp.sy, sp.sz);
        pillar.position.set(sp.x, sp.y, sp.z);
        pillar.rotation.z = sp.rz;
        const vein = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.6, 0.92, 5)), magmaMat);
        vein.scale.set(sp.sx * 0.48, sp.sy * 0.85, sp.sz * 0.48);
        vein.position.set(sp.x * 0.97, sp.y - 0.4, sp.z + 0.4);
        vein.rotation.z = sp.rz;
        group.add(pillar, vein);
      });

      // Volcanic obsidian spire sleeves gripping the 4 main 15.5m truss pillars
      [
        [-16.2, -8.4],
        [16.2, -8.4],
        [-16.2, 4.8],
        [16.2, 4.8],
      ].forEach(([ox, oz]) => {
        const sleeve = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(1.05, 5.2, 5)), obsidianMat);
        sleeve.position.set(ox, 2.5, oz);
        const magmaCrown = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(0.58, 0)), magmaMat);
        magmaCrown.position.set(ox, 15.8, oz);
        group.add(sleeve, magmaCrown);
      });

      const fissureRing = new THREE.Mesh(trackGeo(new THREE.RingGeometry(19.2, 26.8, 36)), emberRingMat);
      fissureRing.rotation.x = -Math.PI * 0.5;
      fissureRing.position.set(0, -2.14, 4.5);
      group.add(fissureRing);
      for (let f = 0; f < 10; f += 1) {
        const ang = (f / 10) * Math.PI * 2;
        const crack = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.45, 0.08, 8.5)), magmaMat);
        crack.position.set(Math.cos(ang) * 23.0, -2.15, 4.5 + Math.sin(ang) * 21.5);
        crack.rotation.y = -ang + Math.PI * 0.5;
        group.add(crack);
      }

      const emberCount = 240;
      const emberGeo = trackGeo(new THREE.OctahedronGeometry(0.095, 0));
      const emberMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xffffff }));
      const emberMesh = new THREE.InstancedMesh(emberGeo, emberMat, emberCount);
      emberMesh.frustumCulled = false;
      const eCol = new THREE.Color();
      const embers = Array.from({ length: emberCount }, (_, i) => {
        eCol.setHex(i % 3 === 0 ? 0xfef08a : i % 2 === 0 ? 0xf97316 : 0xef4444);
        emberMesh.setColorAt(i, eCol);
        return {
          x: (Math.random() - 0.5) * 44,
          y: -2.0 + Math.random() * 21,
          z: (Math.random() - 0.5) * 34,
          vy: 1.9 + Math.random() * 2.8,
          phase: Math.random() * Math.PI * 2,
          scale: 0.65 + Math.random() * 1.1,
        };
      });
      if (emberMesh.instanceColor) emberMesh.instanceColor.needsUpdate = true;
      group.add(emberMesh);

      const eDummy = new THREE.Object3D();
      return (dt, t) => {
        for (let i = 0; i < emberCount; i += 1) {
          const e = embers[i];
          e.y += e.vy * dt;
          if (e.y > 20.5) e.y = -2.0;
          eDummy.position.set(
            e.x + Math.sin(t * 2.1 + e.phase) * 0.75,
            e.y,
            e.z + Math.cos(t * 1.7 + e.phase) * 0.6
          );
          eDummy.rotation.set(t * 2 + e.phase, t * 1.5, 0);
          eDummy.scale.setScalar(e.scale * (0.75 + Math.sin(t * 9 + e.phase) * 0.25));
          eDummy.updateMatrix();
          emberMesh.setMatrixAt(i, eDummy.matrix);
        }
        emberMesh.instanceMatrix.needsUpdate = true;
      };
    }

    default:
      return null;
  }
}

/* ============================================================================
   MAIN 10-STADIUM + OVERLAY WORLD BUILDER
   ============================================================================ */

export function buildVenueEnvironment(venueId, overlayId = 'STANDARD') {
  const resolved = resolveLegacyVenueChoice(venueId, overlayId);
  const metaBase = getVenueById(resolved.venueId);
  const overlayMeta = getStageOverlayById(resolved.overlayId);
  const meta = {
    ...metaBase,
    overlayId: overlayMeta.id,
    overlayName: overlayMeta.name,
    laserColors: overlayMeta.laserColors || metaBase.laserColors,
    continuousIndoorFountains: Boolean(
      metaBase.continuousIndoorFountains || overlayMeta.continuousIndoorFountains
    ),
  };

  const palette = getVenuePalette(meta.id);
  const overlayPalette = getStageOverlayPalette(overlayMeta.id);
  const effectiveFascia = overlayPalette.fasciaOverride ?? palette.fasciaHex;
  const secondaryColor = overlayMeta.secondaryHex || metaBase.accentHex || 0xfacc15;

  const group = new THREE.Group();
  const disposables = { geometries: [], materials: [], textures: [] };
  const dynamicElements = {
    pulseMaterials: [],
    scrollingRibbons: [],
    rotatingRings: [],
    retractableRoofMeshes: [],
    searchlights: [],
    bowlLights: null,
    skyDome: null,
    skyMat: null,
    updateBowl: null,
    updateAtmosphere: null,
    update: null,
  };

  const trackGeo = (g) => { disposables.geometries.push(g); return g; };
  const trackMat = (m) => { disposables.materials.push(m); return m; };
  const trackTex = (t) => { disposables.textures.push(t); return t; };

  /**
   * Tags retractable indoor roof panels with both vertical clearance & radial parting vectors
   * so Grand Encore smoothly parts dome halves/petals open to reveal the starry sky & fireworks.
   */
  const markRetractable = (mesh, {
    openOffsetY = 26,
    slideDirX = 0,
    slideDirZ = 0,
    openScaleXZ = 1.0,
    openRotZ = 0,
  } = {}) => {
    mesh.userData.isRetractableRoof = true;
    mesh.userData.baseX = mesh.position.x;
    mesh.userData.baseY = mesh.position.y;
    mesh.userData.baseZ = mesh.position.z;
    mesh.userData.baseScaleX = mesh.scale.x;
    mesh.userData.baseScaleZ = mesh.scale.z;
    mesh.userData.baseRotZ = mesh.rotation.z;
    mesh.userData.openOffsetY = openOffsetY;
    mesh.userData.slideDirX = slideDirX;
    mesh.userData.slideDirZ = slideDirZ;
    mesh.userData.openScaleXZ = openScaleXZ;
    mesh.userData.openRotZ = openRotZ;
    dynamicElements.retractableRoofMeshes.push(mesh);
    return mesh;
  };

  let venueTick = null;

  switch (meta.id) {
    /* ======================================================================
       1. PHILIPPINE ARENA (Bulacan Mega Dome + NLEX Light Trails + Victoria Plaza + Manila Horizon)
       ====================================================================== */
    case 'philippine-arena': {
      addSkyDome(group, disposables, '#030712', '#0b1936', '#1e293b', true, dynamicElements);
      addOutdoorGround(group, disposables, 0x0b1220);

      // Split sliding clamshell mega-dome halves + steel radial ribs for smooth Grand Encore parting
      const domeMat = trackMat(new THREE.MeshStandardMaterial({
        color: 0x0d152a,
        roughness: 0.58,
        metalness: 0.42,
        side: THREE.DoubleSide,
      }));
      const trussMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.32, metalness: 0.85 }));

      [-1, 1].forEach((side) => {
        const halfGroup = new THREE.Group();
        halfGroup.position.set(0, -1, 4);
        const startTheta = side < 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
        const domeHalfGeo = trackGeo(new THREE.SphereGeometry(56, 28, 14, startTheta, Math.PI, 0, Math.PI * 0.48));
        const domeHalf = new THREE.Mesh(domeHalfGeo, domeMat);
        domeHalf.scale.set(1.24, 0.68, 1.12);
        halfGroup.add(domeHalf);

        for (let i = 0; i < 6; i += 1) {
          const arch = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(54.2, 0.4, 6, 32, Math.PI * 0.5)), trussMat);
          arch.rotation.y = startTheta + (i / 5) * Math.PI * 0.92;
          arch.scale.set(1.22, 0.7, 1.1);
          halfGroup.add(arch);
        }
        group.add(markRetractable(halfGroup, {
          openOffsetY: 14,
          slideDirX: side * 46,
          slideDirZ: -12,
        }));
      });

      // Wing Venue Screens (outside 28m stage deck)
      const screenTex = trackTex(createLedScreenTexture('PHILIPPINE ARENA', '#0284c7', 'rgba(56,189,248,0.45)'));
      const screenMat = trackMat(new THREE.MeshBasicMaterial({ map: screenTex }));
      const frameMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.7 }));
      [-18.6, 18.6].forEach((sx) => {
        const holder = new THREE.Group();
        const scr = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(7.0, 4.0)), screenMat);
        scr.position.z = 0.22;
        holder.add(new THREE.Mesh(trackGeo(new THREE.BoxGeometry(7.6, 4.5, 0.4)), frameMat), scr);
        holder.position.set(sx, 7.2, -3.5);
        holder.rotation.y = sx < 0 ? 0.34 : -0.34;
        group.add(holder);
      });

      // Illuminated NLEX Expressway + Animated Car Headlight & Taillight Streaks
      const roadMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.85 }));
      const nlexRoad = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(440, 0.25, 16)), roadMat);
      nlexRoad.position.set(0, -2.14, -98);
      group.add(nlexRoad);

      const lampCount = 24;
      const lampPostGeo = trackGeo(new THREE.CylinderGeometry(0.14, 0.2, 6.2, 6));
      const lampBulbGeo = trackGeo(new THREE.SphereGeometry(0.32, 6, 6));
      const lampBulbMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xfde68a }));
      const lamps = new THREE.InstancedMesh(lampPostGeo, trussMat, lampCount);
      const lampBulbs = new THREE.InstancedMesh(lampBulbGeo, lampBulbMat, lampCount);
      for (let l = 0; l < lampCount; l += 1) {
        const lx = -200 + (l / (lampCount - 1)) * 400;
        _bowlDummy.position.set(lx, 0.9, -98);
        _bowlDummy.rotation.set(0, 0, 0);
        _bowlDummy.scale.setScalar(1);
        _bowlDummy.updateMatrix();
        lamps.setMatrixAt(l, _bowlDummy.matrix);
        _bowlDummy.position.set(lx, 4.1, -98);
        _bowlDummy.updateMatrix();
        lampBulbs.setMatrixAt(l, _bowlDummy.matrix);
      }
      lamps.instanceMatrix.needsUpdate = true;
      lampBulbs.instanceMatrix.needsUpdate = true;
      group.add(lamps, lampBulbs);

      const carCount = 44;
      const carGeo = trackGeo(new THREE.BoxGeometry(3.2, 0.42, 0.85));
      const carMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xffffff }));
      const trafficCars = new THREE.InstancedMesh(carGeo, carMat, carCount);
      trafficCars.frustumCulled = false;
      const carMeta = [];
      for (let c = 0; c < carCount; c += 1) {
        const lane = c % 2 === 0 ? -1 : 1;
        carMeta.push({
          x: -200 + (c / carCount) * 400,
          z: -98 + lane * 3.6,
          speed: (22 + (c % 5) * 6) * lane,
        });
        _bowlColor.setHex(lane > 0 ? 0xfef08a : 0xf43f5e);
        trafficCars.setColorAt(c, _bowlColor);
      }
      if (trafficCars.instanceColor) trafficCars.instanceColor.needsUpdate = true;
      group.add(trafficCars);

      // Ciudad de Victoria Plaza Reflection Basins & Illuminated Fountains
      const poolGlowMat = trackMat(new THREE.MeshStandardMaterial({
        color: 0x0ea5e9,
        emissive: 0x38bdf8,
        emissiveIntensity: 1.15,
        roughness: 0.12,
        metalness: 0.75,
      }));
      dynamicElements.pulseMaterials.push(poolGlowMat);
      [-58, 58].forEach((fx) => {
        const pool = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(11, 11.5, 0.3, 24)), poolGlowMat);
        pool.position.set(fx, -2.06, -54);
        const jet = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(1.4, 7.2, 10)), poolGlowMat);
        jet.position.set(fx, 1.6, -54);
        group.add(pool, jet);
      });

      addInstancedFoliageRing(group, disposables, { count: 48, minRadius: 74, maxRadius: 118, centerZ: 5, canopyColor: 0x14532d });
      addDistantCitySkyline(group, disposables, {
        count: 96,
        minRadius: 165,
        maxRadius: 310,
        minHeight: 22,
        maxHeight: 74,
        accentHex: 0x38bdf8,
        baseColor: 0x091124,
      });
      addPerimeterSearchlights(group, disposables, dynamicElements, {
        radius: 68,
        centerZ: 5,
        colors: [0x38bdf8, 0xfacc15, 0xf43f5e],
      });

      venueTick = (dt) => {
        for (let c = 0; c < carCount; c += 1) {
          const cm = carMeta[c];
          cm.x += cm.speed * dt;
          if (cm.x > 210) cm.x = -210;
          if (cm.x < -210) cm.x = 210;
          _bowlDummy.position.set(cm.x, -1.76, cm.z);
          _bowlDummy.rotation.set(0, 0, 0);
          _bowlDummy.scale.setScalar(1);
          _bowlDummy.updateMatrix();
          trafficCars.setMatrixAt(c, _bowlDummy.matrix);
        }
        trafficCars.instanceMatrix.needsUpdate = true;
      };

      dynamicElements.bowlLights = addStadiumSeatingBowl(group, disposables, {
        venueName: 'PHILIPPINE ARENA',
        radiusX: 35,
        radiusZ: 32,
        centerZ: 5.0,
        tiers: 4,
        lightstickPalette: overlayMeta.laserColors || [0x38bdf8, 0xf8fafc, 0xf43f5e, 0xfacc15],
        seatColor: palette.seatColor,
        fasciaColor: effectiveFascia,
        secondaryColor,
        dynamicElements,
      });
      break;
    }

    /* ======================================================================
       2. SM MALL OF ASIA ARENA (Eye Roof + Manila Bay Ocean + Detailed MOA Eye Ferris Wheel)
       ====================================================================== */
    case 'moa-arena': {
      addSkyDome(group, disposables, '#04091a', '#0c1d3d', '#0f3057', true, dynamicElements);
      addOutdoorGround(group, disposables, 0x0a1324);

      const roofMat = trackMat(new THREE.MeshStandardMaterial({
        color: 0x08142b,
        roughness: 0.4,
        metalness: 0.62,
        side: THREE.DoubleSide,
      }));
      const cyanGlow = trackMat(new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        emissive: 0x06b6d4,
        emissiveIntensity: 1.55,
        roughness: 0.2,
      }));
      dynamicElements.pulseMaterials.push(cyanGlow);

      // Split retracting Eye-Shaped Roof Halves with glowing cyan structural ribs
      [-1, 1].forEach((side) => {
        const roofWing = new THREE.Group();
        roofWing.position.set(0, 0, 4);
        const startTheta = side < 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
        const shellHalf = new THREE.Mesh(
          trackGeo(new THREE.CylinderGeometry(48, 44, 22, 24, 1, true, startTheta, Math.PI)),
          roofMat
        );
        shellHalf.scale.set(1.24, 1, 1.0);
        shellHalf.position.y = 11.5;
        roofWing.add(shellHalf);

        [-4.8, -1.6, 1.6, 4.8].forEach((rz) => {
          const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(side * 42, 9.5, rz - 2),
            new THREE.Vector3(side * 22, 20.5, rz - 2),
            new THREE.Vector3(side * 1.2, 23.2, rz - 2),
          ]);
          const rib = new THREE.Mesh(trackGeo(new THREE.TubeGeometry(curve, 18, 0.28, 6, false)), cyanGlow);
          roofWing.add(rib);
        });

        group.add(markRetractable(roofWing, {
          openOffsetY: 14,
          slideDirX: side * 42,
        }));
      });

      const bayOcean = createAnimatedOcean(group, disposables, {
        width: 620,
        depth: 320,
        y: -2.08,
        z: -195,
        color: 0x083344,
        emissive: 0x0284c7,
        emissiveIntensity: 0.26,
      });

      // Bayside Promenade Seawall + Animated MOA Eye Ferris Wheel with 24 Passenger Gondolas
      const seawallMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.72 }));
      const seawall = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(260, 1.4, 8)), seawallMat);
      seawall.position.set(0, -1.6, -72);
      group.add(seawall);

      const wheelStand = new THREE.Group();
      wheelStand.position.set(66, -2.2, -82);
      const wheelMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.86, roughness: 0.28 }));
      [-7.5, 7.5].forEach((lz) => {
        [-1, 1].forEach((side) => {
          const leg = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.45, 0.7, 34, 8)), wheelMat);
          leg.position.set(side * 8.5, 14.5, lz);
          leg.rotation.z = side * 0.48;
          wheelStand.add(leg);
        });
      });

      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(0, 29, 0);
      const wheelRim = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(23, 0.52, 8, 48)), cyanGlow);
      const innerRim = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(15, 0.24, 6, 36)), wheelMat);
      for (let sp = 0; sp < 16; sp += 1) {
        const spoke = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.14, 0.14, 46, 6)), wheelMat);
        spoke.rotation.z = (sp / 16) * Math.PI;
        wheelGroup.add(spoke);
      }
      const gondolaGeo = trackGeo(new THREE.BoxGeometry(1.55, 1.8, 1.4));
      const gondolaMat = trackMat(new THREE.MeshStandardMaterial({
        color: 0xe0f2fe,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.95,
      }));
      const gondolas = [];
      for (let g = 0; g < 24; g += 1) {
        const ga = (g / 24) * Math.PI * 2;
        const gon = new THREE.Mesh(gondolaGeo, gondolaMat);
        gon.position.set(Math.cos(ga) * 23, Math.sin(ga) * 23, 0);
        wheelGroup.add(gon);
        gondolas.push(gon);
      }
      wheelGroup.add(wheelRim, innerRim);
      wheelStand.add(wheelGroup);
      group.add(wheelStand);

      const moaTex = trackTex(createLedScreenTexture('MOA ARENA', '#0369a1', 'rgba(6,182,212,0.5)'));
      const moaMat = trackMat(new THREE.MeshBasicMaterial({ map: moaTex }));
      [-18.2, 18.2].forEach((sx) => {
        const panel = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(6.4, 3.6)), moaMat);
        panel.position.set(sx, 6.8, -3.2);
        panel.rotation.y = sx < 0 ? 0.38 : -0.38;
        group.add(panel);
      });

      addInstancedFoliageRing(group, disposables, {
        count: 36,
        minRadius: 68,
        maxRadius: 96,
        centerZ: 5,
        canopyColor: 0x15803d,
        skipRearArc: true,
      });
      addDistantCitySkyline(group, disposables, {
        count: 88,
        minRadius: 138,
        maxRadius: 275,
        minHeight: 22,
        maxHeight: 78,
        accentHex: 0x06b6d4,
        baseColor: 0x091224,
        skipRearOceanArc: true,
      });
      addPerimeterSearchlights(group, disposables, dynamicElements, {
        radius: 66,
        centerZ: 5,
        colors: [0x06b6d4, 0x38bdf8, 0xe0f2fe],
      });

      venueTick = (dt, t) => {
        bayOcean.uniforms.uTime.value = t;
        wheelGroup.rotation.z += dt * 0.14;
        for (let g = 0; g < gondolas.length; g += 1) {
          gondolas[g].rotation.z = -wheelGroup.rotation.z;
        }
      };

      dynamicElements.bowlLights = addStadiumSeatingBowl(group, disposables, {
        venueName: 'MOA ARENA MANILA BAY',
        radiusX: 34,
        radiusZ: 31,
        centerZ: 5.0,
        tiers: 3,
        lightstickPalette: overlayMeta.laserColors || [0x06b6d4, 0x38bdf8, 0xe0f2fe, 0x3b82f6],
        seatColor: palette.seatColor,
        fasciaColor: effectiveFascia,
        secondaryColor,
        dynamicElements,
      });
      break;
    }

    /* ======================================================================
       3. WEMBLEY STADIUM (133m Arch + Suspension Cables + Olympic Way + London Skyline)
       ====================================================================== */
    case 'wembley': {
      addSkyDome(group, disposables, '#040712', '#0b142c', '#182442', true, dynamicElements);
      addOutdoorGround(group, disposables, 0x0b1a12);

      // Iconic Illuminated 133m Wembley Arch canted dramatically with steel suspension cables
      const archCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-56, -2.2, -16),
        new THREE.Vector3(-38, 28, -20),
        new THREE.Vector3(0, 46, -24),
        new THREE.Vector3(38, 28, -20),
        new THREE.Vector3(56, -2.2, -16),
      ]);
      const archGlowMat = trackMat(new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        emissive: 0xef4444,
        emissiveIntensity: 1.5,
        roughness: 0.22,
        metalness: 0.65,
      }));
      dynamicElements.pulseMaterials.push(archGlowMat);

      const archMain = new THREE.Mesh(trackGeo(new THREE.TubeGeometry(archCurve, 56, 1.05, 10, false)), archGlowMat);
      group.add(archMain);

      const ringMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.25 }));
      const cableMat = trackMat(new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.62 }));
      const cableGeo = trackGeo(new THREE.CylinderGeometry(0.06, 0.06, 1, 5));

      for (let i = 2; i <= 20; i += 1) {
        const u = i / 22;
        const pt = archCurve.getPoint(u);
        const tan = archCurve.getTangent(u);
        const ribRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(1.36, 0.14, 6, 12)), ringMat);
        ribRing.position.copy(pt);
        ribRing.lookAt(pt.clone().add(tan));
        group.add(ribRing);

        // Diagonal suspension cables anchoring arch down to stadium roof deck
        const anchorPt = new THREE.Vector3(pt.x * 0.86, 20.5, -24.5);
        const midPt = pt.clone().lerp(anchorPt, 0.5);
        const len = pt.distanceTo(anchorPt);
        const cable = new THREE.Mesh(cableGeo, cableMat);
        cable.position.copy(midPt);
        cable.scale.set(1, len, 1);
        cable.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), anchorPt.clone().sub(pt).normalize());
        group.add(cable);
      }

      // Olympic Way Illuminated Pedestrian Promenade & London Landmarks (The Shard + London Eye)
      const olyRoad = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(20, 0.24, 150)),
        trackMat(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.72 }))
      );
      olyRoad.position.set(0, -2.14, -108);
      group.add(olyRoad);
      for (let p = 0; p < 10; p += 1) {
        const pz = -56 - p * 12;
        [-10.5, 10.5].forEach((px) => {
          const bollard = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.65, 3.2, 0.65)), archGlowMat);
          bollard.position.set(px, -0.5, pz);
          group.add(bollard);
        });
      }

      const shardMat = trackMat(new THREE.MeshStandardMaterial({
        color: 0xbae6fd,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.72,
        roughness: 0.16,
        metalness: 0.85,
      }));
      const shard = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(13, 106, 4)), shardMat);
      shard.position.set(84, 51, -198);
      group.add(shard);

      const londonEye = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(26, 0.75, 8, 44)), shardMat);
      londonEye.position.set(-86, 32, -182);
      group.add(londonEye);

      addDistantCitySkyline(group, disposables, {
        count: 96,
        minRadius: 148,
        maxRadius: 290,
        minHeight: 20,
        maxHeight: 72,
        accentHex: 0xef4444,
        baseColor: 0x0c1322,
      });
      addPerimeterSearchlights(group, disposables, dynamicElements, {
        radius: 68,
        centerZ: 5,
        colors: [0xef4444, 0xf8fafc, 0x38bdf8],
      });

      venueTick = (dt) => {
        londonEye.rotation.z += dt * 0.08;
      };

      dynamicElements.bowlLights = addStadiumSeatingBowl(group, disposables, {
        venueName: 'WEMBLEY STADIUM LONDON',
        radiusX: 35,
        radiusZ: 32,
        centerZ: 5.0,
        tiers: 4,
        lightstickPalette: overlayMeta.laserColors || [0xef4444, 0xf8fafc, 0x38bdf8, 0xfacc15],
        seatColor: palette.seatColor,
        fasciaColor: effectiveFascia,
        secondaryColor,
        dynamicElements,
      });
      break;
    }

    /* ======================================================================
       4. MADISON SQUARE GARDEN (Penn Plaza Drum + Retractable Cable Roof + NYC Times Square & ESB)
       ====================================================================== */
    case 'madison-square-garden': {
      addSkyDome(group, disposables, '#050612', '#10122c', '#231f42', true, dynamicElements);
      addOutdoorGround(group, disposables, 0x090a14);

      const cylMat = trackMat(new THREE.MeshStandardMaterial({
        color: 0x0d0d18,
        roughness: 0.72,
        metalness: 0.25,
        side: THREE.DoubleSide,
      }));
      const trussSteel = trackMat(new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.35, metalness: 0.85 }));
      const accentRingMat = trackMat(new THREE.MeshStandardMaterial({
        color: 0x818cf8,
        emissive: 0x6366f1,
        emissiveIntensity: 1.5,
      }));
      dynamicElements.pulseMaterials.push(accentRingMat);

      // Exterior Penn Plaza Ribbed Concrete Drum + Illuminated Marquee Ring
      const marqueeHalo = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(55, 0.7, 8, 60)), accentRingMat);
      marqueeHalo.rotation.x = Math.PI * 0.5;
      marqueeHalo.position.set(0, 14, 5);
      group.add(marqueeHalo);

      // Retractable Cable-Net Roof Halves
      [-1, 1].forEach((side) => {
        const roofPanel = new THREE.Group();
        roofPanel.position.set(0, 22, 4);
        const startTheta = side < 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
        const capHalf = new THREE.Mesh(
          trackGeo(new THREE.ConeGeometry(49, 7, 36, 1, false, startTheta, Math.PI)),
          cylMat
        );
        capHalf.position.y = 3.5;
        roofPanel.add(capHalf);
        group.add(markRetractable(roofPanel, { openOffsetY: 14, slideDirX: side * 44 }));
      });

      const rigGroup = new THREE.Group();
      rigGroup.position.set(0, 19.5, 2);
      [8.0, 16.5, 24.5].forEach((r, idx) => {
        const ring = new THREE.Mesh(
          trackGeo(new THREE.TorusGeometry(r, idx === 1 ? 0.38 : 0.26, 8, 44)),
          idx === 1 ? accentRingMat : trussSteel
        );
        ring.rotation.x = Math.PI * 0.5;
        rigGroup.add(ring);
      });
      for (let i = 0; i < 12; i += 1) {
        const a = (i / 12) * Math.PI * 2;
        const spoke = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.28, 0.32, 24.5)), trussSteel);
        spoke.position.set(Math.sin(a) * 12.25, 0, Math.cos(a) * 12.25);
        spoke.rotation.y = a;
        rigGroup.add(spoke);
      }
      group.add(markRetractable(rigGroup, { openOffsetY: 26 }));
      dynamicElements.rotatingRings.push(rigGroup);

      // Midtown Manhattan Skyline + Times Square Glowing Neon Billboard Towers + Empire State Building
      addDistantCitySkyline(group, disposables, {
        count: 136,
        minRadius: 112,
        maxRadius: 270,
        minHeight: 38,
        maxHeight: 112,
        accentHex: 0x818cf8,
        baseColor: 0x0b0e1e,
        warmBias: true,
      });

      const tsColors = [0xf43f5e, 0x22d3ee, 0xfacc15, 0xa855f7];
      for (let b = 0; b < 6; b += 1) {
        const bx = -72 + b * 28;
        const bz = -112 - (b % 2) * 18;
        const tsMat = trackMat(new THREE.MeshBasicMaterial({ color: tsColors[b % tsColors.length] }));
        const panel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(10, 22, 1.2)), tsMat);
        panel.position.set(bx, 28 + (b % 3) * 8, bz);
        group.add(panel);
      }

      const esbGroup = new THREE.Group();
      esbGroup.position.set(-54, -2.2, -162);
      const esbLower = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(20, 62, 18)), trussSteel);
      esbLower.position.y = 31;
      const esbMid = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(13, 36, 13)), trussSteel);
      esbMid.position.y = 78;
      const esbCrown = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(1.1, 4.8, 28, 8)), accentRingMat);
      esbCrown.position.y = 109;
      esbGroup.add(esbLower, esbMid, esbCrown);
      group.add(esbGroup);

      addPerimeterSearchlights(group, disposables, dynamicElements, {
        radius: 66,
        centerZ: 5,
        colors: [0x818cf8, 0xf43f5e, 0xfacc15],
      });

      dynamicElements.bowlLights = addStadiumSeatingBowl(group, disposables, {
        venueName: 'MADISON SQUARE GARDEN NYC',
        radiusX: 34,
        radiusZ: 31,
        centerZ: 5.0,
        tiers: 3,
        lightstickPalette: overlayMeta.laserColors || [0x818cf8, 0xf8fafc, 0xf43f5e, 0xfacc15],
        seatColor: palette.seatColor,
        fasciaColor: effectiveFascia,
        secondaryColor,
        dynamicElements,
      });
      break;
    }

    /* ======================================================================
       5. TOKYO DOME (Quilted Big Egg + Animated Thunder Dolphin Coaster + Big-O + Skytree)
       ====================================================================== */
    case 'tokyo-dome': {
      addSkyDome(group, disposables, '#040618', '#0e1738', '#1e2b58', true, dynamicElements);
      addOutdoorGround(group, disposables, 0x090e1c);

      const memMat = trackMat(new THREE.MeshStandardMaterial({
        color: 0xdbeafe,
        emissive: 0x1e293b,
        emissiveIntensity: 0.45,
        roughness: 0.62,
        metalness: 0.08,
        side: THREE.DoubleSide,
      }));
      const wireMat = trackMat(new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.55 }));

      // Split Big Egg pressurized membrane shell
      [-1, 1].forEach((side) => {
        const eggHalf = new THREE.Group();
        eggHalf.position.set(0, 4.5, 4);
        const startTheta = side < 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
        const roofGeo = trackGeo(new THREE.SphereGeometry(52, 24, 14, startTheta, Math.PI, 0, Math.PI * 0.46));
        const roof = new THREE.Mesh(roofGeo, memMat);
        roof.scale.set(1.22, 0.58, 1.14);
        const wireGeo = trackGeo(new THREE.WireframeGeometry(roofGeo));
        const grid = new THREE.LineSegments(wireGeo, wireMat);
        grid.scale.copy(roof.scale).multiplyScalar(0.992);
        eggHalf.add(roof, grid);
        group.add(markRetractable(eggHalf, { openOffsetY: 14, slideDirX: side * 44 }));
      });

      const tdTex = trackTex(createLedScreenTexture('TOKYO DOME', '#7c3aed', 'rgba(34,211,238,0.5)'));
      const tdMat = trackMat(new THREE.MeshBasicMaterial({ map: tdTex }));
      [-18.2, 18.2].forEach((sx) => {
        const wingScreen = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(7.2, 4.0)), tdMat);
        wingScreen.position.set(sx, 7.2, -3.5);
        wingScreen.rotation.y = sx < 0 ? 0.36 : -0.36;
        group.add(wingScreen);
      });

      const neonViolet = trackMat(new THREE.MeshStandardMaterial({
        color: 0xc084fc,
        emissive: 0xa855f7,
        emissiveIntensity: 1.5,
      }));
      const neonCyan = trackMat(new THREE.MeshStandardMaterial({
        color: 0x22d3ee,
        emissive: 0x06b6d4,
        emissiveIntensity: 1.65,
      }));
      dynamicElements.pulseMaterials.push(neonViolet, neonCyan);

      // Hubless Big-O Ferris Wheel
      const bigO = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(22, 1.05, 10, 44)), neonViolet);
      bigO.position.set(-64, 26, -78);
      group.add(bigO);

      // Thunder Dolphin Roller Coaster curving through Tokyo Dome City + racing animated train!
      const coasterCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-105, 6, -92),
        new THREE.Vector3(-64, 26, -78),
        new THREE.Vector3(-18, 42, -108),
        new THREE.Vector3(38, 18, -94),
        new THREE.Vector3(82, 34, -112),
        new THREE.Vector3(115, 8, -88),
      ]);
      const coasterTrack = new THREE.Mesh(trackGeo(new THREE.TubeGeometry(coasterCurve, 64, 0.68, 8, false)), neonCyan);
      group.add(coasterTrack);
      const coasterTrain = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(3.8, 1.2, 1.4)),
        trackMat(new THREE.MeshBasicMaterial({ color: 0xfef08a }))
      );
      group.add(coasterTrain);

      // Tokyo Skytree illuminated needle tower
      const skytree = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(1.1, 8.2, 128, 10)), neonViolet);
      skytree.position.set(74, 62, -190);
      group.add(skytree);

      addDistantCitySkyline(group, disposables, {
        count: 108,
        minRadius: 124,
        maxRadius: 270,
        minHeight: 26,
        maxHeight: 92,
        accentHex: 0xc084fc,
        baseColor: 0x0b1024,
      });
      addPerimeterSearchlights(group, disposables, dynamicElements, {
        radius: 66,
        centerZ: 5,
        colors: [0xe879f9, 0x22d3ee, 0x38bdf8],
      });

      const _trainPt = new THREE.Vector3();
      const _trainTan = new THREE.Vector3();
      venueTick = (_dt, t) => {
        const u = (t * 0.14) % 1;
        coasterCurve.getPointAt(u, _trainPt);
        coasterCurve.getTangentAt(u, _trainTan);
        coasterTrain.position.copy(_trainPt);
        coasterTrain.lookAt(_trainPt.clone().add(_trainTan));
      };

      dynamicElements.bowlLights = addStadiumSeatingBowl(group, disposables, {
        venueName: 'TOKYO DOME CITY LIVE',
        radiusX: 34,
        radiusZ: 31,
        centerZ: 5.0,
        tiers: 4,
        lightstickPalette: overlayMeta.laserColors || [0xe879f9, 0x38bdf8, 0x4ade80, 0xfacc15, 0xf43f5e, 0xffffff],
        seatColor: palette.seatColor,
        fasciaColor: effectiveFascia,
        secondaryColor,
        dynamicElements,
      });
      break;
    }

    /* ======================================================================
       6. RED ROCKS AMPHITHEATRE (Stratified Creation & Ship Rock + Canyon Pines + Denver Lights)
       ====================================================================== */
    case 'red-rocks': {
      addSkyDome(group, disposables, '#050410', '#120b24', '#33161f', true, dynamicElements);
      addOutdoorGround(group, disposables, 0x24120c);

      const sandstoneTex = trackTex(createSandstoneTexture());
      const rockMat = trackMat(new THREE.MeshStandardMaterial({
        map: sandstoneTex,
        color: 0xb94d2c,
        roughness: 0.9,
        metalness: 0.04,
        flatShading: true,
      }));
      const rockDarkMat = trackMat(new THREE.MeshStandardMaterial({
        map: sandstoneTex,
        color: 0x7c2d19,
        roughness: 0.94,
        metalness: 0.04,
        flatShading: true,
      }));

      // Stratified Ship Rock & Creation Rock Sandstone Monoliths flanking outside stage (|x| >= 19.5)
      [
        { x: -20.5, y: 7.5, z: -4.5, sx: 9.2, sy: 24.5, sz: 14, rz: -0.24, mat: rockMat },
        { x: -26.5, y: 10.5, z: -14, sx: 11.5, sy: 29.0, sz: 16, rz: -0.2, mat: rockDarkMat },
        { x: 20.5, y: 7.8, z: -4.5, sx: 9.4, sy: 25.0, sz: 14, rz: 0.24, mat: rockMat },
        { x: 26.8, y: 10.8, z: -14, sx: 11.8, sy: 30.0, sz: 16, rz: 0.22, mat: rockDarkMat },
        { x: 0, y: 1.8, z: -26.5, sx: 32, sy: 9.5, sz: 8.5, rz: 0.04, mat: rockDarkMat },
      ].forEach((rs) => {
        const slabGeo = trackGeo(new THREE.DodecahedronGeometry(1, 1));
        const slab = new THREE.Mesh(slabGeo, rs.mat);
        slab.position.set(rs.x, rs.y, rs.z);
        slab.scale.set(rs.sx * 0.56, rs.sy * 0.56, rs.sz * 0.56);
        slab.rotation.z = rs.rz;
        group.add(slab);
      });

      const ridgeGeo = trackGeo(new THREE.DodecahedronGeometry(1, 1));
      const ridges = new THREE.InstancedMesh(ridgeGeo, rockDarkMat, 48);
      const rDummy = new THREE.Object3D();
      for (let i = 0; i < 48; i += 1) {
        const ang = (i / 48) * Math.PI * 2;
        const r = 112 + (i % 5) * 32;
        rDummy.position.set(Math.cos(ang) * r, 4 + (i % 4) * 5, Math.sin(ang) * r);
        rDummy.rotation.set(0, ang, (i % 2 === 0 ? 1 : -1) * 0.18);
        rDummy.scale.set(26 + (i % 3) * 9, 16 + (i % 5) * 7, 18);
        rDummy.updateMatrix();
        ridges.setMatrixAt(i, rDummy.matrix);
      }
      ridges.instanceMatrix.needsUpdate = true;
      group.add(ridges);

      addInstancedFoliageRing(group, disposables, {
        count: 68,
        minRadius: 56,
        maxRadius: 120,
        centerZ: 5,
        canopyColor: 0x0f3b26,
        isPine: true,
      });

      addDistantCitySkyline(group, disposables, {
        count: 42,
        minRadius: 210,
        maxRadius: 270,
        minHeight: 14,
        maxHeight: 34,
        accentHex: 0xf97316,
        baseColor: 0x160e12,
        warmBias: true,
      });

      [-18.2, 18.2].forEach((ux) => {
        const light = new THREE.PointLight(0xf97316, 48, 34, 1.25);
        light.position.set(ux, 2.5, -3.5);
        group.add(light);
      });

      addPerimeterSearchlights(group, disposables, dynamicElements, {
        radius: 62,
        centerZ: 5,
        colors: [0xf97316, 0xfacc15, 0xf43f5e],
      });

      dynamicElements.bowlLights = addStadiumSeatingBowl(group, disposables, {
        venueName: 'RED ROCKS COLORADO',
        radiusX: 34,
        radiusZ: 31,
        centerZ: 5.0,
        tiers: 3,
        lightstickPalette: overlayMeta.laserColors || [0xf97316, 0xfacc15, 0xf43f5e, 0xffffff],
        seatColor: palette.seatColor,
        fasciaColor: effectiveFascia,
        secondaryColor,
        exteriorWall: false,
        perimeterCatwalk: false,
        dynamicElements,
      });
      break;
    }

    /* ======================================================================
       7. MARACANÃ STADIUM (Tensioned Canopy + Tijuca Hills + Christ the Redeemer + Sugarloaf)
       ====================================================================== */
    case 'maracana': {
      addSkyDome(group, disposables, '#04091a', '#0a223a', '#15443c', true, dynamicElements);
      addOutdoorGround(group, disposables, 0x0a1c14);

      const canopyMat = trackMat(new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        emissive: 0x0f172a,
        emissiveIntensity: 0.25,
        roughness: 0.55,
        metalness: 0.22,
        side: THREE.DoubleSide,
      }));
      const goldTrimMat = trackMat(new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xeab308,
        emissiveIntensity: 1.35,
        roughness: 0.24,
      }));
      dynamicElements.pulseMaterials.push(goldTrimMat);

      const ringCanopy = new THREE.Mesh(trackGeo(new THREE.RingGeometry(29, 49, 60)), canopyMat);
      ringCanopy.rotation.x = -Math.PI * 0.5;
      ringCanopy.scale.set(1.16, 1.04, 1);
      ringCanopy.position.set(0, 19.5, 5.0);
      group.add(markRetractable(ringCanopy, { openOffsetY: 24 }));

      const tensionHalo = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(29.2, 0.36, 8, 60)), goldTrimMat);
      tensionHalo.rotation.x = Math.PI * 0.5;
      tensionHalo.scale.set(1.16, 1.04, 1);
      tensionHalo.position.set(0, 19.3, 5.0);
      group.add(markRetractable(tensionHalo, { openOffsetY: 24 }));

      const hillMat = trackMat(new THREE.MeshStandardMaterial({
        color: 0x0f2e22,
        roughness: 0.9,
        flatShading: true,
      }));
      const sugarloaf = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(30, 82, 9)), hillMat);
      sugarloaf.position.set(88, 38, -200);
      const corcovado = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(38, 96, 10)), hillMat);
      corcovado.position.set(-76, 45, -208);

      const statueGlowMat = trackMat(new THREE.MeshStandardMaterial({
        color: 0xfef9c3,
        emissive: 0xfacc15,
        emissiveIntensity: 1.1,
        roughness: 0.35,
      }));
      const statueBody = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(1.4, 1.8, 15, 8)), statueGlowMat);
      statueBody.position.set(-76, 99, -208);
      const statueHead = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(1.5, 8, 8)), statueGlowMat);
      statueHead.position.set(-76, 107.5, -208);
      const statueArms = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(14, 1.8, 1.4)), statueGlowMat);
      statueArms.position.set(-76, 103.5, -208);
      group.add(sugarloaf, corcovado, statueBody, statueHead, statueArms);

      const bay = createAnimatedOcean(group, disposables, {
        width: 480,
        depth: 180,
        x: 110,
        y: -2.08,
        z: -240,
        color: 0x064e3b,
        emissive: 0x0284c7,
        emissiveIntensity: 0.24,
      });

      addInstancedFoliageRing(group, disposables, { count: 44, minRadius: 72, maxRadius: 118, centerZ: 5, canopyColor: 0x15803d });
      addDistantCitySkyline(group, disposables, {
        count: 82,
        minRadius: 148,
        maxRadius: 270,
        minHeight: 18,
        maxHeight: 64,
        accentHex: 0x22c55e,
        baseColor: 0x091614,
      });
      addPerimeterSearchlights(group, disposables, dynamicElements, {
        radius: 68,
        centerZ: 5,
        colors: [0x22c55e, 0xfacc15, 0x38bdf8],
      });

      venueTick = (_dt, t) => {
        bay.uniforms.uTime.value = t;
      };

      dynamicElements.bowlLights = addStadiumSeatingBowl(group, disposables, {
        venueName: 'MARACANÃ RIO DE JANEIRO',
        radiusX: 35,
        radiusZ: 32,
        centerZ: 5.0,
        tiers: 4,
        lightstickPalette: overlayMeta.laserColors || [0x22c55e, 0xfacc15, 0x38bdf8, 0xf8fafc],
        seatColor: palette.seatColor,
        fasciaColor: effectiveFascia,
        secondaryColor,
        dynamicElements,
      });
      break;
    }

    /* ======================================================================
       8. SYDNEY HARBOUR STAGE (Waves + Multi-Shell Opera House + Lattice Steel Harbour Bridge)
       ====================================================================== */
    case 'sydney-harbour': {
      addSkyDome(group, disposables, '#030818', '#0a1e42', '#173866', true, dynamicElements);
      addOutdoorGround(group, disposables, 0x0a1324);

      const harbourWater = createAnimatedOcean(group, disposables, {
        width: 660,
        depth: 360,
        y: -2.06,
        z: -205,
        color: 0x0c4a6e,
        emissive: 0x0284c7,
        emissiveIntensity: 0.3,
      });

      // Harbour Bridge Steel Lattice Arch + Granite Pylons + Roadway
      const bridgeMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.36, metalness: 0.85 }));
      const deckMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6, metalness: 0.5 }));
      const beaconGlow = trackMat(new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x38bdf8,
        emissiveIntensity: 1.65,
      }));
      dynamicElements.pulseMaterials.push(beaconGlow);

      const upperArch = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-124, -1.5, -148),
        new THREE.Vector3(-64, 38, -148),
        new THREE.Vector3(0, 58, -148),
        new THREE.Vector3(64, 38, -148),
        new THREE.Vector3(124, -1.5, -148),
      ]);
      const lowerArch = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-124, -1.5, -148),
        new THREE.Vector3(-64, 29, -148),
        new THREE.Vector3(0, 44, -148),
        new THREE.Vector3(64, 29, -148),
        new THREE.Vector3(124, -1.5, -148),
      ]);
      group.add(
        new THREE.Mesh(trackGeo(new THREE.TubeGeometry(upperArch, 48, 1.35, 8, false)), bridgeMat),
        new THREE.Mesh(trackGeo(new THREE.TubeGeometry(lowerArch, 48, 1.2, 8, false)), bridgeMat)
      );
      const bridgeRoad = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(256, 2.0, 5.8)), deckMat);
      bridgeRoad.position.set(0, 15, -148);
      group.add(bridgeRoad);

      const hangerGeo = trackGeo(new THREE.CylinderGeometry(0.18, 0.18, 1, 5));
      for (let h = 2; h < 20; h += 1) {
        const pt = lowerArch.getPoint(h / 22);
        const hLen = Math.abs(pt.y - 15);
        const hanger = new THREE.Mesh(hangerGeo, bridgeMat);
        hanger.position.set(pt.x, (pt.y + 15) * 0.5, -148);
        hanger.scale.set(1, Math.max(1, hLen), 1);
        group.add(hanger);
      }

      [-126, 126].forEach((px) => {
        const pylon = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(8.5, 48, 8.5)), deckMat);
        pylon.position.set(px, 22, -148);
        const cap = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(9.0, 1.6, 9.0)), beaconGlow);
        cap.position.set(px, 46.5, -148);
        group.add(pylon, cap);
      });

      // Multi-Cluster Illuminated Sydney Opera House Shells + Warm Golden Podium
      const sailMat = trackMat(new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        emissive: 0x1e3a8a,
        emissiveIntensity: 0.32,
        roughness: 0.22,
        metalness: 0.16,
      }));
      const podiumMat = trackMat(new THREE.MeshStandardMaterial({
        color: 0x334155,
        emissive: 0xfbbf24,
        emissiveIntensity: 0.22,
      }));
      const operaPodium = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(64, 4.5, 24)), podiumMat);
      operaPodium.position.set(-72, 0.2, -96);
      group.add(operaPodium);

      [
        { x: -84, y: 12, z: -96, sx: 14, sy: 26, sz: 12, rz: -0.32 },
        { x: -72, y: 14, z: -95, sx: 16, sy: 30, sz: 13, rz: -0.22 },
        { x: -60, y: 10, z: -94, sx: 12, sy: 21, sz: 11, rz: -0.14 },
        { x: -49, y: 8.5, z: -96, sx: 10, sy: 17, sz: 10, rz: 0.28 },
        { x: 64, y: 11, z: -98, sx: 13, sy: 24, sz: 11, rz: 0.24 },
      ].forEach((s) => {
        const sail = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(1, 1, 14, 1, false, 0, Math.PI)), sailMat);
        sail.scale.set(s.sx, s.sy, s.sz);
        sail.position.set(s.x, s.y, s.z);
        sail.rotation.z = s.rz;
        group.add(sail);
      });

      addDistantCitySkyline(group, disposables, {
        count: 92,
        minRadius: 142,
        maxRadius: 280,
        minHeight: 24,
        maxHeight: 86,
        accentHex: 0x38bdf8,
        baseColor: 0x0a1326,
        skipRearOceanArc: true,
      });
      addPerimeterSearchlights(group, disposables, dynamicElements, {
        radius: 64,
        centerZ: 5,
        colors: [0x38bdf8, 0xfacc15, 0xf472b6],
      });

      venueTick = (_dt, t) => {
        harbourWater.uniforms.uTime.value = t;
      };

      dynamicElements.bowlLights = addStadiumSeatingBowl(group, disposables, {
        venueName: 'SYDNEY HARBOUR LIVE',
        radiusX: 35,
        radiusZ: 32,
        centerZ: 5.0,
        tiers: 3,
        lightstickPalette: overlayMeta.laserColors || [0x38bdf8, 0xfacc15, 0xf472b6, 0xffffff],
        seatColor: palette.seatColor,
        fasciaColor: effectiveFascia,
        secondaryColor,
        exteriorWall: false,
        perimeterCatwalk: false,
        dynamicElements,
      });
      break;
    }

    /* ======================================================================
       9. STADE DE FRANCE (Floating Halo Canopy + 18 Stay-Cable Masts + Sparkling Eiffel Tower)
       ====================================================================== */
    case 'stade-de-france': {
      addSkyDome(group, disposables, '#040615', '#0e1535', '#1e2752', true, dynamicElements);
      addOutdoorGround(group, disposables, 0x0a101d);

      const haloSteel = trackMat(new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.34,
        metalness: 0.62,
        side: THREE.DoubleSide,
      }));
      const tricolorGlow = trackMat(new THREE.MeshStandardMaterial({
        color: 0x60a5fa,
        emissive: 0x3b82f6,
        emissiveIntensity: 1.55,
      }));
      dynamicElements.pulseMaterials.push(tricolorGlow);

      const floatingDisk = new THREE.Mesh(trackGeo(new THREE.RingGeometry(27.5, 47, 60)), haloSteel);
      floatingDisk.rotation.x = -Math.PI * 0.5;
      floatingDisk.scale.set(1.18, 1.02, 1);
      floatingDisk.position.set(0, 20.4, 5.0);
      group.add(markRetractable(floatingDisk, { openOffsetY: 25 }));

      const innerLightRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(27.8, 0.34, 8, 60)), tricolorGlow);
      innerLightRing.rotation.x = Math.PI * 0.5;
      innerLightRing.scale.set(1.18, 1.02, 1);
      innerLightRing.position.set(0, 20.2, 5.0);
      group.add(markRetractable(innerLightRing, { openOffsetY: 25 }));

      // 18 Perimeter Structural Steel Needles & Tensioned Stay Cables holding the Floating Canopy
      const mastGeo = trackGeo(new THREE.CylinderGeometry(0.32, 0.55, 34, 6));
      for (let m = 0; m < 18; m += 1) {
        const ang = (m / 18) * Math.PI * 2;
        const mx = Math.cos(ang) * 53 * 1.16;
        const mz = 5.0 + Math.sin(ang) * 53 * 1.02;
        const mast = new THREE.Mesh(mastGeo, haloSteel);
        mast.position.set(mx, 14.5, mz);
        group.add(mast);
      }

      // Detailed Lattice & Gold Floodlit Eiffel Tower + Rotating Beacon Beam
      const eiffelGold = trackMat(new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xfacc15,
        emissiveIntensity: 1.18,
        roughness: 0.28,
        metalness: 0.8,
      }));
      const eiffelGroup = new THREE.Group();
      eiffelGroup.position.set(-72, -2.2, -192);
      const eBase = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(7.2, 16.5, 34, 4)), eiffelGold);
      eBase.position.y = 17;
      eBase.rotation.y = Math.PI * 0.25;
      const eMid = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(4.2, 7.0, 32, 4)), eiffelGold);
      eMid.position.y = 49;
      eMid.rotation.y = Math.PI * 0.25;
      const eSpire = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(4.1, 48, 4)), eiffelGold);
      eSpire.position.y = 89;
      eSpire.rotation.y = Math.PI * 0.25;
      const beaconBeam = new THREE.Mesh(
        trackGeo(new THREE.ConeGeometry(2.6, 54, 8, 1, true)),
        trackMat(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.32, side: THREE.DoubleSide }))
      );
      beaconBeam.rotation.z = Math.PI * 0.5;
      beaconBeam.position.set(27, 113, 0);
      const beaconPivot = new THREE.Group();
      beaconPivot.add(beaconBeam);
      eiffelGroup.add(eBase, eMid, eSpire, beaconPivot);
      group.add(eiffelGroup);

      addInstancedFoliageRing(group, disposables, { count: 38, minRadius: 74, maxRadius: 112, centerZ: 5, canopyColor: 0x1e3a2f });
      addDistantCitySkyline(group, disposables, {
        count: 92,
        minRadius: 145,
        maxRadius: 270,
        minHeight: 20,
        maxHeight: 58,
        accentHex: 0x3b82f6,
        baseColor: 0x0b1022,
        warmBias: true,
      });
      addPerimeterSearchlights(group, disposables, dynamicElements, {
        radius: 68,
        centerZ: 5,
        colors: [0x3b82f6, 0xf8fafc, 0xef4444],
      });

      venueTick = (dt) => {
        beaconPivot.rotation.y += dt * 0.65;
      };

      dynamicElements.bowlLights = addStadiumSeatingBowl(group, disposables, {
        venueName: 'STADE DE FRANCE PARIS',
        radiusX: 35,
        radiusZ: 32,
        centerZ: 5.0,
        tiers: 4,
        lightstickPalette: overlayMeta.laserColors || [0x3b82f6, 0xf8fafc, 0xef4444, 0xfacc15],
        seatColor: palette.seatColor,
        fasciaColor: effectiveFascia,
        secondaryColor,
        dynamicElements,
      });
      break;
    }

    /* ======================================================================
       10. SEOUL OLYMPIC STADIUM (Porcelain Canopy + Olympic Cauldron + Han River Bridge + Lotte Tower)
       ====================================================================== */
    case 'seoul-olympic': {
      addSkyDome(group, disposables, '#050618', '#151238', '#2a184a', true, dynamicElements);
      addOutdoorGround(group, disposables, 0x0b0e1e);

      const porcelainMat = trackMat(new THREE.MeshStandardMaterial({
        color: 0xf1f5f9,
        emissive: 0x1e1b4b,
        emissiveIntensity: 0.28,
        roughness: 0.35,
        metalness: 0.24,
        side: THREE.DoubleSide,
      }));
      const kpopMagenta = trackMat(new THREE.MeshStandardMaterial({
        color: 0xf472b6,
        emissive: 0xec4899,
        emissiveIntensity: 1.6,
        roughness: 0.2,
      }));
      dynamicElements.pulseMaterials.push(kpopMagenta);

      [-1, 1].forEach((side) => {
        const wingCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(side * 25, 16.5, -24),
          new THREE.Vector3(side * 40, 23.0, 4),
          new THREE.Vector3(side * 25, 16.5, 32),
        ]);
        const arch = new THREE.Mesh(trackGeo(new THREE.TubeGeometry(wingCurve, 32, 1.9, 8, false)), porcelainMat);
        const neonStrip = new THREE.Mesh(trackGeo(new THREE.TubeGeometry(wingCurve, 32, 0.4, 6, false)), kpopMagenta);
        neonStrip.position.x = -side * 1.45;
        group.add(
          markRetractable(arch, { openOffsetY: 22, slideDirX: side * 14 }),
          markRetractable(neonStrip, { openOffsetY: 22, slideDirX: side * 14 })
        );
      });

      const seoulTex = trackTex(createLedScreenTexture('SEOUL OLYMPIC', '#db2777', 'rgba(34,211,238,0.5)'));
      const seoulMat = trackMat(new THREE.MeshBasicMaterial({ map: seoulTex }));
      [-18.4, 18.4].forEach((sx) => {
        const panel = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(7.2, 4.0)), seoulMat);
        panel.position.set(sx, 7.2, -3.5);
        panel.rotation.y = sx < 0 ? 0.36 : -0.36;
        group.add(panel);
      });

      // Olympic Torch Cauldron with flickering flame
      const cauldronMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3, metalness: 0.8 }));
      const cauldronPillar = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(1.1, 1.8, 28, 12)), cauldronMat);
      cauldronPillar.position.set(0, 12, -52);
      const cauldronBowl = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(3.4, 1.2, 2.4, 14)), cauldronMat);
      cauldronBowl.position.set(0, 26.8, -52);
      const torchFlame = new THREE.Mesh(
        trackGeo(new THREE.ConeGeometry(1.8, 5.2, 10)),
        trackMat(new THREE.MeshBasicMaterial({ color: 0xfb923c }))
      );
      torchFlame.position.set(0, 30.2, -52);
      group.add(cauldronPillar, cauldronBowl, torchFlame);

      // Han River Water Ribbon + Illuminated Arched Bridge + Lotte World Tower (555m)
      const hanRiver = createAnimatedOcean(group, disposables, {
        width: 560,
        depth: 120,
        y: -2.08,
        z: -158,
        color: 0x1e1b4b,
        emissive: 0x3b82f6,
        emissiveIntensity: 0.28,
      });
      const hanBridgeRoad = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(280, 1.6, 5.2)),
        trackMat(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 }))
      );
      hanBridgeRoad.position.set(0, 6.2, -142);
      const hanBridgeArch = new THREE.Mesh(
        trackGeo(new THREE.TorusGeometry(28, 0.75, 8, 24, Math.PI)),
        kpopMagenta
      );
      hanBridgeArch.position.set(-28, 6.2, -142);
      const hanBridgeArchR = hanBridgeArch.clone();
      hanBridgeArchR.position.set(28, 6.2, -142);
      group.add(hanBridgeRoad, hanBridgeArch, hanBridgeArchR);

      const lotteSpire = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(9.5, 134, 6)), kpopMagenta);
      lotteSpire.position.set(78, 65, -195);
      group.add(lotteSpire);

      addDistantCitySkyline(group, disposables, {
        count: 102,
        minRadius: 132,
        maxRadius: 270,
        minHeight: 24,
        maxHeight: 90,
        accentHex: 0xec4899,
        baseColor: 0x0d0f24,
      });
      addPerimeterSearchlights(group, disposables, dynamicElements, {
        radius: 68,
        centerZ: 5,
        colors: [0xec4899, 0x22d3ee, 0xc084fc],
      });

      venueTick = (_dt, t) => {
        hanRiver.uniforms.uTime.value = t;
        torchFlame.scale.set(
          0.92 + Math.sin(t * 14) * 0.14,
          0.86 + Math.sin(t * 19) * 0.24,
          0.92 + Math.cos(t * 16) * 0.14
        );
      };

      dynamicElements.bowlLights = addStadiumSeatingBowl(group, disposables, {
        venueName: 'SEOUL OLYMPIC STADIUM',
        radiusX: 35,
        radiusZ: 32,
        centerZ: 5.0,
        tiers: 4,
        lightstickPalette: overlayMeta.laserColors || [0xec4899, 0x22d3ee, 0xc084fc, 0xfacc15],
        seatColor: palette.seatColor,
        fasciaColor: effectiveFascia,
        secondaryColor,
        dynamicElements,
      });
      break;
    }

    default:
      break;
  }

  // Layer the chosen Stage Theme / Event Overlay cleanly over this real-life venue
  const overlayTick = attachStageOverlay(group, disposables, overlayMeta.id, dynamicElements);

  // Atmosphere & Sky Dome driver synced smoothly with LightingProfileController
  dynamicElements.updateAtmosphere = (lightState, isGrandEncore = false, dt = 0.016) => {
    const skyMat = dynamicElements.skyMat;
    if (skyMat?.uniforms) {
      if (lightState?.skyTopColor) {
        skyMat.uniforms.uTopColor.value.lerp(lightState.skyTopColor, 1 - Math.exp(-3.2 * dt));
      }
      if (lightState?.skyMidColor) {
        skyMat.uniforms.uMidColor.value.lerp(lightState.skyMidColor, 1 - Math.exp(-3.2 * dt));
      }
      if (lightState?.skyHorizonColor) {
        skyMat.uniforms.uHorizonColor.value.lerp(lightState.skyHorizonColor, 1 - Math.exp(-3.2 * dt));
      }
      if (isGrandEncore) {
        _tmpSkyColor.setHex(0x02040d);
        skyMat.uniforms.uTopColor.value.lerp(_tmpSkyColor, 1 - Math.exp(-3.5 * dt));
      }
      skyMat.uniforms.uGrandEncoreMix.value = THREE.MathUtils.damp(
        skyMat.uniforms.uGrandEncoreMix.value,
        isGrandEncore ? 1.0 : 0.0,
        3.2,
        dt
      );
    }
  };

  dynamicElements.update = (dt, t, overallEnergy = 0, envState = null) => {
    if (dynamicElements.skyMat?.uniforms) {
      dynamicElements.skyMat.uniforms.uTime.value = t;
    }
    const lightState = envState?.lightState || null;
    const isGrandEncore = Boolean(envState?.isGrandEncore);
    if (lightState || isGrandEncore) {
      dynamicElements.updateAtmosphere(lightState, isGrandEncore, dt);
    }

    // Scroll 360° Arena LED Ribbon Scoreboards continuously with tempo/mood
    const ribbonSpeed = lightState?.ribbonScrollSpeed ?? (0.06 + overallEnergy * 0.08);
    for (let i = 0; i < dynamicElements.scrollingRibbons.length; i += 1) {
      dynamicElements.scrollingRibbons[i].offset.x = (dynamicElements.scrollingRibbons[i].offset.x + dt * ribbonSpeed) % 1;
    }

    // Sweep Exterior Sky-Tracker Searchlights across the night sky
    const slIntensity = lightState?.searchlightIntensity ?? (0.45 + overallEnergy * 0.65);
    const slSpeed = lightState?.searchlightSpeed ?? 0.55;
    for (let i = 0; i < dynamicElements.searchlights.length; i += 1) {
      const sl = dynamicElements.searchlights[i];
      sl.beamMat.uniforms.uIntensity.value = slIntensity;
      if (lightState && i % 2 === 0 && lightState.spotPrimary) {
        sl.beamMat.uniforms.uColor.value.lerp(lightState.spotPrimary, 0.08);
      } else if (lightState && i % 2 === 1 && lightState.spotSecondary) {
        sl.beamMat.uniforms.uColor.value.lerp(lightState.spotSecondary, 0.08);
      }
      sl.pivot.rotation.z = Math.sin(t * slSpeed + sl.phase) * 0.42;
      sl.pivot.rotation.x = Math.cos(t * (slSpeed * 0.82) + sl.phase) * 0.34;
    }

    if (venueTick) venueTick(dt, t, overallEnergy);
    if (overlayTick) overlayTick(dt, t, overallEnergy);
  };

  if (!dynamicElements.skyDome && group.userData.skyDome) {
    dynamicElements.skyDome = group.userData.skyDome;
    dynamicElements.skyMat = group.userData.skyMat;
  }

  const stageTheme = getVenueStageTheme(meta.id, overlayMeta.id);

  return {
    meta,
    overlayMeta,
    stageTheme,
    group,
    dynamicElements,
    dispose() {
      while (group.children.length > 0) {
        group.remove(group.children[0]);
      }
      dynamicElements.pulseMaterials.length = 0;
      dynamicElements.scrollingRibbons.length = 0;
      dynamicElements.rotatingRings.length = 0;
      dynamicElements.retractableRoofMeshes.length = 0;
      dynamicElements.searchlights.length = 0;
      dynamicElements.skyDome = null;
      dynamicElements.skyMat = null;
      dynamicElements.update = null;
      dynamicElements.updateBowl = null;
      dynamicElements.updateAtmosphere = null;
      disposables.geometries.forEach((g) => g.dispose());
      disposables.materials.forEach((m) => m.dispose());
      disposables.textures.forEach((t) => t.dispose());
    },
  };
}

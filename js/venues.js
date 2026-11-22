/**
 * venues.js
 * 10 Real-World 3D Concert Venue Environments for Three.js:
 *   1. Philippine Arena (Bulacan, PH)
 *   2. SM Mall of Asia Arena (Pasay, PH)
 *   3. Smart Araneta Coliseum (Quezon City, PH)
 *   4. UP Sunken Garden (Quezon City, PH)
 *   5. Intramuros Open Grounds (Manila, PH)
 *   6. Tokyo Dome (Tokyo, Japan)
 *   7. Wembley Stadium (London, UK)
 *   8. Red Rocks Amphitheatre (Colorado, USA)
 *   9. Madison Square Garden (New York, USA)
 *  10. Coachella Main Stage (California, USA)
 *
 * Every venue builds distinct 3D stadium architecture, sky/roof dome, lighting palette,
 * seating/terrain perimeters, and crowd atmosphere with zero external textures.
 */

import * as THREE from 'three';

export const VENUES = [
  /* ===================== 6 EXTRAVAGANT 3D STAGE THEMES ===================== */
  {
    id: 'christmas-wonderland',
    name: '🎄 Christmas Wonderland',
    location: 'North Pole Ice Arena',
    type: 'Holiday Spectacular',
    supportsAerialFireworks: true,
    skyColor: 0x071329,
    fogColor: 0x0c1f3d,
    fogDensity: 0.013,
    hemiSky: 0xbae6fd,
    hemiGround: 0x1e293b,
    keyColor: 0xfef3c7,
    keyIntensity: 0.86,
    accentHex: 0x38bdf8,
    laserColors: [0x38bdf8, 0xfacc15, 0xef4444, 0x4ade80],
    fireworksCeilingY: 17.5,
    description: 'Giant illuminated 3D Christmas tree, candy-cane trusses, wrapped stage gifts, fairy lights & falling snow.',
  },
  {
    id: 'halloween-cathedral',
    name: '🎃 Haunted Cathedral',
    location: 'Midnight Gothic Abbey',
    type: 'Spooky Spectacle',
    supportsAerialFireworks: true,
    skyColor: 0x0d0618,
    fogColor: 0x1a0b2e,
    fogDensity: 0.016,
    hemiSky: 0xa855f7,
    hemiGround: 0x142611,
    keyColor: 0xfdba74,
    keyIntensity: 0.74,
    accentHex: 0xa855f7,
    laserColors: [0xa855f7, 0x4ade80, 0xf97316, 0xe879f9],
    fireworksCeilingY: 16.5,
    description: 'Gothic stone arches, towering organ pipes, glowing jack-o-lanterns, floating candle lanterns & cauldron mist.',
  },
  {
    id: 'sakura-festival',
    name: '🌸 Cherry Blossom Festival',
    location: 'Kyoto Sakura Shrine',
    type: 'Spring Matsuri',
    supportsAerialFireworks: true,
    skyColor: 0x180c24,
    fogColor: 0x261233,
    fogDensity: 0.012,
    hemiSky: 0xf9a8d4,
    hemiGround: 0x1f1426,
    keyColor: 0xfde68a,
    keyIntensity: 0.82,
    accentHex: 0xf472b6,
    laserColors: [0xf472b6, 0xfef08a, 0xfb7185, 0x38bdf8],
    fireworksCeilingY: 17.5,
    description: 'Crimson Torii gate framing the stage, blooming sakura trees, glowing paper lanterns & drifting pink petals.',
  },
  {
    id: 'cyber-tokyo',
    name: '🌃 Cyber Neon Tokyo',
    location: 'Shibuya Skydeck 2099',
    type: 'Cyberpunk Rooftop',
    supportsAerialFireworks: true,
    skyColor: 0x050312,
    fogColor: 0x0c0624,
    fogDensity: 0.014,
    hemiSky: 0x22d3ee,
    hemiGround: 0x2a0836,
    keyColor: 0xf0abfc,
    keyIntensity: 0.82,
    accentHex: 0x22d3ee,
    laserColors: [0x22d3ee, 0xec4899, 0xa855f7, 0xfacc15],
    fireworksCeilingY: 18.0,
    description: 'Holographic kanji billboards, towering neon skyscrapers, laser-grid floor & falling neon sparks.',
  },
  {
    id: 'royal-opera',
    name: '👑 Royal Gold Opera',
    location: 'Grand Palais Impérial',
    type: 'Gilded Gala',
    supportsAerialFireworks: false,
    continuousIndoorFountains: true,
    skyColor: 0x17060a,
    fogColor: 0x22080f,
    fogDensity: 0.015,
    hemiSky: 0xfde047,
    hemiGround: 0x330a14,
    keyColor: 0xfef3c7,
    keyIntensity: 0.86,
    accentHex: 0xfacc15,
    laserColors: [0xfacc15, 0xf43f5e, 0xfef08a, 0xfb923c],
    fireworksCeilingY: 14.5,
    description: 'Crimson velvet curtains, golden crystal chandeliers, marble columns & continuous golden spark fountains.',
  },
  {
    id: 'tropical-beach',
    name: '🌴 Tropical Beach Fest',
    location: 'Boracay Sunset Cove',
    type: 'Sunset Paradise',
    supportsAerialFireworks: true,
    skyColor: 0x1d0f2b,
    fogColor: 0x2b162a,
    fogDensity: 0.011,
    hemiSky: 0xfb923c,
    hemiGround: 0x2e1f14,
    keyColor: 0xfde68a,
    keyIntensity: 0.88,
    accentHex: 0xf97316,
    laserColors: [0xf97316, 0xfacc15, 0x22d3ee, 0xf472b6],
    fireworksCeilingY: 18.0,
    description: 'Flickering tiki torches, colorful surfboards, tropical palms & shimmering golden-hour sunset ocean.',
  },

  /* ===================== 10 CLASSIC REAL-WORLD VENUES ===================== */
  {
    id: 'philippine-arena',
    name: 'Philippine Arena',
    location: 'Bulacan, PH',
    type: 'Mega Dome',
    supportsAerialFireworks: true,
    skyColor: 0x050814,
    fogColor: 0x060a18,
    fogDensity: 0.015,
    hemiSky: 0x7dd3fc,
    hemiGround: 0x0f172a,
    keyColor: 0xe0f2fe,
    keyIntensity: 0.72,
    accentHex: 0x38bdf8,
    laserColors: [0x38bdf8, 0xf43f5e, 0xfacc15, 0xa855f7],
    fireworksCeilingY: 16.5,
    description: 'Sweeping radial steel dome trusses, massive lightstick bowls, and dual mega-LED screens.',
  },
  {
    id: 'moa-arena',
    name: 'SM Mall of Asia Arena',
    location: 'Pasay, PH',
    type: 'Indoor Arena',
    supportsAerialFireworks: false,
    skyColor: 0x040916,
    fogColor: 0x050c1d,
    fogDensity: 0.02,
    hemiSky: 0x38bdf8,
    hemiGround: 0x0c1428,
    keyColor: 0xbae6fd,
    keyIntensity: 0.75,
    accentHex: 0x06b6d4,
    laserColors: [0x06b6d4, 0x3b82f6, 0x22d3ee, 0xe0f2fe],
    fireworksCeilingY: 13.0,
    description: 'Sleek blue-and-cyan eye-shaped indoor arena with wrap-around LED ribbon boards.',
  },
  {
    id: 'araneta-coliseum',
    name: 'Smart Araneta Coliseum',
    location: 'Quezon City, PH',
    type: 'Historic Dome',
    supportsAerialFireworks: false,
    skyColor: 0x100906,
    fogColor: 0x130b07,
    fogDensity: 0.02,
    hemiSky: 0xfde68a,
    hemiGround: 0x1c120c,
    keyColor: 0xfef3c7,
    keyIntensity: 0.78,
    accentHex: 0xf59e0b,
    laserColors: [0xf59e0b, 0xfbbf24, 0xf97316, 0xfef08a],
    fireworksCeilingY: 13.5,
    description: 'Iconic Big Dome ribbed ceiling architecture with warm amber/gold heritage lighting.',
  },
  {
    id: 'up-sunken-garden',
    name: 'UP Sunken Garden',
    location: 'Quezon City, PH',
    type: 'Open-Air Festival',
    supportsAerialFireworks: true,
    skyColor: 0x0c1026,
    fogColor: 0x101630,
    fogDensity: 0.013,
    hemiSky: 0x818cf8,
    hemiGround: 0x112416,
    keyColor: 0xfde68a,
    keyIntensity: 0.72,
    accentHex: 0x4ade80,
    laserColors: [0x4ade80, 0xfacc15, 0x38bdf8, 0xf472b6],
    fireworksCeilingY: 17.0,
    description: 'Twilight college music festival field framed by acacia trees, string lights, and starry dusk sky.',
  },
  {
    id: 'intramuros',
    name: 'Intramuros Open Grounds',
    location: 'Manila, PH',
    type: 'Heritage Open-Air',
    supportsAerialFireworks: true,
    skyColor: 0x090814,
    fogColor: 0x120e18,
    fogDensity: 0.014,
    hemiSky: 0xfdba74,
    hemiGround: 0x1c1614,
    keyColor: 0xfed7aa,
    keyIntensity: 0.76,
    accentHex: 0xfb923c,
    laserColors: [0xfb923c, 0xfacc15, 0xf43f5e, 0x38bdf8],
    fireworksCeilingY: 17.5,
    description: 'Spanish-era stone wall battlements and warm heritage uplighting under a night sky.',
  },
  {
    id: 'tokyo-dome',
    name: 'Tokyo Dome',
    location: 'Tokyo, Japan',
    type: 'Air-Dome',
    supportsAerialFireworks: true,
    skyColor: 0x080c1c,
    fogColor: 0x0a1024,
    fogDensity: 0.015,
    hemiSky: 0xc4b5fd,
    hemiGround: 0x0f172a,
    keyColor: 0xf8fafc,
    keyIntensity: 0.8,
    accentHex: 0xc084fc,
    laserColors: [0xe879f9, 0x38bdf8, 0x22d3ee, 0xf43f5e],
    fireworksCeilingY: 16.5,
    description: 'Pressurized white diamond membrane roof grid, synchronized rainbow penlights, and sci-fi lasers.',
  },
  {
    id: 'wembley',
    name: 'Wembley Stadium',
    location: 'London, UK',
    type: 'Open Stadium',
    supportsAerialFireworks: true,
    skyColor: 0x050814,
    fogColor: 0x070d1e,
    fogDensity: 0.012,
    hemiSky: 0x93c5fd,
    hemiGround: 0x0f172a,
    keyColor: 0xe0f2fe,
    keyIntensity: 0.74,
    accentHex: 0xef4444,
    laserColors: [0xef4444, 0x38bdf8, 0xf8fafc, 0xfacc15],
    fireworksCeilingY: 18.0,
    description: 'Open-night stadium crowned by the towering illuminated Wembley Arch and massive stands.',
  },
  {
    id: 'red-rocks',
    name: 'Red Rocks Amphitheatre',
    location: 'Colorado, USA',
    type: 'Canyon Open-Air',
    supportsAerialFireworks: true,
    skyColor: 0x080614,
    fogColor: 0x120a18,
    fogDensity: 0.013,
    hemiSky: 0xfb923c,
    hemiGround: 0x26120e,
    keyColor: 0xffedd5,
    keyIntensity: 0.76,
    accentHex: 0xea580c,
    laserColors: [0xf97316, 0xfacc15, 0xf43f5e, 0x38bdf8],
    fireworksCeilingY: 17.5,
    description: 'Towering red sandstone rock monoliths flanking the stage under a deep desert night sky.',
  },
  {
    id: 'madison-square-garden',
    name: 'Madison Square Garden',
    location: 'New York, USA',
    type: 'Iconic Arena',
    supportsAerialFireworks: false,
    skyColor: 0x080812,
    fogColor: 0x0c0b18,
    fogDensity: 0.02,
    hemiSky: 0xa5b4fc,
    hemiGround: 0x12101d,
    keyColor: 0xf1f5f9,
    keyIntensity: 0.74,
    accentHex: 0x6366f1,
    laserColors: [0x818cf8, 0xf43f5e, 0x38bdf8, 0xfacc15],
    fireworksCeilingY: 13.0,
    description: 'Circular ceiling truss rig, classic arena haze, and dramatic vertical spotlight shafts.',
  },
  {
    id: 'coachella',
    name: 'Coachella Main Stage',
    location: 'California, USA',
    type: 'Desert Festival',
    supportsAerialFireworks: true,
    skyColor: 0x160b24,
    fogColor: 0x23102e,
    fogDensity: 0.012,
    hemiSky: 0xf472b6,
    hemiGround: 0x29151c,
    keyColor: 0xfde68a,
    keyIntensity: 0.78,
    accentHex: 0xf472b6,
    laserColors: [0xf472b6, 0xfb923c, 0xfacc15, 0x22d3ee],
    fireworksCeilingY: 18.0,
    description: 'Ultra-wide desert festival stage with palm silhouettes, sunset-to-night sky, and giant speaker arrays.',
  },
];

export function getVenueById(venueId) {
  return VENUES.find((v) => v.id === venueId) || VENUES[0];
}

/**
 * Generates a procedural sky dome CanvasTexture (starry night, twilight dusk, or desert sunset).
 */
function createSkyDomeTexture(topHex, midHex, horizonHex, addStars = true) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, topHex);
  grad.addColorStop(0.55, midHex);
  grad.addColorStop(0.84, horizonHex);
  grad.addColorStop(1.0, '#05060b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  if (addStars) {
    for (let i = 0; i < 240; i += 1) {
      const x = (Math.sin(i * 12.9898) * 43758.5453) % 1;
      const y = (Math.sin(i * 78.233) * 19341.23) % 1;
      const sx = Math.abs(x) * 512;
      const sy = Math.abs(y) * 155;
      const r = (i % 7 === 0) ? 1.8 : 1.0;
      const a = 0.35 + (i % 5) * 0.14;
      ctx.fillStyle = `rgba(255, 255, 255, ${a.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Generates a procedural LED Mega-Screen Concert Visual texture.
 */
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

  // Equalizer wave bars
  for (let i = 0; i < 32; i += 1) {
    const h = 36 + Math.abs(Math.sin(i * 0.45)) * 130;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.22)' : secondaryHex;
    ctx.fillRect(14 + i * 15.2, 236 - h, 10, h);
  }

  ctx.fillStyle = 'rgba(4, 7, 15, 0.55)';
  ctx.fillRect(0, 82, 512, 92);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 42px Oswald, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title.toUpperCase(), 256, 118);

  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 18px Oswald, sans-serif';
  ctx.fillText('LIVE WORLD TOUR', 256, 154);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Generates a subtle procedural stone block texture for Intramuros battlements.
 */
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

/**
 * Generates a festive red-and-white diagonal candy-cane stripe texture for Christmas trusses.
 */
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

/**
 * Generates a glowing cyberpunk holographic kanji billboard texture for Cyber Neon Tokyo.
 */
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

  // Neon outer frame & scanlines
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 10;
  ctx.strokeRect(10, 10, 236, 492);
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  for (let y = 0; y < 512; y += 8) {
    ctx.fillRect(16, y, 224, 2);
  }

  // Vertical glowing Japanese characters
  ctx.fillStyle = accentHex;
  ctx.shadowColor = accentHex;
  ctx.shadowBlur = 18;
  ctx.font = 'bold 74px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const chars = Array.from(mainText);
  chars.forEach((ch, idx) => {
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

/**
 * Generates a neon perspective laser grid texture for Cyber Tokyo rooftop floor.
 */
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
  tex.repeat.set(14, 14);
  return tex;
}

/**
 * Helper to create instanced tiered stadium seating bowls with glowing crowd lightsticks.
 */
function addStadiumSeatingBowl(group, disposables, {
  radiusX = 24,
  radiusZ = 20,
  tiers = 3,
  lightstickPalette = [0x38bdf8, 0xf8fafc, 0xfacc15],
  arcStart = Math.PI * 0.08,
  arcEnd = Math.PI * 0.92,
  includeBackTiers = false,
  seatColor = 0x111726,
}) {
  const tierMat = new THREE.MeshStandardMaterial({
    color: seatColor,
    roughness: 0.78,
    metalness: 0.14,
  });
  disposables.materials.push(tierMat);

  // Tiered balcony decks wrapping left, right, and rear-sides
  const sides = includeBackTiers ? [-1, 1, 0] : [-1, 1];
  for (let t = 0; t < tiers; t += 1) {
    const y = 1.4 + t * 3.1;
    const rx = radiusX + t * 2.8;
    const rz = radiusZ + t * 2.4;

    if (sides.includes(-1)) {
      const leftStand = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.1, rz * 1.4), tierMat);
      leftStand.position.set(-rx * 0.72, y, 0.5);
      leftStand.rotation.y = 0.22;
      disposables.geometries.push(leftStand.geometry);
      group.add(leftStand);
    }
    if (sides.includes(1)) {
      const rightStand = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.1, rz * 1.4), tierMat);
      rightStand.position.set(rx * 0.72, y, 0.5);
      rightStand.rotation.y = -0.22;
      disposables.geometries.push(rightStand.geometry);
      group.add(rightStand);
    }
    if (includeBackTiers) {
      const backCurve = new THREE.Mesh(
        new THREE.CylinderGeometry(rx * 0.85, rx * 0.88, 1.1, 24, 1, true, Math.PI * 0.78, Math.PI * 0.44),
        tierMat
      );
      backCurve.material.side = THREE.DoubleSide;
      backCurve.position.set(0, y + 1.0, -4.0);
      disposables.geometries.push(backCurve.geometry);
      group.add(backCurve);
    }
  }

  // Packed distant crowd lightsticks in the upper bowls (InstancedMesh)
  const count = tiers * 84;
  const dotGeo = new THREE.SphereGeometry(0.11, 6, 6);
  const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  disposables.geometries.push(dotGeo);
  disposables.materials.push(dotMat);

  const bowlLights = new THREE.InstancedMesh(dotGeo, dotMat, count);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  for (let i = 0; i < count; i += 1) {
    const tierIdx = i % tiers;
    const frac = Math.floor(i / tiers) / Math.max(1, Math.floor(count / tiers) - 1);
    const side = i % 2 === 0 ? -1 : 1;
    const angle = arcStart + frac * (arcEnd - arcStart);

    const rx = (radiusX - 1.2) + tierIdx * 2.7;
    const rz = radiusZ + tierIdx * 2.2;
    const x = side * (rx * 0.68 + Math.sin(angle) * 2.2);
    const z = -10 + frac * 18;
    const y = 2.2 + tierIdx * 3.1 + (Math.sin(i * 4.7) * 0.35);

    dummy.position.set(x, y, z);
    dummy.scale.setScalar(0.8 + (i % 4) * 0.18);
    dummy.updateMatrix();
    bowlLights.setMatrixAt(i, dummy.matrix);

    const hex = lightstickPalette[i % lightstickPalette.length];
    color.setHex(hex);
    bowlLights.setColorAt(i, color);
  }
  bowlLights.instanceMatrix.needsUpdate = true;
  if (bowlLights.instanceColor) bowlLights.instanceColor.needsUpdate = true;
  bowlLights.frustumCulled = false;
  group.add(bowlLights);

  return bowlLights;
}

/**
 * Helper to create a procedural open-air sky dome sphere.
 */
function addSkyDome(group, disposables, topHex, midHex, horizonHex, addStars = true) {
  const tex = createSkyDomeTexture(topHex, midHex, horizonHex, addStars);
  const geo = new THREE.SphereGeometry(54, 24, 16);
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false });
  disposables.textures.push(tex);
  disposables.geometries.push(geo);
  disposables.materials.push(mat);
  const dome = new THREE.Mesh(geo, mat);
  dome.position.y = 4;
  group.add(dome);
}

/**
 * Helper to add extended outdoor ground plane so open-air venues have a natural horizon perimeter.
 */
function addOutdoorGround(group, disposables, groundColor = 0x0d1b12) {
  const geo = new THREE.CircleGeometry(56, 36);
  geo.rotateX(-Math.PI * 0.5);
  const mat = new THREE.MeshStandardMaterial({
    color: groundColor,
    roughness: 0.94,
    metalness: 0.04,
  });
  disposables.geometries.push(geo);
  disposables.materials.push(mat);
  const ground = new THREE.Mesh(geo, mat);
  ground.position.y = -1.22;
  group.add(ground);
}

/**
 * Builds the complete 3D architectural environment for the chosen real-world concert venue.
 * @param {string} venueId
 */
export function buildVenueEnvironment(venueId) {
  const meta = getVenueById(venueId);
  const group = new THREE.Group();
  const disposables = { geometries: [], materials: [], textures: [] };
  const dynamicElements = {
    pulseMaterials: [],
    rotatingRings: [],
    bowlLights: null,
    update: null,
  };

  const trackGeo = (g) => { disposables.geometries.push(g); return g; };
  const trackMat = (m) => { disposables.materials.push(m); return m; };
  const trackTex = (t) => { disposables.textures.push(t); return t; };

  switch (meta.id) {
    /* ======================================================================
       EXTRAVAGANT 3D STAGE THEME 1: 🎄 CHRISTMAS WINTER WONDERLAND
       ====================================================================== */
    case 'christmas-wonderland': {
      addSkyDome(group, disposables, '#040a1d', '#0d2247', '#1e3a5f', true);
      addOutdoorGround(group, disposables, 0xdbeafe);

      // Snow-covered mounds & glowing ice floor apron around stage
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

      // Giant illuminated 3D Christmas Tree towering behind the stage!
      const treeGroup = new THREE.Group();
      treeGroup.position.set(0, -0.5, -10.2);
      const trunk = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.65, 0.95, 2.8, 10)), trunkMat);
      trunk.position.y = 1.4;
      treeGroup.add(trunk);

      const tiers = [
        { y: 4.2, r: 4.8, h: 4.6 },
        { y: 7.2, r: 3.85, h: 4.1 },
        { y: 9.8, r: 2.9, h: 3.6 },
        { y: 12.1, r: 1.95, h: 3.1 },
        { y: 14.0, r: 1.1, h: 2.4 },
      ];
      tiers.forEach((t) => {
        const cone = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(t.r, t.h, 14)), pineMat);
        cone.position.y = t.y;
        treeGroup.add(cone);
        // Snowy rim accents
        const snowTrim = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(t.r * 0.92, 0.12, 6, 20)), snowMat);
        snowTrim.rotation.x = Math.PI * 0.5;
        snowTrim.position.y = t.y - t.h * 0.44;
        treeGroup.add(snowTrim);
      });

      // Glowing 3D Star Topper crowning the tree
      const starTop = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(0.85, 0)), goldGlow);
      starTop.position.set(0, 15.65, 0);
      treeGroup.add(starTop);
      dynamicElements.rotatingRings.push(starTop);

      // Glowing ornaments spiraling around the giant Christmas Tree (InstancedMesh)
      const ornColors = [0xef4444, 0xfacc15, 0x38bdf8, 0xf472b6, 0x4ade80];
      const ornCount = 68;
      const ornGeo = trackGeo(new THREE.SphereGeometry(0.19, 8, 8));
      const ornMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xffffff }));
      const ornaments = new THREE.InstancedMesh(ornGeo, ornMat, ornCount);
      const ornDummy = new THREE.Object3D();
      const ornCol = new THREE.Color();
      for (let i = 0; i < ornCount; i += 1) {
        const frac = i / ornCount;
        const y = 2.6 + frac * 11.4;
        const radius = (1 - frac * 0.84) * 4.45;
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

      // Candy-cane striped stage truss pillars framing stage left & right
      const candyTex = trackTex(createCandyCaneTexture());
      const candyMat = trackMat(new THREE.MeshStandardMaterial({ map: candyTex, roughness: 0.35, metalness: 0.12 }));
      [-8.8, 8.8].forEach((px) => {
        const pillar = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.42, 0.46, 10.2, 14)), candyMat);
        pillar.position.set(px, 4.3, -4.6);
        const cap = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.54, 12, 10)), goldGlow);
        cap.position.set(px, 9.5, -4.6);
        group.add(pillar, cap);
      });

      // Giant wrapped Christmas gift boxes with golden bows on stage wings
      const giftSpecs = [
        { x: -7.2, z: -2.4, w: 1.5, h: 1.35, d: 1.4, col: 0xdc2626, rib: 0xfacc15, ry: 0.25 },
        { x: -5.8, z: -3.2, w: 1.05, h: 0.95, d: 1.05, col: 0x0284c7, rib: 0xf8fafc, ry: -0.35 },
        { x: 7.2, z: -2.4, w: 1.55, h: 1.4, d: 1.45, col: 0x16a34a, rib: 0xfacc15, ry: -0.22 },
        { x: 5.9, z: -3.1, w: 1.0, h: 1.15, d: 1.0, col: 0xec4899, rib: 0xfef08a, ry: 0.4 },
      ];
      giftSpecs.forEach((gs) => {
        const boxGroup = new THREE.Group();
        const bMat = trackMat(new THREE.MeshStandardMaterial({ color: gs.col, roughness: 0.36, metalness: 0.16 }));
        const rMat = trackMat(new THREE.MeshStandardMaterial({ color: gs.rib, roughness: 0.26, metalness: 0.65 }));
        const box = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(gs.w, gs.h, gs.d)), bMat);
        box.position.y = gs.h * 0.5;
        const rib1 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(gs.w + 0.04, gs.h + 0.04, 0.2)), rMat);
        rib1.position.y = gs.h * 0.5;
        const rib2 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.2, gs.h + 0.04, gs.d + 0.04)), rMat);
        rib2.position.y = gs.h * 0.5;
        const bowL = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.22, 0.06, 6, 12)), rMat);
        bowL.position.set(-0.18, gs.h + 0.14, 0);
        bowL.rotation.y = 0.5;
        const bowR = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.22, 0.06, 6, 12)), rMat);
        bowR.position.set(0.18, gs.h + 0.14, 0);
        bowR.rotation.y = -0.5;
        boxGroup.add(box, rib1, rib2, bowL, bowR);
        boxGroup.position.set(gs.x, 0.0, gs.z);
        boxGroup.rotation.y = gs.ry;
        group.add(boxGroup);
      });

      // Warm hanging fairy-light catenary garlands arching across the arena
      const bulbGeo = trackGeo(new THREE.SphereGeometry(0.12, 6, 6));
      const bulbMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xfef08a }));
      const bulbPts = [];
      [[-14, -5.5, 14, -5.5, 9.6], [-15, 2.0, 15, 2.0, 8.5]].forEach(([x1, z1, x2, z2, h]) => {
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(x1, h, z1),
          new THREE.Vector3(0, h - 2.4, z1),
          new THREE.Vector3(x2, h, z2),
        ]);
        for (let b = 1; b < 18; b += 1) bulbPts.push(curve.getPoint(b / 18));
      });
      const fairyBulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, bulbPts.length);
      bulbPts.forEach((pt, idx) => {
        ornDummy.position.copy(pt);
        ornDummy.updateMatrix();
        fairyBulbs.setMatrixAt(idx, ornDummy.matrix);
      });
      fairyBulbs.instanceMatrix.needsUpdate = true;
      group.add(fairyBulbs);

      // Animated Falling 3D Snowflakes (InstancedMesh, zero per-frame allocations!)
      const snowCount = 180;
      const flakeGeo = trackGeo(new THREE.OctahedronGeometry(0.085, 0));
      const flakeMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.88 }));
      const snowMesh = new THREE.InstancedMesh(flakeGeo, flakeMat, snowCount);
      snowMesh.frustumCulled = false;
      const flakes = [];
      for (let i = 0; i < snowCount; i += 1) {
        flakes.push({
          x: (Math.random() - 0.5) * 32,
          y: Math.random() * 16 + 0.5,
          z: (Math.random() - 0.5) * 24 - 2,
          vy: 1.1 + Math.random() * 1.4,
          phase: Math.random() * Math.PI * 2,
          scale: 0.65 + Math.random() * 0.85,
        });
      }
      group.add(snowMesh);

      const snowDummy = new THREE.Object3D();
      dynamicElements.update = (dt, t) => {
        for (let i = 0; i < snowCount; i += 1) {
          const f = flakes[i];
          f.y -= f.vy * dt;
          if (f.y < -1.0) {
            f.y = 16.5;
            f.x = (Math.random() - 0.5) * 32;
          }
          snowDummy.position.set(f.x + Math.sin(t * 0.9 + f.phase) * 0.65, f.y, f.z);
          snowDummy.rotation.set(t + f.phase, t * 0.7, 0);
          snowDummy.scale.setScalar(f.scale);
          snowDummy.updateMatrix();
          snowMesh.setMatrixAt(i, snowDummy.matrix);
        }
        snowMesh.instanceMatrix.needsUpdate = true;
      };

      dynamicElements.bowlLights = addStadiumSeatingBowl(group, disposables, {
        radiusX: 20,
        radiusZ: 17,
        tiers: 3,
        lightstickPalette: [0x38bdf8, 0xfef08a, 0xef4444, 0xffffff],
        seatColor: 0x10203a,
      });
      break;
    }

    /* ======================================================================
       EXTRAVAGANT 3D STAGE THEME 2: 🎃 HAUNTED HALLOWEEN CATHEDRAL
       ====================================================================== */
    case 'halloween-cathedral': {
      addSkyDome(group, disposables, '#090314', '#1e0b36', '#3b154c', true);
      addOutdoorGround(group, disposables, 0x120a1c);

      const stoneTex = trackTex(createStoneTexture());
      const gothicMat = trackMat(new THREE.MeshStandardMaterial({
        map: stoneTex,
        color: 0x524663,
        roughness: 0.88,
        metalness: 0.14,
      }));
      const ironMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.4, metalness: 0.85 }));
      const organMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.25, metalness: 0.88 }));
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

      // Towering Gothic Cathedral Stone Arches framing the stage
      [-9.5, -4.8, 4.8, 9.5].forEach((ax) => {
        const col = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.15, 11.5, 1.15)), gothicMat);
        col.position.set(ax, 4.8, -7.8);
        group.add(col);
      });
      [-7.15, 0, 7.15].forEach((cx, idx) => {
        const arch = new THREE.Mesh(
          trackGeo(new THREE.TorusGeometry(idx === 1 ? 4.8 : 2.35, 0.36, 8, 24, Math.PI)),
          gothicMat
        );
        arch.position.set(cx, 10.2, -7.8);
        group.add(arch);
      });

      // Towering Gothic Pipe Organ behind the drum riser
      for (let i = -8; i <= 8; i += 1) {
        const h = 4.2 + (8 - Math.abs(i)) * 0.62;
        const pipe = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.16, 0.16, h, 8)), organMat);
        pipe.position.set(i * 0.44, 1.2 + h * 0.5, -8.2);
        group.add(pipe);
      }

      // Wrought-iron spooky cemetery fence spikes on left & right wings
      [-1, 1].forEach((side) => {
        for (let k = 0; k < 6; k += 1) {
          const post = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.05, 0.06, 3.6, 6)), ironMat);
          post.position.set(side * (9.2 + k * 0.8), 0.7, -3.5 + k * 0.9);
          const tip = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.11, 0.35, 4)), ironMat);
          tip.position.set(side * (9.2 + k * 0.8), 2.65, -3.5 + k * 0.9);
          group.add(post, tip);
        }
      });

      // Cobweb wireframes spanning upper truss corners
      const webMat = trackMat(new THREE.LineBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.34 }));
      [-8.2, 8.2].forEach((wx) => {
        const webGeo = trackGeo(new THREE.WireframeGeometry(new THREE.CircleGeometry(2.6, 8, 0, Math.PI * 0.65)));
        const web = new THREE.LineSegments(webGeo, webMat);
        web.position.set(wx, 8.2, -5.0);
        web.rotation.z = wx < 0 ? -0.4 : Math.PI + 0.4;
        group.add(web);
      });

      // Glowing Jack-o'-Lantern pumpkins lining the front stage apron!
      const stemMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.8 }));
      const eyeMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xfef08a }));
      const pumpkinXs = [-6.2, -4.4, -2.6, 2.6, 4.4, 6.2];
      pumpkinXs.forEach((px, idx) => {
        const pGroup = new THREE.Group();
        const body = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.38, 12, 10)), pumpkinGlowMat);
        body.scale.set(1.18, 0.88, 1.05);
        const stem = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.05, 0.08, 0.2, 6)), stemMat);
        stem.position.y = 0.38;
        const eyeL = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.08, 0.14, 3)), eyeMat);
        eyeL.position.set(-0.14, 0.08, 0.37);
        const eyeR = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.08, 0.14, 3)), eyeMat);
        eyeR.position.set(0.14, 0.08, 0.37);
        const grin = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.28, 0.06, 0.05)), eyeMat);
        grin.position.set(0, -0.1, 0.37);
        pGroup.add(body, stem, eyeL, eyeR, grin);
        pGroup.position.set(px, 0.32, 1.2 + (idx % 2) * 0.12);
        group.add(pGroup);
      });

      // Bubbling toxic-green cauldron glow pools on stage wings
      [-7.6, 7.6].forEach((cx) => {
        const pool = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(1.1, 1.3, 0.25, 16)), toxicMat);
        pool.position.set(cx, 0.08, -2.5);
        group.add(pool);
      });

      // Floating Haunted Candle Lanterns bobbing in mid-air!
      const candleCount = 26;
      const candleBodyGeo = trackGeo(new THREE.CylinderGeometry(0.08, 0.09, 0.56, 8));
      const candleBodyMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.6 }));
      const flameGeo = trackGeo(new THREE.ConeGeometry(0.07, 0.22, 6));
      const flameMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
      const candleMesh = new THREE.InstancedMesh(candleBodyGeo, candleBodyMat, candleCount);
      const flameMesh = new THREE.InstancedMesh(flameGeo, flameMat, candleCount);
      const candles = [];
      for (let i = 0; i < candleCount; i += 1) {
        candles.push({
          x: (Math.random() - 0.5) * 20,
          baseY: 3.6 + Math.random() * 5.8,
          z: -6.5 + Math.random() * 9.5,
          phase: Math.random() * Math.PI * 2,
          speed: 0.8 + Math.random() * 0.8,
        });
      }
      group.add(candleMesh, flameMesh);
      const cDummy = new THREE.Object3D();
      dynamicElements.update = (dt, t) => {
        for (let i = 0; i < candleCount; i += 1) {
          const c = candles[i];
          const y = c.baseY + Math.sin(t * c.speed + c.phase) * 0.42;
          cDummy.position.set(c.x, y, c.z);
          cDummy.rotation.set(0, 0, Math.sin(t * 0.6 + c.phase) * 0.06);
          cDummy.scale.setScalar(1);
          cDummy.updateMatrix();
          candleMesh.setMatrixAt(i, cDummy.matrix);

          cDummy.position.set(c.x, y + 0.38, c.z);
          cDummy.scale.set(1, 0.85 + Math.sin(t * 14 + c.phase) * 0.22, 1);
          cDummy.updateMatrix();
          flameMesh.setMatrixAt(i, cDummy.matrix);
        }
        candleMesh.instanceMatrix.needsUpdate = true;
        flameMesh.instanceMatrix.needsUpdate = true;
      };

      dynamicElements.bowlLights = addStadiumSeatingBowl(group, disposables, {
        radiusX: 19,
        radiusZ: 16,
        tiers: 3,
        lightstickPalette: [0xa855f7, 0xf97316, 0x4ade80, 0xfacc15],
        seatColor: 0x160b24,
      });
      break;
    }

    /* ======================================================================
       EXTRAVAGANT 3D STAGE THEME 3: 🌸 CHERRY BLOSSOM FESTIVAL (SAKURA ARENA)
       ====================================================================== */
    case 'sakura-festival': {
      addSkyDome(group, disposables, '#140822', '#2e1342', '#70285a', true);
      addOutdoorGround(group, disposables, 0x1d1324);

      const toriiRed = trackMat(new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35, metalness: 0.14 }));
      const toriiCap = trackMat(new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.45, metalness: 0.25 }));
      const barkMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x3b2319, roughness: 0.9 }));
      const blossomMat = trackMat(new THREE.MeshStandardMaterial({
        color: 0xf9a8d4,
        emissive: 0xbe185d,
        emissiveIntensity: 0.28,
        roughness: 0.72,
      }));
      const lanternMat = trackMat(new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xf59e0b,
        emissiveIntensity: 1.75,
        roughness: 0.3,
      }));
      dynamicElements.pulseMaterials.push(lanternMat);

      // Iconic Crimson Torii Gate framing the rear drum riser!
      const torii = new THREE.Group();
      torii.position.set(0, 0, -7.8);
      [-5.2, 5.2].forEach((tx) => {
        const pillar = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.42, 0.5, 9.8, 12)), toriiRed);
        pillar.position.set(tx, 4.9, 0);
        const plinth = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.65, 0.74, 0.9, 12)), toriiCap);
        plinth.position.set(tx, 0.45, 0);
        torii.add(pillar, plinth);
      });
      const lowerBeam = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(12.6, 0.48, 0.55)), toriiRed);
      lowerBeam.position.set(0, 7.6, 0);
      const topBeam = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(14.8, 0.65, 0.82)), toriiRed);
      topBeam.position.set(0, 9.4, 0);
      const topRoof = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(15.4, 0.32, 0.96)), toriiCap);
      topRoof.position.set(0, 9.82, 0);
      const plaque = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.1, 1.45, 0.24)), toriiCap);
      plaque.position.set(0, 8.5, 0.12);
      torii.add(lowerBeam, topBeam, topRoof, plaque);
      group.add(torii);

      // Giant blooming Sakura Cherry Blossom Trees on both stage wings
      [
        { x: -10.8, z: -5.4, s: 1.25 },
        { x: 10.8, z: -5.4, s: 1.25 },
        { x: -13.5, z: 0.8, s: 1.05 },
        { x: 13.5, z: 0.8, s: 1.05 },
      ].forEach((tp) => {
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.38, 0.62, 5.4, 8)), barkMat);
        trunk.position.y = 2.6;
        tree.add(trunk);
        [
          [0, 6.2, 0, 2.8],
          [-1.8, 5.5, 0.8, 2.2],
          [1.8, 5.7, -0.5, 2.3],
          [0.4, 7.1, 0.9, 1.9],
        ].forEach(([bx, by, bz, br]) => {
          const puff = new THREE.Mesh(trackGeo(new THREE.DodecahedronGeometry(br, 1)), blossomMat);
          puff.scale.set(1.2, 0.72, 1.15);
          puff.position.set(bx, by, bz);
          tree.add(puff);
        });
        tree.position.set(tp.x, -1.0, tp.z);
        tree.scale.setScalar(tp.s);
        group.add(tree);
      });

      // Glowing Matsuri Paper Lanterns hanging along stage perimeter
      const lanternXs = [-9, -6, -3, 0, 3, 6, 9];
      lanternXs.forEach((lx) => {
        const lant = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.42, 10, 10)), lanternMat);
        lant.scale.set(0.88, 1.24, 0.88);
        lant.position.set(lx, 6.9 - Math.abs(lx) * 0.08, -4.6);
        group.add(lant);
      });

      // Drifting Pink Cherry Blossom Petals (InstancedMesh)
      const petalCount = 170;
      const petalGeo = trackGeo(new THREE.PlaneGeometry(0.18, 0.12));
      const petalMat = trackMat(new THREE.MeshBasicMaterial({
        color: 0xfbcfe8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
      }));
      const petalMesh = new THREE.InstancedMesh(petalGeo, petalMat, petalCount);
      petalMesh.frustumCulled = false;
      const petals = [];
      for (let i = 0; i < petalCount; i += 1) {
        petals.push({
          x: (Math.random() - 0.5) * 30,
          y: Math.random() * 14 + 0.5,
          z: (Math.random() - 0.5) * 22 - 2,
          vy: 0.65 + Math.random() * 0.85,
          vx: 0.55 + Math.random() * 0.6,
          phase: Math.random() * Math.PI * 2,
        });
      }
      group.add(petalMesh);
      const pDummy = new THREE.Object3D();
      dynamicElements.update = (dt, t) => {
        for (let i = 0; i < petalCount; i += 1) {
          const p = petals[i];
          p.y -= p.vy * dt;
          p.x += p.vx * dt;
          if (p.y < -0.8 || p.x > 16) {
            p.y = 14.2;
            p.x = -15 + Math.random() * 24;
          }
          pDummy.position.set(p.x, p.y, p.z + Math.sin(t * 1.4 + p.phase) * 0.5);
          pDummy.rotation.set(t * 1.8 + p.phase, t * 2.2, t + p.phase);
          pDummy.updateMatrix();
          petalMesh.setMatrixAt(i, pDummy.matrix);
        }
        petalMesh.instanceMatrix.needsUpdate = true;
      };

      dynamicElements.bowlLights = addStadiumSeatingBowl(group, disposables, {
        radiusX: 19,
        radiusZ: 16,
        tiers: 3,
        lightstickPalette: [0xf472b6, 0xfef08a, 0xfbcfe8, 0xfb7185],
        seatColor: 0x221024,
      });
      break;
    }

    /* ======================================================================
       EXTRAVAGANT 3D STAGE THEME 4: 🌃 CYBER NEON TOKYO ROOFTOP
       ====================================================================== */
    case 'cyber-tokyo': {
      addSkyDome(group, disposables, '#03020d', '#0d0626', '#260a3d', true);

      // Glowing Neon Laser-Grid Rooftop Floor
      const gridTex = trackTex(createNeonGridTexture());
      const gridFloorMat = trackMat(new THREE.MeshBasicMaterial({ map: gridTex }));
      const gridFloor = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(86, 86)), gridFloorMat);
      gridFloor.rotation.x = -Math.PI * 0.5;
      gridFloor.position.y = -1.2;
      group.add(gridFloor);

      // Towering Cyberpunk Skyscrapers ringing the rooftop skyline
      const bldgMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x0b0d1f, roughness: 0.45, metalness: 0.65 }));
      const cyanNeon = trackMat(new THREE.MeshStandardMaterial({
        color: 0x22d3ee,
        emissive: 0x22d3ee,
        emissiveIntensity: 1.85,
      }));
      const magNeon = trackMat(new THREE.MeshStandardMaterial({
        color: 0xec4899,
        emissive: 0xec4899,
        emissiveIntensity: 1.85,
      }));
      dynamicElements.pulseMaterials.push(cyanNeon, magNeon);

      const towers = [
        { x: -16, z: -15, w: 4.5, h: 24, d: 4.5, neon: cyanNeon },
        { x: -9.5, z: -18, w: 4.2, h: 28, d: 4.2, neon: magNeon },
        { x: 0, z: -21, w: 5.5, h: 32, d: 5.0, neon: cyanNeon },
        { x: 9.5, z: -18, w: 4.4, h: 27, d: 4.4, neon: magNeon },
        { x: 16, z: -15, w: 4.5, h: 23, d: 4.5, neon: cyanNeon },
        { x: -20, z: -5, w: 4.2, h: 21, d: 4.2, neon: magNeon },
        { x: 20, z: -5, w: 4.2, h: 22, d: 4.2, neon: cyanNeon },
      ];
      towers.forEach((tw) => {
        const mesh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(tw.w, tw.h, tw.d)), bldgMat);
        mesh.position.set(tw.x, tw.h * 0.5 - 2, tw.z);
        const trim = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(tw.w + 0.14, 0.25, tw.d + 0.14)), tw.neon);
        trim.position.set(tw.x, tw.h - 2.4, tw.z);
        const vertStrip = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, tw.h * 0.85, 0.18)), tw.neon);
        vertStrip.position.set(tw.x, tw.h * 0.45 - 1.2, tw.z + tw.d * 0.51);
        group.add(mesh, trim, vertStrip);
      });

      // Holographic Kanji Neon Billboards flanking the stage!
      const kanjiTexL = trackTex(createKanjiBillboardTexture('東京音楽', 'CYBER LIVE', '#22d3ee', '#070b24'));
      const kanjiTexR = trackTex(createKanjiBillboardTexture('電脳舞台', 'ENCORE 2099', '#ec4899', '#1d0624'));
      const billMatL = trackMat(new THREE.MeshBasicMaterial({ map: kanjiTexL, transparent: true, opacity: 0.94, side: THREE.DoubleSide }));
      const billMatR = trackMat(new THREE.MeshBasicMaterial({ map: kanjiTexR, transparent: true, opacity: 0.94, side: THREE.DoubleSide }));

      const billL = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(3.4, 6.8)), billMatL);
      billL.position.set(-10.8, 6.2, -6.2);
      billL.rotation.y = 0.36;
      const billR = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(3.4, 6.8)), billMatR);
      billR.position.set(10.8, 6.2, -6.2);
      billR.rotation.y = -0.36;
      group.add(billL, billR);

      // Falling Neon Rain / Digital Sparks (InstancedMesh)
      const rainCount = 150;
      const rainGeo = trackGeo(new THREE.BoxGeometry(0.04, 0.55, 0.04));
      const rainMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.72 }));
      const rainMesh = new THREE.InstancedMesh(rainGeo, rainMat, rainCount);
      rainMesh.frustumCulled = false;
      const rainDrops = [];
      const rainCol = new THREE.Color();
      for (let i = 0; i < rainCount; i += 1) {
        rainDrops.push({
          x: (Math.random() - 0.5) * 32,
          y: Math.random() * 18,
          z: (Math.random() - 0.5) * 24 - 2,
          vy: 9 + Math.random() * 7,
        });
        rainCol.setHex(i % 2 === 0 ? 0x22d3ee : 0xec4899);
        rainMesh.setColorAt(i, rainCol);
      }
      if (rainMesh.instanceColor) rainMesh.instanceColor.needsUpdate = true;
      group.add(rainMesh);
      const rDummy = new THREE.Object3D();
      dynamicElements.update = (dt) => {
        for (let i = 0; i < rainCount; i += 1) {
          const d = rainDrops[i];
          d.y -= d.vy * dt;
          if (d.y < -1.0) d.y = 17.5;
          rDummy.position.set(d.x, d.y, d.z);
          rDummy.updateMatrix();
          rainMesh.setMatrixAt(i, rDummy.matrix);
        }
        rainMesh.instanceMatrix.needsUpdate = true;
      };

      dynamicElements.bowlLights = addStadiumSeatingBowl(group, disposables, {
        radiusX: 20,
        radiusZ: 17,
        tiers: 3,
        lightstickPalette: [0x22d3ee, 0xec4899, 0xa855f7, 0xfacc15],
        seatColor: 0x0b081c,
      });
      break;
    }

    /* ======================================================================
       EXTRAVAGANT 3D STAGE THEME 5: 👑 ROYAL GOLD & CRIMSON OPERA
       ====================================================================== */
    case 'royal-opera': {
      // Grand crimson-and-gold baroque opera dome
      const hallMat = trackMat(new THREE.MeshStandardMaterial({
        color: 0x260910,
        roughness: 0.72,
        metalness: 0.18,
        side: THREE.BackSide,
      }));
      const hallDome = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(28, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.52)), hallMat);
      hallDome.scale.set(1.15, 0.74, 1.1);
      hallDome.position.set(0, 0.5, -1);
      group.add(hallDome);

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

      // Sweeping Crimson Velvet Opera Curtains framing left, right & upper proscenium arch
      [-1, 1].forEach((side) => {
        for (let f = 0; f < 4; f += 1) {
          const drape = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.65, 0.78, 10.6, 10)), velvetMat);
          drape.position.set(side * (8.4 + f * 0.85), 4.4, -4.6 + f * 0.35);
          group.add(drape);
        }
      });
      const valance = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(20.5, 1.7, 0.9)), velvetMat);
      valance.position.set(0, 9.6, -4.4);
      const goldTrim = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(20.8, 0.24, 1.0)), goldMat);
      goldTrim.position.set(0, 8.75, -4.35);
      group.add(valance, goldTrim);

      // Fluted White Marble Columns with gilded gold capitals
      [-11.8, -8.2, 8.2, 11.8].forEach((cx) => {
        const col = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.55, 0.62, 10.8, 14)), marbleMat);
        col.position.set(cx, 4.4, -6.8);
        const cap = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.45, 0.5, 1.45)), goldMat);
        cap.position.set(cx, 9.9, -6.8);
        const base = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.5, 0.6, 1.5)), goldMat);
        base.position.set(cx, -0.7, -6.8);
        group.add(col, cap, base);
      });

      // 3 Ornate Hanging Golden Crystal Chandeliers rotating gently overhead!
      [-6.5, 0, 6.5].forEach((chx, idx) => {
        const chand = new THREE.Group();
        chand.position.set(chx, idx === 1 ? 10.4 : 9.4, idx === 1 ? -1.2 : -2.6);
        const chain = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.06, 0.06, 4.0, 6)), goldMat);
        chain.position.y = 2.0;
        const ring1 = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(1.45, 0.09, 8, 22)), goldMat);
        ring1.rotation.x = Math.PI * 0.5;
        const ring2 = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.85, 0.08, 8, 18)), goldMat);
        ring2.rotation.x = Math.PI * 0.5;
        ring2.position.y = -0.65;
        const drop = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(0.35, 0)), crystalGlow);
        drop.position.y = -1.1;
        chand.add(chain, ring1, ring2, drop);
        for (let b = 0; b < 8; b += 1) {
          const a = (b / 8) * Math.PI * 2;
          const bulb = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.14, 6, 6)), crystalGlow);
          bulb.position.set(Math.cos(a) * 1.45, 0.16, Math.sin(a) * 1.45);
          chand.add(bulb);
        }
        group.add(chand);
        dynamicElements.rotatingRings.push(chand);
      });

      dynamicElements.bowlLights = addStadiumSeatingBowl(group, disposables, {
        radiusX: 18,
        radiusZ: 15,
        tiers: 3,
        lightstickPalette: [0xfacc15, 0xfef08a, 0xf43f5e, 0xffffff],
        seatColor: 0x3b0d19,
      });
      break;
    }

    /* ======================================================================
       EXTRAVAGANT 3D STAGE THEME 6: 🌴 TROPICAL SUNSET BEACH FESTIVAL
       ====================================================================== */
    case 'tropical-beach': {
      addSkyDome(group, disposables, '#160b2e', '#9d2b57', '#fb923c', true);
      addOutdoorGround(group, disposables, 0xc29b68); // Warm golden beach sand!

      // Shimmering Sunset Ocean horizon behind the stage
      const oceanMat = trackMat(new THREE.MeshStandardMaterial({
        color: 0x0e7490,
        emissive: 0xc2410c,
        emissiveIntensity: 0.35,
        roughness: 0.18,
        metalness: 0.62,
      }));
      const ocean = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(110, 42)), oceanMat);
      ocean.rotation.x = -Math.PI * 0.5;
      ocean.position.set(0, -1.12, -26);
      group.add(ocean);

      // Glowing golden-hour sun setting over the horizon
      const sunMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xfde047, fog: false }));
      const sunsetSun = new THREE.Mesh(trackGeo(new THREE.CircleGeometry(6.8, 28)), sunMat);
      sunsetSun.position.set(0, 5.2, -40);
      group.add(sunsetSun);

      // Tropical Palm Trees framing stage speakers
      const palmTrunkMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.88 }));
      const palmLeafMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.72, side: THREE.DoubleSide }));
      [
        { x: -11.5, z: -5.5, h: 10.5, lean: 0.18 },
        { x: -14.2, z: -0.5, h: 9.2, lean: 0.12 },
        { x: 11.5, z: -5.5, h: 10.8, lean: -0.18 },
        { x: 14.2, z: -0.5, h: 9.4, lean: -0.12 },
      ].forEach((p) => {
        const palm = new THREE.Group();
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(p.lean * 4, p.h * 0.55, 0),
          new THREE.Vector3(p.lean * 6, p.h, 0),
        ]);
        const trunk = new THREE.Mesh(trackGeo(new THREE.TubeGeometry(curve, 12, 0.28, 7, false)), palmTrunkMat);
        palm.add(trunk);
        const top = curve.getPoint(1);
        for (let f = 0; f < 8; f += 1) {
          const a = (f / 8) * Math.PI * 2;
          const frond = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.68, 3.8, 4)), palmLeafMat);
          frond.scale.set(1, 1, 0.22);
          frond.position.set(top.x + Math.cos(a) * 1.45, top.y - 0.35, top.z + Math.sin(a) * 1.45);
          frond.rotation.z = -Math.cos(a) * 1.15;
          frond.rotation.x = Math.sin(a) * 1.15;
          palm.add(frond);
        }
        palm.position.set(p.x, -1.2, p.z);
        group.add(palm);
      });

      // Giant colorful Surfboards planted in the sand beside the stage wings
      const surfSpecs = [
        { x: -8.2, z: -2.2, col: 0x06b6d4, stripe: 0xfef08a, rz: 0.14, ry: 0.32 },
        { x: -7.1, z: -3.4, col: 0xec4899, stripe: 0xf8fafc, rz: -0.1, ry: 0.45 },
        { x: 8.2, z: -2.2, col: 0xf97316, stripe: 0xfef08a, rz: -0.14, ry: -0.32 },
        { x: 7.1, z: -3.4, col: 0x22c55e, stripe: 0xf8fafc, rz: 0.1, ry: -0.45 },
      ];
      surfSpecs.forEach((sf) => {
        const boardGroup = new THREE.Group();
        const bMat = trackMat(new THREE.MeshStandardMaterial({ color: sf.col, roughness: 0.24, metalness: 0.12 }));
        const sMat = trackMat(new THREE.MeshStandardMaterial({ color: sf.stripe, roughness: 0.24 }));
        const board = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.14, 0.14, 3.4, 12)), bMat);
        board.scale.set(3.2, 1.0, 0.42);
        const stripe = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.14, 3.1, 0.15)), sMat);
        boardGroup.add(board, stripe);
        boardGroup.position.set(sf.x, 1.35, sf.z);
        boardGroup.rotation.set(0, sf.ry, sf.rz);
        group.add(boardGroup);
      });

      // Flickering Flame Tiki Torches lining the beach festival perimeter!
      const bambooMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.82 }));
      const flameMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xfb923c }));
      const tikiFlames = [];
      [-8.5, -5.8, 5.8, 8.5].forEach((tx, idx) => {
        const post = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.08, 0.1, 3.2, 8)), bambooMat);
        post.position.set(tx, 0.5, 1.2 + (idx % 2) * 0.3);
        const cup = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.2, 0.1, 0.38, 8)), bambooMat);
        cup.position.set(tx, 2.2, 1.2 + (idx % 2) * 0.3);
        const flame = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.18, 0.58, 7)), flameMat);
        flame.position.set(tx, 2.66, 1.2 + (idx % 2) * 0.3);
        group.add(post, cup, flame);
        tikiFlames.push({ mesh: flame, phase: idx * 1.7 });
      });

      dynamicElements.update = (dt, t) => {
        for (let i = 0; i < tikiFlames.length; i += 1) {
          const tf = tikiFlames[i];
          const flick = 0.82 + Math.sin(t * 16 + tf.phase) * 0.24 + Math.cos(t * 23 + tf.phase) * 0.12;
          tf.mesh.scale.set(0.92 + Math.sin(t * 12 + tf.phase) * 0.12, flick, 0.92);
        }
        oceanMat.emissiveIntensity = 0.3 + Math.sin(t * 1.6) * 0.08;
      };

      dynamicElements.bowlLights = addStadiumSeatingBowl(group, disposables, {
        radiusX: 19,
        radiusZ: 16,
        tiers: 2,
        lightstickPalette: [0xf97316, 0xfacc15, 0x22d3ee, 0xf472b6],
        seatColor: 0x3b2218,
      });
      break;
    }

    /* 1. PHILIPPINE ARENA (Bulacan, PH) */
    case 'philippine-arena': {
      // Sweeping mega indoor dome shell
      const domeGeo = trackGeo(new THREE.SphereGeometry(34, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.52));
      const domeMat = trackMat(new THREE.MeshStandardMaterial({
        color: 0x0b1224,
        roughness: 0.72,
        metalness: 0.25,
        side: THREE.BackSide,
      }));
      const dome = new THREE.Mesh(domeGeo, domeMat);
      dome.scale.set(1.25, 0.68, 1.1);
      dome.position.set(0, -1, -2);
      group.add(dome);

      // Sweeping radial steel dome trusses arching overhead
      const trussMat = trackMat(new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.35,
        metalness: 0.85,
      }));
      for (let i = 0; i < 10; i += 1) {
        const angle = (i / 10) * Math.PI;
        const archGeo = trackGeo(new THREE.TorusGeometry(28, 0.28, 6, 32, Math.PI));
        const arch = new THREE.Mesh(archGeo, trussMat);
        arch.position.set(0, 0, -2);
        arch.rotation.y = angle;
        arch.scale.set(1.2, 0.74, 1.0);
        group.add(arch);
      }

      // Dual Mega-Concert LED Side Jumbotron Screens flanking the stage
      const screenTex = trackTex(createLedScreenTexture('PHILIPPINE ARENA', '#0284c7', 'rgba(56,189,248,0.45)'));
      const screenMat = trackMat(new THREE.MeshBasicMaterial({ map: screenTex }));
      const frameMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.7 }));

      [-11.4, 11.4].forEach((sx) => {
        const holder = new THREE.Group();
        const frame = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(7.2, 4.3, 0.4)), frameMat);
        const screen = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(6.7, 3.8)), screenMat);
        screen.position.z = 0.22;
        holder.add(frame, screen);
        holder.position.set(sx, 5.2, -5.2);
        holder.rotation.y = sx < 0 ? 0.32 : -0.32;
        group.add(holder);
      });

      // Massive tiered seating bowls packed with glowing lightsticks
      dynamicElements.bowlLights = addStadiumSeatingBowl(group, disposables, {
        radiusX: 22,
        radiusZ: 18,
        tiers: 4,
        lightstickPalette: [0x38bdf8, 0xf8fafc, 0xf43f5e, 0xfacc15],
        includeBackTiers: true,
      });
      break;
    }

    /* 2. SM MALL OF ASIA ARENA (Pasay, PH) */
    case 'moa-arena': {
      // Sleek modern blue-and-cyan eye-shaped indoor ceiling curve
      const roofMat = trackMat(new THREE.MeshStandardMaterial({
        color: 0x08142b,
        roughness: 0.45,
        metalness: 0.48,
        side: THREE.BackSide,
      }));
      const shell = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(24, 21, 18, 32, 1, true)), roofMat);
      shell.scale.set(1.25, 1, 0.92);
      shell.position.set(0, 7.5, -1);
      group.add(shell);

      // Iconic curved eye-shaped cyan LED architectural roof ribs
      const cyanGlow = trackMat(new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        emissive: 0x06b6d4,
        emissiveIntensity: 1.5,
        roughness: 0.2,
      }));
      dynamicElements.pulseMaterials.push(cyanGlow);

      [-4.2, -1.4, 1.4, 4.2].forEach((rz) => {
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-22, 6.5, rz - 4),
          new THREE.Vector3(-10, 14.5, rz - 3),
          new THREE.Vector3(0, 16.2, rz - 3),
          new THREE.Vector3(10, 14.5, rz - 3),
          new THREE.Vector3(22, 6.5, rz - 4),
        ]);
        const rib = new THREE.Mesh(trackGeo(new THREE.TubeGeometry(curve, 28, 0.22, 6, false)), cyanGlow);
        group.add(rib);
      });

      // Wrap-around glowing blue-and-cyan LED ribbon boards
      [3.4, 7.6].forEach((ry) => {
        const ribbonGeo = trackGeo(new THREE.TorusGeometry(21, 0.24, 8, 48));
        ribbonGeo.rotateX(Math.PI * 0.5);
        const ribbon = new THREE.Mesh(ribbonGeo, cyanGlow);
        ribbon.scale.set(1.18, 1, 0.88);
        ribbon.position.set(0, ry, -1);
        group.add(ribbon);
      });

      // MOA LED side banners
      const moaTex = trackTex(createLedScreenTexture('MOA ARENA', '#0369a1', 'rgba(6,182,212,0.5)'));
      const moaMat = trackMat(new THREE.MeshBasicMaterial({ map: moaTex }));
      [-10.4, 10.4].forEach((sx) => {
        const panel = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(5.6, 3.2)), moaMat);
        panel.position.set(sx, 4.8, -4.8);
        panel.rotation.y = sx < 0 ? 0.38 : -0.38;
        group.add(panel);
      });

      dynamicElements.bowlLights = addStadiumSeatingBowl(group, disposables, {
        radiusX: 19,
        radiusZ: 16,
        tiers: 3,
        lightstickPalette: [0x06b6d4, 0x38bdf8, 0xe0f2fe, 0x3b82f6],
        seatColor: 0x0b162c,
      });
      break;
    }

    /* 3. SMART ARANETA COLISEUM (Quezon City, PH) */
    case 'araneta-coliseum': {
      // Iconic "Big Dome" ribbed hemispherical roof
      const domeMat = trackMat(new THREE.MeshStandardMaterial({
        color: 0x1b120c,
        roughness: 0.72,
        metalness: 0.2,
        side: THREE.BackSide,
      }));
      const bigDome = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(24, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.5)), domeMat);
      bigDome.scale.set(1.15, 0.72, 1.15);
      bigDome.position.set(0, 1.0, -1.5);
      group.add(bigDome);

      // 16 signature radial ceiling ribs converging at the central golden oculus ring
      const ribMat = trackMat(new THREE.MeshStandardMaterial({
        color: 0x78502c,
        roughness: 0.45,
        metalness: 0.6,
      }));
      const goldGlow = trackMat(new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xf59e0b,
        emissiveIntensity: 1.4,
      }));
      dynamicElements.pulseMaterials.push(goldGlow);

      for (let i = 0; i < 16; i += 1) {
        const a = (i / 16) * Math.PI;
        const rib = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(23.2, 0.24, 6, 32, Math.PI)), ribMat);
        rib.scale.set(1.12, 0.71, 1.12);
        rib.position.set(0, 1.0, -1.5);
        rib.rotation.y = a;
        group.add(rib);
      }

      // Warm central Big Dome chandelier / scoreboard truss ring
      const oculus = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(5.6, 0.32, 10, 32)), goldGlow);
      oculus.rotation.x = Math.PI * 0.5;
      oculus.position.set(0, 15.8, -1.5);
      group.add(oculus);
      dynamicElements.rotatingRings.push(oculus);

      // Tight, high-energy classic bowl seating
      dynamicElements.bowlLights = addStadiumSeatingBowl(group, disposables, {
        radiusX: 16.5,
        radiusZ: 14,
        tiers: 3,
        lightstickPalette: [0xf59e0b, 0xfde68a, 0xfb923c, 0xffffff],
        seatColor: 0x24160e,
      });
      break;
    }

    /* 4. UP SUNKEN GARDEN (Quezon City, PH) */
    case 'up-sunken-garden': {
      addSkyDome(group, disposables, '#080c24', '#161b40', '#31234a', true);
      addOutdoorGround(group, disposables, 0x0f2414);

      // Lush surrounding multi-part Acacia tree silhouettes ringing the sunken field
      const trunkMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x1e1612, roughness: 0.92 }));
      const canopyMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x0c2114, roughness: 0.88 }));

      const treePositions = [
        { x: -16, z: -12, s: 1.3 }, { x: -11, z: -15, s: 1.15 }, { x: -5, z: -17, s: 1.2 },
        { x: 6, z: -17, s: 1.25 }, { x: 12, z: -15, s: 1.1 }, { x: 17, z: -11, s: 1.35 },
        { x: -19, z: -4, s: 1.2 }, { x: 19, z: -4, s: 1.25 },
        { x: -18, z: 4, s: 1.05 }, { x: 18, z: 4, s: 1.05 },
      ];
      treePositions.forEach((tp) => {
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.42, 0.68, 5.2, 8)), trunkMat);
        trunk.position.y = 2.6;
        // Wide umbrella Acacia canopy built from 3 overlapping organic tiers
        const c1 = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(3.4, 10, 8)), canopyMat);
        c1.scale.set(1.45, 0.56, 1.35);
        c1.position.set(0, 5.8, 0);
        const c2 = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(2.5, 9, 7)), canopyMat);
        c2.scale.set(1.3, 0.55, 1.2);
        c2.position.set(-1.6, 5.1, 0.7);
        const c3 = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(2.4, 9, 7)), canopyMat);
        c3.scale.set(1.25, 0.55, 1.2);
        c3.position.set(1.7, 5.2, -0.5);
        tree.add(trunk, c1, c2, c3);
        tree.position.set(tp.x, -1.2, tp.z);
        tree.scale.setScalar(tp.s);
        group.add(tree);
      });

      // Warm college-fair festival string lights arching across the open grass field!
      const cableMat = trackMat(new THREE.MeshBasicMaterial({ color: 0x334155 }));
      const bulbGeo = trackGeo(new THREE.SphereGeometry(0.14, 6, 6));
      const bulbMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xfef08a }));
      const bulbPositions = [];

      [[-15, -6, 15, -6, 9.2], [-16, 2, 16, 2, 8.2]].forEach(([x1, z1, x2, z2, h]) => {
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(x1, h, z1),
          new THREE.Vector3(0, h - 2.3, z1),
          new THREE.Vector3(x2, h, z2),
        ]);
        const cable = new THREE.Mesh(trackGeo(new THREE.TubeGeometry(curve, 20, 0.03, 4, false)), cableMat);
        group.add(cable);
        for (let b = 1; b < 15; b += 1) {
          bulbPositions.push(curve.getPoint(b / 15));
        }
      });

      const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, bulbPositions.length);
      const dummy = new THREE.Object3D();
      bulbPositions.forEach((pt, idx) => {
        dummy.position.copy(pt);
        dummy.position.y -= 0.14;
        dummy.updateMatrix();
        bulbs.setMatrixAt(idx, dummy.matrix);
      });
      bulbs.instanceMatrix.needsUpdate = true;
      group.add(bulbs);

      // Festival lawn crowd lightsticks
      dynamicElements.bowlLights = addStadiumSeatingBowl(group, disposables, {
        radiusX: 17,
        radiusZ: 15,
        tiers: 2,
        lightstickPalette: [0x4ade80, 0xfef08a, 0x38bdf8, 0xf472b6],
        seatColor: 0x102817,
      });
      break;
    }

    /* 5. INTRAMUROS OPEN GROUNDS (Manila, PH) */
    case 'intramuros': {
      addSkyDome(group, disposables, '#060712', '#121024', '#2c1b1e', true);
      addOutdoorGround(group, disposables, 0x1c1714);

      const stoneTex = trackTex(createStoneTexture());
      const stoneMat = trackMat(new THREE.MeshStandardMaterial({
        map: stoneTex,
        roughness: 0.9,
        metalness: 0.05,
      }));
      const warmLampMat = trackMat(new THREE.MeshStandardMaterial({
        color: 0xfdba74,
        emissive: 0xf97316,
        emissiveIntensity: 1.6,
      }));
      dynamicElements.pulseMaterials.push(warmLampMat);

      // Spanish-era Fortification Wall Battlements wrapping behind & beside the stage
      const wallSpecs = [
        { x: 0, z: -13.5, w: 34, h: 6.2, d: 2.2, rotY: 0 },
        { x: -16.5, z: -3.5, w: 22, h: 5.8, d: 2.2, rotY: Math.PI * 0.5 },
        { x: 16.5, z: -3.5, w: 22, h: 5.8, d: 2.2, rotY: Math.PI * 0.5 },
      ];
      wallSpecs.forEach((ws) => {
        const wall = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(ws.w, ws.h, ws.d)), stoneMat);
        wall.position.set(ws.x, ws.h * 0.5 - 1.2, ws.z);
        wall.rotation.y = ws.rotY;
        group.add(wall);

        // Crenellated merlons along top of the stone walls
        const merlonCount = Math.floor(ws.w / 2.2);
        for (let m = 0; m < merlonCount; m += 1) {
          const offset = -ws.w * 0.5 + 1.1 + m * 2.2;
          const merlon = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.2, 1.05, 1.9)), stoneMat);
          if (ws.rotY === 0) {
            merlon.position.set(ws.x + offset, ws.h - 0.7, ws.z);
          } else {
            merlon.position.set(ws.x, ws.h - 0.7, ws.z + offset);
            merlon.rotation.y = ws.rotY;
          }
          group.add(merlon);
        }
      });

      // Iconic Garita (Spanish sentinel stone watchtowers) at both corners
      [-15.6, 15.6].forEach((gx) => {
        const garita = new THREE.Group();
        const base = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(1.5, 1.7, 7.6, 10)), stoneMat);
        base.position.y = 2.6;
        const cupola = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(1.75, 2.4, 10)), stoneMat);
        cupola.position.y = 7.6;
        const lantern = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.6, 0.85, 0.6)), warmLampMat);
        lantern.position.set(0, 5.8, 1.4);
        garita.add(base, cupola, lantern);
        garita.position.set(gx, 0, -12.8);
        group.add(garita);
      });

      // Warm heritage stone uplights along the rear wall
      [-10, -5, 0, 5, 10].forEach((lx) => {
        const uplight = new THREE.PointLight(0xfb923c, 16, 14, 1.5);
        uplight.position.set(lx, 0.8, -11.4);
        group.add(uplight);
      });
      break;
    }

    /* 6. TOKYO DOME (Tokyo, Japan) */
    case 'tokyo-dome': {
      // Iconic white air-supported pressurized Teflon membrane roof
      const memMat = trackMat(new THREE.MeshStandardMaterial({
        color: 0xdbeafe,
        emissive: 0x1e293b,
        emissiveIntensity: 0.45,
        roughness: 0.65,
        metalness: 0.08,
        side: THREE.BackSide,
      }));
      const roofGeo = trackGeo(new THREE.SphereGeometry(32, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.44));
      const roof = new THREE.Mesh(roofGeo, memMat);
      roof.scale.set(1.18, 0.56, 1.12);
      roof.position.set(0, 3.2, -1);
      group.add(roof);

      // Signature Tokyo Dome diagonal cable grid across the bright membrane roof
      const wireGeo = trackGeo(new THREE.WireframeGeometry(roofGeo));
      const wireMat = trackMat(new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.48 }));
      const grid = new THREE.LineSegments(wireGeo, wireMat);
      grid.scale.copy(roof.scale).multiplyScalar(0.992);
      grid.position.copy(roof.position);
      group.add(grid);

      // Sleek sci-fi LED banner wall behind stage
      const tdTex = trackTex(createLedScreenTexture('TOKYO DOME', '#7c3aed', 'rgba(34,211,238,0.5)'));
      const tdMat = trackMat(new THREE.MeshBasicMaterial({ map: tdTex }));
      const backScreen = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(16, 6.4)), tdMat);
      backScreen.position.set(0, 5.4, -7.8);
      group.add(backScreen);

      // Synchronized ocean of colorful concert penlights in multi-tier bowls!
      dynamicElements.bowlLights = addStadiumSeatingBowl(group, disposables, {
        radiusX: 21,
        radiusZ: 18,
        tiers: 4,
        lightstickPalette: [0xe879f9, 0x38bdf8, 0x4ade80, 0xfacc15, 0xf43f5e, 0xffffff],
        includeBackTiers: true,
        seatColor: 0x0d1226,
      });
      break;
    }

    /* 7. WEMBLEY STADIUM (London, UK) */
    case 'wembley': {
      addSkyDome(group, disposables, '#040712', '#0b142c', '#182442', true);
      addOutdoorGround(group, disposables, 0x0b1a12);

      // Iconic towering illuminated WEMBLEY ARCH spanning across the stadium night sky!
      const archCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-28, -1, -11),
        new THREE.Vector3(-19, 13, -12),
        new THREE.Vector3(0, 21.5, -13),
        new THREE.Vector3(19, 13, -12),
        new THREE.Vector3(28, -1, -11),
      ]);
      const archGlowMat = trackMat(new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        emissive: 0xef4444,
        emissiveIntensity: 1.35,
        roughness: 0.25,
        metalness: 0.65,
      }));
      dynamicElements.pulseMaterials.push(archGlowMat);

      const archMain = new THREE.Mesh(trackGeo(new THREE.TubeGeometry(archCurve, 44, 0.72, 10, false)), archGlowMat);
      group.add(archMain);

      // Steel truss lattice ring accents along the arch
      const ringMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.25 }));
      for (let i = 2; i <= 14; i += 1) {
        const pt = archCurve.getPoint(i / 16);
        const tan = archCurve.getTangent(i / 16);
        const ribRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.95, 0.1, 6, 12)), ringMat);
        ribRing.position.copy(pt);
        ribRing.lookAt(pt.clone().add(tan));
        group.add(ribRing);
      }

      // Massive multi-tier stadium stands
      dynamicElements.bowlLights = addStadiumSeatingBowl(group, disposables, {
        radiusX: 22,
        radiusZ: 20,
        tiers: 4,
        lightstickPalette: [0xef4444, 0xf8fafc, 0x38bdf8, 0xfacc15],
        includeBackTiers: true,
        seatColor: 0x161b2a,
      });
      break;
    }

    /* 8. RED ROCKS AMPHITHEATRE (Colorado, USA) */
    case 'red-rocks': {
      addSkyDome(group, disposables, '#050410', '#120b24', '#33161f', true);
      addOutdoorGround(group, disposables, 0x26130d);

      const rockMat = trackMat(new THREE.MeshStandardMaterial({
        color: 0x8a341c,
        roughness: 0.92,
        metalness: 0.04,
        flatShading: true,
      }));
      const rockDarkMat = trackMat(new THREE.MeshStandardMaterial({
        color: 0x5c2214,
        roughness: 0.95,
        metalness: 0.04,
        flatShading: true,
      }));

      // Towering angled Red Sandstone Monoliths flanking stage left (Creation Rock) & stage right (Ship Rock)
      const rockSpecs = [
        // Stage Left giant tilted slab + stepped outcrops
        { x: -12.5, y: 5.5, z: -4.5, sx: 6.5, sy: 16.5, sz: 11, rz: -0.26, mat: rockMat },
        { x: -16.8, y: 7.2, z: -11, sx: 8.0, sy: 20.0, sz: 12, rz: -0.22, mat: rockDarkMat },
        { x: -11.5, y: 2.2, z: 3.0, sx: 5.2, sy: 8.5, sz: 7, rz: -0.18, mat: rockMat },
        // Stage Right giant tilted slab + stepped outcrops
        { x: 12.5, y: 5.8, z: -4.5, sx: 6.8, sy: 17.5, sz: 11, rz: 0.28, mat: rockMat },
        { x: 17.2, y: 7.8, z: -11, sx: 8.4, sy: 21.0, sz: 12, rz: 0.24, mat: rockDarkMat },
        { x: 11.8, y: 2.4, z: 3.2, sx: 5.0, sy: 8.8, sz: 7, rz: 0.2, mat: rockMat },
        // Distant low canyon ridge behind the stage
        { x: 0, y: 1.5, z: -17.5, sx: 22, sy: 6.5, sz: 5.5, rz: 0.04, mat: rockDarkMat },
      ];
      rockSpecs.forEach((rs) => {
        const geo = trackGeo(new THREE.DodecahedronGeometry(1, 1));
        const slab = new THREE.Mesh(geo, rs.mat);
        slab.position.set(rs.x, rs.y, rs.z);
        slab.scale.set(rs.sx * 0.52, rs.sy * 0.52, rs.sz * 0.52);
        slab.rotation.z = rs.rz;
        group.add(slab);
      });

      // Warm amber canyon uplights grazing the sandstone monolith walls
      [-10.2, 10.2].forEach((ux) => {
        const light = new THREE.PointLight(0xf97316, 36, 22, 1.3);
        light.position.set(ux, 2.2, -3.5);
        group.add(light);
      });
      break;
    }

    /* 9. MADISON SQUARE GARDEN (New York, USA) */
    case 'madison-square-garden': {
      // Classic circular arena wall & ceiling
      const cylMat = trackMat(new THREE.MeshStandardMaterial({
        color: 0x0d0d18,
        roughness: 0.72,
        metalness: 0.25,
        side: THREE.BackSide,
      }));
      const arenaCyl = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(23, 22, 19, 32, 1, true)), cylMat);
      arenaCyl.position.set(0, 8, -1);
      group.add(arenaCyl);

      // Iconic Circular Overhead Ceiling Truss Rig with radial spokes
      const trussSteel = trackMat(new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.35, metalness: 0.85 }));
      const accentRingMat = trackMat(new THREE.MeshStandardMaterial({
        color: 0x818cf8,
        emissive: 0x6366f1,
        emissiveIntensity: 1.4,
      }));
      dynamicElements.pulseMaterials.push(accentRingMat);

      const rigGroup = new THREE.Group();
      rigGroup.position.set(0, 12.6, -1.2);
      [5.5, 11.2, 17.5].forEach((r, idx) => {
        const ring = new THREE.Mesh(
          trackGeo(new THREE.TorusGeometry(r, idx === 1 ? 0.34 : 0.22, 8, 40)),
          idx === 1 ? accentRingMat : trussSteel
        );
        ring.rotation.x = Math.PI * 0.5;
        rigGroup.add(ring);
      });
      for (let i = 0; i < 12; i += 1) {
        const a = (i / 12) * Math.PI * 2;
        const spoke = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 0.28, 17.5)), trussSteel);
        spoke.position.set(Math.sin(a) * 8.75, 0, Math.cos(a) * 8.75);
        spoke.rotation.y = a;
        rigGroup.add(spoke);
      }
      group.add(rigGroup);
      dynamicElements.rotatingRings.push(rigGroup);

      // Dramatic vertical arena spotlight shafts descending from circular rig
      const shaftMat = trackMat(new THREE.MeshBasicMaterial({
        color: 0xa5b4fc,
        transparent: true,
        opacity: 0.065,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }));
      [-9, -4.5, 4.5, 9].forEach((sx) => {
        const shaft = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.45, 1.85, 13.5, 12, 1, true)), shaftMat);
        shaft.position.set(sx, 6.2, -4.8);
        group.add(shaft);
      });

      dynamicElements.bowlLights = addStadiumSeatingBowl(group, disposables, {
        radiusX: 19,
        radiusZ: 17,
        tiers: 3,
        lightstickPalette: [0x818cf8, 0xf8fafc, 0xf43f5e, 0xfacc15],
        seatColor: 0x131222,
      });
      break;
    }

    /* 10. COACHELLA MAIN STAGE (California, USA) */
    case 'coachella': {
      // Iconic California desert sunset-to-night gradient sky dome
      addSkyDome(group, disposables, '#0c0824', '#3b1548', '#d95b59', true);
      addOutdoorGround(group, disposables, 0x261a14);

      // Massive ultra-wide desert festival curved LED mega-backdrop
      const coaTex = trackTex(createLedScreenTexture('COACHELLA VALLEY', '#be185d', 'rgba(251,146,60,0.5)'));
      const coaMat = trackMat(new THREE.MeshBasicMaterial({ map: coaTex }));
      const backdrop = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(18, 18, 7.6, 28, 1, true, Math.PI * 0.72, Math.PI * 0.56)),
        coaMat
      );
      backdrop.material.side = THREE.DoubleSide;
      backdrop.position.set(0, 4.4, 7.5);
      group.add(backdrop);

      // Towering stacked festival line-array speaker towers flanking both wings
      const towerMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.5, metalness: 0.72 }));
      const neonPink = trackMat(new THREE.MeshStandardMaterial({
        color: 0xf472b6,
        emissive: 0xf472b6,
        emissiveIntensity: 1.6,
      }));
      dynamicElements.pulseMaterials.push(neonPink);

      [-10.5, 10.5].forEach((tx) => {
        const tower = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.6, 11.5, 1.4)), towerMat);
        tower.position.set(tx, 4.6, -3.2);
        const strip = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.16, 10.6, 1.48)), neonPink);
        strip.position.set(tx, 4.6, -3.2);
        group.add(tower, strip);
      });

      // Desert Palm Tree Silhouettes framing the festival horizon!
      const palmTrunkMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x1a1016, roughness: 0.9 }));
      const palmFrondMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x120b14, roughness: 0.85, side: THREE.DoubleSide }));

      [
        { x: -16.5, z: -8, h: 11.5, lean: 0.16 },
        { x: -13.8, z: -12, h: 10.2, lean: -0.1 },
        { x: -18.5, z: 0, h: 9.8, lean: 0.14 },
        { x: 16.5, z: -8, h: 11.8, lean: -0.16 },
        { x: 13.8, z: -12, h: 10.4, lean: 0.12 },
        { x: 18.5, z: 0, h: 9.6, lean: -0.14 },
      ].forEach((p) => {
        const palm = new THREE.Group();
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(p.lean * 4, p.h * 0.55, 0),
          new THREE.Vector3(p.lean * 6, p.h, 0),
        ]);
        const trunk = new THREE.Mesh(trackGeo(new THREE.TubeGeometry(curve, 12, 0.26, 6, false)), palmTrunkMat);
        palm.add(trunk);

        const crownPt = curve.getPoint(1);
        for (let f = 0; f < 7; f += 1) {
          const a = (f / 7) * Math.PI * 2;
          const frond = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.65, 3.6, 4)), palmFrondMat);
          frond.scale.set(1, 1, 0.2);
          frond.position.set(crownPt.x + Math.cos(a) * 1.4, crownPt.y - 0.35, crownPt.z + Math.sin(a) * 1.4);
          frond.rotation.z = -Math.cos(a) * 1.15;
          frond.rotation.x = Math.sin(a) * 1.15;
          palm.add(frond);
        }
        palm.position.set(p.x, -1.2, p.z);
        group.add(palm);
      });
      break;
    }

    default:
      break;
  }

  return {
    meta,
    group,
    dynamicElements,
    dispose() {
      disposables.geometries.forEach((g) => g.dispose());
      disposables.materials.forEach((m) => m.dispose());
      disposables.textures.forEach((t) => t.dispose());
    },
  };
}

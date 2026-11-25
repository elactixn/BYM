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
      guitar: { x: -4.5, y: 0, z: 1.0, rotY: 0.24 },
      bass: { x: 4.5, y: 0, z: 1.0, rotY: -0.24 },
      drums: { x: 0, y: 0.8, z: -2.8, rotY: 0 },
      vocals: { x: 0, y: 0, z: 2.0, rotY: 0 },
      piano: { x: 6.5, y: 0.5, z: -1.8, rotY: -0.44 },
      micStand: { x: 0, y: 0, z: 2.6 },
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
      guitar: { x: -4.5, y: 0, z: 1.0, rotY: 0.28 },
      bass: { x: 4.5, y: 0, z: 1.0, rotY: -0.28 },
      drums: { x: 0, y: 0.8, z: -2.8, rotY: 0 },
      vocals: { x: 0, y: 0, z: 2.0, rotY: 0 },
      piano: { x: 6.5, y: 0.5, z: -1.8, rotY: -0.44 },
      micStand: { x: 0, y: 0, z: 2.6 },
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
      guitar: { x: 0, y: 0, z: 2.0, rotY: 0.04 },
      bass: { x: 4.5, y: 0, z: 1.0, rotY: -0.26 },
      drums: { x: 0, y: 0.8, z: -2.8, rotY: 0 },
      vocals: { x: 0, y: 0, z: 2.0, rotY: 0 },
      piano: { x: 6.5, y: 0.5, z: -1.8, rotY: -0.44 },
      micStand: { x: 0, y: 0, z: 2.6 },
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
      guitar: { x: -4.5, y: 0, z: 1.0, rotY: 0.22 },
      bass: { x: 4.5, y: 0, z: 1.0, rotY: -0.22 },
      drums: { x: 0, y: 0.8, z: -2.8, rotY: 0 },
      vocals: { x: 0, y: 0, z: 2.0, rotY: 0 },
      piano: { x: 6.5, y: 0.5, z: -1.8, rotY: -0.44 },
      micStand: { x: 0, y: 0, z: 2.6 },
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
  {
    id: 'double-neck-12',
    registryId: 'Guitar_DoubleNeck_12',
    name: 'Double-Neck 12-String',
    shortName: 'Double-Neck 12',
    swatch: ['#991b1b', '#facc15'],
    svgIcon: '<svg viewBox="0 0 88 38" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M42 7c8-4 22-3 28 3 4 4 4 14 0 18-6 6-20 7-28 3-4-2-4-22 0-24z" fill="#991b1b" stroke="#facc15" stroke-width="1.6"/><rect x="10" y="10.5" width="32" height="4.2" rx="1" fill="#5c3a21"/><rect x="10" y="23" width="32" height="4.2" rx="1" fill="#5c3a21"/><rect x="3" y="9" width="8" height="7" rx="1" fill="#18181b" stroke="#facc15" stroke-width="1"/><rect x="3" y="21.5" width="8" height="7" rx="1" fill="#18181b" stroke="#facc15" stroke-width="1"/></svg>',
  },
  {
    id: 'warlock-metal',
    registryId: 'Guitar_Warlock_Metal',
    name: 'Warlock Spiked Metal',
    shortName: 'Warlock Metal',
    swatch: ['#09090b', '#ef4444'],
    svgIcon: '<svg viewBox="0 0 88 38" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M35 15L50 5l22 1-8 10 14 3-14 3 8 10-22 1-15-10v-8z" fill="#111115" stroke="#ef4444" stroke-width="1.7"/><rect x="11" y="16.5" width="25" height="4.2" rx="1" fill="#27272a"/><path d="M2 14l9 2v6l-9 3 3-5.5L2 14z" fill="#111115" stroke="#ef4444" stroke-width="1"/></svg>',
  },
  {
    id: 'hollowbody-archtop',
    registryId: 'Guitar_Hollowbody_Archtop',
    name: 'Jazz Archtop Hollowbody',
    shortName: 'Jazz Hollowbody',
    swatch: ['#9a3412', '#fbbf24'],
    svgIcon: '<svg viewBox="0 0 88 38" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M40 12c6-6 15-4 18 1 5-4 14-2 17 6 2 7-2 14-10 15-6 1-11-1-14-4-4 3-11 2-14-3-3-6 0-11 3-15z" fill="#b45309" stroke="#fbbf24" stroke-width="1.5"/><path d="M52 12c2 3 2 5 0 7M52 26c2-3 2-5 0-7" stroke="#1c0a05" stroke-width="2" stroke-linecap="round"/><rect x="11" y="17" width="27" height="4" rx="1" fill="#451a03"/></svg>',
  },
  {
    id: 'keytar-blade',
    registryId: 'Guitar_Keytar_Blade',
    name: 'Neon Keytar Blade',
    shortName: 'Keytar Blade',
    swatch: ['#06b6d4', '#ec4899'],
    svgIcon: '<svg viewBox="0 0 88 38" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M32 14l42-6 8 11-10 11-40-5V14z" fill="#0f172a" stroke="#22d3ee" stroke-width="1.8"/><rect x="38" y="16" width="32" height="6" rx="1" fill="#f8fafc"/><rect x="10" y="16.8" width="23" height="4" rx="1" fill="#ec4899"/></svg>',
  },
  {
    id: 'flying-v-lightning',
    registryId: 'Guitar_FlyingV_Lightning',
    name: 'Flying-V Lightning',
    shortName: 'Flying-V Bolt',
    swatch: ['#0284c7', '#facc15'],
    svgIcon: '<svg viewBox="0 0 88 38" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M34 19L76 5l4 5-24 9 24 9-4 5-42-14z" fill="#0369a1" stroke="#38bdf8" stroke-width="1.6"/><path d="M44 19l11-4-3 4 9 0-12 5 3-4-8-1z" fill="#facc15"/><rect x="11" y="16.5" width="25" height="4.5" rx="1" fill="#0f172a"/><path d="M3 15l9 1.5v5L3 23l1.5-4L3 15z" fill="#0369a1" stroke="#facc15" stroke-width="1"/></svg>',
  },
  {
    id: 'double-neck-sg',
    registryId: 'Guitar_DoubleNeck_SG',
    name: 'Double-Neck SG Twin',
    shortName: 'Double-Neck SG',
    swatch: ['#7f1d1d', '#fef08a'],
    svgIcon: '<svg viewBox="0 0 88 38" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M41 8l12-4 17 4-4 11 4 11-17 4-12-4V8z" fill="#7f1d1d" stroke="#facc15" stroke-width="1.5"/><rect x="10" y="10.5" width="31" height="4.2" rx="1" fill="#1c0a05"/><rect x="10" y="23" width="31" height="4.2" rx="1" fill="#1c0a05"/><rect x="3" y="9" width="8" height="7" rx="1" fill="#18181b" stroke="#fde047" stroke-width="1"/><rect x="3" y="21.5" width="8" height="7" rx="1" fill="#18181b" stroke="#fde047" stroke-width="1"/></svg>',
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
  {
    id: 'neon-acrylic-bass',
    registryId: 'Bass_Neon_Acrylic',
    name: 'Neon Acrylic Bass',
    shortName: 'Neon Acrylic',
    swatch: ['#06b6d4', '#ec4899'],
    svgIcon: '<svg viewBox="0 0 92 38" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M45 10c6-5 14-4 18 0 6-3 15 0 18 7 2 7-2 14-11 15-6 1-12-1-16-5-5 2-11 1-13-4-2-5 0-10 4-13z" fill="rgba(34,211,238,0.28)" stroke="#22d3ee" stroke-width="2.2"/><rect x="54" y="14" width="16" height="10" rx="2" fill="rgba(236,72,153,0.45)" stroke="#ec4899" stroke-width="1.2"/><rect x="10" y="16.5" width="34" height="4.5" rx="1" fill="#083344" stroke="#22d3ee" stroke-width="1"/><path d="M3 14.5h8v9H3l1.5-4.5L3 14.5z" fill="#083344" stroke="#ec4899" stroke-width="1.3"/></svg>',
  },
  {
    id: 'slap-5string',
    registryId: 'Bass_Funk_Slap_5String',
    name: 'Funk Slap 5-String Bass',
    shortName: 'Slap 5-String',
    swatch: ['#f59e0b', '#1e293b'],
    svgIcon: '<svg viewBox="0 0 92 38" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M44 10c6-5 14-4 17 0 6-2 16 0 18 7 2 7-2 13-11 14-6 1-11-1-15-4-4 2-11 1-13-4-2-5 0-10 4-13z" fill="#d97706" stroke="#fef08a" stroke-width="1.6"/><rect x="53" y="13.5" width="10" height="11" rx="2" fill="#e2e8f0"/><rect x="10" y="16.5" width="34" height="5" rx="1" fill="#f3d299"/></svg>',
  },
  {
    id: 'neon-acrylic-transparent',
    registryId: 'Bass_Neon_Acrylic_Transparent',
    name: 'Neon Acrylic Transparent',
    shortName: 'Crystal Acrylic',
    swatch: ['#e0f2fe', '#22d3ee'],
    svgIcon: '<svg viewBox="0 0 92 38" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M45 10c6-5 14-4 18 0 6-3 15 0 18 7 2 7-2 14-11 15-6 1-12-1-16-5-5 2-11 1-13-4-2-5 0-10 4-13z" fill="rgba(224,242,254,0.2)" stroke="#67e8f9" stroke-width="2.2"/><path d="M51 19h22" stroke="#22d3ee" stroke-width="2.8" stroke-linecap="round"/><rect x="10" y="16.5" width="34" height="4.5" rx="1" fill="rgba(255,255,255,0.22)" stroke="#67e8f9" stroke-width="1"/><path d="M3 14.5h8v9H3l1.5-4.5L3 14.5z" fill="#0f172a" stroke="#67e8f9" stroke-width="1.3"/></svg>',
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
  {
    id: 'vintage-jazz-cocktail',
    registryId: 'Drums_Vintage_Jazz_Cocktail',
    name: 'Vintage Jazz Cocktail Kit',
    shortName: 'Jazz Cocktail',
    swatch: ['#fef3c7', '#b45309'],
    svgIcon: '<svg viewBox="0 0 84 38" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="31" y="11" width="22" height="22" rx="3" fill="#fef3c7" stroke="#b45309" stroke-width="2"/><ellipse cx="42" cy="11" rx="11" ry="3" fill="#f8fafc" stroke="#b45309" stroke-width="1.5"/><ellipse cx="20" cy="9" rx="9" ry="2.4" fill="#fbbf24"/><ellipse cx="64" cy="9" rx="9" ry="2.4" fill="#fbbf24"/><line x1="20" y1="11" x2="31" y2="24" stroke="#cbd5e1" stroke-width="2"/><line x1="64" y1="11" x2="53" y2="24" stroke="#cbd5e1" stroke-width="2"/></svg>',
  },
  {
    id: 'steampunk-brass',
    registryId: 'Drums_Steampunk_Brass',
    name: 'Steampunk Brass Rig',
    shortName: 'Steampunk Brass',
    swatch: ['#92400e', '#f59e0b'],
    svgIcon: '<svg viewBox="0 0 84 38" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="42" cy="23" r="11.5" fill="#78350f" stroke="#f59e0b" stroke-width="3"/><circle cx="42" cy="23" r="6" fill="#1c1917" stroke="#fbbf24" stroke-width="1.6"/><ellipse cx="16" cy="10" rx="10" ry="2.5" fill="#d97706"/><ellipse cx="68" cy="10" rx="10" ry="2.5" fill="#d97706"/><line x1="16" y1="12" x2="16" y2="33" stroke="#b45309" stroke-width="2.2"/><line x1="68" y1="12" x2="68" y2="33" stroke="#b45309" stroke-width="2.2"/></svg>',
  },
  {
    id: 'triple-kick-fortress',
    registryId: 'Drums_Triple_Kick_Fortress',
    name: 'Triple-Kick Stadium Drum Fortress',
    shortName: 'Triple-Kick Fortress',
    swatch: ['#facc15', '#0f172a'],
    svgIcon: '<svg viewBox="0 0 84 38" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 17c10-11 54-11 64 0" stroke="#e2e8f0" stroke-width="2" fill="none"/><circle cx="22" cy="26" r="7.8" fill="#0f172a" stroke="#facc15" stroke-width="2.4"/><circle cx="42" cy="25" r="8.8" fill="#0f172a" stroke="#ef4444" stroke-width="2.6"/><circle cx="62" cy="26" r="7.8" fill="#0f172a" stroke="#facc15" stroke-width="2.4"/><ellipse cx="13" cy="9" rx="8" ry="2.2" fill="#fde047"/><ellipse cx="71" cy="9" rx="8" ry="2.2" fill="#fde047"/><ellipse cx="42" cy="6" rx="8.5" ry="2.2" fill="#fde047"/></svg>',
  },
];

export const KEYBOARD_MODELS = [
  {
    id: 'concert-grand',
    registryId: 'Keys_Concert_Grand',
    name: 'Concert Grand Piano',
    shortName: 'Concert Grand',
    isKeytar: false,
    swatch: ['#0f172a', '#facc15'],
    description: 'Glossy black grand piano with animated resonance lid, ivory keys & brass pedals.',
    svgIcon: '<svg viewBox="0 0 88 38" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 14c0-5 8-9 20-9 10 0 16 4 22 7 7 3 16 2 16 9v6H16V14z" fill="#18181b" stroke="#facc15" stroke-width="1.6"/><path d="M18 12l24-8 26 8" stroke="#fde047" stroke-width="1.6" stroke-linecap="round"/><rect x="17" y="21" width="54" height="5" rx="1" fill="#f8fafc"/><path d="M21 21h3v3h-3zm6 0h3v3h-3zm9 0h3v3h-3zm6 0h3v3h-3zm6 0h3v3h-3zm9 0h3v3h-3zm6 0h3v3h-3z" fill="#0f172a"/><line x1="22" y1="27" x2="22" y2="35" stroke="#94a3b8" stroke-width="2.2"/><line x1="66" y1="27" x2="66" y2="35" stroke="#94a3b8" stroke-width="2.2"/><line x1="44" y1="27" x2="44" y2="35" stroke="#facc15" stroke-width="2"/></svg>',
  },
  {
    id: 'white-crystal-grand',
    registryId: 'Keys_White_Crystal_Grand',
    name: 'White Crystal Grand Piano',
    shortName: 'Crystal Grand',
    isKeytar: false,
    swatch: ['#f8fafc', '#38bdf8'],
    description: 'Luminous pearl-white & crystal grand piano with backlit ice-blue strings & animated lid.',
    svgIcon: '<svg viewBox="0 0 88 38" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 14c0-5 8-9 20-9 10 0 16 4 22 7 7 3 16 2 16 9v6H16V14z" fill="#f8fafc" stroke="#38bdf8" stroke-width="1.8"/><path d="M18 12l24-8 26 8" stroke="#7dd3fc" stroke-width="1.6" stroke-linecap="round"/><rect x="17" y="21" width="54" height="5" rx="1" fill="#e0f2fe"/><line x1="22" y1="27" x2="22" y2="35" stroke="#7dd3fc" stroke-width="2.2"/><line x1="66" y1="27" x2="66" y2="35" stroke="#7dd3fc" stroke-width="2.2"/></svg>',
  },
  {
    id: 'vintage-upright',
    registryId: 'Keys_Vintage_Upright',
    name: 'Vintage Honky-Tonk Upright',
    shortName: 'Vintage Upright',
    isKeytar: false,
    swatch: ['#78350f', '#fbbf24'],
    description: 'Tall mahogany saloon upright piano with exposed glowing hammer harp window & brass sconces.',
    svgIcon: '<svg viewBox="0 0 88 38" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="18" y="4" width="52" height="20" rx="2" fill="#78350f" stroke="#fbbf24" stroke-width="1.5"/><rect x="24" y="7" width="40" height="8" rx="1" fill="#1c0a05" stroke="#d97706" stroke-width="1"/><rect x="16" y="19" width="56" height="5" rx="1" fill="#f8fafc"/><rect x="21" y="24" width="6" height="11" fill="#451a03"/><rect x="61" y="24" width="6" height="11" fill="#451a03"/></svg>',
  },
  {
    id: 'neon-double-synth',
    registryId: 'Keys_Neon_DoubleSynth',
    name: 'Neon Double-Tier Synth',
    shortName: 'Double-Tier Synth',
    isKeytar: false,
    swatch: ['#ec4899', '#22d3ee'],
    description: 'Dual stacked arena synthesizers on chrome X-stand with glowing neon lightbars.',
    svgIcon: '<svg viewBox="0 0 88 38" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="16" y="7" width="56" height="7" rx="1.5" fill="#1e1b4b" stroke="#22d3ee" stroke-width="1.6"/><rect x="19" y="10" width="50" height="3" fill="#f8fafc"/><rect x="12" y="17" width="64" height="8" rx="1.5" fill="#18181b" stroke="#ec4899" stroke-width="1.8"/><rect x="15" y="20" width="58" height="3.5" fill="#f8fafc"/><path d="M26 25l36 10M62 25L26 35" stroke="#cbd5e1" stroke-width="2.2" stroke-linecap="round"/></svg>',
  },
  {
    id: 'retro-keytar',
    registryId: 'Keys_Retro_Keytar',
    name: 'Retro Stage Keytar',
    shortName: 'Retro Keytar',
    isKeytar: true,
    swatch: ['#f43f5e', '#facc15'],
    description: '80s synth-rock slung keytar so your keyboardist can step forward & shred!',
    svgIcon: '<svg viewBox="0 0 88 38" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 17l18-2 8-5 44 2-6 14-38 4-10-6-16-2v-5z" fill="#e11d48" stroke="#fde047" stroke-width="1.6"/><rect x="33" y="17" width="38" height="6" rx="1" transform="rotate(-3 33 17)" fill="#f8fafc"/><path d="M36 17h3v3h-3zm6 0h3v3h-3zm6 0h3v3h-3zm9 0h3v3h-3zm6 0h3v3h-3z" fill="#0f172a"/><circle cx="18" cy="19" r="2.2" fill="#22d3ee"/></svg>',
  },
  {
    id: 'cyberpunk-808-keytar',
    registryId: 'Keys_Cyberpunk_808_Keytar',
    name: '808 Cyberpunk Keytar',
    shortName: '808 Cyber Keytar',
    isKeytar: true,
    swatch: ['#0f172a', '#22d3ee'],
    description: 'Angular neon-circuit 808 Cyberpunk slung keytar with glowing drum-pad matrix & LED lightbar.',
    svgIcon: '<svg viewBox="0 0 88 38" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 15l24-3 10-5 38 3-6 18-34 3-11-6-21-2v-8z" fill="#0f172a" stroke="#22d3ee" stroke-width="1.8"/><rect x="36" y="18" width="36" height="5" rx="1" fill="#e0f2fe"/><rect x="38" y="11" width="12" height="4" rx="1" fill="#ec4899"/><circle cx="19" cy="18" r="2.6" fill="#facc15"/></svg>',
  },
];

export const STAR_LOOKALIKES = [
  {
    id: 'default-band',
    registryId: 'Star_Default_HouseBand',
    name: 'House Arena Band',
    shortName: 'House Band',
    targetRole: 'all',
    description: 'Original Encore Stage rock lineup in signature tour jackets and glowing stage trims.',
    swatch: ['#06b6d4', '#f59e0b'],
    svgIcon: '<svg viewBox="0 0 84 42" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="42" cy="14" r="9" fill="#f2c49b" stroke="#06b6d4" stroke-width="2"/><path d="M34 11c2-5 14-5 16 0" fill="#1e293b"/><circle cx="38.5" cy="14" r="1.4" fill="#111827"/><circle cx="45.5" cy="14" r="1.4" fill="#111827"/><path d="M38 18q4 3.5 8 0" stroke="#111827" stroke-width="1.5" stroke-linecap="round"/><rect x="27" y="25" width="30" height="14" rx="4" fill="#0e7490" stroke="#f59e0b" stroke-width="1.5"/></svg>',
  },
  {
    id: 'olivia-punk',
    registryId: 'Star_Olivia_PopPunk',
    name: 'Olivia-Inspired Pop-Punk Star',
    shortName: 'Pop-Punk Star',
    targetRole: 'frontperson',
    description: 'Long dark wavy hair, purple-and-black glitter corset, pleated mini-skirt & combat boots.',
    swatch: ['#9333ea', '#18181b'],
    skinColor: 0xf0c19d,
    hairStyle: 'long-wavy',
    hairColor: 0x1b1210,
    torsoColor: 0x6b21a8,
    torsoEmissive: 0x4c1d95,
    accentColor: 0xe2e8f0,
    skirtColor: 0x18181b,
    skirtStyle: 'pleated',
    legColor: 0x111827,
    bootColor: 0x09090b,
    glitter: true,
    face: {
      eyeliner: true,
      eyeshadow: '#7e22ce',
      blush: 'rgba(244, 114, 182, 0.36)',
      lipColor: '#be123c',
      expression: 'rockstar',
    },
    svgIcon: '<svg viewBox="0 0 84 42" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M29 14c0-8 26-8 26 0l3 21H26l3-21z" fill="#1c1110"/><circle cx="42" cy="14" r="8.5" fill="#f0c19d"/><path d="M36 13h4M44 13h4" stroke="#111827" stroke-width="1.8" stroke-linecap="round"/><path d="M39 18q3 2.5 6 0" stroke="#be123c" stroke-width="1.8" stroke-linecap="round"/><path d="M31 24h22l3 15H28l3-15z" fill="#7e22ce" stroke="#e2e8f0" stroke-width="1.2"/><path d="M35 28l7 4 7-4" stroke="#f8fafc" stroke-width="1.3"/></svg>',
  },
  {
    id: 'chappell-princess',
    registryId: 'Star_Chappell_MidwestPrincess',
    name: 'Chappell-Inspired Midwest Princess',
    shortName: 'Midwest Princess',
    targetRole: 'frontperson',
    description: 'Voluminous fiery red curls, theatrical glam stage makeup & sparkly pink rhinestone pop-royalty outfit.',
    swatch: ['#ec4899', '#ea580c'],
    skinColor: 0xfcf2f0,
    hairStyle: 'big-red-curls',
    hairColor: 0xc2410c,
    torsoColor: 0xec4899,
    torsoEmissive: 0xbe185d,
    accentColor: 0xfef08a,
    skirtColor: 0xf472b6,
    skirtStyle: 'glam-fringe',
    legColor: 0xfbcfe8,
    bootColor: 0xec4899,
    glitter: true,
    cowgirlHat: true,
    face: {
      eyeliner: true,
      eyeshadow: '#38bdf8',
      blush: 'rgba(236, 72, 153, 0.52)',
      lipColor: '#e11d48',
      starMakeup: true,
      expression: 'glam',
    },
    svgIcon: '<svg viewBox="0 0 84 42" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="31" cy="15" r="7" fill="#c2410c"/><circle cx="53" cy="15" r="7" fill="#c2410c"/><circle cx="33" cy="24" r="6" fill="#ea580c"/><circle cx="51" cy="24" r="6" fill="#ea580c"/><circle cx="42" cy="14" r="8.5" fill="#fcf2f0"/><path d="M36 12h4M44 12h4" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round"/><circle cx="38" cy="13.5" r="1.2" fill="#111827"/><circle cx="46" cy="13.5" r="1.2" fill="#111827"/><path d="M39 18q3 2.6 6 0" stroke="#e11d48" stroke-width="2" stroke-linecap="round"/><path d="M30 24h24l4 15H26l4-15z" fill="#ec4899" stroke="#fde047" stroke-width="1.4"/></svg>',
  },
  {
    id: 'taylor-eras',
    registryId: 'Star_Taylor_ErasHeadliner',
    name: 'Taylor-Inspired Eras Headliner',
    shortName: 'Eras Headliner',
    targetRole: 'frontperson',
    description: 'Signature blonde bangs, classic red lip, shimmering sequin bodysuit & tall glitter boots.',
    swatch: ['#f472b6', '#38bdf8'],
    skinColor: 0xfbe0cc,
    hairStyle: 'blonde-bangs',
    hairColor: 0xeab308,
    torsoColor: 0xf472b6,
    torsoEmissive: 0x38bdf8,
    accentColor: 0xfef08a,
    skirtColor: 0x38bdf8,
    skirtStyle: 'glam-fringe',
    legColor: 0xfbe0cc,
    bootColor: 0xfde047,
    glitter: true,
    face: {
      eyeliner: true,
      eyeshadow: '#fde047',
      blush: 'rgba(251, 113, 133, 0.35)',
      lipColor: '#dc2626',
      expression: 'glam',
    },
    svgIcon: '<svg viewBox="0 0 84 42" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M31 12c0-7 22-7 22 0l2 19H29l2-19z" fill="#eab308"/><circle cx="42" cy="14.5" r="8" fill="#fbe0cc"/><path d="M34 10h16v3.5H34z" fill="#ca8a04"/><circle cx="38.5" cy="15" r="1.2" fill="#1d4ed8"/><circle cx="45.5" cy="15" r="1.2" fill="#1d4ed8"/><path d="M39 19q3 2.2 6 0" stroke="#dc2626" stroke-width="2.2" stroke-linecap="round"/><path d="M31 24h22l2 15H29l2-15z" fill="#f472b6" stroke="#38bdf8" stroke-width="1.6"/></svg>',
  },
  {
    id: 'freddie-legend',
    registryId: 'Star_Freddie_StadiumLegend',
    name: 'Freddie-Inspired Stadium Legend',
    shortName: 'Stadium Legend',
    targetRole: 'frontperson',
    description: 'Iconic yellow military buckle jacket, crisp white stadium trousers & legendary mustache.',
    swatch: ['#facc15', '#f8fafc'],
    skinColor: 0xe6b48a,
    hairStyle: 'slick-back',
    hairColor: 0x111827,
    torsoColor: 0xfacc15,
    torsoEmissive: 0x78350f,
    accentColor: 0xf8fafc,
    skirtColor: null,
    legColor: 0xf8fafc,
    bootColor: 0xf8fafc,
    glitter: false,
    face: {
      eyeliner: false,
      mustache: true,
      lipColor: '#9f4a3c',
      expression: 'hero',
    },
    svgIcon: '<svg viewBox="0 0 84 42" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="42" cy="14" r="8.5" fill="#e6b48a"/><path d="M33 11c2-6 16-6 18 0H33z" fill="#111827"/><circle cx="38.5" cy="13.5" r="1.3" fill="#111827"/><circle cx="45.5" cy="13.5" r="1.3" fill="#111827"/><path d="M37 17.5q5-2.2 10 0" stroke="#111827" stroke-width="2.4" stroke-linecap="round"/><rect x="29" y="24" width="26" height="15" rx="3" fill="#facc15" stroke="#f8fafc" stroke-width="1.5"/><path d="M33 27h18M33 31h18M33 35h18" stroke="#f8fafc" stroke-width="1.4"/></svg>',
  },
  {
    id: 'slash-riff',
    registryId: 'Star_Slash_RiffMaster',
    name: 'Slash-Inspired Riff Master',
    shortName: 'Riff Master',
    targetRole: 'guitar',
    description: 'Signature black top hat over dark curly hair, aviator shades & studded leather jacket.',
    swatch: ['#18181b', '#dc2626'],
    skinColor: 0xdca77c,
    hairStyle: 'top-hat-curls',
    hairColor: 0x111827,
    torsoColor: 0x18181b,
    torsoEmissive: 0x111827,
    accentColor: 0x94a3b8,
    skirtColor: null,
    legColor: 0x09090b,
    bootColor: 0x18181b,
    glitter: false,
    face: {
      sunglasses: true,
      sunglassesTint: '#09090b',
      expression: 'rockstar',
    },
    svgIcon: '<svg viewBox="0 0 84 42" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="34" y="2" width="16" height="9" rx="1" fill="#09090b" stroke="#94a3b8" stroke-width="1"/><rect x="28" y="10" width="28" height="2.8" rx="1" fill="#18181b"/><circle cx="32" cy="18" r="5" fill="#111827"/><circle cx="52" cy="18" r="5" fill="#111827"/><circle cx="42" cy="17" r="7.5" fill="#dca77c"/><rect x="35" y="14.5" width="6" height="3.8" rx="1" fill="#09090b"/><rect x="43" y="14.5" width="6" height="3.8" rx="1" fill="#09090b"/><rect x="29" y="25" width="26" height="14" rx="3" fill="#18181b" stroke="#dc2626" stroke-width="1.3"/></svg>',
  },
  {
    id: 'bruno-groove',
    registryId: 'Star_Bruno_SilkGroove',
    name: 'Bruno-Inspired Silk Groove',
    shortName: 'Silk Groove',
    targetRole: 'frontperson',
    description: 'Vintage pompadour curls, amber tinted shades, retro silk open-collar shirt & gold chain.',
    swatch: ['#d97706', '#7c2d12'],
    skinColor: 0xd99e6e,
    hairStyle: 'pompadour',
    hairColor: 0x1a120d,
    torsoColor: 0x9a3412,
    torsoEmissive: 0x431407,
    accentColor: 0xfacc15,
    skirtColor: null,
    legColor: 0x1c1917,
    bootColor: 0x451a03,
    goldChain: true,
    glitter: false,
    face: {
      sunglasses: true,
      sunglassesTint: '#78350f',
      mustache: true,
      expression: 'glam',
    },
    svgIcon: '<svg viewBox="0 0 84 42" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M32 13c0-8 20-9 20-1H32z" fill="#1a120d"/><circle cx="42" cy="16" r="8" fill="#d99e6e"/><rect x="34.5" y="13.5" width="6.5" height="4" rx="1.2" fill="#78350f" stroke="#facc15" stroke-width="0.9"/><rect x="43" y="13.5" width="6.5" height="4" rx="1.2" fill="#78350f" stroke="#facc15" stroke-width="0.9"/><rect x="29" y="25" width="26" height="14" rx="3" fill="#9a3412" stroke="#facc15" stroke-width="1.3"/><path d="M36 25l6 7 6-7" stroke="#facc15" stroke-width="2" fill="none"/></svg>',
  },
  {
    id: 'shrek-ogre',
    registryId: 'Star_Swamp_Ogre',
    name: 'Swamp Ogre Rockstar',
    shortName: 'Swamp Ogre',
    targetRole: 'all',
    customSculpt: 'shrek-ogre',
    description: 'Green ogre champion with iconic trumpet ears, stitched brown leather vest & cream tunic.',
    swatch: ['#7aa332', '#4a2c11'],
    skinColor: 0x7aa332,
    hairStyle: 'bald',
    hairColor: 0x4a2c11,
    torsoColor: 0xeaddcf,
    torsoEmissive: 0x1e2910,
    accentColor: 0x4a2c11,
    skirtColor: null,
    legColor: 0x3e2723,
    bootColor: 0x2d1a12,
    glitter: false,
    face: {
      eyeliner: false,
      expression: 'rockstar',
      lipColor: '#3f6212',
    },
    svgIcon: '<svg viewBox="0 0 84 42" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M27 11l7 3v4l-8-2zM57 11l-7 3v4l8-2z" fill="#65a30d"/><circle cx="42" cy="15" r="9" fill="#84cc16" stroke="#365314" stroke-width="1.4"/><circle cx="38.5" cy="14" r="1.4" fill="#111827"/><circle cx="45.5" cy="14" r="1.4" fill="#111827"/><path d="M37 18.5q5 3.5 10 0" stroke="#365314" stroke-width="1.8" stroke-linecap="round"/><rect x="28" y="25" width="28" height="14" rx="3" fill="#eaddcf"/><path d="M28 25h9v14h-9zM47 25h9v14h-9z" fill="#4a2c11"/></svg>',
  },
  {
    id: 'sponge-rocker',
    registryId: 'Star_Square_Sponge',
    name: 'Square Sponge Rocker',
    shortName: 'Sponge Rocker',
    targetRole: 'all',
    customSculpt: 'sponge-rocker',
    description: 'Yellow porous cube rocker with buck-tooth stage grin, crisp white shirt, red tie & brown shorts.',
    swatch: ['#facc15', '#78350f'],
    skinColor: 0xfacc15,
    hairStyle: 'bald',
    hairColor: 0xca8a04,
    torsoColor: 0xfef08a,
    torsoEmissive: 0x713f12,
    accentColor: 0xdc2626,
    skirtColor: null,
    legColor: 0xfacc15,
    bootColor: 0x09090b,
    glitter: false,
    face: {
      eyeliner: false,
      buckTeeth: true,
      expression: 'glam',
      lipColor: '#dc2626',
    },
    svgIcon: '<svg viewBox="0 0 84 42" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="30" y="5" width="24" height="22" rx="3" fill="#facc15" stroke="#ca8a04" stroke-width="1.5"/><circle cx="38" cy="13" r="3" fill="#fff"/><circle cx="46" cy="13" r="3" fill="#fff"/><circle cx="38" cy="13" r="1.4" fill="#0284c7"/><circle cx="46" cy="13" r="1.4" fill="#0284c7"/><rect x="39" y="19" width="2.5" height="3" fill="#fff"/><rect x="42.5" y="19" width="2.5" height="3" fill="#fff"/><rect x="30" y="27" width="24" height="6" fill="#f8fafc"/><polygon points="42,27 40,34 42,36 44,34" fill="#dc2626"/><rect x="30" y="33" width="24" height="6" fill="#78350f"/></svg>',
  },
  {
    id: 'dark-knight',
    registryId: 'Star_Dark_Knight',
    name: 'Dark-Knight Caped Crusader',
    shortName: 'Caped Crusader',
    targetRole: 'all',
    customSculpt: 'dark-knight',
    description: 'Armored charcoal suit, pointed bat-cowl ears, gold utility belt & billowing cape.',
    swatch: ['#1e293b', '#facc15'],
    skinColor: 0xe6b995,
    hairStyle: 'cowl-mask',
    hairColor: 0x0f172a,
    torsoColor: 0x1e293b,
    torsoEmissive: 0x09090b,
    accentColor: 0xfacc15,
    skirtColor: null,
    legColor: 0x0f172a,
    bootColor: 0x020617,
    glitter: false,
    face: {
      cowlEyes: true,
      expression: 'hero',
    },
    svgIcon: '<svg viewBox="0 0 84 42" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M33 4l3 8h12l3-8v14H33V4z" fill="#0f172a" stroke="#475569" stroke-width="1.2"/><rect x="36" y="11" width="4" height="2" fill="#f8fafc"/><rect x="44" y="11" width="4" height="2" fill="#f8fafc"/><rect x="35" y="15" width="14" height="5" rx="2" fill="#e6b995"/><path d="M24 25l8-2h20l8 2-4 15H28l-4-15z" fill="#1e293b" stroke="#475569" stroke-width="1.2"/><rect x="31" y="34" width="22" height="3.5" fill="#facc15"/></svg>',
  },
  {
    id: 'cyber-idol',
    registryId: 'Star_Cyber_Idol_TwinTails',
    name: 'Cyber-Idol Twin-Tails',
    shortName: 'Cyber Idol',
    targetRole: 'frontperson',
    customSculpt: 'cyber-idol',
    description: 'Virtual pop icon with long glowing turquoise twin-tails, futuristic headset & silver-teal stage outfit.',
    swatch: ['#22d3ee', '#cbd5e1'],
    skinColor: 0xfef2f2,
    hairStyle: 'cyber-twintails',
    hairColor: 0x06b6d4,
    torsoColor: 0xcbd5e1,
    torsoEmissive: 0x0891b2,
    accentColor: 0x22d3ee,
    skirtColor: 0x0f172a,
    skirtStyle: 'pleated',
    legColor: 0x0f172a,
    bootColor: 0x06b6d4,
    glitter: true,
    face: {
      eyeliner: true,
      eyeshadow: '#22d3ee',
      blush: 'rgba(244, 114, 182, 0.34)',
      lipColor: '#f472b6',
      expression: 'glam',
    },
    svgIcon: '<svg viewBox="0 0 84 42" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22 10c-4 10-4 22-1 28M62 10c4 10 4 22 1 28" stroke="#22d3ee" stroke-width="5" stroke-linecap="round"/><circle cx="42" cy="14" r="8.5" fill="#fef2f2"/><path d="M33 12c2-6 16-6 18 0" fill="#06b6d4"/><circle cx="38.5" cy="14" r="1.3" fill="#0891b2"/><circle cx="45.5" cy="14" r="1.3" fill="#0891b2"/><rect x="30" y="24" width="24" height="15" rx="3" fill="#cbd5e1" stroke="#22d3ee" stroke-width="1.5"/><path d="M40 24h4v10h-4z" fill="#06b6d4"/></svg>',
  },
  {
    id: 'opm-pinoy-rock',
    registryId: 'Star_OPM_Pinoy_Rock',
    name: 'OPM Pinoy Rock Legend',
    shortName: 'OPM Rock Legend',
    targetRole: 'frontperson',
    customSculpt: 'opm-pinoy-rock',
    description: 'Manila stadium rock icon with aviator shades, vintage concert band tee, distressed denim jacket & fiery passion.',
    swatch: ['#2563eb', '#ef4444'],
    skinColor: 0xd99e70,
    hairStyle: 'opm-shag',
    hairColor: 0x111827,
    torsoColor: 0x1d4ed8,
    torsoEmissive: 0x1e3a8a,
    accentColor: 0xfacc15,
    skirtColor: null,
    legColor: 0x1e293b,
    bootColor: 0x1c1917,
    glitter: false,
    face: {
      sunglasses: true,
      sunglassesTint: '#0f172a',
      expression: 'rockstar',
    },
    svgIcon: '<svg viewBox="0 0 84 42" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M31 14c0-7 22-8 22 0l2 8H29l2-8z" fill="#111827"/><circle cx="42" cy="15" r="8" fill="#d99e70"/><rect x="35" y="12.5" width="6.2" height="3.8" rx="1" fill="#09090b" stroke="#facc15" stroke-width="0.9"/><rect x="43" y="12.5" width="6.2" height="3.8" rx="1" fill="#09090b" stroke="#facc15" stroke-width="0.9"/><rect x="28" y="24" width="28" height="15" rx="3" fill="#1d4ed8" stroke="#93c5fd" stroke-width="1.2"/><rect x="37" y="25" width="10" height="14" fill="#18181b"/></svg>',
  },
  {
    id: 'visual-kei-shredder',
    registryId: 'Star_Visual_Kei_Shredder',
    name: 'Visual Kei / J-Rock Shredder',
    shortName: 'Visual Kei',
    targetRole: 'guitar',
    customSculpt: 'visual-kei-shredder',
    description: 'Spiky silver-blue anime hair, dramatic kohl eyeliner & asymmetrical studded leather rock jacket.',
    swatch: ['#7dd3fc', '#18181b'],
    skinColor: 0xfbeee6,
    hairStyle: 'anime-spiky',
    hairColor: 0xbae6fd,
    torsoColor: 0x09090b,
    torsoEmissive: 0x0284c7,
    accentColor: 0x38bdf8,
    skirtColor: null,
    legColor: 0x09090b,
    bootColor: 0x1e293b,
    glitter: true,
    face: {
      eyeliner: true,
      eyeshadow: '#0ea5e9',
      lipColor: '#1e293b',
      expression: 'rockstar',
    },
    svgIcon: '<svg viewBox="0 0 84 42" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M27 16l6-12 7 6 4-8 6 8 7-6 3 12-4 5H30l-3-5z" fill="#bae6fd" stroke="#0284c7" stroke-width="1.2"/><circle cx="42" cy="15.5" r="7.5" fill="#fbeee6"/><path d="M36 14h4M44 14h4" stroke="#0f172a" stroke-width="1.8"/><rect x="29" y="24" width="26" height="15" rx="3" fill="#09090b" stroke="#38bdf8" stroke-width="1.4"/><path d="M31 25l22 12" stroke="#cbd5e1" stroke-width="2"/></svg>',
  },
  {
    id: 'glam-metal-80s',
    registryId: 'Star_Glam_Metal_80s',
    name: '80s Glam Metal Shredder',
    shortName: '80s Glam Metal',
    targetRole: 'guitar',
    customSculpt: 'glam-metal-80s',
    description: 'Sky-high teased arena hair, neon headband, lightning zebra spandex & Sunset Strip stage swagger.',
    swatch: ['#ec4899', '#f8fafc'],
    skinColor: 0xf1c29b,
    hairStyle: 'glam-teased',
    hairColor: 0xfde047,
    torsoColor: 0xf8fafc,
    torsoEmissive: 0xdb2777,
    accentColor: 0xec4899,
    skirtColor: null,
    legColor: 0xf8fafc,
    bootColor: 0xec4899,
    glitter: true,
    face: {
      eyeliner: true,
      eyeshadow: '#ec4899',
      lipColor: '#ec4899',
      expression: 'rockstar',
    },
    svgIcon: '<svg viewBox="0 0 84 42" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="33" cy="12" r="8" fill="#fde047"/><circle cx="51" cy="12" r="8" fill="#fde047"/><circle cx="42" cy="9" r="8" fill="#fde047"/><circle cx="42" cy="15.5" r="7.5" fill="#f1c29b"/><rect x="33" y="10" width="18" height="3" rx="1" fill="#ec4899"/><rect x="29" y="24" width="26" height="15" rx="3" fill="#f8fafc" stroke="#ec4899" stroke-width="1.4"/><path d="M31 27l22 5M31 33l22 5" stroke="#09090b" stroke-width="2.4"/></svg>',
  },
  {
    id: 'chrome-synth-dj',
    registryId: 'Star_Chrome_Synth_DJ',
    name: 'Chrome Synth Helmet DJ-Keys',
    shortName: 'Chrome Synth',
    targetRole: 'piano',
    customSculpt: 'chrome-synth-dj',
    description: 'Mirror-visor chrome astronaut helmet with glowing LED equalizer visor strip & sleek black leather suit.',
    swatch: ['#e2e8f0', '#22d3ee'],
    skinColor: 0xcbd5e1,
    hairStyle: 'chrome-helmet',
    hairColor: 0xe2e8f0,
    torsoColor: 0x09090b,
    torsoEmissive: 0x0e7490,
    accentColor: 0x22d3ee,
    skirtColor: null,
    legColor: 0x09090b,
    bootColor: 0xe2e8f0,
    glitter: false,
    face: {
      visorLed: true,
      expression: 'hero',
    },
    svgIcon: '<svg viewBox="0 0 84 42" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="31" y="4" width="22" height="19" rx="9" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1.5"/><rect x="33" y="11" width="18" height="6" rx="2.5" fill="#09090b"/><path d="M35 14h2M39 12.5v3M43 13v2.5M47 12.5v3" stroke="#22d3ee" stroke-width="1.6" stroke-linecap="round"/><rect x="29" y="24" width="26" height="15" rx="3" fill="#09090b" stroke="#22d3ee" stroke-width="1.3"/></svg>',
  },
  {
    id: 'punk-skater-bass',
    registryId: 'Star_Punk_Skater_Bass',
    name: 'Punk Skater Bassist',
    shortName: 'Punk Skater',
    targetRole: 'bass',
    customSculpt: 'punk-skater-bass',
    description: 'Backwards snapback cap, spiked wristband studs, faded skate tee & baggy cargo shorts.',
    swatch: ['#22c55e', '#111827'],
    skinColor: 0xefc097,
    hairStyle: 'backwards-cap',
    hairColor: 0xdc2626,
    torsoColor: 0x18181b,
    torsoEmissive: 0x166534,
    accentColor: 0x4ade80,
    skirtColor: null,
    legColor: 0x57534e,
    bootColor: 0x09090b,
    glitter: false,
    face: {
      expression: 'rockstar',
      lipColor: '#be123c',
    },
    svgIcon: '<svg viewBox="0 0 84 42" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M33 10c2-5 16-5 18 0h6v3H33v-3z" fill="#dc2626"/><circle cx="42" cy="16" r="8" fill="#efc097"/><circle cx="38.5" cy="15" r="1.2" fill="#111827"/><circle cx="45.5" cy="15" r="1.2" fill="#111827"/><path d="M38 19q4 2.5 8 0" stroke="#111827" stroke-width="1.6"/><rect x="28" y="24" width="28" height="11" rx="2" fill="#18181b" stroke="#4ade80" stroke-width="1.3"/><rect x="28" y="34" width="28" height="6" fill="#57534e"/></svg>',
  },
  {
    id: 'mariachi-virtuoso',
    registryId: 'Star_Mariachi_Virtuoso',
    name: 'Mariachi / Latin Rock Virtuoso',
    shortName: 'Mariachi Virtuoso',
    targetRole: 'frontperson',
    customSculpt: 'mariachi-virtuoso',
    description: 'Ornate gold-embroidered charro jacket, crimson bow & wide velvet stadium sombrero.',
    swatch: ['#111827', '#facc15'],
    skinColor: 0xd69a6c,
    hairStyle: 'sombrero',
    hairColor: 0x18181b,
    torsoColor: 0x09090b,
    torsoEmissive: 0x713f12,
    accentColor: 0xfacc15,
    skirtColor: null,
    legColor: 0x09090b,
    bootColor: 0x18181b,
    glitter: true,
    face: {
      mustache: true,
      expression: 'hero',
    },
    svgIcon: '<svg viewBox="0 0 84 42" fill="none" xmlns="http://www.w3.org/2000/svg"><ellipse cx="42" cy="11" rx="20" ry="3.5" fill="#111827" stroke="#facc15" stroke-width="1.5"/><path d="M34 11c1-6 15-6 16 0" fill="#111827" stroke="#facc15" stroke-width="1.3"/><circle cx="42" cy="17" r="7.5" fill="#d69a6c"/><path d="M37 20q5-2 10 0" stroke="#111827" stroke-width="2"/><rect x="29" y="25" width="26" height="14" rx="3" fill="#09090b" stroke="#facc15" stroke-width="1.5"/><path d="M42 25l-4 3 4 3 4-3-4-3z" fill="#ef4444"/></svg>',
  },
  {
    id: 'golden-mech-drummer',
    registryId: 'Star_Golden_Mech_Drummer',
    name: 'Golden Mech Drummer',
    shortName: 'Golden Mech',
    targetRole: 'drums',
    customSculpt: 'golden-mech-drummer',
    description: 'Articulated brass-and-chrome cybernetic drummer with glowing optic visor & hydraulic piston arms.',
    swatch: ['#f59e0b', '#cbd5e1'],
    skinColor: 0xfbbf24,
    hairStyle: 'mech-visor',
    hairColor: 0x38bdf8,
    torsoColor: 0xd97706,
    torsoEmissive: 0x92400e,
    accentColor: 0x38bdf8,
    skirtColor: null,
    legColor: 0x94a3b8,
    bootColor: 0x451a03,
    glitter: false,
    face: {
      visorLed: true,
      expression: 'hero',
    },
    svgIcon: '<svg viewBox="0 0 84 42" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="32" y="5" width="20" height="17" rx="3" fill="#fbbf24" stroke="#78350f" stroke-width="1.5"/><rect x="34" y="10" width="16" height="4.5" rx="1.5" fill="#0f172a"/><rect x="36" y="11" width="12" height="2.2" rx="1" fill="#38bdf8"/><rect x="27" y="24" width="30" height="15" rx="2" fill="#d97706" stroke="#e2e8f0" stroke-width="1.5"/><circle cx="42" cy="31" r="3.5" fill="#38bdf8"/></svg>',
  },
  {
    id: 'gothic-vampire',
    registryId: 'Star_Gothic_Vampire',
    name: 'Gothic Vampire Frontperson',
    shortName: 'Gothic Vampire',
    targetRole: 'frontperson',
    customSculpt: 'gothic-vampire',
    description: 'Flowing crimson-lined velvet high-collar coat, silver cravat & pale nocturnal stage charisma.',
    swatch: ['#991b1b', '#09090b'],
    skinColor: 0xf1f5f9,
    hairStyle: 'slick-back',
    hairColor: 0x09090b,
    torsoColor: 0x111827,
    torsoEmissive: 0x7f1d1d,
    accentColor: 0xdc2626,
    skirtColor: null,
    legColor: 0x09090b,
    bootColor: 0x09090b,
    glitter: false,
    face: {
      eyeliner: true,
      eyeshadow: '#7f1d1d',
      lipColor: '#7f1d1d',
      fangs: true,
      expression: 'rockstar',
    },
    svgIcon: '<svg viewBox="0 0 84 42" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M26 24l6-6h20l6 6-4 15H30l-4-15z" fill="#7f1d1d" stroke="#dc2626" stroke-width="1.3"/><circle cx="42" cy="14" r="8" fill="#f1f5f9"/><path d="M33 11c3-6 15-6 18 0l-9 3-9-3z" fill="#09090b"/><path d="M39 18l1 2.2 1-2.2h2l1 2.2 1-2.2" stroke="#ffffff" stroke-width="1.3" fill="none"/><rect x="33" y="25" width="18" height="14" fill="#09090b"/><path d="M40 25h4v8l-2 2-2-2v-8z" fill="#e2e8f0"/></svg>',
  },
  {
    id: 'reggae-legend',
    registryId: 'Star_Reggae_Legend',
    name: 'Reggae / Island Legend',
    shortName: 'Reggae Legend',
    targetRole: 'frontperson',
    customSculpt: 'reggae-legend',
    danceStyle: 'reggae-groove',
    description: 'Striped red-gold-green Rasta tam hat over long dark dreadlocks, tie-dye stage vest & laid-back island dub groove.',
    swatch: ['#16a34a', '#facc15'],
    skinColor: 0x8d5524,
    hairStyle: 'dreadlocks-tam',
    hairColor: 0x111827,
    torsoColor: 0x15803d,
    torsoEmissive: 0x854d0e,
    accentColor: 0xfacc15,
    skirtColor: null,
    legColor: 0x1e293b,
    bootColor: 0x451a03,
    glitter: false,
    face: {
      expression: 'rockstar',
      mustache: true,
    },
    svgIcon: '<svg viewBox="0 0 84 42" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M30 12c2-7 22-7 24 0l2 6H28l2-6z" fill="#16a34a"/><path d="M30 13h24v2.5H30z" fill="#facc15"/><path d="M30 15.5h24V18H30z" fill="#dc2626"/><path d="M29 18v12M32 18v13M52 18v13M55 18v12" stroke="#111827" stroke-width="2.6" stroke-linecap="round"/><circle cx="42" cy="18" r="7.5" fill="#8d5524"/><rect x="29" y="26" width="26" height="13" rx="3" fill="#15803d" stroke="#facc15" stroke-width="1.3"/></svg>',
  },
  {
    id: 'soul-funk-bassist',
    registryId: 'Star_Soul_Funk_Bassist',
    name: 'Classic Soul / Funk Bassist',
    shortName: 'Soul Funk Bass',
    targetRole: 'bass',
    customSculpt: 'soul-funk-bassist',
    danceStyle: 'funk-spin',
    description: 'Royal purple velvet stage coat, ruffled white jabot shirt, gold belt & tinted funk sunglasses.',
    swatch: ['#7e22ce', '#facc15'],
    skinColor: 0x9f6234,
    hairStyle: 'funk-pompadour',
    hairColor: 0x09090b,
    torsoColor: 0x6b21a8,
    torsoEmissive: 0x4c1d95,
    accentColor: 0xfde047,
    skirtColor: null,
    legColor: 0x581c87,
    bootColor: 0xf8fafc,
    glitter: true,
    face: {
      sunglasses: true,
      sunglassesTint: '#581c87',
      mustache: true,
      expression: 'glam',
    },
    svgIcon: '<svg viewBox="0 0 84 42" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M33 12c0-7 18-7 18 0l2 6H31l2-6z" fill="#09090b"/><circle cx="42" cy="15.5" r="7.5" fill="#9f6234"/><rect x="35" y="13" width="6" height="3.5" rx="1" fill="#3b0764" stroke="#facc15" stroke-width="0.9"/><rect x="43" y="13" width="6" height="3.5" rx="1" fill="#3b0764" stroke="#facc15" stroke-width="0.9"/><rect x="29" y="24" width="26" height="15" rx="3" fill="#6b21a8" stroke="#facc15" stroke-width="1.3"/><path d="M39 24h6v10l-3 3-3-3V24z" fill="#f8fafc"/></svg>',
  },
  {
    id: 'kpop-main-dancer',
    registryId: 'Star_KPop_Main_Dancer',
    name: 'K-Pop Main Dancer',
    shortName: 'K-Pop Dancer',
    targetRole: 'frontperson',
    customSculpt: 'kpop-main-dancer',
    danceStyle: 'kpop-choreo',
    description: 'High sleek idol ponytail, pastel-neon cropped stage jacket & crisp stadium dance choreography.',
    swatch: ['#f472b6', '#38bdf8'],
    skinColor: 0xfce7dc,
    hairStyle: 'kpop-ponytail',
    hairColor: 0x1e1b4b,
    torsoColor: 0xf472b6,
    torsoEmissive: 0xdb2777,
    accentColor: 0x38bdf8,
    skirtColor: 0x0f172a,
    legColor: 0xfce7dc,
    bootColor: 0xf8fafc,
    glitter: true,
    face: {
      eyeliner: true,
      eyeshadow: '#f472b6',
      blush: 'rgba(244, 114, 182, 0.38)',
      lipColor: '#ec4899',
      expression: 'glam',
    },
    svgIcon: '<svg viewBox="0 0 84 42" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M48 6c7 2 10 12 8 22" stroke="#1e1b4b" stroke-width="4.5" stroke-linecap="round"/><circle cx="42" cy="14" r="8" fill="#fce7dc"/><path d="M33 12c2-6 16-6 18 0" fill="#1e1b4b"/><circle cx="48" cy="7" r="2.2" fill="#38bdf8"/><rect x="30" y="24" width="24" height="10" rx="2.5" fill="#f472b6" stroke="#38bdf8" stroke-width="1.3"/><path d="M29 34h26l2 5H27l2-5z" fill="#0f172a"/></svg>',
  },
  {
    id: 'cyber-samurai',
    registryId: 'Star_Cyber_Samurai',
    name: 'Cyber Samurai Shredder',
    shortName: 'Cyber Samurai',
    targetRole: 'guitar',
    customSculpt: 'cyber-samurai',
    danceStyle: 'samurai-shred',
    description: 'Horned neon kabuto helm, glowing crimson cyber visor, layered shoulder armor & katana scabbard on back.',
    swatch: ['#ef4444', '#0f172a'],
    skinColor: 0xf1c29b,
    hairStyle: 'samurai-kabuto',
    hairColor: 0x0f172a,
    torsoColor: 0x111827,
    torsoEmissive: 0x991b1b,
    accentColor: 0xef4444,
    skirtColor: null,
    legColor: 0x0f172a,
    bootColor: 0x18181b,
    glitter: false,
    face: {
      visorLed: true,
      expression: 'hero',
    },
    svgIcon: '<svg viewBox="0 0 84 42" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M30 14l4-8h16l4 8H30z" fill="#0f172a" stroke="#ef4444" stroke-width="1.3"/><path d="M36 7l-6-4M48 7l6-4" stroke="#facc15" stroke-width="2.2" stroke-linecap="round"/><rect x="33" y="13" width="18" height="6" rx="2" fill="#1e293b"/><rect x="35" y="14.5" width="14" height="2.4" rx="1" fill="#ef4444"/><rect x="27" y="23" width="30" height="16" rx="2" fill="#111827" stroke="#ef4444" stroke-width="1.4"/></svg>',
  },
  {
    id: 'country-outlaw',
    registryId: 'Star_Country_Outlaw',
    name: 'Country / Southern Rock Outlaw',
    shortName: 'Country Outlaw',
    targetRole: 'guitar',
    customSculpt: 'country-outlaw',
    danceStyle: 'country-twang',
    description: 'Wide-brim Stetson cowboy hat, fringed suede vest, brass rodeo belt buckle & highway honky-tonk swagger.',
    swatch: ['#b45309', '#fde047'],
    skinColor: 0xe6b088,
    hairStyle: 'cowboy-hat',
    hairColor: 0x78350f,
    torsoColor: 0x92400e,
    torsoEmissive: 0x451a03,
    accentColor: 0xfacc15,
    skirtColor: null,
    legColor: 0x1e3a8a,
    bootColor: 0x451a03,
    glitter: false,
    face: {
      mustache: true,
      sunglasses: false,
      expression: 'rockstar',
    },
    svgIcon: '<svg viewBox="0 0 84 42" fill="none" xmlns="http://www.w3.org/2000/svg"><ellipse cx="42" cy="12" rx="18" ry="3.2" fill="#78350f" stroke="#451a03" stroke-width="1.2"/><path d="M34 11l2-6h12l2 6H34z" fill="#92400e"/><circle cx="42" cy="17.5" r="7" fill="#e6b088"/><path d="M37 20q5-2 10 0" stroke="#451a03" stroke-width="2"/><rect x="29" y="25" width="26" height="14" rx="3" fill="#92400e" stroke="#facc15" stroke-width="1.2"/><ellipse cx="42" cy="36" rx="4" ry="2.4" fill="#facc15"/></svg>',
  },
  {
    id: 'jpop-vocaloid-idol',
    registryId: 'Star_JPop_Vocaloid_Idol',
    name: 'J-Pop Vocaloid Synth Idol',
    shortName: 'Vocaloid Idol',
    targetRole: 'piano',
    customSculpt: 'jpop-vocaloid-idol',
    danceStyle: 'idol-jump',
    description: 'Glowing electric-aqua twin-tails with magenta cyber hairbands, holographic collar & hyper-kinetic synth hops.',
    swatch: ['#2dd4bf', '#ec4899'],
    skinColor: 0xfef2f2,
    hairStyle: 'vocaloid-twintails',
    hairColor: 0x2dd4bf,
    torsoColor: 0xf1f5f9,
    torsoEmissive: 0x0d9488,
    accentColor: 0xec4899,
    skirtColor: 0x0f172a,
    legColor: 0x0f172a,
    bootColor: 0x2dd4bf,
    glitter: true,
    face: {
      eyeliner: true,
      eyeshadow: '#2dd4bf',
      blush: 'rgba(236, 72, 153, 0.32)',
      lipColor: '#ec4899',
      expression: 'glam',
    },
    svgIcon: '<svg viewBox="0 0 84 42" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M24 10c-5 10-4 22-1 28M60 10c5 10 4 22 1 28" stroke="#2dd4bf" stroke-width="5.5" stroke-linecap="round"/><rect x="25" y="10" width="5" height="4" rx="1" fill="#ec4899"/><rect x="54" y="10" width="5" height="4" rx="1" fill="#ec4899"/><circle cx="42" cy="14" r="7.5" fill="#fef2f2"/><rect x="30" y="24" width="24" height="14" rx="3" fill="#f1f5f9" stroke="#ec4899" stroke-width="1.3"/></svg>',
  },
  {
    id: 'grunge-flannel',
    registryId: 'Star_Grunge_Flannel',
    name: '90s Grunge Flannel Frontperson',
    shortName: '90s Grunge',
    targetRole: 'frontperson',
    customSculpt: 'grunge-flannel',
    danceStyle: 'grunge-nod',
    description: 'Messy blonde shoulder shag, crimson-and-black plaid open flannel shirt over worn concert tee & heavy stadium nod.',
    swatch: ['#b91c1c', '#facc15'],
    skinColor: 0xf1c29b,
    hairStyle: 'grunge-shag',
    hairColor: 0xfde047,
    torsoColor: 0xb91c1c,
    torsoEmissive: 0x450a0a,
    accentColor: 0x09090b,
    skirtColor: null,
    legColor: 0x3b82f6,
    bootColor: 0x111827,
    glitter: false,
    face: {
      expression: 'intense',
    },
    svgIcon: '<svg viewBox="0 0 84 42" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M29 15c1-9 25-9 26 0l2 10H27l2-10z" fill="#fde047"/><circle cx="42" cy="16" r="7" fill="#f1c29b"/><rect x="28" y="24" width="28" height="15" rx="3" fill="#b91c1c" stroke="#09090b" stroke-width="1.4"/><path d="M38 24h8v15h-8z" fill="#f8fafc"/><path d="M30 29h24M30 34h24" stroke="#09090b" stroke-width="1.4" stroke-opacity="0.55"/></svg>',
  },
  {
    id: 'steampunk-brass',
    registryId: 'Star_Steampunk_Brass',
    name: 'Steampunk Brass Virtuoso',
    shortName: 'Steampunk Brass',
    targetRole: 'piano',
    customSculpt: 'steampunk-brass',
    danceStyle: 'steampunk-bow',
    description: 'Victorian stovepipe top hat strapped with brass clockwork goggles, copper chest gears & burgundy tailcoat.',
    swatch: ['#d97706', '#7f1d1d'],
    skinColor: 0xefc097,
    hairStyle: 'steampunk-goggles',
    hairColor: 0x451a03,
    torsoColor: 0x7f1d1d,
    torsoEmissive: 0x78350f,
    accentColor: 0xf59e0b,
    skirtColor: null,
    legColor: 0x1c1917,
    bootColor: 0x451a03,
    glitter: false,
    face: {
      mustache: true,
      expression: 'hero',
    },
    svgIcon: '<svg viewBox="0 0 84 42" fill="none" xmlns="http://www.w3.org/2000/svg"><ellipse cx="42" cy="12" rx="14" ry="2.6" fill="#292524"/><rect x="34" y="3" width="16" height="9" rx="1.5" fill="#451a03" stroke="#f59e0b" stroke-width="1.1"/><circle cx="38" cy="9" r="3" fill="#38bdf8" stroke="#f59e0b" stroke-width="1.3"/><circle cx="46" cy="9" r="3" fill="#38bdf8" stroke="#f59e0b" stroke-width="1.3"/><circle cx="42" cy="17" r="7" fill="#efc097"/><rect x="29" y="25" width="26" height="14" rx="3" fill="#7f1d1d" stroke="#f59e0b" stroke-width="1.3"/><circle cx="42" cy="31" r="3" fill="#f59e0b"/></svg>',
  },
];

export const INSTRUMENT_SKINS = [
  {
    id: 'classic-sunburst',
    registryId: 'Skin_Classic_Sunburst',
    name: 'Classic Sunburst & Chrome',
    shortName: 'Classic Sunburst',
    description: 'Warm flame-maple sunburst lacquer, polished chrome hardware & vintage tour trim.',
    swatch: ['#7c2d12', '#f59e0b'],
    pattern: 'sunburst',
    baseHex: '#ea580c',
    secondaryHex: '#fde047',
    darkHex: '#1c0a05',
    accentHex: '#f59e0b',
    hardwareColor: 0xe2e8f0,
    roughness: 0.22,
    metalness: 0.28,
    emissiveHex: 0x000000,
    emissiveIntensity: 0.0,
    drumSubLabel: 'LIVE',
    svgIcon: '<svg viewBox="0 0 84 40" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="skSun" cx="50%" cy="50%" r="55%"><stop offset="0%" stop-color="#fde047"/><stop offset="52%" stop-color="#ea580c"/><stop offset="100%" stop-color="#290f07"/></radialGradient></defs><rect x="6" y="5" width="72" height="30" rx="8" fill="url(#skSun)" stroke="#e2e8f0" stroke-width="2"/><path d="M12 14h60M12 20h60M12 26h60" stroke="#fef3c7" stroke-opacity="0.22" stroke-width="1.5"/></svg>',
  },
  {
    id: 'royal-gold',
    registryId: 'Skin_Royal_Gold_24K',
    name: '24K Royal Gold & Ivory',
    shortName: '24K Royal Gold',
    description: 'Mirror-burnished 24K gold leaf plating, pearl ivory filigree & gilded stage hardware.',
    swatch: ['#78350f', '#fde047'],
    pattern: 'royal-gold',
    baseHex: '#eab308',
    secondaryHex: '#fef9c3',
    darkHex: '#451a03',
    accentHex: '#facc15',
    hardwareColor: 0xfef08a,
    roughness: 0.14,
    metalness: 0.88,
    emissiveHex: 0x713f12,
    emissiveIntensity: 0.28,
    drumSubLabel: '24K GOLD',
    svgIcon: '<svg viewBox="0 0 84 40" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="skGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fef08a"/><stop offset="48%" stop-color="#d97706"/><stop offset="100%" stop-color="#fef9c3"/></linearGradient></defs><rect x="6" y="5" width="72" height="30" rx="8" fill="url(#skGold)" stroke="#fef9c3" stroke-width="2"/><path d="M42 10l6 10-6 10-6-10 6-10z" fill="#fffbeb" stroke="#78350f" stroke-width="1.3"/></svg>',
  },
  {
    id: 'cyber-hologram',
    registryId: 'Skin_Cyber_Hologram',
    name: 'Cyber Neon Hologram',
    shortName: 'Cyber Hologram',
    description: 'Iridescent synthwave prism weave with glowing cyan & magenta neon circuit veins.',
    swatch: ['#06b6d4', '#ec4899'],
    pattern: 'cyber-holo',
    baseHex: '#06b6d4',
    secondaryHex: '#ec4899',
    darkHex: '#0f172a',
    accentHex: '#22d3ee',
    hardwareColor: 0x67e8f9,
    roughness: 0.16,
    metalness: 0.72,
    emissiveHex: 0x0891b2,
    emissiveIntensity: 0.72,
    drumSubLabel: 'CYBER',
    svgIcon: '<svg viewBox="0 0 84 40" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="skHolo" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#22d3ee"/><stop offset="50%" stop-color="#8b5cf6"/><stop offset="100%" stop-color="#ec4899"/></linearGradient></defs><rect x="6" y="5" width="72" height="30" rx="8" fill="#0f172a" stroke="url(#skHolo)" stroke-width="2.2"/><path d="M12 13l14 14 14-14 14 14 18-14" stroke="#22d3ee" stroke-width="2"/><path d="M12 27l14-14 14 14 14-14 18 14" stroke="#ec4899" stroke-width="1.6" opacity="0.85"/></svg>',
  },
  {
    id: 'inferno-lava',
    registryId: 'Skin_Inferno_Lava',
    name: 'Inferno Lava Crackle',
    shortName: 'Inferno Lava',
    description: 'Charred volcanic basalt shell split by molten glowing magma fissures & ember trim.',
    swatch: ['#1c0a05', '#f97316'],
    pattern: 'inferno-lava',
    baseHex: '#dc2626',
    secondaryHex: '#fb923c',
    darkHex: '#180907',
    accentHex: '#f97316',
    hardwareColor: 0x3f3f46,
    roughness: 0.42,
    metalness: 0.34,
    emissiveHex: 0xea580c,
    emissiveIntensity: 0.85,
    drumSubLabel: 'INFERNO',
    svgIcon: '<svg viewBox="0 0 84 40" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="5" width="72" height="30" rx="8" fill="#1c0a05" stroke="#f97316" stroke-width="2"/><path d="M12 28l12-10 9 7 13-14 11 9 15-8" stroke="#f97316" stroke-width="2.5" stroke-linecap="round"/><path d="M12 28l12-10 9 7 13-14 11 9 15-8" stroke="#fde047" stroke-width="1" stroke-linecap="round"/></svg>',
  },
  {
    id: 'frostbite-ice',
    registryId: 'Skin_Frostbite_Ice',
    name: 'Frostbite Crystal Ice',
    shortName: 'Frostbite Ice',
    description: 'Glacial crystalline prism facets with arctic frost sheen & icy sapphire glow.',
    swatch: ['#bae6fd', '#0284c7'],
    pattern: 'frost-ice',
    baseHex: '#7dd3fc',
    secondaryHex: '#e0f2fe',
    darkHex: '#0c4a6e',
    accentHex: '#38bdf8',
    hardwareColor: 0xe0f2fe,
    roughness: 0.12,
    metalness: 0.56,
    emissiveHex: 0x0284c7,
    emissiveIntensity: 0.48,
    drumSubLabel: 'FROST',
    svgIcon: '<svg viewBox="0 0 84 40" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="skIce" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f0f9ff"/><stop offset="50%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#0369a1"/></linearGradient></defs><rect x="6" y="5" width="72" height="30" rx="8" fill="url(#skIce)" stroke="#e0f2fe" stroke-width="2"/><path d="M24 8l12 12-12 12M60 8L48 20l12 12M42 9v22" stroke="#ffffff" stroke-opacity="0.7" stroke-width="1.6"/></svg>',
  },
  {
    id: 'sakura-pearl',
    registryId: 'Skin_Sakura_Pearl',
    name: 'Sakura Pearl Blossom',
    shortName: 'Sakura Pearl',
    description: 'Lustrous mother-of-pearl blush lacquer adorned with hand-painted sakura petals & rose gold.',
    swatch: ['#fbcfe8', '#f43f5e'],
    pattern: 'sakura-pearl',
    baseHex: '#f9a8d4',
    secondaryHex: '#fff1f2',
    darkHex: '#881337',
    accentHex: '#fb7185',
    hardwareColor: 0xfecdd3,
    roughness: 0.18,
    metalness: 0.36,
    emissiveHex: 0xbe185d,
    emissiveIntensity: 0.24,
    drumSubLabel: 'SAKURA',
    svgIcon: '<svg viewBox="0 0 84 40" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="skSakura" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fff1f2"/><stop offset="55%" stop-color="#fbcfe8"/><stop offset="100%" stop-color="#f472b6"/></linearGradient></defs><rect x="6" y="5" width="72" height="30" rx="8" fill="url(#skSakura)" stroke="#fb7185" stroke-width="2"/><circle cx="30" cy="20" r="4.5" fill="#f43f5e"/><circle cx="44" cy="15" r="3.5" fill="#fb7185"/><circle cx="56" cy="24" r="4" fill="#e11d48"/></svg>',
  },
  {
    id: 'galaxy-nebula',
    registryId: 'Skin_Galaxy_Nebula',
    name: 'Galaxy Nebula Starfield',
    shortName: 'Galaxy Nebula',
    description: 'Deep cosmic indigo & ultraviolet nebula clouds dotted with twinkling starlight specks.',
    swatch: ['#312e81', '#c084fc'],
    pattern: 'galaxy-nebula',
    baseHex: '#4c1d95',
    secondaryHex: '#e9d5ff',
    darkHex: '#09071a',
    accentHex: '#c084fc',
    hardwareColor: 0xe9d5ff,
    roughness: 0.16,
    metalness: 0.62,
    emissiveHex: 0x6b21a8,
    emissiveIntensity: 0.58,
    drumSubLabel: 'GALAXY',
    svgIcon: '<svg viewBox="0 0 84 40" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="skGal" cx="45%" cy="45%" r="65%"><stop offset="0%" stop-color="#c084fc"/><stop offset="52%" stop-color="#312e81"/><stop offset="100%" stop-color="#09071a"/></radialGradient></defs><rect x="6" y="5" width="72" height="30" rx="8" fill="url(#skGal)" stroke="#c084fc" stroke-width="2"/><circle cx="22" cy="14" r="1.4" fill="#fff"/><circle cx="38" cy="24" r="1.2" fill="#fde047"/><circle cx="56" cy="13" r="1.6" fill="#fff"/><circle cx="66" cy="25" r="1.2" fill="#38bdf8"/></svg>',
  },
  {
    id: 'midnight-stealth',
    registryId: 'Skin_Midnight_Stealth',
    name: 'Stealth Matte Crimson',
    shortName: 'Stealth Crimson',
    description: 'Tactical satin-black carbon weave, blacked-out gunmetal hardware & glowing crimson edge trim.',
    swatch: ['#09090b', '#ef4444'],
    pattern: 'carbon-stealth',
    baseHex: '#18181b',
    secondaryHex: '#27272a',
    darkHex: '#09090b',
    accentHex: '#ef4444',
    hardwareColor: 0x27272a,
    roughness: 0.62,
    metalness: 0.42,
    emissiveHex: 0x7f1d1d,
    emissiveIntensity: 0.28,
    drumSubLabel: 'STEALTH',
    svgIcon: '<svg viewBox="0 0 84 40" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="5" width="72" height="30" rx="8" fill="#111114" stroke="#52525b" stroke-width="2"/><path d="M12 13h60M12 20h60M12 27h60" stroke="#27272a" stroke-width="2"/><line x1="12" y1="30" x2="72" y2="30" stroke="#ef4444" stroke-width="2"/></svg>',
  },
  {
    id: 'swamp-moss',
    registryId: 'Skin_Swamp_Moss',
    name: 'Swamp Oak & Moss',
    shortName: 'Swamp Moss',
    description: 'Carved ancient swamp oak with vibrant emerald moss inlays & antique bronze trim.',
    swatch: ['#3f6212', '#84cc16'],
    pattern: 'swamp-moss',
    baseHex: '#4d7c0f',
    secondaryHex: '#bef264',
    darkHex: '#1a2e05',
    accentHex: '#84cc16',
    hardwareColor: 0xd97706,
    roughness: 0.48,
    metalness: 0.22,
    emissiveHex: 0x365314,
    emissiveIntensity: 0.28,
    drumSubLabel: 'SWAMP',
    svgIcon: '<svg viewBox="0 0 84 40" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="5" width="72" height="30" rx="8" fill="#365314" stroke="#84cc16" stroke-width="2"/><path d="M12 24c10-8 22 4 32-6s20 4 28-4" stroke="#bef264" stroke-width="2.5" stroke-linecap="round"/></svg>',
  },
  {
    id: 'zebra-glam',
    registryId: 'Skin_Zebra_Glam',
    name: '80s Hair-Metal Zebra',
    shortName: 'Zebra Glam',
    description: 'Bold monochrome & hot-pink 80s hair-metal zebra stripes with mirror chrome hardware.',
    swatch: ['#f8fafc', '#ec4899'],
    pattern: 'zebra-glam',
    baseHex: '#f8fafc',
    secondaryHex: '#ec4899',
    darkHex: '#09090b',
    accentHex: '#f472b6',
    hardwareColor: 0xf8fafc,
    roughness: 0.2,
    metalness: 0.36,
    emissiveHex: 0x9d174d,
    emissiveIntensity: 0.22,
    drumSubLabel: 'GLAM 80S',
    svgIcon: '<svg viewBox="0 0 84 40" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="5" width="72" height="30" rx="8" fill="#f8fafc" stroke="#ec4899" stroke-width="2"/><path d="M16 5l8 16-6 14M32 5l10 15-8 15M50 5l9 16-7 14M66 5l6 15-5 15" stroke="#09090b" stroke-width="4"/></svg>',
  },
  {
    id: 'diamond-chrome',
    registryId: 'Skin_Diamond_Chrome',
    name: 'Diamond Plate Chrome',
    shortName: 'Diamond Chrome',
    description: 'Mirror-polished industrial diamond-plate alloy with razor cyan specular facets.',
    swatch: ['#cbd5e1', '#38bdf8'],
    pattern: 'diamond-chrome',
    baseHex: '#e2e8f0',
    secondaryHex: '#ffffff',
    darkHex: '#334155',
    accentHex: '#38bdf8',
    hardwareColor: 0xffffff,
    roughness: 0.12,
    metalness: 0.94,
    emissiveHex: 0x0c4a6e,
    emissiveIntensity: 0.22,
    drumSubLabel: 'CHROME',
    svgIcon: '<svg viewBox="0 0 84 40" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="5" width="72" height="30" rx="8" fill="#cbd5e1" stroke="#38bdf8" stroke-width="2"/><path d="M16 14l8-5 8 5-8 5-8-5zm22 10l8-5 8 5-8 5-8-5zm22-10l8-5 8 5-8 5-8-5z" fill="#f8fafc" stroke="#475569" stroke-width="1"/></svg>',
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

export function getKeyboardModelById(id) {
  return KEYBOARD_MODELS.find((k) => k.id === id) || KEYBOARD_MODELS[0];
}

export function getStarLookById(id) {
  return STAR_LOOKALIKES.find((s) => s.id === id) || STAR_LOOKALIKES[0];
}

export function getInstrumentSkinById(id) {
  return INSTRUMENT_SKINS.find((s) => s.id === id) || INSTRUMENT_SKINS[0];
}

/* ==========================================================================
   3B. VENUE ARCHITECTURAL PALETTES & SHARED PRO-TOURING PBR HELPERS
   ========================================================================== */

export const VENUE_ARCHITECTURAL_PALETTES = {
  'philippine-arena': {
    id: 'philippine-arena',
    horizonStyle: 'bulacan-skyline',
    seatColor: 0x111726,
    bowlColor: 0x111726,
    fasciaHex: 0x38bdf8,
    fasciaColor: 0x38bdf8,
    exteriorShell: 0x1e293b,
    cityAccent: 0x38bdf8,
  },
  'moa-arena': {
    id: 'moa-arena',
    horizonStyle: 'manila-bay',
    seatColor: 0x0b162c,
    bowlColor: 0x0b162c,
    fasciaHex: 0x06b6d4,
    fasciaColor: 0x06b6d4,
    exteriorShell: 0x0e7490,
    cityAccent: 0x22d3ee,
  },
  wembley: {
    id: 'wembley',
    horizonStyle: 'london-skyline',
    seatColor: 0x2a1218,
    bowlColor: 0x2a1218,
    fasciaHex: 0xef4444,
    fasciaColor: 0xef4444,
    exteriorShell: 0x334155,
    cityAccent: 0xef4444,
  },
  'madison-square-garden': {
    id: 'madison-square-garden',
    horizonStyle: 'manhattan-midtown',
    seatColor: 0x131222,
    bowlColor: 0x131222,
    fasciaHex: 0x818cf8,
    fasciaColor: 0x818cf8,
    exteriorShell: 0x1e1b4b,
    cityAccent: 0xfacc15,
  },
  'tokyo-dome': {
    id: 'tokyo-dome',
    horizonStyle: 'tokyo-dome-city',
    seatColor: 0x0d1226,
    bowlColor: 0x0d1226,
    fasciaHex: 0xc084fc,
    fasciaColor: 0xc084fc,
    exteriorShell: 0xdbeafe,
    cityAccent: 0xe879f9,
  },
  'red-rocks': {
    id: 'red-rocks',
    horizonStyle: 'colorado-canyon',
    seatColor: 0x451a10,
    bowlColor: 0x451a10,
    fasciaHex: 0xea580c,
    fasciaColor: 0xea580c,
    exteriorShell: 0x7c2d12,
    cityAccent: 0xfb923c,
  },
  maracana: {
    id: 'maracana',
    horizonStyle: 'rio-corcovado',
    seatColor: 0x0d2818,
    bowlColor: 0x0d2818,
    fasciaHex: 0x22c55e,
    fasciaColor: 0x22c55e,
    exteriorShell: 0xf8fafc,
    cityAccent: 0xfacc15,
  },
  'sydney-harbour': {
    id: 'sydney-harbour',
    horizonStyle: 'sydney-harbour',
    seatColor: 0x0c1b2e,
    bowlColor: 0x0c1b2e,
    fasciaHex: 0x38bdf8,
    fasciaColor: 0x38bdf8,
    exteriorShell: 0xf8fafc,
    cityAccent: 0x22d3ee,
  },
  'stade-de-france': {
    id: 'stade-de-france',
    horizonStyle: 'paris-skyline',
    seatColor: 0x161b33,
    bowlColor: 0x161b33,
    fasciaHex: 0x60a5fa,
    fasciaColor: 0x60a5fa,
    exteriorShell: 0xe2e8f0,
    cityAccent: 0xfacc15,
  },
  'seoul-olympic': {
    id: 'seoul-olympic',
    horizonStyle: 'seoul-han-river',
    seatColor: 0x1b102e,
    bowlColor: 0x1b102e,
    fasciaHex: 0xe879f9,
    fasciaColor: 0xe879f9,
    exteriorShell: 0xe2e8f0,
    cityAccent: 0x22d3ee,
  },
};

export const STAGE_OVERLAY_PALETTES = {
  STANDARD: {
    id: 'STANDARD',
    bannerColor: 0x1e293b,
    trimHex: 0x38bdf8,
    secondaryHex: 0xfacc15,
    fasciaOverride: null,
  },
  CHRISTMAS: {
    id: 'CHRISTMAS',
    bannerColor: 0x991b1b,
    trimHex: 0x38bdf8,
    secondaryHex: 0xfacc15,
    fasciaOverride: 0x38bdf8,
  },
  HALLOWEEN: {
    id: 'HALLOWEEN',
    bannerColor: 0x261538,
    trimHex: 0xa855f7,
    secondaryHex: 0xf97316,
    fasciaOverride: 0xa855f7,
  },
  SAKURA: {
    id: 'SAKURA',
    bannerColor: 0x4a1d39,
    trimHex: 0xf472b6,
    secondaryHex: 0xfef08a,
    fasciaOverride: 0xf472b6,
  },
  CYBER_NEON: {
    id: 'CYBER_NEON',
    bannerColor: 0x140c33,
    trimHex: 0x22d3ee,
    secondaryHex: 0xec4899,
    fasciaOverride: 0x22d3ee,
  },
  ROYAL_OPERA: {
    id: 'ROYAL_OPERA',
    bannerColor: 0x5c1122,
    trimHex: 0xfacc15,
    secondaryHex: 0xfef08a,
    fasciaOverride: 0xfacc15,
  },
  TROPICAL_SUMMER: {
    id: 'TROPICAL_SUMMER',
    bannerColor: 0x7c2d12,
    trimHex: 0xf97316,
    secondaryHex: 0x22d3ee,
    fasciaOverride: 0xf97316,
  },
  FIESTA_PINOY: {
    id: 'FIESTA_PINOY',
    bannerColor: 0x831843,
    trimHex: 0xfacc15,
    secondaryHex: 0xf43f5e,
    fasciaOverride: 0xfacc15,
  },
  APOCALYPSE_HELLFIRE: {
    id: 'APOCALYPSE_HELLFIRE',
    bannerColor: 0x450a0a,
    trimHex: 0xf97316,
    secondaryHex: 0xef4444,
    fasciaOverride: 0xef4444,
  },
};

export function getVenuePalette(venueId) {
  return VENUE_ARCHITECTURAL_PALETTES[venueId] || VENUE_ARCHITECTURAL_PALETTES['philippine-arena'];
}

export function getStageOverlayPalette(overlayId) {
  return STAGE_OVERLAY_PALETTES[overlayId] || STAGE_OVERLAY_PALETTES.STANDARD;
}

export function createPerforatedSteelMaps() {
  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = 128;
  mapCanvas.height = 128;
  const mCtx = mapCanvas.getContext('2d');
  mCtx.fillStyle = '#181c24';
  mCtx.fillRect(0, 0, 128, 128);

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 128;
  bumpCanvas.height = 128;
  const bCtx = bumpCanvas.getContext('2d');
  bCtx.fillStyle = '#c8c8c8';
  bCtx.fillRect(0, 0, 128, 128);

  const step = 8;
  for (let y = 0; y < 128; y += step) {
    const offset = ((y / step) % 2) * (step * 0.5);
    for (let x = -step; x < 128 + step; x += step) {
      const cx = x + offset;
      const cy = y + step * 0.5;
      mCtx.fillStyle = '#07090d';
      mCtx.beginPath();
      mCtx.arc(cx, cy, 2.3, 0, Math.PI * 2);
      mCtx.fill();

      bCtx.fillStyle = '#202020';
      bCtx.beginPath();
      bCtx.arc(cx, cy, 2.3, 0, Math.PI * 2);
      bCtx.fill();
    }
  }

  const map = new THREE.CanvasTexture(mapCanvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(4, 4);
  map.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(4, 4);
  bumpMap.colorSpace = THREE.NoColorSpace;

  return { map, bumpMap };
}

/* ==========================================================================
   4. PROCEDURAL TEXTURES & COMPOSITE 3D INSTRUMENT MESH BUILDERS
   ========================================================================== */

export function createInstrumentSkinTexture(skinId = 'classic-sunburst') {
  const skin = getInstrumentSkinById(skinId);
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  if (skin.pattern === 'royal-gold') {
    const grad = ctx.createLinearGradient(0, 0, 256, 256);
    grad.addColorStop(0, '#fef9c3');
    grad.addColorStop(0.32, '#eab308');
    grad.addColorStop(0.65, '#ca8a04');
    grad.addColorStop(1, '#fef08a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    // Subtle ivory filigree diamonds
    ctx.strokeStyle = 'rgba(255, 251, 235, 0.38)';
    ctx.lineWidth = 2;
    for (let y = 0; y < 256; y += 32) {
      for (let x = 0; x < 256; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x + 16, y + 4);
        ctx.lineTo(x + 28, y + 16);
        ctx.lineTo(x + 16, y + 28);
        ctx.lineTo(x + 4, y + 16);
        ctx.closePath();
        ctx.stroke();
      }
    }
  } else if (skin.pattern === 'cyber-holo') {
    const grad = ctx.createLinearGradient(0, 0, 256, 256);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.42, '#1e1b4b');
    grad.addColorStop(0.75, '#4c1d95');
    grad.addColorStop(1, '#083344');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    // Neon hex/circuit lattice
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2;
    for (let i = -256; i < 512; i += 28) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 256, 256);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(236, 72, 153, 0.72)';
    ctx.lineWidth = 2;
    for (let i = -256; i < 512; i += 36) {
      ctx.beginPath();
      ctx.moveTo(i + 256, 0);
      ctx.lineTo(i, 256);
      ctx.stroke();
    }
  } else if (skin.pattern === 'inferno-lava') {
    ctx.fillStyle = '#140806';
    ctx.fillRect(0, 0, 256, 256);
    // Glowing magma crackle veins
    const veins = [
      [[0, 48], [62, 74], [116, 40], [186, 98], [256, 62]],
      [[0, 148], [54, 122], [118, 168], [174, 132], [256, 174]],
      [[34, 0], [82, 88], [68, 162], [112, 256]],
      [[172, 0], [146, 96], [204, 184], [180, 256]],
    ];
    veins.forEach((pts) => {
      ctx.strokeStyle = 'rgba(234, 88, 12, 0.72)';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
      ctx.stroke();

      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 3;
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
      ctx.stroke();
    });
  } else if (skin.pattern === 'frost-ice') {
    const grad = ctx.createLinearGradient(0, 0, 256, 256);
    grad.addColorStop(0, '#f0f9ff');
    grad.addColorStop(0.4, '#7dd3fc');
    grad.addColorStop(0.75, '#0284c7');
    grad.addColorStop(1, '#e0f2fe');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    // Crystalline ice shards
    for (let i = 0; i < 18; i += 1) {
      const cx = ((i * 67) % 240) + 8;
      const cy = ((i * 97) % 240) + 8;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.34)' : 'rgba(12, 74, 110, 0.22)';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 26);
      ctx.lineTo(cx + 22, cy + 4);
      ctx.lineTo(cx - 8, cy + 26);
      ctx.closePath();
      ctx.fill();
    }
  } else if (skin.pattern === 'sakura-pearl') {
    const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 175);
    grad.addColorStop(0, '#fff1f2');
    grad.addColorStop(0.55, '#fbcfe8');
    grad.addColorStop(1, '#f472b6');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    // Floating sakura blossoms
    for (let i = 0; i < 14; i += 1) {
      const bx = ((i * 53 + 22) % 224) + 16;
      const by = ((i * 79 + 18) % 224) + 16;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(i * 0.7);
      ctx.fillStyle = i % 2 === 0 ? 'rgba(244, 63, 94, 0.55)' : 'rgba(255, 255, 255, 0.78)';
      for (let p = 0; p < 5; p += 1) {
        ctx.rotate((Math.PI * 2) / 5);
        ctx.beginPath();
        ctx.ellipse(0, -7, 3.6, 7.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(0, 0, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  } else if (skin.pattern === 'galaxy-nebula') {
    const grad = ctx.createRadialGradient(112, 118, 12, 128, 128, 178);
    grad.addColorStop(0, '#c084fc');
    grad.addColorStop(0.35, '#581c87');
    grad.addColorStop(0.72, '#1e1b4b');
    grad.addColorStop(1, '#070514');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    // Swirling cosmic magenta/cyan nebula wisps
    const wisp = ctx.createRadialGradient(184, 176, 8, 184, 176, 95);
    wisp.addColorStop(0, 'rgba(56, 189, 248, 0.48)');
    wisp.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = wisp;
    ctx.fillRect(0, 0, 256, 256);
    // Twinkling starlight specks
    for (let i = 0; i < 64; i += 1) {
      const sx = (i * 73 + 17) % 248 + 4;
      const sy = (i * 113 + 29) % 248 + 4;
      const r = i % 7 === 0 ? 2.4 : i % 3 === 0 ? 1.5 : 0.9;
      ctx.fillStyle = i % 9 === 0 ? '#fde047' : i % 5 === 0 ? '#67e8f9' : '#ffffff';
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (skin.pattern === 'carbon-stealth') {
    ctx.fillStyle = '#121216';
    ctx.fillRect(0, 0, 256, 256);
    // Carbon fiber twill weave
    for (let y = 0; y < 256; y += 12) {
      for (let x = 0; x < 256; x += 12) {
        const alt = ((x + y) / 12) % 2 === 0;
        ctx.fillStyle = alt ? '#1f1f25' : '#0b0b0e';
        ctx.fillRect(x, y, 10, 10);
      }
    }
    // Crisp crimson racing pinstripe
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(0, 122, 256, 6);
    ctx.fillRect(0, 132, 256, 2);
  } else if (skin.pattern === 'swamp-moss') {
    const grad = ctx.createLinearGradient(0, 0, 256, 256);
    grad.addColorStop(0, '#365314');
    grad.addColorStop(0.45, '#4d7c0f');
    grad.addColorStop(1, '#1a2e05');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    // Bark & creeping moss veins
    ctx.strokeStyle = 'rgba(190, 242, 100, 0.45)';
    ctx.lineWidth = 5;
    for (let y = 16; y < 256; y += 34) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(68, y - 16, 168, y + 18, 256, y - 4);
      ctx.stroke();
    }
    for (let i = 0; i < 20; i += 1) {
      ctx.fillStyle = 'rgba(132, 204, 22, 0.36)';
      ctx.beginPath();
      ctx.arc((i * 71 + 19) % 240 + 8, (i * 97 + 13) % 240 + 8, 6 + (i % 5) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (skin.pattern === 'zebra-glam') {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 256, 256);
    // Neon glam accent wash + sharp black zebra stripes
    const glamWash = ctx.createLinearGradient(0, 0, 256, 256);
    glamWash.addColorStop(0, 'rgba(236, 72, 153, 0.25)');
    glamWash.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
    glamWash.addColorStop(1, 'rgba(244, 114, 182, 0.3)');
    ctx.fillStyle = glamWash;
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#09090b';
    for (let y = -16; y < 272; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(72, y + 14, 148, y - 18, 256, y + 8);
      ctx.lineTo(256, y + 20);
      ctx.bezierCurveTo(148, y - 4, 72, y + 26, 0, y + 12);
      ctx.closePath();
      ctx.fill();
    }
  } else if (skin.pattern === 'diamond-chrome') {
    const grad = ctx.createLinearGradient(0, 0, 256, 256);
    grad.addColorStop(0, '#f8fafc');
    grad.addColorStop(0.45, '#cbd5e1');
    grad.addColorStop(0.75, '#64748b');
    grad.addColorStop(1, '#f1f5f9');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 16; y < 256; y += 32) {
      for (let x = 16; x < 256; x += 32) {
        const shift = (y / 32) % 2 === 0 ? 0 : 16;
        const px = (x + shift) % 256;
        ctx.save();
        ctx.translate(px, y);
        ctx.rotate(((x + y) % 64 === 0 ? 1 : -1) * Math.PI * 0.25);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-3, -10, 6, 20);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.4;
        ctx.strokeRect(-3, -10, 6, 20);
        ctx.restore();
      }
    }
  } else {
    // Classic flame-maple sunburst
    const grad = ctx.createRadialGradient(128, 128, 16, 128, 128, 134);
    grad.addColorStop(0, '#fde047');
    grad.addColorStop(0.42, '#ea580c');
    grad.addColorStop(0.75, '#7c2d12');
    grad.addColorStop(1, '#1c0a05');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    ctx.strokeStyle = 'rgba(255, 224, 150, 0.14)';
    ctx.lineWidth = 2;
    for (let y = 0; y < 256; y += 7) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(80, y + 4, 170, y - 4, 256, y);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function createAmpGrilleSkinTexture(skinId = 'classic-sunburst') {
  const skin = getInstrumentSkinById(skinId);
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = skin.id === 'frostbite-ice' ? '#0c273b' : skin.id === 'sakura-pearl' ? '#2c1020' : '#12151f';
  ctx.fillRect(0, 0, 256, 256);

  // Speaker grille weave
  ctx.strokeStyle = skin.id === 'royal-gold' ? 'rgba(250, 204, 21, 0.24)' : 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 256; i += 8) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 256);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(256, i);
    ctx.stroke();
  }

  // Skin-themed border trim & speaker silhouette rings
  ctx.strokeStyle = skin.accentHex;
  ctx.lineWidth = 7;
  ctx.strokeRect(8, 8, 240, 240);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
  [
    [76, 78],
    [180, 78],
    [76, 178],
    [180, 178],
  ].forEach(([cx, cy]) => {
    ctx.beginPath();
    ctx.arc(cx, cy, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = skin.accentHex;
    ctx.globalAlpha = 0.32;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
  });

  // Emblem plaque across center
  ctx.fillStyle = skin.darkHex;
  ctx.fillRect(58, 114, 140, 28);
  ctx.strokeStyle = skin.accentHex;
  ctx.lineWidth = 2;
  ctx.strokeRect(58, 114, 140, 28);

  ctx.fillStyle = skin.secondaryHex;
  ctx.font = 'bold 16px Oswald, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(skin.drumSubLabel || 'ENCORE', 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createDrumheadCanvasTexture(accentHex = '#f59e0b', subLabel = 'LIVE', bgHex = '#0f1320') {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(128, 128, 112, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,0.24)';
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
export function buildCustomGuitarMesh(modelId = 'les-paul-sunburst', skinId = 'classic-sunburst') {
  const group = new THREE.Group();
  const textures = [];
  const skin = getInstrumentSkinById(skinId);
  const useCustomSkin = skin.id !== 'classic-sunburst';

  const chromeMat = new THREE.MeshStandardMaterial({
    color: skin.hardwareColor,
    roughness: skin.id === 'midnight-stealth' ? 0.5 : 0.18,
    metalness: 0.9,
  });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.34, metalness: 0.85 });
  const neckMat = new THREE.MeshStandardMaterial({
    color: skin.id === 'midnight-stealth' ? 0x18181b : skin.id === 'frostbite-ice' ? 0x94a3b8 : 0x5c3a21,
    roughness: 0.52,
    metalness: skin.id === 'midnight-stealth' ? 0.25 : 0.06,
  });
  const fretboardMat = new THREE.MeshStandardMaterial({ color: 0x1f1410, roughness: 0.68, metalness: 0.04 });
  const inlayMat = new THREE.MeshStandardMaterial({
    color: useCustomSkin ? skin.accentHex : 0xf8fafc,
    emissive: useCustomSkin ? skin.emissiveHex : 0x000000,
    emissiveIntensity: useCustomSkin ? skin.emissiveIntensity * 0.65 : 0,
    roughness: 0.25,
    metalness: 0.2,
  });

  const makeSkinBodyMat = (fallbackOpts) => {
    if (!useCustomSkin && fallbackOpts) {
      return new THREE.MeshStandardMaterial(fallbackOpts);
    }
    const skinTex = createInstrumentSkinTexture(skin.id);
    textures.push(skinTex);
    return new THREE.MeshStandardMaterial({
      map: skinTex,
      roughness: skin.roughness,
      metalness: skin.metalness,
      emissive: skin.emissiveHex,
      emissiveIntensity: skin.emissiveIntensity,
    });
  };

  let bodyMesh = null;
  let headstockMat = null;
  let neckOffsetX = -0.3;

  if (modelId === 'flying-v' || modelId === 'flying-v-lightning') {
    const isLightning = modelId === 'flying-v-lightning';
    const shape = new THREE.Shape();
    shape.moveTo(-0.42, 0);
    shape.lineTo(0.46, 0.42);
    shape.lineTo(0.52, 0.26);
    shape.lineTo(0.08, 0.04);
    shape.lineTo(0.08, -0.04);
    shape.lineTo(0.52, -0.26);
    shape.lineTo(0.46, -0.42);
    shape.closePath();

    const bodyMat = makeSkinBodyMat({
      color: isLightning ? 0x0369a1 : 0xb91c1c,
      roughness: 0.2,
      metalness: isLightning ? 0.56 : 0.42,
      emissive: isLightning ? 0x0c4a6e : 0x450a0a,
      emissiveIntensity: 0.35,
    });
    headstockMat = bodyMat;
    bodyMesh = new THREE.Mesh(makeExtrudedBody(shape, 0.1, 0.018), bodyMat);
    group.add(bodyMesh);

    if (isLightning) {
      const boltMat = new THREE.MeshStandardMaterial({
        color: useCustomSkin ? skin.accentHex : 0xfacc15,
        emissive: useCustomSkin ? skin.accentHex : 0xfacc15,
        emissiveIntensity: 1.5,
        roughness: 0.18,
      });
      const boltShape = new THREE.Shape();
      boltShape.moveTo(-0.22, 0.02);
      boltShape.lineTo(0.06, 0.16);
      boltShape.lineTo(0.0, 0.02);
      boltShape.lineTo(0.28, 0.12);
      boltShape.lineTo(0.02, -0.14);
      boltShape.lineTo(0.08, -0.01);
      boltShape.closePath();
      const boltMesh = new THREE.Mesh(makeExtrudedBody(boltShape, 0.024, 0.005), boltMat);
      boltMesh.position.set(0.06, 0, 0.075);
      group.add(boltMesh);
    } else {
      const guardMat = new THREE.MeshStandardMaterial({
        color: useCustomSkin ? skin.secondaryHex : 0xf8fafc,
        roughness: 0.3,
        metalness: useCustomSkin ? 0.35 : 0.1,
      });
      const guardShape = new THREE.Shape();
      guardShape.moveTo(-0.34, 0);
      guardShape.lineTo(0.18, 0.22);
      guardShape.lineTo(0.18, -0.22);
      guardShape.closePath();
      const guard = new THREE.Mesh(makeExtrudedBody(guardShape, 0.02, 0.005), guardMat);
      guard.position.set(0.02, 0, 0.072);
      group.add(guard);
    }
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

    const bodyMat = makeSkinBodyMat({
      color: 0xec4899,
      roughness: 0.18,
      metalness: 0.55,
      emissive: 0xdb2777,
      emissiveIntensity: 0.42,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: useCustomSkin ? skin.accentHex : 0x22d3ee,
      emissive: useCustomSkin ? skin.accentHex : 0x22d3ee,
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

    const bodyMat = makeSkinBodyMat({
      color: 0xf1f5f9,
      roughness: 0.24,
      metalness: 0.28,
      emissive: 0x0c4a6e,
      emissiveIntensity: 0.16,
    });
    const stripeMat = new THREE.MeshStandardMaterial({
      color: useCustomSkin ? skin.accentHex : 0x0ea5e9,
      emissive: useCustomSkin ? skin.accentHex : 0x0ea5e9,
      emissiveIntensity: 0.78,
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
  } else if (modelId === 'double-neck-12' || modelId === 'double-neck-sg') {
    // Legendary Double-Neck 12-String OR Pointed Double-Neck SG Twin Guitar!
    const isSg = modelId === 'double-neck-sg';
    const shape = new THREE.Shape();
    if (isSg) {
      shape.moveTo(-0.38, 0.38);
      shape.lineTo(0.02, 0.48);
      shape.lineTo(0.46, 0.4);
      shape.lineTo(0.48, 0);
      shape.lineTo(0.46, -0.4);
      shape.lineTo(0.02, -0.48);
      shape.lineTo(-0.38, -0.38);
      shape.lineTo(-0.32, 0);
      shape.closePath();
    } else {
      shape.moveTo(-0.38, 0.34);
      shape.quadraticCurveTo(-0.1, 0.44, 0.36, 0.38);
      shape.quadraticCurveTo(0.52, 0.22, 0.5, 0);
      shape.quadraticCurveTo(0.52, -0.22, 0.36, -0.38);
      shape.quadraticCurveTo(-0.1, -0.44, -0.38, -0.34);
      shape.quadraticCurveTo(-0.44, 0, -0.38, 0.34);
      shape.closePath();
    }

    const bodyMat = makeSkinBodyMat({
      color: isSg ? 0x7f1d1d : 0x991b1b,
      roughness: 0.18,
      metalness: 0.36,
      emissive: 0x450a0a,
      emissiveIntensity: 0.26,
    });
    headstockMat = new THREE.MeshStandardMaterial({
      color: useCustomSkin ? skin.darkHex : 0x18181b,
      roughness: 0.28,
      metalness: 0.32,
    });
    bodyMesh = new THREE.Mesh(makeExtrudedBody(shape, 0.11, 0.022), bodyMat);
    group.add(bodyMesh);

    const guardMat = new THREE.MeshStandardMaterial({
      color: useCustomSkin ? skin.secondaryHex : isSg ? 0x18181b : 0xf8fafc,
      roughness: 0.32,
    });
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.54, 0.018), guardMat);
    guard.position.set(0.02, 0, 0.072);
    group.add(guard);
    neckOffsetX = -0.36;

    // Dual necks: Upper 12-String Neck + Lower 6-String Neck with 4 pickups & twin bridges!
    const pickupMat = isSg ? new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.22, metalness: 0.88 }) : chromeMat;
    const neckLen = 0.96;
    [0.18, -0.18].forEach((ny, idx) => {
      const puA = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.17, 0.04), pickupMat);
      puA.position.set(0.08, ny, 0.078);
      const puB = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.17, 0.04), pickupMat);
      puB.position.set(-0.1, ny, 0.078);
      const br = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.18, 0.04), pickupMat);
      br.position.set(0.24, ny, 0.078);
      group.add(puA, puB, br);

      const nMesh = new THREE.Mesh(new THREE.BoxGeometry(neckLen, idx === 0 ? 0.135 : 0.115, 0.064), neckMat);
      nMesh.position.set(neckOffsetX - neckLen * 0.5, ny, -0.01);
      const fb = new THREE.Mesh(new THREE.BoxGeometry(neckLen, idx === 0 ? 0.125 : 0.105, 0.02), fretboardMat);
      fb.position.set(neckOffsetX - neckLen * 0.5, ny, 0.032);
      const hd = new THREE.Mesh(new THREE.BoxGeometry(idx === 0 ? 0.34 : 0.26, 0.16, 0.07), headstockMat);
      hd.position.set(neckOffsetX - neckLen - 0.13, ny, -0.01);
      group.add(nMesh, fb, hd);

      for (let f = 0; f < 4; f += 1) {
        const inl = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.048, 0.008), inlayMat);
        inl.position.set(neckOffsetX - 0.18 - f * 0.2, ny, 0.045);
        group.add(inl);
      }
    });

    return {
      group,
      dispose() {
        disposeGroupResources(group, textures);
      },
    };
  } else if (modelId === 'warlock-metal') {
    const shape = new THREE.Shape();
    shape.moveTo(-0.36, 0.18);
    shape.lineTo(0.08, 0.44);
    shape.lineTo(0.48, 0.48);
    shape.lineTo(0.28, 0.12);
    shape.lineTo(0.56, 0.0);
    shape.lineTo(0.28, -0.12);
    shape.lineTo(0.48, -0.48);
    shape.lineTo(0.08, -0.44);
    shape.lineTo(-0.36, -0.18);
    shape.closePath();

    const bodyMat = makeSkinBodyMat({
      color: 0x09090b,
      roughness: 0.22,
      metalness: 0.65,
      emissive: 0x450a0a,
      emissiveIntensity: 0.35,
    });
    const bevelTrimMat = new THREE.MeshStandardMaterial({
      color: useCustomSkin ? skin.accentHex : 0xef4444,
      emissive: useCustomSkin ? skin.accentHex : 0xef4444,
      emissiveIntensity: 0.9,
      roughness: 0.24,
    });
    headstockMat = bodyMat;
    bodyMesh = new THREE.Mesh(makeExtrudedBody(shape, 0.1, 0.02), bodyMat);
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.055, 0.145), bevelTrimMat);
    spine.position.set(0.08, 0, 0);
    group.add(bodyMesh, spine);
    neckOffsetX = -0.34;
  } else if (modelId === 'hollowbody-archtop') {
    const shape = new THREE.Shape();
    shape.moveTo(-0.38, 0.1);
    shape.quadraticCurveTo(-0.22, 0.36, 0.02, 0.26);
    shape.quadraticCurveTo(0.36, 0.42, 0.48, 0.12);
    shape.quadraticCurveTo(0.52, -0.16, 0.3, -0.38);
    shape.quadraticCurveTo(-0.02, -0.42, -0.24, -0.26);
    shape.quadraticCurveTo(-0.38, -0.3, -0.4, -0.12);
    shape.closePath();

    const bodyMat = makeSkinBodyMat({
      color: 0xb45309,
      roughness: 0.18,
      metalness: 0.28,
      emissive: 0x451a03,
      emissiveIntensity: 0.22,
    });
    const fHoleMat = new THREE.MeshStandardMaterial({ color: 0x090705, roughness: 0.9 });
    const guardMat = new THREE.MeshStandardMaterial({
      color: useCustomSkin ? skin.secondaryHex : 0xfef3c7,
      roughness: 0.28,
    });
    headstockMat = bodyMat;
    bodyMesh = new THREE.Mesh(makeExtrudedBody(shape, 0.14, 0.024), bodyMat);
    const fHoleTop = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.032, 0.015), fHoleMat);
    fHoleTop.position.set(0.08, 0.19, 0.09);
    fHoleTop.rotation.z = 0.22;
    const fHoleBot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.032, 0.015), fHoleMat);
    fHoleBot.position.set(0.08, -0.19, 0.09);
    fHoleBot.rotation.z = -0.22;
    const tailpiece = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.03), chromeMat);
    tailpiece.position.set(0.36, 0, 0.09);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.11, 0.018), guardMat);
    guard.position.set(-0.05, -0.17, 0.095);
    group.add(bodyMesh, fHoleTop, fHoleBot, tailpiece, guard);
    neckOffsetX = -0.36;
  } else if (modelId === 'keytar-blade') {
    const shape = new THREE.Shape();
    shape.moveTo(-0.44, 0.14);
    shape.lineTo(0.46, 0.24);
    shape.lineTo(0.58, 0.02);
    shape.lineTo(0.42, -0.22);
    shape.lineTo(-0.42, -0.14);
    shape.closePath();

    const bodyMat = makeSkinBodyMat({
      color: 0x0f172a,
      roughness: 0.18,
      metalness: 0.62,
      emissive: 0x0e7490,
      emissiveIntensity: 0.38,
    });
    const neonMat = new THREE.MeshStandardMaterial({
      color: useCustomSkin ? skin.accentHex : 0x22d3ee,
      emissive: useCustomSkin ? skin.accentHex : 0x22d3ee,
      emissiveIntensity: 1.5,
      roughness: 0.2,
    });
    const keysBarMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.28 });
    headstockMat = bodyMat;
    bodyMesh = new THREE.Mesh(makeExtrudedBody(shape, 0.095, 0.02), bodyMat);
    const keyRow = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.14, 0.032), keysBarMat);
    keyRow.position.set(0.06, -0.05, 0.075);
    const edgeGlow = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.032, 0.14), neonMat);
    edgeGlow.position.set(0.04, 0.12, 0);
    group.add(bodyMesh, keyRow, edgeGlow);
    neckOffsetX = -0.38;
  } else {
    // Classic Sunburst Les Paul (single-cut rounded body with active PBR skin finish)
    const shape = new THREE.Shape();
    shape.moveTo(-0.36, 0.08);
    shape.quadraticCurveTo(-0.22, 0.28, 0.02, 0.24);
    shape.quadraticCurveTo(0.32, 0.36, 0.44, 0.12);
    shape.quadraticCurveTo(0.48, -0.16, 0.26, -0.32);
    shape.quadraticCurveTo(-0.02, -0.36, -0.22, -0.22);
    shape.quadraticCurveTo(-0.32, -0.3, -0.4, -0.12);
    shape.closePath();

    const skinTex = createInstrumentSkinTexture(skin.id);
    textures.push(skinTex);
    const bodyMat = new THREE.MeshStandardMaterial({
      map: skinTex,
      roughness: skin.roughness,
      metalness: skin.metalness,
      emissive: skin.emissiveHex,
      emissiveIntensity: skin.emissiveIntensity,
    });
    headstockMat = new THREE.MeshStandardMaterial({
      color: useCustomSkin ? skin.darkHex : 0x1c0a05,
      roughness: 0.3,
      metalness: 0.32,
    });
    bodyMesh = new THREE.Mesh(makeExtrudedBody(shape, 0.11, 0.024), bodyMat);
    group.add(bodyMesh);

    const guardMat = new THREE.MeshStandardMaterial({
      color: useCustomSkin ? skin.secondaryHex : 0xfef3c7,
      roughness: 0.34,
      metalness: 0.14,
    });
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.02), guardMat);
    guard.position.set(0.02, -0.16, 0.078);
    guard.rotation.z = 0.16;
    group.add(guard);
    neckOffsetX = -0.32;
  }

  // Dual Humbucker pickups + Tune-O-Matic bridge
  const pickupMat = modelId === 'les-paul-sunburst' || skin.id === 'royal-gold' ? chromeMat : darkMetal;
  const pickup1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.21, 0.04), pickupMat);
  pickup1.position.set(0.08, 0, 0.075);
  const pickup2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.21, 0.04), pickupMat);
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
export function buildCustomBassMesh(modelId = 'precision-blonde', skinId = 'classic-sunburst') {
  const group = new THREE.Group();
  const textures = [];
  const skin = getInstrumentSkinById(skinId);
  const useCustomSkin = skin.id !== 'classic-sunburst';

  const chromeMat = new THREE.MeshStandardMaterial({
    color: skin.hardwareColor,
    roughness: skin.id === 'midnight-stealth' ? 0.5 : 0.18,
    metalness: 0.9,
  });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.32, metalness: 0.85 });
  const mapleMat = new THREE.MeshStandardMaterial({
    color: skin.id === 'midnight-stealth' ? 0x18181b : 0xe7c58a,
    roughness: 0.45,
    metalness: 0.08,
  });
  const rosewoodMat = new THREE.MeshStandardMaterial({ color: 0x261712, roughness: 0.62, metalness: 0.05 });

  const makeSkinBassMat = (fallbackOpts) => {
    if (!useCustomSkin && fallbackOpts) {
      return new THREE.MeshStandardMaterial(fallbackOpts);
    }
    const skinTex = createInstrumentSkinTexture(skin.id);
    textures.push(skinTex);
    return new THREE.MeshStandardMaterial({
      map: skinTex,
      roughness: skin.roughness,
      metalness: skin.metalness,
      emissive: skin.emissiveHex,
      emissiveIntensity: skin.emissiveIntensity,
    });
  };

  let headstockMat = mapleMat;
  let neckOffsetX = -0.34;

  if (modelId === 'axe-bass') {
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(-0.36, 0.09);
    bladeShape.quadraticCurveTo(0.05, 0.56, 0.56, 0.36);
    bladeShape.quadraticCurveTo(0.42, 0, 0.56, -0.36);
    bladeShape.quadraticCurveTo(0.05, -0.56, -0.36, -0.09);
    bladeShape.closePath();

    const silverMat = new THREE.MeshStandardMaterial({
      color: useCustomSkin ? skin.hardwareColor : 0xdbeafe,
      roughness: 0.16,
      metalness: 0.92,
    });
    const coreMat = makeSkinBassMat({
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

    const bodyMat = makeSkinBassMat({
      color: 0x181826,
      roughness: 0.22,
      metalness: 0.52,
    });
    const neonMat = new THREE.MeshStandardMaterial({
      color: useCustomSkin ? skin.accentHex : 0xa855f7,
      emissive: useCustomSkin ? skin.accentHex : 0xa855f7,
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
  } else if (modelId === 'neon-acrylic-bass' || modelId === 'neon-acrylic-transparent') {
    const isClearCrystal = modelId === 'neon-acrylic-transparent';
    // Translucent crystal Neon Acrylic Bass with glowing internal LED edge strips!
    const shape = new THREE.Shape();
    shape.moveTo(-0.38, 0.08);
    shape.quadraticCurveTo(-0.32, 0.36, -0.02, 0.28);
    shape.quadraticCurveTo(0.34, 0.38, 0.48, 0.12);
    shape.quadraticCurveTo(0.52, -0.2, 0.24, -0.35);
    shape.quadraticCurveTo(-0.08, -0.34, -0.3, -0.2);
    shape.closePath();

    const acrylicMat = new THREE.MeshPhysicalMaterial({
      color: isClearCrystal ? 0xe0f2fe : useCustomSkin ? skin.accentHex : 0x22d3ee,
      emissive: isClearCrystal ? 0x0284c7 : useCustomSkin ? skin.emissiveHex : 0x0891b2,
      emissiveIntensity: isClearCrystal ? 0.24 : 0.48,
      roughness: 0.05,
      metalness: 0.08,
      transmission: isClearCrystal ? 0.82 : 0.58,
      transparent: true,
      opacity: isClearCrystal ? 0.48 : 0.78,
    });
    const innerLedMat = new THREE.MeshStandardMaterial({
      color: isClearCrystal ? 0x22d3ee : useCustomSkin ? skin.secondaryHex : 0xec4899,
      emissive: isClearCrystal ? 0x22d3ee : useCustomSkin ? skin.secondaryHex : 0xec4899,
      emissiveIntensity: 1.85,
      roughness: 0.18,
    });
    headstockMat = acrylicMat;
    const body = new THREE.Mesh(makeExtrudedBody(shape, 0.11, 0.024), acrylicMat);
    const coreRing = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.018, 8, 20), innerLedMat);
    coreRing.position.set(0.06, 0, 0.01);
    group.add(body, coreRing);
    if (isClearCrystal) {
      const spineLed = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.032, 0.04), innerLedMat);
      spineLed.position.set(0.06, 0, 0);
      group.add(spineLed);
    }
    neckOffsetX = -0.34;
  } else if (modelId === 'slap-5string') {
    const shape = new THREE.Shape();
    shape.moveTo(-0.4, 0.1);
    shape.quadraticCurveTo(-0.28, 0.38, 0.0, 0.26);
    shape.quadraticCurveTo(0.36, 0.4, 0.5, 0.12);
    shape.quadraticCurveTo(0.52, -0.18, 0.24, -0.34);
    shape.quadraticCurveTo(-0.08, -0.34, -0.32, -0.18);
    shape.closePath();

    const bodyMat = makeSkinBassMat({
      color: 0xd97706,
      roughness: 0.22,
      metalness: 0.26,
      emissive: 0x451a03,
      emissiveIntensity: 0.16,
    });
    const rampMat = new THREE.MeshStandardMaterial({
      color: useCustomSkin ? skin.secondaryHex : 0xfef3c7,
      roughness: 0.34,
    });
    headstockMat = bodyMat;
    const body = new THREE.Mesh(makeExtrudedBody(shape, 0.115, 0.022), bodyMat);
    const slapRamp = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.032), rampMat);
    slapRamp.position.set(-0.04, 0, 0.075);
    group.add(body, slapRamp);
    neckOffsetX = -0.36;
  } else {
    const shape = new THREE.Shape();
    shape.moveTo(-0.38, 0.06);
    shape.quadraticCurveTo(-0.34, 0.34, -0.06, 0.24);
    shape.quadraticCurveTo(0.28, 0.38, 0.46, 0.14);
    shape.quadraticCurveTo(0.52, -0.18, 0.22, -0.34);
    shape.quadraticCurveTo(-0.1, -0.36, -0.32, -0.18);
    shape.closePath();

    const bodyMat = makeSkinBassMat({
      color: 0xeab308,
      roughness: 0.24,
      metalness: 0.18,
    });
    const guardMat = new THREE.MeshStandardMaterial({
      color: useCustomSkin ? skin.darkHex : 0x6b1d14,
      roughness: 0.36,
      metalness: 0.16,
    });
    headstockMat = useCustomSkin ? bodyMat : mapleMat;

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
    modelId === 'precision-blonde' && !useCustomSkin ? mapleMat : rosewoodMat
  );
  board.position.set(neckOffsetX - neckLen * 0.5, 0.01, 0.032);
  group.add(neck, board);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.21, 0.075), headstockMat);
  head.position.set(neckOffsetX - neckLen - 0.14, 0.04, -0.01);
  group.add(head);

  const pegCount = modelId === 'neon-5string' || modelId === 'slap-5string' ? 5 : 4;
  for (let p = 0; p < pegCount; p += 1) {
    const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.08, 6), chromeMat);
    peg.position.set(neckOffsetX - neckLen - 0.02 - p * 0.065, 0.16, -0.01);
    group.add(peg);
  }

  return {
    group,
    dispose() {
      disposeGroupResources(group, textures);
    },
  };
}

/**
 * Builds one of 3 distinct composite 3D Drum Kits with active PBR skin finish & kick-drum head decal.
 */
export function buildCustomDrumKitMesh(
  modelId = 'pop-single-kick',
  { forceDoubleKick = false, skinId = 'classic-sunburst' } = {}
) {
  const effectiveModel = forceDoubleKick && modelId === 'pop-single-kick' ? 'metal-double-bass' : modelId;
  const group = new THREE.Group();
  const textures = [];
  const skin = getInstrumentSkinById(skinId);
  const useCustomSkin = skin.id !== 'classic-sunburst';

  const isTriple = effectiveModel === 'triple-kick-fortress';
  const isDouble = effectiveModel === 'metal-double-bass';
  const isAcrylic = effectiveModel === 'acrylic-led';
  const isCocktail = effectiveModel === 'vintage-jazz-cocktail';
  const isSteampunk = effectiveModel === 'steampunk-brass';

  let shellMat;
  if (useCustomSkin) {
    const skinTex = createInstrumentSkinTexture(skin.id);
    textures.push(skinTex);
    shellMat = new THREE.MeshStandardMaterial({
      map: skinTex,
      roughness: isAcrylic ? 0.14 : skin.roughness,
      metalness: isAcrylic ? 0.35 : skin.metalness,
      emissive: skin.emissiveHex,
      emissiveIntensity: isAcrylic ? Math.max(0.55, skin.emissiveIntensity) : skin.emissiveIntensity,
      transparent: isAcrylic,
      opacity: isAcrylic ? 0.78 : 1.0,
    });
  } else {
    shellMat = isAcrylic
      ? new THREE.MeshStandardMaterial({
          color: 0x22d3ee,
          emissive: 0x06b6d4,
          emissiveIntensity: 0.65,
          roughness: 0.12,
          metalness: 0.2,
          transparent: true,
          opacity: 0.68,
        })
      : isTriple
        ? new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.18, metalness: 0.75 })
        : isDouble
          ? new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.22, metalness: 0.62 })
          : isCocktail
            ? new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.22, metalness: 0.16 })
            : isSteampunk
              ? new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.26, metalness: 0.78 })
              : new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.26, metalness: 0.42 });
  }

  const ringColor = useCustomSkin
    ? skin.accentHex
    : isAcrylic
      ? 0xa855f7
      : isTriple
        ? 0xfacc15
        : isDouble
          ? 0xef4444
          : isSteampunk
            ? 0xf59e0b
            : isCocktail
              ? 0xb45309
              : 0xf59e0b;

  const ledRingMat = new THREE.MeshStandardMaterial({
    color: ringColor,
    emissive: ringColor,
    emissiveIntensity: isAcrylic || isTriple ? 1.85 : 0.95,
    roughness: 0.2,
  });

  const rimMat = new THREE.MeshStandardMaterial({
    color: isSteampunk && !useCustomSkin ? 0xd97706 : isTriple && !useCustomSkin ? 0xfef08a : skin.hardwareColor,
    roughness: skin.id === 'midnight-stealth' ? 0.5 : 0.2,
    metalness: 0.9,
  });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.62, metalness: 0.05 });
  const brassMat = new THREE.MeshStandardMaterial({
    color: skin.id === 'frostbite-ice' ? 0xbae6fd : skin.id === 'sakura-pearl' ? 0xfda4af : 0xfbbf24,
    roughness: 0.22,
    metalness: 0.88,
  });

  const drumheadTex = createDrumheadCanvasTexture(
    useCustomSkin ? skin.accentHex : isAcrylic ? '#22d3ee' : isTriple ? '#facc15' : isDouble ? '#ef4444' : isSteampunk ? '#fbbf24' : '#f59e0b',
    useCustomSkin ? skin.drumSubLabel : isTriple ? 'FORTRESS' : isDouble ? 'METAL' : isAcrylic ? 'LED' : isSteampunk ? 'STEAM' : isCocktail ? 'JAZZ' : 'LIVE',
    useCustomSkin ? skin.darkHex : '#0f1320'
  );
  textures.push(drumheadTex);
  const frontKickMat = new THREE.MeshStandardMaterial({ map: drumheadTex, roughness: 0.48, metalness: 0.14 });

  // Kick drum(s) — Triple-Kick Fortress builds 3 thunderous bass drums; Double-Bass builds 2; Cocktail builds stand-up barrel
  const kicks = [];
  if (isCocktail) {
    const vKick = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 1.08, 20), [shellMat, headMat, frontKickMat]);
    vKick.position.set(0, 0.62, 0.45);
    group.add(vKick);
    kicks.push(vKick);
  } else {
    const kickSpecs = isTriple
      ? [
          { x: -0.92, r: 0.52, y: 0.54, z: 0.48 },
          { x: 0, r: 0.68, y: 0.68, z: 0.62 },
          { x: 0.92, r: 0.52, y: 0.54, z: 0.48 },
        ]
      : isDouble
        ? [
            { x: -0.56, r: 0.6, y: 0.6, z: 0.56 },
            { x: 0.56, r: 0.6, y: 0.6, z: 0.56 },
          ]
        : [{ x: 0, r: 0.68, y: 0.68, z: 0.56 }];

    kickSpecs.forEach((ks) => {
      const kickGeo = new THREE.CylinderGeometry(ks.r, ks.r, 0.62, 20);
      const kick = new THREE.Mesh(kickGeo, [shellMat, frontKickMat, headMat]);
      kick.rotation.x = Math.PI * 0.5;
      kick.position.set(ks.x, ks.y, ks.z);
      group.add(kick);
      kicks.push(kick);

      if (isAcrylic || isDouble || isSteampunk || isTriple) {
        const hoop = new THREE.Mesh(new THREE.TorusGeometry(ks.r, 0.032, 8, 24), isSteampunk ? brassMat : ledRingMat);
        hoop.position.set(ks.x, ks.y, ks.z + 0.31);
        group.add(hoop);
      }
      if (isSteampunk) {
        const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.08, 12), brassMat);
        gauge.rotation.x = Math.PI * 0.5;
        gauge.position.set(ks.x + 0.52, 1.05, 0.68);
        const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 0.72, 10), brassMat);
        exhaust.position.set(ks.x - 0.66, 0.92, 0.46);
        exhaust.rotation.z = 0.22;
        group.add(gauge, exhaust);
      }
    });
  }

  // Curved drum rack cage for Double-Bass Monster & Triple-Kick Fortress kits
  if (isDouble || isTriple) {
    const rackRadius = isTriple ? 1.48 : 1.18;
    const rackBar = new THREE.Mesh(new THREE.TorusGeometry(rackRadius, 0.044, 8, 24, Math.PI * 0.94), rimMat);
    rackBar.rotation.x = Math.PI * 0.5;
    rackBar.position.set(0, 1.24, 0.08);
    group.add(rackBar);

    [-rackRadius + 0.06, rackRadius - 0.06].forEach((px) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 1.28, 8), rimMat);
      leg.position.set(px, 0.64, 0.18);
      group.add(leg);
    });
    if (isTriple) {
      const upperHaloBar = new THREE.Mesh(new THREE.TorusGeometry(1.36, 0.032, 8, 24, Math.PI * 0.86), ledRingMat);
      upperHaloBar.rotation.x = Math.PI * 0.5;
      upperHaloBar.position.set(0, 1.72, 0.18);
      group.add(upperHaloBar);
    }
  }

  // Snare
  const snare = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 16), [shellMat, headMat, rimMat]);
  snare.position.set(-0.66, isCocktail ? 1.02 : 0.84, 0.34);
  const snareStand = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, isCocktail ? 0.96 : 0.78, 8), rimMat);
  snareStand.position.set(-0.66, isCocktail ? 0.48 : 0.4, 0.34);
  group.add(snare, snareStand);

  // Rack Toms (4 on Triple-Kick Fortress, 3 on Double-Bass, 1 on Cocktail, 2 on others)
  const toms = [];
  const tomXs = isTriple ? [-0.64, -0.22, 0.22, 0.64] : isDouble ? [-0.46, 0, 0.46] : isCocktail ? [0.58] : [-0.3, 0.3];
  tomXs.forEach((tx, idx) => {
    const r = isTriple ? 0.18 + idx * 0.022 : isDouble ? 0.21 + idx * 0.02 : isCocktail ? 0.22 : 0.24;
    const tom = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.26, 14), [shellMat, headMat, rimMat]);
    tom.position.set(tx, isCocktail ? 1.16 : 1.4 + ((isDouble || isTriple) && idx === 1 ? 0.06 : 0), 0.52);
    tom.rotation.x = 0.28;
    group.add(tom);
    toms.push(tom);
  });

  // Floor Tom(s)
  const floorTom = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.58, 16), [shellMat, headMat, rimMat]);
  floorTom.position.set(isTriple ? 1.18 : 0.84, 0.62, 0.2);
  group.add(floorTom);

  if (isDouble || isTriple) {
    const floorTom2 = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.58, 16), [shellMat, headMat, rimMat]);
    floorTom2.position.set(isTriple ? -1.18 : 1.24, 0.58, isTriple ? -0.08 : -0.14);
    group.add(floorTom2);
  }

  // Cymbals (Hi-hat, Left Crash, Right Crash/Ride + optional Metal China & Fortress Splash Cymbals)
  const cymbals = [];
  const cymbalSpecs = [
    { x: -1.06, y: 1.48, z: 0.16, r: 0.34 }, // 0: Hi-hat
    { x: -0.82, y: 1.9, z: 0.62, r: 0.42 }, // 1: Left Crash
    { x: 0.96, y: 1.84, z: 0.56, r: 0.46 }, // 2: Right Crash/Ride
  ];
  if (isDouble || isSteampunk || isTriple) {
    cymbalSpecs.push({ x: 1.34, y: 1.96, z: 0.18, r: 0.44 }); // 3: Extra China Cymbal
  }
  if (isTriple) {
    cymbalSpecs.push({ x: -1.34, y: 2.04, z: 0.24, r: 0.4 }); // 4: Opposite Stadium China
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
    kick: kicks[isTriple ? 1 : 0] || kicks[0],
    kicks,
    ledRingMat,
    dispose() {
      disposeGroupResources(group, textures);
    },
  };
}

/**
 * Generates a crisp procedural piano keybed CanvasTexture (88-key ivory + ebony pattern).
 */
function createPianoKeysTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 512, 96);

  const whiteKeys = 28;
  const kw = 512 / whiteKeys;
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < whiteKeys; i += 1) {
    ctx.strokeRect(i * kw, 0, kw, 96);
  }

  // Ebony black keys in authentic 2-3 octave groupings
  ctx.fillStyle = '#0f172a';
  for (let i = 0; i < whiteKeys - 1; i += 1) {
    const pos = i % 7;
    if (pos === 2 || pos === 6) continue;
    ctx.fillRect((i + 1) * kw - kw * 0.34, 0, kw * 0.68, 56);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Builds one of 3 distinct composite 3D Keyboard / Piano stage rigs:
 *  - concert-grand: glossy concert grand piano with curved case, open lid, brass pedals & keys
 *  - neon-double-synth: dual stacked neon arena synths on chrome X-stand
 *  - retro-keytar: slung synth-rock keytar (returns isKeytar: true so StageBand attaches to character torso)
 */
export function buildCustomKeyboardMesh(modelId = 'concert-grand', skinId = 'classic-sunburst') {
  const group = new THREE.Group();
  const textures = [];
  const skin = getInstrumentSkinById(skinId);
  const useCustomSkin = skin.id !== 'classic-sunburst';

  const keysTex = createPianoKeysTexture();
  textures.push(keysTex);

  const keysMat = new THREE.MeshStandardMaterial({ map: keysTex, roughness: 0.25, metalness: 0.08 });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: skin.hardwareColor,
    roughness: skin.id === 'midnight-stealth' ? 0.5 : 0.2,
    metalness: 0.9,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: useCustomSkin ? skin.accentHex : 0xfacc15,
    roughness: 0.24,
    metalness: 0.88,
  });
  let ledMat = null;

  const makeSkinCaseMat = (fallbackOpts) => {
    if (!useCustomSkin && fallbackOpts) {
      return new THREE.MeshStandardMaterial(fallbackOpts);
    }
    const skinTex = createInstrumentSkinTexture(skin.id);
    textures.push(skinTex);
    return new THREE.MeshStandardMaterial({
      map: skinTex,
      roughness: skin.roughness,
      metalness: skin.metalness,
      emissive: skin.emissiveHex,
      emissiveIntensity: skin.emissiveIntensity * 0.85,
    });
  };

  if (modelId === 'retro-keytar' || modelId === 'cyberpunk-808-keytar') {
    const isCyber808 = modelId === 'cyberpunk-808-keytar';
    const bodyShape = new THREE.Shape();
    bodyShape.moveTo(-0.55, 0.12);
    bodyShape.lineTo(0.45, isCyber808 ? 0.25 : 0.22);
    bodyShape.lineTo(0.64, 0.02);
    bodyShape.lineTo(0.48, -0.22);
    bodyShape.lineTo(-0.52, -0.14);
    bodyShape.closePath();

    const bodyMat = makeSkinCaseMat(
      isCyber808
        ? {
            color: 0x0f172a,
            roughness: 0.16,
            metalness: 0.72,
            emissive: 0x083344,
            emissiveIntensity: 0.42,
          }
        : {
            color: 0xe11d48,
            roughness: 0.2,
            metalness: 0.45,
            emissive: 0x881337,
            emissiveIntensity: 0.32,
          }
    );
    ledMat = new THREE.MeshStandardMaterial({
      color: useCustomSkin ? skin.accentHex : 0x22d3ee,
      emissive: useCustomSkin ? skin.accentHex : 0x22d3ee,
      emissiveIntensity: 1.65,
      roughness: 0.2,
    });

    const body = new THREE.Mesh(makeExtrudedBody(bodyShape, 0.09, 0.018), bodyMat);
    const keybed = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.16, 0.03), keysMat);
    keybed.position.set(0.06, -0.04, 0.068);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.12, 0.065), bodyMat);
    neck.position.set(-0.78, 0.05, 0);
    const pitchStrip = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.032, 0.08), ledMat);
    pitchStrip.position.set(-0.78, 0.09, 0.01);
    const accentStripe = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.03, 0.13), isCyber808 ? ledMat : brassMat);
    accentStripe.position.set(0.05, 0.11, 0);
    group.add(body, keybed, neck, pitchStrip, accentStripe);

    if (isCyber808) {
      const padMat = new THREE.MeshStandardMaterial({
        color: 0xec4899,
        emissive: 0xec4899,
        emissiveIntensity: 1.4,
        roughness: 0.2,
      });
      for (let p = 0; p < 4; p += 1) {
        const pad = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.065, 0.025), p % 2 === 0 ? padMat : ledMat);
        pad.position.set(-0.24 + p * 0.12, 0.075, 0.068);
        group.add(pad);
      }
    }

    return {
      group,
      isKeytar: true,
      ledMat,
      dispose() {
        disposeGroupResources(group, textures);
      },
    };
  }

  if (modelId === 'neon-double-synth') {
    const chassisMat = makeSkinCaseMat({ color: 0x111827, roughness: 0.26, metalness: 0.65 });
    const upperMat = useCustomSkin
      ? chassisMat
      : new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.24, metalness: 0.55 });
    const pinkLed = new THREE.MeshStandardMaterial({
      color: useCustomSkin ? skin.accentHex : 0xec4899,
      emissive: useCustomSkin ? skin.accentHex : 0xec4899,
      emissiveIntensity: 1.7,
      roughness: 0.2,
    });
    const cyanLed = new THREE.MeshStandardMaterial({
      color: useCustomSkin ? skin.secondaryHex : 0x22d3ee,
      emissive: useCustomSkin ? skin.secondaryHex : 0x22d3ee,
      emissiveIntensity: 1.55,
      roughness: 0.2,
    });
    ledMat = pinkLed;

    // Chrome heavy-duty X-stand
    [-0.58, 0.58].forEach((sx) => {
      const barA = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.32, 0.06), chromeMat);
      barA.position.set(sx, 0.54, 0);
      barA.rotation.x = 0.55;
      const barB = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.32, 0.06), chromeMat);
      barB.position.set(sx, 0.54, 0);
      barB.rotation.x = -0.55;
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.85), chromeMat);
      foot.position.set(sx, 0.025, 0);
      group.add(barA, barB, foot);
    });
    const crossBar = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 1.24, 8), chromeMat);
    crossBar.rotation.z = Math.PI * 0.5;
    crossBar.position.set(0, 0.54, 0);
    group.add(crossBar);

    // Lower 88-key workstation synth
    const lowerDeck = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.14, 0.52), chassisMat);
    lowerDeck.position.set(0, 1.06, 0);
    const lowerKeys = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.04, 0.24), keysMat);
    lowerKeys.position.set(0, 1.14, -0.1);
    const lowerFrontLed = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.045, 0.04), pinkLed);
    lowerFrontLed.position.set(0, 1.06, 0.265);
    group.add(lowerDeck, lowerKeys, lowerFrontLed);

    // Upper angled lead synthesizer tier
    [-0.55, 0.55].forEach((ux) => {
      const riser = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.36, 0.05), chromeMat);
      riser.position.set(ux, 1.26, 0.16);
      group.add(riser);
    });
    const upperGroup = new THREE.Group();
    upperGroup.position.set(0, 1.44, 0.16);
    upperGroup.rotation.x = -0.26;
    const upperDeck = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.11, 0.42), upperMat);
    const upperKeys = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.035, 0.2), keysMat);
    upperKeys.position.set(0, 0.065, -0.08);
    const upperFrontLed = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.04, 0.04), cyanLed);
    upperFrontLed.position.set(0, 0, 0.215);
    upperGroup.add(upperDeck, upperKeys, upperFrontLed);
    group.add(upperGroup);

    return {
      group,
      isKeytar: false,
      ledMat,
      dispose() {
        disposeGroupResources(group, textures);
      },
    };
  }

  if (modelId === 'vintage-upright') {
    const woodMat = makeSkinCaseMat({
      color: 0x78350f,
      roughness: 0.34,
      metalness: 0.16,
      emissive: 0x271003,
      emissiveIntensity: 0.14,
    });
    const darkBackingMat = new THREE.MeshStandardMaterial({ color: 0x180904, roughness: 0.78 });
    ledMat = new THREE.MeshStandardMaterial({
      color: useCustomSkin ? skin.accentHex : 0xfbbf24,
      emissive: useCustomSkin ? skin.accentHex : 0xf59e0b,
      emissiveIntensity: 1.05,
      roughness: 0.25,
    });

    // Tall mahogany upright cabinet
    const cabinetLower = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.98, 0.52), woodMat);
    cabinetLower.position.set(0, 0.49, 0.08);
    const cabinetUpper = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.92, 0.38), woodMat);
    cabinetUpper.position.set(0, 1.44, 0.15);
    const crownCap = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.08, 0.46), woodMat);
    crownCap.position.set(0, 1.92, 0.15);

    // Exposed glowing harp string window on upper front panel
    const windowBack = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.56, 0.04), darkBackingMat);
    windowBack.position.set(0, 1.48, 0.34);
    for (let s = 0; s < 12; s += 1) {
      const str = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.52, 4), brassMat);
      str.position.set(-0.56 + s * 0.102, 1.48, 0.35);
      group.add(str);
    }

    // Twin warm brass sconces + keybed + pedals + upright bench
    [-0.78, 0.78].forEach((sx) => {
      const sconce = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), ledMat);
      sconce.position.set(sx, 1.62, 0.38);
      group.add(sconce);
    });
    const keybed = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.42), woodMat);
    keybed.position.set(0, 0.98, -0.22);
    const keysMesh = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.045, 0.24), keysMat);
    keysMesh.position.set(0, 1.06, -0.28);
    [-0.09, 0, 0.09].forEach((px) => {
      const pedal = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.025, 0.14), brassMat);
      pedal.position.set(px, 0.06, -0.16);
      group.add(pedal);
    });

    const benchTop = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.09, 0.36), woodMat);
    benchTop.position.set(0, 0.62, -0.92);
    group.add(cabinetLower, cabinetUpper, crownCap, windowBack, keybed, keysMesh, benchTop);
    [
      [-0.36, -0.78],
      [0.36, -0.78],
      [-0.36, -1.06],
      [0.36, -1.06],
    ].forEach(([bx, bz]) => {
      const bLeg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.05), woodMat);
      bLeg.position.set(bx, 0.3, bz);
      group.add(bLeg);
    });

    return {
      group,
      isKeytar: false,
      ledMat,
      dispose() {
        disposeGroupResources(group, textures);
      },
    };
  }

  // Concert Grand OR White Crystal Grand Piano with animated lidGroup & propStick
  const isCrystal = modelId === 'white-crystal-grand';
  const ebonyMat = makeSkinCaseMat(
    isCrystal
      ? {
          color: 0xf8fafc,
          roughness: 0.08,
          metalness: 0.25,
          emissive: 0x0c4a6e,
          emissiveIntensity: 0.18,
          transparent: true,
          opacity: 0.9,
        }
      : {
          color: 0x0b0d13,
          roughness: 0.12,
          metalness: 0.35,
        }
  );
  const soundboardMat = new THREE.MeshStandardMaterial({
    color: useCustomSkin ? skin.accentHex : isCrystal ? 0x38bdf8 : 0xb45309,
    emissive: isCrystal && !useCustomSkin ? 0x0284c7 : 0x000000,
    emissiveIntensity: isCrystal ? 0.35 : 0,
    roughness: 0.32,
    metalness: 0.68,
  });
  ledMat = new THREE.MeshStandardMaterial({
    color: useCustomSkin ? skin.accentHex : isCrystal ? 0x38bdf8 : 0xfacc15,
    emissive: useCustomSkin ? skin.accentHex : isCrystal ? 0x38bdf8 : 0xfacc15,
    emissiveIntensity: isCrystal ? 1.35 : 0.95,
    roughness: 0.2,
  });

  // Curved Concert Grand body (oriented so keyboard faces -Z toward player, tail extends +Z toward crowd)
  const grandShape = new THREE.Shape();
  grandShape.moveTo(-0.88, -0.24);
  grandShape.lineTo(0.88, -0.24);
  grandShape.lineTo(0.88, 0.42);
  grandShape.bezierCurveTo(0.86, 1.15, 0.28, 1.25, 0.05, 1.72);
  grandShape.bezierCurveTo(-0.18, 2.02, -0.82, 1.92, -0.88, 1.38);
  grandShape.closePath();

  const bodyGeo = new THREE.ExtrudeGeometry(grandShape, {
    depth: 0.32,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
    curveSegments: 14,
  });
  bodyGeo.rotateX(Math.PI * 0.5);
  const body = new THREE.Mesh(bodyGeo, ebonyMat);
  body.position.set(0, 1.28, 0.1);
  group.add(body);

  // Golden / Crystal harp soundboard + individual metallic harp strings inside Concert Grand!
  const harp = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.04, 1.1), soundboardMat);
  harp.position.set(-0.08, 1.27, 0.72);
  group.add(harp);

  const harpStringGeo = new THREE.CylinderGeometry(0.008, 0.008, 1.04, 4);
  for (let s = 0; s < 10; s += 1) {
    const str = new THREE.Mesh(harpStringGeo, isCrystal ? chromeMat : brassMat);
    str.rotation.x = Math.PI * 0.5;
    str.rotation.z = -0.16;
    str.position.set(-0.62 + s * 0.125, 1.305, 0.72 + (s < 5 ? 0.06 : -0.08));
    group.add(str);
  }

  // Hinged Concert Grand lid + custom skin decal artwork + brass prop stick
  const lidGeo = new THREE.ExtrudeGeometry(grandShape, {
    depth: 0.045,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.01,
    bevelSegments: 1,
    curveSegments: 14,
  });
  lidGeo.rotateX(Math.PI * 0.5);
  lidGeo.translate(0.88, 0, 0);
  const lid = new THREE.Mesh(lidGeo, ebonyMat);
  lid.position.set(-0.88, 1.34, 0.1);
  lid.rotation.z = 0.54;

  // Decorative emblem / custom skin decal visible to the audience on the propped grand lid!
  const lidArtTex = createDrumheadCanvasTexture(
    useCustomSkin ? skin.accentHex : isCrystal ? '#38bdf8' : '#facc15',
    useCustomSkin ? skin.drumSubLabel : isCrystal ? 'CRYSTAL' : 'GRAND',
    useCustomSkin ? skin.darkHex : isCrystal ? '#0c4a6e' : '#0f1320'
  );
  textures.push(lidArtTex);
  const lidArtMat = new THREE.MeshStandardMaterial({
    map: lidArtTex,
    roughness: 0.24,
    metalness: 0.32,
  });
  const lidDecal = new THREE.Mesh(new THREE.CircleGeometry(0.46, 20), lidArtMat);
  lidDecal.rotation.x = -Math.PI * 0.5;
  lidDecal.position.set(0.88, 0.032, 0.76);
  lid.add(lidDecal);
  group.add(lid);

  const propStick = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.86, 8), isCrystal ? chromeMat : brassMat);
  propStick.position.set(0.56, 1.7, 0.48);
  propStick.rotation.z = -0.26;
  group.add(propStick);

  // Front keybed shelf + 88-key ivory/ebony keyboard facing player (-Z)
  const keybedBox = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.14, 0.42), ebonyMat);
  keybedBox.position.set(0, 1.0, -0.24);
  const keysMesh = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.045, 0.24), keysMat);
  keysMesh.position.set(0, 1.08, -0.3);
  const musicDesk = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.28, 0.03), ebonyMat);
  musicDesk.position.set(0, 1.32, -0.05);
  musicDesk.rotation.x = -0.25;
  const goldTrim = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.03, 0.03), ledMat);
  goldTrim.position.set(0, 1.14, 0.1);
  group.add(keybedBox, keysMesh, musicDesk, goldTrim);

  // 3 tapered grand piano legs + casters
  [
    [-0.72, -0.18],
    [0.72, -0.18],
    [-0.28, 1.56],
  ].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.045, 0.94, 10), ebonyMat);
    leg.position.set(lx, 0.49, lz);
    const caster = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 8), isCrystal ? chromeMat : brassMat);
    caster.position.set(lx, 0.03, lz);
    group.add(leg, caster);
  });

  // Brass pedal lyre
  const lyrePostL = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.84, 8), ebonyMat);
  lyrePostL.position.set(-0.14, 0.46, -0.02);
  const lyrePostR = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.84, 8), ebonyMat);
  lyrePostR.position.set(0.14, 0.46, -0.02);
  const pedalBox = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.14), ebonyMat);
  pedalBox.position.set(0, 0.09, -0.02);
  group.add(lyrePostL, lyrePostR, pedalBox);
  [-0.09, 0, 0.09].forEach((px) => {
    const pedal = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.02, 0.14), isCrystal ? chromeMat : brassMat);
    pedal.position.set(px, 0.09, -0.12);
    group.add(pedal);
  });

  // Piano bench behind the keyboard
  const benchTop = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.09, 0.36), ebonyMat);
  benchTop.position.set(0, 0.62, -0.92);
  group.add(benchTop);
  [
    [-0.36, -0.78],
    [0.36, -0.78],
    [-0.36, -1.06],
    [0.36, -1.06],
  ].forEach(([bx, bz]) => {
    const bLeg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.05), ebonyMat);
    bLeg.position.set(bx, 0.3, bz);
    group.add(bLeg);
  });

  return {
    group,
    isKeytar: false,
    ledMat,
    lidGroup: lid,
    propStick,
    lidOpenAngle: 0.64,
    lidClosedAngle: 0.04,
    dispose() {
      disposeGroupResources(group, textures);
    },
  };
}


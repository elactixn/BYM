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
      piano: { x: -2.45, y: 0, z: -2.65, rotY: 0.42 },
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
      piano: { x: -2.65, y: 0, z: -2.75, rotY: 0.46 },
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
      piano: { x: -3.2, y: 0, z: -1.7, rotY: 0.36 },
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
      piano: { x: -2.45, y: 0, z: -2.65, rotY: 0.42 },
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

export const KEYBOARD_MODELS = [
  {
    id: 'concert-grand',
    registryId: 'Keys_Concert_Grand',
    name: 'Concert Grand Piano',
    shortName: 'Concert Grand',
    isKeytar: false,
    swatch: ['#0f172a', '#facc15'],
    description: 'Glossy black grand piano with propped resonance lid, ivory keys & brass pedals.',
    svgIcon: '<svg viewBox="0 0 88 38" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 14c0-5 8-9 20-9 10 0 16 4 22 7 7 3 16 2 16 9v6H16V14z" fill="#18181b" stroke="#facc15" stroke-width="1.6"/><path d="M18 12l24-8 26 8" stroke="#fde047" stroke-width="1.6" stroke-linecap="round"/><rect x="17" y="21" width="54" height="5" rx="1" fill="#f8fafc"/><path d="M21 21h3v3h-3zm6 0h3v3h-3zm9 0h3v3h-3zm6 0h3v3h-3zm6 0h3v3h-3zm9 0h3v3h-3zm6 0h3v3h-3z" fill="#0f172a"/><line x1="22" y1="27" x2="22" y2="35" stroke="#94a3b8" stroke-width="2.2"/><line x1="66" y1="27" x2="66" y2="35" stroke="#94a3b8" stroke-width="2.2"/><line x1="44" y1="27" x2="44" y2="35" stroke="#facc15" stroke-width="2"/></svg>',
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
    id: 'midnight-stealth',
    registryId: 'Skin_Midnight_Stealth',
    name: 'Midnight Stealth Matte',
    shortName: 'Midnight Stealth',
    description: 'Tactical matte carbon-fiber weave, blacked-out gunmetal hardware & subtle crimson pin-stripes.',
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
    emissiveIntensity: 0.22,
    drumSubLabel: 'STEALTH',
    svgIcon: '<svg viewBox="0 0 84 40" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="5" width="72" height="30" rx="8" fill="#111114" stroke="#52525b" stroke-width="2"/><path d="M12 13h60M12 20h60M12 27h60" stroke="#27272a" stroke-width="2"/><line x1="12" y1="30" x2="72" y2="30" stroke="#ef4444" stroke-width="2"/></svg>',
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

    const bodyMat = makeSkinBodyMat({
      color: 0xb91c1c,
      roughness: 0.22,
      metalness: 0.42,
      emissive: 0x450a0a,
      emissiveIntensity: 0.35,
    });
    headstockMat = bodyMat;
    bodyMesh = new THREE.Mesh(makeExtrudedBody(shape, 0.1, 0.018), bodyMat);
    group.add(bodyMesh);

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

  const pegCount = modelId === 'neon-5string' ? 5 : 4;
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

  const isDouble = effectiveModel === 'metal-double-bass';
  const isAcrylic = effectiveModel === 'acrylic-led';

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
      : isDouble
        ? new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.22, metalness: 0.62 })
        : new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.26, metalness: 0.42 });
  }

  const ringColor = useCustomSkin
    ? skin.accentHex
    : isAcrylic
      ? 0xa855f7
      : isDouble
        ? 0xef4444
        : 0xf59e0b;

  const ledRingMat = new THREE.MeshStandardMaterial({
    color: ringColor,
    emissive: ringColor,
    emissiveIntensity: isAcrylic ? 1.85 : 0.95,
    roughness: 0.2,
  });

  const rimMat = new THREE.MeshStandardMaterial({
    color: skin.hardwareColor,
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
    useCustomSkin ? skin.accentHex : isAcrylic ? '#22d3ee' : isDouble ? '#ef4444' : '#f59e0b',
    useCustomSkin ? skin.drumSubLabel : isDouble ? 'METAL' : isAcrylic ? 'LED' : 'LIVE',
    useCustomSkin ? skin.darkHex : '#0f1320'
  );
  textures.push(drumheadTex);
  const frontKickMat = new THREE.MeshStandardMaterial({ map: drumheadTex, roughness: 0.48, metalness: 0.14 });

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

  if (modelId === 'retro-keytar') {
    const bodyShape = new THREE.Shape();
    bodyShape.moveTo(-0.55, 0.12);
    bodyShape.lineTo(0.45, 0.22);
    bodyShape.lineTo(0.62, 0.02);
    bodyShape.lineTo(0.48, -0.2);
    bodyShape.lineTo(-0.52, -0.14);
    bodyShape.closePath();

    const bodyMat = makeSkinCaseMat({
      color: 0xe11d48,
      roughness: 0.2,
      metalness: 0.45,
      emissive: 0x881337,
      emissiveIntensity: 0.32,
    });
    ledMat = new THREE.MeshStandardMaterial({
      color: useCustomSkin ? skin.accentHex : 0x22d3ee,
      emissive: useCustomSkin ? skin.accentHex : 0x22d3ee,
      emissiveIntensity: 1.5,
      roughness: 0.2,
    });

    const body = new THREE.Mesh(makeExtrudedBody(bodyShape, 0.09, 0.018), bodyMat);
    const keybed = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.16, 0.03), keysMat);
    keybed.position.set(0.06, -0.04, 0.068);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.12, 0.065), bodyMat);
    neck.position.set(-0.78, 0.05, 0);
    const pitchStrip = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.032, 0.08), ledMat);
    pitchStrip.position.set(-0.78, 0.09, 0.01);
    const accentStripe = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.03, 0.13), brassMat);
    accentStripe.position.set(0.05, 0.11, 0);

    group.add(body, keybed, neck, pitchStrip, accentStripe);

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

  // Default: Glossy Concert Grand Piano with curved tail, open propped lid & active PBR finish
  const ebonyMat = makeSkinCaseMat({
    color: 0x0b0d13,
    roughness: 0.12,
    metalness: 0.35,
  });
  const soundboardMat = new THREE.MeshStandardMaterial({
    color: useCustomSkin ? skin.accentHex : 0xb45309,
    roughness: 0.38,
    metalness: 0.62,
  });
  ledMat = new THREE.MeshStandardMaterial({
    color: useCustomSkin ? skin.accentHex : 0xfacc15,
    emissive: useCustomSkin ? skin.accentHex : 0xfacc15,
    emissiveIntensity: 0.95,
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

  // Golden harp soundboard inside open case
  const harp = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.04, 1.1), soundboardMat);
  harp.position.set(-0.08, 1.27, 0.72);
  group.add(harp);

  // Open angled Concert Grand lid + brass prop stick
  const lidGeo = new THREE.ExtrudeGeometry(grandShape, {
    depth: 0.045,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.01,
    bevelSegments: 1,
    curveSegments: 14,
  });
  lidGeo.rotateX(Math.PI * 0.5);
  const lid = new THREE.Mesh(lidGeo, ebonyMat);
  lid.position.set(-0.88, 1.34, 0.1);
  lid.rotation.z = 0.54;
  // Offset so hinge sits along the left (-X) spine
  lidGeo.translate(0.88, 0, 0);
  group.add(lid);

  const propStick = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.86, 8), brassMat);
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

  // 3 tapered grand piano legs + brass casters
  [
    [-0.72, -0.18],
    [0.72, -0.18],
    [-0.28, 1.56],
  ].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.045, 0.94, 10), ebonyMat);
    leg.position.set(lx, 0.49, lz);
    const caster = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 8), brassMat);
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
    const pedal = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.02, 0.14), brassMat);
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
    dispose() {
      disposeGroupResources(group, textures);
    },
  };
}


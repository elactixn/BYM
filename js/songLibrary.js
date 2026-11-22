/**
 * songLibrary.js
 * Built-In Tiered Song Library + Persistent Custom Setlist (100% Client-Side):
 *  1. 3 Concert Tiers (6 instant-play built-in tracks):
 *       - Tier 1: Garage Warmup  (Garage Anthem, Neon Cruiser)
 *       - Tier 2: Electric Club  (Velvet Heartbreak, Pop Punk Drive)
 *       - Tier 3: Stadium Encore (Voltage Overdrive, Titan's Reckoning)
 *     Each track synthesizes 3 isolated WebAudio stems (drums, bass, guitar) via
 *     OfflineAudioContext AND emits exact pre-authored musical charts for Guitar,
 *     Bass, and Drums across Easy (3-lane), Medium (4-lane), Hard (5-lane), and
 *     Expert (5-lane + chords) with 0ms AI wait time.
 *  2. Persistent High Scores & Star Ratings stored in localStorage (+ IndexedDB mirror).
 *  3. Persistent Custom Library in IndexedDB storing uploaded MP3/WAV audio blobs,
 *     optional .mid files, and cached neural MIDI / note charts permanently across reloads.
 */

import { extractSongMetadata } from './songMetadata.js';
import { normalizeSectionType } from './audioEngine.js';

const DB_NAME = 'EncoreStageLibraryDB';
const DB_VERSION = 2;
const STORE_SONGS = 'localSongs';
const STORE_SCORES = 'highScores';
const LOCAL_SCORES_KEY = 'encore_stage_track_records_v2';

export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export const SONG_TIERS = [
  {
    tier: 1,
    id: 'tier-1-garage',
    name: 'Tier 1: Garage Warmup',
    tag: 'OPENING ACT',
    accent: '#22c55e',
    venueHint: 'Intramuros & Club Warmup',
  },
  {
    tier: 2,
    id: 'tier-2-club',
    name: 'Tier 2: Electric Club',
    tag: 'HEADLINER',
    accent: '#f59e0b',
    venueHint: 'Electric Arena Circuit',
  },
  {
    tier: 3,
    id: 'tier-3-stadium',
    name: 'Tier 3: Stadium Encore',
    tag: 'WORLD TOUR',
    accent: '#ef4444',
    venueHint: 'Sold-Out Stadium Finale',
  },
];

export const BUILTIN_TRACKS = [
  /* ===================== TIER 1: GARAGE WARMUP ===================== */
  {
    id: 'garage-anthem',
    sourceType: 'builtin',
    tier: 1,
    tierName: 'Tier 1: Garage Warmup',
    difficultyRating: 1,
    title: 'Garage Anthem',
    subtitle: 'Raw indie-rock power chords, steady kick-snare & punchy bass',
    artist: 'The Concrete Amp',
    genre: 'Indie Garage Rock',
    bpm: 112,
    duration: 94,
    keyLabel: 'E Major',
    style: 'garage-rock',
    coverPalette: ['#15803d', '#0f172a', '#fde047'],
    coverEmblem: 'bolt',
    sections: [
      { name: 'INTRO', bars: 4, energy: 0.56, guitarMode: 'riff', drumMode: 'minimal', bassMode: 'hold' },
      { name: 'VERSE 1', bars: 8, energy: 0.7, guitarMode: 'palm', drumMode: 'verse', bassMode: 'pulse' },
      { name: 'CHORUS 1', bars: 8, energy: 0.96, guitarMode: 'anthem', drumMode: 'chorus', bassMode: 'root8' },
      { name: 'VERSE 2', bars: 8, energy: 0.72, guitarMode: 'palm', drumMode: 'verse', bassMode: 'pulse' },
      { name: 'CHORUS 2', bars: 8, energy: 1.0, guitarMode: 'anthem', drumMode: 'chorus', bassMode: 'drive' },
      { name: 'OUTRO', bars: 6, energy: 0.85, guitarMode: 'riff', drumMode: 'halftime', bassMode: 'hold' },
    ],
    chords: [
      { root: 40, fifth: 47, chord: [64, 68, 71, 76], riff: [64, 68, 71, 76, 71, 68, 64, 68] },
      { root: 45, fifth: 52, chord: [64, 69, 73, 76], riff: [69, 73, 76, 73, 69, 64, 69, 73] },
      { root: 47, fifth: 54, chord: [66, 71, 75, 78], riff: [71, 75, 78, 75, 71, 66, 71, 75] },
      { root: 44, fifth: 51, chord: [64, 68, 71, 76], riff: [76, 75, 71, 68, 64, 68, 71, 75] },
    ],
  },
  {
    id: 'neon-cruiser',
    sourceType: 'builtin',
    tier: 1,
    tierName: 'Tier 1: Garage Warmup',
    difficultyRating: 2,
    title: 'Neon Cruiser',
    subtitle: 'Four-on-the-floor synthwave pulse, octave sub-bass & bright hooks',
    artist: 'Midnight Vector',
    genre: 'Retro Synthwave',
    bpm: 118,
    duration: 112,
    keyLabel: 'F Minor',
    style: 'synth-pop',
    coverPalette: ['#0891b2', '#1e1b4b', '#ec4899'],
    coverEmblem: 'sun',
    sections: [
      { name: 'INTRO', bars: 4, energy: 0.48, guitarMode: 'arp', drumMode: 'minimal', bassMode: 'hold' },
      { name: 'VERSE 1', bars: 8, energy: 0.66, guitarMode: 'pluck', drumMode: 'fourfloor', bassMode: 'octave' },
      { name: 'PRE-CHORUS', bars: 4, energy: 0.84, guitarMode: 'arp', drumMode: 'build', bassMode: 'octave' },
      { name: 'CHORUS 1', bars: 12, energy: 1.0, guitarMode: 'synthlead', drumMode: 'disco', bassMode: 'syncopated' },
      { name: 'VERSE 2', bars: 8, energy: 0.68, guitarMode: 'pluck', drumMode: 'fourfloor', bassMode: 'octave' },
      { name: 'CHORUS 2', bars: 12, energy: 1.02, guitarMode: 'synthlead', drumMode: 'disco', bassMode: 'syncopated' },
      { name: 'OUTRO', bars: 6, energy: 0.64, guitarMode: 'arp', drumMode: 'fourfloor', bassMode: 'hold' },
    ],
    chords: [
      { root: 41, fifth: 48, chord: [65, 68, 72, 77], riff: [77, 75, 72, 68, 72, 75, 77, 80] },
      { root: 37, fifth: 44, chord: [61, 65, 68, 73], riff: [73, 72, 68, 65, 68, 72, 73, 77] },
      { root: 44, fifth: 51, chord: [63, 68, 72, 75], riff: [75, 72, 75, 77, 75, 72, 68, 72] },
      { root: 39, fifth: 46, chord: [63, 67, 70, 75], riff: [75, 77, 79, 75, 70, 67, 70, 75] },
    ],
  },

  /* ===================== TIER 2: ELECTRIC CLUB ===================== */
  {
    id: 'velvet-heartbreak',
    sourceType: 'builtin',
    tier: 2,
    tierName: 'Tier 2: Electric Club',
    difficultyRating: 3,
    title: 'Velvet Heartbreak',
    subtitle: 'Shimmering verse arpeggios exploding into stadium chorus anthems',
    artist: 'Starlight Riot',
    genre: 'Arena Power Ballad',
    bpm: 98,
    duration: 112,
    keyLabel: 'G Major',
    style: 'ballad',
    coverPalette: ['#7c3aed', '#1e1b4b', '#f59e0b'],
    coverEmblem: 'star',
    sections: [
      { name: 'INTRO', bars: 4, energy: 0.46, guitarMode: 'arp', drumMode: 'silent', bassMode: 'silent' },
      { name: 'VERSE 1', bars: 8, energy: 0.6, guitarMode: 'arp', drumMode: 'halftime', bassMode: 'hold' },
      { name: 'PRE-CHORUS', bars: 4, energy: 0.82, guitarMode: 'build', drumMode: 'build', bassMode: 'pulse' },
      { name: 'CHORUS 1', bars: 8, energy: 0.98, guitarMode: 'anthem', drumMode: 'stadium', bassMode: 'drive' },
      { name: 'VERSE 2', bars: 8, energy: 0.64, guitarMode: 'arp', drumMode: 'halftime', bassMode: 'pulse' },
      { name: 'CHORUS 2', bars: 8, energy: 1.0, guitarMode: 'anthem', drumMode: 'stadium', bassMode: 'drive' },
      { name: 'FINAL CHORUS', bars: 6, energy: 1.06, guitarMode: 'anthem', drumMode: 'stadium', bassMode: 'drive' },
    ],
    chords: [
      { root: 43, fifth: 50, chord: [62, 67, 71, 74], riff: [67, 71, 74, 79, 74, 71, 67, 71] },
      { root: 40, fifth: 47, chord: [64, 67, 71, 76], riff: [64, 67, 71, 76, 71, 67, 64, 67] },
      { root: 36, fifth: 43, chord: [60, 64, 67, 72], riff: [60, 64, 67, 72, 76, 72, 67, 64] },
      { root: 38, fifth: 45, chord: [62, 66, 69, 74], riff: [62, 66, 69, 74, 78, 74, 69, 66] },
    ],
  },
  {
    id: 'pop-punk-drive',
    sourceType: 'builtin',
    tier: 2,
    tierName: 'Tier 2: Electric Club',
    difficultyRating: 3,
    title: 'Pop Punk Drive',
    subtitle: 'High-energy palm-muted power chords & driving double-time punk drums',
    artist: 'Encore House Band',
    genre: 'Skate Pop Punk',
    bpm: 165,
    duration: 112,
    keyLabel: 'D Major',
    style: 'pop-punk',
    coverPalette: ['#ea580c', '#18181b', '#facc15'],
    coverEmblem: 'flame',
    sections: [
      { name: 'INTRO', bars: 4, energy: 0.56, guitarMode: 'riff', drumMode: 'silent', bassMode: 'silent' },
      { name: 'VERSE 1', bars: 8, energy: 0.68, guitarMode: 'palm', drumMode: 'verse', bassMode: 'root8' },
      { name: 'PRE-CHORUS', bars: 4, energy: 0.84, guitarMode: 'build', drumMode: 'build', bassMode: 'octave' },
      { name: 'CHORUS 1', bars: 12, energy: 1.0, guitarMode: 'anthem', drumMode: 'chorus', bassMode: 'drive' },
      { name: 'VERSE 2', bars: 8, energy: 0.7, guitarMode: 'palm', drumMode: 'verse', bassMode: 'root8' },
      { name: 'CHORUS 2', bars: 12, energy: 1.0, guitarMode: 'anthem', drumMode: 'chorus', bassMode: 'drive' },
      { name: 'BRIDGE', bars: 8, energy: 0.58, guitarMode: 'arp', drumMode: 'halftime', bassMode: 'hold' },
      { name: 'FINAL CHORUS', bars: 16, energy: 1.06, guitarMode: 'anthem', drumMode: 'chorus', bassMode: 'drive' },
      { name: 'OUTRO', bars: 4, energy: 0.52, guitarMode: 'riff', drumMode: 'halftime', bassMode: 'hold' },
    ],
    chords: [
      { root: 38, fifth: 45, chord: [62, 66, 69, 74], riff: [74, 73, 71, 69, 71, 73, 74, 78] },
      { root: 45, fifth: 52, chord: [61, 64, 69, 73], riff: [73, 71, 69, 64, 69, 71, 73, 76] },
      { root: 47, fifth: 54, chord: [62, 66, 71, 74], riff: [74, 71, 74, 76, 74, 73, 71, 66] },
      { root: 43, fifth: 50, chord: [62, 67, 71, 74], riff: [74, 76, 78, 74, 71, 69, 67, 71] },
    ],
  },

  /* ===================== TIER 3: STADIUM ENCORE ===================== */
  {
    id: 'voltage-overdrive',
    sourceType: 'builtin',
    tier: 3,
    tierName: 'Tier 3: Stadium Encore',
    difficultyRating: 4,
    title: 'Voltage Overdrive',
    subtitle: 'Blistering stadium hard rock with shredding lead runs & syncopated fills',
    artist: 'High-Volt Syndicate',
    genre: 'Stadium Hard Rock',
    bpm: 144,
    duration: 114,
    keyLabel: 'A Minor',
    style: 'hard-rock',
    coverPalette: ['#dc2626', '#111827', '#fb923c'],
    coverEmblem: 'lightning',
    sections: [
      { name: 'INTRO', bars: 4, energy: 0.7, guitarMode: 'riff', drumMode: 'build', bassMode: 'pulse' },
      { name: 'VERSE 1', bars: 8, energy: 0.76, guitarMode: 'palm', drumMode: 'verse', bassMode: 'syncopated' },
      { name: 'CHORUS 1', bars: 12, energy: 1.02, guitarMode: 'anthem', drumMode: 'chorus', bassMode: 'drive' },
      { name: 'GUITAR SOLO', bars: 12, energy: 1.08, guitarMode: 'shred', drumMode: 'chorus', bassMode: 'octave' },
      { name: 'VERSE 2', bars: 8, energy: 0.78, guitarMode: 'palm', drumMode: 'verse', bassMode: 'syncopated' },
      { name: 'FINAL CHORUS', bars: 16, energy: 1.1, guitarMode: 'anthem', drumMode: 'doublekick', bassMode: 'drive' },
      { name: 'OUTRO', bars: 6, energy: 0.92, guitarMode: 'shred', drumMode: 'build', bassMode: 'drive' },
    ],
    chords: [
      { root: 33, fifth: 40, chord: [57, 64, 69, 72], riff: [69, 72, 74, 76, 79, 76, 74, 72] },
      { root: 41, fifth: 48, chord: [60, 65, 69, 72], riff: [72, 74, 76, 72, 69, 67, 65, 69] },
      { root: 36, fifth: 43, chord: [60, 64, 67, 72], riff: [72, 76, 79, 81, 79, 76, 72, 76] },
      { root: 38, fifth: 45, chord: [59, 64, 68, 71], riff: [71, 74, 76, 79, 76, 74, 71, 68] },
    ],
  },
  {
    id: 'titans-reckoning',
    sourceType: 'builtin',
    tier: 3,
    tierName: 'Tier 3: Stadium Encore',
    difficultyRating: 5,
    title: "Titan's Reckoning",
    subtitle: 'Double-bass thrash metal finale with galloping basslines & rapid shred solos',
    artist: 'Iron Colossus',
    genre: 'Arena Thrash Metal',
    bpm: 178,
    duration: 118,
    keyLabel: 'E Minor',
    style: 'metal',
    coverPalette: ['#991b1b', '#09090b', '#facc15'],
    coverEmblem: 'skull',
    sections: [
      { name: 'INTRO', bars: 4, energy: 0.78, guitarMode: 'shred', drumMode: 'build', bassMode: 'drive' },
      { name: 'VERSE 1', bars: 12, energy: 0.88, guitarMode: 'palm', drumMode: 'doublekick', bassMode: 'drive' },
      { name: 'CHORUS 1', bars: 12, energy: 1.05, guitarMode: 'anthem', drumMode: 'doublekick', bassMode: 'drive' },
      { name: 'SHRED SOLO', bars: 16, energy: 1.12, guitarMode: 'shred', drumMode: 'doublekick', bassMode: 'octave' },
      { name: 'BREAKDOWN', bars: 8, energy: 0.92, guitarMode: 'palm', drumMode: 'halftime', bassMode: 'syncopated' },
      { name: 'FINAL ENCORE', bars: 20, energy: 1.15, guitarMode: 'shred', drumMode: 'doublekick', bassMode: 'drive' },
      { name: 'OUTRO', bars: 8, energy: 1.0, guitarMode: 'anthem', drumMode: 'build', bassMode: 'drive' },
    ],
    chords: [
      { root: 40, fifth: 47, chord: [64, 67, 71, 76], riff: [76, 79, 78, 76, 74, 76, 79, 83] },
      { root: 36, fifth: 43, chord: [60, 64, 67, 72], riff: [72, 76, 74, 72, 71, 72, 76, 79] },
      { root: 38, fifth: 45, chord: [62, 66, 69, 74], riff: [74, 78, 76, 74, 72, 74, 78, 81] },
      { root: 35, fifth: 42, chord: [59, 63, 66, 71], riff: [71, 75, 78, 79, 78, 75, 71, 75] },
    ],
  },
];

// Cache rendered offline stems in memory so restarts are instantaneous
const renderedStemCache = new Map();

export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const whole = Math.floor(seconds);
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function parseAudioFilename(filename) {
  const withoutExt = filename.replace(/\.[^/.]+$/, '').replace(/[_]+/g, ' ').trim();
  const dashSplit = withoutExt.split(/\s+[-–—]\s+/);
  if (dashSplit.length >= 2) {
    return {
      artist: dashSplit[0].trim() || 'Custom Artist',
      title: dashSplit.slice(1).join(' - ').trim() || withoutExt,
    };
  }
  return {
    artist: 'Custom Track',
    title: withoutExt || 'Uploaded Song',
  };
}

/* ==========================================================================
   OfflineAudioContext 3-Stem Renderer for Built-In Tiered Tracks
   Produces 3 isolated stereo AudioBuffers (drums, bass, guitar) in ~180ms
   ========================================================================== */

function createOfflineNoise(ctx, durationSec) {
  const len = Math.floor(ctx.sampleRate * durationSec);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  return buf;
}

async function renderSingleStem(track, stemType) {
  const sampleRate = 44100;
  const eighthSec = 60 / track.bpm / 2;
  const barSections = [];
  track.sections.forEach((sec) => {
    for (let b = 0; b < sec.bars; b += 1) barSections.push(sec);
  });

  const leadInSec = 1.0;
  const totalSteps = barSections.length * 8;
  const totalDuration = leadInSec + totalSteps * eighthSec + 1.5;
  const offline = new OfflineAudioContext(2, Math.ceil(totalDuration * sampleRate), sampleRate);
  const noiseBuf = stemType === 'drums' ? createOfflineNoise(offline, 0.35) : null;

  for (let stepIdx = 0; stepIdx < totalSteps; stepIdx += 1) {
    const time = leadInSec + stepIdx * eighthSec;
    const barIndex = Math.floor(stepIdx / 8);
    const step = stepIdx % 8;
    const section = barSections[barIndex];
    const chordObj = track.chords[barIndex % track.chords.length];
    const energy = section.energy;

    if (stemType === 'drums') {
      const mode = section.drumMode;
      if (mode === 'silent') continue;

      let kick = false;
      if (mode === 'minimal') kick = step === 0;
      else if (mode === 'halftime') kick = step === 0 || step === 5;
      else if (mode === 'fourfloor' || mode === 'disco') kick = step % 2 === 0;
      else if (mode === 'build') kick = step % 2 === 0 || step === 7;
      else if (mode === 'stadium') kick = step === 0 || step === 3 || step === 5;
      else if (mode === 'doublekick') kick = step === 0 || step === 1 || step === 3 || step === 4 || step === 6;
      else if (mode === 'chorus') kick = step === 0 || step === 3 || step === 4 || step === 6;
      else kick = step === 0 || step === 4 || (step === 6 && energy > 0.6);

      const snare =
        mode === 'halftime'
          ? step === 4
          : mode === 'minimal'
            ? false
            : mode === 'build'
              ? step === 2 || step === 6 || step === 7
              : step === 2 || step === 6;

      const hat = mode !== 'minimal' && (step % 2 === 1 || energy >= 0.8);

      if (kick) {
        const osc = offline.createOscillator();
        const g = offline.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(track.style === 'metal' ? 165 : 145, time);
        osc.frequency.exponentialRampToValueAtTime(42, time + 0.11);
        g.gain.setValueAtTime(0.62 * Math.min(1.15, energy + 0.15), time);
        g.gain.exponentialRampToValueAtTime(0.001, time + 0.22);
        osc.connect(g);
        g.connect(offline.destination);
        osc.start(time);
        osc.stop(time + 0.24);
      }

      if (snare) {
        const n = offline.createBufferSource();
        n.buffer = noiseBuf;
        const f = offline.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = track.style === 'synth-pop' ? 2400 : 3400;
        f.Q.value = 0.85;
        const g = offline.createGain();
        g.gain.setValueAtTime(0.46 * Math.min(1.15, energy + 0.1), time);
        g.gain.exponentialRampToValueAtTime(0.001, time + 0.16);
        n.connect(f);
        f.connect(g);
        g.connect(offline.destination);
        n.start(time);
        n.stop(time + 0.17);

        const body = offline.createOscillator();
        const bg = offline.createGain();
        body.type = 'triangle';
        body.frequency.setValueAtTime(208, time);
        body.frequency.exponentialRampToValueAtTime(112, time + 0.08);
        bg.gain.setValueAtTime(0.25 * energy, time);
        bg.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
        body.connect(bg);
        bg.connect(offline.destination);
        body.start(time);
        body.stop(time + 0.11);
      }

      if (hat) {
        const decay = step === 0 && energy >= 0.95 ? 0.22 : 0.05;
        const n = offline.createBufferSource();
        n.buffer = noiseBuf;
        const hp = offline.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 6800;
        const g = offline.createGain();
        g.gain.setValueAtTime(0.13 * energy, time);
        g.gain.exponentialRampToValueAtTime(0.0008, time + decay);
        n.connect(hp);
        hp.connect(g);
        g.connect(offline.destination);
        n.start(time);
        n.stop(time + decay + 0.015);
      }
    } else if (stemType === 'bass') {
      const mode = section.bassMode;
      if (mode === 'silent') continue;

      let midi = null;
      let dur = eighthSec * 0.9;

      if (mode === 'hold' && step === 0) {
        midi = chordObj.root;
        dur = eighthSec * 7.2;
      } else if (mode === 'pulse' && step % 2 === 0) {
        midi = chordObj.root;
        dur = eighthSec * 1.65;
      } else if (mode === 'octave') {
        midi = step % 2 === 0 ? chordObj.root : chordObj.root + 12;
      } else if (mode === 'syncopated' && [0, 2, 3, 5, 6, 7].includes(step)) {
        midi = step === 3 || step === 7 ? chordObj.root + 12 : step === 5 ? chordObj.fifth : chordObj.root;
      } else if (mode === 'root8' || mode === 'drive') {
        midi = step === 6 ? chordObj.fifth : step === 7 ? chordObj.root + 12 : chordObj.root;
      }

      if (midi !== null) {
        const freq = midiToFreq(midi);
        const osc = offline.createOscillator();
        const sub = offline.createOscillator();
        const flt = offline.createBiquadFilter();
        const g = offline.createGain();

        osc.type = track.style === 'synth-pop' || track.style === 'metal' ? 'sawtooth' : 'triangle';
        osc.frequency.value = freq;
        sub.type = 'sine';
        sub.frequency.value = freq;

        flt.type = 'lowpass';
        flt.frequency.setValueAtTime(track.style === 'metal' ? 760 : track.style === 'pop-punk' ? 660 : 480, time);
        flt.frequency.exponentialRampToValueAtTime(210, time + Math.min(dur, 0.25));

        g.gain.setValueAtTime(0.001, time);
        g.gain.linearRampToValueAtTime(0.46 * energy, time + 0.012);
        g.gain.exponentialRampToValueAtTime(0.001, time + dur);

        osc.connect(flt);
        sub.connect(flt);
        flt.connect(g);
        g.connect(offline.destination);

        osc.start(time);
        sub.start(time);
        osc.stop(time + dur + 0.02);
        sub.stop(time + dur + 0.02);
      }
    } else {
      const mode = section.guitarMode;
      const emitVoice = (midiNote, dur, level, timbre) => {
        const osc = offline.createOscillator();
        const flt = offline.createBiquadFilter();
        const g = offline.createGain();

        if (timbre === 'crunch' || timbre === 'lead' || timbre === 'metal') {
          osc.type = 'sawtooth';
          flt.type = 'bandpass';
          flt.frequency.value = timbre === 'metal' ? 2350 : timbre === 'lead' ? 1950 : 1450;
          flt.Q.value = timbre === 'metal' ? 1.05 : 0.85;
        } else if (timbre === 'synth') {
          osc.type = 'square';
          flt.type = 'lowpass';
          flt.frequency.setValueAtTime(3200, time);
          flt.frequency.exponentialRampToValueAtTime(1100, time + dur);
        } else {
          osc.type = 'triangle';
          flt.type = 'lowpass';
          flt.frequency.value = 2400;
        }

        osc.frequency.value = midiToFreq(midiNote);
        g.gain.setValueAtTime(0.001, time);
        g.gain.linearRampToValueAtTime(level, time + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0008, time + dur);

        osc.connect(flt);
        flt.connect(g);
        g.connect(offline.destination);
        osc.start(time);
        osc.stop(time + dur + 0.02);
      };

      const heavyTimbre = track.style === 'metal' || track.style === 'hard-rock' ? 'metal' : 'crunch';

      if (mode === 'arp') {
        emitVoice(chordObj.riff[step % chordObj.riff.length], eighthSec * 1.5, 0.26 * energy, 'clean');
      } else if (mode === 'palm') {
        if (step % 2 === 0 || step === 5 || step === 7) {
          emitVoice(chordObj.chord[step % 2] - 12, eighthSec * 0.62, 0.31 * energy, heavyTimbre);
        }
      } else if (mode === 'pluck') {
        if ([0, 2, 3, 6].includes(step)) {
          emitVoice(chordObj.riff[(step + barIndex) % chordObj.riff.length], eighthSec * 0.9, 0.28 * energy, 'synth');
        }
      } else if (mode === 'build') {
        emitVoice(chordObj.chord[step % chordObj.chord.length], eighthSec * 0.95, 0.32 * energy, heavyTimbre);
      } else if (mode === 'riff') {
        if ([0, 2, 4, 5, 7].includes(step)) {
          emitVoice(chordObj.riff[step % chordObj.riff.length], eighthSec * 1.15, 0.34 * energy, 'lead');
        }
      } else if (mode === 'shred') {
        const note = chordObj.riff[(step + barIndex * 3) % chordObj.riff.length];
        emitVoice(note, eighthSec * 0.85, 0.35 * energy, 'metal');
        if (step === 0 || step === 4) {
          emitVoice(chordObj.chord[0] - 12, eighthSec * 2.2, 0.18 * energy, heavyTimbre);
        }
      } else if (mode === 'synthlead') {
        if ([0, 1, 3, 4, 6].includes(step)) {
          emitVoice(chordObj.riff[(step + (barIndex % 2) * 2) % chordObj.riff.length], eighthSec * 1.25, 0.34 * energy, 'synth');
        }
        if (step === 0 || step === 4) {
          emitVoice(chordObj.chord[0], eighthSec * 3.4, 0.16 * energy, 'clean');
        }
      } else {
        if (step === 0 || step === 4) {
          chordObj.chord.slice(0, 3).forEach((m) => {
            emitVoice(m, eighthSec * 3.2, 0.15 * energy, heavyTimbre);
          });
        }
        if ([0, 2, 3, 5, 6].includes(step)) {
          emitVoice(chordObj.riff[(step + barIndex) % chordObj.riff.length], eighthSec * 1.15, 0.3 * energy, 'lead');
        }
      }
    }
  }

  return offline.startRendering();
}

/**
 * Generates an exact pre-authored musical chart for any built-in track with 0ms wait time,
 * tailored to instrument (guitar/bass/drums), difficulty (easy/medium/hard/expert), and lanes (3/4/5).
 */
export function buildPreauthoredBuiltinChart(track, { instrument = 'guitar', difficulty = 'medium', laneCount = 4 }) {
  const eighthSec = 60 / track.bpm / 2;
  const beatSec = 60 / track.bpm;
  const leadInSec = 1.0;

  const barSections = [];
  const sections = [];
  let cursorSec = leadInSec;
  track.sections.forEach((sec, idx) => {
    for (let b = 0; b < sec.bars; b += 1) barSections.push(sec);
    const segDur = sec.bars * 8 * eighthSec;
    const rawName = sec.name || (sec.guitarMode === 'shred' ? 'Guitar Solo' : idx === 0 ? 'Intro' : 'Verse');
    const normType = normalizeSectionType(rawName);
    sections.push({
      id: `builtin_sec_${idx}_${normType}`,
      type: normType,
      label: rawName,
      startSec: Number(cursorSec.toFixed(3)),
      endSec: Number((cursorSec + segDur).toFixed(3)),
      energy: Number((sec.energy ?? 0.6).toFixed(3)),
    });
    cursorSec += segDur;
  });

  const totalSteps = barSections.length * 8;
  const duration = leadInSec + totalSteps * eighthSec + 1.5;

  const beatGrid = [];
  for (let b = 0; leadInSec + b * beatSec < duration; b += 1) {
    beatGrid.push({
      timeSec: Number((leadInSec + b * beatSec).toFixed(4)),
      isMeasure: b % 4 === 0,
    });
  }

  const notes = [];
  let noteId = 1;
  const maxLane = Math.max(2, laneCount - 1);
  const diffLevel = difficulty === 'easy' ? 0 : difficulty === 'medium' ? 1 : difficulty === 'hard' ? 2 : 3;

  const mapPitchToLane = (midi, lowMidi, highMidi) => {
    const norm = Math.max(0, Math.min(0.999, (midi - lowMidi) / Math.max(1, highMidi - lowMidi)));
    return Math.min(maxLane, Math.floor(norm * laneCount));
  };

  let lastTime = -1;
  const minGap = difficulty === 'easy' ? 0.36 : difficulty === 'medium' ? 0.21 : difficulty === 'hard' ? 0.145 : 0.095;

  for (let stepIdx = 0; stepIdx < totalSteps; stepIdx += 1) {
    const timeSec = leadInSec + stepIdx * eighthSec;
    const barIndex = Math.floor(stepIdx / 8);
    const step = stepIdx % 8;
    const section = barSections[barIndex];
    const chordObj = track.chords[barIndex % track.chords.length];
    const isFeverPhrase = barIndex % 8 === 6 || barIndex % 8 === 7;

    if (instrument === 'drums') {
      const mode = section.drumMode;
      if (mode === 'silent') continue;

      let kick = false;
      if (mode === 'minimal') kick = step === 0;
      else if (mode === 'halftime') kick = step === 0 || step === 5;
      else if (mode === 'fourfloor' || mode === 'disco') kick = step % 2 === 0;
      else if (mode === 'build') kick = step % 2 === 0 || step === 7;
      else if (mode === 'stadium') kick = step === 0 || step === 3 || step === 5;
      else if (mode === 'doublekick') kick = step === 0 || step === 1 || step === 3 || step === 4 || step === 6;
      else if (mode === 'chorus') kick = step === 0 || step === 3 || step === 4 || step === 6;
      else kick = step === 0 || step === 4 || (step === 6 && section.energy > 0.6);

      const snare =
        mode === 'halftime'
          ? step === 4
          : mode === 'minimal'
            ? false
            : mode === 'build'
              ? step === 2 || step === 6 || step === 7
              : step === 2 || step === 6;

      const hat = mode !== 'minimal' && (step % 2 === 1 || section.energy >= 0.82);
      const crash = step === 0 && section.energy >= 0.94 && barIndex % 2 === 0;

      if (difficulty === 'easy' && step % 2 === 1) continue;
      if (timeSec - lastTime < minGap) continue;

      const hitLanes = [];
      if (kick) hitLanes.push(0);
      if (snare) hitLanes.push(1);
      if (crash) hitLanes.push(maxLane);
      else if (hat && diffLevel >= 1 && hitLanes.length === 0) {
        hitLanes.push(Math.min(maxLane, 2));
      }

      if (hitLanes.length === 0) continue;
      const finalLanes = diffLevel <= 1 ? [hitLanes[0]] : hitLanes.slice(0, 2);
      finalLanes.forEach((lane) => {
        notes.push({
          id: noteId++,
          hitTimeSec: Number(timeSec.toFixed(4)),
          lane,
          sustainDuration: 0,
          isFever: isFeverPhrase,
          isChord: finalLanes.length > 1,
          kitPiece: lane === 0 ? 'kick' : lane === 1 ? 'snare' : lane === maxLane ? 'crash' : 'hat',
          hit: false,
          missed: false,
          holding: false,
          holdDone: false,
        });
      });
      lastTime = timeSec;
    } else if (instrument === 'bass') {
      const mode = section.bassMode;
      if (mode === 'silent') continue;

      let midi = null;
      let sustain = 0;

      if (mode === 'hold' && step === 0) {
        midi = chordObj.root;
        sustain = eighthSec * 4.5;
      } else if (mode === 'pulse' && step % 2 === 0) {
        midi = chordObj.root;
        sustain = step === 0 ? eighthSec * 1.4 : 0;
      } else if (mode === 'octave' && (diffLevel >= 1 || step % 2 === 0)) {
        midi = step % 2 === 0 ? chordObj.root : chordObj.root + 12;
      } else if (mode === 'syncopated' && [0, 2, 3, 5, 6, 7].includes(step)) {
        if (diffLevel === 0 && ![0, 3, 6].includes(step)) continue;
        midi = step === 3 || step === 7 ? chordObj.root + 12 : step === 5 ? chordObj.fifth : chordObj.root;
      } else if ((mode === 'root8' || mode === 'drive') && (diffLevel >= 2 || step % 2 === 0)) {
        midi = step === 6 ? chordObj.fifth : step === 7 ? chordObj.root + 12 : chordObj.root;
      }

      if (midi === null || timeSec - lastTime < minGap) continue;
      const lane = mapPitchToLane(midi, 33, 56);
      notes.push({
        id: noteId++,
        hitTimeSec: Number(timeSec.toFixed(4)),
        lane,
        sustainDuration: sustain >= 0.35 ? Number(sustain.toFixed(3)) : 0,
        isFever: isFeverPhrase,
        isChord: false,
        hit: false,
        missed: false,
        holding: false,
        holdDone: false,
      });
      lastTime = timeSec;
    } else {
      // Lead Guitar
      const mode = section.guitarMode;
      let midi = null;
      let sustain = 0;
      let wantChord = false;

      if (mode === 'arp') {
        if (diffLevel === 0 && step % 2 !== 0) continue;
        midi = chordObj.riff[step % chordObj.riff.length];
        if (step === 0 && diffLevel <= 1) sustain = eighthSec * 1.6;
      } else if (mode === 'palm') {
        if (diffLevel === 0 && step % 4 !== 0) continue;
        if (diffLevel === 1 && step % 2 !== 0) continue;
        if (step % 2 === 0 || step === 5 || step === 7) {
          midi = chordObj.chord[step % 2];
          wantChord = step === 0 && diffLevel >= 3;
        }
      } else if (mode === 'pluck') {
        if ([0, 2, 3, 6].includes(step)) {
          if (diffLevel === 0 && step === 3) continue;
          midi = chordObj.riff[(step + barIndex) % chordObj.riff.length];
        }
      } else if (mode === 'build') {
        if (diffLevel === 0 && step % 2 !== 0) continue;
        midi = chordObj.chord[step % chordObj.chord.length];
        wantChord = (step === 0 || step === 4) && diffLevel >= 2;
      } else if (mode === 'riff') {
        if ([0, 2, 4, 5, 7].includes(step)) {
          if (diffLevel === 0 && step === 5) continue;
          midi = chordObj.riff[step % chordObj.riff.length];
          if (step === 0) sustain = eighthSec * 1.4;
        }
      } else if (mode === 'shred') {
        if (diffLevel === 0 && step % 2 !== 0) continue;
        if (diffLevel === 1 && step % 2 !== 0 && step !== 3) continue;
        midi = chordObj.riff[(step + barIndex * 3) % chordObj.riff.length];
        wantChord = step === 0 && diffLevel >= 3;
      } else if (mode === 'synthlead') {
        if ([0, 1, 3, 4, 6].includes(step)) {
          if (diffLevel === 0 && (step === 1 || step === 6)) continue;
          midi = chordObj.riff[(step + (barIndex % 2) * 2) % chordObj.riff.length];
          if (step === 0) sustain = eighthSec * 1.3;
        }
      } else {
        // anthem
        if ([0, 2, 3, 5, 6].includes(step)) {
          if (diffLevel === 0 && (step === 3 || step === 5)) continue;
          midi = chordObj.riff[(step + barIndex) % chordObj.riff.length];
          wantChord = (step === 0 || step === 4) && diffLevel >= 2;
          if (step === 0 && !wantChord) sustain = eighthSec * 1.6;
        }
      }

      if (midi === null || timeSec - lastTime < minGap) continue;
      const lane = mapPitchToLane(midi, 58, 82);
      const chordPartner = wantChord ? (lane <= maxLane - 2 ? lane + 2 : Math.max(0, lane - 2)) : -1;

      notes.push({
        id: noteId++,
        hitTimeSec: Number(timeSec.toFixed(4)),
        lane,
        sustainDuration: wantChord ? 0 : sustain >= 0.35 ? Number(sustain.toFixed(3)) : 0,
        isFever: isFeverPhrase,
        isChord: chordPartner >= 0 && chordPartner !== lane,
        hit: false,
        missed: false,
        holding: false,
        holdDone: false,
      });

      if (chordPartner >= 0 && chordPartner !== lane) {
        notes.push({
          id: noteId++,
          hitTimeSec: Number(timeSec.toFixed(4)),
          lane: chordPartner,
          sustainDuration: 0,
          isFever: isFeverPhrase,
          isChord: true,
          hit: false,
          missed: false,
          holding: false,
          holdDone: false,
        });
      }
      lastTime = timeSec;
    }
  }

  return {
    bpm: track.bpm,
    beatGrid,
    sections,
    notes,
  };
}

/**
 * Renders (and caches) all 3 isolated stems for a built-in track.
 */
export async function ensureBuiltinStems(track) {
  if (renderedStemCache.has(track.id)) {
    return renderedStemCache.get(track.id);
  }

  const [drums, bass, guitar] = await Promise.all([
    renderSingleStem(track, 'drums'),
    renderSingleStem(track, 'bass'),
    renderSingleStem(track, 'guitar'),
  ]);

  const bundle = { drums, bass, guitar, duration: drums.duration };
  renderedStemCache.set(track.id, bundle);
  return bundle;
}

/* ==========================================================================
   Persistent High Scores & Star Ratings (localStorage + IndexedDB)
   ========================================================================== */

function readLocalScoreMap() {
  try {
    const raw = window.localStorage.getItem(LOCAL_SCORES_KEY);
    if (raw) return JSON.parse(raw) || {};
  } catch {
    // Ignore storage errors
  }
  return {};
}

function writeLocalScoreMap(map) {
  try {
    window.localStorage.setItem(LOCAL_SCORES_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage errors
  }
}

/* ==========================================================================
   Persistent Custom Setlist Library (IndexedDB)
   Stores uploaded MP3/WAV blobs, optional .mid files, cached neural MIDI
   note events, and analyzed charts permanently across reloads!
   ========================================================================== */

let dbPromise = null;

function openLibraryDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof window.indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_SONGS)) {
        db.createObjectStore(STORE_SONGS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SCORES)) {
        db.createObjectStore(STORE_SCORES, { keyPath: 'trackId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open local library'));
  });
  return dbPromise;
}

export async function loadSavedLocalTracks() {
  try {
    const db = await openLibraryDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SONGS, 'readonly');
      const req = tx.objectStore(STORE_SONGS).getAll();
      req.onsuccess = () => {
        const list = (req.result || []).sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function saveLocalTrackToLibrary(record) {
  try {
    const db = await openLibraryDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SONGS, 'readwrite');
      // Strip non-cloneable runtime AudioBuffer before persisting
      const { audioBuffer: _ignore, ...persistable } = record;
      tx.objectStore(STORE_SONGS).put(persistable);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Graceful degradation
  }
}

export async function updateLocalTrackChartCache(trackId, chartKey, chartData, detectedBpm, extraPatch = null) {
  try {
    const db = await openLibraryDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SONGS, 'readwrite');
      const store = tx.objectStore(STORE_SONGS);
      const getReq = store.get(trackId);
      getReq.onsuccess = () => {
        const rec = getReq.result;
        if (rec) {
          rec.charts = rec.charts || {};
          if (chartKey && chartData) {
            rec.charts[chartKey] = chartData;
          }
          if (detectedBpm) rec.bpm = detectedBpm;
          if (extraPatch) {
            Object.assign(rec, extraPatch);
          }
          store.put(rec);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore cache persistence errors
  }
}

export async function deleteLocalTrackFromLibrary(trackId) {
  try {
    const localScores = readLocalScoreMap();
    delete localScores[trackId];
    writeLocalScoreMap(localScores);

    const db = await openLibraryDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_SONGS, STORE_SCORES], 'readwrite');
      tx.objectStore(STORE_SONGS).delete(trackId);
      tx.objectStore(STORE_SCORES).delete(trackId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore
  }
}

export async function loadAllHighScores() {
  const localMap = readLocalScoreMap();
  try {
    const db = await openLibraryDB();
    const idbMap = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SCORES, 'readonly');
      const req = tx.objectStore(STORE_SCORES).getAll();
      req.onsuccess = () => {
        const map = {};
        (req.result || []).forEach((item) => {
          map[item.trackId] = item;
        });
        resolve(map);
      };
      req.onerror = () => reject(req.error);
    });
    return { ...idbMap, ...localMap };
  } catch {
    return localMap;
  }
}

export async function saveHighScore(trackId, { score, grade, accuracy, maxCombo, instrument, stars = 0, isGoldStars = false, difficulty = 'medium' }) {
  const localMap = readLocalScoreMap();
  const prevLocal = localMap[trackId];
  const merged = {
    trackId,
    score: prevLocal ? Math.max(prevLocal.score || 0, score) : score,
    grade: !prevLocal || score >= (prevLocal.score || 0) ? grade : prevLocal.grade,
    accuracy: !prevLocal || score >= (prevLocal.score || 0) ? Number(accuracy.toFixed(1)) : prevLocal.accuracy,
    maxCombo: prevLocal ? Math.max(prevLocal.maxCombo || 0, maxCombo) : maxCombo,
    stars: prevLocal ? Math.max(prevLocal.stars || 0, stars) : stars,
    isGoldStars: Boolean(prevLocal?.isGoldStars || isGoldStars),
    instrument,
    difficulty,
    updatedAt: Date.now(),
  };
  localMap[trackId] = merged;
  writeLocalScoreMap(localMap);

  try {
    const db = await openLibraryDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SCORES, 'readwrite');
      tx.objectStore(STORE_SCORES).put(merged);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore
  }
  return merged;
}

/* ==========================================================================
   Local Audio + Optional .MID File Import & Drag-and-Drop Binding
   ========================================================================== */

export async function importLocalAudioFile(audioFile, audioCtx, midiFile = null, chartFile = null) {
  if (!audioFile) {
    throw new Error('Please choose an audio file.');
  }

  const validMime =
    audioFile.type.startsWith('audio/') ||
    /\.(mp3|wav|ogg|m4a|flac|aac|webm)$/i.test(audioFile.name);

  if (!validMime) {
    throw new Error('Please drop an MP3, WAV, OGG, or M4A song file (plus an optional .MID or .CHART file).');
  }

  const rawBytes = await audioFile.arrayBuffer();
  const [decodedBuffer, meta, midiBytes, chartText] = await Promise.all([
    audioCtx.decodeAudioData(rawBytes.slice(0)),
    extractSongMetadata(rawBytes, audioFile.name, { allowOnlineFallback: true }).catch(() => null),
    midiFile ? midiFile.arrayBuffer() : Promise.resolve(null),
    chartFile ? chartFile.text() : Promise.resolve(null),
  ]);

  const fallbackParsed = parseAudioFilename(audioFile.name);
  const title = meta?.title || fallbackParsed.title;
  const artist = meta?.artist || fallbackParsed.artist;
  const baseGenre = meta?.genre || (chartFile ? 'Custom Audio + CHART' : midiFile ? 'Custom Audio + MIDI' : 'Custom Song');

  const record = {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    sourceType: 'local',
    tier: 0,
    tierName: 'My Custom Setlist',
    difficultyRating: 3,
    title,
    artist,
    album: meta?.album || null,
    genre: baseGenre,
    coverArtUrl: meta?.coverArtUrl || null,
    metadataSource: meta?.source || 'filename',
    fileName: audioFile.name,
    midiFileName: midiFile ? midiFile.name : null,
    chartFileName: chartFile ? chartFile.name : null,
    fileSizeMb: (audioFile.size / (1024 * 1024)).toFixed(1),
    duration: decodedBuffer.duration,
    bpm: meta?.bpm || null,
    addedAt: Date.now(),
    rawBytes,
    midiBytes,
    chartText,
    neuralNotes: null,
    charts: {},
    coverPalette: ['#0284c7', '#111827', '#f59e0b'],
    coverEmblem: 'vinyl',
  };

  await saveLocalTrackToLibrary(record);

  return {
    ...record,
    audioBuffer: decodedBuffer,
  };
}

export async function decodeStoredLocalTrack(record, audioCtx) {
  if (record.audioBuffer) return record.audioBuffer;
  if (!record.rawBytes) {
    throw new Error('Saved audio data is missing.');
  }
  const decoded = await audioCtx.decodeAudioData(record.rawBytes.slice(0));
  record.audioBuffer = decoded;
  return decoded;
}

export function bindLocalAudioDropzone({ dropZone, fileInput, onFilesPicked }) {
  const prevent = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  let dragDepth = 0;

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((evt) => {
    dropZone.addEventListener(evt, prevent);
  });

  dropZone.addEventListener('dragenter', () => {
    dragDepth += 1;
    dropZone.classList.add('is-dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) {
      dropZone.classList.remove('is-dragover');
    }
  });

  dropZone.addEventListener('drop', (e) => {
    dragDepth = 0;
    dropZone.classList.remove('is-dragover');
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length > 0) {
      onFilesPicked(files);
    }
  });

  fileInput.addEventListener('change', () => {
    const files = Array.from(fileInput.files || []);
    if (files.length > 0) {
      onFilesPicked(files);
      fileInput.value = '';
    }
  });
}

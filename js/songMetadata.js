/**
 * songMetadata.js
 * Zero-API-Key Local Embedded Audio Tag Reader + Free Open-Data Fallback:
 *  1. 100% Local Offline Binary Parsers (0ms, zero external libraries):
 *       - ID3v2.2 / ID3v2.3 / ID3v2.4 (MP3): Title, Artist, Album, Genre, BPM & APIC Cover Art
 *       - MP4 / M4A (moov->udta->meta->ilst): Title, Artist, Album, Genre, BPM & covr Cover Art
 *       - Ogg Vorbis & FLAC (Vorbis Comments + METADATA_BLOCK_PICTURE): Title, Artist, Album, Genre, Cover Art
 *  2. Free Open-Data Fallback (Zero API Keys, Zero Subscriptions):
 *       - Queries MusicBrainz public API (https://musicbrainz.org/ws/2/recording/) +
 *         Cover Art Archive (https://coverartarchive.org/release/{id}/front-250) when embedded
 *         tags are missing, gracefully falling back to clean filename parsing offline.
 */

const ID3V1_GENRES = [
  'Blues', 'Classic Rock', 'Country', 'Dance', 'Disco', 'Funk', 'Grunge', 'Hip-Hop',
  'Jazz', 'Metal', 'New Age', 'Oldies', 'Other', 'Pop', 'R&B', 'Rap', 'Reggae', 'Rock',
  'Techno', 'Industrial', 'Alternative', 'Ska', 'Death Metal', 'Pranks', 'Soundtrack',
  'Euro-Techno', 'Ambient', 'Trip-Hop', 'Vocal', 'Jazz+Funk', 'Fusion', 'Trance',
  'Classical', 'Instrumental', 'Acid', 'House', 'Game', 'Sound Clip', 'Gospel', 'Noise',
  'Alt Rock', 'Bass', 'Soul', 'Punk', 'Space', 'Meditative', 'Instrumental Pop',
  'Instrumental Rock', 'Ethnic', 'Gothic', 'Darkwave', 'Techno-Industrial', 'Electronic',
  'Pop-Folk', 'Eurodance', 'Dream', 'Southern Rock', 'Comedy', 'Cult', 'Gangsta Rap',
  'Top 40', 'Christian Rap', 'Pop/Funk', 'Jungle', 'Native American', 'Cabaret', 'New Wave',
  'Psychedelic', 'Rave', 'Showtunes', 'Trailer', 'Lo-Fi', 'Tribal', 'Acid Punk', 'Acid Jazz',
  'Polka', 'Retro', 'Musical', 'Rock & Roll', 'Hard Rock', 'Folk', 'Folk-Rock', 'National Folk',
  'Swing', 'Fast Fusion', 'Bebop', 'Latin', 'Revival', 'Celtic', 'Bluegrass', 'Avantgarde',
  'Gothic Rock', 'Progressive Rock', 'Psychedelic Rock', 'Symphonic Rock', 'Slow Rock',
  'Big Band', 'Chorus', 'Easy Listening', 'Acoustic', 'Humour', 'Speech', 'Chanson', 'Opera',
  'Chamber Music', 'Sonata', 'Symphony', 'Booty Bass', 'Primus', 'Porn Groove', 'Satire',
  'Slow Jam', 'Club', 'Tango', 'Samba', 'Folklore', 'Ballad', 'Power Ballad', 'Rhythmic Soul',
  'Freestyle', 'Duet', 'Punk Rock', 'Drum Solo', 'A Cappella', 'Euro-House', 'Dance Hall',
  'Goa', 'Drum & Bass', 'Club-House', 'Hardcore', 'Terror', 'Indie', 'BritPop', 'Afro-Punk',
  'Polsk Punk', 'Beat', 'Christian Gangsta', 'Heavy Metal', 'Black Metal', 'Crossover',
  'Contemporary Christian', 'Christian Rock', 'Merengue', 'Salsa', 'Thrash Metal', 'Anime',
  'JPop', 'Synthpop',
];

function decodeBytes(bytes, encoding = 'utf-8') {
  try {
    return new TextDecoder(encoding, { fatal: false }).decode(bytes).replace(/\0+$/g, '').trim();
  } catch {
    let out = '';
    for (let i = 0; i < bytes.length; i += 1) {
      if (bytes[i] !== 0) out += String.fromCharCode(bytes[i]);
    }
    return out.trim();
  }
}

function decodeId3Text(bytes, encodingByte) {
  if (!bytes || bytes.length === 0) return '';
  if (encodingByte === 0) return decodeBytes(bytes, 'iso-8859-1');
  if (encodingByte === 3) return decodeBytes(bytes, 'utf-8');
  if (encodingByte === 2) return decodeBytes(bytes, 'utf-16be');
  // Encoding 1: UTF-16 with BOM
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return decodeBytes(bytes.subarray(2), 'utf-16be');
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return decodeBytes(bytes.subarray(2), 'utf-16le');
  }
  return decodeBytes(bytes, 'utf-16le');
}

function bytesToDataUrl(bytes, mime = 'image/jpeg') {
  if (!bytes || bytes.length < 32 || bytes.length > 3 * 1024 * 1024) return null;
  let safeMime = (mime || '').toLowerCase().trim();
  if (!safeMime.startsWith('image/')) {
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e) safeMime = 'image/png';
    else if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46) safeMime = 'image/webp';
    else safeMime = 'image/jpeg';
  }
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, Math.min(bytes.length, i + chunk));
    binary += String.fromCharCode.apply(null, slice);
  }
  try {
    return `data:${safeMime};base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

function normalizeGenre(raw) {
  if (!raw) return '';
  const cleaned = raw.trim();
  const match = cleaned.match(/^\((\d+)\)(.*)$/);
  if (match) {
    const idx = Number(match[1]);
    const rest = match[2].trim();
    if (rest) return rest;
    if (idx >= 0 && idx < ID3V1_GENRES.length) return ID3V1_GENRES[idx];
  }
  if (/^\d+$/.test(cleaned)) {
    const idx = Number(cleaned);
    if (idx >= 0 && idx < ID3V1_GENRES.length) return ID3V1_GENRES[idx];
  }
  return cleaned;
}

function readSynchsafe32(bytes, offset) {
  return (
    ((bytes[offset] & 0x7f) << 21) |
    ((bytes[offset + 1] & 0x7f) << 14) |
    ((bytes[offset + 2] & 0x7f) << 7) |
    (bytes[offset + 3] & 0x7f)
  );
}

function readUint32BE(bytes, offset) {
  return (
    ((bytes[offset] << 24) >>> 0) +
    (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) +
    bytes[offset + 3]
  );
}

function readUint32LE(bytes, offset) {
  return (
    bytes[offset] +
    (bytes[offset + 1] << 8) +
    (bytes[offset + 2] << 16) +
    ((bytes[offset + 3] << 24) >>> 0)
  );
}

function readAscii(bytes, offset, len) {
  let s = '';
  for (let i = 0; i < len && offset + i < bytes.length; i += 1) {
    s += String.fromCharCode(bytes[offset + i]);
  }
  return s;
}

/* ==========================================================================
   1. ID3v2 (v2.2 / v2.3 / v2.4) & ID3v1 Parser for MP3
   ========================================================================== */

function parseId3Tags(bytes) {
  const result = { title: '', artist: '', album: '', genre: '', bpm: null, coverArtUrl: null };

  // Check ID3v2 header at start of file
  if (bytes.length > 10 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    const version = bytes[3];
    const flags = bytes[5];
    const tagSize = readSynchsafe32(bytes, 6);
    const tagEnd = Math.min(bytes.length, 10 + tagSize);
    let pos = 10;

    // Skip optional extended header
    if (flags & 0x40 && pos + 4 <= tagEnd) {
      const extSize = version >= 4 ? readSynchsafe32(bytes, pos) : readUint32BE(bytes, pos);
      pos += version >= 4 ? extSize : extSize + 4;
    }

    while (pos < tagEnd - 6) {
      let frameId = '';
      let frameSize = 0;
      let headerLen = 10;

      if (version === 2) {
        frameId = readAscii(bytes, pos, 3);
        frameSize = (bytes[pos + 3] << 16) | (bytes[pos + 4] << 8) | bytes[pos + 5];
        headerLen = 6;
      } else {
        frameId = readAscii(bytes, pos, 4);
        frameSize = version >= 4 ? readSynchsafe32(bytes, pos + 4) : readUint32BE(bytes, pos + 4);
        headerLen = 10;
      }

      if (!frameId || frameId.charCodeAt(0) === 0 || frameSize <= 0) break;
      const dataStart = pos + headerLen;
      const dataEnd = Math.min(tagEnd, dataStart + frameSize);
      if (dataEnd <= dataStart) break;

      const payload = bytes.subarray(dataStart, dataEnd);
      const enc = payload[0];

      if (frameId === 'TIT2' || frameId === 'TT2') {
        result.title = decodeId3Text(payload.subarray(1), enc) || result.title;
      } else if (frameId === 'TPE1' || frameId === 'TP1') {
        result.artist = decodeId3Text(payload.subarray(1), enc) || result.artist;
      } else if (frameId === 'TALB' || frameId === 'TAL') {
        result.album = decodeId3Text(payload.subarray(1), enc) || result.album;
      } else if (frameId === 'TCON' || frameId === 'TCO') {
        result.genre = normalizeGenre(decodeId3Text(payload.subarray(1), enc)) || result.genre;
      } else if (frameId === 'TBPM' || frameId === 'TBP') {
        const bpmNum = parseFloat(decodeId3Text(payload.subarray(1), enc));
        if (Number.isFinite(bpmNum) && bpmNum >= 50 && bpmNum <= 240) {
          result.bpm = Math.round(bpmNum);
        }
      } else if ((frameId === 'APIC' || frameId === 'PIC') && !result.coverArtUrl && payload.length > 16) {
        let idx = 1;
        let mime = 'image/jpeg';
        if (frameId === 'PIC') {
          const fmt = readAscii(payload, idx, 3).toUpperCase();
          mime = fmt === 'PNG' ? 'image/png' : 'image/jpeg';
          idx += 3;
        } else {
          const mimeStart = idx;
          while (idx < payload.length && payload[idx] !== 0) idx += 1;
          mime = decodeBytes(payload.subarray(mimeStart, idx), 'iso-8859-1') || 'image/jpeg';
          idx += 1; // null terminator
        }
        idx += 1; // picture type byte
        // Skip description string (null-terminated, 2-byte null for UTF-16)
        if (enc === 1 || enc === 2) {
          while (idx + 1 < payload.length && !(payload[idx] === 0 && payload[idx + 1] === 0)) {
            idx += 2;
          }
          idx += 2;
        } else {
          while (idx < payload.length && payload[idx] !== 0) idx += 1;
          idx += 1;
        }
        if (idx < payload.length - 16) {
          result.coverArtUrl = bytesToDataUrl(payload.subarray(idx), mime);
        }
      }

      pos = dataEnd;
    }
  }

  // Fallback check for ID3v1 footer (last 128 bytes)
  if ((!result.title || !result.artist) && bytes.length >= 128) {
    const start = bytes.length - 128;
    if (bytes[start] === 0x54 && bytes[start + 1] === 0x41 && bytes[start + 2] === 0x47) {
      if (!result.title) result.title = decodeBytes(bytes.subarray(start + 3, start + 33), 'iso-8859-1');
      if (!result.artist) result.artist = decodeBytes(bytes.subarray(start + 33, start + 63), 'iso-8859-1');
      if (!result.album) result.album = decodeBytes(bytes.subarray(start + 63, start + 93), 'iso-8859-1');
      const gByte = bytes[start + 127];
      if (!result.genre && gByte < ID3V1_GENRES.length) result.genre = ID3V1_GENRES[gByte];
    }
  }

  return result;
}

/* ==========================================================================
   2. MP4 / M4A Atom Tag Parser (ftyp / moov -> udta -> meta -> ilst)
   ========================================================================== */

function parseMp4Tags(bytes) {
  const result = { title: '', artist: '', album: '', genre: '', bpm: null, coverArtUrl: null };
  if (bytes.length < 16 || readAscii(bytes, 4, 4) !== 'ftyp') return result;

  const walkAtoms = (start, end, depth = 0) => {
    if (depth > 8) return;
    let pos = start;
    while (pos + 8 <= end) {
      let size = readUint32BE(bytes, pos);
      const type = readAscii(bytes, pos + 4, 4);
      let headerSize = 8;
      if (size === 0) size = end - pos;
      else if (size === 1 && pos + 16 <= end) {
        size = readUint32BE(bytes, pos + 12);
        headerSize = 16;
      }
      if (size < headerSize || pos + size > end) break;
      const bodyStart = pos + headerSize;
      const bodyEnd = pos + size;

      if (type === 'moov' || type === 'udta' || type === 'ilst') {
        walkAtoms(bodyStart, bodyEnd, depth + 1);
      } else if (type === 'meta') {
        // 'meta' is a FullBox with 4-byte version/flags before child atoms
        walkAtoms(bodyStart + 4, bodyEnd, depth + 1);
      } else if (
        type === '\u00a9nam' ||
        type === '\u00a9ART' ||
        type === '\u00a9alb' ||
        type === '\u00a9gen' ||
        type === 'gnre' ||
        type === 'tmpo' ||
        type === 'covr'
      ) {
        // Look for child 'data' atom inside ilst item
        let dPos = bodyStart;
        while (dPos + 16 <= bodyEnd) {
          const dSize = readUint32BE(bytes, dPos);
          const dType = readAscii(bytes, dPos + 4, 4);
          if (dSize < 16 || dPos + dSize > bodyEnd) break;
          if (dType === 'data') {
            const dataFlags = readUint32BE(bytes, dPos + 8);
            const payload = bytes.subarray(dPos + 16, dPos + dSize);
            if (type === '\u00a9nam') result.title = decodeBytes(payload, 'utf-8') || result.title;
            else if (type === '\u00a9ART') result.artist = decodeBytes(payload, 'utf-8') || result.artist;
            else if (type === '\u00a9alb') result.album = decodeBytes(payload, 'utf-8') || result.album;
            else if (type === '\u00a9gen') result.genre = normalizeGenre(decodeBytes(payload, 'utf-8')) || result.genre;
            else if (type === 'gnre' && payload.length >= 2) {
              const idx = ((payload[0] << 8) | payload[1]) - 1;
              if (idx >= 0 && idx < ID3V1_GENRES.length) result.genre = ID3V1_GENRES[idx];
            } else if (type === 'tmpo' && payload.length >= 2) {
              const bpmVal = (payload[0] << 8) | payload[1];
              if (bpmVal >= 50 && bpmVal <= 240) result.bpm = bpmVal;
            } else if (type === 'covr' && !result.coverArtUrl) {
              const mime = dataFlags === 14 ? 'image/png' : 'image/jpeg';
              result.coverArtUrl = bytesToDataUrl(payload, mime);
            }
          }
          dPos += dSize;
        }
      }

      pos = bodyEnd;
    }
  };

  walkAtoms(0, bytes.length, 0);
  return result;
}

/* ==========================================================================
   3. Vorbis Comment & FLAC Metadata Block Parser (OGG / FLAC)
   ========================================================================== */

function parseVorbisCommentBlock(bytes, start, end, result) {
  if (start + 8 > end) return;
  let pos = start;
  const vendorLen = readUint32LE(bytes, pos);
  pos += 4 + vendorLen;
  if (pos + 4 > end) return;
  const commentCount = readUint32LE(bytes, pos);
  pos += 4;

  for (let i = 0; i < commentCount && pos + 4 <= end; i += 1) {
    const len = readUint32LE(bytes, pos);
    pos += 4;
    if (pos + len > end) break;
    const entry = decodeBytes(bytes.subarray(pos, pos + len), 'utf-8');
    pos += len;
    const eq = entry.indexOf('=');
    if (eq <= 0) continue;
    const key = entry.slice(0, eq).toUpperCase();
    const val = entry.slice(eq + 1).trim();
    if (key === 'TITLE' && !result.title) result.title = val;
    else if ((key === 'ARTIST' || key === 'ALBUMARTIST') && !result.artist) result.artist = val;
    else if (key === 'ALBUM' && !result.album) result.album = val;
    else if (key === 'GENRE' && !result.genre) result.genre = normalizeGenre(val);
    else if (key === 'BPM' && !result.bpm) {
      const b = parseFloat(val);
      if (Number.isFinite(b) && b >= 50 && b <= 240) result.bpm = Math.round(b);
    }
  }
}

function parseFlacOrOggTags(bytes) {
  const result = { title: '', artist: '', album: '', genre: '', bpm: null, coverArtUrl: null };
  if (bytes.length < 16) return result;

  const sig = readAscii(bytes, 0, 4);
  if (sig === 'fLaC') {
    let pos = 4;
    while (pos + 4 <= bytes.length) {
      const header = bytes[pos];
      const isLast = (header & 0x80) !== 0;
      const blockType = header & 0x7f;
      const len = (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3];
      pos += 4;
      const blockEnd = Math.min(bytes.length, pos + len);
      if (blockType === 4) {
        parseVorbisCommentBlock(bytes, pos, blockEnd, result);
      } else if (blockType === 6 && !result.coverArtUrl && pos + 32 < blockEnd) {
        let p = pos + 4; // skip picture type
        const mimeLen = readUint32BE(bytes, p);
        p += 4;
        const mime = decodeBytes(bytes.subarray(p, p + mimeLen), 'iso-8859-1');
        p += mimeLen;
        const descLen = readUint32BE(bytes, p);
        p += 4 + descLen + 16; // skip desc + width/height/depth/colors
        if (p + 4 < blockEnd) {
          const picLen = readUint32BE(bytes, p);
          p += 4;
          if (p + picLen <= blockEnd) {
            result.coverArtUrl = bytesToDataUrl(bytes.subarray(p, p + picLen), mime);
          }
        }
      }
      pos = blockEnd;
      if (isLast) break;
    }
  } else if (sig === 'OggS') {
    // Scan first 64KB for Vorbis comment packet header (\x03vorbis or OpusTags)
    const limit = Math.min(bytes.length - 12, 65536);
    for (let i = 0; i < limit; i += 1) {
      if (
        bytes[i] === 0x03 &&
        bytes[i + 1] === 0x76 &&
        bytes[i + 2] === 0x6f &&
        bytes[i + 3] === 0x72 &&
        bytes[i + 4] === 0x62 &&
        bytes[i + 5] === 0x69 &&
        bytes[i + 6] === 0x73
      ) {
        parseVorbisCommentBlock(bytes, i + 7, Math.min(bytes.length, i + 16384), result);
        break;
      }
      if (
        bytes[i] === 0x4f &&
        bytes[i + 1] === 0x70 &&
        bytes[i + 2] === 0x75 &&
        bytes[i + 3] === 0x73 &&
        bytes[i + 4] === 0x54 &&
        bytes[i + 5] === 0x61 &&
        bytes[i + 6] === 0x67 &&
        bytes[i + 7] === 0x73
      ) {
        parseVorbisCommentBlock(bytes, i + 8, Math.min(bytes.length, i + 16384), result);
        break;
      }
    }
  }

  return result;
}

/* ==========================================================================
   4. Clean Filename Parser + Free Zero-Key MusicBrainz & Cover Art Archive
   ========================================================================== */

export function parseCleanFilename(filename = '') {
  const noExt = filename
    .replace(/\.[^/.]+$/, '')
    .replace(/[_]+/g, ' ')
    .replace(/\[[^\]]*(official|audio|video|lyrics|hd|hq|320kbps|remaster|live|mv)[^\]]*\]/gi, '')
    .replace(/\([^)]*(official|audio|video|lyrics|hd|hq|320kbps|remaster|mv)[^)]*\)/gi, '')
    .replace(/^\d{1,2}\s*[-.)]\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();

  const dashSplit = noExt.split(/\s+[-–—]\s+/);
  if (dashSplit.length >= 2) {
    return {
      artist: dashSplit[0].trim() || 'Custom Artist',
      title: dashSplit.slice(1).join(' - ').trim() || noExt,
      hadExplicitArtist: true,
    };
  }
  return {
    artist: 'Custom Track',
    title: noExt || 'Uploaded Song',
    hadExplicitArtist: false,
  };
}

async function fetchJsonWithTimeout(url, timeoutMs = 4200) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller ? controller.signal : undefined,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function fetchCoverArtArchiveUrl(releaseId, timeoutMs = 4000) {
  if (!releaseId) return null;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const url = `https://coverartarchive.org/release/${encodeURIComponent(releaseId)}/front-250`;
    const res = await fetch(url, {
      method: 'GET',
      signal: controller ? controller.signal : undefined,
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob || blob.size < 128) return null;
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Free, zero-API-key MusicBrainz + Cover Art Archive lookup.
 * Gracefully returns null if offline, rate-limited, or no confident match exists.
 */
export async function lookupMusicBrainzMetadata({ title, artist, needCoverArt = true }) {
  if (typeof fetch !== 'function') return null;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;
  if (!title || title === 'Uploaded Song') return null;

  const safeTitle = title.replace(/["\\]/g, '').trim();
  const hasRealArtist = artist && artist !== 'Custom Track' && artist !== 'Custom Artist';
  const safeArtist = hasRealArtist ? artist.replace(/["\\]/g, '').trim() : '';

  const query = safeArtist
    ? `recording:"${safeTitle}" AND artist:"${safeArtist}"`
    : `recording:"${safeTitle}"`;

  const url = `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(query)}&fmt=json&limit=3`;
  const data = await fetchJsonWithTimeout(url, 4200);
  const recordings = data?.recordings;
  if (!Array.isArray(recordings) || recordings.length === 0) return null;

  const best = recordings.find((r) => (r.score || 0) >= 72) || recordings[0];
  if (!best || (best.score || 0) < 62) return null;

  const resolvedTitle = best.title || title;
  const resolvedArtist = best['artist-credit']?.[0]?.name || (hasRealArtist ? artist : 'Custom Track');
  const firstRelease = best.releases?.[0] || null;
  const resolvedAlbum = firstRelease?.title || '';
  const resolvedGenre = best.tags?.[0]?.name
    ? best.tags[0].name.replace(/\b\w/g, (c) => c.toUpperCase())
    : '';

  let coverArtUrl = null;
  if (needCoverArt && Array.isArray(best.releases)) {
    for (let i = 0; i < Math.min(2, best.releases.length); i += 1) {
      const relId = best.releases[i]?.id;
      if (!relId) continue;
      coverArtUrl = await fetchCoverArtArchiveUrl(relId, 3500);
      if (coverArtUrl) break;
    }
  }

  return {
    title: resolvedTitle,
    artist: resolvedArtist,
    album: resolvedAlbum,
    genre: resolvedGenre,
    coverArtUrl,
    source: 'musicbrainz',
  };
}

/**
 * Extracts full local embedded metadata in 0ms (ID3v2, MP4/M4A, Vorbis/FLAC)
 * and optionally enriches missing Title/Artist/Cover Art via free MusicBrainz + Cover Art Archive.
 */
export async function extractSongMetadata(arrayBuffer, filename = '', { allowOnlineFallback = true } = {}) {
  const bytes = arrayBuffer ? new Uint8Array(arrayBuffer) : new Uint8Array(0);
  const fileInfo = parseCleanFilename(filename);

  let embedded = { title: '', artist: '', album: '', genre: '', bpm: null, coverArtUrl: null };
  try {
    if (bytes.length > 12) {
      const sig4 = readAscii(bytes, 0, 4);
      const ftyp = readAscii(bytes, 4, 4);
      if (sig4.startsWith('ID3') || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) {
        embedded = parseId3Tags(bytes);
      } else if (ftyp === 'ftyp') {
        embedded = parseMp4Tags(bytes);
      } else if (sig4 === 'fLaC' || sig4 === 'OggS') {
        embedded = parseFlacOrOggTags(bytes);
      } else {
        // Still try ID3v2/v1 as a safe fallback for misnamed files
        embedded = parseId3Tags(bytes);
      }
    }
  } catch {
    // Graceful fallback to filename parsing
  }

  let title = embedded.title || fileInfo.title;
  let artist = embedded.artist || fileInfo.artist;
  let album = embedded.album || '';
  let genre = embedded.genre || '';
  let bpm = embedded.bpm || null;
  let coverArtUrl = embedded.coverArtUrl || null;
  let metadataSource = embedded.title || embedded.artist || embedded.coverArtUrl ? 'embedded' : 'filename';

  // Free open-data MusicBrainz + Cover Art Archive fallback if embedded tags or cover art are missing
  const missingCore = !embedded.title || !embedded.artist;
  const missingCover = !coverArtUrl;
  if (allowOnlineFallback && (missingCore || missingCover)) {
    const online = await lookupMusicBrainzMetadata({
      title,
      artist,
      needCoverArt: missingCover,
    });
    if (online) {
      if (!embedded.title && online.title) title = online.title;
      if (!embedded.artist && online.artist) artist = online.artist;
      if (!album && online.album) album = online.album;
      if (!genre && online.genre) genre = online.genre;
      if (!coverArtUrl && online.coverArtUrl) coverArtUrl = online.coverArtUrl;
      metadataSource = embedded.title ? 'embedded+musicbrainz' : 'musicbrainz';
    }
  }

  return {
    title: title || 'Uploaded Song',
    artist: artist || 'Custom Track',
    album,
    genre,
    bpm,
    coverArtUrl,
    metadataSource,
  };
}

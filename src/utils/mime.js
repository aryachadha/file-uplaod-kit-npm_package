/**
 * MIME type and magic number detection utilities.
 */

export const EXTENSION_MIME_MAP = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.bmp': 'image/bmp',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
  '.pdf': 'application/pdf',
  '.json': 'application/json',
  '.csv': 'text/csv',
  '.txt': 'text/plain',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.xml': 'application/xml',
  '.zip': 'application/zip',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};

/**
 * Checks if a buffer matches a specific byte pattern at an offset.
 * @param {Buffer|Uint8Array} buffer
 * @param {number[]} pattern
 * @param {number} [offset=0]
 * @returns {boolean}
 */
function matchBytes(buffer, pattern, offset = 0) {
  if (!buffer || buffer.length < offset + pattern.length) return false;
  for (let i = 0; i < pattern.length; i++) {
    if (buffer[offset + i] !== pattern[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Detects MIME type from buffer binary content signature (magic numbers).
 * Returns null if no known signature matches or if format lacks a binary header (e.g. plain text).
 *
 * @param {Buffer|Uint8Array} buffer
 * @returns {string|null} Detected MIME type or null.
 */
export function detectMimeFromBuffer(buffer) {
  if (!buffer || buffer.length < 3) {
    return null;
  }

  // JPEG: FF D8 FF
  if (matchBytes(buffer, [0xff, 0xd8, 0xff])) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (matchBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png';
  }

  // GIF: GIF87a or GIF89a (47 49 46 38 37 61 or 47 49 46 38 39 61)
  if (
    matchBytes(buffer, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
    matchBytes(buffer, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
  ) {
    return 'image/gif';
  }

  // PDF: %PDF (25 50 44 46)
  if (matchBytes(buffer, [0x25, 0x50, 0x44, 0x46])) {
    return 'application/pdf';
  }

  // WEBP: RIFF....WEBP (52 49 46 46 .... 57 45 42 50)
  if (
    matchBytes(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    matchBytes(buffer, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return 'image/webp';
  }

  // ZIP / OpenOffice / DOCX / XLSX: PK.. (50 4B 03 04 or 50 4B 05 06)
  if (
    matchBytes(buffer, [0x50, 0x4b, 0x03, 0x04]) ||
    matchBytes(buffer, [0x50, 0x4b, 0x05, 0x06])
  ) {
    return 'application/zip';
  }

  // GZIP: 1F 8B 08
  if (matchBytes(buffer, [0x1f, 0x8b, 0x08])) {
    return 'application/gzip';
  }

  // MP3: ID3 header (49 44 33)
  if (matchBytes(buffer, [0x49, 0x44, 0x33])) {
    return 'audio/mpeg';
  }

  // MP4: ftyp at offset 4 (66 74 79 70)
  if (matchBytes(buffer, [0x66, 0x74, 0x79, 0x70], 4)) {
    return 'video/mp4';
  }

  // WAV: RIFF....WAVE (52 49 46 46 .... 57 41 56 45)
  if (
    matchBytes(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    matchBytes(buffer, [0x57, 0x41, 0x56, 0x45], 8)
  ) {
    return 'audio/wav';
  }

  // Ogg: OggS (4F 67 67 53)
  if (matchBytes(buffer, [0x4f, 0x67, 0x67, 0x53])) {
    return 'audio/ogg';
  }

  return null;
}

/**
 * Gets standard MIME type from a file extension.
 * @param {string} ext - Extension including or excluding leading dot.
 * @returns {string|null}
 */
export function getMimeFromExtension(ext) {
  if (!ext || typeof ext !== 'string') return null;
  const normalized = ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
  return EXTENSION_MIME_MAP[normalized] || null;
}

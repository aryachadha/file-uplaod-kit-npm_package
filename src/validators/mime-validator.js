import { detectMimeFromBuffer, getMimeFromExtension } from '../utils/mime.js';
import path from 'node:path';

/**
 * Checks whether a given mimeType matches an allowed pattern (including wildcards e.g. "image/*").
 * @param {string} mimeType
 * @param {string} pattern
 * @returns {boolean}
 */
export function matchesMimePattern(mimeType, pattern) {
  if (!mimeType || !pattern) return false;
  const target = mimeType.toLowerCase().trim();
  const rule = pattern.toLowerCase().trim();

  if (rule === '*/*' || rule === '*') return true;
  if (rule.endsWith('/*')) {
    const prefix = rule.slice(0, -2);
    return target.startsWith(`${prefix}/`);
  }
  return target === rule;
}

/**
 * Validates file MIME type and magic number content signatures.
 *
 * @param {object} file - Normalized file descriptor.
 * @param {object} options
 * @param {string[]|string} [options.allowedTypes] - Allowed MIME types or patterns.
 * @param {boolean} [options.strictMimeCheck=true] - Whether to enforce magic byte match when available.
 * @returns {Array<{ code: string, message: string }>}
 */
export function validateMime(file, options = {}) {
  const errors = [];
  const allowed = Array.isArray(options.allowedTypes)
    ? options.allowedTypes
    : options.allowedTypes ? [options.allowedTypes] : [];

  const clientMime = (file?.mimeType || file?.mimetype || '').toLowerCase().trim();
  const filename = file?.originalName || file?.filename || '';
  const ext = path.extname(filename).toLowerCase();
  const expectedMimeFromExt = getMimeFromExtension(ext);

  let detectedMime = null;
  if (Buffer.isBuffer(file?.buffer) && file.buffer.length > 0) {
    detectedMime = detectMimeFromBuffer(file.buffer);
  }

  // Check for MIME spoofing if detected signature contradicts client-provided MIME
  if (detectedMime && clientMime && !matchesMimePattern(detectedMime, clientMime)) {
    errors.push({
      code: 'MIME_TYPE_MISMATCH',
      message: `File content signature (${detectedMime}) does not match claimed MIME type (${clientMime}). Possible spoofing detected.`
    });
  }

  // Check if allowedTypes restriction is configured
  if (allowed.length > 0) {
    // If we have a reliable detected magic byte signature, that must be allowed
    const effectiveMime = detectedMime || clientMime || expectedMimeFromExt;

    if (!effectiveMime) {
      errors.push({
        code: 'UNKNOWN_MIME_TYPE',
        message: 'Unable to determine the MIME type of the file.'
      });
      return errors;
    }

    const isAllowed = allowed.some((pattern) => matchesMimePattern(effectiveMime, pattern));
    if (!isAllowed) {
      errors.push({
        code: 'INVALID_MIME_TYPE',
        message: `MIME type '${effectiveMime}' is not permitted. Allowed types: ${allowed.join(', ')}.`
      });
    }
  }

  return errors;
}

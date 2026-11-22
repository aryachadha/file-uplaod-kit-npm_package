import path from 'node:path';
import { SecurityError, InvalidFilenameError } from '../errors/index.js';

/**
 * Validates that a string does not contain null bytes or control characters.
 * @param {string} str
 * @throws {SecurityError}
 */
export function assertSafeString(str) {
  if (typeof str !== 'string') {
    throw new SecurityError('Input must be a valid string.');
  }
  if (str.includes('\0')) {
    throw new SecurityError('Null byte injection detected in path or filename.');
  }
}

/**
 * Sanitizes a base filename, removing directory separators and dangerous control characters.
 * @param {string} filename
 * @returns {string}
 */
export function sanitizeBaseName(filename) {
  assertSafeString(filename);

  // Normalize backslashes to forward slashes for cross-platform basename extraction
  let cleaned = filename.trim().replace(/\\/g, '/');

  // Extract only the base name if a full path was passed
  cleaned = path.basename(cleaned);

  // Remove control characters (0-31 and 127)
  // eslint-disable-next-line no-control-regex
  cleaned = cleaned.replace(/[\x00-\x1f\x7f]/g, '');

  if (!cleaned || cleaned === '.' || cleaned === '..') {
    throw new InvalidFilenameError('Filename is empty or invalid.');
  }

  return cleaned;
}

/**
 * Resolves a safe absolute path inside a destination directory.
 * Guarantees that the resolved path is strictly contained within baseDir.
 *
 * @param {string} baseDir - The root destination directory.
 * @param {string} targetPath - Relative path or filename.
 * @returns {string} Safe absolute path.
 * @throws {SecurityError} If a directory traversal attack is detected.
 */
export function resolveSafePath(baseDir, targetPath) {
  assertSafeString(baseDir);
  assertSafeString(targetPath);

  const absoluteBase = path.resolve(baseDir);
  const absoluteTarget = path.resolve(absoluteBase, targetPath);

  // Compute relative path from base to target
  const relative = path.relative(absoluteBase, absoluteTarget);

  // If the relative path starts with '..' or is absolute, it escapes the base directory
  const isEscaping = relative.startsWith('..') || path.isAbsolute(relative);

  if (isEscaping) {
    throw new SecurityError('Path traversal detected: target escapes base directory.');
  }

  return absoluteTarget;
}

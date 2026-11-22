import path from 'node:path';
import crypto from 'node:crypto';
import { sanitizeBaseName } from './paths.js';

/**
 * Slugifies a filename string into URL/filesystem-safe characters.
 * @param {string} str
 * @returns {string}
 */
export function slugify(str) {
  return str
    .normalize('NFKD')
    // Remove diacritics
    .replace(/[\u0300-\u036f]/g, '')
    // Replace whitespace and underscores with hyphens
    .replace(/[\s_]+/g, '-')
    // Remove everything that is not alphanumeric, hyphen, or dot
    .replace(/[^a-zA-Z0-9.-]/g, '')
    // Deduplicate consecutive hyphens
    .replace(/-+/g, '-')
    // Deduplicate consecutive dots
    .replace(/\.+/g, '.')
    // Strip leading/trailing hyphens and dots
    .replace(/^[.-]+|[.-]+$/g, '')
    .toLowerCase();
}

/**
 * Generates a unique, collision-resistant, and sanitized filename.
 *
 * @param {string} originalName - Original uploaded filename.
 * @param {object} [options={}] - Custom configuration options.
 * @param {Function} [options.strategy] - Custom naming function: (originalName, context) => string.
 * @param {string} [options.prefix=''] - Optional prefix added before the filename.
 * @param {string} [options.suffix=''] - Optional suffix added after the slug and before unique ID.
 * @param {boolean} [options.preserveOriginal=true] - Whether to include the sanitized original name.
 * @param {number} [options.randomBytes=8] - Number of random bytes for uniqueness entropy.
 * @returns {string} Generated safe filename.
 */
export function generateFilename(originalName, options = {}) {
  const {
    strategy = null,
    prefix = '',
    suffix = '',
    preserveOriginal = true,
    randomBytes = 8
  } = options;

  if (typeof originalName !== 'string' || originalName.trim() === '') {
    originalName = 'upload';
  }

  // Sanitize path separators and control characters
  const cleanName = sanitizeBaseName(originalName);

  // Extract raw extension (lowercase, including dot)
  const ext = path.extname(cleanName).toLowerCase();
  const nameWithoutExt = cleanName.slice(0, cleanName.length - ext.length);

  // Slugify base name
  const slug = slugify(nameWithoutExt) || 'file';

  // Generate unique entropy token
  const uniqueId = crypto.randomBytes(randomBytes).toString('hex');

  // Custom strategy function if provided
  if (typeof strategy === 'function') {
    const customResult = strategy(cleanName, {
      originalName: cleanName,
      nameWithoutExt,
      slug,
      ext,
      uniqueId
    });
    if (typeof customResult === 'string' && customResult.trim() !== '') {
      return sanitizeBaseName(customResult);
    }
  }

  // Construct components
  const parts = [];
  if (prefix) {
    const cleanPrefix = slugify(prefix);
    if (cleanPrefix) parts.push(cleanPrefix);
  }

  if (preserveOriginal) {
    parts.push(slug);
  }

  if (suffix) {
    const cleanSuffix = slugify(suffix);
    if (cleanSuffix) parts.push(cleanSuffix);
  }

  parts.push(uniqueId);

  const baseFilename = parts.join('-');
  return `${baseFilename}${ext}`;
}

import path from 'node:path';

/**
 * Normalizes an array or string of extensions to standard lowercase format with leading dots.
 * @param {string[]|string} extensions
 * @returns {string[]}
 */
export function normalizeExtensions(extensions) {
  if (!extensions) return [];
  const list = Array.isArray(extensions) ? extensions : [extensions];
  return list
    .filter((ext) => typeof ext === 'string' && ext.trim() !== '')
    .map((ext) => {
      const trimmed = ext.trim().toLowerCase();
      return trimmed.startsWith('.') ? trimmed : `.${trimmed}`;
    });
}

/**
 * Validates file extension against allowed extensions.
 *
 * @param {object} file - Normalized file object.
 * @param {object} options
 * @param {string[]|string} [options.allowedExtensions]
 * @returns {Array<{ code: string, message: string }>}
 */
export function validateExtension(file, options = {}) {
  const errors = [];
  const allowed = normalizeExtensions(options.allowedExtensions);

  if (allowed.length === 0) {
    return errors;
  }

  const filename = file?.originalName || file?.filename || file?.name || '';
  const ext = path.extname(filename).toLowerCase();

  if (!ext) {
    errors.push({
      code: 'MISSING_FILE_EXTENSION',
      message: 'File does not have a recognizable file extension.'
    });
    return errors;
  }

  if (!allowed.includes(ext)) {
    errors.push({
      code: 'INVALID_FILE_EXTENSION',
      message: `File extension '${ext}' is not permitted. Allowed extensions: ${allowed.join(', ')}.`
    });
  }

  return errors;
}

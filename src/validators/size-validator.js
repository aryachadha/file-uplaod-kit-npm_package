import { formatBytes } from '../utils/size.js';

/**
 * Validates file size against configured limits.
 *
 * @param {object} file - Normalized file descriptor.
 * @param {object} options - Validation options.
 * @param {number} [options.maxFileSize] - Maximum allowed bytes.
 * @param {number} [options.minFileSize=1] - Minimum allowed bytes (default 1 to disallow empty files).
 * @param {boolean} [options.allowEmpty=false] - Whether empty (0-byte) files are permitted.
 * @returns {Array<{ code: string, message: string }>} Validation errors.
 */
export function validateSize(file, options = {}) {
  const errors = [];
  const size = file?.size;

  // If size is undefined and stream is present, defer size enforcement to stream consumption
  if (size === undefined && (file?.stream || options.isStream)) {
    return errors;
  }

  if (typeof size !== 'number' || isNaN(size)) {
    errors.push({
      code: 'INVALID_FILE_SIZE',
      message: 'File size could not be determined or is invalid.'
    });
    return errors;
  }

  const allowEmpty = Boolean(options.allowEmpty);
  if (size === 0 && !allowEmpty) {
    errors.push({
      code: 'FILE_EMPTY',
      message: 'File is empty (0 bytes).'
    });
    return errors;
  }

  if (typeof options.minFileSize === 'number' && size < options.minFileSize) {
    errors.push({
      code: 'FILE_TOO_SMALL',
      message: `File size (${formatBytes(size)}) is below the minimum required size (${formatBytes(options.minFileSize)}).`
    });
  }

  if (typeof options.maxFileSize === 'number' && size > options.maxFileSize) {
    errors.push({
      code: 'FILE_TOO_LARGE',
      message: `File size (${formatBytes(size)}) exceeds the maximum allowed limit (${formatBytes(options.maxFileSize)}).`
    });
  }

  return errors;
}

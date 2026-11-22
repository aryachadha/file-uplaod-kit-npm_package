import { validateSize } from '../validators/size-validator.js';
import { validateExtension } from '../validators/extension-validator.js';
import { validateMime } from '../validators/mime-validator.js';
import { executeCustomValidator } from '../validators/custom-validator.js';
import { assertSafeString } from '../utils/paths.js';

/**
 * Normalizes input into a standard file descriptor object.
 * @param {object|Buffer} input
 * @returns {object|null}
 */
export function normalizeFileInput(input) {
  if (!input) return null;

  if (Buffer.isBuffer(input)) {
    return {
      buffer: input,
      size: input.length,
      originalName: 'file.bin',
      mimeType: 'application/octet-stream'
    };
  }

  if (typeof input === 'object') {
    const originalName = input.originalName || input.originalname || input.filename || input.name || '';
    const size = typeof input.size === 'number'
      ? input.size
      : (Buffer.isBuffer(input.buffer) ? input.buffer.length : undefined);
    const mimeType = input.mimeType || input.mimetype || input.type || '';
    const stream = input.stream || (typeof input.pipe === 'function' ? input : undefined);

    return {
      ...input,
      originalName,
      size,
      mimeType,
      stream
    };
  }

  return null;
}

/**
 * Validates a file against configured rules.
 *
 * @param {object|Buffer} file - File descriptor or buffer.
 * @param {object} [options={}] - Validation configuration.
 * @param {number} [options.maxFileSize] - Maximum allowed file size in bytes.
 * @param {number} [options.minFileSize] - Minimum allowed file size in bytes.
 * @param {boolean} [options.allowEmpty=false] - Whether empty files are allowed.
 * @param {string[]|string} [options.allowedTypes] - Allowed MIME types.
 * @param {string[]|string} [options.allowedExtensions] - Allowed file extensions.
 * @param {string[]} [options.existingFiles] - List of existing filenames to check for duplicates.
 * @param {Function} [options.customValidator] - Synchronous or asynchronous custom validator.
 * @returns {Promise<{ valid: boolean, errors: Array<{ code: string, message: string }> }>}
 */
export async function validateFile(file, options = {}) {
  const errors = [];

  // Missing file check
  if (!file) {
    return {
      valid: false,
      errors: [{ code: 'FILE_MISSING', message: 'No file was provided for upload.' }]
    };
  }

  const normalized = normalizeFileInput(file);
  if (!normalized) {
    return {
      valid: false,
      errors: [{ code: 'INVALID_FILE_OBJECT', message: 'Provided file format is not supported.' }]
    };
  }

  // Filename safety and validity check
  if (normalized.originalName) {
    try {
      assertSafeString(normalized.originalName);
    } catch {
      errors.push({
        code: 'INVALID_FILENAME',
        message: 'Filename contains invalid or dangerous characters.'
      });
    }

    // Duplicate check if existingFiles list provided
    if (Array.isArray(options.existingFiles) && options.existingFiles.includes(normalized.originalName)) {
      errors.push({
        code: 'DUPLICATE_FILENAME',
        message: `A file named '${normalized.originalName}' already exists.`
      });
    }
  }

  // 1. Size validation
  const sizeErrors = validateSize(normalized, options);
  errors.push(...sizeErrors);

  // 2. Extension validation
  const extErrors = validateExtension(normalized, options);
  errors.push(...extErrors);

  // 3. MIME validation (client-claimed and magic byte content signatures)
  const mimeErrors = validateMime(normalized, options);
  errors.push(...mimeErrors);

  // 4. Custom validation (sync or async)
  if (options.customValidator) {
    const customErrors = await executeCustomValidator(normalized, options.customValidator);
    errors.push(...customErrors);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

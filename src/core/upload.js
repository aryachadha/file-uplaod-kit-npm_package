import path from 'node:path';
import { validateFile, normalizeFileInput } from './validate-file.js';
import { generateFilename } from '../utils/filename.js';
import { resolveSafePath } from '../utils/paths.js';
import { saveBufferToFile, saveStreamToFile, fileExists } from '../storage/local-storage.js';
import { bytesToKB, bytesToMB } from '../utils/size.js';
import { getMimeFromExtension, detectMimeFromBuffer } from '../utils/mime.js';
import {
  UploadKitError,
  FileTooLargeError,
  InvalidFileTypeError,
  InvalidFilenameError
} from '../errors/index.js';

/**
 * Maps validation error codes to specialized error classes.
 * @param {Array<{ code: string, message: string }>} errors
 * @returns {UploadKitError}
 */
export function createErrorFromValidation(errors) {
  const first = errors[0] || { code: 'UPLOAD_ERROR', message: 'File upload failed validation.' };

  if (first.code === 'FILE_TOO_LARGE') {
    return new FileTooLargeError(first.message, { errors });
  }

  if (
    first.code === 'INVALID_FILE_TYPE' ||
    first.code === 'INVALID_MIME_TYPE' ||
    first.code === 'MIME_TYPE_MISMATCH' ||
    first.code === 'INVALID_FILE_EXTENSION'
  ) {
    return new InvalidFileTypeError(first.message, { errors });
  }

  if (first.code === 'INVALID_FILENAME') {
    return new InvalidFilenameError(first.message, { errors });
  }

  return new UploadKitError(first.message, first.code, { errors });
}

/**
 * Uploads a single file to local storage.
 *
 * @param {object|Buffer} fileInput - File object, buffer, or stream descriptor.
 * @param {object} [options={}] - Uploader configuration options.
 * @returns {Promise<object>} Upload result metadata.
 */
export async function upload(fileInput, options = {}) {
  const destination = options.destination || './uploads';
  const throwOnError = options.throwOnError !== false;

  const normalized = normalizeFileInput(fileInput);
  if (!normalized) {
    const err = new UploadKitError('No file was provided for upload.', 'FILE_MISSING');
    if (throwOnError) throw err;
    return { success: false, errors: [{ code: 'FILE_MISSING', message: err.message }] };
  }

  // Pre-upload validation for buffer-based files
  if (normalized.buffer) {
    const validation = await validateFile(normalized, options);
    if (!validation.valid) {
      if (throwOnError) {
        throw createErrorFromValidation(validation.errors);
      }
      return { success: false, errors: validation.errors };
    }
  } else if (normalized.stream) {
    // Stream-based: validate extension, MIME and custom validator upfront
    const upfrontValidation = await validateFile(
      {
        originalName: normalized.originalName,
        mimeType: normalized.mimeType,
        size: normalized.size,
        stream: normalized.stream
      },
      {
        allowedExtensions: options.allowedExtensions,
        allowedTypes: options.allowedTypes,
        customValidator: options.customValidator
      }
    );
    if (!upfrontValidation.valid) {
      if (throwOnError) {
        throw createErrorFromValidation(upfrontValidation.errors);
      }
      return { success: false, errors: upfrontValidation.errors };
    }
  }

  // Generate collision-resistant unique filename
  let filename = generateFilename(normalized.originalName, options.filenameOptions || options);

  // If file happens to exist, retry with additional entropy
  const targetPath = resolveSafePath(destination, filename);
  if (await fileExists(targetPath)) {
    filename = generateFilename(normalized.originalName, {
      ...(options.filenameOptions || options),
      randomBytes: 12
    });
  }

  let saveResult;
  try {
    if (normalized.buffer) {
      saveResult = await saveBufferToFile(destination, filename, normalized.buffer);
    } else if (normalized.stream) {
      saveResult = await saveStreamToFile(destination, filename, normalized.stream, {
        maxFileSize: options.maxFileSize
      });
    } else {
      throw new UploadKitError('File must contain either a buffer or a readable stream.', 'INVALID_FILE_SOURCE');
    }
  } catch (err) {
    if (throwOnError) throw err;
    return { success: false, errors: [{ code: err.code || 'STORAGE_ERROR', message: err.message }] };
  }

  const finalExt = path.extname(filename).toLowerCase();
  const detectedMime = normalized.buffer ? detectMimeFromBuffer(normalized.buffer) : null;
  const mimeType = detectedMime || normalized.mimeType || getMimeFromExtension(finalExt) || 'application/octet-stream';
  const size = saveResult.size;

  return {
    success: true,
    filename,
    originalName: normalized.originalName,
    path: saveResult.path,
    destination: path.resolve(destination),
    size,
    sizeInKB: bytesToKB(size),
    sizeInMB: bytesToMB(size),
    mimeType,
    extension: finalExt,
    createdAt: new Date().toISOString()
  };
}

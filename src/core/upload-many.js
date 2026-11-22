import fsp from 'node:fs/promises';
import { upload } from './upload.js';
import { UploadKitError } from '../errors/index.js';

/**
 * Uploads multiple files with batch limits and atomic rollback on failure.
 *
 * @param {Array<object|Buffer>} files - Array of files to upload.
 * @param {object} [options={}] - Uploader configuration.
 * @param {number} [options.maxFiles=10] - Maximum files allowed in a single batch.
 * @param {boolean} [options.rollbackOnError=true] - Whether to delete uploaded files if any file in batch fails.
 * @returns {Promise<{ success: boolean, count: number, files: Array<object> }>}
 */
export async function uploadMany(files, options = {}) {
  const throwOnError = options.throwOnError !== false;
  const rollbackOnError = options.rollbackOnError !== false;

  if (!Array.isArray(files) || files.length === 0) {
    const err = new UploadKitError('No files were provided for upload.', 'NO_FILES_PROVIDED');
    if (throwOnError) throw err;
    return { success: false, count: 0, files: [], errors: [{ code: 'NO_FILES_PROVIDED', message: err.message }] };
  }

  const maxFiles = typeof options.maxFiles === 'number' ? options.maxFiles : 10;
  if (files.length > maxFiles) {
    const err = new UploadKitError(
      `File count (${files.length}) exceeds maximum allowed batch limit of ${maxFiles}.`,
      'MAX_FILES_EXCEEDED',
      { count: files.length, maxFiles }
    );
    if (throwOnError) throw err;
    return { success: false, count: 0, files: [], errors: [{ code: 'MAX_FILES_EXCEEDED', message: err.message }] };
  }

  const uploadedResults = [];

  try {
    for (const file of files) {
      // Run each upload; passing throwOnError: true so any failure triggers catch block for rollback
      const result = await upload(file, { ...options, throwOnError: true });
      uploadedResults.push(result);
    }

    return {
      success: true,
      count: uploadedResults.length,
      files: uploadedResults
    };
  } catch (err) {
    // If rollback is enabled, remove already saved files in this batch
    if (rollbackOnError && uploadedResults.length > 0) {
      for (const uploaded of uploadedResults) {
        if (uploaded.path) {
          try {
            await fsp.unlink(uploaded.path);
          } catch {
            // Ignore rollback cleanup error
          }
        }
      }
    }

    if (throwOnError) {
      throw err;
    }

    return {
      success: false,
      count: 0,
      files: [],
      errors: [{ code: err.code || 'UPLOAD_FAILED', message: err.message }]
    };
  }
}

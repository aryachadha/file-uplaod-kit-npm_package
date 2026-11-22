import fsp from 'node:fs/promises';
import path from 'node:path';
import { resolveSafePath } from '../utils/paths.js';
import { FileNotFoundError, StorageError } from '../errors/index.js';

/**
 * Safely deletes a file from the filesystem.
 *
 * @param {string} target - Filename or path to delete.
 * @param {object} [options={}] - Deletion options.
 * @param {string} [options.baseDir] - Optional root directory to enforce boundary containment.
 * @param {boolean} [options.throwIfMissing=false] - Whether to throw FileNotFoundError if missing.
 * @returns {Promise<{ success: boolean, filename: string, path: string, code?: string, message?: string }>}
 */
export async function deleteFile(target, options = {}) {
  const { baseDir, throwIfMissing = false } = options;

  if (typeof target !== 'string' || target.trim() === '') {
    throw new StorageError('File target must be a non-empty string.');
  }

  const resolvedPath = baseDir
    ? resolveSafePath(baseDir, target)
    : path.resolve(target);

  const filename = path.basename(resolvedPath);

  try {
    await fsp.unlink(resolvedPath);
    return {
      success: true,
      filename,
      path: resolvedPath
    };
  } catch (err) {
    if (err.code === 'ENOENT') {
      if (throwIfMissing) {
        throw new FileNotFoundError(`Cannot delete non-existent file: '${filename}'`, {
          filename,
          path: resolvedPath
        });
      }
      return {
        success: false,
        code: 'FILE_NOT_FOUND',
        filename,
        path: resolvedPath,
        message: `File '${filename}' does not exist.`
      };
    }

    throw new StorageError(`Failed to delete file '${filename}': ${err.message}`, {
      filename,
      path: resolvedPath,
      originalError: err.message
    });
  }
}

/**
 * Deletes multiple files safely and returns structured batch results.
 *
 * @param {string[]} targets - Array of filenames or file paths to delete.
 * @param {object} [options={}] - Deletion options.
 * @returns {Promise<{ success: boolean, count: number, deleted: Array<object>, failed: Array<object> }>}
 */
export async function deleteMultipleFiles(targets, options = {}) {
  if (!Array.isArray(targets) || targets.length === 0) {
    return {
      success: true,
      count: 0,
      deleted: [],
      failed: []
    };
  }

  const deleted = [];
  const failed = [];

  for (const target of targets) {
    try {
      const res = await deleteFile(target, options);
      if (res.success) {
        deleted.push(res);
      } else {
        failed.push(res);
      }
    } catch (err) {
      failed.push({
        success: false,
        filename: path.basename(target),
        code: err.code || 'STORAGE_ERROR',
        message: err.message
      });
    }
  }

  return {
    success: failed.length === 0,
    count: deleted.length,
    deleted,
    failed
  };
}

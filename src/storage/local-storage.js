import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { resolveSafePath } from '../utils/paths.js';
import { StorageError, FileTooLargeError } from '../errors/index.js';

/**
 * Ensures destination directory exists.
 * @param {string} dirPath
 * @returns {Promise<string>} Absolute resolved directory path.
 */
export async function ensureDirectory(dirPath) {
  try {
    const resolved = path.resolve(dirPath);
    await fsp.mkdir(resolved, { recursive: true });
    return resolved;
  } catch (err) {
    throw new StorageError(`Failed to create or access upload directory: ${err.message}`, {
      originalError: err.message
    });
  }
}

/**
 * Checks if a file exists at the given path.
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
export async function fileExists(filePath) {
  try {
    await fsp.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely writes a buffer to disk using atomic rename.
 * Writes to a temporary file first, then atomically renames to final destination.
 *
 * @param {string} baseDir - Upload root directory.
 * @param {string} filename - Target safe filename.
 * @param {Buffer} buffer - File buffer.
 * @returns {Promise<{ path: string, size: number }>}
 */
export async function saveBufferToFile(baseDir, filename, buffer) {
  await ensureDirectory(baseDir);
  const finalPath = resolveSafePath(baseDir, filename);
  const tempPath = `${finalPath}.tmp-${crypto.randomBytes(6).toString('hex')}`;

  try {
    await fsp.writeFile(tempPath, buffer);
    await fsp.rename(tempPath, finalPath);
    return {
      path: finalPath,
      size: buffer.length
    };
  } catch (err) {
    // Clean up partial temp file if exists
    try {
      await fsp.unlink(tempPath);
    } catch {
      // Ignore cleanup error
    }
    throw new StorageError(`Failed to save file: ${err.message}`, {
      filename,
      originalError: err.message
    });
  }
}

/**
 * Safely streams data to disk with byte-limit monitoring and automatic cleanup.
 *
 * @param {string} baseDir - Upload root directory.
 * @param {string} filename - Target safe filename.
 * @param {import('node:stream').Readable} readStream - Readable stream of file data.
 * @param {object} [options={}]
 * @param {number} [options.maxFileSize] - Optional maximum allowed file size.
 * @returns {Promise<{ path: string, size: number }>}
 */
export async function saveStreamToFile(baseDir, filename, readStream, options = {}) {
  await ensureDirectory(baseDir);
  const finalPath = resolveSafePath(baseDir, filename);
  const tempPath = `${finalPath}.tmp-${crypto.randomBytes(6).toString('hex')}`;

  let bytesWritten = 0;
  const maxFileSize = options.maxFileSize;

  // Transform stream to monitor size and abort if limit exceeded
  const sizeLimiter = new Transform({
    transform(chunk, encoding, callback) {
      bytesWritten += chunk.length;
      if (typeof maxFileSize === 'number' && maxFileSize > 0 && bytesWritten > maxFileSize) {
        const limitError = new FileTooLargeError(
          `Stream exceeded the maximum allowed size of ${maxFileSize} bytes.`,
          { bytesWritten, maxFileSize }
        );
        return callback(limitError);
      }
      callback(null, chunk);
    }
  });

  const writeStream = fs.createWriteStream(tempPath);

  try {
    await pipeline(readStream, sizeLimiter, writeStream);
    await fsp.rename(tempPath, finalPath);
    return {
      path: finalPath,
      size: bytesWritten
    };
  } catch (err) {
    // Clean up temporary incomplete file
    try {
      await fsp.unlink(tempPath);
    } catch {
      // Ignore temp file cleanup error
    }

    if (err instanceof FileTooLargeError) {
      throw err;
    }

    throw new StorageError(`Stream upload failed: ${err.message}`, {
      filename,
      originalError: err.message
    });
  }
}

import fsp from 'node:fs/promises';
import path from 'node:path';
import { resolveSafePath } from '../utils/paths.js';
import { detectMimeFromBuffer, getMimeFromExtension } from '../utils/mime.js';
import { bytesToKB, bytesToMB } from '../utils/size.js';
import { FileNotFoundError, StorageError } from '../errors/index.js';

/**
 * Retrieves comprehensive metadata for a stored file.
 * Reads content signatures for reliable MIME detection instead of relying solely on extensions.
 *
 * @param {string} target - Filename or file path.
 * @param {object} [options={}] - Options.
 * @param {string} [options.baseDir] - Optional root directory to enforce boundary containment.
 * @param {boolean} [options.throwIfMissing=true] - Whether to throw FileNotFoundError if missing.
 * @returns {Promise<object>} File metadata object.
 */
export async function getFileInfo(target, options = {}) {
  const { baseDir, throwIfMissing = true } = options;

  if (typeof target !== 'string' || target.trim() === '') {
    throw new StorageError('File target must be a non-empty string.');
  }

  const resolvedPath = baseDir
    ? resolveSafePath(baseDir, target)
    : path.resolve(target);

  let stat;
  try {
    stat = await fsp.stat(resolvedPath);
  } catch (err) {
    if (err.code === 'ENOENT') {
      if (throwIfMissing) {
        throw new FileNotFoundError(`File not found: '${path.basename(resolvedPath)}'`, {
          filename: path.basename(resolvedPath)
        });
      }
      return {
        exists: false,
        filename: path.basename(resolvedPath),
        path: resolvedPath
      };
    }
    throw new StorageError(`Failed to access file metadata: ${err.message}`, {
      filename: path.basename(resolvedPath),
      originalError: err.message
    });
  }

  if (!stat.isFile()) {
    throw new StorageError(`Target '${path.basename(resolvedPath)}' is not a regular file.`);
  }

  // Inspect content signature (magic bytes) from the file head
  let detectedMime = null;
  try {
    const handle = await fsp.open(resolvedPath, 'r');
    const headerBuffer = Buffer.alloc(64);
    const { bytesRead } = await handle.read(headerBuffer, 0, 64, 0);
    await handle.close();
    if (bytesRead > 0) {
      detectedMime = detectMimeFromBuffer(headerBuffer.subarray(0, bytesRead));
    }
  } catch {
    // If reading header fails, proceed with fallback detection
  }

  const filename = path.basename(resolvedPath);
  const extension = path.extname(resolvedPath).toLowerCase();
  const mimeType = detectedMime || getMimeFromExtension(extension) || 'application/octet-stream';
  const size = stat.size;

  return {
    exists: true,
    filename,
    extension,
    mimeType,
    detectedMime,
    size,
    sizeInKB: bytesToKB(size),
    sizeInMB: bytesToMB(size),
    path: resolvedPath,
    createdAt: stat.birthtime ? stat.birthtime.toISOString() : stat.ctime.toISOString(),
    modifiedAt: stat.mtime.toISOString()
  };
}

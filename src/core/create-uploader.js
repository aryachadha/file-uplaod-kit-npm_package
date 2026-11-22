import { upload } from './upload.js';
import { uploadMany } from './upload-many.js';
import { validateFile } from './validate-file.js';
import { deleteFile, deleteMultipleFiles } from '../storage/delete-file.js';
import { getFileInfo } from '../storage/get-file-info.js';

/**
 * Creates a configurable uploader instance.
 *
 * @param {object} [config={}] - Configuration options.
 * @param {string} [config.destination='./uploads'] - Storage destination directory.
 * @param {number} [config.maxFileSize=5242880] - Maximum file size in bytes (default 5MB).
 * @param {string[]|string} [config.allowedTypes] - Allowed MIME types or patterns.
 * @param {string[]|string} [config.allowedExtensions] - Allowed file extensions.
 * @param {boolean} [config.multiple=false] - Whether multiple file uploads are expected.
 * @param {number} [config.maxFiles=10] - Maximum files allowed in multiple uploads.
 * @param {Function} [config.customValidator] - Synchronous or asynchronous custom validator.
 * @param {boolean} [config.rollbackOnError=true] - Whether to delete batch files if one fails.
 * @param {boolean} [config.throwOnError=true] - Whether to throw errors or return structured error objects.
 * @returns {object} Uploader instance with upload, uploadMany, delete, deleteMany, getInfo, and validate methods.
 */
export function createUploader(config = {}) {
  const options = {
    destination: config.destination || './uploads',
    maxFileSize: config.maxFileSize ?? 5 * 1024 * 1024,
    allowedTypes: config.allowedTypes || [],
    allowedExtensions: config.allowedExtensions || [],
    multiple: Boolean(config.multiple),
    maxFiles: config.maxFiles ?? 10,
    customValidator: config.customValidator || null,
    rollbackOnError: config.rollbackOnError ?? true,
    throwOnError: config.throwOnError ?? true,
    ...config
  };

  return {
    config: options,

    async upload(file, overrideOptions = {}) {
      return upload(file, { ...options, ...overrideOptions });
    },

    async uploadMany(files, overrideOptions = {}) {
      return uploadMany(files, { ...options, ...overrideOptions });
    },

    async delete(filename, overrideOptions = {}) {
      return deleteFile(filename, { baseDir: options.destination, ...overrideOptions });
    },

    async deleteMany(filenames, overrideOptions = {}) {
      return deleteMultipleFiles(filenames, { baseDir: options.destination, ...overrideOptions });
    },

    async getInfo(filename, overrideOptions = {}) {
      return getFileInfo(filename, { baseDir: options.destination, ...overrideOptions });
    },

    async validate(file, overrideOptions = {}) {
      return validateFile(file, { ...options, ...overrideOptions });
    }
  };
}

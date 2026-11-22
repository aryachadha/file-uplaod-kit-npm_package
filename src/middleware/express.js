import { createUploader } from '../core/create-uploader.js';
import { parseMultipartStream } from './multipart-parser.js';
import { UploadKitError } from '../errors/index.js';

/**
 * Creates an Express middleware for file upload handling.
 * Works seamlessly with zero external dependencies, while remaining fully
 * compatible with upstream multipart handlers (such as Multer memory storage).
 *
 * @param {object} [options={}] - Configuration options.
 * @param {string} [options.destination='./uploads'] - Target upload directory.
 * @param {number} [options.maxFileSize=5242880] - Maximum allowed file size in bytes.
 * @param {string[]|string} [options.allowedTypes] - Allowed MIME types.
 * @param {string[]|string} [options.allowedExtensions] - Allowed extensions.
 * @param {string} [options.fieldName] - Optional specific form field name to accept.
 * @param {boolean} [options.single=false] - Whether this route expects strictly a single file.
 * @param {boolean} [options.multiple=false] - Whether multiple files are allowed.
 * @param {number} [options.maxFiles=10] - Maximum files allowed in a single upload.
 * @param {Function} [options.customValidator] - Custom validation function.
 * @returns {Function} Express middleware (req, res, next).
 */
export function createUploadMiddleware(options = {}) {
  const uploader = createUploader(options);
  const targetFieldName = options.fieldName || null;
  const isSingle = Boolean(options.single);

  const middleware = async (req, res, next) => {
    try {
      // 1. Check if files were already pre-parsed by upstream middleware (e.g. Multer memory storage)
      if (req.file || (Array.isArray(req.files) && req.files.length > 0)) {
        if (req.file) {
          const uploaded = await uploader.upload(req.file);
          req.file = uploaded;
          req.files = [uploaded];
        } else if (Array.isArray(req.files)) {
          const uploadedBatch = await uploader.uploadMany(req.files);
          req.files = uploadedBatch.files;
          req.file = req.files[0] || null;
        }
        return next();
      }

      // 2. Check if request is a multipart stream
      const contentType = req.headers['content-type'] || req.headers['Content-Type'] || '';
      if (!contentType.toLowerCase().includes('multipart/form-data')) {
        return next();
      }

      // 3. Parse raw multipart stream using built-in parser
      const parsed = await parseMultipartStream(req, {
        maxFileSize: options.maxFileSize,
        maxTotalSize: options.maxTotalSize
      });

      // Populate text fields onto req.body
      req.body = { ...(req.body || {}), ...parsed.body };

      // Filter files by fieldName if specified
      let candidateFiles = parsed.files;
      if (targetFieldName) {
        candidateFiles = candidateFiles.filter((f) => f.fieldName === targetFieldName);
      }

      // Handle single-file mode
      if (isSingle) {
        if (candidateFiles.length > 1) {
          throw new UploadKitError(
            `Expected single file for field '${targetFieldName || 'file'}', received ${candidateFiles.length}.`,
            'TOO_MANY_FILES'
          );
        }

        if (candidateFiles.length === 1) {
          const result = await uploader.upload(candidateFiles[0]);
          req.file = result;
          req.files = [result];
        } else {
          req.file = null;
          req.files = [];
        }

        return next();
      }

      // Handle multi-file / default mode
      if (candidateFiles.length > 0) {
        const batchResult = await uploader.uploadMany(candidateFiles);
        req.files = batchResult.files;
        req.file = req.files[0] || null;
      } else {
        req.file = null;
        req.files = [];
      }

      next();
    } catch (err) {
      next(err);
    }
  };

  return middleware;
}

/**
 * Helper to create single-file upload middleware.
 * @param {string} fieldName
 * @param {object} [options={}]
 * @returns {Function} Express middleware.
 */
createUploadMiddleware.single = function (fieldName, options = {}) {
  return createUploadMiddleware({ ...options, fieldName, single: true });
};

/**
 * Helper to create multiple-files upload middleware.
 * @param {string} fieldName
 * @param {number} [maxCount=10]
 * @param {object} [options={}]
 * @returns {Function} Express middleware.
 */
createUploadMiddleware.array = function (fieldName, maxCount = 10, options = {}) {
  return createUploadMiddleware({ ...options, fieldName, maxFiles: maxCount, multiple: true });
};

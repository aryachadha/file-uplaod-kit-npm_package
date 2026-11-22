import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createUploader,
  validateFile,
  deleteFile,
  getFileInfo,
  generateFilename,
  UploadKitError,
  FileTooLargeError
} from '../src/index.js';

import { createUploadMiddleware } from '../src/middleware/express.js';

test('file-upload-kit public API exports correctly', () => {
  assert.equal(typeof createUploader, 'function');
  assert.equal(typeof validateFile, 'function');
  assert.equal(typeof deleteFile, 'function');
  assert.equal(typeof getFileInfo, 'function');
  assert.equal(typeof generateFilename, 'function');
  assert.equal(typeof createUploadMiddleware, 'function');
  assert.equal(typeof UploadKitError, 'function');
  assert.equal(typeof FileTooLargeError, 'function');
});

test('createUploader initializes with expected interface', () => {
  const uploader = createUploader({
    destination: './test-uploads',
    maxFileSize: 1024 * 1024
  });

  assert.equal(typeof uploader.upload, 'function');
  assert.equal(typeof uploader.uploadMany, 'function');
  assert.equal(typeof uploader.delete, 'function');
  assert.equal(typeof uploader.getInfo, 'function');
  assert.equal(typeof uploader.validate, 'function');
  assert.equal(uploader.config.destination, './test-uploads');
  assert.equal(uploader.config.maxFileSize, 1024 * 1024);
});

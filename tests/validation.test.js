import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFile } from '../src/index.js';

// Pre-crafted magic byte buffers for tests
const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const PDF_HEADER = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x35]);
const GIF87A_HEADER = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0x01, 0x00]);
const GIF89A_HEADER = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00]);
const WEBP_HEADER = Buffer.concat([
  Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00]),
  Buffer.from([0x57, 0x45, 0x42, 0x50])
]);
const ZIP_HEADER = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);

test('validateFile rejects missing or null file', async () => {
  const result = await validateFile(null);
  assert.equal(result.valid, false);
  assert.equal(result.errors[0].code, 'FILE_MISSING');
});

test('validateFile rejects empty files by default', async () => {
  const file = {
    originalName: 'empty.txt',
    size: 0,
    buffer: Buffer.alloc(0)
  };
  const result = await validateFile(file);
  assert.equal(result.valid, false);
  assert.equal(result.errors[0].code, 'FILE_EMPTY');
});

test('validateFile permits empty files when allowEmpty is true', async () => {
  const file = {
    originalName: 'allowed-empty.txt',
    size: 0,
    buffer: Buffer.alloc(0)
  };
  const result = await validateFile(file, { allowEmpty: true });
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test('validateFile rejects files exceeding maxFileSize', async () => {
  const file = {
    originalName: 'large.png',
    size: 10 * 1024 * 1024,
    buffer: PNG_HEADER
  };
  const result = await validateFile(file, {
    maxFileSize: 5 * 1024 * 1024
  });
  assert.equal(result.valid, false);
  assert.equal(result.errors.some((e) => e.code === 'FILE_TOO_LARGE'), true);
});

test('validateFile enforces minFileSize requirement', async () => {
  const file = {
    originalName: 'tiny.png',
    size: 50,
    buffer: PNG_HEADER
  };
  const result = await validateFile(file, {
    minFileSize: 100
  });
  assert.equal(result.valid, false);
  assert.equal(result.errors.some((e) => e.code === 'FILE_TOO_SMALL'), true);
});

test('validateFile enforces allowedExtensions case-insensitively', async () => {
  const validUpper = {
    originalName: 'PHOTO.PNG',
    size: 1024,
    buffer: PNG_HEADER
  };
  const validLower = {
    originalName: 'photo.jpg',
    size: 1024,
    buffer: JPEG_HEADER
  };
  const invalidExt = {
    originalName: 'script.sh',
    size: 1024,
    buffer: Buffer.from('#!/bin/bash')
  };

  const options = { allowedExtensions: ['.png', '.jpg'] };

  assert.equal((await validateFile(validUpper, options)).valid, true);
  assert.equal((await validateFile(validLower, options)).valid, true);
  const invalidResult = await validateFile(invalidExt, options);
  assert.equal(invalidResult.valid, false);
  assert.equal(invalidResult.errors.some((e) => e.code === 'INVALID_FILE_EXTENSION'), true);
});

test('validateFile detects MIME spoofing via magic numbers', async () => {
  // Client claims image/png, but binary content is %PDF
  const spoofedFile = {
    originalName: 'report.png',
    size: PDF_HEADER.length,
    mimeType: 'image/png',
    buffer: PDF_HEADER
  };

  const result = await validateFile(spoofedFile, {
    allowedTypes: ['image/png']
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors.some((e) => e.code === 'MIME_TYPE_MISMATCH'), true);
});

test('validateFile validates multiple binary magic formats accurately', async () => {
  const formats = [
    { name: 'image.gif', buf: GIF87A_HEADER, mime: 'image/gif' },
    { name: 'image2.gif', buf: GIF89A_HEADER, mime: 'image/gif' },
    { name: 'photo.webp', buf: WEBP_HEADER, mime: 'image/webp' },
    { name: 'archive.zip', buf: ZIP_HEADER, mime: 'application/zip' }
  ];

  for (const fmt of formats) {
    const res = await validateFile(
      { originalName: fmt.name, size: fmt.buf.length, buffer: fmt.buf },
      { allowedTypes: [fmt.mime] }
    );
    assert.equal(res.valid, true, `Failed validation for ${fmt.name}`);
  }
});

test('validateFile allows wildcard MIME types', async () => {
  const file = {
    originalName: 'photo.jpg',
    size: JPEG_HEADER.length,
    mimeType: 'image/jpeg',
    buffer: JPEG_HEADER
  };

  const result = await validateFile(file, {
    allowedTypes: ['image/*']
  });

  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test('validateFile handles custom validator exceptions gracefully', async () => {
  const file = {
    originalName: 'doc.pdf',
    size: 500,
    buffer: PDF_HEADER
  };

  const result = await validateFile(file, {
    customValidator: async () => {
      throw new Error('Database connection failed during check');
    }
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors[0].code, 'CUSTOM_VALIDATOR_ERROR');
});

test('validateFile detects duplicate filenames when existing list provided', async () => {
  const file = {
    originalName: 'existing-doc.pdf',
    size: PDF_HEADER.length,
    buffer: PDF_HEADER
  };

  const result = await validateFile(file, {
    existingFiles: ['file1.png', 'existing-doc.pdf', 'file2.jpg']
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors.some((e) => e.code === 'DUPLICATE_FILENAME'), true);
});

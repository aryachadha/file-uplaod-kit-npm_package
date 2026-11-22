import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {
  createUploader,
  getFileInfo,
  FileNotFoundError,
  SecurityError
} from '../src/index.js';

let testDir;
const PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52
]);

before(async () => {
  testDir = path.join(os.tmpdir(), `upload-kit-meta-${crypto.randomBytes(6).toString('hex')}`);
  await fsp.mkdir(testDir, { recursive: true });
});

after(async () => {
  try {
    await fsp.rm(testDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup
  }
});

test('getFileInfo returns comprehensive metadata and detects binary MIME', async () => {
  const filePath = path.join(testDir, 'image.png');
  await fsp.writeFile(filePath, PNG_BUFFER);

  const info = await getFileInfo(filePath);

  assert.equal(info.exists, true);
  assert.equal(info.filename, 'image.png');
  assert.equal(info.extension, '.png');
  assert.equal(info.size, PNG_BUFFER.length);
  assert.equal(info.sizeInKB, Number((PNG_BUFFER.length / 1024).toFixed(2)));
  assert.equal(info.mimeType, 'image/png');
  assert.equal(info.detectedMime, 'image/png');
  assert.ok(info.createdAt);
  assert.ok(info.modifiedAt);
});

test('uploader.getInfo retrieves file metadata through configured destination', async () => {
  const uploader = createUploader({ destination: testDir });
  const textContent = 'Sample document content';
  await fsp.writeFile(path.join(testDir, 'sample.txt'), textContent);

  const info = await uploader.getInfo('sample.txt');

  assert.equal(info.exists, true);
  assert.equal(info.filename, 'sample.txt');
  assert.equal(info.extension, '.txt');
  assert.equal(info.size, Buffer.byteLength(textContent));
  assert.equal(info.mimeType, 'text/plain');
});

test('uploader.getInfo prevents directory traversal attempts', async () => {
  const uploader = createUploader({ destination: testDir });

  await assert.rejects(
    async () => {
      await uploader.getInfo('../../etc/passwd');
    },
    (err) => err instanceof SecurityError && err.code === 'SECURITY_VIOLATION'
  );
});

test('getFileInfo throws FileNotFoundError for missing files when throwIfMissing is true', async () => {
  await assert.rejects(
    async () => {
      await getFileInfo(path.join(testDir, 'nonexistent.pdf'));
    },
    (err) => err instanceof FileNotFoundError && err.code === 'FILE_NOT_FOUND'
  );
});

test('getFileInfo returns structured exists:false when throwIfMissing is false', async () => {
  const info = await getFileInfo(path.join(testDir, 'nonexistent.pdf'), {
    throwIfMissing: false
  });

  assert.equal(info.exists, false);
  assert.equal(info.filename, 'nonexistent.pdf');
});

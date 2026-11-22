import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {
  createUploader,
  deleteFile,
  deleteMultipleFiles,
  FileNotFoundError,
  SecurityError
} from '../src/index.js';

let testDir;

before(async () => {
  testDir = path.join(os.tmpdir(), `upload-kit-del-${crypto.randomBytes(6).toString('hex')}`);
  await fsp.mkdir(testDir, { recursive: true });
});

after(async () => {
  try {
    await fsp.rm(testDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup
  }
});

test('deleteFile removes an existing file from disk', async () => {
  const filePath = path.join(testDir, 'delete-me.txt');
  await fsp.writeFile(filePath, 'Temporary text');

  const result = await deleteFile(filePath);
  assert.equal(result.success, true);
  assert.equal(result.filename, 'delete-me.txt');

  // Verify file no longer exists
  let exists = true;
  try {
    await fsp.access(filePath);
  } catch {
    exists = false;
  }
  assert.equal(exists, false);
});

test('uploader.delete deletes file within upload directory', async () => {
  const uploader = createUploader({ destination: testDir });
  const filename = 'user-avatar.png';
  await fsp.writeFile(path.join(testDir, filename), 'fake-png');

  const result = await uploader.delete(filename);
  assert.equal(result.success, true);
  assert.equal(result.filename, filename);

  let exists = true;
  try {
    await fsp.access(path.join(testDir, filename));
  } catch {
    exists = false;
  }
  assert.equal(exists, false);
});

test('uploader.delete rejects path traversal attempts outside destination', async () => {
  const uploader = createUploader({ destination: testDir });

  await assert.rejects(
    async () => {
      await uploader.delete('../../../etc/passwd');
    },
    (err) => err instanceof SecurityError && err.code === 'SECURITY_VIOLATION'
  );
});

test('deleteFile returns structured failure for missing file by default', async () => {
  const result = await deleteFile(path.join(testDir, 'does-not-exist.txt'));
  assert.equal(result.success, false);
  assert.equal(result.code, 'FILE_NOT_FOUND');
});

test('deleteFile throws FileNotFoundError when throwIfMissing is true', async () => {
  await assert.rejects(
    async () => {
      await deleteFile(path.join(testDir, 'does-not-exist.txt'), { throwIfMissing: true });
    },
    (err) => err instanceof FileNotFoundError
  );
});

test('uploader.deleteMany deletes multiple files and reports batch results', async () => {
  const uploader = createUploader({ destination: testDir });
  const file1 = 'batch-del-1.txt';
  const file2 = 'batch-del-2.txt';

  await fsp.writeFile(path.join(testDir, file1), '1');
  await fsp.writeFile(path.join(testDir, file2), '2');

  const result = await uploader.deleteMany([file1, file2, 'missing-file.txt']);

  assert.equal(result.count, 2);
  assert.equal(result.deleted.length, 2);
  assert.equal(result.failed.length, 1);
  assert.equal(result.failed[0].code, 'FILE_NOT_FOUND');
});

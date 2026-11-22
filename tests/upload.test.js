import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import {
  createUploader,
  FileTooLargeError,
  InvalidFileTypeError
} from '../src/index.js';

let testDir;

before(async () => {
  testDir = path.join(os.tmpdir(), `upload-kit-test-${crypto.randomBytes(6).toString('hex')}`);
  await fsp.mkdir(testDir, { recursive: true });
});

after(async () => {
  try {
    await fsp.rm(testDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup
  }
});

test('single buffer upload writes file and returns accurate metadata', async () => {
  const uploader = createUploader({
    destination: path.join(testDir, 'single-buffer'),
    maxFileSize: 1024 * 1024,
    allowedExtensions: ['.txt']
  });

  const buffer = Buffer.from('Hello world file content');
  const result = await uploader.upload({
    originalName: 'greeting.txt',
    buffer,
    mimeType: 'text/plain'
  });

  assert.equal(result.success, true);
  assert.equal(result.originalName, 'greeting.txt');
  assert.equal(result.extension, '.txt');
  assert.equal(result.size, buffer.length);
  assert.equal(result.sizeInKB, Number((buffer.length / 1024).toFixed(2)));
  assert.match(result.filename, /^greeting-[a-f0-9]{16}\.txt$/);

  // Verify file exists on disk and content matches
  const written = await fsp.readFile(result.path, 'utf8');
  assert.equal(written, 'Hello world file content');
});

test('single stream upload successfully writes stream to disk', async () => {
  const uploader = createUploader({
    destination: path.join(testDir, 'single-stream')
  });

  const streamContent = 'Streamed content line 1\nStreamed content line 2';
  const stream = Readable.from(Buffer.from(streamContent));

  const result = await uploader.upload({
    originalName: 'streamed.txt',
    stream,
    mimeType: 'text/plain'
  });

  assert.equal(result.success, true);
  assert.equal(result.size, Buffer.byteLength(streamContent));

  const written = await fsp.readFile(result.path, 'utf8');
  assert.equal(written, streamContent);
});

test('stream upload exceeding maxFileSize aborts and cleans up partial file', async () => {
  const dest = path.join(testDir, 'stream-oversize');
  const uploader = createUploader({
    destination: dest,
    maxFileSize: 50 // Limit to 50 bytes
  });

  // Create stream of 1000 bytes
  const bigChunk = Buffer.alloc(1000, 'A');
  const stream = Readable.from(bigChunk);

  await assert.rejects(
    async () => {
      await uploader.upload({
        originalName: 'overflow.dat',
        stream
      });
    },
    (err) => err instanceof FileTooLargeError && err.code === 'FILE_TOO_LARGE'
  );

  // Verify no orphaned files or temp files remain in dest
  const files = await fsp.readdir(dest);
  assert.equal(files.length, 0);
});

test('buffer upload rejects invalid file extension with InvalidFileTypeError', async () => {
  const uploader = createUploader({
    destination: path.join(testDir, 'extension-reject'),
    allowedExtensions: ['.png', '.jpg']
  });

  await assert.rejects(
    async () => {
      await uploader.upload({
        originalName: 'malicious.exe',
        buffer: Buffer.from('binary-content')
      });
    },
    (err) => err instanceof InvalidFileTypeError && err.code === 'INVALID_FILE_TYPE'
  );
});

test('upload with throwOnError=false returns structured error instead of throwing', async () => {
  const uploader = createUploader({
    destination: path.join(testDir, 'no-throw'),
    maxFileSize: 10,
    throwOnError: false
  });

  const result = await uploader.upload({
    originalName: 'big.txt',
    buffer: Buffer.alloc(500)
  });

  assert.equal(result.success, false);
  assert.equal(result.errors[0].code, 'FILE_TOO_LARGE');
});

test('uploadMany uploads multiple files successfully', async () => {
  const uploader = createUploader({
    destination: path.join(testDir, 'batch-success'),
    maxFiles: 5
  });

  const files = [
    { originalName: 'doc1.txt', buffer: Buffer.from('doc 1 content') },
    { originalName: 'doc2.txt', buffer: Buffer.from('doc 2 content') },
    { originalName: 'doc3.txt', buffer: Buffer.from('doc 3 content') }
  ];

  const batchResult = await uploader.uploadMany(files);

  assert.equal(batchResult.success, true);
  assert.equal(batchResult.count, 3);
  assert.equal(batchResult.files.length, 3);

  for (const f of batchResult.files) {
    const exists = await fsp.stat(f.path);
    assert.equal(exists.isFile(), true);
  }
});

test('uploadMany rejects batch if file count exceeds maxFiles', async () => {
  const uploader = createUploader({
    destination: path.join(testDir, 'batch-limit'),
    maxFiles: 2
  });

  const files = [
    { originalName: 'f1.txt', buffer: Buffer.from('1') },
    { originalName: 'f2.txt', buffer: Buffer.from('2') },
    { originalName: 'f3.txt', buffer: Buffer.from('3') }
  ];

  await assert.rejects(
    async () => {
      await uploader.uploadMany(files);
    },
    (err) => err.code === 'MAX_FILES_EXCEEDED'
  );
});

test('uploadMany rolls back already-uploaded files if subsequent file fails', async () => {
  const dest = path.join(testDir, 'batch-rollback');
  const uploader = createUploader({
    destination: dest,
    maxFileSize: 50,
    rollbackOnError: true
  });

  const files = [
    { originalName: 'valid.txt', buffer: Buffer.from('small content') },
    { originalName: 'oversize.txt', buffer: Buffer.alloc(500, 'Z') } // will fail size check
  ];

  await assert.rejects(
    async () => {
      await uploader.uploadMany(files);
    },
    (err) => err instanceof FileTooLargeError
  );

  // Dest directory should have 0 files because 'valid.txt' was rolled back (deleted)
  const filesOnDisk = await fsp.readdir(dest);
  assert.equal(filesOnDisk.length, 0);
});

test('concurrent uploads do not conflict or corrupt filenames', async () => {
  const dest = path.join(testDir, 'concurrent');
  const uploader = createUploader({ destination: dest });

  const uploads = Array.from({ length: 20 }, (_, i) =>
    uploader.upload({
      originalName: 'same-name.txt',
      buffer: Buffer.from(`Content of file ${i}`)
    })
  );

  const results = await Promise.all(uploads);
  assert.equal(results.length, 20);

  const filenames = new Set(results.map((r) => r.filename));
  assert.equal(filenames.size, 20);

  const diskFiles = await fsp.readdir(dest);
  assert.equal(diskFiles.length, 20);
});

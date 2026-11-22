import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { createUploadMiddleware } from '../src/middleware/express.js';
import { FileTooLargeError, InvalidFileTypeError } from '../src/index.js';

let testDir;

before(async () => {
  testDir = path.join(os.tmpdir(), `upload-kit-express-${crypto.randomBytes(6).toString('hex')}`);
  await fsp.mkdir(testDir, { recursive: true });
});

after(async () => {
  try {
    await fsp.rm(testDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup
  }
});

function createMultipartPayload(boundary, parts) {
  const chunks = [];
  for (const part of parts) {
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    if (part.filename) {
      chunks.push(
        Buffer.from(
          `Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"\r\nContent-Type: ${part.contentType || 'application/octet-stream'}\r\n\r\n`
        )
      );
      chunks.push(part.content);
    } else {
      chunks.push(Buffer.from(`Content-Disposition: form-data; name="${part.name}"\r\n\r\n`));
      chunks.push(Buffer.from(String(part.value)));
    }
    chunks.push(Buffer.from('\r\n'));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return Buffer.concat(chunks);
}

function createMockReq(headers, payloadBuffer) {
  const stream = Readable.from(payloadBuffer);
  stream.headers = headers;
  stream.body = {};
  return stream;
}

test('createUploadMiddleware handles single file upload and text fields', async () => {
  const dest = path.join(testDir, 'express-single');
  const middleware = createUploadMiddleware({
    destination: dest,
    fieldName: 'avatar',
    single: true
  });

  const boundary = '----BoundaryExpressSingleTest';
  const fileContent = Buffer.from('Avatar image content');
  const payload = createMultipartPayload(boundary, [
    { name: 'username', value: 'alice' },
    { name: 'avatar', filename: 'alice.png', contentType: 'image/png', content: fileContent }
  ]);

  const req = createMockReq(
    { 'content-type': `multipart/form-data; boundary=${boundary}` },
    payload
  );
  const res = {};

  let nextCalled = false;
  await middleware(req, res, (err) => {
    assert.equal(err, undefined);
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(req.body.username, 'alice');
  assert.equal(req.file.originalName, 'alice.png');
  assert.equal(req.file.extension, '.png');
  assert.equal(req.file.size, fileContent.length);

  // Verify file was written to disk
  const onDisk = await fsp.readFile(req.file.path);
  assert.deepEqual(onDisk, fileContent);
});

test('createUploadMiddleware handles multiple files upload', async () => {
  const dest = path.join(testDir, 'express-multi');
  const middleware = createUploadMiddleware({
    destination: dest
  });

  const boundary = '----BoundaryExpressMultiTest';
  const file1 = Buffer.from('Document 1');
  const file2 = Buffer.from('Document 2');

  const payload = createMultipartPayload(boundary, [
    { name: 'docs', filename: 'doc1.txt', contentType: 'text/plain', content: file1 },
    { name: 'docs', filename: 'doc2.txt', contentType: 'text/plain', content: file2 }
  ]);

  const req = createMockReq(
    { 'content-type': `multipart/form-data; boundary=${boundary}` },
    payload
  );
  const res = {};

  let nextCalled = false;
  await middleware(req, res, (err) => {
    assert.equal(err, undefined);
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(req.files.length, 2);
  assert.equal(req.file.originalName, 'doc1.txt');
  assert.equal(req.files[1].originalName, 'doc2.txt');

  // Verify both exist on disk
  const disk1 = await fsp.readFile(req.files[0].path);
  const disk2 = await fsp.readFile(req.files[1].path);
  assert.deepEqual(disk1, file1);
  assert.deepEqual(disk2, file2);
});

test('createUploadMiddleware passes validation errors to next(err)', async () => {
  const dest = path.join(testDir, 'express-errors');
  const middleware = createUploadMiddleware({
    destination: dest,
    maxFileSize: 20, // 20 bytes limit
    allowedExtensions: ['.png']
  });

  const boundary = '----BoundaryExpressErrorTest';
  const oversizedPayload = createMultipartPayload(boundary, [
    { name: 'file', filename: 'large.png', contentType: 'image/png', content: Buffer.alloc(100, 'A') }
  ]);

  const req = createMockReq(
    { 'content-type': `multipart/form-data; boundary=${boundary}` },
    oversizedPayload
  );
  const res = {};

  let capturedError = null;
  await middleware(req, res, (err) => {
    capturedError = err;
  });

  assert.ok(capturedError instanceof FileTooLargeError);
  assert.equal(capturedError.code, 'FILE_TOO_LARGE');
});

test('createUploadMiddleware rejects unexpected extensions via next(err)', async () => {
  const dest = path.join(testDir, 'express-ext-error');
  const middleware = createUploadMiddleware({
    destination: dest,
    allowedExtensions: ['.jpg', '.png']
  });

  const boundary = '----BoundaryExpressExtTest';
  const badExtPayload = createMultipartPayload(boundary, [
    { name: 'file', filename: 'script.sh', contentType: 'text/x-shellscript', content: Buffer.from('echo 1') }
  ]);

  const req = createMockReq(
    { 'content-type': `multipart/form-data; boundary=${boundary}` },
    badExtPayload
  );
  const res = {};

  let capturedError = null;
  await middleware(req, res, (err) => {
    capturedError = err;
  });

  assert.ok(capturedError instanceof InvalidFileTypeError);
  assert.equal(capturedError.code, 'INVALID_FILE_TYPE');
});

test('createUploadMiddleware adapts pre-parsed Multer memory storage files', async () => {
  const dest = path.join(testDir, 'express-multer-compat');
  const middleware = createUploadMiddleware({
    destination: dest
  });

  const buffer = Buffer.from('Multer memory buffer');
  const req = {
    headers: {},
    file: {
      originalname: 'multer-file.txt',
      mimetype: 'text/plain',
      buffer
    }
  };

  let nextCalled = false;
  await middleware(req, {}, (err) => {
    assert.equal(err, undefined);
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(req.file.success, true);
  assert.equal(req.file.originalName, 'multer-file.txt');
  assert.equal(req.file.extension, '.txt');
  assert.equal(req.file.size, buffer.length);
});

test('createUploadMiddleware ignores non-multipart requests safely', async () => {
  const middleware = createUploadMiddleware({ destination: testDir });
  const req = {
    headers: { 'content-type': 'application/json' },
    body: { name: 'test' }
  };

  let called = false;
  await middleware(req, {}, (err) => {
    assert.equal(err, undefined);
    called = true;
  });

  assert.equal(called, true);
  assert.equal(req.file, undefined);
});

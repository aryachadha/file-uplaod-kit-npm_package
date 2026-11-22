import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fsp from 'node:fs/promises';
import os from 'node:os';
import crypto from 'node:crypto';
import {
  createUploader,
  resolveSafePath,
  sanitizeBaseName,
  SecurityError,
  InvalidFilenameError,
  InvalidFileTypeError
} from '../src/index.js';

let testDir;

before(async () => {
  testDir = path.join(os.tmpdir(), `upload-kit-sec-${crypto.randomBytes(6).toString('hex')}`);
  await fsp.mkdir(testDir, { recursive: true });
});

after(async () => {
  try {
    await fsp.rm(testDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup
  }
});

test('resolveSafePath resolves valid relative path within base directory', () => {
  const baseDir = '/var/app/uploads';
  const safe = resolveSafePath(baseDir, 'user-files/avatar.png');
  assert.equal(safe, path.resolve('/var/app/uploads/user-files/avatar.png'));
});

test('resolveSafePath throws SecurityError on directory traversal attempt', () => {
  const baseDir = '/var/app/uploads';

  assert.throws(
    () => resolveSafePath(baseDir, '../../etc/passwd'),
    (err) => err instanceof SecurityError && err.code === 'SECURITY_VIOLATION'
  );

  assert.throws(
    () => resolveSafePath(baseDir, 'images/../../../shadow'),
    (err) => err instanceof SecurityError
  );
});

test('resolveSafePath rejects null byte injection in paths', () => {
  const baseDir = '/var/app/uploads';
  assert.throws(
    () => resolveSafePath(baseDir, 'avatar.png\0.exe'),
    (err) => err instanceof SecurityError
  );
});

test('sanitizeBaseName strips directory paths and control characters', () => {
  assert.equal(sanitizeBaseName('/etc/passwd'), 'passwd');
  assert.equal(sanitizeBaseName('C:\\Windows\\System32\\cmd.exe'), 'cmd.exe');
  assert.equal(sanitizeBaseName('safe-file.pdf'), 'safe-file.pdf');
});

test('sanitizeBaseName rejects empty names or dot-only names', () => {
  assert.throws(
    () => sanitizeBaseName('.'),
    (err) => err instanceof InvalidFilenameError
  );
  assert.throws(
    () => sanitizeBaseName('..'),
    (err) => err instanceof InvalidFilenameError
  );
  assert.throws(
    () => sanitizeBaseName('   '),
    (err) => err instanceof InvalidFilenameError
  );
});

test('upload rejects null byte injection in originalName', async () => {
  const uploader = createUploader({ destination: path.join(testDir, 'nullbyte') });

  await assert.rejects(
    async () => {
      await uploader.upload({
        originalName: 'innocent.png\0.exe',
        buffer: Buffer.from('malicious payload')
      });
    },
    (err) => err instanceof InvalidFilenameError && err.code === 'INVALID_FILENAME'
  );
});

test('upload strictly confines path traversal originalName inside destination directory', async () => {
  const dest = path.join(testDir, 'traversal-confinement');
  const uploader = createUploader({ destination: dest });

  const result = await uploader.upload({
    originalName: '../../../../etc/shadow.txt',
    buffer: Buffer.from('confined content')
  });

  assert.equal(result.success, true);
  // Ensure the resolved file path starts with the destination directory
  assert.ok(result.path.startsWith(path.resolve(dest)));
  // Ensure the generated filename does not contain ../ or slashes
  assert.equal(result.filename.includes('..'), false);
  assert.equal(result.filename.includes('/'), false);
  assert.equal(result.filename.includes('\\'), false);
});

test('upload sanitizes XSS and command injection characters in filename', async () => {
  const dest = path.join(testDir, 'xss-sanitize');
  const uploader = createUploader({ destination: dest });

  const result = await uploader.upload({
    originalName: '<script>alert("hack")</script>;rm -rf /;.png',
    buffer: Buffer.from('xss test')
  });

  assert.equal(result.success, true);
  assert.equal(result.filename.includes('<'), false);
  assert.equal(result.filename.includes('>'), false);
  assert.equal(result.filename.includes(';'), false);
  assert.match(result.filename, /^[a-z0-9.-]+\.png$/);
});

test('double extension attack is properly blocked by extension validator', async () => {
  const dest = path.join(testDir, 'double-ext');
  const uploader = createUploader({
    destination: dest,
    allowedExtensions: ['.pdf', '.png']
  });

  // An attacker names the file report.pdf.exe pretending it is a PDF
  await assert.rejects(
    async () => {
      await uploader.upload({
        originalName: 'report.pdf.exe',
        buffer: Buffer.from('executable binary')
      });
    },
    (err) => err instanceof InvalidFileTypeError && err.code === 'INVALID_FILE_TYPE'
  );
});

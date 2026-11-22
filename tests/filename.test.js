import test from 'node:test';
import assert from 'node:assert/strict';
import { generateFilename, slugify } from '../src/index.js';

test('slugify transforms strings into filesystem-safe slugs', () => {
  assert.equal(slugify('Profile Picture 2026!'), 'profile-picture-2026');
  assert.equal(slugify('résumé_final--v2..pdf'), 'resume-final-v2.pdf');
  assert.equal(slugify('   hello   world   '), 'hello-world');
  assert.equal(slugify('Special@#$%^&*Chars'), 'specialchars');
});

test('generateFilename produces unique safe filename with original slug and extension', () => {
  const result = generateFilename('profile picture.png');
  assert.match(result, /^profile-picture-[a-f0-9]{16}\.png$/);
});

test('generateFilename handles filenames without extension', () => {
  const result = generateFilename('notes');
  assert.match(result, /^notes-[a-f0-9]{16}$/);
});

test('generateFilename strips path traversal segments from input', () => {
  const result = generateFilename('../../secrets/passwd.txt');
  assert.match(result, /^passwd-[a-f0-9]{16}\.txt$/);
  assert.equal(result.includes('..'), false);
  assert.equal(result.includes('/'), false);
  assert.equal(result.includes('\\'), false);
});

test('generateFilename supports custom prefix and suffix', () => {
  const result = generateFilename('avatar.jpg', {
    prefix: 'user-123',
    suffix: 'thumb'
  });
  assert.match(result, /^user-123-avatar-thumb-[a-f0-9]{16}\.jpg$/);
});

test('generateFilename supports custom strategy callback', () => {
  const result = generateFilename('document.pdf', {
    strategy: (orig, { ext, uniqueId }) => `custom-${uniqueId}${ext}`
  });
  assert.match(result, /^custom-[a-f0-9]{16}\.pdf$/);
});

test('generateFilename ensures collision resistance over 1000 iterations', () => {
  const set = new Set();
  for (let i = 0; i < 1000; i++) {
    const name = generateFilename('photo.jpg');
    assert.equal(set.has(name), false);
    set.add(name);
  }
  assert.equal(set.size, 1000);
});

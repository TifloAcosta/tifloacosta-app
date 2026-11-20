import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const music = readFileSync(new URL('../Sources/NativeMyMusic.swift', import.meta.url), 'utf8');

test('failed multi-file music imports restore library memory and remove newly copied audio', () => {
  const importer = music.slice(music.indexOf('func importFiles(_ urls: [URL])'), music.indexOf('func importFolder(_ folder: URL)'));
  assert.match(importer, /let previousFiles = files/);
  assert.match(importer, /var copiedDestinations: \[URL\] = \[\]/);
  assert.match(importer, /copiedDestinations\.append\(target\)/);
  assert.match(importer, /files = previousFiles/);
  assert.match(importer, /copiedDestinations\.forEach\s*\{/);
  assert.match(importer, /FileManager\.default\.removeItem\(at:/);
});

test('the importer does not publish success until the library index is saved', () => {
  const importer = music.slice(music.indexOf('func importFiles(_ urls: [URL])'), music.indexOf('func importFolder(_ folder: URL)'));
  assert.ok(importer.indexOf('try save()') < importer.indexOf('Task { await refreshAlbumMetadata'));
});

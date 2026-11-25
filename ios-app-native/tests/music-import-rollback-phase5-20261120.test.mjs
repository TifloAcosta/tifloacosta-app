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

test('La identificación local conserva el archivo de la biblioteca hasta guardar el nuevo nombre', () => {
  const audio = music.slice(music.indexOf('private func refreshAlbumMetadata'), music.indexOf('func importFiles'));
  assert.match(audio, /commonIdentifierTitle/);
  assert.match(audio, /commonIdentifierArtist/);
  assert.match(audio, /try saveTracks\(\)[\s\S]*?files\[index\] = previous[\s\S]*?removeItem\(at: original\)/);
  assert.match(audio, /try FileManager\.default\.linkItem\(at: source, to: candidate\)/);
  assert.match(audio, /CocoaError\.fileWriteFileExists/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const browser = readFileSync(new URL('../Sources/NativeCloudFolderBrowserScreen.swift', import.meta.url), 'utf8');
const music = readFileSync(new URL('../Sources/NativeMyMusic.swift', import.meta.url), 'utf8');

test('shared folder browser supports Dropbox and future OneDrive without music dependencies', () => {
  assert.match(browser, /let provider: NativeCloudProvider/);
  assert.match(browser, /func loadFolder\(/);
  assert.match(browser, /listFolder\(id:/);
  assert.match(browser, /nextCursor/);
  assert.match(browser, /func importItem\(/);
  assert.doesNotMatch(browser, /NativeMusicLibrary|NativeMyMusicScreen/);
});

test('Dropbox is available as an optional provider in Mi música', () => {
  assert.match(music, /NativeCloudFolderBrowserScreen\(provider: \.dropbox/);
  assert.match(music, /library\.importFiles\(\[file\]\)/);
});

test('OneDrive remains available in the shared implementation but is hidden from this release', () => {
  assert.doesNotMatch(music, /NativeCloudFolderBrowserScreen\(provider: \.oneDrive/);
  assert.match(browser, /validAccessToken\(for: provider\)/);
});

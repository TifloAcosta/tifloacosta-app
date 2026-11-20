import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const browser = readFileSync(new URL('../Sources/NativeCloudGooglePickerScreen.swift', import.meta.url), 'utf8');
const music = readFileSync(new URL('../Sources/NativeMyMusic.swift', import.meta.url), 'utf8');
const cloud = readFileSync(new URL('../Sources/NativeCloudStorage.swift', import.meta.url), 'utf8');

test('Google Drive has an accessible selection entry in Mi música', () => {
  assert.match(music, /NativeCloudGooglePickerScreen/);
  assert.match(browser, /selectGoogleDriveFiles\(\)/);
  assert.match(browser, /accessibilityLabel/);
  assert.match(browser, /download\(item\)/);
});

test('downloaded audio retains its title and is imported through existing library', () => {
  assert.match(music, /library\.importFiles\(\[file\]\)/);
  assert.match(cloud, /item\.name as NSString/);
  assert.match(cloud, /appendingPathComponent\(UUID\(\)\.uuidString, isDirectory: true\)/);
});

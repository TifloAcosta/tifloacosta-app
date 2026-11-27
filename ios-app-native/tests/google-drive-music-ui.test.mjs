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
  assert.match(browser, /download\(item, allowsCellular: allowCellular\)/);
});

test('downloaded audio retains its title and is imported through existing library', () => {
  assert.match(music, /library\.importFiles\(\[file\]\)/);
  assert.match(cloud, /item\.name as NSString/);
  assert.match(cloud, /appendingPathComponent\(UUID\(\)\.uuidString, isDirectory: true\)/);
});


test('Google Drive discards selection and downloads from invalidated account sessions', () => {
  const account = readFileSync(new URL('../Sources/NativeCloudAccount.swift', import.meta.url), 'utf8');
  assert.ok(account.includes('let ids = Array(pickedGoogleDriveIDs.prefix(100))'));
  assert.ok(account.includes('guard revisions[.googleDrive] == revision, connected.contains(.googleDrive) else'));
  assert.ok(browser.includes('selectionRevision = revision'));
  assert.ok(browser.includes('guard let revision = selectionRevision, accounts.connected.contains(.googleDrive)'));
  const download = browser.slice(browser.indexOf('let file = try await cloud.download'));
  assert.ok(download.indexOf('accounts.sessionRevision(for: .googleDrive) == revision') < download.indexOf('if let onImportValidated'));
  assert.ok(download.includes('try? FileManager.default.removeItem(at: file.deletingLastPathComponent())'));
});

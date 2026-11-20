import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const account = readFileSync(new URL('../Sources/NativeCloudAccount.swift', import.meta.url), 'utf8');

test('Google Drive opens its official Picker with the narrow drive.file scope', () => {
  assert.match(account, /trigger_onepick/);
  assert.match(account, /prompt/);
  assert.match(account, /consent/);
  assert.match(account, /picked_file_ids/);
  assert.match(account, /https:\/\/www\.googleapis\.com\/auth\/drive\.file/);
  assert.doesNotMatch(account, /auth\/drive\.readonly/);
});

test('Google Picker returns selections to a global interface not tied to music', () => {
  assert.match(account, /func selectGoogleDriveFiles\(\) async throws -> \[NativeCloudItem\]/);
  assert.match(account, /googleDriveSelection\(id:/);
  assert.doesNotMatch(account, /NativeMusicLibrary/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const cloud = readFileSync(new URL('../Sources/NativeCloudStorage.swift', import.meta.url), 'utf8');

test('cloud adapters share one folder listing contract for the three approved providers', () => {
  assert.match(cloud, /enum NativeCloudProvider/);
  for (const provider of ['googleDrive', 'dropbox', 'oneDrive']) assert.match(cloud, new RegExp(`\\b${provider}\\b`));
  assert.doesNotMatch(cloud, /case mega\b/i);
  assert.match(cloud, /func listFolder\(id: String\?, cursor: String\? = nil\) async throws -> NativeCloudPage/);
  assert.match(cloud, /nextCursor: String\?/);
});

test('remote files use only official HTTPS endpoints and bearer tokens stay in request headers', () => {
  for (const host of ['www.googleapis.com', 'api.dropboxapi.com', 'content.dropboxapi.com', 'graph.microsoft.com']) {
    assert.ok(cloud.includes(`https://${host}`), host);
  }
  assert.ok(cloud.includes('setValue("Bearer \\(accessToken)"'));
  assert.doesNotMatch(cloud, /UserDefaults|print\(|NSLog\(/);
  assert.match(cloud, /func download\(_ item: NativeCloudItem, allowsCellular: Bool = true\) async throws -> URL/);
  assert.match(cloud, /response\.url\?\.scheme == "https"/);
});

test('cloud downloads apply a hard size limit and never derive a local path from the remote name', () => {
  assert.match(cloud, /maximumAudioBytes = 250 \* 1_024 \* 1_024/);
  assert.match(cloud, /UUID\(\)\.uuidString/);
  assert.match(cloud, /remoteId/);
  assert.match(cloud, /urlPathAllowed\.subtracting\(CharacterSet\(charactersIn: "\/\?#%"\)\)/);
});

test('OneDrive content redirects must drop authorization before following HTTPS download URLs', () => {
  assert.match(cloud, /willPerformHTTPRedirection/);
  assert.match(cloud, /redirected\.setValue\(nil, forHTTPHeaderField: "Authorization"\)/);
  assert.match(cloud, /allowDownloadHost: provider == \.oneDrive/);
});

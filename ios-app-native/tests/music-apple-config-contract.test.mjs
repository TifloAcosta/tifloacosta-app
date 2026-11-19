import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('Mi Música requests explicit Apple Music library access', () => {
  const plist = read('../Sources/Info.plist');
  assert.match(plist, /<key>NSAppleMusicUsageDescription<\/key>\s*<string>[^<]+<\/string>/);
});

test('the iOS app never ships the private media key', () => {
  const project = read('../project.yml');
  const plist = read('../Sources/Info.plist');
  assert.doesNotMatch(project + plist, /AuthKey_|\.p8|797GXW393D|PRIVATE_KEY/);
});

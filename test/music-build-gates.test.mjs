import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Mi Música isolated branch triggers native compilation without publishing', () => {
  const ios = readFileSync(new URL('../.github/workflows/ios-native-swiftui-build.yml', import.meta.url), 'utf8');
  const android = readFileSync(new URL('../.github/workflows/android-native-prototype.yml', import.meta.url), 'utf8');
  const upload = readFileSync(new URL('../.github/workflows/ios-native-testflight-upload.yml', import.meta.url), 'utf8');
  assert.match(ios, /feature\/mi-musica/);
  assert.match(android, /feature\/mi-musica/);
  assert.match(upload, /workflow_dispatch:/);
  assert.doesNotMatch(upload, /^  push:/m);
});

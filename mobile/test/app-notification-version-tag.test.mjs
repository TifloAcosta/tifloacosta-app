import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const appSource = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');

test('composition root forwards the installed Android version to OneSignal after loading app info', () => {
  const loadIndex = appSource.indexOf('loadAppInfo(App).then(info => {');
  assert.notEqual(loadIndex, -1);
  const nearby = appSource.slice(loadIndex, loadIndex + 500);
  assert.match(nearby, /oneSignalClient\.setAppVersion\?\.\(info\.version\)/);
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createNotificationService } from '../src/native/notifications.mjs';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('notification status can be checked without requesting permission', async () => {
  const calls = [];
  const service = createNotificationService({
    status: async () => { calls.push('status'); return 'not-requested'; },
    request: async () => { calls.push('request'); return 'authorized'; },
    openSettings: async () => { calls.push('settings'); }
  });

  assert.equal(await service.status(), 'not-requested');
  assert.deepEqual(calls, ['status']);
});

test('permission is requested only from the explicit user-action method', async () => {
  const calls = [];
  const service = createNotificationService({
    status: async () => 'not-requested',
    request: async () => { calls.push('request'); return 'authorized'; },
    openSettings: async () => {}
  });

  assert.equal(await service.requestFromUserAction(), 'authorized');
  assert.deepEqual(calls, ['request']);
});

test('denied users can be sent to system settings through an explicit action', async () => {
  let opened = 0;
  const service = createNotificationService({
    status: async () => 'denied',
    request: async () => 'denied',
    openSettings: async () => { opened += 1; return true; }
  });

  assert.equal(await service.openSystemSettings(), true);
  assert.equal(opened, 1);
});

test('missing native notification adapter stays unavailable and never throws', async () => {
  const service = createNotificationService(null);
  assert.equal(await service.status(), 'unavailable');
  assert.equal(await service.requestFromUserAction(), 'unavailable');
  assert.equal(await service.openSystemSettings(), false);
});

test('settings exposes explicit notification controls and bilingual explanatory text', async () => {
  const [settings, i18n] = await Promise.all([
    read('src/screens/settings.mjs'),
    read('src/core/i18n.mjs')
  ]);
  assert.match(settings, /notificationService\.status\(\)/);
  assert.match(settings, /requestFromUserAction\(\)/);
  assert.match(settings, /openSystemSettings\(\)/);
  assert.match(settings, /addEventListener\(['"]click['"]/);
  for (const key of ['notifications.title', 'notifications.explanation', 'notifications.activate', 'notifications.openSettings']) {
    const leaf = key.split('.').at(-1);
    assert.match(i18n, new RegExp(`${leaf}:`));
  }
  assert.doesNotMatch(settings, /autofocus/i);
});

test('settings refreshes notification state after returning from Android system settings without moving focus', async () => {
  const [settings, app] = await Promise.all([
    read('src/screens/settings.mjs'),
    read('src/app.mjs')
  ]);
  assert.match(settings, /onAppResume/);
  assert.match(settings, /renderState\(\)/);
  assert.match(settings, /setScreenCleanup/);
  assert.match(app, /App\.addListener\(['"]resume['"]/);
  assert.match(app, /onAppResume/);
  assert.doesNotMatch(settings, /\.focus\(/);
  assert.doesNotMatch(settings, /autofocus/i);
});

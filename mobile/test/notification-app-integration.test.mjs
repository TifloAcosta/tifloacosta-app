import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('production app never wires notifications to a null adapter', async () => {
  const source = await read('src/app.mjs');
  assert.doesNotMatch(source, /createNotificationService\(null\)/);
  assert.match(source, /createOneSignalNotifications/);
});

test('app initializes OneSignal and sends clicks through a startup coordinator', async () => {
  const source = await read('src/app.mjs');
  assert.match(source, /OneSignal/);
  assert.match(source, /createOneSignalNotifications/);
  assert.match(source, /createNotificationCoordinator/);
  assert.match(source, /createNotificationRouter/);
  assert.match(source, /notificationClient\.start\(\)/);
  assert.match(source, /notificationCoordinator\.markReady\(\)/);
});

test('notification routes reuse existing reader video resource and download actions', async () => {
  const source = await read('src/app.mjs');
  assert.match(source, /openActualidadNews|openReadableFromApp/);
  assert.match(source, /openDirectVideo/);
  assert.match(source, /nativeActions\.openExternal/);
  assert.match(source, /openNormalDownload/);
});

test('OneSignal uses the existing TifloAcosta app id and production notification service wraps its adapter', async () => {
  const source = await read('src/app.mjs');
  assert.match(source, /ed030723-7f6f-4745-8cd3-6938a9d04377/);
  assert.match(source, /createNotificationService\(notificationClient\.adapter\)/);
});

import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('PushAlert migration removes OneSignal and preserves the accessible in-app notification controls', async () => {
  const html = await read('index.html');
  const app = await read('app.js');
  const notifications = await read('notifications.js');
  const worker = await read('sw.js');
  const config = await read('pushalert-config.js');
  const providerWorker = await read('pushalert-worker.js');

  assert.doesNotMatch(html, /onesignal/i);
  assert.doesNotMatch(app, /onesignal/i);
  assert.doesNotMatch(notifications, /onesignal/i);

  assert.match(html, /pushalert-config\.js/);
  assert.match(html, /notifications\.js/);
  assert.match(html, /PushAlert/);

  assert.match(notifications, /disableAutoInit/);
  assert.match(notifications, /getSubsInfo/);
  assert.match(notifications, /forceSubscribe/);
  assert.match(notifications, /unsubscribe/);
  assert.match(notifications, /integrationScriptUrl/);

  assert.match(worker, /importScripts\('\.\/pushalert-worker\.js'\)/);
  assert.match(config, /TIFLO_PUSHALERT_CONFIG/);
  assert.match(providerWorker, /PUSHALERT_WORKER_NOT_CONFIGURED/);
  await assert.rejects(access(new URL('../push/onesignal/OneSignalSDKWorker.js', import.meta.url)));
});

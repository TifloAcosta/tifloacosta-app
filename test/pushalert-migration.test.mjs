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


test('PushAlert sending is queued through GitHub without exposing the API key in public files', async () => {
  const sender = await read('scripts/send-pushalert.mjs');
  const workflow = await read('.github/workflows/send-pushalert.yml');
  const config = await read('pushalert-config.js');

  assert.match(sender, /https:\/\/api\.pushalert\.co\/rest\/v2\/web-push\/send/);
  assert.match(sender, /PUSHALERT_API_KEY/);
  assert.match(sender, /title/);
  assert.match(sender, /message/);
  assert.match(sender, /url/);
  assert.match(workflow, /push\/queue\/\*\.json/);
  assert.match(workflow, /--diff-filter=A/);
  assert.match(workflow, /secrets\.PUSHALERT_API_KEY/);
  assert.doesNotMatch(config, /api[_-]?key/i);
});

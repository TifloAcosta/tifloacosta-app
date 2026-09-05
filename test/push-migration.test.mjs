import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('TifloAcosta web push is migrated from OneSignal to Webpushr using the existing PWA worker', async () => {
  const html = await read('index.html');
  const notifications = await read('notifications.js');
  const worker = await read('sw.js');

  assert.doesNotMatch(html, /onesignal/i);
  assert.doesNotMatch(notifications, /onesignal/i);
  assert.match(notifications, /cdn\.webpushr\.com\/app\.min\.js/);
  assert.match(notifications, /webpushr\('setup',[\s\S]*['"]sw['"]\s*:\s*['"]none['"]/);
  assert.match(worker, /importScripts\(['"]https:\/\/cdn\.webpushr\.com\/sw-server\.min\.js['"]\)/);
  assert.match(html, /Webpushr/);
  await assert.rejects(access(new URL('../push/onesignal/OneSignalSDKWorker.js', import.meta.url)));
});

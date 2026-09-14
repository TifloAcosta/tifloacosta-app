import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const core = require('../videos-core.js');

let pushModule = {};
try {
  pushModule = await import('../scripts/youtube-push.mjs');
} catch (_) {
  pushModule = {};
}

const video = (id, title) => ({ id, title, url: `https://www.youtube.com/watch?v=${id}` });

test('new-video detection reports only genuinely new IDs and never floods on bootstrap', () => {
  assert.equal(typeof pushModule.findNewVideos, 'function');

  const previous = { videos: [video('AAAAAAAAAAA', 'Video anterior')] };
  const current = { videos: [video('BBBBBBBBBBB', 'Video nuevo'), video('AAAAAAAAAAA', 'Titulo editado')] };
  assert.deepEqual(pushModule.findNewVideos(previous, current).map(item => item.id), ['BBBBBBBBBBB']);

  assert.deepEqual(pushModule.findNewVideos({ videos: [] }, current), []);
  assert.deepEqual(pushModule.findNewVideos(null, current), []);
});

test('one new video creates one localized OneSignal push with a direct accessible player link', () => {
  assert.equal(typeof pushModule.buildPushPayload, 'function');
  const payload = pushModule.buildPushPayload([video('BBBBBBBBBBB', 'Mi video nuevo')]);

  assert.equal(payload.app_id, 'ed030723-7f6f-4745-8cd3-6938a9d04377');
  assert.equal(payload.target_channel, 'push');
  assert.deepEqual(payload.included_segments, ['Subscribed Users']);
  assert.match(payload.headings.es, /Nuevo video/i);
  assert.match(payload.headings.en, /New video/i);
  assert.match(payload.contents.es, /Mi video nuevo/);
  assert.match(payload.contents.en, /Mi video nuevo/);
  assert.equal(payload.url, 'https://tifloacosta.com/videos.html?video=BBBBBBBBBBB');
});

test('several new videos produce one summary notification instead of one push per video', () => {
  const payload = pushModule.buildPushPayload([
    video('BBBBBBBBBBB', 'Uno'),
    video('CCCCCCCCCCC', 'Dos')
  ]);

  assert.match(payload.contents.es, /2 videos nuevos/i);
  assert.match(payload.contents.en, /2 new videos/i);
  assert.equal(payload.url, 'https://tifloacosta.com/videos.html');
});

test('video catalog core resolves a safe video query parameter and rejects invalid IDs', () => {
  assert.equal(typeof core.videoFromSearch, 'function');
  const videos = [video('BBBBBBBBBBB', 'Mi video nuevo')];

  assert.equal(core.videoFromSearch(videos, '?video=BBBBBBBBBBB')?.id, 'BBBBBBBBBBB');
  assert.equal(core.videoFromSearch(videos, '?video=not-valid'), null);
  assert.equal(core.videoFromSearch(videos, '?video=CCCCCCCCCCC'), null);
});

test('YouTube workflow snapshots the old catalog, sends only after deployment, and reads the API key from GitHub secrets', async () => {
  const workflow = await readFile(new URL('../.github/workflows/sync-youtube.yml', import.meta.url), 'utf8');

  assert.match(workflow, /cp videos\.json \/tmp\/videos-before\.json/);
  assert.match(workflow, /node scripts\/youtube-push\.mjs detect/);
  assert.match(workflow, /node scripts\/youtube-push\.mjs send/);
  assert.match(workflow, /ONESIGNAL_APP_API_KEY/);
  assert.match(workflow, /secrets\./);
  assert.ok(workflow.indexOf('Deploy Pages') < workflow.indexOf('Send new-video notification'));
});

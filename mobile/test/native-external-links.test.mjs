import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyExternalTarget, createExternalLinkService } from '../src/native/external-links.mjs';

test('YouTube links expose an app target and keep the web fallback', () => {
  const target = classifyExternalTarget('https://www.youtube.com/watch?v=abc123');
  assert.equal(target.kind, 'youtube');
  assert.equal(target.appUrl, 'youtube://www.youtube.com/watch?v=abc123');
  assert.equal(target.webUrl, 'https://www.youtube.com/watch?v=abc123');
});

test('WhatsApp wa.me links expose a native send target', () => {
  const target = classifyExternalTarget('https://wa.me/34600000000?text=Hola%20Tony');
  assert.equal(target.kind, 'whatsapp');
  assert.match(target.appUrl, /^whatsapp:\/\/send\?/);
  assert.match(target.appUrl, /phone=34600000000/);
});

test('Spotify open links map to Spotify URIs when possible', () => {
  const target = classifyExternalTarget('https://open.spotify.com/episode/example123');
  assert.equal(target.kind, 'spotify');
  assert.equal(target.appUrl, 'spotify:episode:example123');
});

test('ordinary HTTPS keeps only the system web target', () => {
  assert.deepEqual(classifyExternalTarget('https://example.com/page'), {
    kind: 'web', appUrl: null, webUrl: 'https://example.com/page'
  });
});

test('service tries a confirmed app target before the web fallback', async () => {
  const calls = [];
  const appLauncher = {
    async canOpenUrl({ url }) { calls.push(['can', url]); return { value: true }; },
    async openUrl({ url }) { calls.push(['open', url]); return { completed: true }; }
  };
  const service = createExternalLinkService({ appLauncher });
  await service.open('https://www.youtube.com/watch?v=abc123');
  assert.deepEqual(calls, [
    ['can', 'youtube://www.youtube.com/watch?v=abc123'],
    ['open', 'youtube://www.youtube.com/watch?v=abc123']
  ]);
});

test('service falls back to the web URL when the app is unavailable', async () => {
  const calls = [];
  const appLauncher = {
    async canOpenUrl({ url }) { calls.push(['can', url]); return { value: false }; },
    async openUrl({ url }) { calls.push(['open', url]); return { completed: true }; }
  };
  const service = createExternalLinkService({ appLauncher });
  await service.open('https://www.youtube.com/watch?v=abc123');
  assert.equal(calls.at(-1)[1], 'https://www.youtube.com/watch?v=abc123');
});
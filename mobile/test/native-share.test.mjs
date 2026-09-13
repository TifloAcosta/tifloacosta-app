import assert from 'node:assert/strict';
import test from 'node:test';
import { createShareService } from '../src/native/share.mjs';

test('uses native share plugin when available', async () => {
  const calls = [];
  const service = createShareService({
    sharePlugin: { async share(options) { calls.push(options); return {}; } },
    navigatorObj: {}
  });
  const result = await service.shareLink({ title: 'Guía', url: 'https://tifloacosta.com/' });
  assert.equal(result.shared, true);
  assert.equal(result.via, 'native');
  assert.equal(calls.length, 1);
});

test('falls back to navigator share', async () => {
  const calls = [];
  const service = createShareService({
    sharePlugin: null,
    navigatorObj: { async share(options) { calls.push(options); } }
  });
  const result = await service.shareLink({ title: 'Vídeo', url: 'https://tifloacosta.com/videos' });
  assert.equal(result.shared, true);
  assert.equal(result.via, 'web');
  assert.equal(calls.length, 1);
});

test('returns unavailable when no share path exists', async () => {
  const service = createShareService({ sharePlugin: null, navigatorObj: {} });
  assert.deepEqual(await service.shareLink({ title: 'Guía', url: 'https://tifloacosta.com/' }), { shared: false, via: 'unavailable' });
});
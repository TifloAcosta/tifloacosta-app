import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

async function loadCore() {
  const source = await readFile(new URL('../youtube-actions-core.js', import.meta.url), 'utf8');
  const context = { window: {} };
  vm.runInNewContext(source, context);
  return context.window.TifloYouTubeActionsCore;
}

test('unauthenticated state never exposes private actions', async () => {
  const core = await loadCore();
  const state = core.reduce(core.initialState(), { type: 'SESSION', authenticated: false });
  assert.equal(state.authenticated, false);
  assert.equal(state.canSubscribe, false);
  assert.equal(state.canLike, false);
  assert.equal(state.canComment, false);
});

test('public video details come from the existing catalog object', async () => {
  const core = await loadCore();
  const video = {
    id: 'abcdefghijk',
    title: 'Título',
    publishedAt: '2026-09-20T10:00:00Z',
    description: 'Descripción',
    url: 'https://www.youtube.com/watch?v=abcdefghijk'
  };
  const details = JSON.parse(JSON.stringify(core.detailsFromVideo(video)));
  assert.deepEqual(details, video);
});

test('authenticated unsubscribed state makes subscription primary action available', async () => {
  const core = await loadCore();
  let state = core.reduce(core.initialState(), { type: 'SESSION', authenticated: true, csrf: 'x' });
  state = core.reduce(state, { type: 'VIDEO_STATE', subscribed: false, rating: 'none' });
  assert.equal(state.canSubscribe, true);
  assert.equal(state.canLike, true);
  assert.equal(state.canComment, true);
});

test('subscribed and liked states do not offer duplicate actions', async () => {
  const core = await loadCore();
  let state = core.reduce(core.initialState(), { type: 'SESSION', authenticated: true, csrf: 'x' });
  state = core.reduce(state, { type: 'VIDEO_STATE', subscribed: true, rating: 'like' });
  assert.equal(state.canSubscribe, false);
  assert.equal(state.canLike, false);
  assert.equal(state.canComment, true);
});

test('video ids are strictly validated', async () => {
  const core = await loadCore();
  assert.equal(core.isValidVideoId('abcdefghijk'), true);
  assert.equal(core.isValidVideoId('bad'), false);
  assert.equal(core.isValidVideoId('abcdefghij!'), false);
});

test('Spanish and English copy include the primary subscription action', async () => {
  const core = await loadCore();
  assert.equal(core.copyFor('es').subscribe, 'Suscribirme al canal TifloAcosta');
  assert.equal(core.copyFor('en').subscribe, 'Subscribe to the TifloAcosta channel');
});

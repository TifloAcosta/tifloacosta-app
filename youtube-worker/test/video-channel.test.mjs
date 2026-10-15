import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolveVideoChannel,
  getAccountVideoStateForVideo,
  subscribeToVideoChannel,
  unsubscribeFromVideoChannel,
  unlike,
  commentOnVideoChannel
} from '../src/youtube-api.js';
import { handleRequest } from '../src/index.js';
import { createSessionCookie } from '../src/session.js';

const videoId = 'abcDEF123_-';
const channelId = 'UCaaaaaaaaaaaaaaaaaaaaaa';
const env = {
  ALLOWED_ORIGIN: 'https://tifloacosta.com',
  YOUTUBE_SESSION_SECRET: 'test-long-session-key-0123456789abcdef',
  GOOGLE_CLIENT_ID: 'test-client',
  GOOGLE_CLIENT_SECRET: 'test-secret'
};
const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json' }
});
function fakeApi({ subscribed = false } = {}) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const target = String(url);
    const method = options.method || 'GET';
    calls.push({ target, method, body: options.body ? JSON.parse(options.body) : null });
    if (target.startsWith('https://oauth2.googleapis.com/token')) {
      return json({ access_token: 'test-access', expires_in: 3600 });
    }
    if (target.includes('/videos?')) {
      return json({ items: [{ id: videoId, snippet: {
        channelId, channelTitle: 'Canal del autor'
      } }] });
    }
    if (target.includes('/videos/getRating?')) return json({ items: [{ rating: 'like' }] });
    if (target.includes('/videos/rate?')) return new Response(null, { status: 204 });
    if (target.includes('/subscriptions?')) {
      if (method === 'POST') return json({ id: 'subscription-new' });
      if (method === 'DELETE') return new Response(null, { status: 204 });
      return json({ items: subscribed ? [{ id: 'subscription-existing' }] : [] });
    }
    if (target.includes('/commentThreads?')) return json({ id: 'comment-new' });
    if (target.includes('/channels?')) throw new Error('Must not resolve @tifloacosta in a video-scoped operation');
    throw new Error('Unexpected request: ' + target);
  };
  return { fetchImpl, calls };
}
async function authenticatedCookie() {
  const cookie = await createSessionCookie({
    accessToken: 'test-access',
    accessExp: Date.now() + 600_000,
    refreshToken: 'test-refresh',
    csrf: 'test-csrf',
    exp: Date.now() + 600_000
  }, env.YOUTUBE_SESSION_SECRET);
  return cookie.split(';', 1)[0];
}

test('el canal y su nombre proceden de la API de YouTube y no del cliente', async () => {
  const api = fakeApi();
  const result = await resolveVideoChannel('token', videoId, api.fetchImpl);
  assert.deepEqual(result, { channelId, channelTitle: 'Canal del autor' });
  assert.equal(api.calls[0].target,
    'https://www.googleapis.com/youtube/v3/videos?part=snippet&id=' + videoId);
});
test('consulta suscripción y Me gusta del canal del vídeo', async () => {
  const api = fakeApi();
  const result = await getAccountVideoStateForVideo('token', videoId, api.fetchImpl);
  assert.deepEqual(result, { channelId, channelTitle: 'Canal del autor', subscribed: false, rating: 'like' });
  assert.match(api.calls[1].target, /forChannelId=UCaaaaaaaaaaaaaaaaaaaaaa/);
});
test('la suscripción del vídeo se envía solo al canal resuelto, con protección idempotente', async () => {
  const api = fakeApi();
  const result = await subscribeToVideoChannel('token', videoId, api.fetchImpl);
  assert.deepEqual(result, { subscribed: true, changed: true });
  assert.deepEqual(api.calls.at(-1).body, {
    snippet: { resourceId: { kind: 'youtube#channel', channelId } }
  });
  const already = fakeApi({ subscribed: true });
  assert.deepEqual(await subscribeToVideoChannel('token', videoId, already.fetchImpl), { subscribed: true, changed: false });
  assert.ok(already.calls.every(c => c.method === 'GET'));
});
test('cancelar suscripción elimina exclusivamente la del canal comprobado', async () => {
  const subscribed = fakeApi({ subscribed: true });
  assert.deepEqual(await unsubscribeFromVideoChannel('token', videoId, subscribed.fetchImpl),
    { subscribed: false, changed: true });
  const deletion = subscribed.calls.find(call => call.method === 'DELETE');
  assert.equal(deletion.target, 'https://www.googleapis.com/youtube/v3/subscriptions?id=subscription-existing');
  const absent = fakeApi();
  assert.deepEqual(await unsubscribeFromVideoChannel('token', videoId, absent.fetchImpl),
    { subscribed: false, changed: false });
  assert.ok(absent.calls.every(call => call.method === 'GET'));
});
test('quitar Me gusta usa la valoración none del vídeo seleccionado', async () => {
  const api = fakeApi();
  assert.deepEqual(await unlike('token', videoId, api.fetchImpl), { rating: 'none' });
  assert.deepEqual(api.calls.map(call => call.method), ['POST']);
  assert.equal(api.calls[0].target,
    'https://www.googleapis.com/youtube/v3/videos/rate?id=' + videoId + '&rating=none');
});
test('el comentario enlaza el vídeo con su canal real', async () => {
  const api = fakeApi();
  assert.deepEqual(await commentOnVideoChannel('token', videoId, 'Texto de prueba', api.fetchImpl), { commented: true });
  assert.equal(api.calls.at(-1).body.snippet.channelId, channelId);
  assert.equal(api.calls.at(-1).body.snippet.videoId, videoId);
  assert.equal(api.calls.at(-1).body.snippet.topLevelComment.snippet.textOriginal, 'Texto de prueba');
});
test('identificadores incorrectos y vídeos desaparecidos no permiten acciones', async () => {
  const api = fakeApi();
  await assert.rejects(() => subscribeToVideoChannel('token', 'bad', api.fetchImpl), e => e?.code === 'INVALID_VIDEO_ID');
  await assert.rejects(() => commentOnVideoChannel('token', videoId, '  ', api.fetchImpl), e => e?.code === 'INVALID_COMMENT');
  assert.equal(api.calls.length, 0);
  const empty = async () => json({ items: [] });
  await assert.rejects(() => resolveVideoChannel('token', videoId, empty), e => e?.code === 'VIDEO_NOT_FOUND');
});
test('las rutas nuevas mantienen controles de sesión, origen y CSRF', async () => {
  const cookie = await authenticatedCookie();
  const api = fakeApi();
  const headers = { Origin: env.ALLOWED_ORIGIN, Cookie: cookie, 'X-CSRF-Token': 'test-csrf', 'Content-Type': 'application/json' };
  const state = await handleRequest(new Request(
    'https://youtube-auth.tifloacosta.com/state?videoId=' + videoId + '&channelScope=video',
    { headers }
  ), env, { fetchImpl: api.fetchImpl });
  assert.equal(state.status, 200);
  assert.deepEqual(await state.json(), { authenticated: true, channelId,
    channelTitle: 'Canal del autor', subscribed: false, rating: 'like' });

  const blocked = await handleRequest(new Request(
    'https://youtube-auth.tifloacosta.com/subscribe',
    { method: 'POST', headers: { ...headers, Origin: 'capacitor://localhost' }, body: JSON.stringify({ videoId }) }
  ), env, { fetchImpl: api.fetchImpl });
  assert.equal(blocked.status, 403);

  const missingCsrf = await handleRequest(new Request(
    'https://youtube-auth.tifloacosta.com/comment',
    { method: 'POST', headers: { Origin: env.ALLOWED_ORIGIN, Cookie: cookie }, body: JSON.stringify({ videoId, channelScope:'video', text:'Hello' }) }
  ), env, { fetchImpl: api.fetchImpl });
  assert.equal(missingCsrf.status, 403);

  const subscribeResponse = await handleRequest(new Request(
    'https://youtube-auth.tifloacosta.com/subscribe',
    { method: 'POST', headers, body: JSON.stringify({ videoId }) }
  ), env, { fetchImpl: api.fetchImpl });
  assert.equal(subscribeResponse.status, 200);

  const commentResponse = await handleRequest(new Request(
    'https://youtube-auth.tifloacosta.com/comment',
    { method: 'POST', headers, body: JSON.stringify({ videoId, channelScope:'video', text:'Gracias' }) }
  ), env, { fetchImpl: api.fetchImpl });
  assert.equal(commentResponse.status, 200);
});

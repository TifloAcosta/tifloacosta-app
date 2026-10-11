import assert from 'node:assert/strict';
import test from 'node:test';
import { handleRequest } from '../src/index.js';
import { pkceChallenge } from '../src/security.js';

const env = {
  ALLOWED_ORIGIN: 'https://tifloacosta.com',
  APP_RETURN_URL: 'https://tifloacosta.com/videos.html',
  YOUTUBE_SESSION_SECRET: 'unit-test-encrypted-credentials-key-with-length',
  GOOGLE_CLIENT_ID: 'client-123',
  GOOGLE_CLIENT_SECRET: 'server-secret'
};
const videoId = 'abcDEF123_-';
const verifier = 'V'.repeat(64);
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const fakeGoogle = async (url, options) => {
  const target = String(url);
  if (target === 'https://oauth2.googleapis.com/token') {
    return json({ access_token: 'ACCESS_SECRET', refresh_token: 'REFRESH_SECRET', expires_in: 3600 });
  }
  if (target.includes('/videos?')) {
    return json({ items: [{ snippet: { channelId: 'UC_real_channel', channelTitle: 'Canal real' } }] });
  }
  if (target.includes('/subscriptions?')) {
    return options.method === 'POST' ? json({ id: 'new-sub' }) : json({ items: [] });
  }
  if (target.includes('/videos/getRating?')) return json({ items: [{ rating: 'none' }] });
  if (target.includes('/videos/rate?')) return new Response(null, { status: 204 });
  if (target.includes('/commentThreads?')) return json({ id: 'new-comment' });
  throw new Error('Unexpected Google request: ' + target);
};

async function nativeFlow() {
  const challenge = await pkceChallenge(verifier);
  const start = await handleRequest(new Request(
    'https://youtube-auth.tifloacosta.com/auth/start?iosChallenge=' + challenge
  ), env);
  assert.equal(start.status, 302);
  const cookie = start.headers.get('set-cookie').split(';')[0];
  const location = new URL(start.headers.get('location'));
  assert.equal(location.hostname, 'accounts.google.com');
  const callback = await handleRequest(new Request(
    'https://youtube-auth.tifloacosta.com/auth/callback?state=' +
       location.searchParams.get('state') + '&code=google-authorization-code',
    { headers: { Cookie: cookie } }
  ), env, { fetchImpl: fakeGoogle });
  assert.equal(callback.status, 302);
  const redirect = new URL(callback.headers.get('location'));
  assert.equal(redirect.protocol, 'tifloacosta:');
  assert.equal(redirect.host, 'youtube-auth');
  assert.equal(redirect.searchParams.get('result'), 'ok');
  assert.equal(callback.headers.get('set-cookie')?.includes('__Host-tiflo_youtube='), false);
  const ticket = redirect.searchParams.get('ticket');
  assert.ok(ticket.length > 50);
  assert.ok(!ticket.includes('REFRESH_SECRET') && !ticket.includes('ACCESS_SECRET'));
  const redeem = async proof => handleRequest(new Request('https://youtube-auth.tifloacosta.com/native/redeem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticket, verifier: proof })
  }), env);
  return { cookie, ticket, redeem };
}

test('la autorización web antigua sigue regresando al sitio y a su cookie', async () => {
  const start = await handleRequest(new Request('https://youtube-auth.tifloacosta.com/auth/start'), env);
  const cookie = start.headers.get('set-cookie').split(';')[0];
  const google = new URL(start.headers.get('location'));
  const callback = await handleRequest(new Request(
    'https://youtube-auth.tifloacosta.com/auth/callback?state=' +
      google.searchParams.get('state') + '&code=google-code',
    { headers: { Cookie: cookie } }
  ), env, { fetchImpl: fakeGoogle });
  assert.equal(callback.status, 302);
  assert.equal(new URL(callback.headers.get('location')).origin, 'https://tifloacosta.com');
  assert.match(callback.headers.get('set-cookie'), /__Host-tiflo_youtube=/);
});

test('iOS recibe un ticket opaco, nunca tokens de Google ni cookie web', async () => {
  await nativeFlow();
});
test('rechaza reto iOS inválido y prueba de otro dispositivo', async () => {
  const invalid = await handleRequest(new Request(
    'https://youtube-auth.tifloacosta.com/auth/start?iosChallenge=bad'
  ), env);
  assert.equal(new URL(invalid.headers.get('location')).protocol, 'tifloacosta:');
  const flow = await nativeFlow();
  const wrong = await flow.redeem('X'.repeat(64));
  assert.equal(wrong.status, 401);
  assert.deepEqual(await wrong.json(), { error: 'SESSION_EXPIRED' });
});
test('redeem protegido habilita acciones por bearer sin cookies ni CORS indiscriminado', async () => {
  const flow = await nativeFlow();
  const response = await flow.redeem(verifier);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.ok(data.sessionToken);
  assert.ok(!data.sessionToken.includes('REFRESH_SECRET'));
  const headers = { Authorization: 'Bearer ' + data.sessionToken, 'Content-Type': 'application/json' };
  const session = await handleRequest(new Request('https://youtube-auth.tifloacosta.com/native/session', { headers }), env);
  assert.deepEqual(await session.json(), { authenticated: true });
  const video = await handleRequest(new Request(
    'https://youtube-auth.tifloacosta.com/native/state?videoId=' + videoId, { headers }
  ), env, { fetchImpl: fakeGoogle });
  assert.deepEqual(await video.json(), { authenticated: true,
    channelId: 'UC_real_channel', channelTitle: 'Canal real', subscribed: false, rating: 'none' });
  for (const [action, content] of [['subscribe', {videoId}], ['like', {videoId}], ['comment', {videoId, text:'Prueba'}]]) {
    const result = await handleRequest(new Request(
      'https://youtube-auth.tifloacosta.com/native/' + action,
      { method: 'POST', headers, body: JSON.stringify(content) }
    ), env, { fetchImpl: fakeGoogle });
    assert.equal(result.status, 200, action);
  }
  const unauthorized = await handleRequest(new Request(
    'https://youtube-auth.tifloacosta.com/native/state?videoId=' + videoId,
    { headers: { Origin: 'capacitor://localhost' } }
  ), env);
  assert.equal(unauthorized.status, 401);
  assert.equal(unauthorized.headers.get('Access-Control-Allow-Origin'), null);
});

test('ticket y bearer manipulados o incompletos no conceden acceso', async () => {
  const flow = await nativeFlow();
  const invalid = await handleRequest(new Request('https://youtube-auth.tifloacosta.com/native/redeem', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticket: flow.ticket + 'altered', verifier })
  }), env);
  assert.equal(invalid.status, 401);
  const unauthorized = await handleRequest(new Request('https://youtube-auth.tifloacosta.com/native/session', {
    headers: { Authorization: 'Bearer broken' }
  }), env);
  assert.equal(unauthorized.status, 401);
});

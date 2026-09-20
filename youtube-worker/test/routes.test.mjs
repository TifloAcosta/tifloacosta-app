import assert from 'node:assert/strict';
import test from 'node:test';
import worker, { handleRequest } from '../src/index.js';
import { createSessionCookie } from '../src/session.js';

const env = {
  ALLOWED_ORIGIN: 'https://tifloacosta.com',
  YOUTUBE_SESSION_SECRET: 'unit-test-session-key-abcdefghijklmnopqrstuvwxyz',
  GOOGLE_CLIENT_ID: 'unit-test-client',
  GOOGLE_CLIENT_SECRET: 'unit-test-client-key'
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function authCookie() {
  const setCookie = await createSessionCookie({
    refreshToken: 'test-refresh',
    csrf: 'csrf-token',
    exp: Date.now() + 60_000
  }, env.YOUTUBE_SESSION_SECRET);
  return setCookie.split(';', 1)[0];
}

function mockFetch({ subscribed = true, rating = 'like', calls = [] } = {}) {
  return async (url, options = {}) => {
    const target = String(url);
    const method = options.method || 'GET';
    calls.push({ target, method });
    if (target === 'https://oauth2.googleapis.com/token') {
      return jsonResponse({ access_token: 'test-access', expires_in: 3600 });
    }
    if (target.includes('/channels?')) return jsonResponse({ items: [{ id: 'UC_TIFLOACOSTA' }] });
    if (target.includes('/subscriptions?') && method === 'GET') {
      return jsonResponse({ items: subscribed ? [{ id: 'sub-1' }] : [] });
    }
    if (target.includes('/subscriptions?') && method === 'POST') return jsonResponse({ id: 'sub-new' });
    if (target.includes('/videos/getRating?')) return jsonResponse({ items: [{ rating }] });
    if (target.includes('/videos/rate?')) return new Response(null, { status: 204 });
    if (target.includes('/commentThreads?')) return jsonResponse({ id: 'comment-1' });
    throw new Error(`Unexpected fetch ${target}`);
  };
}

test('GET /health is public and does not expose secrets', async () => {
  const response = await worker.fetch(new Request('https://youtube-auth.tifloacosta.com/health'), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, service: 'youtube-actions' });
});

test('credentialed CORS allows only the production origin', async () => {
  const allowed = await worker.fetch(new Request('https://youtube-auth.tifloacosta.com/session', {
    headers: { Origin: 'https://tifloacosta.com' }
  }), env);
  assert.equal(allowed.headers.get('Access-Control-Allow-Origin'), 'https://tifloacosta.com');
  assert.equal(allowed.headers.get('Access-Control-Allow-Credentials'), 'true');

  const blocked = await worker.fetch(new Request('https://youtube-auth.tifloacosta.com/session', {
    headers: { Origin: 'https://example.com' }
  }), env);
  assert.notEqual(blocked.headers.get('Access-Control-Allow-Origin'), '*');
  assert.notEqual(blocked.headers.get('Access-Control-Allow-Origin'), 'https://example.com');
});

test('GET /state without a session returns SESSION_EXPIRED', async () => {
  const response = await handleRequest(new Request(
    'https://youtube-auth.tifloacosta.com/state?videoId=abcdefghijk',
    { headers: { Origin: env.ALLOWED_ORIGIN } }
  ), env, { fetchImpl: mockFetch() });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'SESSION_EXPIRED' });
});

test('GET /state returns subscription and rating only', async () => {
  const cookie = await authCookie();
  const response = await handleRequest(new Request(
    'https://youtube-auth.tifloacosta.com/state?videoId=abcdefghijk',
    { headers: { Origin: env.ALLOWED_ORIGIN, Cookie: cookie } }
  ), env, { fetchImpl: mockFetch({ subscribed: true, rating: 'like' }) });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    authenticated: true,
    subscribed: true,
    rating: 'like'
  });
});

test('POST /subscribe rejects wrong origin and missing CSRF', async () => {
  const cookie = await authCookie();
  const wrongOrigin = await handleRequest(new Request(
    'https://youtube-auth.tifloacosta.com/subscribe',
    { method: 'POST', headers: { Origin: 'https://example.com', Cookie: cookie, 'X-CSRF-Token': 'csrf-token' } }
  ), env, { fetchImpl: mockFetch() });
  assert.equal(wrongOrigin.status, 403);

  const missingCsrf = await handleRequest(new Request(
    'https://youtube-auth.tifloacosta.com/subscribe',
    { method: 'POST', headers: { Origin: env.ALLOWED_ORIGIN, Cookie: cookie } }
  ), env, { fetchImpl: mockFetch() });
  assert.equal(missingCsrf.status, 403);
  assert.deepEqual(await missingCsrf.json(), { error: 'CSRF_INVALID' });
});

test('POST /subscribe is idempotent for an existing subscription', async () => {
  const cookie = await authCookie();
  const calls = [];
  const response = await handleRequest(new Request(
    'https://youtube-auth.tifloacosta.com/subscribe',
    { method: 'POST', headers: { Origin: env.ALLOWED_ORIGIN, Cookie: cookie, 'X-CSRF-Token': 'csrf-token' } }
  ), env, { fetchImpl: mockFetch({ subscribed: true, calls }) });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { subscribed: true, changed: false });
  assert.equal(calls.some(call => call.method === 'POST' && call.target.includes('/subscriptions?')), false);
});

test('POST /like rejects an invalid video id with a safe code', async () => {
  const cookie = await authCookie();
  const response = await handleRequest(new Request(
    'https://youtube-auth.tifloacosta.com/like',
    {
      method: 'POST',
      headers: { Origin: env.ALLOWED_ORIGIN, Cookie: cookie, 'X-CSRF-Token': 'csrf-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId: 'bad' })
    }
  ), env, { fetchImpl: mockFetch() });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'INVALID_VIDEO' });
});

test('POST /comment publishes non-empty text and rejects empty text', async () => {
  const cookie = await authCookie();
  const headers = { Origin: env.ALLOWED_ORIGIN, Cookie: cookie, 'X-CSRF-Token': 'csrf-token', 'Content-Type': 'application/json' };
  const success = await handleRequest(new Request(
    'https://youtube-auth.tifloacosta.com/comment',
    { method: 'POST', headers, body: JSON.stringify({ videoId: 'abcdefghijk', text: 'Gracias' }) }
  ), env, { fetchImpl: mockFetch() });
  assert.equal(success.status, 200);
  assert.deepEqual(await success.json(), { commented: true });

  const empty = await handleRequest(new Request(
    'https://youtube-auth.tifloacosta.com/comment',
    { method: 'POST', headers, body: JSON.stringify({ videoId: 'abcdefghijk', text: '   ' }) }
  ), env, { fetchImpl: mockFetch() });
  assert.equal(empty.status, 400);
  assert.deepEqual(await empty.json(), { error: 'INVALID_COMMENT' });
});

test('POST /comment returns a safe specific YouTube rejection code', async () => {
  const cookie = await authCookie();
  const headers = { Origin: env.ALLOWED_ORIGIN, Cookie: cookie, 'X-CSRF-Token': 'csrf-token', 'Content-Type': 'application/json' };
  const fetchImpl = async (url) => {
    const target = String(url);
    if (target === 'https://oauth2.googleapis.com/token') return jsonResponse({ access_token: 'test-access', expires_in: 3600 });
    if (target.includes('/channels?')) return jsonResponse({ items: [{ id: 'UC_TIFLOACOSTA' }] });
    if (target.includes('/commentThreads?')) {
      return jsonResponse({ error: { message: 'private Google body', errors: [{ reason: 'ineligibleAccount' }] } }, 403);
    }
    throw new Error(`Unexpected fetch ${target}`);
  };
  const response = await handleRequest(new Request(
    'https://youtube-auth.tifloacosta.com/comment',
    { method: 'POST', headers, body: JSON.stringify({ videoId: 'abcdefghijk', text: 'Gracias' }) }
  ), env, { fetchImpl });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: 'INELIGIBLE_ACCOUNT' });
});

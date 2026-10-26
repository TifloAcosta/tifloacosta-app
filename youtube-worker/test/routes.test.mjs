import assert from 'node:assert/strict';
import test from 'node:test';
import worker, { handleRequest } from '../src/index.js';
import { createSessionCookie } from '../src/session.js';
import { randomToken, pkceChallenge } from '../src/security.js';

const env = {
  ALLOWED_ORIGIN: 'https://tifloacosta.com',
  YOUTUBE_SESSION_SECRET: 'unit-test-session-key-abcdefghijklmnopqrstuvwxyz',
  GOOGLE_CLIENT_ID: 'unit-test-client',
  GOOGLE_CLIENT_SECRET: 'unit-test-client-key',
  YOUTUBE_API_KEY: 'unit-test-api-key'
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
    if (target.includes('/subscriptions?') && method === 'DELETE') return new Response(null, { status: 204 });
    if (target.includes('/videos/getRating?')) return jsonResponse({ items: [{ rating }] });
    if (target.includes('/videos/rate?')) return new Response(null, { status: 204 });
    if (target.includes('/commentThreads?')) return jsonResponse({ id: 'comment-1' });
    if (target.includes('/search?')) {
      return jsonResponse({
        nextPageToken: 'NEXT_TOKEN',
        items: [{
          id: { videoId: 'abcDEF123_-' },
          snippet: {
            title: 'Accessible video',
            channelTitle: 'Example channel',
            publishedAt: '2026-10-01T12:00:00Z',
            description: 'Description',
            thumbnails: { medium: { url: 'https://img.example/video.jpg' } }
          }
        }]
      });
    }
    if (target.includes('/videos?')) {
      return jsonResponse({ items: [{ id: 'abcDEF123_-', snippet: { channelId: 'UC_VIDEO_CHANNEL' }, contentDetails: { duration: 'PT8M5S' } }] });
    }
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
    if (target.includes('/videos?')) return jsonResponse({ items: [{ snippet: { channelId: 'UC_VIDEO_CHANNEL' } }] });
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


test('GET /search is public to the app origin and does not require OAuth session', async () => {
  const response = await handleRequest(new Request(
    'https://youtube-auth.tifloacosta.com/search?q=VoiceOver',
    { headers: { Origin: env.ALLOWED_ORIGIN } }
  ), env, { fetchImpl: mockFetch() });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.items.length, 1);
  assert.equal(data.items[0].id, 'abcDEF123_-');
  assert.equal(data.items[0].durationSeconds, 485);
  assert.equal(data.nextPageToken, 'NEXT_TOKEN');
});



test('GET /search allows the Android Capacitor origin without enabling authenticated actions', async () => {
  const response = await handleRequest(new Request(
    'https://youtube-auth.tifloacosta.com/search?q=TalkBack',
    { headers: { Origin: 'https://localhost' } }
  ), env, { fetchImpl: mockFetch() });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://localhost');
  assert.notEqual(response.headers.get('Access-Control-Allow-Credentials'), 'true');

  const cookie = await authCookie();
  const protectedAction = await handleRequest(new Request(
    'https://youtube-auth.tifloacosta.com/subscribe',
    {
      method: 'POST',
      headers: {
        Origin: 'https://localhost',
        Cookie: cookie,
        'X-CSRF-Token': 'csrf-token'
      }
    }
  ), env, { fetchImpl: mockFetch() });
  assert.equal(protectedAction.status, 403);
});
test('GET /search rejects browser origins other than TifloAcosta', async () => {
  const response = await handleRequest(new Request(
    'https://youtube-auth.tifloacosta.com/search?q=VoiceOver',
    { headers: { Origin: 'https://example.com' } }
  ), env, { fetchImpl: mockFetch() });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: 'ORIGIN_NOT_ALLOWED' });
});

test('GET /search reports unavailable when the Worker has no API key', async () => {
  const noKeyEnv = { ...env, YOUTUBE_API_KEY: '' };
  const response = await handleRequest(new Request(
    'https://youtube-auth.tifloacosta.com/search?q=VoiceOver',
    { headers: { Origin: env.ALLOWED_ORIGIN } }
  ), noKeyEnv, { fetchImpl: mockFetch() });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'SEARCH_UNAVAILABLE' });
});


test('Native Google OAuth exchanges a PKCE-bound short-lived ticket for an encrypted iOS session', async () => {
  const verifier = randomToken(32);
  const challenge = await pkceChallenge(verifier);
  const start = await handleRequest(new Request(
    'https://youtube-auth.tifloacosta.com/auth/native/start?challenge=' + challenge
  ), env);
  assert.equal(start.status, 302);
  const google = new URL(start.headers.get('Location'));
  assert.equal(google.hostname, 'accounts.google.com');
  assert.equal(google.searchParams.get('code_challenge_method'), 'S256');
  const cookie = start.headers.get('Set-Cookie').split(';', 1)[0];
  const callback = await handleRequest(new Request(
    'https://youtube-auth.tifloacosta.com/auth/callback?code=code-example&state=' + google.searchParams.get('state'),
    { headers: { Cookie: cookie } }
  ), env, { fetchImpl: async url => {
    assert.equal(String(url), 'https://oauth2.googleapis.com/token');
    return jsonResponse({ access_token: 'google-access', refresh_token: 'google-refresh', expires_in: 3600 });
  }});
  assert.equal(callback.status, 302);
  const returned = new URL(callback.headers.get('Location'));
  assert.equal(returned.protocol, 'tifloacosta:');
  assert.equal(returned.hostname, 'youtube-auth');
  const ticket = returned.searchParams.get('ticket');
  assert.ok(ticket);
  assert.doesNotMatch(callback.headers.get('Location'), /google-refresh|google-access/);

  const bad = await handleRequest(new Request('https://youtube-auth.tifloacosta.com/auth/native/exchange', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticket, verifier: randomToken(32) })
  }), env);
  assert.equal(bad.status, 401);

  const exchange = await handleRequest(new Request('https://youtube-auth.tifloacosta.com/auth/native/exchange', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticket, verifier })
  }), env);
  assert.equal(exchange.status, 200);
  const session = await exchange.json();
  assert.ok(session.authenticated);
  assert.ok(session.token);
  assert.ok(session.expiresAt > Date.now());
  assert.doesNotMatch(session.token, /google-access|google-refresh/);

  const connected = await handleRequest(new Request('https://youtube-auth.tifloacosta.com/session', {
    headers: { Authorization: 'Bearer ' + session.token }
  }), env, { fetchImpl: mockFetch() });
  assert.deepEqual(await connected.json(), { authenticated: true });

  const liked = await handleRequest(new Request('https://youtube-auth.tifloacosta.com/like', {
    method: 'POST', headers: {
      Authorization: 'Bearer ' + session.token, 'Content-Type': 'application/json'
    }, body: JSON.stringify({ videoId: 'abcDEF123_-' })
  }), env, { fetchImpl: mockFetch() });
  assert.equal(liked.status, 200);
  assert.deepEqual(await liked.json(), { rating: 'like' });

  const blocked = await handleRequest(new Request('https://youtube-auth.tifloacosta.com/like', {
    method: 'POST', headers: {
      Authorization: 'Bearer ' + session.token, Origin: 'https://malicious.example',
      'Content-Type': 'application/json'
    }, body: JSON.stringify({ videoId: 'abcDEF123_-' })
  }), env, { fetchImpl: mockFetch() });
  assert.equal(blocked.status, 403);
});

test('Android native OAuth redirects to a distinct scheme and retains PKCE protection', async () => {
  const verifier = randomToken(32);
  const challenge = await pkceChallenge(verifier);
  const start = await handleRequest(new Request(
    'https://youtube-auth.tifloacosta.com/auth/native/start?platform=android&challenge=' + challenge
  ), env);
  assert.equal(start.status, 302);
  const oauth = new URL(start.headers.get('Location'));
  const cookie = start.headers.get('Set-Cookie').split(';', 1)[0];
  const callback = await handleRequest(new Request(
    'https://youtube-auth.tifloacosta.com/auth/callback?code=example&state=' + oauth.searchParams.get('state'),
    { headers: { Cookie: cookie } }
  ), env, { fetchImpl: async () =>
    jsonResponse({access_token:'android-access',refresh_token:'android-refresh',expires_in:3600})
  });
  assert.equal(callback.status,302);
  const url = new URL(callback.headers.get('Location'));
  assert.equal(url.protocol,'tifloacostanative:');
  assert.equal(url.hostname,'youtube-auth');
  const ticket=url.searchParams.get('ticket');
  assert.ok(ticket);
  const reply=await handleRequest(new Request('https://youtube-auth.tifloacosta.com/auth/native/exchange',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ticket,verifier})
  }),env);
  assert.equal(reply.status,200);
  assert.equal((await reply.json()).authenticated,true);

  const rejected = await handleRequest(new Request(
    'https://youtube-auth.tifloacosta.com/auth/native/start?platform=untrusted&challenge=' + challenge
  ), env);
  assert.equal(rejected.status,400);
});

test('Invalid and browser-origin native authorization attempts are denied', async () => {
  const invalid = await handleRequest(new Request(
    'https://youtube-auth.tifloacosta.com/auth/native/start?challenge=wrong'
  ), env);
  assert.equal(invalid.status, 400);
  const browser = await handleRequest(new Request(
    'https://youtube-auth.tifloacosta.com/auth/native/exchange',
    { method: 'POST', headers: { Origin: 'https://example.com' } }
  ), env);
  assert.equal(browser.status, 403);
  const unauth = await handleRequest(new Request('https://youtube-auth.tifloacosta.com/unsubscribe', {
    method: 'POST', headers: { Origin: env.ALLOWED_ORIGIN },
    body: JSON.stringify({ videoId: 'abcDEF123_-' })
  }), env, { fetchImpl: mockFetch() });
  assert.equal(unauth.status, 401);
});


test('GET /subscriptions requires a valid Google session', async () => {
  const unauthenticated = await handleRequest(new Request(
    'https://youtube-auth.tifloacosta.com/subscriptions',
    { headers: { Origin: env.ALLOWED_ORIGIN } }
  ), env, { fetchImpl: mockFetch() });
  assert.equal(unauthenticated.status, 401);
  assert.deepEqual(await unauthenticated.json(), { error: 'SESSION_EXPIRED' });
});

test('GET /subscriptions returns only the channels of the authenticated account', async () => {
  const cookie = await authCookie();
  const channelId = 'UC' + 'x'.repeat(22);
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push(String(url));
    if (String(url).includes('oauth2.googleapis.com/token')) {
      return jsonResponse({ access_token: 'test-access', expires_in: 3600 });
    }
    if (String(url).includes('/subscriptions?')) {
      assert.equal(options.headers.Authorization, 'Bearer test-access');
      return jsonResponse({
        nextPageToken: 'NEXT_PAGE',
        items: [{ snippet: {
          resourceId: { channelId }, title: 'Mis pruebas', description: 'Suscripción real'
        } }]
      });
    }
    throw new Error('Unexpected ' + String(url));
  };
  const response = await handleRequest(new Request(
    'https://youtube-auth.tifloacosta.com/subscriptions',
    { headers: { Origin: env.ALLOWED_ORIGIN, Cookie: cookie } }
  ), env, { fetchImpl });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    items: [{ id: channelId, title: 'Mis pruebas', description: 'Suscripción real' }],
    nextPageToken: 'NEXT_PAGE'
  });
  assert.ok(calls.some(x => x.includes('mine=true')));
});

test('GET /search filter=short forwards official video duration to YouTube', async () => {
  const calls = [];
  const response = await handleRequest(new Request(
    'https://youtube-auth.tifloacosta.com/search?q=VoiceOver&filter=short',
    { headers: { Origin: env.ALLOWED_ORIGIN } }
  ), env, { fetchImpl: async url => {
    calls.push(String(url));
    if (String(url).includes('/search?')) return jsonResponse({ items: [] });
    throw new Error('Unexpected ' + String(url));
  } });
  assert.equal(response.status, 200);
  assert.match(calls[0], /videoDuration=short/);
});

test('GET /channel-videos is restricted to the TifloAcosta origin and valid channel IDs', async () => {
  const channelId = 'UC' + 'z'.repeat(22);
  const response = await handleRequest(new Request(
    'https://youtube-auth.tifloacosta.com/channel-videos?channelId=' + channelId,
    { headers: { Origin: env.ALLOWED_ORIGIN } }
  ), env, { fetchImpl: async url => {
    if (String(url).includes('/search?')) return jsonResponse({ items: [] });
    throw new Error('Unexpected ' + String(url));
  } });
  assert.equal(response.status, 200);
  const invalid = await handleRequest(new Request(
    'https://youtube-auth.tifloacosta.com/channel-videos?channelId=bad',
    { headers: { Origin: env.ALLOWED_ORIGIN } }
  ), env, { fetchImpl: mockFetch() });
  assert.equal(invalid.status, 400);
  const disallowed = await handleRequest(new Request(
    'https://youtube-auth.tifloacosta.com/channel-videos?channelId=' + channelId,
    { headers: { Origin: 'https://example.com' } }
  ), env, { fetchImpl: mockFetch() });
  assert.equal(disallowed.status, 403);
});

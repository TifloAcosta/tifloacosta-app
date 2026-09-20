import assert from 'node:assert/strict';
import test from 'node:test';
import worker, { handleRequest } from '../src/index.js';
import {
  YOUTUBE_SCOPE,
  buildAuthorizationUrl,
  exchangeAuthorizationCode
} from '../src/google-oauth.js';
import { OAUTH_COOKIE, SESSION_COOKIE, readOauthCookie, readSession } from '../src/session.js';

const secret = 'test-secret-at-least-32-bytes-long-123456';
const fullEnv = {
  ALLOWED_ORIGIN: 'https://tifloacosta.com',
  APP_RETURN_URL: 'https://tifloacosta.com/videos.html',
  GOOGLE_CLIENT_ID: 'client-123',
  GOOGLE_CLIENT_SECRET: 'client-secret-456',
  GOOGLE_REDIRECT_URI: 'https://youtube-auth.tifloacosta.com/auth/callback',
  YOUTUBE_SESSION_SECRET: secret
};

function cookiePair(setCookie) {
  return setCookie.split(';', 1)[0];
}

test('authorization URL requests only the approved YouTube scope with PKCE', () => {
  const url = buildAuthorizationUrl({
    clientId: 'client',
    redirectUri: 'https://youtube-auth.tifloacosta.com/auth/callback',
    state: 'state-1',
    challenge: 'challenge-1'
  });
  assert.equal(url.origin, 'https://accounts.google.com');
  assert.equal(url.searchParams.get('scope'), YOUTUBE_SCOPE);
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('access_type'), 'offline');
  assert.equal(url.searchParams.get('code_challenge'), 'challenge-1');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
});

test('authorization code exchange sends verifier and client secret only to Google token endpoint', async () => {
  let seenUrl = '';
  let seenBody = '';
  const result = await exchangeAuthorizationCode({
    code: 'code-1', verifier: 'verifier-1', clientId: 'client-1', clientSecret: 'secret-1',
    redirectUri: 'https://youtube-auth.tifloacosta.com/auth/callback',
    fetchImpl: async (url, options) => {
      seenUrl = String(url);
      seenBody = String(options.body);
      return new Response(JSON.stringify({ access_token: 'access-1', refresh_token: 'refresh-1', expires_in: 3600 }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    }
  });
  assert.equal(seenUrl, 'https://oauth2.googleapis.com/token');
  const body = new URLSearchParams(seenBody);
  assert.equal(body.get('code_verifier'), 'verifier-1');
  assert.equal(body.get('client_secret'), 'secret-1');
  assert.equal(result.refresh_token, 'refresh-1');
});

test('auth start creates encrypted PKCE state cookie and redirects to Google', async () => {
  const response = await worker.fetch(new Request('https://youtube-auth.tifloacosta.com/auth/start'), fullEnv);
  assert.equal(response.status, 302);
  const location = new URL(response.headers.get('Location'));
  assert.equal(location.origin, 'https://accounts.google.com');
  assert.equal(location.searchParams.get('scope'), YOUTUBE_SCOPE);
  assert.equal(location.searchParams.get('code_challenge_method'), 'S256');
  const setCookie = response.headers.get('Set-Cookie');
  assert.match(setCookie, new RegExp(`^${OAUTH_COOKIE}=`));
  const stored = await readOauthCookie(new Request(fullEnv.GOOGLE_REDIRECT_URI, {
    headers: { Cookie: cookiePair(setCookie) }
  }), secret);
  assert.equal(stored.state, location.searchParams.get('state'));
  assert.ok(stored.verifier.length >= 43);
});

test('callback rejects manipulated state without creating a session', async () => {
  const start = await worker.fetch(new Request('https://youtube-auth.tifloacosta.com/auth/start'), fullEnv);
  const oauthCookie = cookiePair(start.headers.get('Set-Cookie'));
  const response = await handleRequest(new Request(
    `${fullEnv.GOOGLE_REDIRECT_URI}?code=code-1&state=wrong-state`,
    { headers: { Cookie: oauthCookie } }
  ), fullEnv, { fetchImpl: async () => { throw new Error('must not call Google'); } });
  assert.equal(response.status, 302);
  const location = new URL(response.headers.get('Location'));
  assert.equal(location.origin, 'https://tifloacosta.com');
  assert.equal(location.searchParams.get('youtubeAuth'), 'error');
  assert.doesNotMatch(response.headers.get('Set-Cookie') || '', new RegExp(`^${SESSION_COOKIE}=`));
});

test('valid callback exchanges code, creates encrypted session and returns to TifloAcosta', async () => {
  const start = await worker.fetch(new Request('https://youtube-auth.tifloacosta.com/auth/start'), fullEnv);
  const oauthSetCookie = start.headers.get('Set-Cookie');
  const oauthCookie = cookiePair(oauthSetCookie);
  const oauthState = await readOauthCookie(new Request(fullEnv.GOOGLE_REDIRECT_URI, {
    headers: { Cookie: oauthCookie }
  }), secret);

  const response = await handleRequest(new Request(
    `${fullEnv.GOOGLE_REDIRECT_URI}?code=code-1&state=${encodeURIComponent(oauthState.state)}`,
    { headers: { Cookie: oauthCookie } }
  ), fullEnv, {
    fetchImpl: async () => new Response(JSON.stringify({
      access_token: 'access-1', refresh_token: 'refresh-1', expires_in: 3600
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  });

  assert.equal(response.status, 302);
  const location = new URL(response.headers.get('Location'));
  assert.equal(location.origin, 'https://tifloacosta.com');
  assert.equal(location.searchParams.get('youtubeAuth'), 'ok');
  const cookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('Set-Cookie') || ''];
  const sessionHeader = cookies.find(value => value.startsWith(`${SESSION_COOKIE}=`));
  assert.ok(sessionHeader);
  const session = await readSession(new Request('https://youtube-auth.tifloacosta.com/session', {
    headers: { Cookie: cookiePair(sessionHeader) }
  }), secret);
  assert.equal(session.refreshToken, 'refresh-1');
  assert.equal(session.accessToken, 'access-1');
  assert.ok(session.csrf);
});

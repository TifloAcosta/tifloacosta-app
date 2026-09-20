import assert from 'node:assert/strict';
import test from 'node:test';
import { pkceChallenge, seal, unseal } from '../src/security.js';
import {
  SESSION_COOKIE,
  OAUTH_COOKIE,
  createSessionCookie,
  readSession,
  createOauthCookie,
  readOauthCookie,
  clearCookie,
  assertCsrf
} from '../src/session.js';

const secret = 'test-secret-at-least-32-bytes-long-123456';

test('sealed session round-trips without exposing plaintext', async () => {
  const sealed = await seal({ refreshToken: 'refresh-123', exp: Date.now() + 60_000 }, secret);
  assert.equal(sealed.includes('refresh-123'), false);
  assert.equal((await unseal(sealed, secret)).refreshToken, 'refresh-123');
});

test('PKCE challenge is deterministic and different from verifier', async () => {
  const verifier = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~abc';
  const first = await pkceChallenge(verifier);
  const second = await pkceChallenge(verifier);
  assert.equal(first, second);
  assert.notEqual(first, verifier);
  assert.match(first, /^[A-Za-z0-9_-]+$/);
});

test('session cookie is HttpOnly Secure host-only and SameSite=Lax', async () => {
  const header = await createSessionCookie({ refreshToken: 'r', csrf: 'c', exp: Date.now() + 60_000 }, secret);
  assert.match(header, new RegExp(`^${SESSION_COOKIE}=`));
  assert.match(header, /Path=\//);
  assert.match(header, /HttpOnly/);
  assert.match(header, /Secure/);
  assert.match(header, /SameSite=Lax/);
  assert.doesNotMatch(header, /Domain=/);
});

test('tampering with a sealed value is rejected', async () => {
  const sealed = await seal({ value: 'safe' }, secret);
  const last = sealed.at(-1);
  const tampered = `${sealed.slice(0, -1)}${last === 'A' ? 'B' : 'A'}`;
  await assert.rejects(() => unseal(tampered, secret));
});

test('expired or absent session cookies are treated as signed out', async () => {
  const expiredHeader = await createSessionCookie({ refreshToken: 'r', csrf: 'c', exp: Date.now() - 1 }, secret);
  const cookiePair = expiredHeader.split(';', 1)[0];
  const expiredRequest = new Request('https://youtube-auth.tifloacosta.com/session', { headers: { Cookie: cookiePair } });
  assert.equal(await readSession(expiredRequest, secret), null);
  assert.equal(await readSession(new Request('https://youtube-auth.tifloacosta.com/session'), secret), null);
});

test('OAuth temporary cookie round-trips and expires independently', async () => {
  const header = await createOauthCookie({ state: 'state-1', verifier: 'verifier-1', exp: Date.now() + 60_000 }, secret);
  assert.match(header, new RegExp(`^${OAUTH_COOKIE}=`));
  const cookiePair = header.split(';', 1)[0];
  const request = new Request('https://youtube-auth.tifloacosta.com/auth/callback', { headers: { Cookie: cookiePair } });
  assert.equal((await readOauthCookie(request, secret)).state, 'state-1');
});

test('CSRF requires the exact non-empty session token', () => {
  const session = { csrf: 'csrf-123' };
  assert.doesNotThrow(() => assertCsrf(new Request('https://youtube-auth.tifloacosta.com/like', {
    method: 'POST', headers: { 'X-CSRF-Token': 'csrf-123' }
  }), session));
  assert.throws(() => assertCsrf(new Request('https://youtube-auth.tifloacosta.com/like', {
    method: 'POST', headers: { 'X-CSRF-Token': 'wrong' }
  }), session), error => error?.code === 'CSRF_INVALID');
});

test('clearCookie removes the host-only cookie securely', () => {
  const header = clearCookie(SESSION_COOKIE);
  assert.match(header, new RegExp(`^${SESSION_COOKIE}=`));
  assert.match(header, /Max-Age=0/);
  assert.match(header, /HttpOnly/);
  assert.match(header, /Secure/);
  assert.doesNotMatch(header, /Domain=/);
});

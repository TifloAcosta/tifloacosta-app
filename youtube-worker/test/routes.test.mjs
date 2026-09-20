import assert from 'node:assert/strict';
import test from 'node:test';
import worker, { handleRequest } from '../src/index.js';

const env = {
  ALLOWED_ORIGIN: 'https://tifloacosta.com',
  YOUTUBE_SESSION_SECRET: 'unit-test-session-key-abcdefghijklmnopqrstuvwxyz',
  GOOGLE_CLIENT_ID: 'unit-test-client',
  GOOGLE_CLIENT_SECRET: 'unit-test-client-key'
};

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
    { headers: { Origin: 'https://tifloacosta.com' } }
  ), env, {
    fetchImpl: async () => { throw new Error('network should not be reached'); }
  });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'SESSION_EXPIRED' });
});

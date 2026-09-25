import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseNextVersionCode, createPlayReleaseClient } from '../scripts/google-play-release.mjs';

test('chooses one above the highest Play or local code', () => {
  assert.equal(chooseNextVersionCode({ playCodes: [8, 10, 11], localCode: 9 }), 12);
  assert.equal(chooseNextVersionCode({ playCodes: [8, 10], localCode: 15 }), 16);
  assert.equal(chooseNextVersionCode({ playCodes: [], localCode: 0 }), 1);
});

test('Play client uses package, edit id and bearer auth', async () => {
  const requests = [];
  const fetchImpl = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    return new Response(JSON.stringify({ id: 'edit-123', tracks: [], bundles: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };
  const client = createPlayReleaseClient({
    packageName: 'com.tifloacosta.app',
    accessToken: 'token-value',
    fetchImpl
  });
  await client.createEdit();
  assert.match(requests[0].url, /applications\/com\.tifloacosta\.app\/edits$/);
  assert.equal(requests[0].options.headers.Authorization, 'Bearer token-value');
});

test('HTTP errors expose status but not authorization secret', async () => {
  const client = createPlayReleaseClient({
    packageName: 'com.tifloacosta.app',
    accessToken: 'super-secret-token',
    fetchImpl: async () => new Response('{"error":"denied"}', { status: 403 })
  });
  await assert.rejects(client.createEdit(), error => {
    assert.match(error.message, /403/);
    assert.doesNotMatch(error.message, /super-secret-token/);
    return true;
  });
});

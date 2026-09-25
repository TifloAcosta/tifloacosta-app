import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import {
  chooseNextVersionCode,
  createGoogleAccessToken,
  createPlayReleaseClient
} from '../scripts/google-play-release.mjs';

test('chooses one above the highest Play or local code', () => {
  assert.equal(chooseNextVersionCode({ playCodes: [8, 10, 11], localCode: 9 }), 12);
  assert.equal(chooseNextVersionCode({ playCodes: [8, 10], localCode: 15 }), 16);
  assert.equal(chooseNextVersionCode({ playCodes: [], localCode: 0 }), 1);
});

test('Google OAuth token request uses the Android Publisher scope and never exposes the private key', async () => {
  const requests = [];
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const privateKeyMarker = pem.split('\n')[1];
  const serviceAccount = {
    client_email: 'release-bot@example.iam.gserviceaccount.com',
    private_key: pem
  };
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    return new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 });
  };

  await assert.rejects(
    createGoogleAccessToken(serviceAccount, fetchImpl),
    error => {
      assert.match(error.message, /400/);
      assert.doesNotMatch(error.message, new RegExp(privateKeyMarker));
      return true;
    }
  );

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://oauth2.googleapis.com/token');
  assert.match(String(requests[0].options.body), /grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer/);
});

test('Play client scopes edits to TifloAcosta and sends bearer authentication', async () => {
  const requests = [];
  const fetchImpl = async (url, options = {}) => {
    requests.push({ url, options });
    if (url.endsWith('/edits')) return new Response(JSON.stringify({ id: 'edit-123' }), { status: 200 });
    if (url.endsWith('/edits/edit-123/bundles')) return new Response(JSON.stringify({ bundles: [{ versionCode: 10 }] }), { status: 200 });
    throw new Error(`Unexpected URL ${url}`);
  };

  const client = createPlayReleaseClient({
    packageName: 'com.tifloacosta.app',
    accessToken: 'token-secret',
    fetchImpl
  });
  const edit = await client.createEdit();
  const bundles = await client.listBundles(edit.id);

  assert.equal(edit.id, 'edit-123');
  assert.deepEqual(bundles.map(item => item.versionCode), [10]);
  assert.equal(requests.length, 2);
  for (const request of requests) {
    assert.match(request.url, /applications\/com\.tifloacosta\.app\/edits/);
    assert.equal(request.options.headers.Authorization, 'Bearer token-secret');
  }
});

test('track update sends release notes, version code and in-app update priority', async () => {
  const requests = [];
  const fetchImpl = async (url, options = {}) => {
    requests.push({ url, options });
    return new Response(JSON.stringify({ track: 'alpha' }), { status: 200 });
  };
  const client = createPlayReleaseClient({
    packageName: 'com.tifloacosta.app',
    accessToken: 'token-secret',
    fetchImpl
  });

  await client.updateTrack('edit-123', {
    track: 'alpha',
    versionName: '1.3.2',
    versionCode: 11,
    status: 'draft',
    priority: 2,
    notes: { es: 'Mejoras.', en: 'Improvements.' }
  });

  const body = JSON.parse(requests[0].options.body);
  assert.equal(body.releases[0].name, '1.3.2');
  assert.deepEqual(body.releases[0].versionCodes, ['11']);
  assert.equal(body.releases[0].inAppUpdatePriority, 2);
  assert.deepEqual(body.releases[0].releaseNotes, [
    { language: 'es-ES', text: 'Mejoras.' },
    { language: 'en-US', text: 'Improvements.' }
  ]);
});

test('Play API failures report status without leaking access tokens', async () => {
  const fetchImpl = async () => new Response(JSON.stringify({ error: { message: 'denied token-secret' } }), { status: 403 });
  const client = createPlayReleaseClient({
    packageName: 'com.tifloacosta.app',
    accessToken: 'token-secret',
    fetchImpl
  });

  await assert.rejects(
    client.createEdit(),
    error => {
      assert.match(error.message, /403/);
      assert.doesNotMatch(error.message, /token-secret/);
      return true;
    }
  );
});

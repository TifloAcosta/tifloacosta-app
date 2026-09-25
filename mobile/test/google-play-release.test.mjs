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
  assert.equal(chooseNextVersionCode({ playCodes: ['12', 7, -2, 'bad'], localCode: '13' }), 14);
});

test('service-account OAuth signs a JWT and requests the Android Publisher scope', async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  let request;
  const fetchImpl = async (url, init) => {
    request = { url, init };
    return new Response(JSON.stringify({ access_token: 'token-123' }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };

  const token = await createGoogleAccessToken({
    client_email: 'publisher@example.iam.gserviceaccount.com',
    private_key: pem
  }, fetchImpl, 1_700_000_000);

  assert.equal(token, 'token-123');
  assert.equal(request.url, 'https://oauth2.googleapis.com/token');
  assert.equal(request.init.method, 'POST');
  const params = new URLSearchParams(request.init.body);
  assert.equal(params.get('grant_type'), 'urn:ietf:params:oauth:grant-type:jwt-bearer');
  const assertion = params.get('assertion');
  assert.ok(assertion);
  const payload = JSON.parse(Buffer.from(assertion.split('.')[1], 'base64url').toString('utf8'));
  assert.equal(payload.iss, 'publisher@example.iam.gserviceaccount.com');
  assert.equal(payload.scope, 'https://www.googleapis.com/auth/androidpublisher');
  assert.equal(payload.aud, 'https://oauth2.googleapis.com/token');
  assert.equal(payload.iat, 1_700_000_000);
  assert.equal(payload.exp, 1_700_003_600);
});

test('Play client uses package, edit ids, bearer auth and release metadata', async () => {
  const requests = [];
  const fetchImpl = async (url, init = {}) => {
    requests.push({ url: String(url), init });
    const current = String(url);
    if (current.endsWith('/edits') && init.method === 'POST') return json({ id: 'edit-7' });
    if (current.endsWith('/bundles')) return json({ bundles: [{ versionCode: 10 }] });
    if (current.endsWith('/tracks')) return json({ tracks: [{ track: 'alpha', releases: [{ versionCodes: ['10'] }] }] });
    if (current.includes('/upload/androidpublisher/') && current.endsWith('/bundles?uploadType=media')) return json({ versionCode: 11 });
    if (current.endsWith('/tracks/alpha')) return json({ track: 'alpha' });
    if (current.endsWith(':validate')) return json({ id: 'edit-7' });
    if (current.endsWith(':commit')) return json({ id: 'edit-7' });
    return json({}, 404);
  };

  const client = createPlayReleaseClient({
    packageName: 'com.tifloacosta.app',
    accessToken: 'secret-token',
    fetchImpl
  });

  assert.equal((await client.createEdit()).id, 'edit-7');
  await client.listBundles('edit-7');
  await client.listTracks('edit-7');
  await client.uploadBundle('edit-7', Buffer.from('aab'));
  await client.updateTrack('edit-7', {
    track: 'alpha', versionName: '1.3.2', versionCode: 11, status: 'draft', priority: 2,
    notes: { es: 'Mejoras.', en: 'Improvements.' }
  });
  await client.validateEdit('edit-7');
  await client.commitEdit('edit-7');

  assert.ok(requests.every(item => item.init.headers?.Authorization === 'Bearer secret-token'));
  assert.ok(requests.some(item => item.url.includes('/applications/com.tifloacosta.app/edits/edit-7/bundles')));
  const trackRequest = requests.find(item => item.url.endsWith('/tracks/alpha'));
  assert.equal(trackRequest.init.method, 'PUT');
  assert.deepEqual(JSON.parse(trackRequest.init.body), {
    releases: [{
      name: '1.3.2',
      status: 'draft',
      versionCodes: ['11'],
      inAppUpdatePriority: 2,
      releaseNotes: [
        { language: 'es-ES', text: 'Mejoras.' },
        { language: 'en-US', text: 'Improvements.' }
      ]
    }]
  });
});

test('Play errors expose HTTP status without leaking response credentials', async () => {
  const client = createPlayReleaseClient({
    packageName: 'com.tifloacosta.app',
    accessToken: 'bearer-secret',
    fetchImpl: async () => new Response(JSON.stringify({ error: 'credential-secret-value' }), {
      status: 403,
      headers: { 'content-type': 'application/json' }
    })
  });

  await assert.rejects(
    client.createEdit(),
    error => error.message.includes('403') && !error.message.includes('credential-secret-value') && !error.message.includes('bearer-secret')
  );
});

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

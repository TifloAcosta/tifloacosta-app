import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveVersionCode,
  publishRelease
} from '../scripts/release-android.mjs';

const request = {
  versionName: '1.3.2',
  track: 'alpha',
  status: 'completed',
  priority: 2,
  notifyUpdate: true,
  notes: { es: 'Mejoras.', en: 'Improvements.' }
};

function playHarness({ codes = [10], trackCodes = [], failCommit = false } = {}) {
  const calls = [];
  const client = {
    async createEdit() { calls.push('createEdit'); return { id: 'edit-1' }; },
    async listBundles() { calls.push('listBundles'); return codes.map(versionCode => ({ versionCode })); },
    async listTracks() {
      calls.push('listTracks');
      return trackCodes.length ? [{ track: 'alpha', releases: [{ versionCodes: trackCodes.map(String) }] }] : [];
    },
    async uploadBundle() { calls.push('uploadBundle'); return { versionCode: 11 }; },
    async updateTrack() { calls.push('updateTrack'); return {}; },
    async validateEdit() { calls.push('validateEdit'); return {}; },
    async commitEdit() { calls.push('commitEdit'); if (failCommit) throw new Error('commit failed'); return { id: 'edit-1' }; }
  };
  return { calls, client };
}

test('dry preparation uses a safe local next code without Google Play credentials', async () => {
  const result = await resolveVersionCode({
    localState: { lastSuccessfulVersionCode: 10 },
    publish: false,
    env: {}
  });
  assert.deepEqual(result, { versionCode: 11, source: 'local' });
});

test('publish resolution requires Google Play credentials before remote work', async () => {
  await assert.rejects(
    resolveVersionCode({ localState: { lastSuccessfulVersionCode: 10 }, publish: true, env: {} }),
    /GOOGLE_PLAY_SERVICE_ACCOUNT_JSON/
  );
});

test('publish resolution chooses above bundles, tracks and local history', async () => {
  const fake = playHarness({ codes: [9, 12], trackCodes: [13, 17] });
  const result = await resolveVersionCode({
    localState: { lastSuccessfulVersionCode: 10 },
    publish: true,
    env: { GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: '{"client_email":"x","private_key":"y"}' },
    getAccessToken: async () => 'token',
    makeClient: () => fake.client
  });
  assert.equal(result.versionCode, 18);
  assert.equal(result.source, 'google-play');
  assert.deepEqual(fake.calls, ['createEdit', 'listBundles', 'listTracks']);
});

test('publish uploads validates commits and notifies only after commit', async () => {
  const fake = playHarness();
  const events = [];
  const result = await publishRelease({
    request,
    versionCode: 11,
    bundle: Buffer.from('aab'),
    env: {
      GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: '{"client_email":"x","private_key":"y"}',
      ONESIGNAL_REST_API_KEY: 'one-key',
      ONESIGNAL_APP_ID: 'one-app'
    },
    getAccessToken: async () => 'token',
    makeClient: () => fake.client,
    sendNotification: async options => { events.push(options); return { id: 'message-1' }; }
  });
  assert.deepEqual(fake.calls, ['createEdit', 'uploadBundle', 'updateTrack', 'validateEdit', 'commitEdit']);
  assert.equal(events.length, 1);
  assert.equal(events[0].versionName, '1.3.2');
  assert.equal(events[0].versionCode, 11);
  assert.equal(result.committed, true);
  assert.equal(result.notificationSent, true);
});

test('commit failure prevents the OneSignal update notice', async () => {
  const fake = playHarness({ failCommit: true });
  let notificationCalls = 0;
  await assert.rejects(
    publishRelease({
      request,
      versionCode: 11,
      bundle: Buffer.from('aab'),
      env: {
        GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: '{"client_email":"x","private_key":"y"}',
        ONESIGNAL_REST_API_KEY: 'one-key',
        ONESIGNAL_APP_ID: 'one-app'
      },
      getAccessToken: async () => 'token',
      makeClient: () => fake.client,
      sendNotification: async () => { notificationCalls += 1; }
    }),
    /commit failed/
  );
  assert.equal(notificationCalls, 0);
});

test('notification secret is required only when an update notice is requested', async () => {
  const fake = playHarness();
  await assert.rejects(
    publishRelease({
      request,
      versionCode: 11,
      bundle: Buffer.from('aab'),
      env: { GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: '{"client_email":"x","private_key":"y"}' },
      getAccessToken: async () => 'token',
      makeClient: () => fake.client
    }),
    /ONESIGNAL_REST_API_KEY/
  );
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { runRelease } from '../scripts/release-android.mjs';

function baseRequest(overrides = {}) {
  return {
    versionName: '1.3.2',
    track: 'alpha',
    status: 'draft',
    priority: 2,
    notifyUpdate: true,
    notes: { es: 'Cambios.', en: 'Changes.' },
    ...overrides
  };
}

function services({ commitFails = false } = {}) {
  const calls = [];
  return {
    calls,
    play: {
      async createEdit() { calls.push('createEdit'); return { id: 'edit-1' }; },
      async listTracks() { calls.push('listTracks'); return { tracks: [{ releases: [{ versionCodes: ['10'] }] }] }; },
      async listBundles() { calls.push('listBundles'); return { bundles: [{ versionCode: 10 }] }; },
      async uploadBundle() { calls.push('uploadBundle'); return { versionCode: 11 }; },
      async updateTrack() { calls.push('updateTrack'); return {}; },
      async validateEdit() { calls.push('validateEdit'); return {}; },
      async commitEdit() { calls.push('commitEdit'); if (commitFails) throw new Error('commit failed'); return {}; }
    },
    oneSignal: async () => { calls.push('oneSignal'); return {}; }
  };
}

test('draft request with publish=false builds and packages without Play publication', async () => {
  const svc = services();
  const buildCalls = [];
  const result = await runRelease({
    request: baseRequest(),
    state: { lastSuccessfulVersionCode: 10 },
    publish: false,
    play: svc.play,
    oneSignal: svc.oneSignal,
    build: async identity => { buildCalls.push(identity); },
    packageRelease: async identity => ({ artifact: `package-${identity.versionCode}.zip` })
  });
  assert.equal(result.versionCode, 11);
  assert.equal(buildCalls.length, 1);
  assert.deepEqual(svc.calls, ['createEdit', 'listTracks', 'listBundles']);
  assert.equal(result.published, false);
});

test('completed request with publish=true uploads, validates and commits before notification', async () => {
  const svc = services();
  const result = await runRelease({
    request: baseRequest({ status: 'completed' }),
    state: { lastSuccessfulVersionCode: 10 },
    publish: true,
    play: svc.play,
    oneSignal: svc.oneSignal,
    build: async () => {},
    packageRelease: async () => ({ artifact: 'package.zip' }),
    aabPath: 'release.aab'
  });
  assert.equal(result.published, true);
  assert.deepEqual(svc.calls, [
    'createEdit', 'listTracks', 'listBundles', 'uploadBundle', 'updateTrack', 'validateEdit', 'commitEdit', 'oneSignal'
  ]);
});

test('publish=true refuses a draft request', async () => {
  const svc = services();
  await assert.rejects(runRelease({
    request: baseRequest(), state: { lastSuccessfulVersionCode: 10 }, publish: true,
    play: svc.play, oneSignal: svc.oneSignal, build: async () => {}, packageRelease: async () => ({})
  }), /completed/i);
  assert.deepEqual(svc.calls, []);
});

test('Play commit failure prevents update notification', async () => {
  const svc = services({ commitFails: true });
  await assert.rejects(runRelease({
    request: baseRequest({ status: 'completed' }), state: { lastSuccessfulVersionCode: 10 }, publish: true,
    play: svc.play, oneSignal: svc.oneSignal, build: async () => {}, packageRelease: async () => ({}), aabPath: 'release.aab'
  }), /commit failed/);
  assert.equal(svc.calls.includes('oneSignal'), false);
});

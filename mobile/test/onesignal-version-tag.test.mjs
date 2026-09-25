import test from 'node:test';
import assert from 'node:assert/strict';
import { createOneSignalNotifications } from '../src/native/onesignal-notifications.mjs';

function fakeSdk() {
  const calls = [];
  return {
    calls,
    sdk: {
      setConsentRequired() {},
      setConsentGiven() {},
      async initialize() {},
      User: {
        async addTag(key, value) { calls.push(['tag', key, value]); },
        pushSubscription: {
          async getOptedInAsync() { return false; },
          async optIn() {},
          async optOut() {}
        }
      },
      Notifications: {
        async hasPermission() { return false; },
        async canRequestPermission() { return true; },
        async requestPermission() { return false; },
        addEventListener() {}
      }
    }
  };
}

test('start stores a valid app version tag when already known', async () => {
  const fake = fakeSdk();
  const client = createOneSignalNotifications({
    sdk: fake.sdk,
    appId: 'app-id',
    appVersion: '1.3.2',
    storage: null
  });
  assert.equal(await client.start(), true);
  assert.deepEqual(fake.calls.find(call => call[1] === 'tiflo_version'), ['tag', 'tiflo_version', '1.3.2']);
});

test('version metadata can be supplied after native app info loads', async () => {
  const fake = fakeSdk();
  const client = createOneSignalNotifications({ sdk: fake.sdk, appId: 'app-id', storage: null });
  await client.start();
  assert.equal(await client.setAppVersion('1.3.2'), true);
  assert.deepEqual(fake.calls.filter(call => call[1] === 'tiflo_version'), [['tag', 'tiflo_version', '1.3.2']]);
});

test('malformed version metadata is ignored', async () => {
  const fake = fakeSdk();
  const client = createOneSignalNotifications({ sdk: fake.sdk, appId: 'app-id', appVersion: 'beta', storage: null });
  await client.start();
  assert.equal(await client.setAppVersion('not-a-version'), false);
  assert.equal(fake.calls.some(call => call[1] === 'tiflo_version'), false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createOneSignalNotifications } from '../src/native/onesignal-notifications.mjs';

test('OneSignal stores current Android app version when available', async () => {
  const calls = [];
  const sdk = {
    setConsentRequired() {},
    setConsentGiven() {},
    async initialize() {},
    User: {
      async addTag(key, value) { calls.push([key, value]); },
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
  };

  const client = createOneSignalNotifications({
    sdk,
    appId: 'app-id',
    appVersion: () => '1.3.2',
    onDestination() {},
    storage: null
  });

  assert.equal(await client.start(), true);
  assert.deepEqual(calls.find(call => call[0] === 'tiflo_version'), ['tiflo_version', '1.3.2']);
});

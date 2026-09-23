import assert from 'node:assert/strict';
import test from 'node:test';
import { createOneSignalNotifications } from '../src/native/onesignal-notifications.mjs';

function fakeSdk({ permission = false, canRequest = true, initializeFails = false, tagFails = false } = {}) {
  const calls = [];
  let clickListener = null;
  return {
    calls,
    sdk: {
      initialize: async appId => {
        calls.push(['initialize', appId]);
        if (initializeFails) throw new Error('init failed');
      },
      User: {
        addTag: async (key, value) => {
          calls.push(['tag', key, value]);
          if (tagFails) throw new Error('tag failed');
        }
      },
      Notifications: {
        hasPermission: async () => permission,
        canRequestPermission: async () => canRequest,
        requestPermission: async fallback => {
          calls.push(['requestPermission', fallback]);
          return true;
        },
        addEventListener: (name, listener) => {
          calls.push(['listener', name]);
          if (name === 'click') clickListener = listener;
        }
      }
    },
    click(data) {
      clickListener?.({ notification: { additionalData: data } });
    }
  };
}

test('start initializes silently and tags the Android client without requesting permission', async () => {
  const fake = fakeSdk();
  const client = createOneSignalNotifications({ sdk: fake.sdk, appId: 'app-id', onDestination: () => {} });
  assert.equal(await client.start(), true);
  assert.deepEqual(fake.calls[0], ['initialize', 'app-id']);
  assert.deepEqual(fake.calls.find(call => call[0] === 'tag'), ['tag', 'tiflo_client', 'android_app']);
  assert.equal(fake.calls.some(call => call[0] === 'requestPermission'), false);
});

test('status distinguishes authorized, not-requested and denied', async () => {
  for (const [config, expected] of [
    [{ permission: true, canRequest: false }, 'authorized'],
    [{ permission: false, canRequest: true }, 'not-requested'],
    [{ permission: false, canRequest: false }, 'denied']
  ]) {
    const fake = fakeSdk(config);
    const client = createOneSignalNotifications({ sdk: fake.sdk, appId: 'app-id', onDestination: () => {} });
    await client.start();
    assert.equal(await client.adapter.status(), expected);
  }
});

test('request is explicit and does not use fallback to settings', async () => {
  const fake = fakeSdk();
  const client = createOneSignalNotifications({ sdk: fake.sdk, appId: 'app-id', onDestination: () => {} });
  await client.start();
  await client.adapter.request();
  assert.deepEqual(fake.calls.find(call => call[0] === 'requestPermission'), ['requestPermission', false]);
});

test('openSettings uses OneSignal fallback-to-settings behavior', async () => {
  const fake = fakeSdk({ permission: false, canRequest: false });
  const client = createOneSignalNotifications({ sdk: fake.sdk, appId: 'app-id', onDestination: () => {} });
  await client.start();
  assert.equal(await client.adapter.openSettings(), true);
  assert.deepEqual(fake.calls.find(call => call[0] === 'requestPermission'), ['requestPermission', true]);
});

test('click additionalData is normalized before delivery to the app', async () => {
  const fake = fakeSdk();
  const seen = [];
  const client = createOneSignalNotifications({ sdk: fake.sdk, appId: 'app-id', onDestination: value => seen.push(value) });
  await client.start();
  fake.click({ tiflo_type: 'news', tiflo_url: 'https://example.com/a' });
  assert.deepEqual(seen, [{ type: 'news', id: '', url: 'https://example.com/a', title: '' }]);
});

test('initialization failure is contained and reports unavailable', async () => {
  const fake = fakeSdk({ initializeFails: true });
  const client = createOneSignalNotifications({ sdk: fake.sdk, appId: 'app-id', onDestination: () => {} });
  assert.equal(await client.start(), false);
  assert.equal(await client.adapter.status(), 'unavailable');
  assert.equal(await client.adapter.request(), 'unavailable');
  assert.equal(await client.adapter.openSettings(), false);
});

test('optional Android audience tagging failure does not disable notifications', async () => {
  const fake = fakeSdk({ tagFails: true });
  const client = createOneSignalNotifications({ sdk: fake.sdk, appId: 'app-id', onDestination: () => {} });
  assert.equal(await client.start(), true);
  assert.equal(await client.adapter.status(), 'not-requested');
});

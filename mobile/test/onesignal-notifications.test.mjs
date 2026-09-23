import assert from 'node:assert/strict';
import test from 'node:test';
import { createOneSignalNotifications, NOTIFICATION_CONSENT_KEY } from '../src/native/onesignal-notifications.mjs';

function fakeStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    }
  };
}

function fakeSdk({
  permission = false,
  canRequest = true,
  optedIn = permission,
  requestPermissionResult = true,
  initializeFails = false,
  tagFails = false,
  optInFails = false,
  optOutFails = false
} = {}) {
  const calls = [];
  let clickListener = null;
  let currentPermission = permission;
  let currentOptedIn = optedIn;

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
        },
        pushSubscription: {
          getOptedInAsync: async () => currentPermission && currentOptedIn,
          optIn: async () => {
            calls.push(['optIn']);
            if (optInFails) throw new Error('opt in failed');
            currentOptedIn = true;
          },
          optOut: async () => {
            calls.push(['optOut']);
            if (optOutFails) throw new Error('opt out failed');
            currentOptedIn = false;
          }
        }
      },
      Notifications: {
        hasPermission: async () => currentPermission,
        canRequestPermission: async () => canRequest,
        requestPermission: async fallback => {
          calls.push(['requestPermission', fallback]);
          currentPermission = requestPermissionResult;
          return requestPermissionResult;
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
  const client = createOneSignalNotifications({ sdk: fake.sdk, appId: 'app-id', onDestination: () => {}, storage: fakeStorage() });
  assert.equal(await client.start(), true);
  assert.deepEqual(fake.calls[0], ['initialize', 'app-id']);
  assert.deepEqual(fake.calls.find(call => call[0] === 'tag'), ['tag', 'tiflo_client', 'android_app']);
  assert.equal(fake.calls.some(call => call[0] === 'requestPermission'), false);
});

test('first launch opts out even when Android already grants notifications', async () => {
  const fake = fakeSdk({ permission: true, canRequest: false, optedIn: true });
  const client = createOneSignalNotifications({ sdk: fake.sdk, appId: 'app-id', onDestination: () => {}, storage: fakeStorage() });

  assert.equal(await client.start(), true);
  assert.deepEqual(fake.calls.find(call => call[0] === 'optOut'), ['optOut']);
  assert.equal(await client.adapter.status(), 'not-requested');
  assert.equal(fake.calls.some(call => call[0] === 'requestPermission'), false);
});

test('explicit activation stores consent and opts the OneSignal subscription in', async () => {
  const storage = fakeStorage();
  const fake = fakeSdk({ permission: true, canRequest: false, optedIn: true });
  const client = createOneSignalNotifications({ sdk: fake.sdk, appId: 'app-id', onDestination: () => {}, storage });

  await client.start();
  assert.equal(await client.adapter.request(), 'authorized');
  assert.deepEqual(fake.calls.find(call => call[0] === 'requestPermission'), ['requestPermission', false]);
  assert.deepEqual(fake.calls.find(call => call[0] === 'optIn'), ['optIn']);
  assert.equal(storage.getItem(NOTIFICATION_CONSENT_KEY), '1');
});

test('persisted consent preserves an authorized subscription across restarts', async () => {
  const storage = fakeStorage({ [NOTIFICATION_CONSENT_KEY]: '1' });
  const fake = fakeSdk({ permission: true, canRequest: false, optedIn: true });
  const client = createOneSignalNotifications({ sdk: fake.sdk, appId: 'app-id', onDestination: () => {}, storage });

  assert.equal(await client.start(), true);
  assert.equal(fake.calls.some(call => call[0] === 'optOut'), false);
  assert.equal(await client.adapter.status(), 'authorized');
});

test('persisted consent re-enables OneSignal after permission is restored in system settings', async () => {
  const storage = fakeStorage({ [NOTIFICATION_CONSENT_KEY]: '1' });
  const fake = fakeSdk({ permission: true, canRequest: false, optedIn: false });
  const client = createOneSignalNotifications({ sdk: fake.sdk, appId: 'app-id', onDestination: () => {}, storage });

  await client.start();
  assert.equal(await client.adapter.status(), 'authorized');
  assert.deepEqual(fake.calls.find(call => call[0] === 'optIn'), ['optIn']);
});

test('status distinguishes not-requested and denied after the user has chosen to activate notifications', async () => {
  for (const [config, expected] of [
    [{ permission: false, canRequest: true, requestPermissionResult: false }, 'not-requested'],
    [{ permission: false, canRequest: false, requestPermissionResult: false }, 'denied']
  ]) {
    const fake = fakeSdk(config);
    const client = createOneSignalNotifications({ sdk: fake.sdk, appId: 'app-id', onDestination: () => {}, storage: fakeStorage() });
    await client.start();
    assert.equal(await client.adapter.request(), expected);
  }
});

test('request is explicit and does not use fallback to settings', async () => {
  const fake = fakeSdk();
  const client = createOneSignalNotifications({ sdk: fake.sdk, appId: 'app-id', onDestination: () => {}, storage: fakeStorage() });
  await client.start();
  await client.adapter.request();
  assert.deepEqual(fake.calls.find(call => call[0] === 'requestPermission'), ['requestPermission', false]);
});

test('openSettings uses OneSignal fallback-to-settings behavior', async () => {
  const storage = fakeStorage({ [NOTIFICATION_CONSENT_KEY]: '1' });
  const fake = fakeSdk({ permission: false, canRequest: false, requestPermissionResult: false });
  const client = createOneSignalNotifications({ sdk: fake.sdk, appId: 'app-id', onDestination: () => {}, storage });
  await client.start();
  assert.equal(await client.adapter.openSettings(), true);
  assert.deepEqual(fake.calls.find(call => call[0] === 'requestPermission'), ['requestPermission', true]);
});

test('click additionalData is normalized before delivery to the app', async () => {
  const fake = fakeSdk();
  const seen = [];
  const client = createOneSignalNotifications({ sdk: fake.sdk, appId: 'app-id', onDestination: value => seen.push(value), storage: fakeStorage() });
  await client.start();
  fake.click({ tiflo_type: 'news', tiflo_url: 'https://example.com/a' });
  assert.deepEqual(seen, [{ type: 'news', id: '', url: 'https://example.com/a', title: '' }]);
});

test('initialization failure is contained and reports unavailable', async () => {
  const fake = fakeSdk({ initializeFails: true });
  const client = createOneSignalNotifications({ sdk: fake.sdk, appId: 'app-id', onDestination: () => {}, storage: fakeStorage() });
  assert.equal(await client.start(), false);
  assert.equal(await client.adapter.status(), 'unavailable');
  assert.equal(await client.adapter.request(), 'unavailable');
  assert.equal(await client.adapter.openSettings(), false);
});

test('failure to enforce first-launch opt-out disables the notification adapter', async () => {
  const fake = fakeSdk({ permission: true, optedIn: true, optOutFails: true });
  const client = createOneSignalNotifications({ sdk: fake.sdk, appId: 'app-id', onDestination: () => {}, storage: fakeStorage() });
  assert.equal(await client.start(), false);
  assert.equal(await client.adapter.status(), 'unavailable');
});

test('optional Android audience tagging failure does not disable notifications', async () => {
  const fake = fakeSdk({ tagFails: true });
  const client = createOneSignalNotifications({ sdk: fake.sdk, appId: 'app-id', onDestination: () => {}, storage: fakeStorage() });
  assert.equal(await client.start(), true);
  assert.equal(await client.adapter.status(), 'not-requested');
});

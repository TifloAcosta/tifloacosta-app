import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUpdateNotification, sendUpdateNotification } from '../scripts/onesignal-release-notification.mjs';
import { createOneSignalNotifications } from '../src/native/onesignal-notifications.mjs';

test('update push targets Android and routes as update', () => {
  const body = buildUpdateNotification({ versionName: '1.3.2' });
  assert.equal(body.target_channel, 'push');
  assert.equal(body.isAndroid, true);
  assert.equal(body.data.tiflo_type, 'update');
  assert.equal(body.data.tiflo_version, '1.3.2');
  assert.match(body.headings.es, /Nueva versión/);
  assert.match(body.headings.en, /New version/);
  assert.deepEqual(body.filters, [{ field: 'tag', key: 'tiflo_version', relation: '!=', value: '1.3.2' }]);
});

test('REST send adds app id and secret only to authorization header', async () => {
  let request;
  const result = await sendUpdateNotification({
    appId: 'app-123', apiKey: 'rest-secret', versionName: '1.3.2',
    fetchImpl: async (url, init) => {
      request = { url, init };
      return new Response(JSON.stringify({ id: 'message-7', recipients: 3 }), {
        status: 200, headers: { 'content-type': 'application/json' }
      });
    }
  });
  assert.equal(result.id, 'message-7');
  assert.equal(request.url, 'https://api.onesignal.com/notifications');
  assert.equal(request.init.headers.Authorization, 'Key rest-secret');
  const body = JSON.parse(request.init.body);
  assert.equal(body.app_id, 'app-123');
  assert.equal(body.data.tiflo_version, '1.3.2');
  assert.equal(request.init.body.includes('rest-secret'), false);
});

test('REST errors expose status but never response or API-key secrets', async () => {
  await assert.rejects(
    sendUpdateNotification({
      appId: 'app-123', apiKey: 'rest-secret', versionName: '1.3.2',
      fetchImpl: async () => new Response(JSON.stringify({ errors: ['server-secret-value'] }), {
        status: 401, headers: { 'content-type': 'application/json' }
      })
    }),
    error => error.message.includes('401') && !error.message.includes('rest-secret') && !error.message.includes('server-secret-value')
  );
});

test('native OneSignal client stores current app version as one useful tag', async () => {
  const calls = [];
  const sdk = {
    setConsentRequired() {}, setConsentGiven() {}, initialize: async () => {},
    User: {
      addTag: async (key, value) => calls.push([key, value]),
      pushSubscription: {
        getOptedInAsync: async () => false,
        optIn: async () => {},
        optOut: async () => {}
      }
    },
    Notifications: {
      hasPermission: async () => false,
      canRequestPermission: async () => true,
      requestPermission: async () => false,
      addEventListener() {}
    }
  };
  const client = createOneSignalNotifications({
    sdk, appId: 'app-id', appVersion: '1.3.2', storage: null, onDestination: () => {}
  });
  assert.equal(await client.start(), true);
  assert.deepEqual(calls.find(([key]) => key === 'tiflo_version'), ['tiflo_version', '1.3.2']);
});

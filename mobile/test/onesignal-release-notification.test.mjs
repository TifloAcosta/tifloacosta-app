import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildUpdateNotification,
  sendUpdateNotification
} from '../scripts/onesignal-release-notification.mjs';

test('update push targets Android app subscribers and routes as update', () => {
  const body = buildUpdateNotification({ versionName: '1.3.2', versionCode: 11, appId: 'app-id' });
  assert.equal(body.app_id, 'app-id');
  assert.equal(body.target_channel, 'push');
  assert.deepEqual(body.filters, [
    { field: 'tag', key: 'tiflo_client', relation: '=', value: 'android_app' }
  ]);
  assert.equal(body.data.tiflo_type, 'update');
  assert.equal(body.data.tiflo_version, '1.3.2');
  assert.equal(body.data.tiflo_version_code, 11);
  assert.match(body.headings.es, /Nueva versión/);
  assert.match(body.headings.en, /New version/);
  assert.equal('included_segments' in body, false);
  assert.equal('isAndroid' in body, false);
});

test('update push rejects an invalid Android version code', () => {
  assert.throws(
    () => buildUpdateNotification({ versionName: '1.3.2', versionCode: 0, appId: 'app-id' }),
    /versionCode/
  );
});

test('update push uses OneSignal REST auth without leaking the key on failure', async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    return new Response(JSON.stringify({ errors: ['bad secret-key'] }), { status: 401 });
  };

  await assert.rejects(
    sendUpdateNotification({
      appId: 'app-id',
      apiKey: 'secret-key',
      versionName: '1.3.2',
      versionCode: 11,
      fetchImpl
    }),
    error => {
      assert.match(error.message, /401/);
      assert.doesNotMatch(error.message, /secret-key/);
      return true;
    }
  );

  assert.equal(requests[0].url, 'https://api.onesignal.com/notifications');
  assert.equal(requests[0].options.headers.Authorization, 'Key secret-key');
  assert.equal(requests[0].options.headers['Content-Type'], 'application/json');
});

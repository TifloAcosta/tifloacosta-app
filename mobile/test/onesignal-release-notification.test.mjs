import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUpdateNotification, sendUpdateNotification } from '../scripts/onesignal-release-notification.mjs';

test('update push targets Android users who are not already on the new version', () => {
  const body = buildUpdateNotification({ versionName: '1.3.2' });
  assert.equal(body.isAndroid, true);
  assert.equal(body.target_channel, 'push');
  assert.deepEqual(body.filters, [
    { field: 'app_version', relation: '!=', value: '1.3.2' }
  ]);
  assert.equal(body.data.tiflo_type, 'update');
  assert.equal(body.data.tiflo_version, '1.3.2');
  assert.match(body.headings.es, /Nueva versión/);
  assert.match(body.contents.es, /1\.3\.2/);
});

test('sender keeps REST API key out of errors', async () => {
  await assert.rejects(
    sendUpdateNotification({
      appId: 'app-id',
      apiKey: 'secret-rest-key',
      versionName: '1.3.2',
      fetchImpl: async () => new Response('{"errors":["denied"]}', { status: 401 })
    }),
    error => {
      assert.match(error.message, /401/);
      assert.doesNotMatch(error.message, /secret-rest-key/);
      return true;
    }
  );
});

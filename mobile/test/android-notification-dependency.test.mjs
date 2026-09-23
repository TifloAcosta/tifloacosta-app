import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const mobileRead = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const repoRead = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('mobile pins the OneSignal Capacitor plugin used for Android push', async () => {
  const pkg = JSON.parse(await mobileRead('package.json'));
  assert.equal(pkg.dependencies['@onesignal/capacitor-plugin'], '1.1.6');
});

test('Android CI disables the unused OneSignal location module', async () => {
  const workflow = await repoRead('.github/workflows/bootstrap-mobile-android.yml');
  assert.match(workflow, /ONESIGNAL_DISABLE_LOCATION/);
});

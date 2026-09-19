import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('Android bootstrap is isolated, reproducible and supports secret-backed release signing', async () => {
  const [workflow, buildGradle, gitignore] = await Promise.all([
    read('.github/workflows/bootstrap-mobile-android.yml'),
    read('mobile/android/app/build.gradle'),
    read('.gitignore')
  ]);

  for (const expected of [
    'feature/android-downloads-reconciliation',
    'contents: read',
    'node-version: 22',
    'java-version: 21',
    'npm install',
    'npm test',
    'npx cap add android',
    'npx cap sync android',
    './gradlew --no-daemon assembleDebug bundleRelease',
    'actions/upload-artifact@v4',
    'mobile/android',
    'secrets.TIFLOACOSTA_KEYSTORE_BASE64',
    'secrets.TIFLOACOSTA_KEYSTORE_PASSWORD',
    'keytool -list -v',
    '-storetype PKCS12',
    'PrivateKeyEntry',
    'tifloacosta-upload.p12'
  ]) {
    assert.ok(workflow.includes(expected), `Android bootstrap missing: ${expected}`);
  }

  assert.equal(workflow.includes('feature/mobile-capacitor-foundation'), false, 'Validation must not be tied to the retired mobile branch');
  assert.equal(workflow.includes('git push origin'), false, 'Validation must not mutate the repository');
  assert.equal(workflow.includes('ANDROID_KEY_ALIAS_SECRET: tifloacosta-upload'), false, 'Signing must not assume the alias written in the helper note is the actual PKCS12 alias');
  assert.match(workflow, /for attempt in 1 2 3/);
  assert.match(workflow, /base64\s+--decode|base64\s+-d/);

  for (const expected of [
    'signingConfigs',
    'ANDROID_KEYSTORE_PATH',
    'ANDROID_KEYSTORE_PASSWORD',
    'ANDROID_KEY_ALIAS',
    'ANDROID_KEY_PASSWORD',
    'signingConfig signingConfigs.release'
  ]) {
    assert.ok(buildGradle.includes(expected), `Android release signing missing: ${expected}`);
  }

  for (const expected of ['*.jks', '*.keystore', 'keystore.properties']) {
    assert.ok(gitignore.includes(expected), `Git ignore must protect: ${expected}`);
  }
});

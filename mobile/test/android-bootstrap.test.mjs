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
    'feature/mobile-capacitor-foundation',
    'contents: write',
    "contains(github.event.head_commit.message, '[skip mobile-bootstrap]')",
    'node-version: 22',
    'java-version: 21',
    'npm install',
    'npm test',
    'npx cap add android',
    'npx cap sync android',
    './gradlew --no-daemon assembleDebug bundleRelease',
    'actions/upload-artifact@v4',
    'mobile/package-lock.json',
    'mobile/android',
    '[skip mobile-bootstrap]',
    'secrets.TIFLOACOSTA_KEYSTORE_BASE64',
    'secrets.TIFLOACOSTA_KEYSTORE_PASSWORD',
    'tifloacosta-upload',
    'tifloacosta-upload.p12'
  ]) {
    assert.ok(workflow.includes(expected), `Android bootstrap missing: ${expected}`);
  }

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

  for (const forbidden of [
    'storePassword "',
    "storePassword '",
    'keyPassword "',
    "keyPassword '"
  ]) {
    assert.equal(buildGradle.includes(forbidden), false, `Signing credentials must not be hardcoded: ${forbidden}`);
  }
});

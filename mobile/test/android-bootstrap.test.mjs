import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readWorkflow = () => readFile(new URL('../../.github/workflows/bootstrap-mobile-android.yml', import.meta.url), 'utf8');

test('Android bootstrap is isolated, reproducible and does not contain signing secrets', async () => {
  const workflow = await readWorkflow();

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
    '[skip mobile-bootstrap]'
  ]) {
    assert.ok(workflow.includes(expected), `Android bootstrap missing: ${expected}`);
  }

  assert.match(workflow, /for attempt in 1 2 3/);

  for (const forbidden of [
    'KEYSTORE_PASSWORD',
    'KEY_PASSWORD',
    'SIGNING_KEY',
    'ANDROID_KEYSTORE',
    'storePassword',
    'keyPassword'
  ]) {
    assert.equal(workflow.includes(forbidden), false, `Signing material must not appear in bootstrap: ${forbidden}`);
  }
});

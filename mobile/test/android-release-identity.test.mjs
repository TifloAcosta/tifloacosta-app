import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const gradle = await readFile(new URL('../android/app/build.gradle', import.meta.url), 'utf8');

test('Gradle accepts release version overrides', () => {
  assert.match(gradle, /TIFLO_ANDROID_VERSION_NAME/);
  assert.match(gradle, /TIFLO_ANDROID_VERSION_CODE/);
  assert.match(gradle, /Integer\.parseInt/);
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const repoRead = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('Android 1.3.1 release candidate uses version code 10', async () => {
  const gradle = await read('android/app/build.gradle');
  assert.match(gradle, /versionCode\s+10/);
  assert.match(gradle, /versionName\s+"1\.3\.1"/);
  assert.doesNotMatch(gradle, /versionCode\s+9/);
  assert.doesNotMatch(gradle, /versionName\s+"1\.3\.0"/);
});

test('Android 1.3.1 keeps native Share and bounded web fetch plugins', async () => {
  const manifest = await read('android/app/src/main/AndroidManifest.xml');
  const mainActivity = await read('android/app/src/main/java/com/tifloacosta/app/MainActivity.java');
  assert.match(manifest, /android\.intent\.action\.SEND/);
  assert.match(manifest, /android:mimeType="text\/plain"/);
  assert.doesNotMatch(manifest, /SEND_MULTIPLE/);
  assert.match(mainActivity, /registerPlugin\(TifloSharePlugin\.class\)/);
  assert.match(mainActivity, /registerPlugin\(TifloWebFetchPlugin\.class\)/);
});

test('Android CI verifies the release AAB signature whenever signing secrets are available', async () => {
  const workflow = await repoRead('.github/workflows/bootstrap-mobile-android.yml');
  assert.match(workflow, /Verify signed Android release bundle/);
  assert.match(workflow, /jarsigner\s+-verify/);
  assert.match(workflow, /ANDROID_KEYSTORE_PATH/);
  assert.match(workflow, /app-release\.aab/);
});

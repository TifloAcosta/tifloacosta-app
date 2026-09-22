import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('integrated Android candidate is version 1.1.0 code 6', async () => {
  const gradle = await read('android/app/build.gradle');
  assert.match(gradle, /versionCode\s+6/);
  assert.match(gradle, /versionName\s+"1\.1\.0"/);
  assert.doesNotMatch(gradle, /versionCode\s+5/);
});

test('release candidate includes native Share and bounded web fetch plugins', async () => {
  const manifest = await read('android/app/src/main/AndroidManifest.xml');
  const mainActivity = await read('android/app/src/main/java/com/tifloacosta/app/MainActivity.java');
  assert.match(manifest, /android\.intent\.action\.SEND/);
  assert.match(manifest, /android:mimeType="text\/plain"/);
  assert.doesNotMatch(manifest, /SEND_MULTIPLE/);
  assert.match(mainActivity, /registerPlugin\(TifloSharePlugin\.class\)/);
  assert.match(mainActivity, /registerPlugin\(TifloWebFetchPlugin\.class\)/);
});

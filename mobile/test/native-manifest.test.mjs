import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('iOS declares only the external app query schemes used by TifloAcosta', async () => {
  const plist = await readFile(new URL('../ios/App/App/Info.plist', import.meta.url), 'utf8');
  for (const scheme of ['youtube', 'whatsapp', 'spotify']) {
    assert.match(plist, new RegExp(`<string>${scheme}</string>`));
  }
  assert.match(plist, /<string>tifloacosta<\/string>/);
});

test('Android declares app queries and the development TifloAcosta scheme', async () => {
  const manifest = await readFile(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
  for (const packageName of ['com.google.android.youtube', 'com.whatsapp', 'com.spotify.music']) {
    assert.match(manifest, new RegExp(`android:name="${packageName.replaceAll('.', '\\.')}`));
  }
  assert.match(manifest, /android:scheme="tifloacosta"/);
  assert.doesNotMatch(manifest, /READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE|MANAGE_EXTERNAL_STORAGE/);
});
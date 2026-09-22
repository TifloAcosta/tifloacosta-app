import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = async path => {
  try {
    return await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  } catch {
    return '';
  }
};

test('Android registers TifloAcosta as a text share target without accepting multi-file shares', async () => {
  const manifest = await read('android/app/src/main/AndroidManifest.xml');
  assert.match(manifest, /android\.intent\.action\.SEND/);
  assert.match(manifest, /android:mimeType="text\/plain"/);
  assert.doesNotMatch(manifest, /SEND_MULTIPLE/);
});

test('native share plugin receives initial/new text shares and can finish the temporary flow', async () => {
  const [mainActivity, plugin] = await Promise.all([
    read('android/app/src/main/java/com/tifloacosta/app/MainActivity.java'),
    read('android/app/src/main/java/com/tifloacosta/app/TifloSharePlugin.java')
  ]);
  assert.match(mainActivity, /registerPlugin\(TifloSharePlugin\.class\)/);
  assert.match(plugin, /@CapacitorPlugin\(name\s*=\s*"TifloShare"\)/);
  assert.match(plugin, /Intent\.EXTRA_TEXT/);
  assert.match(plugin, /handleOnNewIntent/);
  assert.match(plugin, /notifyListeners\("shareReceived"/);
  assert.match(plugin, /moveTaskToBack\(true\)/);
  assert.doesNotMatch(plugin, /EXTRA_STREAM/);
});

test('JavaScript share wrapper has safe non-native fallbacks', async () => {
  const wrapper = await read('src/native/share-plugin.mjs');
  assert.match(wrapper, /getInitialShare/);
  assert.match(wrapper, /addListener/);
  assert.match(wrapper, /finishShare/);
  assert.match(wrapper, /shared:\s*false/);
});

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

test('native web fetch plugin enforces the approved safety limits and content types', async () => {
  const [mainActivity, fetchPlugin, wrapper] = await Promise.all([
    read('android/app/src/main/java/com/tifloacosta/app/MainActivity.java'),
    read('android/app/src/main/java/com/tifloacosta/app/TifloWebFetchPlugin.java'),
    read('src/native/web-fetch-plugin.mjs')
  ]);
  assert.match(mainActivity, /registerPlugin\(TifloWebFetchPlugin\.class\)/);
  assert.match(fetchPlugin, /MAX_REDIRECTS\s*=\s*5/);
  assert.match(fetchPlugin, /MAX_BODY_BYTES\s*=\s*5\s*\*\s*1024\s*\*\s*1024/);
  assert.match(fetchPlugin, /TOTAL_TIMEOUT_MS\s*=\s*15000/);
  assert.match(fetchPlugin, /setInstanceFollowRedirects\(false\)/);
  assert.match(fetchPlugin, /text\/html/);
  assert.match(fetchPlugin, /application\/xhtml\+xml/);
  assert.match(fetchPlugin, /text\/plain/);
  assert.match(fetchPlugin, /User-Agent/);
  assert.doesNotMatch(fetchPlugin, /Cookie/);
  for (const code of ['invalid_url','too_many_redirects','timeout','too_large','unsupported_type','http_error','unreachable']) {
    assert.match(wrapper, new RegExp(code));
  }
});

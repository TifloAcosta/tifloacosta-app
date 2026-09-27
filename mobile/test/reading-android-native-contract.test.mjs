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

test('reading android native contract registers the Capacitor plugin and bridge methods', async () => {
  const plugin = await read('android/app/src/main/java/com/tifloacosta/app/TifloReadingPlugin.java');
  const activity = await read('android/app/src/main/java/com/tifloacosta/app/MainActivity.java');

  assert.match(plugin, /@CapacitorPlugin\(name\s*=\s*"TifloReading"\)/);
  for (const method of ['pickDocuments', 'consumeInitialSharedDocuments', 'listBooks', 'openBook', 'saveProgress', 'deleteBook', 'getLatestInProgress']) {
    assert.match(plugin, new RegExp(`public\\s+void\\s+${method}\\s*\\(PluginCall\\s+call\\)`), `Missing ${method}`);
  }
  assert.match(plugin, /notifyListeners\("documentsReceived"/);
  assert.match(activity, /registerPlugin\(TifloReadingPlugin\.class\)/);
});

test('reading android native contract uses the Android document picker for multiple plain text files', async () => {
  const plugin = await read('android/app/src/main/java/com/tifloacosta/app/TifloReadingPlugin.java');

  assert.match(plugin, /Intent\.ACTION_OPEN_DOCUMENT/);
  assert.match(plugin, /Intent\.CATEGORY_OPENABLE/);
  assert.match(plugin, /setType\("text\/plain"\)/);
  assert.match(plugin, /Intent\.EXTRA_ALLOW_MULTIPLE/);
  assert.match(plugin, /getClipData\(\)/);
  assert.match(plugin, /getData\(\)/);
});

test('reading android native contract keeps text sharing separate from shared file streams', async () => {
  const plugin = await read('android/app/src/main/java/com/tifloacosta/app/TifloReadingPlugin.java');
  const share = await read('android/app/src/main/java/com/tifloacosta/app/TifloSharePlugin.java');
  const manifest = await read('android/app/src/main/AndroidManifest.xml');

  assert.match(plugin, /Intent\.ACTION_SEND/);
  assert.match(plugin, /Intent\.ACTION_SEND_MULTIPLE/);
  assert.match(plugin, /Intent\.EXTRA_STREAM/);
  assert.match(plugin, /getBridge\(\)\.execute/);

  assert.match(share, /Intent\.EXTRA_STREAM/);
  assert.match(share, /sharedText\(/);

  assert.match(manifest, /android\.intent\.action\.SEND_MULTIPLE/);
  assert.doesNotMatch(manifest, /READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE|MANAGE_EXTERNAL_STORAGE|READ_MEDIA_/);
});

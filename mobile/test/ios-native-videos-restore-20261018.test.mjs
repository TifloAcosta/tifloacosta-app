import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const nativeSource = path => readFile(new URL('../../ios-build/' + path, import.meta.url), 'utf8');

test('iOS Videos uses the existing native UIKit section, not a stacked web screen', async () => {
  const app = await source('src/app.mjs');
  const home = await source('src/screens/home.mjs');
  const plugin = await nativeSource('native/TifloReadingAccessibilityPlugin.swift');
  assert.match(app, /showNativeVideoSection\(\{/);
  assert.match(app, /onOpenVideos: iosAccessibilityPlugin \? openNativeVideos : null/);
  assert.match(app, /videoId\(item\)/);
  assert.match(app, /nativeVideoClosed/);
  assert.match(home, /if \(key === 'videos' && typeof onOpenVideos === 'function'\)/);
  assert.match(home, /if \(!opened\) router\.navigate\(key/);
  assert.match(plugin, /navigation\.view\.accessibilityViewIsModal = true/);
  assert.match(plugin, /notifyListeners\("nativeVideoClosed"/);
});

test('native video rows expose VoiceOver actions without a second context menu', async () => {
  const native = await nativeSource('native/TifloNativeVideosController.swift');
  assert.match(native, /cell\.accessibilityCustomActions = handlers\.map/);
  assert.match(native, /\("play", "Reproducir"\)/);
  assert.match(native, /\("share", "Compartir"\)/);
  assert.doesNotMatch(native, /contextMenuConfigurationForRowAt/);
});

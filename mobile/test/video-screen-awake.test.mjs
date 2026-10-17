import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = file => readFile(new URL('../' + file, import.meta.url), 'utf8');

test('Android holds the screen only while a visible YouTube video is playing', async () => {
  const [player, plugin, activity] = await Promise.all([
    read('src/screens/video-player.mjs'),
    read('android/app/src/main/java/com/tifloacosta/app/TifloVideoScreenPlugin.java'),
    read('android/app/src/main/java/com/tifloacosta/app/MainActivity.java')
  ]);
  assert.match(player, /function syncScreenAwake\(\)/);
  assert.match(player, /!disposed && opened && playerReady && playerIsPlaying/);
  assert.match(player, /document\.visibilityState !== 'hidden'/);
  assert.match(player, /TifloVideoScreen\?\.setKeepScreenOn/);
  assert.match(player, /document\.addEventListener\('visibilitychange', onVisibilityChange\)/);
  assert.match(player, /document\.removeEventListener\('visibilitychange', onVisibilityChange\)/);
  assert.match(plugin, /@CapacitorPlugin\(name = "TifloVideoScreen"\)/);
  assert.match(plugin, /WindowManager\.LayoutParams\.FLAG_KEEP_SCREEN_ON/);
  assert.match(plugin, /activity\.getWindow\(\)\.clearFlags\(WindowManager\.LayoutParams\.FLAG_KEEP_SCREEN_ON\)/);
  assert.match(activity, /registerPlugin\(TifloVideoScreenPlugin\.class\)/);
  assert.match(activity, /protected void onPause\(\)/);
  assert.match(activity, /clearFlags\(WindowManager\.LayoutParams\.FLAG_KEEP_SCREEN_ON\)/);
});

test('Player releases screen at pause, error, close, route cleanup and background', async () => {
  const player = await read('src/screens/video-player.mjs');
  assert.match(player, /playerIsPlaying = playingState[^;]+;\s*syncScreenAwake\(\)/);
  assert.match(player, /function markUnavailable\(\) \{[\s\S]*?syncScreenAwake\(\)/);
  assert.match(player, /opened = false;\s*detailsOpen = false;\s*playerIsPlaying = false;\s*syncScreenAwake\(\)/);
  assert.match(player, /disposed = true;\s*opened = false;\s*playerIsPlaying = false;\s*syncScreenAwake\(\)/);
  // No autoplay or background playback is added to YouTube's official iframe.
  assert.match(player, /autoplay: 0/);
  assert.doesNotMatch(player, /FOREGROUND_SERVICE/);
});

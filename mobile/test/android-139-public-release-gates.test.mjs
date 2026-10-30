import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL('../../' + path, import.meta.url), 'utf8');

test('Android public launcher must open native interface, not Capacitor BridgeActivity', async () => {
  const [appManifest, nativeManifest] = await Promise.all([
    read('mobile/android/app/src/main/AndroidManifest.xml'),
    read('android-native-prototype/library/src/main/AndroidManifest.xml')
  ]);
  assert.doesNotMatch(
    appManifest,
    /android:name="\.MainActivity"[\s\S]*?<action android:name="android\.intent\.action\.MAIN"\s*\/>/,
    'The public launcher cannot remain the WebView activity'
  );
  assert.match(
    nativeManifest,
    /NativePrototypeActivity[\s\S]*?<action android:name="android\.intent\.action\.MAIN"/,
    'The native activity must be the public launcher'
  );
});

test('the public Videos route must open the native TalkBack row, not HTML cards', async () => {
  const [app, native, row] = await Promise.all([
    read('mobile/src/app.mjs'),
    read('android-native-prototype/app/src/main/java/com/tifloacosta/nativeprototype/NativePrototypeActivity.kt'),
    read('android-native-prototype/app/src/main/java/com/tifloacosta/nativeprototype/NativeYouTubeListRow.kt')
  ]);
  assert.match(app, /case 'videos':\s*\{[\s\S]*?NativeFeatures\.openNativeVideos\(/);
  assert.match(native, /NativeYouTubeListRow\(/);
  assert.match(row, /customActions = actions\.map/);
  assert.match(row, /setProgress\s*\{/);
});

test('Mi libro is accessible under Contacto but absent from the start menu', async () => {
  const [home, contact] = await Promise.all([
    read('mobile/src/screens/home.mjs'),
    read('mobile/src/screens/contact.mjs')
  ]);
  assert.doesNotMatch(home, /^\s*'book',/m);
  assert.ok(contact.includes("router.navigate('book'"));
});

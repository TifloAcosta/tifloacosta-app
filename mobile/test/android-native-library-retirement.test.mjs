import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = p => readFile(new URL('../../' + p, import.meta.url), 'utf8');

test('TifloLector native is the default library; old books only appear on explicit request', async () => {
  const native = await read('android-native-prototype/app/src/main/java/com/tifloacosta/nativeprototype/NativeTifloLector.kt');
  assert.match(native, /NativeReaderStore\(context\.applicationContext\)/);
  assert.match(native, /if \(screen == "legacy"\)/);
  assert.match(native, /screen = "legacy"/);
  assert.match(native, /if \(legacyState\?\.databasePresent == true && legacyState\?\.bookCount != 0\)/);
  assert.match(native, /NativeReaderLegacyStrings\.get\(uiLanguage, "legacyRecover"\)/);
  const labels = await read('android-native-prototype/app/src/main/java/com/tifloacosta/nativeprototype/NativeReaderLegacyStrings.kt');
  assert.match(labels, /Recuperar biblioteca anterior \(opcional\)/);
});

test('the retirement step keeps original documents and old database recoverable', async () => {
  const [native, audit] = await Promise.all([
    read('android-native-prototype/app/src/main/java/com/tifloacosta/nativeprototype/NativeTifloLector.kt'),
    read('android-native-prototype/app/src/main/java/com/tifloacosta/nativeprototype/NativeLegacyLibraryCheck.kt')
  ]);
  assert.match(native, /openPreviousBook\(previous\.id\)/);
  assert.match(audit, /SQLiteDatabase\.OPEN_READONLY/);
  assert.doesNotMatch(native, /deleteDatabase\(|clearApplicationUserData\(/);
  assert.doesNotMatch(audit, /deleteDatabase\(|clearApplicationUserData\(/);
});

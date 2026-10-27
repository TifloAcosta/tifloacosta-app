import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = async path => readFile(new URL(path, import.meta.url), 'utf8');

test('native integration retains production package identity and minimum Android API', async () => {
  const gradle = await source('../android/app/build.gradle');
  const variables = await source('../android/variables.gradle');
  const capacitor = JSON.parse(await source('../capacitor.config.json'));
  assert.match(gradle, /applicationId\s+"com\.tifloacosta\.app"/);
  assert.equal(capacitor.appId, 'com.tifloacosta.app');
  assert.match(variables, /minSdkVersion\s*=\s*24/);
});

test('native integration does not replace existing SQLite library or file store', async () => {
  const app = await source('../android/app/src/main/java/com/tifloacosta/app/MainActivity.java');
  const database = await source('../android/app/src/main/java/com/tifloacosta/app/reading/ReadingLibraryDatabase.java');
  const files = await source('../android/app/src/main/java/com/tifloacosta/app/reading/AndroidReadingFileStore.java');
  const router = await source('../src/app.mjs');
  const native = await source('../../android-native-prototype/app/src/main/java/com/tifloacosta/nativeprototype/NativeReaderStore.kt');
  assert.match(database, /DATABASE_NAME\s*=\s*"tiflo_reading\.db"/);
  assert.match(files, /"reading-library"/);
  assert.match(native, /"tiflolector-native"/);
  assert.match(router, /case 'reading-library'/);
  assert.match(router, /case 'reading-book'/);
  assert.match(app, /registerPlugin\(TifloReadingLibraryPlugin\.class\)/);
  assert.doesNotMatch(app, /clearApplicationUserData|deleteDatabase/);
});

test('native integration keeps existing video actions and reader accessible while migrating', async () => {
  const app = await source('../src/app.mjs');
  const main = await source('../android/app/src/main/java/com/tifloacosta/app/MainActivity.java');
  const request = JSON.parse(await source('../release/request.json'));
  assert.match(app, /case 'videos'/);
  assert.match(main, /registerPlugin\(TifloNativeFeaturesPlugin\.class\)/);
  assert.equal(request.status, 'draft', 'Do not publish until real upgrade and OAuth tests pass');
  assert.equal(request.confirmProduction, false);
});

test('legacy migration preflight is read-only and reports data instead of replacing it', async () => {
  const bridge = await source('../android/app/src/main/java/com/tifloacosta/app/TifloNativeFeaturesPlugin.java');
  assert.match(bridge, /inspectLegacyLibrary\(PluginCall call\)/);
  assert.match(bridge, /SQLiteDatabase\.OPEN_READONLY/);
  assert.match(bridge, /SELECT COUNT\(\*\) FROM /);
  assert.match(bridge, /legacyDatabaseExists/);
  assert.match(bridge, /migrationCompleted", false/);
  assert.match(bridge, /missingBookSources/);
  assert.match(bridge, /missingAudioTracks/);
  assert.match(bridge, /missingDerivedFiles/);
  assert.match(bridge, /unsafeStoredPaths/);
  assert.match(bridge, /preflightSafe/);
  assert.match(bridge, /getCanonicalPath\(\)/);
  assert.match(bridge, /candidate\.isFile\(\)/);
  assert.match(bridge, /SELECT relative_path FROM /);
  assert.doesNotMatch(bridge, /getWritableDatabase\(|deleteDatabase\(|clearApplicationUserData\(/);
});

test('the trial exposes an accessible library check without triggering migration', async () => {
  const settings = await source('../src/screens/settings.mjs');
  assert.match(settings, /NativeFeatures\.inspectLegacyLibrary\(\)/);
  assert.match(settings, /Comprobar biblioteca existente \(sin cambios\)/);
  assert.match(settings, /previewStatus\.setAttribute\('aria-live', 'polite'\)/);
  assert.match(settings, /missingBookSources/);
  assert.match(settings, /missingAudioTracks/);
  assert.doesNotMatch(settings, /NativeFeatures\.migrateLegacyLibrary\(/);
});

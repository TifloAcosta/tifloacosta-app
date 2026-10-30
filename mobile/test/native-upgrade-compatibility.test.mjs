import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = async path => readFile(new URL(path, import.meta.url), 'utf8');

const readShareManifests = async () =>
  (await source('../android/app/src/main/AndroidManifest.xml')) +
  (await source('../../android-native-prototype/library/src/main/AndroidManifest.xml'));

test('older books are listed read-only and open with original IDs, marks and progress', async () => {
  const legacy = await source('../../android-native-prototype/app/src/main/java/com/tifloacosta/nativeprototype/NativeLegacyLibraryCheck.kt');
  const native = await source('../../android-native-prototype/app/src/main/java/com/tifloacosta/nativeprototype/NativeTifloLector.kt');
  const bridge = await source('../android/app/src/main/java/com/tifloacosta/app/TifloNativeFeaturesPlugin.java');
  const app = await source('../src/app.mjs');

  assert.match(legacy, /SQLiteDatabase\.OPEN_READONLY/);
  assert.match(legacy, /SELECT id, title, format FROM books/);
  assert.match(legacy, /LIMIT \? OFFSET \?/);
  assert.doesNotMatch(legacy, /getWritableDatabase\(|deleteDatabase\(/);
  assert.match(native, /legacyBooks\.forEach/);
  assert.match(native, /openPreviousBook\(previous\.id\)/);
  assert.match(native, /putString\("open-existing-book-id", bookId\)/);
  assert.match(bridge, /getString\("open-existing-book-id"/);
  assert.match(bridge, /result\.put\("bookId", bookId/);
  assert.match(app, /if \(bookId\) openReadingBook\(bookId\)/);
  assert.match(app, /percent != null && Number\.isFinite\(Number\(percent\)\)/);
  assert.match(app, /router\.start\('home'\)/);
  assert.match(app, /void restoreExistingReaderNavigation\(\)/);
  assert.match(app, /consumeNativeHomeDestination\(\)/);
});

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
  assert.equal(request.track, 'production');
  assert.equal(request.status, 'completed', 'Production release must be explicitly authorized');
  assert.equal(request.notifyUpdate, false);
  assert.equal(request.confirmProduction, true);
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

test('native reader warns about unmigrated legacy books instead of showing a false empty library', async () => {
  const audit = await source('../../android-native-prototype/app/src/main/java/com/tifloacosta/nativeprototype/NativeLegacyLibraryCheck.kt');
  const reader = await source('../../android-native-prototype/app/src/main/java/com/tifloacosta/nativeprototype/NativeTifloLector.kt');
  assert.match(audit, /SQLiteDatabase\.OPEN_READONLY/);
  assert.match(audit, /LegacyLibraryState\(null, true\)/);
  assert.doesNotMatch(audit, /SQLiteOpenHelper|OPEN_READWRITE|deleteDatabase/);
  assert.match(reader, /NativeLegacyLibraryCheck\.inspect/);
  assert.match(reader, /Libros que ya tenías/);
  assert.match(reader, /legacyBooks\.forEach/);
  assert.match(reader, /openPreviousBook\(previous\.id\)/);
  assert.match(reader, /No se pudo comprobar la biblioteca anterior/);
});

test('Android API24 legacy Office compatibility requirements remain accounted for in release', async () => {
  const lib = await source('../../android-native-prototype/library/build.gradle');
  const prototype = await source('../../android-native-prototype/app/build.gradle.kts');
  const office = await source('../../android-native-prototype/app/src/main/java/com/tifloacosta/nativeprototype/NativeReaderLegacyOffice.kt');
  const request = JSON.parse(await source('../release/request.json'));
  assert.match(lib, /org\.apache\.poi:poi:4\.1\.2/);
  assert.match(lib, /org\.apache\.poi:poi-scratchpad:4\.1\.2/);
  assert.match(prototype, /org\.apache\.poi:poi:4\.1\.2/);
  assert.match(office, /setOf\("doc", "xls", "ppt", "pps"\)/);
  assert.match(lib, /CVE-2022-26336/);
  assert.match(lib, /javax\.xml\.bind:jaxb-api:2\.3\.1/);
  assert.equal(request.track, 'production');
  assert.equal(request.status, 'completed', 'Only the authorized production request can ship');
  assert.equal(request.confirmProduction, true);
});


test('document shares route to TifloLector while ordinary text sharing is preserved', async () => {
  const main = await source('../android/app/src/main/java/com/tifloacosta/app/MainActivity.java');
  const share = await source('../android/app/src/main/java/com/tifloacosta/app/TifloSharePlugin.java');
  const native = await source('../../android-native-prototype/app/src/main/java/com/tifloacosta/nativeprototype/NativePrototypeActivity.kt');
  assert.match(main, /forwardDocumentShareToReader\(getIntent\(\)\)/);
  assert.match(main, /forwardDocumentShareToReader\(intent\)/);
  assert.match(main, /Intent\.ACTION_SEND_MULTIPLE/);
  assert.match(main, /Intent\.EXTRA_STREAM/);
  assert.match(main, /Intent\.FLAG_GRANT_READ_URI_PERMISSION/);
  assert.match(main, /new Intent\(incoming\)/);
  assert.match(share, /String text = sharedText\(intent\)/);
  assert.match(native, /acceptSharedFiles\(intent\)/);
  assert.match(native, /NativeTifloLector\(/);
  const reader = await source('../../android-native-prototype/app/src/main/java/com/tifloacosta/nativeprototype/NativeTifloLector.kt');
  assert.match(reader, /sharedUris\.size == 1 && importedSharedBooks\.size == 1/);
  assert.match(reader, /selectedBook = book/);
});

test('existing library can be reached from native reader without migrating or deleting books', async () => {
  const bridge = await source('../android/app/src/main/java/com/tifloacosta/app/TifloNativeFeaturesPlugin.java');
  const app = await source('../src/app.mjs');
  const settings = await source('../src/screens/settings.mjs');
  const reader = await source('../../android-native-prototype/app/src/main/java/com/tifloacosta/nativeprototype/NativeTifloLector.kt');
  assert.match(bridge, /consumeExistingReaderNavigation/);
  assert.match(bridge, /open-existing-library/);
  assert.match(app, /restoreExistingReaderNavigation/);
  assert.match(app, /router.navigate\('reading-library'\)/);
  assert.match(settings, /export const NativeFeatures/);
  assert.match(reader, /Abrir biblioteca anterior/);
  assert.match(reader, /FLAG_ACTIVITY_CLEAR_TOP/);
  assert.doesNotMatch(reader, /deleteDatabase\(/);
});

test('public video section exposes native YouTube account actions without requiring login for search', async () => {
  const videos = await source('../src/screens/videos.mjs');
  const native = await source('../../android-native-prototype/app/src/main/java/com/tifloacosta/nativeprototype/NativeYouTubeAccount.kt');
  assert.match(videos, /NativeFeatures.openNativeVideos\(\)/);
  assert.match(videos, /accountButton\.addEventListener\('click'/);
  assert.match(videos, /accountStatus\.setAttribute\('aria-live', 'polite'\)/);
  assert.match(videos, /No necesitas iniciar sesión en Google/);
  assert.match(native, /private const val PREFS = "youtube-native-private"/);
  assert.match(native, /fun startAuthorization\(\)/);
  assert.match(native, /fun signOut\(\)/);
});

test('share manifest advertises OCR images, legacy Office and DAISY archives', async () => {
  const manifest = await readShareManifests();
  for (const mime of [
    'image/jpeg', 'image/png', 'image/webp', 'image/heic',
    'application/pdf', 'application/epub+zip', 'application/msword',
    'application/vnd.ms-excel', 'application/vnd.ms-powerpoint',
    'application/zip', 'application/x-7z-compressed',
    'application/x-rar-compressed'
  ]) assert.ok(manifest.includes('android:mimeType="' + mime + '"'), 'missing shared MIME: ' + mime);
});

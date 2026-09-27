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

test('reading android native contract registers the reading and tts Capacitor bridges', async () => {
  const plugin = await read('android/app/src/main/java/com/tifloacosta/app/TifloReadingPlugin.java');
  const ttsPlugin = await read('android/app/src/main/java/com/tifloacosta/app/TifloReadingTtsPlugin.java');
  const activity = await read('android/app/src/main/java/com/tifloacosta/app/MainActivity.java');

  assert.match(plugin, /@CapacitorPlugin\(name\s*=\s*"TifloReading"\)/);
  for (const method of ['pickDocuments', 'consumeInitialSharedDocuments', 'listBooks', 'openBook', 'saveProgress', 'deleteBook', 'getLatestInProgress']) {
    assert.match(plugin, new RegExp(`public\\s+void\\s+${method}\\s*\\(PluginCall\\s+call\\)`), `Missing ${method}`);
  }
  assert.match(plugin, /notifyListeners\("documentsReceived"/);

  assert.match(ttsPlugin, /@CapacitorPlugin\(name\s*=\s*"TifloReadingTts"\)/);
  for (const method of ['listTtsVoices', 'startTts', 'stopTts']) {
    assert.match(ttsPlugin, new RegExp(`public\\s+void\\s+${method}\\s*\\(PluginCall\\s+call\\)`), `Missing ${method}`);
  }
  assert.match(ttsPlugin, /notifyListeners\(event\.getName\(\)/);
  for (const eventName of ['ttsStarted', 'ttsDone', 'ttsError', 'ttsInterrupted']) {
    assert.match(ttsPlugin, new RegExp(eventName));
  }

  assert.match(activity, /registerPlugin\(TifloReadingPlugin\.class\)/);
  assert.match(activity, /registerPlugin\(TifloReadingTtsPlugin\.class\)/);
});

test('reading android tts contract has session-safe callbacks, android tts, audio focus and noisy-audio interruption', async () => {
  const controller = await read('android/app/src/main/java/com/tifloacosta/app/reading/ReadingTtsController.java');

  assert.match(controller, /TextToSpeech/);
  assert.match(controller, /UtteranceProgressListener/);
  assert.match(controller, /AudioManager/);
  assert.match(controller, /AudioFocusRequest/);
  assert.match(controller, /ACTION_AUDIO_BECOMING_NOISY/);
  assert.match(controller, /sessionId/);
  assert.match(controller, /utteranceId/);
  assert.match(controller, /0\.5f/);
  assert.match(controller, /2\.0f/);
  assert.match(controller, /ttsInterrupted/);
  assert.doesNotMatch(controller, /onAudioFocusChange[\s\S]{0,800}speak\s*\(/, 'Audio-focus gain must never auto-resume speech');
});

test('reading android native contract uses the document picker for multiple TXT HTML and PDF files', async () => {
  const plugin = await read('android/app/src/main/java/com/tifloacosta/app/TifloReadingPlugin.java');

  assert.match(plugin, /Intent\.ACTION_OPEN_DOCUMENT/);
  assert.match(plugin, /Intent\.CATEGORY_OPENABLE/);
  assert.match(plugin, /setType\("\*\/\*"\)/);
  assert.match(plugin, /Intent\.EXTRA_MIME_TYPES/);
  assert.match(plugin, /"text\/plain"/);
  assert.match(plugin, /"text\/html"/);
  assert.match(plugin, /"application\/pdf"/);
  assert.match(plugin, /Intent\.EXTRA_ALLOW_MULTIPLE/);
  assert.match(plugin, /getClipData\(\)/);
  assert.match(plugin, /getData\(\)/);
});

test('reading android native contract accepts TXT HTML and PDF shared file streams without broad storage permissions', async () => {
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
  assert.match(manifest, /android:mimeType="text\/plain"/);
  assert.match(manifest, /android:mimeType="text\/html"/);
  assert.match(manifest, /android:mimeType="application\/pdf"/);
  assert.doesNotMatch(manifest, /READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE|MANAGE_EXTERNAL_STORAGE|READ_MEDIA_/);
});

test('reading android native contract keeps PDF sources private as source.pdf', async () => {
  const [plugin, store] = await Promise.all([
    read('android/app/src/main/java/com/tifloacosta/app/TifloReadingPlugin.java'),
    read('android/app/src/main/java/com/tifloacosta/app/reading/ReadingFileStore.java')
  ]);

  assert.match(plugin, /source\.pdf/);
  assert.match(store, /openTempInput/);
  assert.doesNotMatch(plugin, /READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE|MANAGE_EXTERNAL_STORAGE|READ_MEDIA_/);
});

test('reading android native contract excludes the private reading library from backup and cleans stale temps off the UI thread', async () => {
  const [plugin, manifest, backupRules, extractionRules] = await Promise.all([
    read('android/app/src/main/java/com/tifloacosta/app/TifloReadingPlugin.java'),
    read('android/app/src/main/AndroidManifest.xml'),
    read('android/app/src/main/res/xml/backup_rules.xml'),
    read('android/app/src/main/res/xml/data_extraction_rules.xml')
  ]);

  assert.match(manifest, /android:fullBackupContent="@xml\/backup_rules"/);
  assert.match(manifest, /android:dataExtractionRules="@xml\/data_extraction_rules"/);

  assert.match(backupRules, /domain="file"\s+path="reading-library\/"/);
  assert.match(backupRules, /domain="database"\s+path="tiflo_reading\.db"/);

  assert.match(extractionRules, /<cloud-backup>[\s\S]*domain="file"\s+path="reading-library\/"[\s\S]*domain="database"\s+path="tiflo_reading\.db"[\s\S]*<\/cloud-backup>/);
  assert.match(extractionRules, /<device-transfer>[\s\S]*domain="file"\s+path="reading-library\/"[\s\S]*domain="database"\s+path="tiflo_reading\.db"[\s\S]*<\/device-transfer>/);

  assert.match(plugin, /getBridge\(\)\.execute\(importer::cleanupStaleTemps\)/);
  assert.doesNotMatch(manifest, /READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE|MANAGE_EXTERNAL_STORAGE|READ_MEDIA_/);
});

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
  for (const method of ['listTtsVoices', 'openTtsVoiceInstaller', 'startTts', 'stopTts']) {
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

test('reading android tts voice installer resolves installer first then engine and otherwise returns none', async () => {
  const [controller, plugin] = await Promise.all([
    read('android/app/src/main/java/com/tifloacosta/app/reading/ReadingTtsController.java'),
    read('android/app/src/main/java/com/tifloacosta/app/TifloReadingTtsPlugin.java')
  ]);

  assert.match(controller, /ACTION_INSTALL_TTS_DATA/);
  assert.match(controller, /getDefaultEngine\s*\(/);
  assert.match(controller, /resolveActivity\s*\(/);
  assert.match(controller, /getLaunchIntentForPackage\s*\(/);
  assert.match(controller, /destination/);
  assert.match(controller, /installer/);
  assert.match(controller, /engine/);
  assert.match(controller, /none/);
  assert.match(plugin, /openTtsVoiceInstaller/);
  assert.match(plugin, /result\.put\("opened"/);
  assert.match(plugin, /result\.put\("destination"/);
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

test('reading android native contract opens PDFs through the extractor with a call-scoped password and explicit states', async () => {
  const plugin = await read('android/app/src/main/java/com/tifloacosta/app/TifloReadingPlugin.java');

  assert.match(plugin, /String\s+password\s*=\s*stringOr\(call\.getString\("password"\),\s*""\)/);
  assert.match(plugin, /"pdf"\.equals\(record\.getFormat\(\)\)/);
  assert.match(plugin, /openStoredInput\(record\.getRelativePath\(\)\)/);
  assert.match(plugin, /pdfExtractor\.inspect\(source,\s*password\)/);
  assert.match(plugin, /"passwordRequired"/);
  assert.match(plugin, /"passwordRejected"/);
  assert.match(plugin, /"pdfNoText"/);
  assert.match(plugin, /"pageCount"/);
  assert.match(plugin, /result\.put\("pdf",\s*pdfJson\(/);
  assert.doesNotMatch(plugin, /put\("password"/);
  assert.doesNotMatch(plugin, /setReadingSetting[\s\S]{0,200}password/i);
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

test('reading audio positions introduced in schema v5 survive the schema v6 derived-content migration', async () => {
  const [database, bookRecord, markRecord, plugin] = await Promise.all([
    read('android/app/src/main/java/com/tifloacosta/app/reading/ReadingLibraryDatabase.java'),
    read('android/app/src/main/java/com/tifloacosta/app/reading/ReadingBookRecord.java'),
    read('android/app/src/main/java/com/tifloacosta/app/reading/ReadingMarkRecord.java'),
    read('android/app/src/main/java/com/tifloacosta/app/TifloReadingPlugin.java')
  ]);

  assert.match(database, /DATABASE_VERSION\s*=\s*6/);
  assert.match(database, /media_track_index INTEGER NOT NULL DEFAULT 0/);
  assert.match(database, /media_position_ms INTEGER NOT NULL DEFAULT 0/);
  assert.match(database, /version\s*==\s*2[\s\S]*ADD COLUMN media_track_index[\s\S]*ADD COLUMN media_position_ms/);
  assert.match(database, /version\s*==\s*3[\s\S]*createV4Tables\(db\)[\s\S]*version\s*=\s*4/);
  assert.match(database, /version\s*==\s*4[\s\S]*createV5Tables\(db\)[\s\S]*version\s*=\s*5/);
  assert.match(database, /version\s*==\s*5[\s\S]*createV6Tables\(db\)[\s\S]*version\s*=\s*6/);
  assert.match(bookRecord, /long\s+mediaPositionMs/);
  assert.match(markRecord, /long\s+mediaPositionMs/);
  assert.match(plugin, /call\.getLong\("mediaPositionMs"\)/);
  assert.match(plugin, /"mediaTrackIndex"/);
  assert.match(plugin, /"mediaPositionMs"/);
});

test('reading audio native contract requires Media3 background playback without autoplay', async () => {
  const [gradle, service, audioPlugin, activity, manifest] = await Promise.all([
    read('android/app/build.gradle'),
    read('android/app/src/main/java/com/tifloacosta/app/reading/ReadingAudioService.java'),
    read('android/app/src/main/java/com/tifloacosta/app/TifloReadingAudioPlugin.java'),
    read('android/app/src/main/java/com/tifloacosta/app/MainActivity.java'),
    read('android/app/src/main/AndroidManifest.xml')
  ]);

  assert.match(gradle, /androidx\.media3:media3-exoplayer/);
  assert.match(gradle, /androidx\.media3:media3-session/);
  assert.match(service, /extends\s+MediaSessionService/);
  assert.match(service, /ExoPlayer/);
  assert.match(service, /MediaSession/);
  assert.match(service, /setMediaItem/);
  assert.match(service, /prepare\s*\(/);
  assert.doesNotMatch(service, /prepare\s*\(\)[\s\S]{0,240}play\s*\(/, 'Preparing audio must never auto-play');

  assert.match(audioPlugin, /@CapacitorPlugin\(name\s*=\s*"TifloReadingAudio"\)/);
  for (const method of ['prepareAudio', 'playAudio', 'pauseAudio', 'seekAudio', 'skipAudio', 'setAudioSpeed', 'getAudioState', 'stopAudio']) {
    assert.match(audioPlugin, new RegExp(`public\\s+void\\s+${method}\\s*\\(PluginCall\\s+call\\)`), `Missing ${method}`);
  }
  for (const eventName of ['audioState', 'audioPosition', 'audioInterrupted', 'audioEnded']) {
    assert.match(audioPlugin, new RegExp(eventName), `Missing ${eventName}`);
  }

  assert.match(activity, /registerPlugin\(TifloReadingAudioPlugin\.class\)/);
  assert.match(manifest, /ReadingAudioService/);
  assert.match(manifest, /androidx\.media3\.session\.MediaSessionService/);
  assert.doesNotMatch(manifest, /READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE|MANAGE_EXTERNAL_STORAGE|READ_MEDIA_/);
});

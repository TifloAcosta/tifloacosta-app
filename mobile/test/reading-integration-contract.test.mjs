import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { resolveReadingSettings } from '../src/core/reading-settings.mjs';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('reading integration keeps TXT and HTML import open and resume on one semantic reader', async () => {
  const [importer, plugin, screen] = await Promise.all([
    read('android/app/src/main/java/com/tifloacosta/app/reading/ReadingImportService.java'),
    read('android/app/src/main/java/com/tifloacosta/app/TifloReadingPlugin.java'),
    read('src/screens/reading-book.mjs')
  ]);

  assert.match(importer, /"text\/html"/);
  assert.match(importer, /endsWith\("\.html"\)/);
  assert.match(importer, /endsWith\("\.htm"\)/);
  assert.match(importer, /"text\/plain"/);
  assert.match(importer, /endsWith\("\.txt"\)/);
  assert.match(importer, /moveTempToItem\(tempName, id, format, sourceExtension\)/);

  assert.match(plugin, /public void openBook\(PluginCall call\)/);
  assert.match(plugin, /result\.put\("book", bookJson\(record\)\)/);
  assert.match(plugin, /result\.put\("content", fileStore\.readUtf8\(record\.getRelativePath\(\)\)\)/);
  assert.match(plugin, /unitIndex/);
  assert.match(plugin, /anchorText/);

  assert.match(screen, /activeBook\.format === ['"]html['"]/);
  assert.match(screen, /parseHtmlDocument/);
  assert.match(screen, /parseTextDocument/);
  assert.match(screen, /initialPosition:\s*\{[\s\S]*blockIndex:[\s\S]*unitIndex:/);
  assert.match(screen, /client\.saveProgress\(\{/);
  assert.match(screen, /blockIndex:\s*normalized\.blockIndex/);
  assert.match(screen, /unitIndex:\s*normalized\.unitIndex/);
  assert.match(screen, /\banchorText\s*,/);
});

test('reading integration never auto-starts TTS and search preview stays non-destructive until continued', async () => {
  const screen = await read('src/screens/reading-book.mjs');

  assert.match(screen, /playButton\.addEventListener\(['"]click['"]/);
  assert.match(screen, /startSpeechFromUserAction/);
  assert.match(screen, /return speech\.play\(\)/);
  assert.match(screen, /playButton\.focus\(\)/);
  assert.doesNotMatch(screen, /await\s+speech\.play\(\)[\s\S]*playButton\.focus\(\)/);

  assert.match(screen, /onPreview\(position\)[\s\S]*commit:\s*false/);
  assert.match(screen, /if\s*\(commit\)\s*currentPosition\s*=\s*normalized/);
  assert.match(screen, /onContinue\(position\)[\s\S]*moveToPosition\(position\)/);
});

test('reading integration makes mark jumps adopt the shared reading position', async () => {
  const [screen, marks] = await Promise.all([
    read('src/screens/reading-book.mjs'),
    read('src/screens/reading-marks.mjs')
  ]);

  assert.match(screen, /getPosition:\s*\(\)\s*=>\s*\(\{\s*\.\.\.currentPosition\s*\}\)/);
  assert.match(screen, /onJump:\s*position\s*=>\s*\{\s*void moveToPosition\(position\);\s*\}/);
  assert.match(marks, /client\.addMark/);
  assert.match(marks, /onJump/);
  assert.match(marks, /client\.deleteMark/);
});

test('reading integration preserves global inheritance while book settings override it', async () => {
  const resolved = resolveReadingSettings(
    {
      'speech.rate': 1,
      'speech.voice': 'global-voice',
      'visual.theme': 'dark',
      'visual.textSize': 1.1
    },
    {
      'speech.rate': 1.4,
      'visual.textSize': 1.5
    },
    { availableVoices: [{ id: 'global-voice' }] }
  );

  assert.equal(resolved.effective['speech.rate'], 1.4);
  assert.equal(resolved.inherited['speech.rate'], false);
  assert.equal(resolved.effective['visual.textSize'], 1.5);
  assert.equal(resolved.inherited['visual.textSize'], false);
  assert.equal(resolved.effective['visual.theme'], 'dark');
  assert.equal(resolved.inherited['visual.theme'], true);
  assert.equal(resolved.effective['speech.voice'], 'global-voice');
  assert.equal(resolved.inherited['speech.voice'], true);

  const settingsScreen = await read('src/screens/reading-settings.mjs');
  assert.match(settingsScreen, /scope:\s*['"]book['"]/);
  assert.match(settingsScreen, /client\.resetBookReadingSettings\(bookId\)/);
});

test('reading integration deletion removes only the private copy and book-owned metadata', async () => {
  const [plugin, database] = await Promise.all([
    read('android/app/src/main/java/com/tifloacosta/app/TifloReadingPlugin.java'),
    read('android/app/src/main/java/com/tifloacosta/app/reading/ReadingLibraryDatabase.java')
  ]);

  assert.match(plugin, /fileStore\.deleteItemDirectory\(id\);[\s\S]*database\.delete\(id\);/);
  assert.doesNotMatch(plugin, /getContentResolver\(\)\.delete\s*\(/);
  assert.doesNotMatch(plugin, /\b(?:resolver|contentResolver)\.delete\s*\(/);

  assert.match(database, /db\.delete\(TABLE_AUDIO_TRACKS,\s*"book_id = \?"/);
  assert.match(database, /db\.delete\(TABLE_MARKS,\s*"book_id = \?"/);
  assert.match(database, /db\.delete\(TABLE_SETTINGS,\s*"scope = \? AND book_id = \?",\s*new String\[\]\{"book", id\}\)/);
  assert.match(database, /db\.delete\(TABLE_BOOKS,\s*"id = \?"/);
  assert.doesNotMatch(database, /db\.delete\(TABLE_SETTINGS,\s*null/);
});

test('PDF vertical slice keeps import storage opening pages and navigation on the shared reader path', async () => {
  const [importer, plugin, adapter, screen, marks] = await Promise.all([
    read('android/app/src/main/java/com/tifloacosta/app/reading/ReadingImportService.java'),
    read('android/app/src/main/java/com/tifloacosta/app/TifloReadingPlugin.java'),
    read('src/core/reading-pdf-adapter.mjs'),
    read('src/screens/reading-book.mjs'),
    read('src/screens/reading-marks.mjs')
  ]);

  assert.match(importer, /"application\/pdf"/);
  assert.match(importer, /endsWith\("\.pdf"\)/);
  assert.match(importer, /validatePdf\(tempName\)/);
  assert.match(importer, /moveTempToItem\(tempName, id, format, sourceExtension\)/);
  assert.match(plugin, /"pdf"\.equals\(record\.getFormat\(\)\)/);
  assert.match(plugin, /pdfExtractor\.inspect\(source, password\)/);
  assert.match(plugin, /result\.put\("pdf", pdfJson\(pdf\)\)/);
  assert.match(plugin, /"source\.pdf"/);

  assert.match(adapter, /export function parsePdfDocument/);
  assert.match(adapter, /pageNumber/);
  assert.match(adapter, /export function pageForPosition/);
  assert.match(adapter, /export function positionForPage/);
  assert.match(screen, /parsePdfDocument\(opened\.pdf\)/);
  assert.match(screen, /positionForPage\(documentModel,\s*requestedPage\)/);
  assert.match(screen, /moveToPosition\(target\)/);
  assert.match(screen, /getReference:[\s\S]*readingBook\.pdfPageReference/);
  assert.match(marks, /reference:\s*getReference\?\.\(position\)/);
});

test('PDF vertical slice keeps password/no-text/invalid states separate without password persistence or OCR claims', async () => {
  const [importer, plugin, database, client, screen, gradle] = await Promise.all([
    read('android/app/src/main/java/com/tifloacosta/app/reading/ReadingImportService.java'),
    read('android/app/src/main/java/com/tifloacosta/app/TifloReadingPlugin.java'),
    read('android/app/src/main/java/com/tifloacosta/app/reading/ReadingLibraryDatabase.java'),
    read('src/core/reading-library-client.mjs'),
    read('src/screens/reading-book.mjs'),
    read('android/app/build.gradle')
  ]);

  assert.match(importer, /STATUS_PASSWORD_REQUIRED/);
  assert.match(importer, /ReadingImportResult\.rejected\("pdf-no-text"\)/);
  assert.match(importer, /ReadingImportResult\.rejected\("invalid-pdf"\)/);
  assert.match(plugin, /passwordRequired/);
  assert.match(plugin, /passwordRejected/);
  assert.match(plugin, /pdfNoText/);
  assert.match(client, /async function openBook\(id, options = \{\}\)/);
  assert.match(client, /const password = String\(options\?\.password \?\? ['"]['"]\)/);
  assert.match(client, /plugin\.openBook\(cleanId, \{ password \}\)/);
  assert.match(screen, /passwordInput\.value\s*=\s*['"]['"]/);

  assert.doesNotMatch(database, /password/i);
  assert.doesNotMatch(plugin, /book\.put\("password"|result\.put\("password"/i);
  assert.doesNotMatch(gradle, /tesseract|text-recognition|mlkit.*text|ocr/i);
  assert.doesNotMatch(screen, /\bOCR\b|reconoc(?:er|imiento).*imagen|scan(?:ned)?\s+text/i);
});

test('audio vertical slice reopens the exact saved track and millisecond paused without autoplay', async () => {
  const [importer, store, database, libraryPlugin, service, controller, screen] = await Promise.all([
    read('android/app/src/main/java/com/tifloacosta/app/reading/ReadingImportService.java'),
    read('android/app/src/main/java/com/tifloacosta/app/reading/AndroidReadingFileStore.java'),
    read('android/app/src/main/java/com/tifloacosta/app/reading/ReadingLibraryDatabase.java'),
    read('android/app/src/main/java/com/tifloacosta/app/TifloReadingPlugin.java'),
    read('android/app/src/main/java/com/tifloacosta/app/reading/ReadingAudioService.java'),
    read('src/core/reading-audio.mjs'),
    read('src/screens/reading-audio.mjs')
  ]);

  assert.match(importer, /importAudioGroup/);
  assert.match(importer, /moveTempToAudioTrack/);
  assert.match(store, /track-%04d/);
  assert.match(database, /TABLE_AUDIO_TRACKS/);
  assert.match(database, /updateProgress[\s\S]*mediaTrackIndex[\s\S]*mediaPositionMs/);
  assert.match(libraryPlugin, /"mediaTrackIndex"/);
  assert.match(libraryPlugin, /"mediaPositionMs"/);
  assert.match(service, /listAudioTracks\(bookId\)/);
  assert.match(service, /setMediaItems\(items,\s*startIndex,\s*Math\.max\(0L, positionMs\)\)/);
  assert.match(service, /player\.prepare\(\)/);
  assert.doesNotMatch(service, /prepareAudio[\s\S]{0,1200}player\.play\(\)/, 'Reopening an audiobook must remain paused');
  assert.match(controller, /mediaTrackIndex:\s*state\.trackIndex/);
  assert.match(controller, /mediaPositionMs:\s*state\.positionMs/);
  assert.match(screen, /trackIndex:\s*book\.mediaTrackIndex/);
  assert.match(screen, /positionMs:\s*book\.mediaPositionMs/);
});

test('audio background safety persists natively on interruptions periodic playback and sleep timer without auto-resume', async () => {
  const [service, plugin, wrapper, client, controller] = await Promise.all([
    read('android/app/src/main/java/com/tifloacosta/app/reading/ReadingAudioService.java'),
    read('android/app/src/main/java/com/tifloacosta/app/TifloReadingAudioPlugin.java'),
    read('src/native/reading-library-plugin.mjs'),
    read('src/core/reading-library-client.mjs'),
    read('src/core/reading-audio.mjs')
  ]);

  assert.match(service, /POSITION_PERSIST_INTERVAL_MS\s*=\s*5000L/);
  assert.match(service, /persistCurrentPosition\(/);
  assert.match(service, /database\.updateProgress\(/);
  assert.match(service, /ACTION_AUDIO_INTERRUPTED/);
  assert.match(service, /AUDIO_FOCUS_LOSS[\s\S]*persistCurrentPosition|persistCurrentPosition[\s\S]*AUDIO_FOCUS_LOSS/);
  assert.match(service, /AUDIO_BECOMING_NOISY[\s\S]*persistCurrentPosition|persistCurrentPosition[\s\S]*AUDIO_BECOMING_NOISY/);
  assert.doesNotMatch(service, /onPlayWhenReadyChanged[\s\S]{0,1200}player\.play\(\)/, 'Audio-focus recovery must never auto-resume');

  assert.match(service, /COMMAND_SET_SLEEP_TIMER/);
  assert.match(service, /COMMAND_CANCEL_SLEEP_TIMER/);
  assert.match(service, /postDelayed/);
  assert.match(service, /sleepAtTrackEnd/);
  assert.match(service, /player\.pause\(\)[\s\S]*persistCurrentPosition/);

  assert.match(plugin, /public void setAudioSleepTimer\(PluginCall call\)/);
  assert.match(plugin, /public void cancelAudioSleepTimer\(PluginCall call\)/);
  assert.match(wrapper, /setAudioSleepTimer/);
  assert.match(wrapper, /cancelAudioSleepTimer/);
  assert.match(client, /setAudioSleepTimer/);
  assert.match(client, /cancelAudioSleepTimer/);
  assert.match(controller, /client\?\.setAudioSleepTimer/);
  assert.match(controller, /client\?\.cancelAudioSleepTimer/);
});

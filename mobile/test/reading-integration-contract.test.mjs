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
  assert.match(importer, /moveTempToItem\(tempName, id, format\)/);

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

  assert.match(database, /db\.delete\(TABLE_MARKS,\s*"book_id = \?"/);
  assert.match(database, /db\.delete\(TABLE_SETTINGS,\s*"scope = \? AND book_id = \?",\s*new String\[\]\{"book", id\}\)/);
  assert.match(database, /db\.delete\(TABLE_BOOKS,\s*"id = \?"/);
  assert.doesNotMatch(database, /db\.delete\(TABLE_SETTINGS,\s*null/);
});

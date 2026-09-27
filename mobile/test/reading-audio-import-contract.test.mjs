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

test('reading audio import accepts only the approved local audio families and preserves the source extension', async () => {
  const [importer, store] = await Promise.all([
    read('android/app/src/main/java/com/tifloacosta/app/reading/ReadingImportService.java'),
    read('android/app/src/main/java/com/tifloacosta/app/reading/ReadingFileStore.java')
  ]);

  for (const extension of ['mp3', 'm4a', 'm4b', 'aac', 'ogg', 'opus', 'flac', 'wav']) {
    assert.match(importer, new RegExp(`\\.${extension}`), `Missing .${extension} audio import support`);
  }

  for (const mime of ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/opus', 'audio/flac', 'audio/wav']) {
    assert.match(importer, new RegExp(mime.replace('/', '\\/')), `Missing ${mime} audio import support`);
  }

  assert.match(importer, /return\s+"audio"/);
  assert.match(importer, /audioExtensionFrom/);
  assert.match(importer, /moveTempToItem\(tempName, id, format, sourceExtension\)/);
  assert.match(store, /moveTempToItem\(String tempName, String id, String format, String sourceExtension\)/);
});

test('reading audio import validates the private temp file before inserting a library row', async () => {
  const [importer, probe] = await Promise.all([
    read('android/app/src/main/java/com/tifloacosta/app/reading/ReadingImportService.java'),
    read('android/app/src/main/java/com/tifloacosta/app/reading/ReadingAudioProbe.java')
  ]);

  assert.match(probe, /interface ReadingAudioProbe/);
  assert.match(probe, /inspect\s*\(/);
  assert.match(probe, /durationMs/);
  assert.match(probe, /title/);
  assert.match(probe, /artist/);
  assert.match(probe, /album/);

  assert.match(importer, /ReadingAudioProbe\s+audioProbe/);
  assert.match(importer, /validateAudio\(tempName/);
  assert.match(importer, /ReadingImportResult\.rejected\("invalid-audio"\)/);
  assert.match(importer, /repository\.insert\(record\)/);
  assert.ok(importer.indexOf('validateAudio(tempName') < importer.indexOf('repository.insert(record)'), 'Audio validation must happen before the database insert');
});

test('Android picker and share targets expose audio without broad storage permissions', async () => {
  const [plugin, manifest] = await Promise.all([
    read('android/app/src/main/java/com/tifloacosta/app/TifloReadingPlugin.java'),
    read('android/app/src/main/AndroidManifest.xml')
  ]);

  for (const mime of ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/opus', 'audio/flac', 'audio/wav']) {
    assert.match(plugin, new RegExp(`"${mime.replace('/', '\\/')}"`), `Picker missing ${mime}`);
  }
  assert.match(manifest, /android:mimeType="audio\//);
  assert.doesNotMatch(manifest, /READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE|MANAGE_EXTERNAL_STORAGE|READ_MEDIA_/);
  assert.doesNotMatch(plugin, /READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE|MANAGE_EXTERNAL_STORAGE|READ_MEDIA_/);
});

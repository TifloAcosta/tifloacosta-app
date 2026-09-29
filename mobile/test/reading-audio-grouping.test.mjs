import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Android schema v5 retains ordered audiobook tracks without replacing the shared books table', async () => {
  const [database, record] = await Promise.all([
    read('android/app/src/main/java/com/tifloacosta/app/reading/ReadingLibraryDatabase.java'),
    read('android/app/src/main/java/com/tifloacosta/app/reading/ReadingAudioTrackRecord.java')
  ]);

  assert.match(database, /DATABASE_VERSION\s*=\s*5/);
  assert.match(database, /audio_tracks/);
  assert.match(database, /insertAudioTracks/);
  assert.match(database, /listAudioTracks/);
  assert.match(database, /version\s*==\s*3[\s\S]*version\s*=\s*4/);
  assert.match(database, /version\s*==\s*4[\s\S]*version\s*=\s*5/);
  assert.match(record, /trackIndex/);
  assert.match(record, /relativePath/);
  assert.match(record, /durationMs/);
  assert.match(record, /embeddedTrackNumber/);
});

test('audio probe and grouping importer prefer embedded track numbers then filenames and surface ambiguity', async () => {
  const [probe, androidProbe, importer] = await Promise.all([
    read('android/app/src/main/java/com/tifloacosta/app/reading/ReadingAudioProbe.java'),
    read('android/app/src/main/java/com/tifloacosta/app/reading/AndroidReadingAudioProbe.java'),
    read('android/app/src/main/java/com/tifloacosta/app/reading/ReadingImportService.java')
  ]);

  assert.match(probe, /trackNumber/);
  assert.match(androidProbe, /METADATA_KEY_CD_TRACK_NUMBER/);
  assert.match(importer, /importAudioGroup/);
  assert.match(importer, /ambiguous/i);
  assert.match(importer, /getTrackNumber|embeddedTrackNumber/);
  assert.match(importer, /originalName|displayName/);
});

test('picker defers all-audio multi-selection until the user chooses one book independent files or cancel', async () => {
  const [nativePlugin, mainActivity, wrapper, client, screen, i18n] = await Promise.all([
    read('android/app/src/main/java/com/tifloacosta/app/TifloReadingAudioGroupPlugin.java'),
    read('android/app/src/main/java/com/tifloacosta/app/MainActivity.java'),
    read('src/native/reading-library-plugin.mjs'),
    read('src/core/reading-library-client.mjs'),
    read('src/screens/reading-library.mjs'),
    read('src/core/i18n.mjs')
  ]);

  assert.match(nativePlugin, /resolveAudioSelection/);
  assert.match(nativePlugin, /audioChoiceRequired/);
  assert.match(nativePlugin, /grouped/);
  assert.match(nativePlugin, /independent/);
  assert.match(mainActivity, /TifloReadingAudioGroupPlugin\.class/);
  assert.match(wrapper, /resolveAudioSelection/);
  assert.match(client, /resolveAudioSelection/);
  assert.match(screen, /audioChoiceRequired/);
  assert.match(screen, /readingLibrary\.audioGroupOneBook/);
  assert.match(screen, /readingLibrary\.audioGroupIndependent/);
  assert.match(screen, /readingLibrary\.audioGroupCancel/);
  for (const label of [
    'Un solo audiolibro', 'Archivos independientes', 'Cancelar',
    'One audiobook', 'Independent files', 'Cancel'
  ]) {
    assert.ok(i18n.includes(label), `Missing grouping label: ${label}`);
  }
});

test('audiobook integration preserves injected plugin fallback and loads tracks when the caller does not pass them', async () => {
  const [wrapper, audioScreen] = await Promise.all([
    read('src/native/reading-library-plugin.mjs'),
    read('src/screens/reading-audio.mjs')
  ]);

  assert.match(wrapper, /audioGroupPlugin\s*=\s*null/);
  assert.match(wrapper, /plugin\s*===\s*NativeTifloReading[\s\S]*NativeTifloReadingAudioGroup[\s\S]*:\s*plugin/);
  assert.match(audioScreen, /audioTracks\.length\s*\?\s*Promise\.resolve\(audioTracks\)\s*:\s*client\.listAudioTracks\(book\.id\)/);
});

test('opened audio exposes ordered tracks and Media3 playlist transition state', async () => {
  const [service, plugin, client, controller, screen] = await Promise.all([
    read('android/app/src/main/java/com/tifloacosta/app/reading/ReadingAudioService.java'),
    read('android/app/src/main/java/com/tifloacosta/app/TifloReadingAudioPlugin.java'),
    read('src/core/reading-library-client.mjs'),
    read('src/core/reading-audio.mjs'),
    read('src/screens/reading-audio.mjs')
  ]);

  assert.match(service, /listAudioTracks/);
  assert.match(service, /setMediaItems/);
  assert.match(plugin, /getCurrentMediaItemIndex/);
  assert.match(plugin, /trackCount/);
  assert.match(plugin, /previousAudioTrack/);
  assert.match(plugin, /nextAudioTrack/);
  assert.match(client, /audioTracks/);
  assert.match(controller, /tracks/);
  assert.match(controller, /previousTrack/);
  assert.match(controller, /nextTrack/);
  assert.match(screen, /controller\.previousTrack\(/);
  assert.match(screen, /controller\.nextTrack\(/);
});

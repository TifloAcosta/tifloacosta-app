import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const reader = source('NativeTifloLector.swift');
const music = source('NativeMyMusic.swift');
const cinema = source('NativeAccessibleCinema.swift');
const podcasts = source('NativePodcasts.swift');
const media = source('NativeMedia.swift');
const youtube = source('NativeYouTubePlayer.swift');

test('reader playback button flicks navigate only when it reads Pausar', () => {
  const row = reader.slice(reader.indexOf('private var playbackRow: some View'),
    reader.indexOf('private var trackButtons: some View'));
  assert.match(row, /Button\(speech\.isPlaying \? "Pausar" : "Reproducir"\)/);
  assert.match(row, /\.accessibilityAdjustableAction \{ direction in[\s\S]{0,290}guard speech\.isPlaying else \{ return \}/);
  assert.match(row, /case \.increment: moveUnit\(1\)/);
  assert.match(row, /case \.decrement: moveUnit\(-1\)/);
  assert.match(row, /La navegación con gestos solo está disponible mientras se reproduce/);
  assert.match(reader, /private func toggleReaderPlayback\(\)/);
});

test('folder landing preference survives leaving the reader and does not override Resume Last Book', () => {
  assert.match(reader, /@AppStorage\("native-reading-folder-entry-mode"\) private var folderEntryMode = 0/);
  assert.match(reader, /title: "Vista al entrar en TifloLector"/);
  assert.match(reader, /choices: \["Vista general", "Carpetas"\]/);
  assert.match(reader, /selectedIndex: \$folderEntryMode/);
  assert.match(reader, /if folderEntryMode == 1 && !resumeShortcut \{ showFolderPicker = true \}/);
  assert.match(reader, /native-ios-resume-last-book-shortcut-v1/);
  assert.match(reader, /\.sheet\(isPresented: \$showFolderPicker\)/);
});

test('deletions require a named confirmation in reader, music, podcasts and cinema', () => {
  assert.match(reader, /MusicLocalized\.format\("¿Eliminar la carpeta «%@»\?", folderToDelete \?\? ""\)/);
  assert.match(reader, /Las obras de esta carpeta se conservarán en la biblioteca/);
  assert.match(reader, /Button\("Eliminar carpeta", role: \.destructive\)/);
  assert.match(reader, /MusicLocalized\.format\("Eliminar definitivamente %@", documentToDelete\?\.title \?\? MusicLocalized\.message\("Documento"\)\)/);
  assert.match(reader, /titles\.joined\(separator: ", "\)/);
  assert.match(music, /@State private var pendingCollectionRemoval:/);
  assert.match(music, /pendingCollectionRemoval = \(folder\.id, folder\.name, "folder"\)/);
  assert.match(music, /pendingCollectionRemoval = \(playlist\.id, playlist\.name, "playlist"\)/);
  assert.match(music, /pendingCollectionRemoval = \(folder\.id, folder\.name, "smartFolder"\)/);
  assert.match(music, /MusicLocalized\.format\("¿Eliminar «%@»\?", pendingRemoval\?\.name \?\? ""\)/);
  assert.match(music, /MusicLocalized\.format\("¿Eliminar «%@»\?", pendingCollectionRemoval\?\.name \?\? ""\)/);
  assert.match(music, /Button\("Cancelar", role: \.cancel\) \{ pendingCollectionRemoval = nil \}/);
  assert.match(podcasts, /pendingDownloadedRemoval = item/);
  assert.match(podcasts, /MusicLocalized\.format\("¿Eliminar «%@»\?", pendingDownloadedRemoval\?\.title \?\? ""\)/);
  assert.match(podcasts, /Button\("Eliminar descarga", role: \.destructive\)/);
  assert.match(cinema, /MusicLocalized\.format\("¿Eliminar «%@»\?", item\?\.title \?\? ""\)/);
  assert.match(cinema, /guard let item else \{ return \}/);
  assert.match(cinema, /Button\("Eliminar archivo personal", role: \.destructive\)/);
});

test('Actualidad audio uses the podcast engine and YouTube videos use the native official player', () => {
  const open = media.slice(media.indexOf('enum NativeMediaPlayback'),
    media.indexOf('@MainActor\nfinal class NativeMediaStore'));
  assert.match(open, /if item\.type == "audio", let audioURL = item\.directAudioURL \{/);
  assert.match(open, /player\.select\(episode, at: library\.progress\(for: episode\)\)/);
  assert.match(open, /return[\s\S]{0,70}if let video = NativeYouTubeVideo\(media: item\)/);
  assert.match(open, /playVideo\(video\)[\s\S]{0,40}return/);
  assert.match(youtube, /init\?\(media item: NativeMediaItem\) \{[\s\S]{0,140}guard item\.type == "video"/);
  assert.equal(media.split('NativeMediaPlayback.open(item, player: player').length - 1, 2);
  assert.match(media, /NavigationStack \{ NativeYouTubePlayerScreen\(video: video\) \}/);
  assert.match(youtube, /https:\/\/www\.youtube\.com\/iframe_api/);
});

test('new folder and deletion language is available in all other app languages', () => {
  const keys = [
    'Vista al entrar en TifloLector', 'Vista general',
    'La navegación con gestos solo está disponible mientras se reproduce.',
    '¿Eliminar la carpeta «%@»?', 'Las obras de esta carpeta se conservarán en la biblioteca.',
    '¿Eliminar «%@»?', 'Solo se eliminará la carpeta virtual. Las canciones se conservarán.',
    'Se eliminará la carpeta inteligente, pero no las canciones.',
    'Se eliminará la lista de reproducción, pero no las canciones.',
    'Se eliminará el archivo guardado en esta colección personal.',
    'Se eliminará la descarga local. El episodio seguirá disponible en su fuente.'
  ];
  for (const lang of ['en', 'pt', 'fr', 'it', 'de']) {
    const catalog = source(lang + '.lproj/Localizable.strings');
    for (const key of keys) assert.ok(catalog.includes('"' + key + '" = '), lang + ': ' + key);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const screen = read('NativeScreens.swift');
const player = read('NativeYouTubePlayer.swift');
const lists = read('NativeYouTubePlaylist.swift');

test('the result selector includes playlists, including the All view', () => {
  assert.match(screen, /"Todos", "Vídeos", "Canales", "Listas de reproducción"/);
  assert.match(screen, /"all", "video", "channel", "playlist"/);
  assert.match(screen, /ForEach\(youtubeSearch\.playlists\) \{ playlist in/);
  assert.match(screen, /NativeYouTubePlaylistScreen\(playlist: playlist\)/);
  assert.match(player, /@Published private\(set\) var playlists: \[NativeYouTubePlaylist\]/);
  assert.match(player, /let playlistId: String\?/);
  assert.match(player, /NativeYouTubePlaylist\.init\(search:/);
});

test('native playlist fetch uses public first party endpoint and paginated order', () => {
  assert.match(lists, /class NativeYouTubePlaylistStore: ObservableObject/);
  assert.match(lists, /https:\/\/youtube-auth\.tifloacosta\.com\/playlist-items/);
  assert.match(lists, /URLQueryItem\(name: "playlistId", value: playlist\.id\)/);
  assert.match(lists, /URLQueryItem\(name: "pageToken", value: nextPageToken\)/);
  assert.match(lists, /request\.setValue\("https:\/\/tifloacosta\.com", forHTTPHeaderField: "Origin"\)/);
  assert.match(lists, /position: position, video: video/);
  assert.match(lists, /if !store\.nextPageToken\.isEmpty/);
  assert.match(lists, /Button\("Mostrar veinte vídeos más"\)/);
});

test('accessible playlist rows use the official player, not extracted streams', () => {
  assert.match(lists, /NativeYouTubeVideoRow\(/);
  assert.match(lists, /accessibilityHint/);
  assert.match(lists, /NativeYouTubePlayerScreen\(/);
  assert.match(lists, /playlist: store\.entries\.map\(\\\.video\)/);
  assert.match(lists, /Link\("Abrir lista original en YouTube", destination: playlist\.url\)/);
  assert.match(lists, /Reintentar carga de la lista/);
  assert.doesNotMatch(lists, /yt-dlp|youtube-dl|extractAudioURL/);
});

test('duplicate videos in the same playlist advance by position, not by video ID', () => {
  assert.match(player, /@State private var currentPlaylistIndex: Int/);
  assert.match(player, /playlistStartIndex: Int\? = nil/);
  assert.match(player, /let next = currentPlaylistIndex \+ 1/);
  assert.match(player, /currentPlaylistIndex = next/);
  assert.doesNotMatch(player, /guard let index = playlist\.firstIndex\(where: \{ \$0\.id == currentVideo\.id \}\)/);
});

test('playlist actions and failures are translated into the other five app languages', () => {
  const keys = ['Listas de reproducción', 'Abrir lista original en YouTube',
    'Mostrar veinte vídeos más', 'La lista no está disponible públicamente.'];
  for (const lang of ['en', 'pt', 'fr', 'it', 'de']) {
    const table = read(lang + '.lproj/Localizable.strings');
    for (const key of keys) {
      assert.ok(table.includes('"' + key + '" = '), lang + ': ' + key);
    }
  }
});

test('pagination keeps earlier playlist entries when retrying and cannot loop repeated pages', () => {
  assert.match(lists, /let requestedPageToken = loadMore \? nextPageToken : ""/);
  assert.match(lists, /var seenPositions = Set\(entries\.map/);
  assert.match(lists, /guard seenPositions\.insert\(entryKey\)\.inserted else \{ continue \}/);
  assert.match(lists, /nextPageToken = page\.nextPageToken == requestedPageToken/);
  assert.match(lists, /loadMore: store\.hasLoaded && !store\.nextPageToken\.isEmpty/);
  assert.match(lists, /if code == "INVALID_PLAYLIST"/);
  assert.doesNotMatch(lists, /status == 403 \|\| status == 404/);
  assert.match(lists, /Link\("Abrir lista original en YouTube"/);
});

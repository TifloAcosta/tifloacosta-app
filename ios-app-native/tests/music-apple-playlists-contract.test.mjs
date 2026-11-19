import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const screen = readFileSync(new URL('../Sources/NativeMyMusic.swift', import.meta.url), 'utf8');

test('mixed playlist entries keep explicit providers and catalog IDs without storing tokens', () => {
  assert.match(screen, /struct MusicPlaylistEntry: Codable, Identifiable/);
  assert.match(screen, /case local, appleMusic/);
  assert.match(screen, /appleMusicSongId/);
  assert.match(screen, /orderedEntries/);
  assert.doesNotMatch(screen, /MusicUserToken|developerToken|AuthKey_/);
});

test('legacy local-only playlist backup remains valid when ordered entries are absent', () => {
  assert.match(screen, /orderedEntries \?\? .*trackIds/);
  assert.match(screen, /MusicPortablePlaylist/);
  assert.match(screen, /addAppleMusicSong/);
});

test('complete archive restores mixed playlist entries and remaps local IDs', () => {
  assert.match(screen, /item\.orderedEntries\?\.compactMap/);
  assert.match(screen, /ids\[localId\.uuidString\]/);
  assert.match(screen, /orderedEntries: restoredEntries/);
});

test('iOS playlists accept Audius and Jamendo catalog references', () => {
  assert.match(screen, /case local, appleMusic, audius, jamendo/);
  assert.match(screen, /func addStreamingSong\(/);
  assert.match(screen, /audius\.playSavedTrack\(/);
  assert.match(screen, /jamendo\.playSavedTrack\(/);
});

test('local playback from every library collection pauses online providers', () => {
  const localActions = [
    'Reproducir archivos locales de',
    'Reproducir carpeta inteligente',
    'Reproducir \\(file.name)'
  ];
  for (const action of localActions) {
    const start = screen.indexOf(action);
    assert.ok(start >= 0, `missing action ${action}`);
    const body = screen.slice(start, start + 900);
    assert.match(body, /audius\.pause\(\)/);
    assert.match(body, /jamendo\.pause\(\)/);
    assert.match(body, /appleMusic\.pause\(\)/);
  }
});

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

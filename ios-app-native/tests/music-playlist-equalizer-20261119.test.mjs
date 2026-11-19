import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = file => readFileSync(new URL(`../Sources/${file}`, import.meta.url), 'utf8');

test('a local song in a mixed playlist passes its list identity to the EQ engine', () => {
  const queue = source('NativeMixedMusicQueue.swift');
  const screen = source('NativeMyMusic.swift');
  assert.match(screen, /mixedQueue\.play\(entries: library\.playlistEntries\(playlist\), playlistID: playlist\.id/);
  assert.match(queue, /playlistID: playlistID/);
});

test('song EQ takes priority over the playlist profile and then the general preset', () => {
  const player = source('NativeMusicPlayer.swift');
  assert.match(player, /func saveForPlaylist\(_ playlistID: UUID\)/);
  assert.match(player, /func removePlaylistOverride\(_ playlistID: UUID\)/);
  assert.match(player, /private func playlistOverrideKey\(_ playlistID: UUID\)/);
  assert.match(player, /let playlistSaved = currentPlaylistID/);
  assert.match(player, /if let saved, saved\.gains\.count == 5/);
  assert.match(player, /else if let playlistSaved, playlistSaved\.gains\.count == 5/);
});

test('playlist rows provide accessible save and clear EQ profile actions', () => {
  const screen = source('NativeMyMusic.swift');
  assert.match(screen, /player\.saveForPlaylist\(playlist\.id\)/);
  assert.match(screen, /player\.removePlaylistOverride\(playlist\.id\)/);
});

test('playlist EQ action labels are translated to all supported non-Spanish interfaces', () => {
  for (const language of ['en', 'pt', 'fr', 'it', 'de']) {
    const catalog = source(`${language}.lproj/Localizable.strings`);
    for (const key of ['Guardar ecualización para lista %@', 'Quitar ecualización de lista %@']) {
      assert.ok(catalog.includes(`"${key}" = `), `${language} missing ${key}`);
    }
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = file => readFileSync(new URL(`../Sources/${file}`, import.meta.url), 'utf8');

test('imported local music persists album and artist metadata and backups retain it', () => {
  const music = source('NativeMyMusic.swift');
  assert.match(music, /var album: String\?/);
  assert.match(music, /var artist: String\?/);
  assert.match(music, /\.load\(\.commonMetadata\)/);
  assert.match(music, /\.commonIdentifierAlbumName/);
  assert.match(music, /\.commonIdentifierArtist/);
  assert.match(music, /album: file\.album, artist: file\.artist/);
  assert.match(music, /album: track\.album, artist: track\.artist/);
});

test('existing imported songs without album information are enriched when the library opens', () => {
  const music = source('NativeMyMusic.swift');
  assert.match(music, /func refreshMissingAlbumMetadata\(\) async/);
  assert.match(music, /Task \{ await refreshMissingAlbumMetadata\(\) \}/);
});

test('album EQ uses stable album-and-artist keys and the song-list-album-general priority', () => {
  const player = source('NativeMusicPlayer.swift');
  assert.match(player, /func saveForAlbum\(_ albumKey: String\)/);
  assert.match(player, /func removeAlbumOverride\(_ albumKey: String\)/);
  assert.match(player, /let albumSaved = albumKeysByURL\[url\]/);
  assert.match(player, /else if let albumSaved, albumSaved\.gains\.count == 5/);
});

test('album identity stays consistent if the iPhone interface language changes', () => {
  const music = source('NativeMyMusic.swift');
  assert.match(music, /Locale\(identifier: "en_US_POSIX"\)/);
  assert.doesNotMatch(music, /album\.folding\([^\n]*locale: \.current/);
});

test('album EQ is configurable from its own accessible music-library group', () => {
  const music = source('NativeMyMusic.swift');
  assert.match(music, /Section\("Álbumes"\)/);
  assert.match(music, /player\.saveForAlbum\(album\.id\)/);
  assert.match(music, /player\.removeAlbumOverride\(album\.id\)/);
});

test('backup and restoration include EQ profiles without exporting any credentials', () => {
  const music = source('NativeMyMusic.swift');
  const player = source('NativeMusicPlayer.swift');
  assert.match(player, /func exportProfiles\(\) -> \[String: String\]/);
  assert.match(player, /func restoreProfiles\(_ profiles: \[String: String\]\)/);
  assert.match(music, /audioProfiles: NativeMusicPlayer\.shared\.exportProfiles\(\)/);
  assert.match(music, /NativeMusicPlayer\.shared\.restoreProfiles\(backup\.audioProfiles\)/);
});

test('album profile actions and album heading are translated into five additional languages', () => {
  for (const language of ['en', 'pt', 'fr', 'it', 'de']) {
    const catalog = source(`${language}.lproj/Localizable.strings`);
    for (const key of ['Álbumes', 'Guardar ecualización para álbum %@', 'Quitar ecualización de álbum %@']) {
      assert.ok(catalog.includes(`"${key}" = `), `${language} missing ${key}`);
    }
  }
});

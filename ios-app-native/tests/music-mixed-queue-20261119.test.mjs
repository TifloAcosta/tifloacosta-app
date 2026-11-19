import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = file => readFileSync(new URL(`../Sources/${file}`, import.meta.url), 'utf8');

test('playlist play action uses the ordered mixed entries, not only local track IDs', () => {
  const screen = source('NativeMyMusic.swift');
  assert.match(screen, /mixedQueue\.play\(entries: library\.playlistEntries\(playlist\)/);
  assert.doesNotMatch(screen, /\.disabled\(playlist\.trackIds\.isEmpty\)/);
});

test('mixed queue keeps ordered entries and routes each saved provider ID', () => {
  const queue = source('NativeMixedMusicQueue.swift');
  assert.match(queue, /@Published private\(set\) var entries: \[MusicPlaylistEntry\]/);
  assert.match(queue, /case \.local:/);
  assert.match(queue, /case \.appleMusic:/);
  assert.match(queue, /case \.audius:/);
  assert.match(queue, /case \.jamendo:/);
  assert.match(queue, /playSaved\(id: remoteID, title: entry\.title\)/);
  assert.match(queue, /play\(id: remoteID, title: entry\.title\)/);
  assert.match(queue, /playSaved\(id: remoteID\)/);
});

test('natural playback completion advances a mixed queue without relying on local-only next', () => {
  const queue = source('NativeMixedMusicQueue.swift');
  const local = source('NativeMusicPlayer.swift');
  const audius = source('NativeAudiusMusic.swift');
  const jamendo = source('NativeJamendoMusic.swift');
  for (const file of [local, audius, jamendo]) {
    assert.match(file, /var onPlaybackFinished: \(\(\) -> Void\)\?/);
  }
  assert.match(queue, /func finishedNaturally\(generation: Int\)/);
  assert.match(local, /if let finished = self\.onPlaybackFinished \{ finished\(\) \}/);
  assert.match(audius, /AVPlayerItemDidPlayToEndTime/);
  assert.match(jamendo, /AVPlayerItemDidPlayToEndTime/);
});

test('unavailable entries are skipped iteratively and do not recurse across the entire playlist', () => {
  const queue = source('NativeMixedMusicQueue.swift');
  assert.match(queue, /while entries\.indices\.contains\(currentIndex\)/);
  assert.doesNotMatch(queue, /guard let id = entry\.localId[\s\S]*?next\(\)\s*return/);
});

test('mixed playlist controls expose next, previous, stop and the current item', () => {
  const screen = source('NativeMyMusic.swift');
  for (const action of ['mixedQueue.next()', 'mixedQueue.previous()', 'mixedQueue.stop()']) {
    assert.ok(screen.includes(action), `${action} missing from music controls`);
  }
  assert.match(screen, /mixedQueue\.currentIndex/);
  assert.match(screen, /mixedQueue\.error/);
});

test('mixed playlist transport labels exist in all five translated interface catalogs', () => {
  for (const language of ['en', 'pt', 'fr', 'it', 'de']) {
    const catalog = source(`${language}.lproj/Localizable.strings`);
    for (const key of ['Reproducción de lista', 'Canción anterior de la lista',
      'Siguiente canción de la lista', 'Detener reproducción de lista', 'Canción %d de %d: %@']) {
      assert.ok(catalog.includes(`"${key}" = `), `${language} missing ${key}`);
    }
  }
});

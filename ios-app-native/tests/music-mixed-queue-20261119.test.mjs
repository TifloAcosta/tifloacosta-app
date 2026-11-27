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

test('Apple Music distinguishes natural stopped status from a user pause', () => {
  const apple = source('NativeAppleMusic.swift');
  const queue = source('NativeMixedMusicQueue.swift');
  assert.match(apple, /var onPlaybackFinished: \(\(\) -> Void\)\?/);
  assert.match(apple, /player\.state\.playbackStatus == \.stopped/);
  assert.match(apple, /observedPlaying/);
  assert.match(queue, /NativeAppleMusicPlayer\.shared\.onPlaybackFinished = finished/);
});

test('a saved unavailable remote track returns a failure so the mixed queue can continue', () => {
  const queue = source('NativeMixedMusicQueue.swift');
  const apple = source('NativeAppleMusic.swift');
  const jamendo = source('NativeJamendoMusic.swift');
  assert.match(apple, /func playSaved\(id: String, title: String\) async -> Bool/);
  assert.match(jamendo, /func playSaved\(id: String\) async -> Bool/);
  assert.match(queue, /if !played && generation == playbackGeneration/);
  const audius = source('NativeAudiusMusic.swift');
  assert.match(audius, /func play\(id: String, title: String\) -> Bool/);
});

test('a pending remote lookup is cancelled when the playlist is skipped or stopped', () => {
  const queue = source('NativeMixedMusicQueue.swift');
  assert.match(queue, /private var pendingRemoteTask: Task<Void, Never>\?/);
  assert.match(queue, /pendingRemoteTask\?\.cancel\(\)/);
  assert.match(source('NativeAppleMusic.swift'), /Task\.isCancelled/);
  assert.match(source('NativeJamendoMusic.swift'), /Task\.isCancelled/);
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
      'Siguiente canción de la lista', 'Detener reproducción de lista', 'Canción %d de %d: %@',
      'Esta canción no se pudo reproducir. Se conserva en tu lista.']) {
      assert.ok(catalog.includes(`"${key}" = `), `${language} missing ${key}`);
    }
  }
});

test('completion callbacks are tied to the current item and current playback owner', () => {
  for (const [file, owner] of [['NativeJamendoMusic.swift','jamendo'],['NativeAudiusMusic.swift','audius']]) {
    const player = source(file);
    assert.ok(player.includes('self.player?.currentItem === ended, self.isPlaying'));
    assert.ok(player.includes('NativeRemotePlaybackOwner.current == .' + owner + ' else { return }'));
  }
  assert.match(source('NativeMusicPlayer.swift'), /self\.generation == thisGeneration, self\.isPlaying,\s+NativeRemotePlaybackOwner\.current == \.music/);
  assert.match(source('NativeAppleMusic.swift'), /self\.completionTimer === timer,\s+NativeRemotePlaybackOwner\.current == \.appleMusic/);
});

test('a corrupt local song does not stall the queue and final failures remain visible', () => {
  const queue = source('NativeMixedMusicQueue.swift');
  assert.match(queue, /guard NativeMusicPlayer\.shared\.isPlaying else \{[\s\S]*?currentIndex \+= 1\s+continue/);
  assert.match(source('NativeMyMusic.swift'), /else if let problem = mixedQueue\.error \{[\s\S]*?Text\(problem\)/);
});

test('editorial media accessibility label uses translated source and publication date', () => {
  const media = source('NativeMedia.swift');
  assert.match(media, /item\.title \+ "\. " \+\s+MusicLocalized\.format\("%@\. Fuente: %@", MusicLocalized\.message\(item\.formatLabel\), item\.sourceName\)/);
  assert.match(media, /\.map \{ MusicLocalized\.format\("Publicado: %@", \$0\) \}/);
});

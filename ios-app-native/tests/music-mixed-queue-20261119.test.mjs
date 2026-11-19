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

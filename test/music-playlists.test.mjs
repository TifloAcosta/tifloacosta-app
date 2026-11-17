import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlaylist, insertTrack, moveTrack, removeTrack, evaluateSmartRule } from '../shared/music-playlists.mjs';

test('a playlist keeps manual order and allows repeated songs', () => {
  const playlist = createPlaylist({ id: 'rock', name: 'Rock', trackIds: ['a', 'b'] });
  assert.deepEqual(insertTrack(playlist, 'a', 1).trackIds, ['a', 'a', 'b']);
  assert.deepEqual(playlist.trackIds, ['a', 'b']);
});

test('moving a track uses accessible index operations', () => {
  const playlist = createPlaylist({ id: 'rock', name: 'Rock', trackIds: ['a', 'b', 'c'] });
  assert.deepEqual(moveTrack(playlist, 2, 0).trackIds, ['c', 'a', 'b']);
  assert.deepEqual(removeTrack(playlist, 1).trackIds, ['a', 'c']);
  assert.throws(() => moveTrack(playlist, 5, 0), RangeError);
});

test('smart filters tolerate missing metadata', () => {
  const tracks = [{ id: 'a', artist: 'Ana', genre: 'Rock', playCount: 4 }, { id: 'b', artist: 'Luis' }, { id: 'c', artist: 'Ana', genre: 'Jazz', playCount: 0 }];
  assert.deepEqual(evaluateSmartRule({ field: 'artist', operator: 'equals', value: 'Ana' }, tracks).map((t) => t.id), ['a', 'c']);
  assert.deepEqual(evaluateSmartRule({ field: 'playCount', operator: 'atLeast', value: 2 }, tracks).map((t) => t.id), ['a']);
  assert.deepEqual(evaluateSmartRule({ field: 'genre', operator: 'equals', value: 'Rock' }, tracks).map((t) => t.id), ['a']);
});

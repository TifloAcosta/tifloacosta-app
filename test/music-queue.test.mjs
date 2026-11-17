import test from 'node:test';
import assert from 'node:assert/strict';
import { createMusicQueue, nextMusicTrack, previousMusicTrack, setMusicRepeat, seekMusicPosition, resolvePlayableTrack, setMusicShuffle, sleepDeadline, remainingSleepSeconds } from '../shared/music-queue.mjs';

test('queue advances, stops at end and returns to previous track', () => {
  const initial = createMusicQueue(['a', 'b', 'c']);
  assert.equal(initial.currentId, 'a');
  assert.equal(nextMusicTrack(initial).currentId, 'b');
  assert.equal(previousMusicTrack(nextMusicTrack(initial)).currentId, 'a');
  assert.equal(nextMusicTrack(nextMusicTrack(nextMusicTrack(initial))).currentId, null);
});

test('repeat all wraps and repeat one retains current song', () => {
  const start = createMusicQueue(['a', 'b'], 1);
  assert.equal(nextMusicTrack(setMusicRepeat(start, 'all')).currentId, 'a');
  assert.equal(nextMusicTrack(setMusicRepeat(start, 'one')).currentId, 'b');
  assert.throws(() => setMusicRepeat(start, 'invalid'), /repetición/i);
});

test('seeking is bounded by track duration', () => {
  assert.equal(seekMusicPosition(-50, 10000), 0);
  assert.equal(seekMusicPosition(20000, 10000), 10000);
  assert.equal(seekMusicPosition(3000, 10000), 3000);
});

test('playback prefers an available source and reports unavailable cloud tracks', () => {
  const track = { id: 'song', locations: [
    { id: 'drive', provider: 'google-drive', available: false },
    { id: 'local', provider: 'local', available: true },
  ] };
  assert.equal(resolvePlayableTrack(track).location.id, 'local');
  assert.deepEqual(resolvePlayableTrack({ id: 'missing', locations: [{ id: 'cloud', available: false }] }), { location: null, reason: 'unavailable' });
});

test('shuffle keeps the playing track and can restore the original order', () => {
  const queue = createMusicQueue(['a', 'b', 'c', 'd'], 1);
  const shuffled = setMusicShuffle(queue, true, () => 0);
  assert.equal(shuffled.currentId, 'b');
  assert.equal(shuffled.trackIds[0], 'b');
  assert.deepEqual([...shuffled.trackIds].sort(), ['a', 'b', 'c', 'd']);
  const restored = setMusicShuffle(shuffled, false);
  assert.deepEqual(restored.trackIds, ['a', 'b', 'c', 'd']);
  assert.equal(restored.currentId, 'b');
});

test('shuffle keeps the selected occurrence when a playlist repeats a song', () => {
  const start = createMusicQueue(['a', 'a', 'b'], 1);
  const restored = setMusicShuffle(setMusicShuffle(start, true, () => 0), false);
  assert.equal(restored.index, 1);
  assert.deepEqual(restored.trackIds, ['a', 'a', 'b']);
});

test('sleep timer rejects invalid intervals and reports whole seconds', () => {
  assert.equal(sleepDeadline(1000, 5), 301000);
  assert.equal(remainingSleepSeconds(301000, 300001), 1);
  assert.equal(remainingSleepSeconds(301000, 400000), 0);
  assert.throws(() => sleepDeadline(0, -1), /temporizador/i);
});

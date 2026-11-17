import test from 'node:test';
import assert from 'node:assert/strict';
import { createMusicQueue, nextMusicTrack, previousMusicTrack, setMusicRepeat, seekMusicPosition, resolvePlayableTrack } from '../shared/music-queue.mjs';

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

import test from 'node:test';
import assert from 'node:assert/strict';
import { createTrack, createCatalog, upsertTrack, addLocation, removeLocation } from '../shared/music-catalog.mjs';

test('a song can have local and remote locations without changing its identity', () => {
  const track = createTrack({ id: 'song-1', title: 'Canción', locations: [{ id: 'local-1', provider: 'local', remoteId: 'file:///a.mp3', displayPath: '/a.mp3', available: true }] });
  const linked = addLocation(track, { id: 'drive-1', provider: 'google-drive', remoteId: 'remote-22', displayPath: '/Música/a.mp3', available: true });
  assert.equal(linked.id, 'song-1');
  assert.equal(linked.locations.length, 2);
  assert.equal(track.locations.length, 1);
});

test('adding a duplicate location does not duplicate it', () => {
  const track = createTrack({ id: 'song-1', title: 'Canción' });
  const location = { id: 'drive-1', provider: 'google-drive', remoteId: 'remote-22', displayPath: '/a.mp3', available: true };
  assert.equal(addLocation(addLocation(track, location), location).locations.length, 1);
});

test('moving or losing a source preserves the track and its catalog reference', () => {
  const source = { id: 'file-1', provider: 'local', remoteId: 'file:///original.mp3', displayPath: 'Original', available: true };
  const track = createTrack({ id: 'song-1', title: 'Canción', locations: [source] });
  const unavailable = addLocation(track, { ...source, remoteId: 'file:///new.mp3', displayPath: 'Nuevo', available: false });
  const catalog = upsertTrack(createCatalog(), unavailable);
  assert.equal(catalog.tracks['song-1'].id, 'song-1');
  assert.equal(catalog.tracks['song-1'].locations[0].remoteId, 'file:///new.mp3');
  assert.equal(catalog.tracks['song-1'].locations[0].available, false);
});

test('removing a location changes only virtual catalog metadata', () => {
  const track = createTrack({ id: 'song-1', title: 'Canción', locations: [{ id: 'local-1', provider: 'local', remoteId: 'a.mp3', available: true }] });
  const removed = removeLocation(track, 'local-1');
  assert.deepEqual(removed.locations, []);
  assert.equal(track.locations.length, 1);
  assert.equal(removed.id, track.id);
});

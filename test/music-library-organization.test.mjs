import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMusicFolders, createMusicFolder, renameMusicFolder, moveMusicFolder,
  assignMusicTrack, removeMusicFolder, searchMusicTracks,
} from '../shared/music-library-organization.mjs';

test('creates nested virtual folders without changing tracks or source paths', () => {
  const empty = createMusicFolders();
  const rock = createMusicFolder(empty, { id: 'rock', name: 'Rock' });
  const classics = createMusicFolder(rock, { id: 'classics', name: 'Clásicos', parentId: 'rock' });
  const assigned = assignMusicTrack(classics, 'classics', 'song-1');
  assert.deepEqual(assigned.folders.classics.trackIds, ['song-1']);
  assert.deepEqual(classics.folders.classics.trackIds, []);
  assert.equal(assigned.folders.classics.parentId, 'rock');
});

test('renaming and moving folders prevents cycles and preserves references', () => {
  const first = createMusicFolder(createMusicFolders(), { id: 'rock', name: 'Rock' });
  const nested = createMusicFolder(first, { id: 'classic', name: 'Clásico', parentId: 'rock' });
  const renamed = renameMusicFolder(nested, 'classic', 'Rock clásico');
  assert.equal(renamed.folders.classic.name, 'Rock clásico');
  assert.throws(() => moveMusicFolder(nested, 'rock', 'classic'), /ciclo/i);
  assert.equal(moveMusicFolder(nested, 'classic', null).folders.classic.parentId, null);
});

test('removing a folder never removes original music nor unrelated folders', () => {
  const one = createMusicFolder(createMusicFolders(), { id: 'old', name: 'Antigua' });
  const two = createMusicFolder(one, { id: 'new', name: 'Nueva' });
  const assigned = assignMusicTrack(two, 'old', 'song-1');
  const removed = removeMusicFolder(assigned, 'old');
  assert.deepEqual(Object.keys(removed.folders), ['new']);
  assert.deepEqual(assigned.folders.old.trackIds, ['song-1']);
});

test('searches title, artist and album ignoring accents and case', () => {
  const tracks = [
    { id: 'a', title: 'Corazón', artist: 'Álvaro', album: 'Recuerdos' },
    { id: 'b', title: 'La canción', artist: 'María', album: 'Música para todos' },
  ];
  assert.deepEqual(searchMusicTracks(tracks, 'corazon').map((t) => t.id), ['a']);
  assert.deepEqual(searchMusicTracks(tracks, 'ALVARO').map((t) => t.id), ['a']);
  assert.deepEqual(searchMusicTracks(tracks, 'musica').map((t) => t.id), ['b']);
  assert.deepEqual(searchMusicTracks(tracks, '  ').map((t) => t.id), ['a', 'b']);
});

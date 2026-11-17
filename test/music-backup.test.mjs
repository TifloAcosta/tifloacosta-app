import test from 'node:test';
import assert from 'node:assert/strict';
import { createMusicBackup, readMusicBackup, mergeMusicBackup, shouldCreateAutomaticBackup } from '../shared/music-backup.mjs';

const catalog = { version: 1, tracks: { a: { id: 'a', title: 'Canción', locations: [{ provider: 'local', remoteId: 'file:///song.mp3' }] } } };

test('a portable backup contains a versioned catalog and organization without audio binaries', () => {
  const backup = createMusicBackup({ catalog, folders: [{ id: 'f', name: 'Favoritas', trackIds: ['a'] }], playlists: [], audioProfiles: { general: 'Rock' } }, '2026-11-17T10:00:00.000Z');
  assert.equal(backup.format, 'tifloacosta-mi-musica');
  assert.equal(backup.version, 1);
  assert.equal(backup.catalog.tracks.a.title, 'Canción');
  assert.equal(backup.includesAudioFiles, false);
  assert.deepEqual(readMusicBackup(JSON.stringify(backup)).folders[0].trackIds, ['a']);
});

test('invalid or unsupported backups are rejected before changing the library', () => {
  assert.throws(() => readMusicBackup('{invalid'), /respaldo/i);
  assert.throws(() => readMusicBackup(JSON.stringify({ format: 'tifloacosta-mi-musica', version: 99 })), /versión/i);
  assert.throws(() => readMusicBackup(JSON.stringify({ format: 'other', version: 1 })), /respaldo/i);
});

test('restoration merges songs and folders and keeps existing records', () => {
  const incoming = createMusicBackup({ catalog, folders: [{ id: 'f', name: 'Favoritas', trackIds: ['a'] }] });
  const existing = { catalog: { version: 1, tracks: { b: { id: 'b', title: 'Otra' } } }, folders: [{ id: 'g', name: 'Mías', trackIds: ['b'] }] };
  const merged = mergeMusicBackup(existing, incoming);
  assert.deepEqual(Object.keys(merged.catalog.tracks).sort(), ['a', 'b']);
  assert.deepEqual(merged.folders.map(folder => folder.id).sort(), ['f', 'g']);
  assert.equal(existing.catalog.tracks.a, undefined);
});

test('automatic backup is opt-in and only due after its chosen interval', () => {
  const now = '2026-11-17T12:00:00.000Z';
  assert.equal(shouldCreateAutomaticBackup({ enabled: false, intervalDays: 7 }, now), false);
  assert.equal(shouldCreateAutomaticBackup({ enabled: true, intervalDays: 7, lastBackupAt: '2026-11-11T12:00:00.000Z' }, now), false);
  assert.equal(shouldCreateAutomaticBackup({ enabled: true, intervalDays: 7, lastBackupAt: '2026-11-10T12:00:00.000Z' }, now), true);
  assert.equal(shouldCreateAutomaticBackup({ enabled: true, intervalDays: 7 }, now), true);
});

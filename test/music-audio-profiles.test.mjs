import test from 'node:test';
import assert from 'node:assert/strict';
import { MUSIC_EQ_FREQUENCIES, MUSIC_EQ_PRESETS, createMusicAudioSettings, setMusicAudioOverride, removeMusicAudioOverride, resolveMusicAudioProfile, normalizeMusicEqBands } from '../shared/music-audio-profiles.mjs';

test('five accessible EQ bands have fixed frequencies and safe gain bounds', () => {
  assert.deepEqual(MUSIC_EQ_FREQUENCIES, [80, 250, 1000, 4000, 12000]);
  assert.deepEqual(normalizeMusicEqBands([-30, -5, 0, 4.5, 99]), [-12, -5, 0, 4.5, 12]);
  assert.throws(() => normalizeMusicEqBands([0, 1]), /cinco bandas/i);
});

test('built-in profiles are distinct and normal is flat', () => {
  assert.deepEqual(MUSIC_EQ_PRESETS.normal, [0, 0, 0, 0, 0]);
  assert.notDeepEqual(MUSIC_EQ_PRESETS.rock, MUSIC_EQ_PRESETS.clarity);
  assert.equal(Object.keys(MUSIC_EQ_PRESETS).includes('classical'), true);
});

test('specific song takes precedence over playlist, album and general settings', () => {
  let settings = createMusicAudioSettings('normal');
  settings = setMusicAudioOverride(settings, 'album', 'album-1', 'classical');
  settings = setMusicAudioOverride(settings, 'playlist', 'playlist-1', 'rock');
  settings = setMusicAudioOverride(settings, 'song', 'track-1', 'clarity');
  assert.equal(resolveMusicAudioProfile(settings, { songId: 'track-1', albumId: 'album-1', playlistId: 'playlist-1' }).name, 'clarity');
  assert.equal(resolveMusicAudioProfile(settings, { songId: 'track-2', albumId: 'album-1', playlistId: 'playlist-1' }).name, 'rock');
  assert.equal(resolveMusicAudioProfile(settings, { songId: 'track-2', albumId: 'album-1' }).name, 'classical');
  assert.equal(resolveMusicAudioProfile(settings, { songId: 'track-2' }).name, 'normal');
});

test('settings are independent and accept a custom five-band profile', () => {
  const readerSettings = { speed: 1.25, voice: 'Ana' };
  const music = setMusicAudioOverride(createMusicAudioSettings(), 'song', 'track-1', { name: 'Mis auriculares', bands: [1, 0, -2, 3, 4] });
  assert.deepEqual(resolveMusicAudioProfile(music, { songId: 'track-1' }).bands, [1, 0, -2, 3, 4]);
  assert.deepEqual(readerSettings, { speed: 1.25, voice: 'Ana' });
});

test('removing a song override restores playlist and general inheritance', () => {
  let settings = createMusicAudioSettings('normal');
  settings = setMusicAudioOverride(settings, 'playlist', 'favorites', 'rock');
  settings = setMusicAudioOverride(settings, 'song', 'track-a', 'clarity');
  const restored = removeMusicAudioOverride(settings, 'song', 'track-a');
  assert.equal(resolveMusicAudioProfile(restored, { songId: 'track-a', playlistId: 'favorites' }).name, 'rock');
  assert.equal(resolveMusicAudioProfile(settings, { songId: 'track-a' }).name, 'clarity');
});

test('serialized settings retain custom profiles without leaking reader settings', () => {
  const settings = setMusicAudioOverride(createMusicAudioSettings(), 'song', 'track-a', { name: 'Mi perfil', bands: [-2, 1, 0, 2, 3] });
  const restored = JSON.parse(JSON.stringify(settings));
  assert.deepEqual(resolveMusicAudioProfile(restored, { songId: 'track-a' }).bands, [-2, 1, 0, 2, 3]);
  assert.equal(JSON.stringify(restored).includes('reading'), false);
});

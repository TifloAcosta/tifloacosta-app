import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');

test('Audius is a separate, searchable music platform using its read-only public API', () => {
  const screen = source('NativeRadioBrowser.swift');
  const audius = source('NativeAudiusMusic.swift');
  assert.match(screen, /NavigationLink\("Audius: música gratuita"\)/);
  assert.match(audius, /api\.audius\.co/);
  assert.match(audius, /\/v1\/tracks\/search/);
  assert.match(audius, /\/v1\/tracks\/trending/);
  assert.match(audius, /URLQueryItem\(name: "app_name", value: "TifloAcosta"\)/);
  assert.match(audius, /\.searchable\(text: \$query/);
});

test('Audius streams tracks without saving audio and arbitrates audio ownership', () => {
  const audius = source('NativeAudiusMusic.swift');
  const music = source('NativeMusicPlayer.swift');
  const reader = source('NativeTifloLector.swift');
  assert.match(audius, /\/v1\/tracks\/\\\(id\)\/stream/);
  assert.match(audius, /AVPlayer\(url: target\)/);
  assert.match(audius, /NativeRemotePlaybackOwner\.claim\(\.audius\)/);
  assert.match(music, /case reader, music, radio, audius/);
  assert.match(music, /NativeAudiusPlayer\.shared\.pauseForOtherAudio\(\)/);
  assert.match(reader, /NativeAudiusPlayer\.shared\.pauseForOtherAudio\(\)/);
  assert.match(audius, /MPRemoteCommandCenter\.shared\(\)/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');

test('free radio is accessible through the separate music platforms screen', () => {
  assert.match(source('NativeMyMusic.swift'), /NavigationLink\("Plataformas musicales"\)/);
  assert.match(source('NativeRadioBrowser.swift'), /NavigationLink\("Radio musical gratuita"\)/);
  assert.match(source('NativeRadioBrowser.swift'), /\.searchable\(text: \$query/);
});

test('radio stations are looked up through official Radio Browser API with guarded HTTPS streams', () => {
  const radio = source('NativeRadioBrowser.swift');
  assert.match(radio, /de1\.api\.radio-browser\.info/);
  assert.match(radio, /json\/stations\/search/);
  assert.match(radio, /station\.urlResolved\?\.scheme == "https"/);
  assert.match(radio, /lastcheckok/);
  assert.match(radio, /URLSession\.shared\.data\(for:/);
});

test('radio playback shares headset ownership and pauses other local audio players', () => {
  const radio = source('NativeRadioBrowser.swift');
  const music = source('NativeMusicPlayer.swift');
  const reader = source('NativeTifloLector.swift');
  assert.match(music, /case reader, music, radio/);
  assert.match(radio, /NativeReaderPlaybackBridge\.pauseActiveReader\?\(\)/);
  assert.match(radio, /NativeMusicPlayer\.shared\.pauseForReader\(\)/);
  assert.match(radio, /NativeRemotePlaybackOwner\.claim\(\.radio\)/);
  assert.match(radio, /MPRemoteCommandCenter\.shared\(\)/);
  assert.match(music, /NativeRadioPlayer\.shared\.pauseForOtherAudio\(\)/);
  assert.match(reader, /NativeRadioPlayer\.shared\.pauseForOtherAudio\(\)/);
});

test('saved radio stations keep their name and stream URL for later playback', () => {
  const radio = source('NativeRadioBrowser.swift');
  assert.match(radio, /NativeRadioStation: Codable/);
  assert.match(radio, /Section\("Emisoras favoritas"\)/);
  assert.match(radio, /JSONEncoder\(\)\.encode\(updated\)/);
  assert.match(radio, /JSONDecoder\(\)\.decode\(\[NativeRadioStation\]\.self/);
});

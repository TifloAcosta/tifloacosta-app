import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const music = read('NativeMusicPlayer.swift');
const screen = read('NativeMyMusic.swift');
const reader = read('NativeTifloLector.swift');
const plist = read('Info.plist');

test('both players use native background audio and a shared remote owner', () => {
  assert.match(plist, /<key>UIBackgroundModes<\/key><array><string>audio<\/string><\/array>/);
  assert.match(music, /enum NativeRemotePlaybackOwner/);
  assert.match(music, /MPRemoteCommandCenter\.shared\(\)/);
  assert.match(reader, /NativeRemotePlaybackOwner\.claim\(\.reader\)/);
  assert.match(music, /NativeRemotePlaybackOwner\.claim\(\.music\)/);
  assert.match(reader, /NativeRemotePlaybackOwner\.current == \.reader/);
});

test('Mi Música keeps its playback engine alive and handles headset play pause and tracks', () => {
  assert.match(music, /static let shared = NativeMusicPlayer\(\)/);
  assert.match(screen, /@ObservedObject private var player = NativeMusicPlayer\.shared/);
  for (const command of ['playCommand', 'pauseCommand', 'togglePlayPauseCommand', 'nextTrackCommand', 'previousTrackCommand']) {
    assert.match(music, new RegExp('remoteCommandCenter\\.' + command + '\\.addTarget'));
  }
  assert.match(music, /remoteCommandCenter\.playCommand\.isEnabled = true/);
  assert.match(music, /remoteCommandCenter\.pauseCommand\.isEnabled = true/);
  assert.match(music, /remoteCommandCenter\.togglePlayPauseCommand\.isEnabled = true/);
  assert.match(music, /MPNowPlayingInfoCenter\.default\(\)\.nowPlayingInfo/);
});

test('reader releases remote controls without removing music handlers', () => {
  assert.match(reader, /NativeMusicPlayer\.shared\.pauseForReader\(\)/);
  assert.match(reader, /NativeRemotePlaybackOwner\.release\(\.reader\)/);
  assert.match(music, /removeTarget\(remoteCommandTokens/);
  assert.match(music, /NativeReaderPlaybackBridge\.pauseActiveReader\?\(\)/);
  assert.match(reader, /NativeReaderPlaybackBridge\.pauseActiveReader = \{ if speech\.isPlaying \{ pausePlayback\(\) \} \}/);
});

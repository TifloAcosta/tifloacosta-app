import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');

test('MusicKit asks authorization explicitly and uses Apple application player', () => {
  const screen = source('NativeAppleMusic.swift');
  assert.match(screen, /import MusicKit/);
  assert.match(screen, /MusicAuthorization\.request\(\)/);
  assert.match(screen, /MusicSubscription\.current/);
  assert.match(screen, /MusicCatalogSearchRequest\(term: .*types: \[Song\.self\]\)/);
  assert.match(screen, /ApplicationMusicPlayer\.shared/);
  assert.match(screen, /NativeRemotePlaybackOwner\.claim\(\.appleMusic\)/);
});

test('Apple Music is hidden until developer entitlement is confirmed', () => {
  const platforms = source('NativeRadioBrowser.swift');
  assert.match(platforms, /if Bundle\.main\.object\(forInfoDictionaryKey: "TifloAppleMusicEnabled"\) as\? Bool == true/);
  assert.match(platforms, /NavigationLink\("Apple Music"\)/);
  const plist = source('Info.plist');
  assert.match(plist, /NSAppleMusicUsageDescription/);
  assert.doesNotMatch(plist, /<key>TifloAppleMusicEnabled<\/key><true\/>/);
});

test('other players can pause Apple Music before taking ownership', () => {
  const music = source('NativeMusicPlayer.swift');
  const reader = source('NativeTifloLector.swift');
  const radio = source('NativeRadioBrowser.swift');
  const audius = source('NativeAudiusMusic.swift');
  assert.match(music, /case reader, music, radio, audius, appleMusic/);
  for (const file of [music, reader, radio, audius]) {
    assert.match(file, /NativeAppleMusicPlayer\.shared\.pauseForOtherAudio\(\)/);
  }
});

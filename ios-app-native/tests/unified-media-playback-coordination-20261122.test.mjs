import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const owner = source('NativeMusicPlayer.swift');
const podcasts = source('NativePodcasts.swift');
const cinema = source('NativeAccessibleCinemaLibrary.swift');
const cinemaScreen = source('NativeAccessibleCinema.swift');
const youtube = source('NativeYouTubePlayer.swift');
const media = source('NativeMedia.swift');
const appleMusic = source('NativeAppleMusic.swift');

test('one playback owner coordinates TifloLector, music, radio, podcasts, cinema and YouTube', () => {
  for (const destination of ['reader', 'music', 'radio', 'audius', 'appleMusic', 'jamendo',
                             'podcast', 'cinema', 'youtube']) {
    assert.match(owner, new RegExp('case\\s+[^\\n]*\\b' + destination + '\\b'));
  }
  assert.match(owner, /if let previous = current, previous != destination/);
  assert.match(owner, /case \.reader: NativeReaderPlaybackBridge\.pauseActiveReader\?\(\)/);
  assert.match(owner, /case \.music: NativeMusicPlayer\.shared\.pauseForReader\(\)/);
  assert.match(owner, /case \.podcast, \.cinema, \.youtube: interruptionHandlers\[previous\]\?\(\)/);
  assert.match(owner, /private static var interruptionHandlers/);
  assert.match(owner, /guard current == destination else \{ return \}/);
});

test('podcast playback claims arbitration and exposes lock-screen play pause without opening external apps', () => {
  assert.match(podcasts, /NativeRemotePlaybackOwner\.claim\(\.podcast\)/);
  assert.match(podcasts, /NativeRemotePlaybackOwner\.onInterrupted\(\.podcast\)/);
  assert.match(podcasts, /func pauseForOtherAudio\(\)/);
  assert.match(podcasts, /MPNowPlayingInfoCenter\.default\(\)\.nowPlayingInfo/);
  assert.match(podcasts, /MPRemoteCommandCenter\.shared\(\)/);
  assert.match(podcasts, /NativeRemotePlaybackOwner\.release\(\.podcast\)/);
  assert.match(media, /if item\.type == "audio", let audioURL = item\.directAudioURL/);
});

test('cinema playback survives navigation and pauses for competing media', () => {
  assert.match(cinema, /static let shared = NativeCinemaLocalLibrary\(\)/);
  assert.match(cinema, /static let shared = NativeCinemaAudioPlayer\(\)/);
  assert.match(cinemaScreen, /@StateObject private var personalPlayer = NativeCinemaAudioPlayer\.shared/);
  assert.match(cinemaScreen, /\.onDisappear \{ personalPlayer\.refresh\(library: personalLibrary\) \}/);
  assert.match(cinema, /NativeRemotePlaybackOwner\.onInterrupted\(\.cinema\)/);
  assert.match(cinema, /NativeRemotePlaybackOwner\.claim\(\.cinema\)/);
  assert.match(cinema, /NativeRemotePlaybackOwner\.release\(\.cinema\)/);
  assert.match(cinema, /MPRemoteCommandCenter\.shared\(\)/);
});

test('embedded official YouTube player releases audio when another section starts', () => {
  assert.match(youtube, /NativeRemotePlaybackOwner\.onInterrupted\(\.youtube\)/);
  assert.match(youtube, /NativeRemotePlaybackOwner\.claim\(\.youtube\)/);
  assert.match(youtube, /NativeRemotePlaybackOwner\.release\(\.youtube\)/);
  assert.match(youtube, /externallyPaused/);
  assert.match(youtube, /A delayed iframe status must not reclaim audio from a new player/);
  assert.match(youtube, /https:\/\/www\.youtube\.com\/iframe_api/);
});

test('third-party restrictions remain respected rather than bypassing source platforms', () => {
  assert.match(media, /if let externalURL = item\.originalURL/);
  assert.match(appleMusic, /ApplicationMusicPlayer\.shared/);
  assert.doesNotMatch(owner, /AVAudioSession\.sharedInstance\(\)\.outputVolume/);
});

test('seeking a paused local song does not resume playback or interrupt another media section', () => {
  const seek = owner.slice(owner.indexOf('func skip(seconds: TimeInterval)'), owner.indexOf('func changeRepeat()'));
  assert.match(seek, /let wasPlaying = isPlaying/);
  assert.match(seek, /guard let file, file\.length > 0, duration > 0, seconds\.isFinite else \{ return \}/);
  assert.match(seek, /if wasPlaying \{[\s\S]*NativeRemotePlaybackOwner\.claim\(\.music\)[\s\S]*node\.play\(\)/);
  assert.match(seek, /isPlaying = wasPlaying/);
  assert.match(seek, /position = target/);
  assert.doesNotMatch(seek.split('if wasPlaying {')[0], /NativeRemotePlaybackOwner\.claim\(\.music\)|node\.play\(\)/);
});

test('personal cinema activates its own background audio session before taking control', () => {
  const open = cinema.slice(cinema.indexOf('func open(_ item:'), cinema.indexOf('private func beginProgressTracking'));
  assert.match(open, /try AVAudioSession\.sharedInstance\(\)\.setCategory\(\.playback, mode: \.moviePlayback\)/);
  assert.match(open, /try AVAudioSession\.sharedInstance\(\)\.setActive\(true\)/);
  assert.ok(open.indexOf('setActive(true)') < open.indexOf('NativeRemotePlaybackOwner.claim(.cinema)'));
  assert.match(open, /NativeRemotePlaybackOwner\.onInterrupted\(\.cinema\)/);
  assert.doesNotMatch(open, /outputVolume|MPVolumeView/);
});

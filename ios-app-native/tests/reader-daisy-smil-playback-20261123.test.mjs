import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const reader = source('NativeTifloLector.swift');
const formats = source('NativeReaderFormats.swift');
const audio = source('NativeDaisyAudioOrder.swift');
const part = (start, end) => reader.split(start)[1]?.split(end)[0] ?? '';

test('SMIL audio clips persist without breaking older libraries', () => {
  assert.match(audio, /struct NativeDaisyAudioClip: Codable, Hashable/);
  assert.match(audio, /let track: Int/);
  assert.match(audio, /let begin: TimeInterval/);
  assert.match(audio, /let end: TimeInterval\?/);
  assert.match(reader, /var daisyClips: \[NativeDaisyAudioClip\]\? = nil/);
  assert.match(reader, /daisyClips: payload\.daisyClips/);
  assert.match(formats, /var daisyClips: \[NativeDaisyAudioClip\] = \[\]/);
  assert.match(formats, /NativeDaisyAudioOrder\.orderedClips\(/);
  assert.match(formats, /daisyClips: daisyClips/);
});

test('clip reader uses SMIL begin and end, retains repeated physical tracks', () => {
  assert.match(audio, /private struct NativeDaisySMILSource/);
  assert.match(audio, /begin: value\(\["clipbegin", "clip-begin"\]\)/);
  assert.match(audio, /end: value\(\["clipend", "clip-end"\]\)/);
  const parse = audio.split('static func orderedClips(')[1]?.split('static func orderedAudioFiles(')[0] ?? '';
  assert.match(parse, /for source in smilSources\(data\)/);
  assert.match(parse, /let begin = seconds\(source\.begin\) \?\? 0/);
  assert.match(parse, /let end = seconds\(source\.end\)/);
  assert.match(parse, /clips\.append\(\.init\(track: track, begin: begin, end: end\)\)/);
  assert.doesNotMatch(parse, /seenAudio|Set<NativeDaisyAudioClip>/);
});

test('DAISY player changes clips exactly at clipEnd and keeps legacy playlist', () => {
  const player = part('final class NativeReadingSpeech: ObservableObject {', 'struct NativeReaderLibraryScreen: View {');
  assert.match(player, /func playDaisySequence\(/);
  assert.match(player, /private func advanceDaisyClip\(\)/);
  assert.match(player, /atSeconds: clip\.begin/);
  assert.match(player, /daisyClips\[daisyClipIndex\]\.end/);
  assert.match(player, /advanceDaisyClip\(\)/);
  assert.match(player, /func playPlaylist\(/);
  assert.match(player, /daisyClips = \[\]/);
  assert.match(player, /private func scheduleDaisyBoundary\(\)/);
  assert.match(player, /Task\.sleep\(for: \.seconds\(delay\)\)/);
  assert.match(player, /daisyBoundaryTask\?\.cancel\(\)/);
  assert.match(player, /scheduleDaisyBoundary\(\)/);
});

test('TifloLector starts SMIL playback only on explicit Play', () => {
  const track = part('private func playTrack() {', 'private func restoreAudioPosition() {');
  assert.match(track, /if latest\.fileExtension\?\.lowercased\(\) == "daisy"/);
  assert.match(track, /try speech\.playDaisySequence\(/);
  assert.match(track, /try speech\.playPlaylist\(/);
  assert.match(track, /pendingDaisyAudioSeconds/);
  const jump = part('private func jumpToDaisy(', 'private func pausePlayback()');
  assert.doesNotMatch(jump, /playTrack\(|playDaisySequence\(|speech\.play\(/);
});

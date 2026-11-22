import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');
const part = (start, end) => source.split(start)[1]?.split(end)[0] ?? '';

test('DAISY heading is a navigable unit even for audio-only books', () => {
  const options = part('private var navigationOptions:', 'private var effectiveNavigationUnit:');
  assert.match(options, /latest\.daisyNavigation/);
  assert.match(options, /options\.append\(\(4, "Encabezado"\)\)/);
  const move = part('private func moveUnit(_ direction: Int) {', 'private func moveDaisyPoint(');
  assert.match(move, /if unit == 4/);
  assert.match(move, /moveDaisyPoint\(direction, kind: nil\)/);
});

test('DAISY heading navigation seeks without starting audio or speech', () => {
  const jump = part('private func jumpToDaisy(', 'private func pausePlayback()');
  assert.match(jump, /if speech\.isPlaying \|\| speech\.isPaused \{ stopPlayback\(\) \}/);
  assert.match(jump, /pendingDaisyAudioSeconds = targetSeconds/);
  assert.match(jump, /library\.saveAudioPosition\(/);
  assert.match(jump, /showStructure = false/);
  assert.match(jump, /UIAccessibility\.post\(notification: \.announcement, argument: message\)/);
  assert.doesNotMatch(jump, /playTrack\(|startTextSpeech\(|speech\.play\(|focusedFragment = /);
});

test('text heading navigation also prevents unsolicited reader speech and focus movement', () => {
  const move = part('private func moveUnit(_ direction: Int) {', 'private func moveDaisyPoint(');
  assert.match(move, /if speech\.isPlaying \|\| speech\.isPaused \{ stopPlayback\(\) \}/);
  assert.match(move, /jump\(to: next, focusReader: false\)/);
  assert.match(move, /UIAccessibility\.post\(notification: \.announcement, argument: message\)/);
  const jump = part('private func jump(to offset: Int, focusReader: Bool = true) {', 'private func activateCurrentLink()');
  assert.match(jump, /if focusReader \{/);
});

test('reader only resumes audio at the selected DAISY position after Play', () => {
  const play = part('private func play() {', 'private func refreshLiveReadingSettings()');
  assert.match(play, /if let targetSeconds = pendingDaisyAudioSeconds, speech\.hasAudio/);
  assert.match(play, /speech\.seek\(toSeconds: targetSeconds\)/);
  assert.match(play, /pendingDaisyAudioSeconds = nil/);
  const progress = part('private func persistPosition() {', 'private func move(to percent: Int)');
  assert.match(progress, /pendingDaisyAudioSeconds \?\? latest\.lastAudioSeconds/);
  const move = part('private func moveDaisyPoint(', 'private func moveBetweenMarks(');
  assert.match(move, /pendingDaisyAudioSeconds \?\? latest\.lastAudioSeconds \?\? 0/);
});

test('short heading announcement and boundary messages are translated', () => {
  const keys = [
    'Encabezado: %@. Pulsa Reproducir para escuchar.',
    'No hay más encabezados en esa dirección.'
  ];
  for (const language of ['en', 'pt', 'fr', 'it', 'de']) {
    const strings = readFileSync(
      new URL('../Sources/' + language + '.lproj/Localizable.strings', import.meta.url), 'utf8');
    for (const key of keys) assert.ok(strings.includes('"' + key + '" = '), language + ': ' + key);
  }
});

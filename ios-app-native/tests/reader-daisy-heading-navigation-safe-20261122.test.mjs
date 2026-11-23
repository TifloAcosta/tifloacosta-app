import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const source = read('NativeTifloLector.swift');
const part = (start, end) => source.split(start)[1]?.split(end)[0] ?? '';

test('DAISY headings are available even in audio-only books when there are multiple points', () => {
  const options = part('private var navigationOptions:', 'private var effectiveNavigationUnit:');
  assert.match(options, /let daisySections = \(latest\.daisyNavigation/);
  assert.match(options, /daisySections\.count > 1/);
  assert.match(options, /options\.append\(\(4, "Encabezado"\)\)/);
  const move = part('private func moveUnit(_ direction: Int) {', 'private func moveDaisyPoint(');
  assert.match(move, /if unit == 7 && !tracks.isEmpty && daisyChapterPoints.count > 1/);
  assert.match(move, /moveDaisyPoint\(direction, kind: "Capítulo"\)/);
  assert.match(move, /if unit == 4 && !tracks.isEmpty/);
  assert.match(move, /moveDaisyPoint\(direction, kind: nil\)/);
});

test('DAISY heading jump preserves audio location without starting playback', () => {
  const jump = part('private func jumpToDaisy(', 'private func pausePlayback()');
  assert.match(jump, /if speech\.isPlaying \|\| speech\.isPaused \{ stopPlayback\(\) \}/);
  assert.match(jump, /pendingDaisyAudioSeconds = targetSeconds/);
  assert.match(jump, /AVAudioPlayer\(contentsOf: url\)/);
  assert.match(jump, /probe\.duration\.isFinite, probe\.duration > 0/);
  assert.match(jump, /targetSeconds \/ probe\.duration \* 100/);
  assert.match(jump, /library\.saveAudioPosition\(document, track: trackIndex, percent: currentPercent/);
  assert.match(jump, /library\.saveAudioPosition\(/);
  assert.match(jump, /showStructure = false/);
  assert.match(jump, /if announce \{/);
  assert.doesNotMatch(jump, /playTrack\(|startTextSpeech\(|speech\.play\(|focusedFragment = /);
  const move = part('private func moveDaisyPoint(', 'private func moveBetweenMarks(');
  assert.match(move, /jumpToDaisy\(point, announce: false\)/);
  assert.match(move, /navigationFeedback = MusicLocalized\.format/);
});

test('text navigation stops speech and keeps focus on adjustable control', () => {
  const move = part('private func moveUnit(_ direction: Int) {', 'private func moveDaisyPoint(');
  assert.match(move, /navigateText\(to: next, unit: unit\)/);
  const helper = part('private func navigateText(to offset: Int, unit: Int) {', 'private var excerpt: String');
  assert.match(helper, /if speech\.isPlaying \|\| speech\.isPaused \{ stopPlayback\(\) \}/);
  assert.match(helper, /jump\(to: offset, focusReader: false\)/);
  assert.match(helper, /navigationScrollTarget =/);
  assert.match(helper, /navigationFeedback =/);
  const jump = part('private func jump(to offset: Int, focusReader: Bool = true) {', 'private func activateCurrentLink()');
  assert.match(jump, /if focusReader \{/);
});

test('reader resumes DAISY audio from exact point only after Play', () => {
  const play = part('private func play() {', 'private func refreshLiveReadingSettings()');
  assert.match(play, /if let targetSeconds = pendingDaisyAudioSeconds, speech\.hasAudio/);
  assert.match(play, /speech\.seek\(toSeconds: targetSeconds\)/);
  assert.match(play, /pendingDaisyAudioSeconds = nil/);
  const progress = part('private func persistPosition() {', 'private func move(to percent: Int)');
  assert.match(progress, /pendingDaisyAudioSeconds \?\? latest\.lastAudioSeconds/);
});

test('short navigation feedback and fallback are translated', () => {
  for (const language of ['en', 'pt', 'fr', 'it', 'de']) {
    const catalog = read(language + '.lproj/Localizable.strings');
    for (const key of [
      'Encabezado: %@. Pulsa Reproducir para escuchar.',
      'Modo de navegación: %@',
      'Modo anterior no disponible. Modo de navegación: %@'
    ]) {
      assert.ok(catalog.includes('"' + key + '" = '), language + ': ' + key);
    }
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const reader = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');
const part = (start, end) => reader.split(start)[1]?.split(end)[0] ?? '';

test('VoiceOver adjustable playback exposes the reached unit, never a percent', () => {
  const playback = part('private var playbackRow: some View {',
                        '@ViewBuilder\n    private var trackButtons');
  assert.match(playback, /[.]accessibilityValue[(]navigationAccessibilityValue[)]/);
  assert.match(playback, /case [.]increment: moveUnit[(]1[)]/);
  assert.match(playback, /case [.]decrement: moveUnit[(]-1[)]/);
  assert.doesNotMatch(playback, /por ciento|currentPercent|textPercent/);
  const accessibility = part('private var navigationAccessibilityValue: String {',
                             'private func textNavigationFeedback(');
  assert.match(accessibility, /navigationFeedback/);
  assert.match(accessibility, /Modo de navegación/);
  assert.doesNotMatch(accessibility, /percent|por ciento/);
});

test('each text unit announces the actual reached content rather than another unit', () => {
  const feedback = part('private func textNavigationFeedback(at offset: Int, unit: Int) -> String {',
                        'private func navigateText(to offset: Int, unit: Int) {');
  assert.match(feedback, /navigationOptions[.]first[(]where: [{$] /);
  assert.match(feedback, /if unit == 3, let page = textLayout[.]namedPages[.]first/);
  assert.match(feedback, /if [(]unit == 4 [|][|] unit == 7[)]/);
  assert.match(feedback, /textLayout[.]namedHeadings[.]first/);
  assert.match(feedback, /NativeReaderHeadingDisplay[.]title/);
  assert.match(feedback, /textLayout[.]nearbyOffset[(]offset, direction: 1, unit: unit[)]/);
  assert.match(feedback, /min[(]120, end - offset[)]/);
  assert.doesNotMatch(feedback, /percent|por ciento/);
});

test('text navigation and headings use one semantic announcement without autoplay', () => {
  const nav = part('private func navigateText(to offset: Int, unit: Int) {',
                   'private var excerpt: String {');
  assert.match(nav, /jump[(]to: offset, focusReader: false[)]/);
  assert.match(nav, /navigationFeedback = textNavigationFeedback[(]at: readingOffset, unit: unit[)]/);
  assert.doesNotMatch(nav, /startTextSpeech[(]|playTrack[(]/);
  const move = part('private func moveUnit(_ direction: Int) {',
                    'private func moveDaisyPoint(');
  assert.match(move, /navigateText[(]to: next, unit: unit[)]/);
  assert.doesNotMatch(move, /navigationFeedback = MusicLocalized[.]format[(]"%@: %@"[^]*?unit == 4 [?] "Encabezado"/);
});

test('the artificial end position is not announced as an empty block or page', () => {
  const offset = part('func nearbyOffset(_ offset: Int, direction: Int, unit: Int) -> Int? {',
                      'func fragmentIndex(for offset: Int) -> Int {');
  assert.match(offset, /boundaries[.]first[(]where: [{$]0 > offset && [}]0 < totalCharacters [}][)]/);
  assert.match(offset, /boundaries[.]last[(]where: [{$]0 < offset && [}]0 < totalCharacters [}][)]/);
});

test('structural navigation retains DAISY chapter/page labels and minute feedback', () => {
  const move = part('private func moveUnit(_ direction: Int) {',
                    'private func moveDaisyPoint(');
  assert.match(move, /moveDaisyPoint[(]direction, kind: unit == 9 [?] "Página" : "Referencia"[)]/);
  assert.match(move, /moveDaisyPoint[(]direction, kind: "Capítulo"[)]/);
  assert.match(move, /skipReading[(]direction[)]/);
  assert.match(reader, /navigationFeedback = MusicLocalized[.]format[(]"%@: %@"[\s\S]*?NativeReaderHeadingDisplay[.]title[(]point[.]title/);
});

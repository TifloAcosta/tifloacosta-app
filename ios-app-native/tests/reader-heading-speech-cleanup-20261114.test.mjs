import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const reader = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');

test('heading markers are hidden from VoiceOver and braille without changing document offsets', () => {
  assert.match(reader, /private func visibleReaderFragment\(at index: Int\) -> String/);
  assert.match(reader, /Text\(visibleReaderFragment\(at: index\)\)/);
  assert.match(reader, /textLayout\.fragmentStarts\[index\]/);
});

test('leading inverted exclamation is suppressed only for generated speech', () => {
  const block = reader.split('private static func textForSpeech(_ source: String) -> String {')[1]?.split('private func speakNextSystemSegment')[0] ?? '';
  assert.match(block, /¡/);
  assert.match(block, /stringByReplacingMatches/);
});

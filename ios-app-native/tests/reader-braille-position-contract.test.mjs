import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');

test('manual VoiceOver focus keeps exact cursor with coalesced persistence', () => {
  assert.match(source, /lastReaderFragment = index/);
  assert.match(source, /private func scheduleManualPositionSave/);
  assert.match(source, /readingOffset = textLayout\.fragmentStarts\[index\]/);
  assert.match(source, /library\.saveTextPosition\(document, offset: readingOffset\)/);
  assert.match(source, /readingOffset = textLayout\.fragmentStarts\[index\][\s\S]{0,440}scheduleManualPositionSave\(\)/);
});

test('manual reading restores focus to the saved fragment without starting speech', () => {
  assert.match(source, /private func restoreManualReadingFocus/);
  assert.match(source, /readingMode != 1/);
  assert.match(source, /focusedFragment = savedFragment/);
  assert.match(source, /proxy\.scrollTo\(savedFragment, anchor: \.center\)/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const braille = readFileSync(new URL('../Sources/NativeReaderContinuousBrailleText.swift', import.meta.url), 'utf8');
const reader = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');

test('the active braille reader uses the live cursor rather than a stale saved offset', () => {
  assert.match(reader, /initialOffset: max\(0, min\(latest\.body\.count, readingOffset\)\)/);
  assert.doesNotMatch(reader, /initialOffset: max\(0, min\(latest\.body\.count, latest\.lastTextOffset \?\? readingOffset\)\)/);
});

test('SwiftUI repaint does not overwrite the braille selection or scroll on unchanged state', () => {
  assert.match(braille, /if view\.font != requestedFont \{ view\.font = requestedFont \}/);
  assert.match(braille, /guard textChanged \|\| explicitPositionChange else \{ return \}/);
  assert.match(braille, /context\.coordinator\.restoring = true/);
  assert.match(braille, /defer \{ context\.coordinator\.restoring = false \}/);
  assert.match(braille, /if textChanged \|\| movedSelection \{/);
  assert.match(braille, /view\.scrollRangeToVisible\(restoredRange\)/);
});

test('actual navigation still reports the UTF-16 selection as character offset', () => {
  assert.match(braille, /let prefix = \(view\.text as NSString\)\.substring\(to: utf16Offset\)/);
  assert.match(braille, /parent\.onPositionChange\(characterOffset\)/);
});

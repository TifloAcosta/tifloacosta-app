import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = name => readFileSync(new URL(`../Sources/${name}`, import.meta.url), 'utf8');

test('Braille renders one continuous scrollable text surface rather than requiring a next-fragment action', () => {
  const reader = source('NativeTifloLector.swift');
  assert.match(reader, /if presentationMode == 2 && !latest\.body\.isEmpty\s*\{/);
  assert.match(reader, /NativeReaderContinuousBrailleText\(/);
  assert.match(reader, /else\s*\{\s*ScrollViewReader \{ proxy in/);
  const braille = source('NativeReaderContinuousBrailleText.swift');
  assert.match(braille, /struct NativeReaderContinuousBrailleText: UIViewRepresentable/);
  assert.match(braille, /UITextView\(\)/);
  assert.match(braille, /view\.isScrollEnabled = true/);
  assert.match(braille, /view\.isEditable = false/);
  assert.doesNotMatch(braille, /ForEach\(|Button\("Siguiente bloque"\)/);
});

test('Braille preserves exact selection and restores position without starting speech', () => {
  const reader = source('NativeTifloLector.swift');
  const braille = source('NativeReaderContinuousBrailleText.swift');
  // A braille pan records its live offset, but does not synchronously
  // serialize the whole library after each change of selection.
  assert.match(reader, /onPositionChange: \{ offset in[\s\S]{0,800}scheduleManualPositionSave\(\)/);
  assert.doesNotMatch(reader, /onPositionChange: \{ offset in[\s\S]{0,800}library\.saveTextPosition\(document, offset: offset\)/);
  // The shared persistence path still writes the exact offset.
  assert.match(reader, /private func persistPosition\(\) \{[\s\S]{0,180}library\.saveTextPosition\(document, offset: readingOffset\)/);
  assert.match(braille, /let restoredRange = NSRange\(location: utf16Offset, length: 0\)/);
  assert.match(braille, /if movedSelection \{ view\.selectedRange = restoredRange \}/);
  assert.match(braille, /textViewDidChangeSelection/);
  assert.match(braille, /onPositionChange\(characterOffset\)/);
  assert.match(braille, /view\.dataDetectorTypes = \[\.link\]/);
});

test('Braille hides markdown heading markers while preserving text offsets', () => {
  const braille = source('NativeReaderContinuousBrailleText.swift');
  assert.match(braille, /NativeReaderHeadingDisplay\.mask\(in: text\)/);
  assert.match(braille, /NativeReaderTextOffsets\(context\.coordinator\.visibleText\)/);
  assert.match(braille, /context\.coordinator\.visibleText = NativeReaderHeadingDisplay\.mask\(in: text\)/);
});

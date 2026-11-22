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
  assert.match(reader, /saveTextPosition\(document, offset: offset\)/);
  assert.match(braille, /let restoredRange = NSRange\(location: utf16Offset, length: 0\)/);
  assert.match(braille, /if movedSelection \{ view\.selectedRange = restoredRange \}/);
  assert.match(braille, /textViewDidChangeSelection/);
  assert.match(braille, /onPositionChange\(characterOffset\)/);
  assert.match(braille, /view\.dataDetectorTypes = \[\.link\]/);
});

test('Braille hides markdown heading markers while preserving text offsets', () => {
  const braille = source('NativeReaderContinuousBrailleText.swift');
  assert.match(braille, /maskMarkdownHeadings\(_ original: String\) -> String/);
  assert.match(braille, /characters\[marker\] = " "/);
  assert.match(braille, /context\.coordinator\.visibleText = Self\.maskMarkdownHeadings\(text\)/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const component = readFileSync(new URL('../Sources/NativeReaderSelectableText.swift', import.meta.url), 'utf8');
const reader = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');

test('VoiceOver selection is captured in UTF-16 and not the entire document', () => {
  assert.match(component, /let range = textView.selectedRange/);
  assert.match(component, /range.length > 0/);
  assert.match(component, /contents.substring\(with: range\)/);
  assert.match(component, /parent.selectedText = exact/);
  assert.match(component, /guard view.text != accessibleText else \{ return \}/);
});

test('copying uses only the selected fragment and reports success accessibly', () => {
  assert.match(reader, /selectedText: \$selectedTextToCopy/);
  assert.match(reader, /Button\("Copiar texto seleccionado"\)/);
  assert.match(reader, /UIPasteboard.general.string = selectedTextToCopy/);
  assert.match(reader, /\.disabled\(selectedTextToCopy.isEmpty\)/);
  assert.match(reader, /UIAccessibility.post\(notification: \.announcement, argument: selectionCopyMessage\)/);
});

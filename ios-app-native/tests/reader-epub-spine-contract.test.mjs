import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const formats = readFileSync(new URL('../Sources/NativeReaderFormats.swift', import.meta.url), 'utf8');
const spine = readFileSync(new URL('../Sources/NativeEpubSpine.swift', import.meta.url), 'utf8');

test('EPUB reader follows OPF spine instead of sorting filenames', () => {
  assert.match(formats, /case "epub":\s*let pages = try NativeEpubSpine\.readingOrder/);
  assert.doesNotMatch(formats, /case "epub":\s*let pages = all\.filter/);
});

test('spine parser validates manifest IDREF and file presence', () => {
  assert.match(spine, /XMLParser\(data:/);
  assert.match(spine, /case "itemref":/);
  assert.match(spine, /case "item":/);
  assert.match(spine, /guard let item = reader\.manifest\[idref\]/);
  assert.match(spine, /availableFiles\.contains\(path\)/);
});

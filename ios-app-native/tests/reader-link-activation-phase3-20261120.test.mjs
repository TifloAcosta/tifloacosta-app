import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const reader = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');

test('link navigation action opens a visible URL when no structured link exists', () => {
  const action = reader.slice(reader.indexOf('private func activateCurrentLink()'), reader.indexOf('private func moveUnit('));
  assert.match(action, /latest\.textLinks\?\.first\(where:/);
  assert.match(action, /textLayout\.visibleURL\(at: readingOffset\)/);
  assert.match(action, /UIApplication\.shared\.open\(url\)/);
});

test('visible URL lookup accepts only a navigated URL start and validates web scheme and host', () => {
  const layout = reader.slice(reader.indexOf('struct NativeReaderTextLayout'), reader.indexOf('private func activateCurrentLink()'));
  assert.match(layout, /func visibleURL\(at offset: Int\) -> URL\?/);
  assert.match(layout, /linkStarts\.contains\(offset\)/);
  assert.match(layout, /\["https", "http"\]\.contains/);
  assert.match(layout, /url\.host != nil/);
});

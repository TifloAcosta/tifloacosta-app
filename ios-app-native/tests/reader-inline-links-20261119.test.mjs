import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');

test('a reader fragment exposes safe hyperlinks as attributed interactive links', () => {
  assert.match(source, /private func linkedReaderFragment\(at index: Int\) -> AttributedString/);
  assert.match(source, /linkedText\.link = match\.target/);
  assert.match(source, /Text\(linkedReaderFragment\(at: index\)\)/);
  assert.match(source, /\["https", "http"\]\.contains/);
});

test('structured document anchors and literal URLs both participate in direct activation', () => {
  assert.match(source, /latest\.textLinks \?\? \[\]/);
  assert.match(source, /textLayout\.fragmentStarts\[index\]/);
  assert.match(source, /link\.title/);
  assert.match(source, /NSRegularExpression\(pattern: #"https/);
});

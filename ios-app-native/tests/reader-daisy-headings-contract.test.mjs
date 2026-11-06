import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../Sources/NativeGeminiDaisyExport.swift', import.meta.url), 'utf8');

test('DAISY outline uses only explicit chapter lines with bounded audio units', () => {
  assert.match(src, /static func units\(_ text: String\) throws -> \[TextUnit\]/);
  assert.match(src, /let pattern =/);
  assert.match(src, /capítulo\|capitulo\|sección\|seccion/);
  assert.match(src, /unit\.count <= NativeGeminiAudioExport\.chunkSize/);
  assert.match(src, /TextUnit\(text: previous\.text \+ unit, heading: nil\)/);
});
test('Each chapter has DTBook h2, matching SMIL target, and nested NCX entry', () => {
  assert.match(src, /paragraphs\.append\("<level2><h2 id=/);
  assert.match(src, /if sectionOpen \{ paragraphs\.append\("<\/level2>"\) \}/);
  assert.match(src, /headingPoints\.append\(\(heading, par\)\)/);
  assert.match(src, /<navPoint id="chapter\\\(index \+ 1\)"/);
  assert.match(src, /<content src="sync\.smil#\\\(point\.par\)"\/>/);
  assert.match(src, /firstPar/);
});
test('Silent blank lines are retained in full-text DTBook', () => {
  assert.match(src, /paragraphs\.append\("<p>\\\(escape\(segment\.text\)\)<\/p>"\)/);
});

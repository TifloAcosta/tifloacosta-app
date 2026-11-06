import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = path => readFileSync(new URL('../Sources/' + path, import.meta.url), 'utf8');

test('HTML/EPUB import retains actual h1-h6 heading levels for DAISY', () => {
  const code = read('NativeDocuments.swift');
  assert.match(code, /for level in 1\.\.\.6/);
  assert.match(code, /String\(repeating: "#", count: level\)/);
  assert.match(code, /NativeDocumentText/);
});
test('DOCX import finds explicit paragraph heading styles', () => {
  const code = read('NativeReaderFormats.swift');
  assert.match(code, /path == "word\/document\.xml"/);
  assert.match(code, /w:pStyle/);
  assert.match(code, /Heading\|Titulo\|Título\|Encabezado/);
});

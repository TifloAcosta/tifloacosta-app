import test from 'node:test';
import assert from 'node:assert/strict';
import { annotationAt, loadAnnotations, saveAnnotations } from '../src/core/reading-annotations.mjs';
import { readFileSync } from 'node:fs';

test('notes and highlights remain isolated between documents', () => {
  const entries = new Map();
  const storage = {
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value)
  };
  assert.equal(saveAnnotations('book-1', [{ blockIndex: 2, unitIndex: 0, note: 'Importante', highlight: true }], storage), true);
  assert.deepEqual(loadAnnotations('book-2', storage), []);
  assert.equal(annotationAt(loadAnnotations('book-1', storage), { blockIndex: 2, unitIndex: 0 }).note, 'Importante');
  assert.equal(annotationAt(loadAnnotations('book-1', storage), { blockIndex: 1, unitIndex: 0 }), null);
});

test('malformed storage cannot crash the reader', () => {
  assert.deepEqual(loadAnnotations('broken', { getItem: () => '{invalid' }), []);
});

test('notes and highlights are rendered separately from the original text', () => {
  const source = readFileSync(new URL('../src/screens/reading-book.mjs', import.meta.url), 'utf8');
  assert.match(source, /reading-annotated-highlight/);
  assert.match(source, /reading-annotation-note/);
  assert.match(source, /onAnnotationsChanged/);
});

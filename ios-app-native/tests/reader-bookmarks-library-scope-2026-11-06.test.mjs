import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const reader = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');

test('Library has no global bookmarks section', () => {
  assert.doesNotMatch(reader, /Section\("Marcas"\)/);
});

test('Bookmarks remain accessible in each opened document', () => {
  assert.match(reader, /Button\("Marcas"\)/);
  assert.match(reader, /\.sheet\(isPresented: \$showSavedMarks\)/);
  assert.match(reader, /ForEach\(latest\.bookmarks/);
  assert.match(reader, /ForEach\(latest\.savedTextBookmarks/);
  assert.match(reader, /ForEach\(latest\.savedAudioBookmarks/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');

test('Every library document offers a Share accessibility action', () => {
  const row = source.slice(source.indexOf('ForEach(shownDocuments)'), source.indexOf('.accessibilityAction(named: Text("Información"))'));
  assert.match(row, /Button\("Compartir documento"\)/);
  assert.doesNotMatch(row, /if library\.originalURL\(for: document\) != nil/);
});

test('DAISY sharing requires its intact archive and never silently falls back to text', () => {
  const share = source.slice(source.indexOf('private func shareDocumentFromLibrary'), source.indexOf('    var body: some View {', source.indexOf('private func shareDocumentFromLibrary')));
  assert.match(share, /fileExtension\?\.lowercased\(\) == "daisy"/);
  assert.match(share, /shareableOriginalURL\(for: document\)/);
  assert.match(share, /sharingURLs\(for: \[document\]\)/);
});

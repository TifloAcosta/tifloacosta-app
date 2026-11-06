import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../Sources/NativePhononRuntime.swift', import.meta.url), 'utf8');

test('Phonon reloads the installed model after switching language', () => {
  assert.match(source, /private var loadedLanguage: String\?/);
  assert.match(source, /loadedLanguage == language\.rawValue/);
  assert.match(source, /model = nil\s+loadedLanguage = nil/);
  assert.match(source, /loadedLanguage = language\.rawValue/);
});

test('Phonon preview uses selected language instead of a fixed English sample', () => {
  assert.match(source, /static var previewText: String/);
  for (const language of ['es', 'fr', 'de', 'pt']) {
    assert.ok(source.includes('case "' + language + '"'));
  }
  assert.match(source, /text: NativePhononRuntime\.previewText/);
});

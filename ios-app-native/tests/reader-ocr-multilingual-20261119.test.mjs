import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = name => readFileSync(new URL(`../Sources/${name}`, import.meta.url), 'utf8');

test('OCR offers all six app languages without changing legacy selection indices', () => {
  const screen = source('NativeReaderAdvanced.swift');
  for (const label of ['Detectar automáticamente', 'Español', 'Inglés', 'Español e inglés',
    'Portugués', 'Francés', 'Italiano', 'Alemán']) {
    assert.ok(screen.includes(`"${label}"`), `Missing OCR choice ${label}`);
  }
  const decoder = source('NativeReaderFormats.swift');
  for (const [index, locale] of [[4, 'pt-PT'], [5, 'fr-FR'], [6, 'it-IT'], [7, 'de-DE']]) {
    assert.match(decoder, new RegExp(`case ${index}:.*"${locale}"`));
  }
  assert.match(decoder, /default: selected = \[\]/);
});

test('OCR requests a supported language only, preserving automatic fallback', () => {
  const decoder = source('NativeReaderFormats.swift');
  assert.match(decoder, /supportedRecognitionLanguages\(\)/);
  assert.match(decoder, /request\.automaticallyDetectsLanguage = true/);
});

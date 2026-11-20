import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const settings = readFileSync(new URL('../Sources/NativeReaderAdvanced.swift', import.meta.url), 'utf8');
const formats = readFileSync(new URL('../Sources/NativeReaderFormats.swift', import.meta.url), 'utf8');

test('OCR settings show the installed Vision recognition languages for the selected accuracy', () => {
  assert.match(settings, /import Vision/);
  assert.match(settings, /VNRecognizeTextRequest\(\)/);
  assert.match(settings, /supportedRecognitionLanguages\(\)/);
  assert.match(settings, /\.onChange\(of: accuracyIndex\)/);
  assert.match(settings, /Idiomas admitidos por el dispositivo/);
});

test('OCR engine still falls back safely for languages missing from Vision', () => {
  assert.match(formats, /selected\.allSatisfy\(\{ supported\.contains\(\$0\) \}\)/);
  assert.match(formats, /request\.automaticallyDetectsLanguage = true/);
});

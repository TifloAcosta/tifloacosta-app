import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../Sources/NativeOnDemandTranslation.swift', import.meta.url), 'utf8');

test('La traducción ofrece salida accesible antes de texto y al terminarlo', () => {
  assert.match(source, /@Environment\(\\\.dismiss\) private var dismiss/);
  assert.equal((source.match(/Button\("Volver a la pantalla anterior"\) \{ dismiss\(\) \}/g) ?? []).length, 2);
  assert.match(source, /ToolbarItem\(placement: \.topBarLeading\)/);
  assert.match(source, /Button\("Cerrar traducción"\) \{ dismiss\(\) \}/);
  assert.match(source, /\.accessibilityAction\(\.escape\) \{ dismiss\(\) \}/);
});

test('El botón inferior se encuentra después del texto traducido y conserva el original', () => {
  const translated = source.indexOf('Text(showingOriginal ? originalText : translatedParagraphs.joined');
  const lowerReturn = source.lastIndexOf('Button("Volver a la pantalla anterior")');
  assert.ok(translated >= 0 && lowerReturn > translated);
  assert.match(source, /Text\("El documento original se conserva/);
  assert.match(source, /Text\(showingOriginal \? originalText : translatedParagraphs/);
});

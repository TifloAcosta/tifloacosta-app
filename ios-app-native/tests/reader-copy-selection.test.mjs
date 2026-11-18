import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');
const actions = source.slice(source.indexOf('private var documentActions:'), source.indexOf('private var bookmarksSheetContent:'));
const body = source.slice(source.indexOf('struct NativeReadingScreen: View'));

test('copiar párrafo actual es una acción directa y accesible', () => {
  assert.match(actions, /Button\("Copiar párrafo actual"\) \{ copyCurrentParagraph\(\) \}/);
  assert.match(body, /accessibilityAction\(named: Text\("Copiar párrafo actual"\)\)/);
  assert.match(body, /private func currentParagraphText\(\) -> String\?/);
  assert.match(body, /UIPasteboard\.general\.string = paragraph/);
});

test('la selección se hace sobre texto continuo, seleccionable y no editable', () => {
  assert.match(actions, /Button\("Seleccionar y copiar texto"\)/);
  assert.match(body, /\.sheet\(isPresented: \$showTextSelection/);
  assert.match(body, /NativeBrailleContinuousText\(/);
  assert.match(source, /view\.isEditable = false/);
  assert.match(source, /view\.isSelectable = true/);
  assert.match(body, /Button\("Volver al libro"\)/);
});

test('el flujo de copiar no salta de posición ni reinicia la voz', () => {
  const copy = body.slice(body.indexOf('private func copyCurrentParagraph()'), body.indexOf('private func exportText()'));
  assert.doesNotMatch(copy, /jump\(|speech\.stop\(|startTextSpeech\(|play\(/);
});

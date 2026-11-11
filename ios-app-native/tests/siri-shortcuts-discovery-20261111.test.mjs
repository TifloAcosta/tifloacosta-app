import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = f => readFileSync(new URL('../Sources/' + f, import.meta.url), 'utf8');
const app = read('TifloAcostaNativeApp.swift');
const settings = read('NativeUpdatesSettings.swift');
const shortcuts = read('NativeAppShortcuts.swift');

test('La aplicación actualiza sus App Shortcuts en el arranque', () => {
  assert.match(app, /NativeTifloAppShortcuts\.updateAppShortcutParameters\(\)/);
});
test('Configuración enlaza a los atajos de la aplicación y enseña frases completas', () => {
  assert.match(settings, /ShortcutsLink\(\)/);
  assert.match(settings, /Abre Actualidad en TifloAcosta/);
  assert.match(settings, /Abre TifloLector en TifloAcosta/);
  assert.match(settings, /Continúa el libro en TifloAcosta/);
  assert.match(settings, /Abre vídeos en TifloAcosta/);
});
test('Las cuatro frases coinciden con las declaraciones del proveedor', () => {
  for (const phrase of ['Abre Actualidad en ', 'Abre TifloLector en ', 'Continúa el libro en ', 'Abre vídeos en ']) {
    assert.ok(shortcuts.includes(phrase), phrase);
  }
});

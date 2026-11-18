import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');

test('Un documento permite abrir un texto seleccionable y copiar solo un fragmento', () => {
  const reader = read('NativeTifloLector.swift');
  const selectable = read('NativeReaderSelectableText.swift');
  assert.match(reader, /Button\("Seleccionar y copiar texto"\)/);
  assert.match(reader, /\.accessibilityAction\(named: Text\("Seleccionar y copiar texto"\)\)/);
  assert.match(reader, /\.sheet\(isPresented: \$showTextSelection\)/);
  assert.match(selectable, /UIViewRepresentable/);
  assert.match(selectable, /view\.isEditable = false/);
  assert.match(selectable, /view\.isSelectable = true/);
  assert.match(selectable, /view\.selectedRange = NSRange\(location: utf16Offset, length: 0\)/);
});

test('Buscar en el documento está visible inmediatamente después de Añadir marca', () => {
  const reader = read('NativeTifloLector.swift');
  const controls = reader.slice(reader.indexOf('private var quickControls:'), reader.indexOf('private var readerFooterControls:'));
  assert.match(controls, /Button\("Añadir marca"\)/);
  assert.match(controls, /Button\("Buscar en el documento"\)/);
  assert.ok(controls.indexOf('Button("Añadir marca")') < controls.indexOf('Button("Buscar en el documento")'));
});

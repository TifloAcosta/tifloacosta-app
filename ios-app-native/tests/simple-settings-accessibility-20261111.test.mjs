import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const settings = source('NativeUpdatesSettings.swift');
const controls = source('NativeScreens.swift');

test('Idioma es un único selector directo sin encabezado duplicado ni párrafo', () => {
  assert.match(settings, /Section \{\s*NativeAdjustableChoice\(\s*title: "Idioma",\s*choices: NativeAppLanguage\.names,/);
  assert.doesNotMatch(settings, /Section\("Idioma"\)/);
  assert.doesNotMatch(settings, /Text\("El idioma elegido se conserva\./);
});

test('Cada ajustable anuncia etiqueta y valor a VoiceOver en un único elemento', () => {
  const start = controls.indexOf('struct NativeAdjustableChoice: View');
  assert.ok(start > -1);
  const end = controls.indexOf('struct NativeResourcesScreen: View', start);
  const adjustable = controls.slice(start, end);
  assert.match(adjustable, /\.accessibilityElement\(children: \.ignore\)/);
  assert.match(adjustable, /\.accessibilityLabel\(Text\(LocalizedStringKey\(title\)\)\)/);
  assert.match(adjustable, /\.accessibilityValue\(Text\(LocalizedStringKey\(currentValue\)\)\)/);
  assert.match(adjustable, /\.accessibilityAdjustableAction/);
  assert.doesNotMatch(adjustable, /Desliza arriba o abajo para cambiar/);
});

test('Presentación y VoiceOver sin títulos repetidos antes de sus controles', () => {
  assert.match(settings, /title: "Tamaño del texto"/);
  assert.match(settings, /title: "Detalle de VoiceOver"/);
  assert.doesNotMatch(settings, /Text\("Color y contraste"\)|Text\("Legibilidad"\)|Section\("Detalle de VoiceOver"\)/);
});

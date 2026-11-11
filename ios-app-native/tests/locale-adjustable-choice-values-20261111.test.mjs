import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = file => readFileSync(new URL('../Sources/' + file, import.meta.url), 'utf8');
const files = [
  'NativeUpdatesSettings.swift', 'NativeReaderSettings.swift',
  'NativeReaderAdvanced.swift', 'NativeTifloLector.swift',
  'NativeScreens.swift', 'NativeNews.swift',
  'NativeMedia.swift', 'NativeMediaInline.swift',
  'NativeReaderExternalVoiceCredentials.swift'
];

test('Cada valor literal de los selectores tiene traducción en los cinco idiomas', () => {
  const values = new Set();
  for (const file of files) {
    const swift = source(file);
    const blocks = [...swift.matchAll(/choices:\s*\[([\s\S]*?)\]/g)];
    for (const block of blocks) {
      if (block[1].length > 600) continue;
      for (const item of block[1].matchAll(/"([^"]+)"/g)) values.add(item[1]);
    }
  }
  assert.ok(values.has('Intermedia: título, porcentaje y formato'));
  assert.ok(values.has('Breve: título y porcentaje leído'));
  assert.ok(values.has('Completa: título, porcentaje, formato y carpeta'));
  for (const lang of ['en', 'pt', 'fr', 'it', 'de']) {
    const catalog = source(lang + '.lproj/Localizable.strings');
    const keys = new Set([...catalog.matchAll(/^"((?:[^"\\]|\\.)+)"\s*=/gm)].map(x => x[1]));
    assert.deepEqual([...values].filter(value => !keys.has(value)), [], lang + ': valores no localizados');
  }
});

test('VoiceOver anuncia valor del selector usando la localización elegida', () => {
  const controls = source('NativeScreens.swift');
  const start = controls.indexOf('struct NativeAdjustableChoice: View');
  const end = controls.indexOf('struct NativeResourcesScreen: View', start);
  const control = controls.slice(start, end);
  assert.match(control, /Text\(LocalizedStringKey\(currentValue\)\)/);
  assert.match(control, /\.accessibilityValue\(Text\(LocalizedStringKey\(currentValue\)\)\)/);
  assert.match(control, /\.accessibilityAdjustableAction/);
});

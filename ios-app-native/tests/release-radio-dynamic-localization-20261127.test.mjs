import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
test('Radio dynamic category titles and filter options resolve in all five translated catalogs', () => {
  const radio = read('NativeRadioBrowser.swift');
  const categories = [...radio.matchAll(/case \.(?:countries|languages|genres): return "([^"]+)"/g)].map(m => m[1]);
  const options = [...radio.matchAll(/\.init\(id: "[^"]+", title: "([^"]+)"\)/g)].map(m => m[1]);
  assert.deepEqual(categories, ['Países', 'Idiomas', 'Estilos']);
  assert.ok(options.length >= 27);
  assert.ok(radio.includes('MusicLocalized.message(category.title)'));
  assert.ok(radio.includes('MusicLocalized.message(option.title)'));
  for (const language of ['en', 'fr', 'de', 'it', 'pt']) {
    const catalog = read(language + '.lproj/Localizable.strings');
    for (const key of [...categories, ...options]) {
      assert.ok(catalog.includes('"' + key + '" ='), language + ': ' + key);
    }
  }
});

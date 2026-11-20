import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = file => readFileSync(new URL(`../Sources/${file}`, import.meta.url), 'utf8');
const music = source('NativeMyMusic.swift');
const keys = [
  'No se pudo importar la música: %@',
  'No se pudo acceder al contenido de la carpeta seleccionada',
  'No se encontraron archivos musicales compatibles en esa carpeta',
];

test('music import failures use translated strings, including the underlying error', () => {
  for (const key of keys) assert.match(music, new RegExp('MusicLocalized\\.format\\(' + JSON.stringify(key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('all five translated app languages include every music import failure', () => {
  for (const lang of ['en', 'pt', 'fr', 'it', 'de']) {
    const strings = readFileSync(new URL(`../Sources/${lang}.lproj/Localizable.strings`, import.meta.url), 'utf8');
    for (const key of keys) assert.ok(strings.includes(`"${key}" = `), `${lang} lacks ${key}`);
  }
});

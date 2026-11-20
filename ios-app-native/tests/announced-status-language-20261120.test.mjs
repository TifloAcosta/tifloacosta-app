import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (name) => readFileSync(new URL(`../Sources/${name}`, import.meta.url), 'utf8');

test('News and favorites present translated status and errors in VoiceOver', () => {
  const news = source('NativeNews.swift');
  assert.equal((news.match(/status = MusicLocalized\.message\(message\)/g) ?? []).length, 2);
  assert.doesNotMatch(news, /announce\("No se pudo guardar[^"\n]*\\\(/);
  const favorites = source('NativeFavorites.swift');
  assert.match(favorites, /status = MusicLocalized\.format\("Eliminado de Favoritos: %@", entry\.item\.title\)/);
});

test('User-facing news status messages are supplied in every supported language', () => {
  const keys = [
    'Esta noticia no contiene texto para guardar.',
    'Esta noticia no tiene texto para guardar.',
    'La noticia ya está guardada en TifloLector.',
    'Noticia guardada en TifloLector.',
    'No se pudo guardar la noticia: %@',
    'No se pudo guardar: %@',
    'Esta noticia no tiene un enlace original para compartir.',
    'La fuente original no está disponible.',
    'Noticia guardada para leer después.',
    'Noticia retirada de Leer después.',
    'Añadido a Favoritos', 'Eliminado de Favoritos',
    'No hay enlace original para compartir.',
    'Eliminado de Favoritos: %@',
  ];
  for (const code of ['en','pt','fr','it','de']) {
    const catalog = source(`${code}.lproj/Localizable.strings`);
    for (const key of keys) assert.ok(catalog.includes(`"${key}" = `), `${code}: ${key}`);
  }
});

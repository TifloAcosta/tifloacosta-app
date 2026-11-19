import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const base = new URL('../Sources/', import.meta.url);
const labels = [
  'Busca y escucha música de Jamendo sin iniciar sesión. Cada obra conserva las condiciones de su autor.',
  'Buscar en Jamendo', 'Consultando Jamendo', 'Pausar Jamendo',
  'Catálogo musical gratuito. No necesitas crear una cuenta para buscar canciones.',
  'Buscar en Audius', 'Consultando Audius', 'Pausar Audius',
  'Conectar Apple Music', 'Buscar en Apple Music',
  'Buscar canciones, álbumes y artistas', 'Buscando en Apple Music',
  'Pausar Apple Music',
  'Listas de reproducción',
  'Las canciones de los catálogos en línea se reproducen individualmente desde esta lista.',
  'Apple Music: reproducción disponible',
  'Apple Music: reproducción no disponible con esta cuenta',
  'Opcional. No necesitas una cuenta de Apple Music para escuchar tus archivos personales.',
  'Reproducir %@, %@, Jamendo',
  'Reproducir %@, %@, Audius',
  'Reproducir %@, %@, Apple Music',
  'Añadir %@ a una lista',
  'Añadir a %@',
  'Álbum: %@, %@, Apple Music',
  'Artista: %@, Apple Music',
  'Reproducir %@, archivo personal',
  '%@, archivo no disponible',
  'Reproducir archivos locales de %@',
  'Eliminar lista %@',
  '%@, %d canciones',
];

test('the three music services have accessible labels in all five non-Spanish supported languages', () => {
  for (const language of ['en', 'pt', 'fr', 'it', 'de']) {
    const content = readFileSync(new URL(`${language}.lproj/Localizable.strings`, base), 'utf8');
    for (const label of labels) {
      assert.ok(content.includes(`"${label}" = `), `${language}: untranslated ${label}`);
    }
  }
});

test('dynamic catalog and playlist controls use localized templates', () => {
  const screen = readFileSync(new URL('NativeMyMusic.swift', base), 'utf8');
  for (const phrase of ['Reproducir %@, %@, Jamendo', 'Reproducir %@, %@, Audius',
    'Reproducir %@, %@, Apple Music', 'Añadir %@ a una lista', 'Añadir a %@',
    'Reproducir %@, archivo personal', '%@, archivo no disponible',
    'Reproducir archivos locales de %@', 'Eliminar lista %@']) {
    assert.ok(screen.includes(`MusicLocalized.format("${phrase}"`), `unlocalized control: ${phrase}`);
  }
});

test('Apple Music, Audius and Jamendo do not emit raw Spanish status messages', () => {
  for (const filename of ['NativeAppleMusicService.swift', 'NativeAudiusService.swift', 'NativeJamendoService.swift']) {
    const service = readFileSync(new URL(filename, base), 'utf8');
    assert.doesNotMatch(service, /message\s*=\s*"/, `${filename}: untranslated user notification`);
  }
});

test('every music provider notification is translated in every supported language', () => {
  const keys = new Set();
  for (const filename of ['NativeAppleMusicService.swift', 'NativeAudiusService.swift', 'NativeJamendoService.swift']) {
    const service = readFileSync(new URL(filename, base), 'utf8');
    for (const match of service.matchAll(/MusicLocalized\.format\("([^"\\]+)"/g)) keys.add(match[1]);
  }
  for (const language of ['en', 'pt', 'fr', 'it', 'de']) {
    const content = readFileSync(new URL(`${language}.lproj/Localizable.strings`, base), 'utf8');
    for (const key of keys) assert.ok(content.includes(`"${key}" = `), `${language}: missing status ${key}`);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../Sources');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('Dynamic VoiceOver labels resolve the language chosen in TifloAcosta', () => {
  const helper = read('MusicLocalized.swift');
  assert.match(helper, /NativeAppLanguage\.message\(key, languageCode:/);
  assert.match(helper, /NativeAppLanguage\.storageKey/);
  assert.doesNotMatch(helper, /NSLocalizedString\(/);
  const music = read('NativeMyMusic.swift');
  assert.match(music, /MusicLocalized\.format\("%@, artista %@, álbum %@, disponible sin conexión"/);
  assert.match(music, /\.accessibilityLabel\(detailedVoiceOver \?/);
  assert.match(music, /\.accessibilityActions \{/);
  assert.match(music, /MusicLocalized\.format\("%@, carpeta, %d canciones, guardadas en el iPhone"/);
});

test('Cloud announcements and import labels use localized format templates', () => {
  for (const file of ['NativeCloudFolderBrowserScreen.swift', 'NativeCloudGooglePickerScreen.swift']) {
    const source = read(file);
    assert.doesNotMatch(source, /\.accessibilityLabel\("Importar \\\(/);
  }
  const browser = read('NativeCloudFolderBrowserScreen.swift');
  assert.match(browser, /MusicLocalized\.format\("%d elementos"/);
  assert.match(browser, /MusicLocalized\.format\("Importado %@"/);
});

test('All six app languages can express dynamic accessibility templates', () => {
  const required = [
    'Reproducir %@, artista %@, álbum %@, disponible sin conexión',
    'Reproducir %@',
    '%@, carpeta, %d canciones, guardadas en el iPhone',
    '%@, %d canciones',
    'Importar %@ desde %@',
    'Importar %@ desde Google Drive',
    '%d elementos',
    'Importado %@',
  ];
  for (const lang of ['en', 'pt', 'fr', 'it', 'de']) {
    const catalog = read(`${lang}.lproj/Localizable.strings`);
    for (const key of required) assert.ok(catalog.includes(`"${key}" = `), `${lang}: ${key}`);
  }
});

test('Short menus and nonduplicated screen-reader announcements remain navigable', () => {
  const music = read('NativeMyMusic.swift');
  assert.doesNotMatch(music, /NavigationLink\("Ajustes de Mi Música"\)/);
  assert.doesNotMatch(music, /Text\("Destino de copias"\)/);
  const search = read('NativeSearch.swift');
  assert.doesNotMatch(search, /La búsqueda en todo YouTube se incorporará/);
  const media = read('NativeMedia.swift');
  assert.doesNotMatch(media, /Selecciona Podcasts o Canales de YouTube para consultar/);
});

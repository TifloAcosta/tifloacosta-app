import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const swift = path => readFileSync(new URL('../Sources/' + path, import.meta.url), 'utf8');

const model = swift('NativeAppLanguage.swift');
const app = swift('TifloAcostaNativeApp.swift');
const settings = swift('NativeUpdatesSettings.swift');
const news = swift('NativeNews.swift');
const resources = swift('NativeScreens.swift');

test('iOS mantiene índices históricos y detecta primer idioma compatible sin sobrescribir preferencias', () => {
  assert.match(model, /\["es", "en", "pt", "fr", "it", "de"\]/);
  assert.match(model, /guard defaults\.object\(forKey: storageKey\) == nil else \{ return \}/);
  assert.match(model, /for language in languages/);
  assert.match(model, /return 0/);
  assert.match(app, /NativeAppLanguage\.initializeIfMissing\(\)/);
  assert.match(app, /NativeAppLanguage\.code\(for: languageIndex\)/);
  assert.match(settings, /choices: NativeAppLanguage\.names/);
});

test('iOS traduce noticias al idioma elegido y no oculta los contenidos externos por idioma de interfaz', () => {
  assert.equal((news.match(/targetLanguage: NativeAppLanguage\.code\(for: languageIndex\)/g) ?? []).length, 2);
  assert.match(news, /default: return languageIndex > 1 \|\|/);
  assert.match(resources, /default: return languageIndex > 1 \|\|/);
});

test('Paquetes de interfaz iOS en cuatro idiomas añadidos con etiquetas esenciales únicas', () => {
  for (const language of ['pt','fr','it','de']) {
    const catalog = swift(language + '.lproj/Localizable.strings');
    const keys = Array.from(catalog.matchAll(/^"([^"]+)" = ".*";$/gm), m => m[1]);
    assert.ok(keys.length >= 80, language + ' only contains ' + keys.length + ' keys');
    assert.equal(new Set(keys).size, keys.length, language + ' duplicated localizable key');
    for (const required of ['Actualidad','Recursos','Configuración','Idioma de la aplicación','Texto traducido','Volver a la pantalla anterior','TifloLector']) {
      assert.ok(keys.includes(required), language + ': missing ' + required);
    }
  }
});

test('Los avisos de traducción y sus errores usan la lengua elegida de TifloAcosta', () => {
  const translator = swift('NativeOnDemandTranslation.swift');
  assert.match(model, /static func message\(_ key: String, languageCode: String\)/);
  assert.match(translator, /NativeAppLanguage\.message\(text, languageCode: targetLanguage\)/);
  assert.match(translator, /String\(format: format, locale: Locale\(identifier: targetLanguage\), error\.localizedDescription\)/);
  for (const lang of ['en', 'pt', 'fr', 'it', 'de']) {
    const catalog = swift(lang + '.lproj/Localizable.strings');
    for (const phrase of ['Traducción terminada. Disponible en pantalla.', 'No se pudo completar la traducción.']) {
      assert.ok(catalog.includes('"' + phrase + '" = '), lang + ': falta mensaje ' + phrase);
    }
  }
});

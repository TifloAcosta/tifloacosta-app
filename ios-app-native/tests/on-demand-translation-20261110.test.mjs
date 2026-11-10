import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const translation = source('NativeOnDemandTranslation.swift');
const news = source('NativeNews.swift');
const documents = source('NativeDocuments.swift');

test('La traducción requiere acción expresa y conserva el original', () => {
  assert.match(translation, /import Translation/);
  assert.match(translation, /@State private var configuration: TranslationSession.Configuration\?/);
  assert.match(translation, /Button\(finished \? "Volver a traducir" : "Traducir ahora"\)/);
  assert.match(translation, /\.translationTask\(configuration\)/);
  assert.match(translation, /session\.translate\(segment\)/);
  assert.match(translation, /showingOriginal \? originalText : translatedParagraphs\.joined/);
  assert.match(translation, /configuration\?\.invalidate\(\)/);
});

test('Se traduce por fragmentos sin truncar deliberadamente documentos extensos', () => {
  assert.match(translation, /static func segments\(_ text: String, limit: Int = 1400\)/);
  assert.match(translation, /while !remaining\.isEmpty/);
  assert.match(translation, /String\(remaining\.prefix\(limit\)\)/);
  assert.match(translation, /remaining\.removeFirst\(piece\.count\)/);
  assert.match(translation, /ProgressView\("Traduciendo fragmento/);
});

test('Actualidad y Recursos usan idioma configurado y no traducen en automático', () => {
  assert.match(news, /NavigationLink\("Traducir noticia al idioma de la aplicación"\)/);
  assert.match(documents, /NavigationLink\("Traducir recurso al idioma de la aplicación"\)/);
  assert.match(news, /targetLanguage: languageIndex == 1 \? "en" : "es"/);
  assert.match(documents, /targetLanguage: languageIndex == 1 \? "en" : "es"/);
  assert.match(news, /originalText: paragraphs\.joined/);
  assert.match(documents, /originalText: documentText/);
});

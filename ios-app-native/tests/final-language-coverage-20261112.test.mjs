import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../Sources');
const languages = ['en', 'pt', 'fr', 'it', 'de'];
const paths = fs.readdirSync(sourceRoot).filter(name => name.endsWith('.swift'))
  .map(name => path.join(sourceRoot, name));
const dictionaries = new Map();

function readStrings(code) {
  const file = path.join(sourceRoot, code + '.lproj', 'Localizable.strings');
  const raw = fs.readFileSync(file, 'utf8');
  const map = new Map();
  const pattern = /^"((?:\\.|[^"])*)"\s*=\s*"((?:\\.|[^"])*)";\s*$/gm;
  let match;
  while ((match = pattern.exec(raw)) !== null) {
    assert.ok(!map.has(match[1]), code + ': duplicate key ' + match[1]);
    map.set(match[1], match[2]);
  }
  assert.ok(map.size > 500, code + ': unexpectedly incomplete localization');
  return map;
}
for (const code of languages) dictionaries.set(code, readStrings(code));

test('Every enabled translation catalog contains exactly the same keys', () => {
  const master = new Set(dictionaries.get('en').keys());
  for (const lang of languages.slice(1)) {
    const current = dictionaries.get(lang);
    assert.deepEqual(
      [...master].filter(key => !current.has(key)),
      [],
      lang + ': missing English catalog entries'
    );
    assert.deepEqual(
      [...current.keys()].filter(key => !master.has(key)),
      [],
      lang + ': missing English catalog counterparts'
    );
  }
});

test('VoiceOver detail control and full-document translation are localized in all five translations', () => {
  const required = [
    'Detalle de VoiceOver', 'Traducir', 'Traducir documento',
    'Idioma de destino', 'Cancelar traducción',
    'Progreso de la traducción', 'Traducción guardada en la biblioteca.',
    'La traducción de documentos requiere iOS 18 o posterior.',
  ];
  for (const [lang, dictionary] of dictionaries) {
    for (const key of required) {
      assert.ok(dictionary.has(key) && dictionary.get(key).length > 0, lang + ': ' + key);
    }
  }
});

test('Fixed SwiftUI labels, actions and hints never fall back to Spanish in another interface language', () => {
  const pattern = /\b(?:Text|Button|Label|Section|Toggle|Picker|NavigationLink|DisclosureGroup|LabeledContent|TextField|accessibilityLabel|accessibilityHint|navigationTitle|alert|confirmationDialog)\(\s*"([^"\n]+)"/g;
  const properNames = new Set(['ISBN', 'iOS', 'TifloAcosta', 'Google', 'YouTube']);
  const found = new Map();
  for (const file of paths) {
    const content = fs.readFileSync(file, 'utf8');
    for (const match of content.matchAll(pattern)) {
      const key = match[1];
      if (key.includes('\\(') || properNames.has(key) || /^\d+$/.test(key)) continue;
      if (!found.has(key)) found.set(key, path.basename(file));
    }
  }
  for (const [lang, dictionary] of dictionaries) {
    const missing = [...found].filter(([key]) => !dictionary.has(key));
    assert.deepEqual(missing, [], lang + ': missing native UI strings');
  }
});

test('Translation action is attached to a document title and saves a separate text record', () => {
  const library = fs.readFileSync(path.join(sourceRoot, 'NativeTifloLector.swift'), 'utf8');
  const translator = fs.readFileSync(path.join(sourceRoot, 'NativeReaderDocumentTranslation.swift'), 'utf8');
  assert.match(library, /\.accessibilityAction\(named:\s*Text\("Traducir"\)\)/);
  assert.match(library, /NativeReaderDocumentTranslationScreen\(document:\s*doc\)/);
  assert.match(library, /try library\.importSharedText\(text,\s*title:\s*title\)/);
  assert.match(translator, /\.translationTask\(configuration\)/);
  assert.match(translator, /try await session\.translate\(portion\)/);
  assert.match(translator, /NativeAppLanguage\.code\(for:\s*appLanguageIndex\)/);
});


test('App Store binary declares the same six languages available in the app settings', () => {
  const plist = fs.readFileSync(path.join(sourceRoot, 'Info.plist'), 'utf8');
  const block = plist.match(/<key>CFBundleLocalizations<\/key>\s*<array>([\s\S]*?)<\/array>/);
  assert.ok(block, 'Missing CFBundleLocalizations in Info.plist');
  const declared = [...block[1].matchAll(/<string>([^<]+)<\/string>/g)].map(m => m[1]);
  assert.deepEqual(declared, ['es', 'en', 'pt', 'fr', 'it', 'de']);
  const languageSource = fs.readFileSync(path.join(sourceRoot, 'NativeAppLanguage.swift'), 'utf8');
  assert.match(languageSource, /static let codes = \["es", "en", "pt", "fr", "it", "de"\]/);
  for (const lang of ['en', 'pt', 'fr', 'it', 'de']) {
    assert.ok(fs.existsSync(path.join(sourceRoot, lang + '.lproj', 'Localizable.strings')));
  }
});

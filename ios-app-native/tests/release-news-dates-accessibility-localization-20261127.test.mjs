import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = new URL('../Sources/', import.meta.url);
const expected = {
  "NativeNews.swift": [
    "return value.isEmpty ? MusicLocalized.message(\"Fuente no indicada\") : value",
    "formatter.locale = Locale(identifier: NativeAppLanguage.code(for: UserDefaults.standard.integer(forKey: NativeAppLanguage.storageKey)))",
    "MusicLocalized.format(\"Medio: %@\", source(item))",
    "publication(item.publishedAt).map { MusicLocalized.format(\"Publicado: %@\", $0) }",
    "var labels = [item.title, MusicLocalized.format(\"Medio: %@\", source(item))]",
    "labels.append(MusicLocalized.format(\"Publicado: %@\", date))",
    "categories.map { MusicLocalized.message(NativeNewsMetadata.category($0)) }.joined(separator: \", \")"
  ],
  "NativeTifloLector.swift": [
    "value: library.latest(document).folderName ?? MusicLocalized.message(\"Sin carpeta\")",
    "value: latest.folderName ?? MusicLocalized.message(\"Sin carpeta\")",
    "document.importedAt.formatted(.dateTime.year().month(.abbreviated).day().hour().minute().locale(Locale(identifier: NativeAppLanguage.code(for: UserDefaults.standard.integer(forKey: NativeAppLanguage.storageKey)))))",
    "latest.importedAt.formatted(.dateTime.year().month(.abbreviated).day().hour().minute().locale(Locale(identifier: NativeAppLanguage.code(for: UserDefaults.standard.integer(forKey: NativeAppLanguage.storageKey)))))"
  ],
  "NativeScreens.swift": [
    "lastUpdated.formatted(.dateTime.year().month(.abbreviated).day().hour().minute().locale(Locale(identifier: NativeAppLanguage.code(for: UserDefaults.standard.integer(forKey: NativeAppLanguage.storageKey)))))"
  ]
};
const keys = ["Fuente no indicada","Medio: %@","Publicado: %@","Sin carpeta"];
test('news metadata, VoiceOver summaries and visible dates respect the application language', () => {
  for (const [file, snippets] of Object.entries(expected)) {
    const source = readFileSync(new URL(file, root), 'utf8');
    for (const snippet of snippets) assert.ok(source.includes(snippet), file + ': ' + snippet);
  }
  for (const language of ['en','fr','de','it','pt']) {
    const raw = readFileSync(new URL(language + '.lproj/Localizable.strings', root), 'utf8');
    for (const key of keys) assert.ok(raw.includes(JSON.stringify(key) + ' = '), language + ': ' + key);
  }
});

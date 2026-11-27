import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = new URL('../Sources/', import.meta.url);
const expected = {
  "NativeRadioBrowser.swift": [
    "Text(radio.stationName.isEmpty ? MusicLocalized.message(\"Ninguna emisora\") : radio.stationName)",
    "Button(MusicLocalized.message(radio.isPlaying ? \"Pausar radio\" : \"Reanudar radio\"))"
  ],
  "NativeAppleMusic.swift": [
    "Button(MusicLocalized.message(music.authorized ? \"Comprobar acceso a Apple Music\" : \"Autorizar Apple Music\"))",
    "Button(MusicLocalized.message(music.isPlaying ? \"Pausar\" : \"Reanudar\"))"
  ],
  "NativeAudiusMusic.swift": [
    "Button(MusicLocalized.message(player.isPlaying ? \"Pausar\" : \"Reanudar\"))"
  ],
  "NativeJamendoMusic.swift": [
    "Button(MusicLocalized.message(player.isPlaying ? \"Pausar Jamendo\" : \"Reanudar Jamendo\"))"
  ],
  "NativeTifloLector.swift": [
    ".navigationTitle(folder ?? MusicLocalized.message(\"Sin carpeta\"))",
    "Text(MusicLocalized.message(document.isFavorite == true ? \"Quitar de favoritos\" : \"Añadir a favoritos\"))",
    "Button(MusicLocalized.message(isPlaying ? \"Pausar\" : \"Reproducir\"))",
    "Button(MusicLocalized.message(audioExportBusy ? \"Generando…\" : \"Convertir y guardar\"))",
    "Button(MusicLocalized.message(speech.isPlaying ? \"Pausar\" : \"Reproducir\"))",
    "Button(MusicLocalized.message(latest.isFavorite == true ? \"Quitar de favoritos\" : \"Añadir a favoritos\"))"
  ]
};
const keys = ["Ninguna emisora","Pausar radio","Reanudar radio","Comprobar acceso a Apple Music","Autorizar Apple Music","Pausar","Reanudar","Pausar Jamendo","Reanudar Jamendo","Sin carpeta","Quitar de favoritos","Añadir a favoritos","Reproducir","Generando…","Convertir y guardar"];
test('conditional reader, radio and music controls explicitly use the app language', () => {
  for (const [file, snippets] of Object.entries(expected)) {
    const source = readFileSync(new URL(file, root), 'utf8');
    for (const snippet of snippets) assert.ok(source.includes(snippet), file + ': ' + snippet);
  }
  for (const language of ['en','fr','de','it','pt']) {
    const raw = readFileSync(new URL(language + '.lproj/Localizable.strings', root), 'utf8');
    for (const key of keys) assert.ok(raw.includes(JSON.stringify(key) + ' = '), language + ': ' + key);
  }
});

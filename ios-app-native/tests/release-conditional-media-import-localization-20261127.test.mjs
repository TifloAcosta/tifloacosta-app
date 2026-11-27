import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = new URL('../Sources/', import.meta.url);
const expected = {
  "NativeScreens.swift": [
    "Button(MusicLocalized.message(podcastPlayer.isPlaying ? \"Pausar\" : \"Reproducir\"))",
    ".navigationTitle(MusicLocalized.message(showWatchLater ? \"Ver después\" : \"Continuar viendo\"))"
  ],
  "NativeMyMusic.swift": [
    "Button(MusicLocalized.message(player.isPlaying ? \"Pausar\" : \"Reproducir\"))"
  ],
  "NativeYouTubePlayer.swift": [
    "Text(MusicLocalized.message(engine.playing ? \"Pausar\" : \"Reproducir\"))",
    "Button(MusicLocalized.message(subscribed ? \"Cancelar suscripción al canal\" : \"Suscribirse al canal\"))"
  ],
  "NativePodcasts.swift": [
    "Button(MusicLocalized.message(player.isPlaying ? \"Pausar\" : \"Reproducir\"))",
    "Text(MusicLocalized.message(library.isFavorite(episode) ? \"Quitar de favoritos\" : \"Añadir a favoritos\"))"
  ],
  "NativeUpdatesSettings.swift": [
    "Text(MusicLocalized.message(favorites.contains(.resource, item: item) ? \"Quitar de favoritos\" : \"Añadir a favoritos\"))",
    "Text(MusicLocalized.message(favorites.contains(.video, item: item) ? \"Quitar de favoritos\" : \"Añadir a favoritos\"))"
  ],
  "NativeMediaInline.swift": [
    "Button(MusicLocalized.message(store.loading ? \"Actualizando contenidos multimedia\" : \"Actualizar contenidos multimedia\"))"
  ],
  "NativeCloudGooglePickerScreen.swift": [
    "Button(MusicLocalized.message(loading ? \"Abriendo Google Drive…\" : \"Elegir archivos de Google Drive\"))"
  ],
  "NativeReaderExternalCatalogs.swift": [
    "Button(MusicLocalized.message(importing == item.id ? \"Importando\" : \"Importar a mi biblioteca\"))"
  ],
  "NativeCinemaDriveBrowser.swift": [
    "Button(MusicLocalized.message(loading ? \"Abriendo Google Drive…\" : \"Elegir carpeta autorizada\"))"
  ]
};
const keys = ["Pausar","Reproducir","Ver después","Continuar viendo","Cancelar suscripción al canal","Suscribirse al canal","Quitar de favoritos","Añadir a favoritos","Actualizando contenidos multimedia","Actualizar contenidos multimedia","Abriendo Google Drive…","Elegir archivos de Google Drive","Importando","Importar a mi biblioteca","Elegir carpeta autorizada"];
test('conditional video, favorites, podcast and cloud import controls use the app language', () => {
  for (const [file, snippets] of Object.entries(expected)) {
    const source = readFileSync(new URL(file, root), 'utf8');
    for (const snippet of snippets) assert.ok(source.includes(snippet), file + ': ' + snippet);
  }
  for (const language of ['en','fr','de','it','pt']) {
    const raw = readFileSync(new URL(language + '.lproj/Localizable.strings', root), 'utf8');
    for (const key of keys) assert.ok(raw.includes(JSON.stringify(key) + ' = '), language + ': ' + key);
  }
});

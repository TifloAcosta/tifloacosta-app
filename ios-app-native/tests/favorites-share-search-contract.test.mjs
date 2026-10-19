import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const home = read('NativeScreens.swift'), news = read('NativeNews.swift');
const app = read('TifloAcostaNativeApp.swift'), favorites = read('NativeFavorites.swift');
const share = read('NativeShareInbox.swift');

test('Busca desde Inicio anuncia una sola vez el campo editable', () => {
  assert.ok(home.includes('TextField("Introduce tu búsqueda", text: $searchText)'));
  assert.ok(!home.includes('.accessibilityLabel("Introduce tu búsqueda")'));
});
test('Favoritos tiene almacén persistente, pantalla nativa y acciones VoiceOver', () => {
  assert.ok(app.includes('NativeFavoritesStore()'));
  assert.ok(app.includes('.environmentObject(favorites)'));
  assert.ok(home.includes('case .favoritos: NativeFavoritesScreen()'));
  assert.ok(favorites.includes('UserDefaults.standard.data(forKey: storageKey)'));
  assert.ok(favorites.includes('UserDefaults.standard.set(data, forKey: storageKey)'));
  assert.ok(home.includes('favorites.toggle(.resource, item: item)'));
  assert.ok(home.includes('favorites.toggle(.video, item: item)'));
  assert.ok(news.includes('favorites.toggle(.news, item: item)'));
  assert.ok(favorites.includes('Text("Quitar de favoritos")'));
});
test('Compartir EPUB importa en lector y no obliga a volver a compartir', () => {
  assert.ok(share.includes('func importToReader(_ item: NativeShareMessage'));
  assert.ok(share.includes('library.importDocuments(from: [named], sharingID: sharingID)'));
  assert.ok(share.includes('func importPendingReaderContent(into library: NativeReaderLibrary)'));
  assert.ok(share.includes('inbox.readyToRead = try inbox.importToReader(item, library: library)'));
  assert.ok(!share.includes('pathExtension.lowercased() == "epub"'));
  assert.ok(share.includes('Eliminar de Recibidos')); // delete remains optional
  assert.ok(home.includes('.navigationDestination(item: $inbox.readyToRead)'));
  assert.ok(home.includes('inbox.importPendingReaderContent(into: library)'));
});
test('Extensión Compartir ofrece vista previa accesible sin abrir la app', () => {
  const fs = readFileSync(new URL('../ShareExtension/ShareViewController.swift', import.meta.url), 'utf8');
  const preview = readFileSync(new URL('../ShareExtension/ShareReadingPreview.swift', import.meta.url), 'utf8');
  assert.ok(fs.includes('previewButton.setTitle("Leer ahora"'));
  assert.ok(fs.includes('UITextView()'));
  assert.ok(fs.includes('AVSpeechSynthesizer()'));
  assert.ok(preview.includes('case "epub"'));
  assert.ok(preview.includes('Archive(url: url, accessMode: .read)'));
  assert.ok(!fs.includes('UIApplication.shared.open'));
});

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
test('Recibidos conserva EPUB y permite compartir sin prometer lectura nativa', () => {
  assert.ok(share.includes('exportURL(for item: NativeShareMessage)'));
  assert.ok(share.includes('pathExtension.lowercased() == "epub"'));
  assert.ok(share.includes('NativeShare.present(url: exported)'));
  assert.ok(share.includes('Eliminar de Recibidos'));
});

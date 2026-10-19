import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');

test('El catálogo conserva las etiquetas editoriales de Actualidad', () => {
  const model = read('NativeCatalogStore.swift');
  for (const key of ['categories: [String]?', 'sourceName: String?', 'publishedAt: String?']) {
    assert.ok(model.includes(key), 'Campo perdido en iOS: ' + key);
  }
});

test('Actualidad espera la selección de categoría y admite búsqueda y paginación', () => {
  const news = read('NativeNews.swift');
  assert.match(news, /@State private var categoryIndex = 0/);
  assert.match(news, /"Selecciona una categoría", "Todas las categorías"/);
  assert.match(news, /NativeAdjustableChoice\(\s*title: "Categoría"/);
  assert.match(news, /guard categoryIndex > 0 \|\| !terms\.isEmpty else \{ return \[\] \}/);
  assert.match(news, /\.searchable\(text: \$query, prompt: "Buscar noticias"\)/);
  assert.match(news, /matchingNews\.prefix\(visibleCount\)/);
  assert.match(news, /Button\("Mostrar diez más"\)/);
  assert.match(news, /item\.categories \?\? \[\]/);
});

test('VoiceOver anuncia primero título, medio y publicación sin el resumen extenso', () => {
  const news = read('NativeNews.swift');
  assert.match(news, /accessibilityLabel\(NativeNewsMetadata\.accessibilitySummary\(item\)\)/);
  assert.ok(news.includes('labels = [item.title, "Medio:'));
  assert.ok(news.includes('labels.append("Publicado:'));
  assert.match(news, /summary[\s\S]*?\.lineLimit\(2\)[\s\S]*?\.accessibilityHidden\(true\)/);
  assert.match(news, /ISO8601DateFormatter\(\)/);
  assert.match(news, /formatter\.timeZone = \.current/);
});

test('El rotor ofrece leer, guardar, compartir y fuente original', () => {
  const news = read('NativeNews.swift');
  const list = news.split('struct NativeNewsScreen: View {')[1].split('struct NativeNewsArticleScreen: View {')[0];
  for (const name of ['Leer', 'Guardar en TifloLector', 'Compartir', 'Abrir fuente original']) {
    assert.ok(list.includes('.accessibilityAction(named: Text("' + name + '"))'));
  }
  assert.match(news, /NativeNewsArticleScreen\(item: item\)/);
  assert.match(news, /library\.importSharedText\(/);
  assert.match(news, /NativeShare\.present\(url:/);
  assert.match(news, /Button\("Abrir fuente original"\)/);
  assert.doesNotMatch(news, /WKWebView|UIWebView|import Capacitor/);
});

test('La pantalla de lectura mantiene metadatos y párrafos separados', () => {
  const news = read('NativeNews.swift');
  for (const text of ['Text("Medio:', 'Text("Publicado:', 'Text("Categorías:']) {
    assert.ok(news.includes(text));
  }
  assert.match(news, /LazyVStack\(alignment: \.leading/);
  assert.match(news, /ForEach\(paragraphs\.indices, id: \\.self\)/);
  const old = read('NativeScreens.swift');
  assert.ok(old.includes('case .actualidad: NativeNewsScreen()'));
  assert.doesNotMatch(old, /struct NativeNewsScreen: View/);
});

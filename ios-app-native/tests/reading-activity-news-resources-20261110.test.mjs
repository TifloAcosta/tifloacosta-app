import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const news = source('NativeNews.swift');
const resources = source('NativeScreens.swift');
const activity = source('NativeReadingActivity.swift');
const activityScreen = source('NativeReadingActivityScreen.swift');
const documents = source('NativeDocuments.swift');
const app = source('TifloAcostaNativeApp.swift');

test('Leer después y el historial son persistentes y distintos de Favoritos', () => {
  assert.match(activity, /native-ios-read-later-v1/);
  assert.match(activity, /native-ios-reading-history-v1/);
  assert.match(activity, /func toggleReadLater\(_ kind: NativeFavoriteKind, item: NativeCatalogItem\)/);
  assert.match(activity, /func markOpened\(_ kind: NativeFavoriteKind, item: NativeCatalogItem\)/);
  assert.match(activity, /func clearHistory\(\)/);
  assert.match(activity, /if recentlyRead\.count > 100/);
  assert.match(app, /\.environmentObject\(readingActivity\)/);
});

test('Accesos de noticias y recursos comparten listas sin confundir idiomas', () => {
  assert.match(activityScreen, /Section\("Leer después"\)/);
  assert.match(activityScreen, /Section\("Consultados recientemente"\)/);
  assert.match(activityScreen, /NativeFavoriteKey\(kind, \$0\) == key/);
  assert.match(news, /NativeReadingActivityScreen\(kind: \.news\)/);
  assert.match(resources, /NativeReadingActivityScreen\(kind: \.resource\)/);
  assert.match(news, /readingActivity\.markOpened\(\.news, item: item\)/);
  assert.match(documents, /readingActivity\.markOpened\(\.resource, item: item\)/);
});

test('Actualidad tiene filtros por fuente e idioma sin traducir contenido automáticamente', () => {
  assert.match(news, /title: "Medio de origen"/);
  assert.match(news, /title: "Idioma de las noticias"/);
  assert.match(news, /"Todos los idiomas", "Español", "Inglés"/);
  assert.match(news, /NativeNewsMetadata\.source\(item\) != chosenSource/);
  assert.match(news, /sourceIndex = 0/);
});

test('Recursos puede buscar por título y contenido descriptivo', () => {
  assert.match(resources, /\.searchable\(text: \$resourceQuery, prompt: "Buscar recursos"\)/);
  assert.match(resources, /title: "Idioma de los recursos"/);
  assert.match(resources, /item\.description \?\? ""/);
  assert.match(resources, /readingActivity\.toggleReadLater\(\.resource, item: item\)/);
});

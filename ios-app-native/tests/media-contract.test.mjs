import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const media = source('NativeMedia.swift');
const news = source('NativeNews.swift');
const app = source('TifloAcostaNativeApp.swift');
const home = source('NativeScreens.swift');

test('Actualidad enlaza Escuchar y ver sin reemplazar el selector de noticias', () => {
  assert.match(news, /NavigationLink\s*\{\s*NativeMediaScreen\(\)/);
  assert.match(news, /NativeAdjustableChoice\(\s*title: "Categoría"/);
  assert.match(news, /accessibilityLabel\(NativeNewsMetadata\.accessibilitySummary\(item\)\)/);
  assert.match(news, /\.accessibilityAction\(named: Text\("Guardar en TifloLector"\)\)/);
});

test('Media usa el catálogo editorial real, sin mezclar HTML con SwiftUI', () => {
  assert.match(media, /https:\/\/tifloacosta\.com\/actualidad-media\.json/);
  assert.match(media, /JSONDecoder\(\)\.decode\(\[NativeMediaItem\]\.self, from: data\)/);
  assert.match(media, /tifloacosta-native-media\.json/);
  assert.match(media, /"Selecciona un formato", "Todos los formatos", "Podcasts", "Canales de YouTube"/);
  assert.match(media, /title: "Fuente o canal"/);
  assert.match(media, /title: "Idioma"/);
  assert.match(media, /\.searchable\(text: \$query, prompt: "Buscar podcasts y canales"\)/);
  assert.match(media, /filteredItems\.prefix\(visibleCount\)/);
  assert.match(media, /Button\("Mostrar diez más"\)/);
  assert.match(media, /\.accessibilityAction\(named: Text\(item\.openLabel\)\)/);
  assert.match(media, /\.accessibilityAction\(named: Text\("Visitar fuente"\)\)/);
  assert.match(media, /\.accessibilityAction\(named: Text\("Compartir"\)\)/);
  assert.match(media, /item\.directAudioURL \?\? item\.originalURL/);
  assert.doesNotMatch(media + news, /WKWebView|UIWebView|import Capacitor/);
});

test('Se inyecta el store multimedia en la jerarquía de iOS', () => {
  assert.match(app, /@StateObject private var media = NativeMediaStore\(\)/);
  assert.match(app, /\.environmentObject\(media\)/);
});

test('Identidad de marca usa fondos granate nativos en inicio y Actualidad', () => {
  assert.match(home, /listRowBackground\(TifloVisual\.surfaceRaised\)/);
  assert.match(news, /listRowBackground\(TifloVisual\.surfaceRaised\)/);
  assert.match(news, /\.fill\(TifloVisual\.brandRed\)/);
  assert.match(media, /\.fill\(TifloVisual\.brandRed\)/);
});

test('El catálogo editorial multimedia contiene podcasts y canales de vídeo', () => {
  const snapshot = JSON.parse(readFileSync(new URL('../../actualidad-media.json', import.meta.url), 'utf8'));
  assert.ok(snapshot.some(item => item.type === 'audio' && item.sourceName && item.originalUrl));
  assert.ok(snapshot.some(item => item.type === 'video' && item.sourceName && item.originalUrl));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const native = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const updates = native('NativeUpdatesSettings.swift');
const screen = updates.split('struct NativeUpdatesScreen: View {')[1]?.split('struct NativeSettingsScreen: View {')[0] || '';

test('Novedades separa contenidos propios de las noticias externas de Actualidad', () => {
  assert.ok(screen, 'No se encontró NativeUpdatesScreen');
  assert.match(screen, /catalog\.resources/);
  assert.match(screen, /catalog\.videos/);
  assert.match(screen, /\$0\.lang == "es" && \$0\.isNew == true/);
  assert.match(screen, /latestUpdates[\s\S]*?\.prefix\(3\)/);
  assert.doesNotMatch(screen, /catalog\.news|NativeNewsArticleScreen|Section\("Últimas noticias"\)/);
  assert.match(screen, /Section\("Últimas incorporaciones de TifloAcosta"\)/);
  assert.match(native('NativeCatalogStore.swift'), /let newsDate: String\?/);
  assert.match(updates, /item\.newsDate \?\? item\.publishedAt/);
});

test('Cada recurso en Novedades ofrece acciones nativas reales de VoiceOver', () => {
  assert.match(screen, /case \.resource\(let item\):/);
  assert.match(screen, /NavigationLink\s*\{\s*NativeRemoteResourceScreen\(item: item\)/);
  for (const action of ['Leer', 'Guardar', 'Descargar', 'Compartir']) {
    assert.ok(screen.includes('.accessibilityAction(named: Text("' + action + '"))'),
      'Acción perdida en Novedades: ' + action);
  }
  assert.match(screen, /resourceService\.saveInReader\(item, library: library\)/);
  assert.match(screen, /resourceService\.exportToFiles\(item\)/);
  assert.match(screen, /NativeShare\.present\(url: url\)/);
});

test('Cada vídeo en Novedades puede abrirse y compartirse con VoiceOver', () => {
  assert.match(screen, /case \.video\(let item\):/);
  assert.match(screen, /\.accessibilityAction\(named: Text\("Abrir en YouTube"\)\)/);
  assert.match(screen, /openURL\(url\)/);
  assert.match(screen, /share\(item, isVideo: true\)/);
  assert.match(screen, /\.accessibilityElement\(children: \.ignore\)/);
  assert.match(screen, /\.tifloScreenSurface\(\)/);
  assert.doesNotMatch(screen, /WKWebView|UIWebView|import Capacitor/);
});

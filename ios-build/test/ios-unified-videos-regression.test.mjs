import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = path => readFileSync(resolve(root, path), 'utf8');

test('un solo controlador de Vídeos y retorno al inicio, sin pantalla duplicada', () => {
  const bridge = read('ios-appwide-native-actions.js');
  const plugin = read('native/TifloReadingAccessibilityPlugin.swift');
  const view = read('native/TifloNativeVideosController.swift');
  assert.match(bridge, /if \(path\.endsWith\('\/videos\.html'\)\) return null/);
  assert.match(bridge, /showNativeVideoSection\(\{ videos: items\.slice\(0, 600\) \}\)/);
  assert.match(bridge, /nativeVideoClosed/);
  assert.match(bridge, /location\.replace\('index\.html'\)/);
  assert.match(plugin, /CAPPluginMethod\(name: "showNativeVideoSection"/);
  assert.match(plugin, /TifloNativeVideosController\(videos: videos\)/);
  assert.match(view, /title = "Vídeos de TifloAcosta"/);
  assert.match(view, /title: "Volver al inicio"/);
  assert.doesNotMatch(view, /title: "Cerrar"/);
});

test('el catálogo completo se conserva y la pantalla nativa dispone de buscador, orden y paginación', () => {
  const packager = read('prepare-web.mjs');
  const view = read('native/TifloNativeVideosController.swift');
  assert.match(packager, /window\.TIFLO_NATIVE_VIDEO_CATALOG = catalog/);
  assert.match(packager, /tiflo-ios-catalog-ready/);
  assert.match(view, /UISearchBarDelegate/);
  assert.match(view, /searchBarSearchButtonClicked/);
  assert.match(view, /URLComponents\(string: "https:\/\/youtube-auth\.tifloacosta\.com\/search"\)/);
  assert.match(view, /UISegmentedControl/);
  assert.match(view, /private var limit = 10/);
  assert.match(view, /"Mostrar diez vídeos más"/);
  assert.match(view, /requestResults\(append: true\)/);
});

test('un solo título por flic, acciones independientes, OAuth al actuar y reproductor nativo', () => {
  const view = read('native/TifloNativeVideosController.swift');
  assert.match(view, /cell\.accessibilityLabel = video\.speech/);
  assert.match(view, /cell\.accessibilityCustomActions = handlers\.map/);
  for (const action of ['play', 'youtube', 'like', 'subscribe', 'share', 'comment'])
    assert.ok(view.includes('("' + action + '",'), action);
  assert.match(view, /TifloYouTubeViewController\(/);
  assert.match(view, /TifloNativeYouTubeAccount\.shared\.signIn\(from: self\)/);
  assert.match(view, /TifloNativeYouTubeAccount\.shared\.state\(videoId: video\.id\)/);
  assert.match(view, /"unlike" : "like"/);
  assert.match(view, /"unsubscribe" : "subscribe"/);
});

test('el icono se expande proporcionalmente sobre el fondo uniforme sin el segundo borde', () => {
  const icon = read('make-app-icon.swift');
  assert.match(icon, /let markTarget = NSRect/);
  assert.match(icon, /width: CGFloat\(dimension\) \* 0\.976/);
  assert.match(icon, /let isolated = NSBitmapImageRep/);
  assert.doesNotMatch(icon, /let perimeter =/);
  assert.doesNotMatch(icon, /strip in perimeter/);
});

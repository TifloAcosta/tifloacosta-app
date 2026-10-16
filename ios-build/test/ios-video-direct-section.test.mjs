import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const source = p => readFileSync(resolve(root,p),'utf8');

test('La sección Vídeos abre desde el inicio sin navegar previamente a videos.html', () => {
  const bridge=source('ios-appwide-native-actions.js');
  const prepare=source('prepare-web.mjs');
  assert.match(prepare, /name === 'index\.html'.*ios-videos-fallback\.js/);
  assert.match(bridge, /home-blocks/);
  assert.match(bridge, /openVideosFromHome\(link.href, link\)/);
  assert.match(bridge, /event\.preventDefault\(\)/);
  assert.match(bridge, /window\.TIFLO_IOS_VIDEOS\?\.videos/);
  assert.doesNotMatch(bridge, /showUnifiedVideos/);
  assert.doesNotMatch(bridge, /location\.replace\('index\.html'\)/);
  assert.match(bridge, /if \(!enabled\) \{\s*location\.assign\(fallbackURL\)/);
});

test('La interfaz nativa usa los colores reales de TifloAcosta y carece de barra de menú superpuesto', () => {
  const bridge=source('ios-appwide-native-actions.js');
  const plugin=source('native/TifloReadingAccessibilityPlugin.swift');
  const native=source('native/TifloNativeVideosController.swift');
  assert.match(bridge, /getComputedStyle\(document\.documentElement\)/);
  for(const key of ["bg","surface","text","muted","border","brand-red"])
    assert.ok(bridge.includes("prop('"+key+"')"),key);
  assert.match(plugin, /let webTheme = call\.getObject\("theme"\)/);
  assert.match(native, /TifloVideoTheme\(theme\)/);
  assert.match(native, /navigationController\?\.setNavigationBarHidden\(true, animated: false\)/);
  assert.match(native, /backButton\.setTitle\("Volver al inicio", for: \.normal\)/);
  assert.match(native, /sectionHeading\.text = "Vídeos"/);
  assert.match(native, /sectionIntro\.text = /);
  assert.match(native, /panel\.backgroundColor = theme\.surface/);
});

test('Acciones nativas permanecen en un solo elemento por vídeo y vuelven al control de origen', () => {
  const bridge=source('ios-appwide-native-actions.js');
  const native=source('native/TifloNativeVideosController.swift');
  assert.match(native,/cell\.accessibilityLabel = video\.speech/);
  assert.match(native,/cell\.accessibilityCustomActions = handlers\.map/);
  assert.match(native,/isAccessibilityElement = true/);
  assert.match(native,/TifloYouTubeViewController\(/);
  assert.match(native,/private var limit = 10/);
  assert.match(native,/requestResults\(append: true\)/);
  assert.match(native,/backToChannelButton\.isHidden = !showingSearch/);
  assert.match(bridge,/nativeVideoClosed/);
  assert.match(bridge,/previous\?\.isConnected\) previous\.focus/);
  for(const key of ['"play"','"youtube"','"like"','"subscribe"','"share"','"comment"'])
    assert.ok(native.includes(key),key);
});

test('Vídeos UIKit permanece visible y aísla VoiceOver sin ocultar su contenedor WebKit', () => {
  const plugin = source('native/TifloReadingAccessibilityPlugin.swift');
  const start = plugin.indexOf('@objc public func showNativeVideoSection');
  const end = plugin.indexOf('@objc public func showNativeActionList', start);
  assert.ok(start !== -1 && end > start, 'Se encontró el método de vídeos');
  const block = plugin.slice(start, end);
  assert.match(block, /let webAccessibilityWasHidden = self\.webView\?\.accessibilityElementsHidden \?\? false/);
  assert.match(block, /navigation\.view\.backgroundColor = screen\.view\.backgroundColor \?\? \.black/);
  assert.match(block, /navigation\.view\.isOpaque = true/);
  assert.match(block, /navigation\.view\.accessibilityViewIsModal = true/);
  assert.match(block, /presenter\.view\.bringSubviewToFront\(navigation\.view\)/);
  assert.match(block, /!navigation\.view\.isDescendant\(of: web\)/);
  assert.match(block, /web\.accessibilityElementsHidden = true/);
  assert.match(block, /self\?\.webView\?\.accessibilityElementsHidden = webAccessibilityWasHidden/);
  assert.doesNotMatch(block, /webView\?\.isHidden\s*=\s*true/, 'No ocultar el WKWebView que puede contener UIKit');
  assert.doesNotMatch(block, /self\.webView\?\.accessibilityElementsHidden\s*=\s*true/, 'No ocultar accesibilidad de un posible ancestro UIKit');
  assert.ok(block.indexOf('self?.webView?.accessibilityElementsHidden = webAccessibilityWasHidden')
    < block.indexOf('self?.notifyListeners("nativeVideoClosed"'),
    'Restaurar accesibilidad antes de devolver el foco al inicio');
  assert.match(block, /presenter\.addChild\(navigation\)/);
  assert.match(block, /navigation\.removeFromParent\(\)/);
  assert.ok(block.indexOf('presenter.view.bringSubviewToFront(navigation.view)')
    < block.indexOf('navigation.didMove(toParent: presenter)'));
});

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

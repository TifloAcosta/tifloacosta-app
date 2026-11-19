import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const shortcuts = src('NativeAppShortcuts.swift');
const home = src('NativeScreens.swift');
const reader = src('NativeTifloLector.swift');
const settings = src('NativeReaderSettings.swift');

test('La nueva acción de Atajos no pausa ni desplaza el lector', () => {
  assert.match(shortcuts, /struct NativeCreateBookmarkIntent: AppIntent/);
  assert.match(shortcuts, /NativeShortcutRoute\.request\("createBookmark"\)/);
  assert.match(shortcuts, /intent: NativeCreateBookmarkIntent\(\)/);
  assert.match(shortcuts, /static var openAppWhenRun: Bool = true/);
  assert.match(home, /case "createBookmark":/);
  assert.match(home, /NativeQuickBookmarkBridge\.save\(\)/);
  const route = home.slice(home.indexOf('case "createBookmark":'), home.indexOf('case "resumeReader":'));
  assert.doesNotMatch(route, /navigationPath|\.stop\(\)|\.pause\(\)/);
});

test('Guarda la posición de lectura activa, no el último porcentaje persistido', () => {
  assert.match(reader, /NativeQuickBookmarkBridge\.saveActiveReader = \{ addBookmark\(\) \}/);
  assert.match(reader, /NativeQuickBookmarkBridge\.saveActiveReader = nil/);
  assert.match(reader, /library\.addTextBookmark\(document, offset: readingOffset\)/);
  assert.match(reader, /library\.addAudioBookmark\(document, track: trackIndex, percent: currentPercent/);
  assert.match(shortcuts, /UIAccessibility\.post\(notification: \.announcement/);
});

test('Hay instrucciones accesibles para triple toque y botón de Acción', () => {
  assert.match(shortcuts, /struct NativeQuickBookmarkHelpScreen: View/);
  assert.match(shortcuts, /Triple toque posterior/);
  assert.match(shortcuts, /Botón de Acción/);
  assert.match(shortcuts, /shortcuts:\/\//);
  assert.match(settings, /NavigationLink\("Creación rápida de marcas"\)/);
});

test('Las instrucciones de gestos están traducidas en los cinco catálogos', () => {
  const terms = ['Creación rápida de marcas','Crear marca en TifloLector',
    'Triple toque posterior','Botón de Acción','Durante la lectura'];
  for (const lang of ['en','pt','fr','it','de']) {
    const text = src(lang + '.lproj/Localizable.strings');
    for (const term of terms) assert.ok(text.includes('"' + term + '" = '), lang + ': ' + term);
  }
});

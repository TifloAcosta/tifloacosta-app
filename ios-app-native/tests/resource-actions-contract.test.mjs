import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');

test('Recursos conserva el selector ajustable, categorías y aspecto nativo', () => {
  const screens = source('NativeScreens.swift');
  const section = screens.split('struct NativeResourcesScreen: View {')[1]?.split('struct NativeVideosScreen: View {')[0];
  assert.ok(section, 'NativeResourcesScreen debe existir');
  assert.match(section, /NativeAdjustableChoice\(\s*title:\s*"Categoría"/);
  assert.match(section, /Section\(chosenCategory\)/);
  assert.match(section, /NavigationLink\s*\{\s*NativeRemoteResourceScreen/);
  assert.doesNotMatch(section, /WKWebView|UIWebView|WebView/);
});

test('Cada título de Recursos ofrece leer, guardar, descargar y compartir con VoiceOver', () => {
  const screens = source('NativeScreens.swift');
  const section = screens.split('struct NativeResourcesScreen: View {')[1]?.split('struct NativeVideosScreen: View {')[0] || '';
  for (const action of ['Leer','Guardar','Descargar','Compartir']) {
    assert.ok(section.includes('.accessibilityAction(named: Text("' + action + '"))'),
      'Acción VoiceOver ausente: ' + action);
  }
  assert.match(section, /resourceService\.saveInReader\(item, library: library\)/);
  assert.match(section, /resourceService\.exportToFiles\(item\)/);
});

test('El documento permite leer en voz alta, guardar y exportar sin capa web', () => {
  const text = source('NativeDocuments.swift');
  const service = source('NativeResourceService.swift');
  assert.match(text, /LazyVStack\(alignment: \.leading/);
  assert.match(text, /Button\("Leer en voz alta"\)/);
  assert.match(text, /Button\("Descargar en Archivos"\)/);
  assert.match(text, /Button\(imported \? "Guardado en TifloLector" : "Guardar en TifloLector"\)/);
  assert.match(service, /library\.importSharedText\(content, title: item\.title\)/);
  assert.match(service, /UIDocumentPickerViewController\(forExporting:/);
  assert.match(text, /<head\\\\b/);
  assert.doesNotMatch(text + service, /WKWebView|UIWebView/);
});

test('La función de Recursos está disponible tanto en el listado como en la pantalla de lectura', () => {
  const app = source('TifloAcostaNativeApp.swift');
  assert.match(app, /@StateObject private var resourceService = NativeResourceService\(\)/);
  assert.match(app, /\.environmentObject\(resourceService\)/);
});

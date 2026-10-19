import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const screens = readFileSync(fileURLToPath(new URL('../Sources/NativeScreens.swift', import.meta.url)), 'utf8');
const search = readFileSync(fileURLToPath(new URL('../Sources/NativeSearch.swift', import.meta.url)), 'utf8');
const order = ['Actualidad','Recursos','TifloLector','Novedades','Descargar desde un enlace','Vídeos','Podcast','Contacto y redes','Privacidad y accesibilidad','Configuración'];
let previous = -1;
for (const label of order) {
  const found = screens.indexOf('= "' + label + '"');
  assert.ok(found > previous, 'Home order or label mismatch: ' + label);
  previous = found;
}
for (const label of ['Recibidos','Favoritos','TifloAcosta App','Buscar con TifloAcosta','Introduce tu búsqueda','Secciones']) {
  assert.ok(screens.includes(label), 'Missing entry: ' + label);
}
for (const value of ['NativeReaderLibraryScreen()', 'NativeVideosScreen()', 'NativePodcastScreen()', 'NativeResourcesScreen()', 'NativeDownloadsScreen()', 'NativeSearchResultsScreen(query: submittedSearch)']) {
  assert.ok(screens.includes(value), 'Lost functional route: ' + value);
}
for (const value of ['catalog.resources','catalog.news','catalog.videos','NativeNewsArticleScreen(item: match.item)','NativeRemoteResourceScreen(item: match.item)','NativeSearchVideoDetailScreen(item: match.item)']) {
  assert.ok(search.includes(value), 'Missing native result behavior: ' + value);
}
assert.ok(!/WKWebView|UIWebView|index\.html|import Capacitor/.test(screens + search), 'Unexpected HTML shell');
assert.equal((screens.match(/struct NativeHomeScreen\s*:/g) ?? []).length, 1, 'Duplicate home view');
console.log('OK: real native home, global catalog search and preserved feature routes');

const resourcesStart = screens.indexOf('struct NativeResourcesScreen: View {');
const resourcesEnd = screens.indexOf('struct NativeVideosScreen: View {', resourcesStart);
assert.ok(resourcesStart >= 0 && resourcesEnd > resourcesStart, 'Missing native Resources screen');
const resources = screens.slice(resourcesStart, resourcesEnd);
assert.match(resources, /@State private var chosenCategory: String\?/);
assert.match(resources, /"Selecciona un apartado"\] \+ categories/);
assert.match(resources, /selectedIndex: categorySelection/);
assert.match(resources, /if let chosenCategory, categories\.contains\(chosenCategory\) \{\s*Section\(chosenCategory\)/);
assert.match(resources, /guard let chosenCategory, categories\.contains\(chosenCategory\) else \{\s*return \[\]/);
assert.doesNotMatch(resources, /"Todas"\] \+ categories/);
assert.match(screens, /\.accessibilityAdjustableAction \{ direction in/);
assert.match(resources, /\.accessibilityAction\(named: Text\("Compartir"\)\)/);
console.log('OK: Resources stays empty until user selects a category with VoiceOver');

assert.match(screens, /private struct NativeBrandMark: View/);
assert.match(screens, /Canvas \{ context, size in/);
assert.match(screens, /dynamicTypeSize\.isAccessibilitySize/);
assert.match(screens, /RoundedRectangle\(cornerRadius: TifloVisual\.cornerRadius\)\s*\.fill\(TifloVisual\.brandDeepRed\)/);
assert.match(screens, /foregroundStyle\(\.primary\)/);
assert.match(screens, /TifloVisual\.canvas/);
assert.match(screens, /TifloVisual\.primaryText/);
assert.match(screens, /tifloScreenSurface\(\)/);
const brandHeader = screens.split('private struct NativeBrandMark: View {')[1]
  .split('struct NativeHomeScreen: View {')[0];
assert.ok(!brandHeader.includes('AsyncImage(url:'), 'The brand header must not rely on remote image loading');
console.log('OK: native logo, dynamic layout, branded and system-adaptive colors');

assert.ok(!screens.includes('case libro = "Mi libro"'), 'Mi libro debe estar dentro de Contacto y no en el inicio');

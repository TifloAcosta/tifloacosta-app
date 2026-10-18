import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const swift = readFileSync(fileURLToPath(new URL('../Sources/TifloAcostaNativeApp.swift', import.meta.url)), 'utf8');
const entries = [
  'Actualidad', 'Recursos', 'TifloLector', 'Novedades',
  'Descargar desde un enlace', 'Vídeos', 'Podcast', 'Mi libro',
  'Contacto y redes', 'Privacidad y accesibilidad', 'Configuración'
];
let last = -1;
for (const entry of entries) {
  const index = swift.indexOf('= "' + entry + '"');
  assert.ok(index > last, 'Home order changed or missing section: ' + entry);
  last = index;
}
for (const label of ['TifloAcosta App', 'Buscar con TifloAcosta', 'Introduce tu búsqueda', 'Secciones', 'Recibidos', 'Favoritos']) {
  assert.ok(swift.includes(label), 'Missing home label: ' + label);
}
assert.match(swift, /NavigationStack\s*\{/);
assert.match(swift, /NavigationLink\(value: destination\)/);
assert.match(swift, /TextField\("Introduce tu búsqueda"/);
assert.match(swift, /@State private var submittedQuery/);
assert.match(swift, /NativeReaderView\(\)/);
assert.match(swift, /NativeSettingsView\(\)/);
assert.ok(!/WKWebView|UIWebView|index\.html/.test(swift), 'Native screen must not embed HTML');
assert.equal((swift.match(/struct NativeHomeView\s*:/g) ?? []).length, 1);
console.log('OK: native home structure, accessible search entry, section order and retained routes');

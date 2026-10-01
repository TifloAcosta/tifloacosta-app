import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('la sección de lectura se presenta como TifloLector', async () => {
  const source = await read('src/core/i18n.mjs');
  assert.match(source, /readingLibrary:\s*'TifloLector'/);
  assert.match(source, /backToLibrary:\s*'Volver a TifloLector'/);
});

test('la portada Android reutiliza el lenguaje visual corporativo de la web', async () => {
  const css = await read('src/styles.css');
  assert.match(css, /--background:\s*#FFFFFF/i);
  assert.match(css, /--surface-alt:\s*#FFF4F4/i);
  assert.match(css, /--focus:\s*#005FCC/i);
  assert.match(css, /\.app-brand-header\s*\{[\s\S]*linear-gradient\(135deg,\s*var\(--brand-deep\),\s*var\(--brand\)\)/);
  assert.match(css, /\.home-menu\s*\{[\s\S]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*14rem\),\s*1fr\)\)/);
});

test('los resultados de descarga tienen metadatos etiquetados y la acción inmediata', async () => {
  const source = await read('src/screens/download-link.mjs');
  assert.match(source, /downloadsLink\.filename/);
  assert.match(source, /downloadsLink\.type/);
  assert.match(source, /downloadsLink\.size/);
  assert.match(source, /className\s*=\s*'result-card'/);
  assert.match(source, /className\s*=\s*'download-primary-action'/);
});

test('guardar un fichero valida la respuesta remota antes de escribirla', async () => {
  const source = await read('android/app/src/main/java/com/tifloacosta/app/TifloSavePlugin.java');
  assert.match(source, /getContentType\(\)/);
  assert.match(source, /getHeaderField\("Content-Disposition"\)/);
  assert.match(source, /looksLikeHtml/i);
  assert.match(source, /setRequestProperty\("Accept",\s*"\*\/\*"\)/);
});

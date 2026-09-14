import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('Actualidad is the first content block after the home hero', async () => {
  const html = await read('index.html');
  const actualidad = html.indexOf('id="actualidad-home-section"');
  const search = html.indexOf('id="search-heading"');
  const resourceNews = html.indexOf('id="news-heading"');
  assert.ok(actualidad > 0);
  assert.ok(search > actualidad);
  assert.ok(resourceNews > actualidad);
});

test('home preview is explicitly separate from existing resource Novedades', async () => {
  const html = await read('index.html');
  assert.match(html, /id="actualidad-home-heading"/);
  assert.match(html, /id="actualidad-home-list"/);
  assert.match(html, /id="actualidad-home-open"[^>]*href="actualidad\.html"/);
  assert.match(html, /id="news-heading"/);
  assert.match(html, /actualidad-core\.js/);
});

test('home loads the shared Actualidad feed once and caps the preview through the shared core', async () => {
  const source = await read('app.js');
  assert.match(source, /fetch\(['"]actualidad\.json['"]/);
  assert.match(source, /coreActualidad\.homePreview\(actualidadItems,lang,5\)/);
  assert.equal((source.match(/fetch\(['"]actualidad\.json['"]/g) || []).length, 1);
});

test('Actualidad home labels are bilingual', async () => {
  const source = await read('app.js');
  assert.match(source, /heading:'Actualidad'/);
  assert.match(source, /open:'Ver toda la actualidad'/);
  assert.match(source, /heading:'News'/);
  assert.match(source, /open:'View all news'/);
});

test('service worker treats the shared Actualidad assets as live content', async () => {
  const worker = await read('sw.js');
  assert.match(worker, /'\.\/actualidad\.html'/);
  assert.match(worker, /'\.\/actualidad-core\.js\?v=1\.0'/);
  assert.match(worker, /'\.\/actualidad\.js\?v=1\.1'/);
  assert.match(worker, /'\.\/actualidad\.json'/);
  assert.match(worker, /url\.pathname\.endsWith\('\/actualidad\.json'\)/);
});

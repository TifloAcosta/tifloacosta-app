import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('homepage localization uses explicit form-label references', async () => {
  const source = await read('app.js');

  assert.match(source, /searchLabel:\s*\$\('label\[for="search"\]'\)/);
  assert.match(source, /categoryLabel:\s*\$\('label\[for="category"\]'\)/);
  assert.match(source, /els\.searchLabel\.textContent=c\.searchLabel/);
  assert.match(source, /els\.categoryLabel\.textContent=c\.categoryLabel/);
  assert.doesNotMatch(source, /previousElementSibling/);
});

test('homepage chrome is localized in Spanish and English', async () => {
  const source = await read('app.js');

  for (const expected of [
    "documentTitle: 'TifloAcosta App — Recursos de accesibilidad'",
    "documentTitle: 'TifloAcosta App — Accessibility resources'",
    "skip: 'Saltar al contenido principal'",
    "skip: 'Skip to main content'",
    "brandLabel: 'TifloAcosta, inicio'",
    "brandLabel: 'TifloAcosta, home'",
    'document.title=c.documentTitle',
    'els.skip.textContent=c.skip',
    "els.brand.setAttribute('aria-label',c.brandLabel)"
  ]) assert.ok(source.includes(expected), `Missing homepage localization: ${expected}`);
});

test('categories have TIFLO_RESOURCES as their only data source', async () => {
  const dataSource = await read('data.js');
  const appSource = await read('app.js');
  const context = { window: {} };

  vm.runInNewContext(dataSource, context);
  assert.ok(Array.isArray(context.window.TIFLO_RESOURCES));
  assert.ok(context.window.TIFLO_RESOURCES.length > 0);
  assert.equal(context.window.TIFLO_CATEGORIES, undefined);
  assert.doesNotMatch(dataSource, /populateCategorySelect|scheduleCategoryRefresh/);
  assert.match(appSource, /new Set\(resourcesForLanguage\(\)\.map\(item => item\.category\)\)/);
});

test('video cards use h3 titles and title-specific accessible play names', async () => {
  const source = await read('videos.js');

  assert.match(source, /playLabel:\s*title => `Reproducir: \$\{title\}`/);
  assert.match(source, /playLabel:\s*title => `Play: \$\{title\}`/);
  assert.match(source, /const title = document\.createElement\('h3'\)/);
  assert.match(source, /setAttribute\('aria-label', c\.playLabel\(video\.title \|\| ''\)\)/);
  assert.doesNotMatch(source, /const title = document\.createElement\('h2'\)/);
  assert.doesNotMatch(source, /setAttribute\('aria-label', c\.play\)/);
});

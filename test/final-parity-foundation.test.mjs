import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Actualidad keeps original source inside the clean reader when internal reading exists', async () => {
  const [web, mobile, reader] = await Promise.all([
    read('actualidad.js'),
    read('mobile/src/screens/actualidad.mjs'),
    read('mobile/src/screens/reader.mjs')
  ]);
  assert.ok(web.includes("story.editorialState === 'source-only'"));
  assert.ok(web.includes('els.readerOriginal.href = story.originalUrl'));
  assert.doesNotMatch(mobile, /addExternalLink\(actions/);
  assert.ok(mobile.includes('onOpenNews?.(item, openButton.id)'));
  assert.ok(reader.includes("original.textContent = t('actualidad.original')"));
  assert.ok(reader.includes('onOpenOriginal(state.url)'));
});

test('web and Android resource navigation share the category-only model', async () => {
  const [shared, web, mobile] = await Promise.all([
    read('shared/resources.mjs'),
    read('app.js'),
    read('mobile/src/screens/library.mjs')
  ]);
  for (const token of [
    'resourceCategories',
    'resourceMatchesPlatform',
    'selectResources',
    'newestResources'
  ]) assert.ok(shared.includes(`export function ${token}`));
  assert.ok(web.includes('shared.resourceCategories'));
  assert.ok(web.includes('shared.selectResources'));
  assert.ok(mobile.includes("from '../core/resources.mjs'"));
  assert.ok(mobile.includes('resourceCategories(allItems, lang)'));
  assert.ok(mobile.includes('library-category-filter'));
  assert.ok(mobile.includes('selectResources(allItems, { lang, category })'));
  assert.ok(mobile.includes('list.hidden = true'));
  assert.doesNotMatch(mobile, /library-platform-filter/);
  assert.doesNotMatch(mobile, /library-search-input/);
});

test('web downloads attempts to save file bytes and restores focus', async () => {
  const source = await read('downloads.js');
  assert.ok(source.includes('async function saveDownloadItem'));
  assert.ok(source.includes('await fetch(href'));
  assert.ok(source.includes('await response.blob()'));
  assert.ok(source.includes('URL.createObjectURL(blob)'));
  assert.ok(source.includes('anchor.download = filename'));
  assert.ok(source.includes('trigger.focus()'));
  assert.ok(source.includes('saveFallback'));
});

test('web and Android share the corporate visual identity tokens', async () => {
  const [web, mobile] = await Promise.all([
    read('styles.css'),
    read('mobile/src/styles.css')
  ]);
  for (const token of [
    '#A61B1B',
    '#7F1414',
    '#FFFFFF',
    '#111111',
    '#D9B8B8',
    '#005FCC',
    '#FFE36E'
  ]) {
    assert.ok(web.includes(token), `Web missing ${token}`);
    assert.ok(mobile.includes(token), `Android missing ${token}`);
  }
  assert.ok(web.includes('linear-gradient(135deg,var(--brand-deep),var(--brand))'));
  assert.ok(mobile.includes('linear-gradient(135deg, var(--brand-deep), var(--brand))'));
  assert.ok(web.includes('width:2.8rem'));
  assert.ok(mobile.includes('inline-size: 2.8rem'));
});

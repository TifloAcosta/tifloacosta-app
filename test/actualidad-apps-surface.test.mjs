import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

let appsModule = {};
try {
  appsModule = await import('../scripts/actualidad-apps.mjs');
} catch (error) {
  appsModule = {};
}

test('apps catalog combines undated BuscaApps discoveries with dated app feed entries', async () => {
  assert.equal(typeof appsModule.buildAppsCatalog, 'function');

  const discoveryItems = [{
    id: 'buscaapps-1',
    title: 'Visor Universal',
    url: 'https://www.buscaapps.com/programa/visor-universal',
    platform: 'Windows',
    summary: 'Visor accesible.'
  }];
  const discoverySource = { id: 'buscaapps', name: 'BuscaApps', homepage: 'https://www.buscaapps.com/', lang: 'es' };
  const feedEntries = [{
    title: 'Accessible Timer',
    url: 'https://www.applevis.com/apps/ios/utilities/accessible-timer',
    publishedAt: '2026-09-14T10:00:00Z',
    summary: 'An accessible timer.'
  }];
  const feedSource = { id: 'applevis-apps', name: 'AppleVis Apps', homepage: 'https://www.applevis.com/apps', lang: 'en', appPlatform: 'Apple' };

  const items = appsModule.buildAppsCatalog({ discoveryItems, discoverySource, feedEntries, feedSource });
  assert.equal(items.length, 2);
  assert.equal(items[0].sourceName, 'BuscaApps');
  assert.equal(items[0].platform, 'Windows');
  assert.equal(items[0].publishedAt, null);
  assert.equal(items[1].sourceName, 'AppleVis Apps');
  assert.equal(items[1].platform, 'Apple');
  assert.equal(items[1].publishedAt, '2026-09-14T10:00:00.000Z');
});

test('Apps surface is a semantic section with direct navigation and a platform filter', async () => {
  const html = await read('actualidad.html');
  const js = await read('actualidad.js');

  assert.match(html, /<nav[^>]*id="actualidad-sections"/);
  assert.match(html, /href="#news-browser"/);
  assert.match(html, /href="#apps-browser"/);
  assert.match(html, /<section[^>]*id="apps-browser"/);
  assert.match(html, /<h2[^>]*id="apps-heading"/);
  assert.match(html, /<label[^>]*for="apps-platform"/);
  assert.match(html, /<select[^>]*id="apps-platform"/);
  assert.match(html, /id="apps-status"[^>]*aria-live="polite"/);
  assert.match(html, /id="apps-list"/);
  assert.match(js, /fetch\(['"]actualidad-apps\.json['"]/);
  assert.match(js, /app\.publishedAt/);
});

test('AppleVis Apps is explicitly enabled for the app catalog', async () => {
  const sources = JSON.parse(await read('actualidad-sources.json'));
  const applevis = sources.find(source => source.id === 'applevis-apps');
  assert.ok(applevis);
  assert.equal(applevis.appCatalog, true);
  assert.equal(applevis.appPlatform, 'Apple');
});

test('both deployment paths regenerate and publish the apps catalog independently from news', async () => {
  const syncWorkflow = await read('.github/workflows/sync-actualidad.yml');
  const pagesWorkflow = await read('.github/workflows/jekyll-gh-pages.yml');
  const worker = await read('sw.js');

  for (const workflow of [syncWorkflow, pagesWorkflow]) {
    assert.match(workflow, /node scripts\/sync-actualidad-apps\.mjs/);
  }
  assert.match(syncWorkflow, /actualidad-apps\.json/);
  assert.match(worker, /actualidad-apps\.json/);
});

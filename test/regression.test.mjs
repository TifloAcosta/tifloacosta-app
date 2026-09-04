import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');
const require = createRequire(import.meta.url);
const core = require('../app-core.js');

test('resource search ignores diacritics and constrains very short terms to whole words', () => {
  const camera = { title: 'Cámara inteligente', category: 'Tecnología' };
  const guide = { title: 'Guía práctica para móviles', category: 'Estudios' };
  const ai = { title: 'IA para la accesibilidad', category: 'Tecnología' };

  assert.equal(core.resourceMatches(camera, 'camara'), true);
  assert.equal(core.resourceMatches(camera, 'CAMARA'), true);
  assert.equal(core.resourceMatches(guide, 'IA'), false);
  assert.equal(core.resourceMatches(ai, 'IA'), true);
});

test('news ordering is deterministic regardless of source-file order', () => {
  const items = [
    { id: '3', title: 'Zulu', category: 'B' },
    { id: '2', title: 'Ábaco', category: 'C' },
    { id: '1', title: 'Ábaco', category: 'A' }
  ];
  const ids = values => values.slice().sort(core.compareNewsItems).map(item => item.id);

  assert.deepEqual(ids(items), ['1', '2', '3']);
  assert.deepEqual(ids(items.slice().reverse()), ['1', '2', '3']);
});

test('storage helpers tolerate corrupt data and inaccessible storage', () => {
  const corrupt = { getItem: () => '{not json' };
  const inaccessible = {
    getItem() { throw new Error('denied'); },
    setItem() { throw new Error('denied'); }
  };

  const blockedWindow = {};
  Object.defineProperty(blockedWindow, 'localStorage', { get() { throw new Error('denied'); } });

  assert.equal(core.getStorage(blockedWindow), undefined);
  assert.deepEqual(core.readStoredJson(corrupt, 'key', []), []);
  assert.deepEqual(core.readStoredJson(inaccessible, 'key', {}), {});
  assert.equal(core.readStoredValue(inaccessible, 'key', 'es'), 'es');
  assert.equal(core.writeStoredJson(inaccessible, 'key', []), false);
  assert.equal(core.writeStoredValue(inaccessible, 'key', 'es'), false);
});

test('homepage loads shared app logic and reserves the lazy book-cover dimensions', async () => {
  const html = await read('index.html');
  const worker = await read('sw.js');

  assert.match(html, /<script src="app-core\.js\?v=1\.1"><\/script>\s*<script src="app\.js\?v=[^"]+"><\/script>/);
  assert.match(html, /<img id="book-cover"[^>]*loading="lazy"[^>]*width="1600"[^>]*height="2560">/);
  assert.match(worker, /'\.\/app-core\.js\?v=1\.1'/);
});

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

test('public pages expose canonical social metadata for the verified project URL', async () => {
  const home = await read('index.html');
  const videos = await read('videos.html');
  const base = 'https://tifloacosta.github.io/tifloacosta-app/';

  assert.match(home, new RegExp(`<link rel="canonical" href="${base}">`));
  assert.match(videos, new RegExp(`<link rel="canonical" href="${base}videos\\.html">`));
  for (const html of [home, videos]) {
    assert.match(html, /<meta name="description" content="[^"]+">/);
    assert.match(html, /<meta property="og:title" content="[^"]+">/);
    assert.match(html, /<meta property="og:image" content="https:\/\//);
    assert.match(html, /<meta name="twitter:card" content="summary">/);
    assert.doesNotMatch(html, /http-equiv="(?:Content-Security-Policy|X-Frame-Options)/i);
  }
});

test('privacy and external-service information is present and bilingual', async () => {
  const html = await read('index.html');
  const source = await read('app.js');

  for (const id of ['about-heading', 'external-links-note', 'privacy-heading', 'privacy-text', 'accessibility-info-text']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  for (const expected of ['GoatCounter', 'OneSignal', "heading: 'About Tony'", "heading: 'Privacy and accessibility'", 'els.privacyText.textContent=c.privacy.text']) {
    assert.ok(source.includes(expected), `Missing localized audit information: ${expected}`);
  }
});

test('YouTube workflow uses one sync implementation and deploys changed catalog directly', async () => {
  const sync = await read('.github/workflows/sync-youtube.yml');
  const pages = await read('.github/workflows/jekyll-gh-pages.yml');

  assert.match(sync, /run: node scripts\/sync-youtube\.mjs/);
  assert.doesNotMatch(sync, /node <<'NODE'/);
  assert.match(sync, /pages: write/);
  assert.match(sync, /id-token: write/);
  assert.match(sync, /actions\/upload-pages-artifact@v3/);
  assert.match(sync, /actions\/deploy-pages@v4/);
  assert.match(sync, /if: steps\.changes\.outputs\.changed == 'true'/);
  assert.match(pages, /actions\/deploy-pages@v5/);
});

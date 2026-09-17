import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');
const require = createRequire(import.meta.url);
const navCore = require('../actualidad-core.js');

function attributesForId(html, id) {
  const match = html.match(new RegExp(`<[^>]+\\bid=["']${id}["'][^>]*>`, 'i'));
  assert.ok(match, `Missing control #${id}`);
  return match[0];
}

function hrefForId(html, id) {
  const tag = attributesForId(html, id);
  const match = tag.match(/\bhref=["']([^"']+)["']/i);
  assert.ok(match, `Control #${id} has no href`);
  return match[1];
}

function assertLocalFileTarget(href, label) {
  const path = href.split('#')[0].split('?')[0];
  assert.match(path, /^[A-Za-z0-9_./-]+\.html$/, `${label} has an unexpected local target: ${href}`);
  return access(new URL(`../${path.replace(/^\.\//, '')}`, import.meta.url));
}

test('home section controls point to the view or page they advertise', async () => {
  const html = await read('index.html');
  const expected = {
    'home-open-actualidad': 'actualidad.html',
    'home-open-resources': '#resources',
    'home-open-news': '#news',
    'home-open-videos': 'videos.html',
    'home-open-book': '#book',
    'home-open-contact': '#contact',
    'home-open-privacy': '#privacy',
    'home-open-config': '#config'
  };

  for (const [id, href] of Object.entries(expected)) {
    assert.equal(hrefForId(html, id), href, `#${id} points to the wrong destination`);
  }

  await assertLocalFileTarget(expected['home-open-actualidad'], 'Actualidad');
  await assertLocalFileTarget(expected['home-open-videos'], 'Videos');

  const viewExpectations = {
    '#resources': 'resources-view',
    '#news': 'news-view',
    '#book': 'book-section',
    '#contact': 'contact-section',
    '#privacy': 'privacy-section',
    '#config': 'config-section'
  };
  for (const [hash, view] of Object.entries(viewExpectations)) {
    assert.equal(navCore.resolveIsolatedView('home', hash).view, view, `${hash} resolves to the wrong home view`);
    assert.match(html, new RegExp(`\\bid=["']${view}["']`), `${hash} resolves to missing #${view}`);
  }
});

test('Actualidad section controls point to the isolated section they advertise', async () => {
  const html = await read('actualidad.html');
  const expected = {
    'section-news-link': '#news-browser',
    'section-apps-link': '#apps-browser',
    'section-media-link': '#media-browser',
    'media-accessibility-link': '#media-accessibility',
    'media-technology-link': '#media-technology'
  };

  for (const [id, href] of Object.entries(expected)) {
    assert.equal(hrefForId(html, id), href, `#${id} points to the wrong destination`);
    const target = href.slice(1);
    assert.match(html, new RegExp(`\\bid=["']${target}["']`), `#${id} points to missing #${target}`);
    assert.equal(navCore.resolveIsolatedView('actualidad', href).view, target, `#${id} resolves to the wrong isolated view`);
  }

  assert.equal(hrefForId(html, 'home-link-top'), 'index.html');
  assert.equal(hrefForId(html, 'home-link-bottom'), 'index.html');
  await assertLocalFileTarget('index.html', 'Actualidad back to home');
});

test('every accessible resource Open document destination exists in the deployed tree', async () => {
  const source = await read('data.js');
  const context = { window: {} };
  vm.runInNewContext(source, context);
  const resources = context.window.TIFLO_RESOURCES;
  assert.ok(Array.isArray(resources) && resources.length > 0, 'Resource catalog is empty');

  for (const item of resources) {
    assert.ok(item.openUrl, `Resource has no Open document destination: ${item.title}`);
    const url = new URL(item.openUrl);
    assert.equal(url.origin, 'https://tifloacosta.com', `Resource opens outside TifloAcosta reader: ${item.title}`);
    await access(new URL(`../${url.pathname.replace(/^\//, '')}`, import.meta.url));
  }
});

test('all generated Actualidad actions have usable destinations', async () => {
  const [storiesRaw, appsRaw] = await Promise.all([read('actualidad.json'), read('actualidad-apps.json')]);
  const stories = JSON.parse(storiesRaw);
  const apps = JSON.parse(appsRaw);

  for (const story of stories) {
    assert.doesNotThrow(() => {
      const url = new URL(story.originalUrl);
      assert.ok(['http:', 'https:'].includes(url.protocol));
    }, `News item has a broken original-source destination: ${story.id}`);
  }

  for (const app of apps) {
    assert.doesNotThrow(() => {
      const url = new URL(app.originalUrl);
      assert.ok(['http:', 'https:'].includes(url.protocol));
    }, `Accessible app has a broken source destination: ${app.id || app.title}`);
  }
});

test('every video Open player control has a playable YouTube destination', async () => {
  const catalog = JSON.parse(await read('videos.json'));
  const videos = Array.isArray(catalog.videos) ? catalog.videos : [];
  assert.ok(videos.length > 0, 'Video catalog is empty');

  for (const video of videos) {
    const id = String(video.id || '').trim();
    const idIsValid = /^[A-Za-z0-9_-]{11}$/.test(id);
    let urlIsPlayable = false;
    try {
      const url = new URL(String(video.url || ''));
      const fromShortUrl = url.hostname === 'youtu.be' && /^[A-Za-z0-9_-]{11}$/.test(url.pathname.replace(/^\//, '').split('/')[0]);
      const fromQuery = /^[A-Za-z0-9_-]{11}$/.test(url.searchParams.get('v') || '');
      urlIsPlayable = fromShortUrl || fromQuery;
    } catch {}
    assert.ok(idIsValid || urlIsPlayable, `Video has no playable YouTube destination: ${video.title || id}`);
  }
});

test('content-opening buttons are wired to handlers or native form behavior', async () => {
  const [home, app, actualidad, videos] = await Promise.all([
    read('index.html'), read('app.js'), read('actualidad.js'), read('videos.js')
  ]);

  for (const id of ['favorites-button', 'clear-results', 'settings-toggle', 'settings-reset', 'app-update']) {
    assert.match(app, new RegExp(`els\\.[A-Za-z]+(?:[A-Za-z]+)?\\.addEventListener\\(['\"](?:click|change)['\"]`), `Homepage JS has no interactive handlers`);
    assert.match(home, new RegExp(`\\bid=["']${id}["']`));
  }
  assert.match(app, /open\.addEventListener\('click',[\s\S]*openResourceMenu/);
  assert.match(app, /openLink\.addEventListener\('click'/);
  assert.match(app, /downloadLink\.addEventListener\('click'/);
  assert.match(actualidad, /button\.addEventListener\('click', \(\) => openReader\(story, button\)\)/);
  assert.match(actualidad, /els\.readerBackTop\.addEventListener\('click'/);
  assert.match(actualidad, /els\.readerBackBottom\.addEventListener\('click'/);
  assert.match(videos, /playButton\.addEventListener\('click', \(\) => openPlayer\(video\)\)/);
  assert.match(videos, /els\.playerClose\.addEventListener\('click', closePlayer\)/);
  assert.match(videos, /els\.prev\.addEventListener\('click'/);
  assert.match(videos, /els\.next\.addEventListener\('click'/);
});

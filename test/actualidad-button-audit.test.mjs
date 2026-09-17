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

function driveId(value) {
  return String(value || '').match(/\/file\/d\/([^/?#]+)/)?.[1] || null;
}

function normalizedWords(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&[^;]+;/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(word => word.length >= 4 && !['para', 'with', 'from', 'this', 'that', 'todo', 'como'].includes(word));
}

function titleOverlap(a, b) {
  const left = new Set(normalizedWords(a));
  const right = new Set(normalizedWords(b));
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / Math.min(left.size, right.size);
}

function firstH1(html) {
  return html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || '';
}

function metaDescription(html) {
  const tag = html.match(/<meta\b[^>]*name=["']description["'][^>]*>/i)?.[0] || html.match(/<meta\b[^>]*content=["'][^"']*["'][^>]*name=["']description["'][^>]*>/i)?.[0] || '';
  return tag.match(/\bcontent=["']([^"']*)["']/i)?.[1] || '';
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

  for (const [id, href] of Object.entries(expected)) assert.equal(hrefForId(html, id), href, `#${id} points to the wrong destination`);
  await assertLocalFileTarget(expected['home-open-actualidad'], 'Actualidad');
  await assertLocalFileTarget(expected['home-open-videos'], 'Videos');

  const viewExpectations = {
    '#resources': 'resources-view', '#news': 'news-view', '#book': 'book-section', '#contact': 'contact-section', '#privacy': 'privacy-section', '#config': 'config-section'
  };
  for (const [hash, view] of Object.entries(viewExpectations)) {
    assert.equal(navCore.resolveIsolatedView('home', hash).view, view, `${hash} resolves to the wrong home view`);
    assert.match(html, new RegExp(`\\bid=["']${view}["']`), `${hash} resolves to missing #${view}`);
  }
});

test('Actualidad section controls point to the isolated section they advertise', async () => {
  const html = await read('actualidad.html');
  const expected = {
    'section-news-link': '#news-browser', 'section-apps-link': '#apps-browser', 'section-media-link': '#media-browser',
    'media-accessibility-link': '#media-accessibility', 'media-technology-link': '#media-technology'
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

test('every accessible resource Open document control opens the intended reader', async () => {
  const source = await read('data.js');
  const context = { window: {} };
  vm.runInNewContext(source, context);
  const resources = context.window.TIFLO_RESOURCES;
  assert.ok(Array.isArray(resources) && resources.length > 0, 'Resource catalog is empty');

  for (const item of resources) {
    assert.ok(item.openUrl, `Resource has no Open document destination: ${item.title}`);
    const url = new URL(item.openUrl);
    assert.equal(url.origin, 'https://tifloacosta.com', `Resource opens outside TifloAcosta reader: ${item.title}`);
    const path = url.pathname.replace(/^\//, '');
    const html = await read(path);
    const h1 = firstH1(html);
    assert.ok(h1, `Reader has no H1: ${item.title}`);
    const contentIdentity = `${h1} ${metaDescription(html)}`;
    assert.ok(titleOverlap(item.title, contentIdentity) >= 0.5, `Open document appears to point to different content: "${item.title}" -> "${h1}" (${item.openUrl})`);

    const sourceId = driveId(item.url);
    const readerId = path.match(/reader-([^/]+)\.html$/)?.[1] || null;
    if (readerId && sourceId) assert.equal(readerId, sourceId, `Reader file belongs to a different Drive resource: ${item.title}`);
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

test('Listen and watch controls have valid source and player destinations', async () => {
  const items = JSON.parse(await read('actualidad-media.json'));
  assert.ok(Array.isArray(items) && items.length > 0, 'Listen and watch catalog is empty');
  for (const item of items) {
    const original = new URL(item.originalUrl);
    assert.ok(['http:', 'https:'].includes(original.protocol), `Invalid original destination: ${item.title}`);
    if (item.type === 'video' && item.embedUrl) {
      const embed = new URL(item.embedUrl);
      assert.equal(embed.protocol, 'https:', `Video embed is not HTTPS: ${item.title}`);
      assert.match(embed.hostname, /(^|\.)youtube(-nocookie)?\.com$/, `Unexpected video player host: ${item.title}`);
      assert.match(embed.pathname, /^\/embed\/[A-Za-z0-9_-]{11}/, `Video has a broken embed destination: ${item.title}`);
    }
    if (item.type === 'audio' && item.mediaUrl) {
      const media = new URL(item.mediaUrl);
      assert.ok(['http:', 'https:'].includes(media.protocol), `Audio has a broken media destination: ${item.title}`);
    }
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

test('content-opening controls are wired to their intended handlers', async () => {
  const [home, app, actualidad, media, videos, notifications] = await Promise.all([
    read('index.html'), read('app.js'), read('actualidad.js'), read('actualidad-media.js'), read('videos.js'), read('notifications.js')
  ]);
  const homeControls = {
    'favorites-button': /els\.favoritesButton\.addEventListener\('click',showFavorites\)/,
    'clear-results': /els\.clearResults\.addEventListener\('click',clearResults\)/,
    'settings-toggle': /els\.settingsToggle\.addEventListener\('click',toggleSettings\)/,
    'settings-reset': /els\.settingsReset\.addEventListener\('click',resetDisplaySettings\)/,
    'app-update': /els\.updateButton\.addEventListener\('click',forceUpdateApplication\)/
  };
  for (const [id, handler] of Object.entries(homeControls)) {
    assert.match(home, new RegExp(`\\bid=["']${id}["']`));
    assert.match(app, handler, `#${id} is not wired to its intended handler`);
  }
  assert.match(notifications, /toggle\.addEventListener\('click', toggleNotifications\)/);
  assert.match(app, /open\.addEventListener\('click',[\s\S]*openResourceMenu/);
  assert.match(app, /openLink\.addEventListener\('click'/);
  assert.match(app, /downloadLink\.addEventListener\('click'/);
  assert.match(actualidad, /button\.addEventListener\('click', \(\) => openReader\(story, button\)\)/);
  assert.match(actualidad, /els\.readerBackTop\.addEventListener\('click'/);
  assert.match(actualidad, /els\.readerBackBottom\.addEventListener\('click'/);
  assert.match(media, /button\.addEventListener\('click', \(\) =>/);
  assert.match(videos, /playButton\.addEventListener\('click', \(\) => openPlayer\(video\)\)/);
  assert.match(videos, /els\.playerClose\.addEventListener\('click', closePlayer\)/);
  assert.match(videos, /els\.prev\.addEventListener\('click'/);
  assert.match(videos, /els\.next\.addEventListener\('click'/);
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createPreferencesStore } from '../src/core/preferences.mjs';
import { HOME_ITEMS } from '../src/screens/home.mjs';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
  };
}

test('Android start screen begins with Search and keeps Leer con TifloAcosta visible', () => {
  assert.equal(HOME_ITEMS[0], 'search');
  assert.ok(HOME_ITEMS.includes('reading-library'));
});

test('home exposes Novedades as a closed destination near the start instead of expanding its items', async () => {
  const [home, newContent] = await Promise.all([
    read('src/screens/home.mjs'),
    read('src/screens/new-content.mjs')
  ]);
  assert.equal(HOME_ITEMS[1], 'new-content');
  assert.doesNotMatch(home, /newResources|sectionHeading|item\.title/);
  assert.match(newContent, /resources[\s\S]*isNew/);
  assert.match(newContent, /preferences/);
});

test('first run requires an explicit Spanish or English language choice', () => {
  const fresh = createPreferencesStore({ storage: memoryStorage() });
  fresh.load();
  assert.equal(fresh.needsLanguageChoice(), true);
  fresh.save({ lang: 'es' });
  assert.equal(fresh.needsLanguageChoice(), false);
});

test('mobile shell has no redundant skip link and startup routes through language choice', async () => {
  const [index, app] = await Promise.all([
    read('src/index.html'),
    read('src/app.mjs')
  ]);
  assert.doesNotMatch(index, /skip-link|Saltar al contenido principal/i);
  assert.match(app, /needsLanguageChoice\(\)/);
  assert.match(app, /renderLanguageChoice/);
});

test('late content loading preserves or restores the start heading focus', async () => {
  const app = await read('src/app.mjs');
  assert.match(app, /contentStore\.load\(\)[\s\S]*focusScreenHeading\(root\)/);
});

test('news and readable pages expose their language to TalkBack', async () => {
  const [actualidad, reader] = await Promise.all([
    read('src/screens/actualidad.mjs'),
    read('src/screens/reader.mjs')
  ]);
  assert.match(actualidad, /article\.lang\s*=/);
  assert.match(reader, /parent\.lang\s*=/);
});

test('video position selector moves in ten percent steps while minute buttons remain fixed', async () => {
  const player = await read('src/screens/video-player.mjs');
  assert.match(player, /const\s+SEEK_SECONDS\s*=\s*30/);
  assert.match(player, /position\.step\s*=\s*String\([^\n]*duration[^\n]*0\.1/);
  assert.doesNotMatch(player, /position\.step\s*=\s*['"]1['"]/);
});


test('home remembers the last focused entry and restores it when the WebView regains focus', async () => {
  const [app, focus] = await Promise.all([
    read('src/app.mjs'),
    read('src/core/focus.mjs')
  ]);
  assert.match(app, /lastHomeFocusId/);
  assert.match(app, /addEventListener\('focusin'/);
  assert.match(app, /window\.addEventListener\('blur'/);
  assert.match(app, /window\.addEventListener\('focus'/);
  assert.match(app, /restoreRememberedFocus/);
  assert.match(focus, /rememberFocusedId/);
});

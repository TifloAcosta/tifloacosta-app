import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { text } from '../src/core/i18n.mjs';
import { HOME_ITEMS } from '../src/screens/home.mjs';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('home uses the approved compact order', () => {
  assert.deepEqual(HOME_ITEMS, [
    'actualidad',
    'search',
    'library',
    'favorites',
    'videos',
    'book',
    'podcast',
    'contact',
    'settings'
  ]);
});

test('home and secondary screen labels exist in Spanish and English', () => {
  for (const lang of ['es', 'en']) {
    assert.ok(text(lang, 'app.title'));
    assert.ok(text(lang, 'nav.back'));
    for (const key of HOME_ITEMS) {
      assert.ok(text(lang, `home.${key}`), `Missing ${lang} home.${key}`);
      assert.ok(text(lang, `screen.${key}`), `Missing ${lang} screen.${key}`);
    }
  }
});

test('home module does not leak podcast platforms, social URLs or setting controls onto the start screen', async () => {
  const source = await read('src/screens/home.mjs');
  for (const forbidden of [
    'spotify.com',
    'podcasts.apple.com',
    'ivoox.com',
    'podimo.com',
    'radio.es',
    'wa.me',
    'instagram.com',
    'facebook.com',
    'setting-text-size',
    'setting-theme',
    'setting-spacing'
  ]) {
    assert.equal(source.includes(forbidden), false, `Home must not expose ${forbidden}`);
  }
});

test('secondary mobile screens use a back control and accessible screen heading without autofocus', async () => {
  const files = ['actualidad.mjs', 'library.mjs', 'videos.mjs', 'book.mjs', 'podcast.mjs', 'contact.mjs', 'settings.mjs'];
  for (const file of files) {
    const source = await read(`src/screens/${file}`);
    assert.match(source, /addScreenHeader\(/, `${file} must use the shared back + heading header`);
    assert.doesNotMatch(source, /autofocus/i, `${file} must not steal focus`);
  }
});

test('settings screen does not expose PWA install or manual update controls', async () => {
  const source = await read('src/screens/settings.mjs');
  assert.doesNotMatch(source, /install app|instalar la app|app-update|manual update|actualizar aplicación/i);
});

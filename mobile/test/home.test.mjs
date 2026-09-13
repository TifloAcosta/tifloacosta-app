import assert from 'node:assert/strict';
import test from 'node:test';
import { HOME_ITEMS, HOME_EXTERNAL_URLS } from '../src/screens/home.mjs';
import { text } from '../src/core/i18n.mjs';
import { readFile } from 'node:fs/promises';

test('home uses the approved compact order', () => {
  assert.deepEqual(HOME_ITEMS, ['actualidad','search','library','favorites','videos','book','podcast','contact','settings']);
});

test('home labels exist in Spanish and English', () => {
  for (const lang of ['es', 'en']) {
    for (const key of HOME_ITEMS) assert.ok(text(lang, `home.${key}`));
    for (const key of HOME_ITEMS) assert.ok(text(lang, `screen.${key}.title`));
  }
});

test('home exposes no podcast, social or settings detail', () => {
  assert.deepEqual(HOME_EXTERNAL_URLS, []);
  const homeSource = String(HOME_ITEMS);
  assert.doesNotMatch(homeSource, /spotify|ivoox|instagram|whatsapp|contrast|spacing/i);
});

test('screen sources contain no autofocus and home contains no external-detail urls', async () => {
  const names = ['home','actualidad','library','videos','book','podcast','contact','settings'];
  for (const name of names) {
    const source = await readFile(new URL(`../src/screens/${name}.mjs`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /autofocus/i, `${name} must not autofocus`);
  }
  const home = await readFile(new URL('../src/screens/home.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(home, /spotify|ivoox|instagram|wa\.me|setting-language|setting-theme/i);
});

test('contact labels are localized instead of hard-coded in Spanish', async () => {
  assert.equal(text('es', 'contact.email'), 'Correo electrónico');
  assert.equal(text('en', 'contact.email'), 'Email');
  const source = await readFile(new URL('../src/screens/contact.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\['Correo electrónico'/);
  assert.match(source, /t\(`contact\.\$\{labelKey\}`\)/);
});

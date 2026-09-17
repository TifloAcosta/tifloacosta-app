import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('composition root registers every approved mobile screen exactly as a dedicated route', async () => {
  const app = await read('src/app.mjs');
  for (const route of ['home','actualidad','search','library','favorites','videos','book','podcast','contact','settings']) {
    assert.match(app, new RegExp(`case ['"]${route}['"]`));
  }
  assert.doesNotMatch(app, /renderPlaceholder/);
});

test('mobile document keeps one native main landmark and never steals initial focus', async () => {
  const html = await read('src/index.html');
  assert.equal((html.match(/<main\b/gi) || []).length, 1);
  assert.doesNotMatch(html, /autofocus/i);
  assert.doesNotMatch(html, /aria-role|role=["']main["']/i);
  assert.match(html, /href=["']#app["']/i);
});

test('startup keeps preferences before first render and remote content refresh after Home starts', async () => {
  const app = await read('src/app.mjs');
  const applyPreferences = app.indexOf('applyPreferences(document.documentElement');
  const startHome = app.indexOf("router.start('home')");
  const loadContent = app.indexOf('contentStore.load()');
  assert.ok(applyPreferences >= 0 && startHome > applyPreferences, 'preferences must be applied before Home starts');
  assert.ok(loadContent > startHome, 'remote content must load after Home is already rendered');
  assert.match(app, /if \(!textInputIsActive\(\)\) render\(router\.current\(\)\)/);
});

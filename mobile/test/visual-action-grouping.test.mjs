import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('Actualidad groups source share and favorite actions with reusable spacing', async () => {
  const source = await read('src/screens/actualidad.mjs');

  assert.match(source, /const actions = document\.createElement\('div'\)/);
  assert.match(source, /actions\.className = 'action-group'/);
  assert.match(source, /addExternalLink\(actions,/);
  assert.match(source, /addShareButton\(actions,/);
  assert.match(source, /addFavoriteButton\(actions,/);
  assert.match(source, /article\.append\(actions\)/);
});

test('Contact separates direct contact from social networks into accessible sections', async () => {
  const source = await read('src/screens/contact.mjs');

  assert.match(source, /Contacto directo/);
  assert.match(source, /Direct contact/);
  assert.match(source, /Redes sociales/);
  assert.match(source, /Social networks/);
  assert.match(source, /document\.createElement\('section'\)/);
  assert.match(source, /section\.className = 'content-card section-stack'/);
  assert.match(source, /actions\.className = 'screen-actions'/);
  assert.match(source, /document\.createElement\('h2'\)/);
});

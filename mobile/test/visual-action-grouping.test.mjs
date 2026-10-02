import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('Actualidad keeps list actions minimal and leaves the original source inside the reader', async () => {
  const [source, reader] = await Promise.all([
    read('src/screens/actualidad.mjs'),
    read('src/screens/reader.mjs')
  ]);

  assert.match(source, /const actions = document\.createElement\('div'\)/);
  assert.match(source, /actions\.className = 'action-group'/);
  assert.match(source, /addFavoriteButton\(actions,/);
  assert.doesNotMatch(source, /addExternalLink\(actions,/);
  assert.doesNotMatch(source, /addShareButton\(actions,/);
  assert.match(reader, /original\.textContent = t\('actualidad\.original'\)/);
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

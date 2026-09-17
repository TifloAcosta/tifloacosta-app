import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const require = createRequire(import.meta.url);
const core = require('../actualidad-core.js');
const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('Actualidad landing does not request heavy catalogs until their section is opened', () => {
  assert.equal(typeof core.catalogForActualidadRoute, 'function');
  assert.equal(core.catalogForActualidadRoute(''), null);
  assert.equal(core.catalogForActualidadRoute('#actualidad-home'), null);
  assert.equal(core.catalogForActualidadRoute('#news-browser'), 'news');
  assert.equal(core.catalogForActualidadRoute('#apps-browser'), 'apps');
  assert.equal(core.catalogForActualidadRoute('#media-browser'), 'media');
  assert.equal(core.catalogForActualidadRoute('#media-accessibility'), 'media');
  assert.equal(core.catalogForActualidadRoute('#media-technology'), 'media');
});

test('Actualidad multimedia creates a video iframe only after the user activates Play', async () => {
  const source = await read('actualidad-media.js');
  const handler = source.indexOf("button.addEventListener('click'");
  const iframe = source.indexOf("document.createElement('iframe')");
  const src = source.indexOf('frame.src = item.embedUrl');
  assert.ok(handler >= 0, 'Play click handler must exist');
  assert.ok(iframe > handler, 'iframe must be created inside or after the Play interaction');
  assert.ok(src > handler, 'iframe src must be assigned only after the Play interaction');
});

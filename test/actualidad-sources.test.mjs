import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sources = JSON.parse(await readFile(new URL('../actualidad-sources.json', import.meta.url), 'utf8'));
const byId = new Map(sources.map(source => [source.id, source]));

test('AppleVis app and blog feeds have distinct visible source names', () => {
  assert.equal(byId.get('applevis-apps')?.name, 'AppleVis Apps');
  assert.equal(byId.get('applevis-blog')?.name, 'AppleVis Blog');
});

test('approved Spanish Actualidad sources are enabled with dated feed endpoints', () => {
  for (const id of ['tecnoconocimiento-accesible', 'accytec', 'nvda-es']) {
    const source = byId.get(id);
    assert.ok(source, `${id} must be configured`);
    assert.equal(source.enabled, true);
    assert.equal(source.lang, 'es');
    assert.match(source.feedUrl, /^https:\/\//);
    assert.ok(Array.isArray(source.categories) && source.categories.length > 0);
  }
});

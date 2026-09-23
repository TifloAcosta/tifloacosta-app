import assert from 'node:assert/strict';
import test from 'node:test';
import * as loader from '../mobile/src/core/readable-loader.mjs';

test('Actualidad can build the reader from the clean cached body', () => {
  assert.equal(typeof loader.readablePageFromNewsItem, 'function');

  const page = loader.readablePageFromNewsItem({
    title: 'Novedades en TCA Doc 1.0',
    body: 'Primer párrafo limpio.\n\nSegundo párrafo.',
    sourceName: 'TecnoAccesible',
    originalUrl: 'https://example.com/tca-doc'
  });

  assert.equal(page.title, 'Novedades en TCA Doc 1.0');
  assert.equal(page.source, 'TecnoAccesible');
  assert.equal(page.url, 'https://example.com/tca-doc');
  assert.equal(page.blocks[0].parts[0].text, 'Primer párrafo limpio.');
});

test('cached reader helper yields no page when the feed has no body', () => {
  assert.equal(typeof loader.readablePageFromNewsItem, 'function');
  assert.equal(loader.readablePageFromNewsItem({ title: 'Sin cuerpo' }), null);
});

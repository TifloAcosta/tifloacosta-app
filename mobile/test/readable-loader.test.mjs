import assert from 'node:assert/strict';
import test from 'node:test';
import { loadReadableTarget } from '../src/core/readable-loader.mjs';

const resolveDownload = url => ({ provider: url.includes('.pdf') ? 'direct' : 'web' });

test('reclassifies a redirected YouTube target before reading', async () => {
  const result = await loadReadableTarget({
    url: 'https://short.test/x',
    resolveDownload,
    webFetch: async () => ({
      finalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      contentType: 'text/html',
      body: '<html></html>'
    })
  });
  assert.equal(result.kind, 'youtube');
  assert.equal(result.classification.videoId, 'dQw4w9WgXcQ');
});

test('reclassifies a redirected download before reading', async () => {
  const result = await loadReadableTarget({
    url: 'https://short.test/file',
    resolveDownload,
    webFetch: async () => ({
      finalUrl: 'https://example.test/file.pdf',
      contentType: 'text/html',
      body: '<html></html>'
    })
  });
  assert.equal(result.kind, 'download');
  assert.equal(result.classification.url, 'https://example.test/file.pdf');
});

test('returns a safe readable model for a reliable article', async () => {
  const result = await loadReadableTarget({
    url: 'https://example.test/article',
    resolveDownload,
    webFetch: async () => ({
      finalUrl: 'https://example.test/article',
      contentType: 'text/html',
      body: '<article><h1>Título</h1><p>Primer párrafo suficientemente largo con información útil y concreta para superar el umbral de lectura fiable sin ruido.</p><p>Segundo párrafo suficientemente largo que completa el contenido principal de la página para una lectura accesible.</p></article>'
    })
  });
  assert.equal(result.kind, 'readable');
  assert.equal(result.page.title, 'Título');
  assert.equal(result.classification.kind, 'web');
});

test('marks insufficient content as unreliable instead of fabricating a reading', async () => {
  const result = await loadReadableTarget({
    url: 'https://example.test/empty',
    resolveDownload,
    webFetch: async () => ({
      finalUrl: 'https://example.test/empty',
      contentType: 'text/html',
      body: '<html><head><title>Vacío</title></head><body><nav>Menu</nav></body></html>'
    })
  });
  assert.equal(result.kind, 'unreliable');
  assert.equal(result.page.reliable, false);
});

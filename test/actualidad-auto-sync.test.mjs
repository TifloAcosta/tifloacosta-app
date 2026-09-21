import assert from 'node:assert/strict';
import test from 'node:test';
import { syncActualidad } from '../scripts/sync-actualidad.mjs';

const NOW = new Date('2026-09-19T01:00:00Z');
const sources = [{ id: 'general', name: 'General', homepage: 'https://example.com/', feedUrl: 'https://example.com/feed.xml', lang: 'en', categories: ['tecnologia-accesibilidad'], enabled: true }];
const rss = `<?xml version="1.0"?><rss><channel><item><title>Accessibility update</title><link>https://example.com/story</link><pubDate>Sat, 19 Sep 2026 00:00:00 GMT</pubDate><description>Important accessibility change.</description></item></channel></rss>`;
const response = { ok: true, status: 200, text: async () => rss };

test('sync keeps its existing source-only behavior when no automatic editor is supplied', async () => {
  const result = await syncActualidad({ sources, editorial: [], fetchFn: async () => response, now: NOW });
  assert.equal(result.stories.length, 1);
  assert.equal(result.stories[0].editorialState, 'source-only');
  assert.equal(result.automaticResult, null);
});

test('sync fetches the article page and stores only its readable text when the feed has no body', async () => {
  const articleHtml = `
    <html><body>
      <header>Site header and navigation</header>
      <main>
        <article>
          <p>First useful article paragraph with enough detail for a clean reading view.</p>
          <figure><img src="image.jpg"><figcaption>Image caption</figcaption></figure>
          <p>Second useful article paragraph with the practical information readers need.</p>
          <aside>Recommended content</aside>
        </article>
      </main>
      <footer>Site footer</footer>
    </body></html>`;

  const fetchFn = async url => {
    if (url === 'https://example.com/feed.xml') return { ok: true, status: 200, text: async () => rss };
    if (url === 'https://example.com/story') return { ok: true, status: 200, text: async () => articleHtml };
    throw new Error(`Unexpected URL ${url}`);
  };

  const result = await syncActualidad({ sources, editorial: [], fetchFn, now: NOW });
  assert.equal(
    result.stories[0].locales.en.body,
    'First useful article paragraph with enough detail for a clean reading view.\n\nSecond useful article paragraph with the practical information readers need.'
  );
  assert.doesNotMatch(result.stories[0].locales.en.body, /header|Image|Recommended|footer/i);
});

test('automatic editorial output is merged into the public feed in the same synchronization run', async () => {
  let received = [];
  const automaticEditorial = async stories => {
    received = stories;
    return {
      editorial: [{
        id: stories[0].id,
        originalUrl: stories[0].originalUrl,
        editorialState: 'adapted',
        locales: {
          es: { title: 'Actualización de accesibilidad', summary: 'Resumen', body: 'Adaptación de TifloAcosta basada en la información de la fuente original.\n\nTexto adaptado.' },
          en: { title: 'Accessibility update', summary: 'Summary', body: 'TifloAcosta adaptation based on information from the original source.\n\nAdapted text.' }
        }
      }],
      state: { version: 1, stories: {} },
      stats: { evaluated: 1, adapted: 1 }
    };
  };

  const result = await syncActualidad({ sources, editorial: [], fetchFn: async () => response, now: NOW, automaticEditorial });
  assert.equal(received.length, 1);
  assert.equal(result.stories[0].editorialState, 'adapted');
  assert.equal(result.stories[0].locales.es.title, 'Actualización de accesibilidad');
  assert.equal(result.automaticResult.stats.adapted, 1);
});

test('an automatic-editor failure falls back to the source feed instead of breaking news', async () => {
  const result = await syncActualidad({
    sources,
    editorial: [],
    fetchFn: async () => response,
    now: NOW,
    automaticEditorial: async () => { throw new Error('AI unavailable'); }
  });
  assert.equal(result.stories.length, 1);
  assert.equal(result.stories[0].editorialState, 'source-only');
  assert.match(result.automaticError, /AI unavailable/);
});

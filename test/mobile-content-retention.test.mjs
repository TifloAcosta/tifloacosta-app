import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMobileContent } from '../scripts/build-mobile-content.mjs';

function newsItem({ id, lang = 'es', publishedAt }) {
  return {
    id,
    lang,
    title: `Noticia ${id}`,
    summary: `Resumen ${id}`,
    body: '',
    sourceName: `Medio ${id}`,
    originalUrl: `https://example.com/${id}`,
    publishedAt,
    categories: ['Accesibilidad']
  };
}

test('mobile Actualidad keeps only the latest 10 days and sorts newest first regardless of input order', () => {
  const feed = buildMobileContent({
    news: [
      newsItem({ id: 'older-in-window', publishedAt: '2026-09-15T10:00:00.000Z' }),
      newsItem({ id: 'newest', publishedAt: '2026-09-23T17:45:00.000Z' }),
      newsItem({ id: 'expired', publishedAt: '2026-09-12T23:59:59.000Z' }),
      newsItem({ id: 'middle', publishedAt: '2026-09-20T08:30:00.000Z' })
    ],
    generatedAt: '2026-09-23T18:00:00.000Z'
  });

  assert.deepEqual(feed.news.map(item => item.sourceId), [
    'newest',
    'middle',
    'older-in-window'
  ]);
});

test('mobile Actualidad caps the retained background at 60 stories per language', () => {
  const generatedAt = '2026-09-23T18:00:00.000Z';
  const news = [];

  for (const lang of ['es', 'en']) {
    for (let index = 0; index < 65; index += 1) {
      const minute = String(index).padStart(2, '0');
      news.push(newsItem({
        id: `${lang}-${index}`,
        lang,
        publishedAt: `2026-09-23T17:${minute}:00.000Z`
      }));
    }
  }

  const feed = buildMobileContent({ news, generatedAt });
  const es = feed.news.filter(item => item.lang === 'es');
  const en = feed.news.filter(item => item.lang === 'en');

  assert.equal(es.length, 60);
  assert.equal(en.length, 60);
  assert.equal(es[0].sourceId, 'es-59');
  assert.equal(en[0].sourceId, 'en-59');
  assert.equal(es.at(-1).sourceId, 'es-0');
  assert.equal(en.at(-1).sourceId, 'en-0');
});

test('invalid publication dates never enter the mobile Actualidad feed', () => {
  const feed = buildMobileContent({
    news: [
      newsItem({ id: 'valid', publishedAt: '2026-09-23T12:00:00.000Z' }),
      newsItem({ id: 'invalid', publishedAt: 'not-a-date' })
    ],
    generatedAt: '2026-09-23T18:00:00.000Z'
  });

  assert.deepEqual(feed.news.map(item => item.sourceId), ['valid']);
});

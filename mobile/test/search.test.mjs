import assert from 'node:assert/strict';
import test from 'node:test';
import { searchContent } from '../src/core/search.mjs';

const content = {
  resources: [
    { kind: 'resource', id: 'r-es', lang: 'es', category: 'iPhone', title: 'Cámara inteligente', openUrl: 'https://example/r-es' },
    { kind: 'resource', id: 'r-en', lang: 'en', category: 'iPhone', title: 'Smart Camera', openUrl: 'https://example/r-en' }
  ],
  videos: [
    { kind: 'video', id: 'v1', title: 'VoiceOver y la cámara', description: 'Prueba práctica', excerpt: '', url: 'https://youtube/v1' }
  ],
  news: [
    { kind: 'news', id: 'n-es', lang: 'es', title: 'Nueva cámara accesible', summary: 'Un proyecto útil', category: 'Tecnología' },
    { kind: 'news', id: 'n-en', lang: 'en', title: 'Accessible camera project', summary: 'Useful project', category: 'Technology' }
  ]
};

test('global search ignores accents and case across supported content', () => {
  const results = searchContent(content, 'CAMARA', 'es');
  assert.ok(results.some(item => item.id === 'r-es'));
  assert.ok(results.some(item => item.id === 'v1'));
  assert.ok(results.some(item => item.id === 'n-es'));
});

test('global search filters localized resources and news but keeps videos', () => {
  const es = searchContent(content, 'camera', 'es');
  assert.equal(es.some(item => item.id === 'r-en'), false);
  assert.equal(es.some(item => item.id === 'n-en'), false);
  const en = searchContent(content, 'camera', 'en');
  assert.ok(en.some(item => item.id === 'r-en'));
  assert.ok(en.some(item => item.id === 'n-en'));
});

test('global search needs no category and returns deterministic result records', () => {
  const results = searchContent(content, 'cámara', 'es');
  assert.deepEqual(results.map(item => item.kind), ['resource', 'news', 'video']);
  assert.equal(results[0].route, 'library');
  assert.equal(results[0].source.id, 'r-es');
  assert.deepEqual(searchContent(content, '', 'es'), []);
});

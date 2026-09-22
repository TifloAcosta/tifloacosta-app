import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { searchContent } from '../src/core/search.mjs';

const content = {
  resources: [
    { kind: 'resource', id: 'r1', lang: 'es', title: 'Cámara inteligente', category: 'iPhone', openUrl: 'https://example.test/r1' },
    { kind: 'resource', id: 'r2', lang: 'en', title: 'Smart camera', category: 'iPhone', openUrl: 'https://example.test/r2' }
  ],
  videos: [
    { kind: 'video', id: 'v1', title: 'VoiceOver y cámara', description: 'Demostración práctica', url: 'https://example.test/v1' }
  ],
  news: [
    { kind: 'news', id: 'n1', lang: 'es', title: 'Nueva aplicación accesible', summary: 'Una cámara para Android', originalUrl: 'https://example.test/n1' },
    { kind: 'news', id: 'n2', lang: 'en', title: 'Accessible app update', summary: 'Camera improvements', originalUrl: 'https://example.test/n2' }
  ],
  apps: [
    { kind: 'app', id: 'a1', lang: 'es', title: 'App accesible', summary: 'Cámara inclusiva', originalUrl: 'https://example.test/a1' }
  ],
  media: [
    { kind: 'media', id: 'm1', lang: 'es', title: 'Vídeo de tecnología', summary: 'Cámara y accesibilidad', originalUrl: 'https://example.test/m1' }
  ]
};

test('search ignores accents and case across all global content collections', () => {
  const results = searchContent(content, 'CAMARA', 'es');
  assert.deepEqual(results.map(item => item.id), ['a1', 'r1', 'n1', 'v1', 'm1']);
});

test('search filters language-specific content but keeps language-neutral catalog videos', () => {
  const spanish = searchContent(content, 'camera', 'es');
  assert.equal(spanish.some(item => item.id === 'r2'), false);
  assert.equal(spanish.some(item => item.id === 'n2'), false);

  const english = searchContent(content, 'camera', 'en');
  assert.equal(english.some(item => item.id === 'r1'), false);
  assert.equal(english.some(item => item.id === 'n1'), false);
  assert.equal(english.some(item => item.id === 'r2'), true);
  assert.equal(english.some(item => item.id === 'n2'), true);
});

test('search results expose stable kind, route, subtitle and source references', () => {
  const results = searchContent(content, 'voiceover', 'es');
  assert.deepEqual(results[0], {
    kind: 'video',
    id: 'v1',
    title: 'VoiceOver y cámara',
    subtitle: 'Demostración práctica',
    route: 'videos',
    source: content.videos[0]
  });
});

test('blank queries return no results without requiring category or filters', () => {
  assert.deepEqual(searchContent(content, '', 'es'), []);
  assert.deepEqual(searchContent(content, '   ', 'es'), []);
});

test('title-start matches sort before descriptive matches with deterministic title ordering', () => {
  const values = {
    resources: [
      { id: 'b', lang: 'es', title: 'Zeta', category: 'Cámara' },
      { id: 'a', lang: 'es', title: 'Cámara B' },
      { id: 'c', lang: 'es', title: 'Cámara A' }
    ],
    videos: [], news: []
  };
  assert.deepEqual(searchContent(values, 'camara', 'es').map(item => item.id), ['c', 'a', 'b']);
});

test('search screen uses the single global field and delegates exact result activation', async () => {
  const source = await readFile(new URL('../src/screens/search.mjs', import.meta.url), 'utf8');
  assert.match(source, /type\s*=\s*['"]search['"]/);
  assert.match(source, /htmlFor\s*=\s*input\.id/);
  assert.match(source, /ariaLive\s*=\s*['"]polite['"]/);
  assert.match(source, /result-\$\{result\.kind\}-\$\{result\.id\}/);
  assert.match(source, /onOpenResult\(result,\s*button\.id\)/);
  assert.doesNotMatch(source, /router\.navigate\(result\.route/);
  assert.doesNotMatch(source, /autofocus/i);
});

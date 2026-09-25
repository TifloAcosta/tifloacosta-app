import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const core = require('../app-core.js');
const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('new resources rotate through the three visible news slots by recency', () => {
  const resources = [
    { id: 'old-third', title: 'Old third', category: 'Tests', lang: 'es', new: true, newsDate: '2026-09-22T10:00:00Z' },
    { id: 'third', title: 'Third', category: 'Tests', lang: 'es', new: true, newsDate: '2026-09-23T10:00:00Z' },
    { id: 'second', title: 'Second', category: 'Tests', lang: 'es', new: true, newsDate: '2026-09-24T10:00:00Z' },
    { id: 'newest', title: 'Newest', category: 'Tests', lang: 'es', new: true, newsDate: '2026-09-25T10:00:00Z' }
  ];

  const selected = resources
    .filter(item => item.new)
    .sort(core.compareNewsItems)
    .slice(0, 3)
    .map(item => item.id);

  assert.deepEqual(selected, ['newest', 'second', 'third']);
  assert.ok(resources.some(item => item.id === 'old-third'));
});

test('videos and resources share the three visible news slots by date', () => {
  const resources = [
    { id: 'resource-second', title: 'Resource second', category: 'Tests', new: true, newsDate: '2026-09-24T10:00:00Z' },
    { id: 'resource-third', title: 'Resource third', category: 'Tests', new: true, newsDate: '2026-09-23T10:00:00Z' },
    { id: 'resource-old', title: 'Resource old', category: 'Tests', new: true, newsDate: '2026-09-22T10:00:00Z' },
    { id: 'resource-not-new', title: 'Not a novelty', category: 'Tests', new: false, newsDate: '2026-09-26T10:00:00Z' }
  ];
  const videos = [
    { id: 'video-newest', title: 'Video newest', publishedAt: '2026-09-25T10:00:00Z', url: 'https://www.youtube.com/watch?v=video-newest' },
    { id: 'video-old', title: 'Video old', publishedAt: '2026-09-21T10:00:00Z', url: 'https://www.youtube.com/watch?v=video-old' }
  ];

  const selected = core.selectNewsItems(resources, videos, 'Vídeo', 3);

  assert.deepEqual(selected.map(item => item.id), ['youtube-video-newest', 'resource-second', 'resource-third']);
  assert.equal(selected[0].newsKind, 'video');
  assert.equal(selected[0].category, 'Vídeo');
  assert.equal(selected[0].newsDate, '2026-09-25T10:00:00Z');
  assert.equal(selected[0].url, 'https://www.youtube.com/watch?v=video-newest');
  assert.ok(resources.some(item => item.id === 'resource-old'));
  assert.ok(videos.some(item => item.id === 'video-old'));
});

test('current news uses resource incorporation dates instead of fixed ids', async () => {
  const [catalogSource, supplementalSource] = await Promise.all([
    read('data.js'),
    read('medical-studies.js')
  ]);
  const context = { window: {}, document: undefined };
  vm.runInNewContext(catalogSource, context);
  vm.runInNewContext(supplementalSource, context);
  const resources = context.window.TIFLO_RESOURCES;

  const expectedByLanguage = {
    es: [
      'es-rehabilitacion-autonomia-2026',
      'es-1wfRfY4IumYSh7At5iaoizBZTSoQhKhdc',
      'es-estudio-medico-calor-2026'
    ],
    en: [
      'en-rehabilitation-independence-2026',
      'en-1C317Eva0eE8ekQ9HqmXIvzY1-Zxty1nC',
      'en-medical-study-heat-2026'
    ]
  };

  for (const lang of ['es', 'en']) {
    const selected = resources
      .filter(item => item.lang === lang && item.new)
      .sort(core.compareNewsItems)
      .slice(0, 3)
      .map(item => item.id);

    assert.deepEqual([...selected], expectedByLanguage[lang]);
  }
});

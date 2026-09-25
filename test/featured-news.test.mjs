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

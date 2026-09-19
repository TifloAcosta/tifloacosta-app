import assert from 'node:assert/strict';
import test from 'node:test';
import { runAutomaticEditorial } from '../scripts/actualidad-auto-adapt.mjs';

const NOW = new Date('2026-09-19T01:00:00Z');
const config = {
  model: 'gpt-5.6-luna', maxEvaluationsPerRun: 6, maxAdaptationsPerRun: 2,
  maxContrastSearchesPerStory: 1, maxAttempts: 3, retryAfterMinutes: 60, candidateMaxAgeDays: 14
};
const sources = [{ id: 'general', name: 'General', lang: 'en', editorialClass: 'generalist', adaptationPolicy: 'clean-reader' }];
const story = overrides => ({
  id: 'story-1', sourceId: 'general', sourceName: 'General', sourceUrl: 'https://example.com/', originalUrl: 'https://example.com/story-1',
  lang: 'en', title: 'Major accessibility update for screen reader users', summary: 'The source confirms an important accessibility improvement for screen reader users.',
  publishedAt: '2026-09-19T00:00:00.000Z', categories: ['tecnologia-accesibilidad'], editorialState: 'source-only', body: '', featuredRank: null,
  ...overrides
});
const generation = id => ({
  locales: {
    es: { title: `Mejora de accesibilidad ${id}`, summary: 'Una mejora importante de accesibilidad para lectores de pantalla.', body: 'La fuente confirma una mejora importante de accesibilidad para usuarios de lectores de pantalla. La adaptación resume el alcance práctico sin añadir datos ajenos a la información disponible.' },
    en: { title: `Accessibility improvement ${id}`, summary: 'An important accessibility improvement for screen reader users.', body: 'The reported change is aimed at people who use screen readers and is presented as an important accessibility improvement. This adaptation summarizes the practical scope without adding facts beyond the available information.' }
  },
  categories: ['tecnologia-accesibilidad'], featuredRank: null
});

function adaptingClient(overrides = {}) {
  return {
    evaluateStory: async () => ({ decision: 'adapt', interest: 'very-high', practicalImpact: 'Material accessibility impact', sourceReliability: 'high', needsContrast: false, reasons: ['Important'] }),
    adaptStory: async item => generation(item.id),
    contrastStory: async () => ({ confirmed: true, summary: 'Confirmed by another reliable source', sourceUrls: ['https://confirm.example/item'] }),
    ...overrides
  };
}

test('a source-only evaluation is persisted in state and not written as an adaptation', async () => {
  const aiClient = adaptingClient({ evaluateStory: async () => ({ decision: 'source-only', interest: 'high', practicalImpact: 'Limited', sourceReliability: 'high', needsContrast: false, reasons: ['Not exceptional'] }) });
  const result = await runAutomaticEditorial({ stories: [story({})], sources, editorial: [], state: { version: 1, stories: {} }, aiClient, config, guidelines: 'Guide', now: NOW });
  assert.deepEqual(result.editorial, []);
  assert.equal(result.state.stories['story-1'].status, 'source-only');
  assert.equal(result.state.stories['story-1'].attempts, 1);
  assert.equal(result.stats.evaluated, 1);
  assert.equal(result.stats.adapted, 0);
});

test('a very-high-interest story is adapted into a protected bilingual editorial record', async () => {
  const result = await runAutomaticEditorial({ stories: [story({})], sources, editorial: [], state: { version: 1, stories: {} }, aiClient: adaptingClient(), config, guidelines: 'Guide', now: NOW });
  assert.equal(result.editorial.length, 1);
  assert.equal(result.editorial[0].editorialState, 'adapted');
  assert.ok(result.editorial[0].locales.es.body);
  assert.ok(result.editorial[0].locales.en.body);
  assert.equal(result.editorial[0].automation.generatedBy, 'actualidad-auto');
  assert.equal(result.state.stories['story-1'].status, 'adapted');
  assert.equal(result.stats.adapted, 1);
});

test('no more than two new adaptations are produced in one run', async () => {
  let adaptations = 0;
  const items = [1, 2, 3].map(index => story({ id: `story-${index}`, originalUrl: `https://example.com/story-${index}`, publishedAt: new Date(NOW.getTime() - index * 1000).toISOString() }));
  const client = adaptingClient({ adaptStory: async item => { adaptations += 1; return generation(item.id); } });
  const result = await runAutomaticEditorial({ stories: items, sources, editorial: [], state: { version: 1, stories: {} }, aiClient: client, config, guidelines: 'Guide', now: NOW });
  assert.equal(adaptations, 2);
  assert.equal(result.editorial.filter(item => item.editorialState === 'adapted').length, 2);
  assert.equal(result.editorial.filter(item => item.editorialState === 'selected').length, 1);
  assert.equal(result.stats.evaluated, 3);
});

test('a selected story uses at most one paid contrast when local corroboration is absent', async () => {
  let contrasts = 0;
  let evidence = '';
  const client = adaptingClient({
    evaluateStory: async () => ({ decision: 'adapt', interest: 'very-high', practicalImpact: 'Material', sourceReliability: 'medium', needsContrast: true, reasons: ['Needs confirmation'] }),
    contrastStory: async () => { contrasts += 1; return { confirmed: true, summary: 'Confirmed independently', sourceUrls: ['https://confirm.example/story'] }; },
    adaptStory: async (item, _guide, extra) => { evidence = extra; return generation(item.id); }
  });
  const result = await runAutomaticEditorial({ stories: [story({})], sources, editorial: [], state: { version: 1, stories: {} }, aiClient: client, config, guidelines: 'Guide', now: NOW });
  assert.equal(result.stats.adapted, 1);
  assert.equal(contrasts, 1);
  assert.match(evidence, /Confirmed independently/);
});

test('evaluation API failure leaves public editorial untouched and records a retryable failure', async () => {
  const client = adaptingClient({ evaluateStory: async () => { throw new Error('API unavailable'); } });
  const result = await runAutomaticEditorial({ stories: [story({})], sources, editorial: [], state: { version: 1, stories: {} }, aiClient: client, config, guidelines: 'Guide', now: NOW });
  assert.deepEqual(result.editorial, []);
  assert.equal(result.state.stories['story-1'].status, 'error');
  assert.equal(result.state.stories['story-1'].attempts, 1);
  assert.equal(result.stats.failed, 1);
});

test('manual editorial records are preserved and are never sent to the AI client', async () => {
  let evaluations = 0;
  const manual = [{ id: 'story-1', originalUrl: 'https://example.com/story-1', editorialState: 'withheld' }];
  const client = adaptingClient({ evaluateStory: async () => { evaluations += 1; throw new Error('should not run'); } });
  const result = await runAutomaticEditorial({ stories: [story({})], sources, editorial: manual, state: { version: 1, stories: {} }, aiClient: client, config, guidelines: 'Guide', now: NOW });
  assert.equal(evaluations, 0);
  assert.deepEqual(result.editorial, manual);
});

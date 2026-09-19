import assert from 'node:assert/strict';
import test from 'node:test';
import {
  automaticRecordHash,
  buildEditorialRecord,
  canRetryStory,
  findCorroboratingStory,
  isManualRecordProtected,
  selectEvaluationCandidates,
  sourceFingerprint,
  validateAdaptation
} from '../scripts/actualidad-auto-core.mjs';

const NOW = new Date('2026-09-19T01:00:00Z');
const config = {
  maxEvaluationsPerRun: 6,
  maxAttempts: 3,
  retryAfterMinutes: 60,
  candidateMaxAgeDays: 14
};

const source = overrides => ({
  id: 'general', name: 'General', lang: 'en', editorialClass: 'generalist', adaptationPolicy: 'clean-reader', ...overrides
});
const story = overrides => ({
  id: 'story-1', sourceId: 'general', sourceName: 'General', sourceUrl: 'https://example.com/', originalUrl: 'https://example.com/story-1',
  lang: 'en', title: 'New accessibility feature reaches screen reader users', summary: 'The update adds a documented accessibility feature for screen reader users.',
  publishedAt: '2026-09-19T00:00:00.000Z', categories: ['tecnologia-accesibilidad'], editorialState: 'source-only', body: '', featuredRank: null,
  ...overrides
});

const generation = {
  locales: {
    es: { title: 'Nueva función de accesibilidad', summary: 'La actualización incorpora una mejora documentada para usuarios de lectores de pantalla.', body: 'La fuente confirma una nueva función de accesibilidad dirigida a usuarios de lectores de pantalla. El cambio puede facilitar tareas cotidianas sin modificar la información esencial publicada.' },
    en: { title: 'New accessibility feature', summary: 'The update adds a documented improvement for screen reader users.', body: 'The source confirms a new accessibility feature for screen reader users. The change may make everyday tasks easier without changing the essential information reported by the source.' }
  }
};

test('candidate selection is conservative, recent and deterministic with an evaluation cap', () => {
  const stories = Array.from({ length: 8 }, (_, index) => story({
    id: `story-${index + 1}`,
    originalUrl: `https://example.com/story-${index + 1}`,
    publishedAt: new Date(NOW.getTime() - index * 60_000).toISOString()
  }));
  stories.push(story({ id: 'old', originalUrl: 'https://example.com/old', publishedAt: '2026-08-01T00:00:00.000Z' }));
  stories.push(story({ id: 'specialist', sourceId: 'specialist', originalUrl: 'https://specialist.example/item' }));

  const result = selectEvaluationCandidates({
    stories,
    sources: [source(), source({ id: 'specialist', editorialClass: undefined, adaptationPolicy: undefined })],
    editorial: [], state: { stories: {} }, now: NOW, config
  });

  assert.equal(result.length, 6);
  assert.deepEqual(result.map(item => item.id), ['story-1', 'story-2', 'story-3', 'story-4', 'story-5', 'story-6']);
});

test('official accessibility sources receive priority over generalist sources', () => {
  const result = selectEvaluationCandidates({
    stories: [story({ id: 'general-item' }), story({ id: 'official-item', sourceId: 'official', originalUrl: 'https://official.example/item' })],
    sources: [source(), source({ id: 'official', editorialClass: 'official-accessibility', translationPolicy: 'always-es' })],
    editorial: [], state: { stories: {} }, now: NOW, config
  });
  assert.equal(result[0].id, 'official-item');
});

test('retry waits at least one hour and stops after three attempts', () => {
  assert.equal(canRetryStory({ attempts: 1, lastAttemptAt: '2026-09-19T00:30:00Z' }, NOW, config), false);
  assert.equal(canRetryStory({ attempts: 1, lastAttemptAt: '2026-09-18T23:30:00Z' }, NOW, config), true);
  assert.equal(canRetryStory({ attempts: 3, lastAttemptAt: '2026-09-18T20:00:00Z' }, NOW, config), false);
});

test('local corroboration prefers another source with a closely matching title', () => {
  const primary = story();
  const corroborating = story({ id: 'story-2', sourceId: 'other', originalUrl: 'https://other.example/story', title: 'New accessibility feature reaches screen-reader users' });
  const unrelated = story({ id: 'story-3', sourceId: 'third', originalUrl: 'https://third.example/story', title: 'Laptop battery prices change this week' });
  assert.equal(findCorroboratingStory(primary, [primary, unrelated, corroborating])?.id, 'story-2');
});

test('complete bilingual adaptation validates when it stays inside source evidence', () => {
  const result = validateAdaptation(story(), generation);
  assert.equal(result.ok, true, result.errors?.join('; '));
});

test('incomplete bilingual adaptation is rejected', () => {
  const result = validateAdaptation(story(), { locales: { es: generation.locales.es } });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /English|en/i);
});

test('new unsupported numeric hard facts are rejected', () => {
  const invalid = structuredClone(generation);
  invalid.locales.es.body += ' La versión 99.7 llegará el 31/12/2035.';
  invalid.locales.en.body += ' Version 99.7 will arrive on 12/31/2035.';
  const result = validateAdaptation(story(), invalid);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /unsupported/i);
});

test('automatic hashes detect later manual edits', () => {
  const record = buildEditorialRecord(story(), generation, { model: 'gpt-5.6-luna', evaluatedAt: NOW.toISOString(), adaptedAt: NOW.toISOString() });
  assert.equal(record.automation.autoHash, automaticRecordHash(record));
  assert.equal(isManualRecordProtected(record), false);
  const edited = structuredClone(record);
  edited.locales.es.title = 'Título corregido manualmente';
  assert.equal(isManualRecordProtected(edited), true);
});

test('pre-existing editorial records without automation metadata are protected', () => {
  assert.equal(isManualRecordProtected({ id: 'story-1', editorialState: 'withheld' }), true);
});

test('central config uses the approved model and safety limits', async () => {
  const { readFile } = await import('node:fs/promises');
  const config = JSON.parse(await readFile(new URL('../actualidad-auto-config.json', import.meta.url), 'utf8'));
  assert.equal(config.model, 'gpt-5.6-luna');
  assert.equal(config.maxEvaluationsPerRun, 6);
  assert.equal(config.maxAdaptationsPerRun, 2);
  assert.equal(config.maxContrastSearchesPerStory, 1);
  assert.equal(config.maxAttempts, 3);
  assert.equal(config.retryAfterMinutes, 60);
});

test('a completed source-only evaluation is not repeated unless the source content changes', () => {
  const item = story();
  const state = { stories: { [item.id]: { status: 'source-only', attempts: 1, lastAttemptAt: '2026-09-18T20:00:00Z', sourceFingerprint: sourceFingerprint(item) } } };
  const same = selectEvaluationCandidates({ stories: [item], sources: [source()], editorial: [], state, now: NOW, config });
  assert.deepEqual(same, []);

  const changed = story({ summary: 'The source has materially updated the accessibility information.' });
  const afterChange = selectEvaluationCandidates({ stories: [changed], sources: [source()], editorial: [], state, now: NOW, config });
  assert.equal(afterChange.length, 1);
});

test('automatic editorial records prepend exactly one localized adaptation notice', () => {
  const record = buildEditorialRecord(story(), generation, { model: 'gpt-5.6-luna', evaluatedAt: NOW.toISOString(), adaptedAt: NOW.toISOString() });
  const esNotice = 'Adaptación de TifloAcosta basada en la información de la fuente original.';
  const enNotice = 'TifloAcosta adaptation based on information from the original source.';
  assert.equal(record.locales.es.body.split(esNotice).length - 1, 1);
  assert.equal(record.locales.en.body.split(enNotice).length - 1, 1);
  assert.ok(record.locales.es.body.startsWith(`${esNotice}\n\n`));
  assert.ok(record.locales.en.body.startsWith(`${enNotice}\n\n`));
});

test('an automatic adaptation can be reevaluated when the source content materially changes', () => {
  const original = story();
  const record = buildEditorialRecord(original, generation, { model: 'gpt-5.6-luna', evaluatedAt: NOW.toISOString(), adaptedAt: NOW.toISOString() });
  const state = { stories: { [original.id]: { status: 'adapted', attempts: 1, lastAttemptAt: '2026-09-18T20:00:00Z', sourceFingerprint: sourceFingerprint(original) } } };
  const changed = story({ summary: 'The publisher has changed the material description of this accessibility feature.' });
  const result = selectEvaluationCandidates({ stories: [changed], sources: [source()], editorial: [record], state, now: NOW, config });
  assert.equal(result.length, 1);
});

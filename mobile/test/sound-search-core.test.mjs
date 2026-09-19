import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SOUND_CATEGORIES,
  validateSearch,
  buildProviderQuery,
  normalizeSound,
  formatDuration,
  createSoundSearchClient
} from '../src/core/sound-search.mjs';

test('sound categories exactly match the Worker and web contract', () => {
  assert.deepEqual(Object.keys(SOUND_CATEGORIES), [
    'ringtones', 'notifications', 'alarms', 'phones', 'technology',
    'nature', 'animals', 'ambience', 'funny', 'games'
  ]);
});

test('search validation accepts term, category or both and rejects an empty search', () => {
  assert.equal(validateSearch('', '').ok, false);
  assert.deepEqual(validateSearch(' bell ', ''), { ok: true, term: 'bell', category: '' });
  assert.deepEqual(validateSearch('', 'animals'), { ok: true, term: '', category: 'animals' });
  assert.equal(validateSearch('', 'not-real').ok, false);
});

test('provider query combines free text with the stable category query', () => {
  assert.equal(buildProviderQuery('bell', 'notifications'), 'bell notification alert');
  assert.equal(buildProviderQuery('', 'animals'), 'animal');
  assert.equal(buildProviderQuery('owl', ''), 'owl');
});

test('sound normalization preserves missing metadata as null', () => {
  const sound = normalizeSound({ name: 'Bell', duration: null, size: undefined, tags: ['bell'] });
  assert.equal(sound.name, 'Bell');
  assert.equal(sound.duration, null);
  assert.equal(sound.size, null);
  assert.equal(sound.format, null);
  assert.deepEqual(sound.tags, ['bell']);
});

test('duration formatting never fabricates a value for missing metadata', () => {
  assert.equal(formatDuration(null), '');
  assert.equal(formatDuration(undefined), '');
  assert.equal(formatDuration(''), '');
  assert.equal(formatDuration(0), '0:00');
  assert.equal(formatDuration(65.2), '1:05');
});

test('sound client posts the combined query and normalizes valid items', async () => {
  const calls = [];
  const client = createSoundSearchClient({
    fetchFn: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            status: 'ok',
            provider: 'freesound',
            count: 1,
            items: [{ id: 7, name: 'Bell', provider: 'freesound', duration: 1.2, size: 1234 }]
          };
        }
      };
    }
  });

  const result = await client.search({ term: 'bell', category: 'notifications', page: 1 });
  assert.equal(calls[0].url, 'https://download.tifloacosta.com/sounds/search');
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    query: 'bell notification alert',
    category: 'notifications',
    page: 1
  });
  assert.equal(result.status, 'ok');
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].id, '7');
});

test('sound client returns a typed unavailable state and supports empty successful results', async () => {
  const unavailable = createSoundSearchClient({
    fetchFn: async () => ({
      ok: false,
      status: 422,
      json: async () => ({ status: 'error', code: 'provider_unavailable', message: 'Unavailable' })
    })
  });
  assert.deepEqual(await unavailable.search({ category: 'animals' }), {
    status: 'unavailable', code: 'provider_unavailable', items: []
  });

  const empty = createSoundSearchClient({
    fetchFn: async () => ({ ok: true, status: 200, json: async () => ({ status: 'ok', provider: 'freesound', items: [] }) })
  });
  const result = await empty.search({ term: 'owl' });
  assert.equal(result.status, 'ok');
  assert.deepEqual(result.items, []);
});

test('sound client maps malformed, network and aborted responses', async () => {
  const bad = createSoundSearchClient({
    fetchFn: async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad'); } })
  });
  await assert.rejects(() => bad.search({ term: 'bell' }), error => error.code === 'bad_response');

  const network = createSoundSearchClient({ fetchFn: async () => { throw new Error('offline'); } });
  await assert.rejects(() => network.search({ term: 'bell' }), error => error.code === 'service_unavailable');

  const aborted = createSoundSearchClient({
    fetchFn: async () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      throw error;
    }
  });
  await assert.rejects(() => aborted.search({ term: 'bell' }), error => error.code === 'timeout');
});

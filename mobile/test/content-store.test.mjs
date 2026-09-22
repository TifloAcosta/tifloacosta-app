import assert from 'node:assert/strict';
import test from 'node:test';
import { createContentStore } from '../src/core/content-store.mjs';

const validContent = (label = 'fresh', extras = {}) => ({
  schemaVersion: 1,
  generatedAt: '2026-09-17T09:00:00.000Z',
  resources: [{ id: label }],
  videos: [],
  news: [],
  ...extras
});

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
    value: key => values.get(key)
  };
}

test('fresh valid content wins and becomes the current cached version', async () => {
  const storage = memoryStorage();
  const payload = validContent('network', { apps: [], media: [] });
  const store = createContentStore({
    fetchFn: async () => ({ ok: true, json: async () => payload }),
    storage
  });
  const result = await store.load();
  assert.equal(result.status, 'fresh');
  assert.deepEqual(result.content, payload);
  assert.deepEqual(store.getCurrent(), payload);
  assert.deepEqual(JSON.parse(storage.value('tiflo-mobile-content-v1')), payload);
});

test('legacy mobile feed is enriched from current Actualidad apps and media feeds', async () => {
  const requests = [];
  const base = validContent('network');
  const responses = new Map([
    ['https://example.test/mobile-content.json', base],
    ['https://example.test/actualidad-apps.json', [{ id: 'a1', lang: 'es', title: 'App', originalUrl: 'https://example.test/app' }]],
    ['https://example.test/actualidad-media.json', [{ id: 'm1', originalLanguage: 'en', title: 'Media', originalUrl: 'https://example.test/media', platform: 'web' }]]
  ]);
  const store = createContentStore({
    url: 'https://example.test/mobile-content.json',
    fetchFn: async url => {
      requests.push(url);
      return { ok: true, json: async () => responses.get(url) };
    },
    storage: memoryStorage()
  });

  const result = await store.load();
  assert.deepEqual(requests, [
    'https://example.test/mobile-content.json',
    'https://example.test/actualidad-apps.json',
    'https://example.test/actualidad-media.json'
  ]);
  assert.equal(result.content.apps[0].kind, 'app');
  assert.equal(result.content.apps[0].title, 'App');
  assert.equal(result.content.media[0].kind, 'media');
  assert.equal(result.content.media[0].lang, 'en');
});

test('feed with integrated apps and media does not make fallback requests', async () => {
  const payload = validContent('network', { apps: [{ kind: 'app', id: 'a' }], media: [{ kind: 'media', id: 'm' }] });
  let calls = 0;
  const store = createContentStore({
    fetchFn: async () => { calls += 1; return { ok: true, json: async () => payload }; },
    storage: memoryStorage()
  });
  const result = await store.load();
  assert.equal(calls, 1);
  assert.deepEqual(result.content.apps, payload.apps);
  assert.deepEqual(result.content.media, payload.media);
});

test('optional Actualidad fallback failure does not discard a valid mobile feed', async () => {
  const payload = validContent('network');
  const store = createContentStore({
    url: 'https://example.test/mobile-content.json',
    fetchFn: async url => {
      if (url.endsWith('mobile-content.json')) return { ok: true, json: async () => payload };
      throw new Error('optional feed offline');
    },
    storage: memoryStorage()
  });
  const result = await store.load();
  assert.equal(result.status, 'fresh');
  assert.deepEqual(result.content.apps, []);
  assert.deepEqual(result.content.media, []);
});

test('network failure falls back to the last valid cache', async () => {
  const cached = validContent('cached');
  const storage = memoryStorage({ 'tiflo-mobile-content-v1': JSON.stringify(cached) });
  const store = createContentStore({ fetchFn: async () => { throw new Error('offline'); }, storage });
  const result = await store.load();
  assert.equal(result.status, 'cached');
  assert.deepEqual(result.content, cached);
  assert.deepEqual(store.getCurrent(), cached);
});

test('network failure without a valid cache returns an empty state', async () => {
  const store = createContentStore({ fetchFn: async () => { throw new Error('offline'); }, storage: memoryStorage() });
  const result = await store.load();
  assert.deepEqual(result, { status: 'empty', content: null });
  assert.equal(store.getCurrent(), null);
});

test('invalid network schema never overwrites a valid cache', async () => {
  const cached = validContent('cached');
  const storage = memoryStorage({ 'tiflo-mobile-content-v1': JSON.stringify(cached) });
  const store = createContentStore({
    fetchFn: async () => ({ ok: true, json: async () => ({ ...validContent('bad'), schemaVersion: 2 }) }),
    storage
  });
  const result = await store.load();
  assert.equal(result.status, 'cached');
  assert.deepEqual(result.content, cached);
  assert.deepEqual(JSON.parse(storage.value('tiflo-mobile-content-v1')), cached);
});

test('invalid cached payload is ignored and storage exceptions do not crash loading', async () => {
  const brokenStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const payload = validContent('network', { apps: [], media: [] });
  const store = createContentStore({
    fetchFn: async () => ({ ok: true, json: async () => payload }),
    storage: brokenStorage,
    url: 'https://example.test/mobile-content.json'
  });
  const result = await store.load();
  assert.equal(result.status, 'fresh');
  assert.deepEqual(result.content, payload);
});

test('non-ok HTTP responses use cache rather than treating error bodies as content', async () => {
  const cached = validContent('cached');
  const storage = memoryStorage({ 'tiflo-mobile-content-v1': JSON.stringify(cached) });
  const store = createContentStore({
    fetchFn: async () => ({ ok: false, status: 503, json: async () => validContent('wrong') }),
    storage
  });
  const result = await store.load();
  assert.equal(result.status, 'cached');
  assert.deepEqual(result.content, cached);
});

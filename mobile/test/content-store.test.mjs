import assert from 'node:assert/strict';
import test from 'node:test';
import { createContentStore, isValidContent } from '../src/core/content-store.mjs';

const valid = {
  schemaVersion: 1,
  generatedAt: '2026-09-13T18:00:00.000Z',
  resources: [],
  videos: [],
  news: []
};

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
    dump: () => Object.fromEntries(values)
  };
}

test('loads fresh valid content and caches it', async () => {
  const storage = memoryStorage();
  const store = createContentStore({
    storage,
    fetchFn: async () => ({ ok: true, json: async () => valid }),
    url: 'https://example.test/feed.json'
  });
  const result = await store.load();
  assert.equal(result.status, 'fresh');
  assert.deepEqual(result.content, valid);
  assert.deepEqual(store.getCurrent(), valid);
  assert.deepEqual(JSON.parse(storage.dump()['tiflo-mobile-content-v1']), valid);
});

test('falls back to valid cache when network fails', async () => {
  const storage = memoryStorage({ 'tiflo-mobile-content-v1': JSON.stringify(valid) });
  const store = createContentStore({
    storage,
    fetchFn: async () => { throw new Error('offline'); }
  });
  const result = await store.load();
  assert.equal(result.status, 'cached');
  assert.deepEqual(result.content, valid);
});

test('returns empty when neither network nor cache is usable', async () => {
  const store = createContentStore({
    storage: memoryStorage(),
    fetchFn: async () => { throw new Error('offline'); }
  });
  const result = await store.load();
  assert.equal(result.status, 'empty');
  assert.equal(result.content, null);
});

test('invalid schema never replaces a valid cache', async () => {
  const storage = memoryStorage({ 'tiflo-mobile-content-v1': JSON.stringify(valid) });
  const store = createContentStore({
    storage,
    fetchFn: async () => ({ ok: true, json: async () => ({ ...valid, schemaVersion: 2 }) })
  });
  const result = await store.load();
  assert.equal(result.status, 'cached');
  assert.deepEqual(result.content, valid);
  assert.deepEqual(JSON.parse(storage.dump()['tiflo-mobile-content-v1']), valid);
});

test('validation and blocked storage fail safely', async () => {
  assert.equal(isValidContent(valid), true);
  assert.equal(isValidContent({ ...valid, news: null }), false);
  const blocked = {
    getItem() { throw new Error('denied'); },
    setItem() { throw new Error('denied'); }
  };
  const store = createContentStore({
    storage: blocked,
    fetchFn: async () => ({ ok: true, json: async () => valid })
  });
  const result = await store.load();
  assert.equal(result.status, 'fresh');
  assert.deepEqual(result.content, valid);
});

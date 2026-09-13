import assert from 'node:assert/strict';
import test from 'node:test';
import { createFavoritesStore } from '../src/core/favorites.mjs';
import { resolveFavorites } from '../src/screens/favorites.mjs';

function memoryStorage(raw = null) {
  let value = raw;
  return {
    getItem: () => value,
    setItem: (_key, next) => { value = next; },
    current: () => value
  };
}

test('favorites persist stable references across content types', () => {
  const storage = memoryStorage();
  const store = createFavoritesStore(storage);
  const refs = [
    { kind: 'resource', id: 'r1' },
    { kind: 'video', id: 'v1' },
    { kind: 'news', id: 'n1' }
  ];
  for (const ref of refs) assert.equal(store.toggle(ref), true);
  assert.deepEqual(store.list(), refs);
  const restored = createFavoritesStore(storage);
  assert.deepEqual(restored.list(), refs);
});

test('toggle is idempotent by kind and id and removing missing refs is safe', () => {
  const store = createFavoritesStore(memoryStorage());
  const ref = { kind: 'resource', id: 'r1' };
  assert.equal(store.toggle(ref), true);
  assert.equal(store.has(ref), true);
  assert.equal(store.toggle(ref), false);
  assert.equal(store.has(ref), false);
  assert.equal(store.remove(ref), false);
  assert.deepEqual(store.list(), []);
});

test('favorites ignore corrupt and invalid stored records', () => {
  const corrupt = createFavoritesStore(memoryStorage('{bad json'));
  assert.deepEqual(corrupt.list(), []);

  const invalid = createFavoritesStore(memoryStorage(JSON.stringify([
    { kind: 'resource', id: 'r1', title: 'must not be stored' },
    { kind: 'other', id: 'x' },
    { kind: 'video', id: '' },
    { kind: 'news', id: 'n1' },
    { kind: 'news', id: 'n1' }
  ])));
  assert.deepEqual(invalid.list(), [
    { kind: 'resource', id: 'r1' },
    { kind: 'news', id: 'n1' }
  ]);
});

test('favorite resolution removes stale refs and returns current content', () => {
  const store = createFavoritesStore(memoryStorage(JSON.stringify([
    { kind: 'resource', id: 'r1' },
    { kind: 'video', id: 'missing' },
    { kind: 'news', id: 'n1' }
  ])));
  const content = {
    resources: [{ id: 'r1', title: 'Resource' }],
    videos: [],
    news: [{ id: 'n1', title: 'News' }]
  };
  const resolved = resolveFavorites(content, store);
  assert.deepEqual(resolved.map(item => `${item.kind}:${item.item.id}`), ['resource:r1', 'news:n1']);
  assert.deepEqual(store.list(), [{ kind: 'resource', id: 'r1' }, { kind: 'news', id: 'n1' }]);
});

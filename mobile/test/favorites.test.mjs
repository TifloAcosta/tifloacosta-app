import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createFavoritesStore, FAVORITES_KEY } from '../src/core/favorites.mjs';

function memoryStorage(initial = null) {
  const values = new Map();
  if (initial !== null) values.set(FAVORITES_KEY, initial);
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); }
  };
}

test('favorites persist only stable kind/id references across all supported content types', () => {
  const storage = memoryStorage();
  const store = createFavoritesStore(storage);
  store.toggle({ kind: 'resource', id: 'r1', title: 'must not be stored' });
  store.toggle({ kind: 'video', id: 'v1' });
  store.toggle({ kind: 'news', id: 'n1' });

  assert.deepEqual(store.list(), [
    { kind: 'resource', id: 'r1' },
    { kind: 'video', id: 'v1' },
    { kind: 'news', id: 'n1' }
  ]);
  assert.equal(storage.getItem(FAVORITES_KEY).includes('must not be stored'), false);
});

test('toggling the same reference removes it and never creates duplicates', () => {
  const store = createFavoritesStore(memoryStorage());
  assert.equal(store.toggle({ kind: 'resource', id: 'r1' }), true);
  assert.equal(store.toggle({ kind: 'resource', id: 'r1' }), false);
  assert.deepEqual(store.list(), []);
});

test('corrupt or unsupported stored favorites are discarded safely', () => {
  const corrupt = createFavoritesStore(memoryStorage('{broken'));
  assert.deepEqual(corrupt.list(), []);

  const mixed = createFavoritesStore(memoryStorage(JSON.stringify([
    { kind: 'resource', id: 'r1' },
    { kind: 'other', id: 'x' },
    { kind: 'video', id: '' },
    { kind: 'resource', id: 'r1' }
  ])));
  assert.deepEqual(mixed.list(), [{ kind: 'resource', id: 'r1' }]);
});

test('remove is idempotent and blocked storage never crashes favorites', () => {
  const blocked = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); }
  };
  const store = createFavoritesStore(blocked);
  assert.equal(store.remove({ kind: 'video', id: 'missing' }), false);
  assert.equal(store.toggle({ kind: 'video', id: 'v1' }), true);
  assert.equal(store.has({ kind: 'video', id: 'v1' }), true);
});

test('content screens expose explicit bilingual favorite actions rather than icon-only controls', async () => {
  const [library, videos, actualidad, favorites] = await Promise.all([
    readFile(new URL('../src/screens/library.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../src/screens/videos.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../src/screens/actualidad.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../src/screens/favorites.mjs', import.meta.url), 'utf8')
  ]);
  for (const source of [library, videos, actualidad]) {
    assert.match(source, /favoritesStore/);
    assert.match(source, /favorites\.(add|remove)/);
  }
  assert.match(favorites, /favoritesStore\.remove/);
  assert.doesNotMatch(`${library}\n${videos}\n${actualidad}\n${favorites}`, /autofocus/i);
});

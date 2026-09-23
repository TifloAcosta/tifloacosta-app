import assert from 'node:assert/strict';
import test from 'node:test';
import { createNewsSeenStore, NEWS_SEEN_KEY } from '../src/core/news-seen.mjs';

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: key => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => map.set(key, String(value)),
    dump: () => Object.fromEntries(map)
  };
}

const items = (...ids) => ids.map(id => ({ id, title: id }));

test('first comparison establishes baseline without declaring backlog new', () => {
  const storage = memoryStorage();
  const store = createNewsSeenStore(storage);
  assert.deepEqual([...store.compare(items('a', 'b'))], []);
  assert.deepEqual([...store.readBaseline()].sort(), ['a', 'b']);
});

test('later unseen IDs remain new until markSeen', () => {
  const storage = memoryStorage({ [NEWS_SEEN_KEY]: JSON.stringify(['a', 'b']) });
  const store = createNewsSeenStore(storage);
  assert.deepEqual([...store.compare(items('c', 'b', 'a'))], ['c']);
  assert.deepEqual([...store.compare(items('c', 'b', 'a'))], ['c']);
  assert.equal(store.markSeen(items('c', 'b', 'a')), true);
  assert.deepEqual([...store.compare(items('c', 'b', 'a'))], []);
});

test('duplicate and blank IDs do not create false new items', () => {
  const storage = memoryStorage({ [NEWS_SEEN_KEY]: JSON.stringify(['a']) });
  const store = createNewsSeenStore(storage);
  assert.deepEqual([...store.compare([{ id: '' }, {}, { id: 'a' }, { id: 'b' }, { id: 'b' }])], ['b']);
});

test('corrupt storage is treated as first use and replaced safely', () => {
  const storage = memoryStorage({ [NEWS_SEEN_KEY]: '{bad json' });
  const store = createNewsSeenStore(storage);
  assert.deepEqual([...store.compare(items('a', 'b'))], []);
  assert.deepEqual([...store.readBaseline()].sort(), ['a', 'b']);
});

test('unavailable storage never throws and simply reports no remembered baseline', () => {
  const store = createNewsSeenStore(null);
  assert.deepEqual([...store.compare(items('a'))], []);
  assert.equal(store.markSeen(items('a')), false);
});

test('first baseline then new arrival then visit then no repeat', () => {
  const storage = memoryStorage();
  const store = createNewsSeenStore(storage);

  assert.deepEqual([...store.compare(items('a', 'b'))], []);
  assert.deepEqual([...store.compare(items('c', 'b', 'a'))], ['c']);
  assert.equal(store.markSeen(items('c', 'b', 'a')), true);
  assert.deepEqual([...store.compare(items('c', 'b', 'a'))], []);
  assert.deepEqual([...store.compare(items('d', 'c', 'b', 'a'))], ['d']);
});

test('same catalog has identical new-state regardless of content source', () => {
  const storage = memoryStorage({ [NEWS_SEEN_KEY]: JSON.stringify(['a']) });
  const store = createNewsSeenStore(storage);
  const catalog = items('b', 'a');
  assert.deepEqual([...store.compare(catalog)], ['b']);
  assert.deepEqual([...store.compare(catalog)], ['b']);
});

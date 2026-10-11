import assert from 'node:assert/strict';
import test from 'node:test';
import { parseResources, stampNewResources } from '../scripts/stamp-resource-news.mjs';

test('reads the existing JavaScript resource catalog without evaluating code', () => {
  const items = parseResources('window.TIFLO_RESOURCES = [{"id":"old","new":false}];\n');
  assert.equal(items.length, 1);
  assert.equal(items[0].id, 'old');
});

test('automatically dates newly added resource IDs while preserving old entries', () => {
  const old = { id: 'old', new: false };
  const fresh = { id: 'new', new: false, title: 'New guide' };
  const timestamp = '2026-10-11T13:40:00Z';
  const stamped = stampNewResources([old, fresh], [old], timestamp);
  assert.equal(stamped.stamped, 1);
  assert.deepEqual(stamped.items[0], old);
  assert.equal(stamped.items[1].new, true);
  assert.equal(stamped.items[1].newsDate, timestamp);
  assert.equal(stampNewResources(stamped.items, stamped.items, timestamp).stamped, 0);
});

test('preserves an editorially assigned date for newly added records', () => {
  const item = { id: 'new', new: true, newsDate: '2026-10-01T10:00:00Z' };
  const stamped = stampNewResources([item], [], '2026-10-11T13:40:00Z');
  assert.equal(stamped.items[0].newsDate, item.newsDate);
});

test('rejects invalid incorporation timestamps', () => {
  assert.throws(() => stampNewResources([], [], 'invalid'), /Fecha de incorporación inválida/);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { createNotificationCoordinator } from '../src/core/notification-coordinator.mjs';

test('pre-ready destination waits until markReady', async () => {
  const seen = [];
  const coordinator = createNotificationCoordinator({ route: async value => seen.push(value) });
  await coordinator.receive({ type: 'news', url: 'https://example.com/a', title: '' });
  assert.deepEqual(seen, []);
  await coordinator.markReady();
  assert.equal(seen.length, 1);
});

test('only the newest pending destination is consumed once', async () => {
  const seen = [];
  const coordinator = createNotificationCoordinator({ route: async value => seen.push(value) });
  await coordinator.receive({ type: 'general' });
  await coordinator.receive({ type: 'download', url: 'https://example.com/a.zip', title: '' });
  await coordinator.markReady();
  await coordinator.markReady();
  assert.deepEqual(seen, [{ type: 'download', url: 'https://example.com/a.zip', title: '' }]);
});

test('post-ready destinations route immediately', async () => {
  const seen = [];
  const coordinator = createNotificationCoordinator({ route: async value => seen.push(value) });
  await coordinator.markReady();
  await coordinator.receive({ type: 'general' });
  assert.deepEqual(seen, [{ type: 'general' }]);
});

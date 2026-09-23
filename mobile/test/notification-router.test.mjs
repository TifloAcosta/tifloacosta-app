import assert from 'node:assert/strict';
import test from 'node:test';
import { createNotificationRouter } from '../src/core/notification-router.mjs';

function harness() {
  const calls = [];
  const route = createNotificationRouter({
    home: () => calls.push(['home']),
    news: value => calls.push(['news', value]),
    video: value => calls.push(['video', value]),
    resource: value => calls.push(['resource', value]),
    download: value => calls.push(['download', value])
  });
  return { calls, route };
}

test('known destination types dispatch exactly one matching action', async () => {
  for (const type of ['news', 'video', 'resource', 'download']) {
    const { calls, route } = harness();
    await route({ type, url: 'https://example.com/a', id: 'qYvoYsQZNbQ', title: '' });
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], type);
  }
});

test('general and unknown destinations fall back to home', async () => {
  for (const destination of [{ type: 'general' }, { type: 'mystery' }, null]) {
    const { calls, route } = harness();
    await route(destination);
    assert.deepEqual(calls, [['home']]);
  }
});

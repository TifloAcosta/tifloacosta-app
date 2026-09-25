import assert from 'node:assert/strict';
import test from 'node:test';
import { createNotificationRouter } from '../src/core/notification-router.mjs';

function harness() {
  const calls = [];
  const route = createNotificationRouter({
    home: () => calls.push(['home']),
    news: value => { calls.push(['news', value]); return true; },
    video: value => { calls.push(['video', value]); return true; },
    resource: value => { calls.push(['resource', value]); return true; },
    download: value => { calls.push(['download', value]); return true; },
    update: value => { calls.push(['update', value]); return true; }
  });
  return { calls, route };
}

test('known destination types dispatch exactly one matching action', async () => {
  for (const type of ['news', 'video', 'resource', 'download', 'update']) {
    const { calls, route } = harness();
    await route({ type, url: 'https://example.com/a', id: 'qYvoYsQZNbQ', title: '', version: '1.3.2' });
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

test('a stale destination whose action cannot open falls back to home', async () => {
  const calls = [];
  const route = createNotificationRouter({
    home: () => calls.push(['home']),
    news: value => { calls.push(['news', value]); return false; }
  });

  const result = await route({ type: 'news', id: 'expired-news', url: '', title: '' });

  assert.deepEqual(calls, [
    ['news', { type: 'news', id: 'expired-news', url: '', title: '' }],
    ['home']
  ]);
  assert.equal(result, 'home');
});
import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeNotificationDestination } from '../src/core/notification-destination.mjs';

test('missing or malformed notification data falls back to general', () => {
  for (const value of [null, undefined, [], 'news', 42]) {
    assert.deepEqual(normalizeNotificationDestination(value), { type: 'general' });
  }
});

test('news accepts a stable id without requiring a URL and preserves a safe optional fallback URL', () => {
  assert.deepEqual(
    normalizeNotificationDestination({
      tiflo_type: 'news',
      tiflo_id: 'news-1',
      tiflo_title: 'Título'
    }),
    { type: 'news', id: 'news-1', url: '', title: 'Título' }
  );
  assert.deepEqual(
    normalizeNotificationDestination({
      tiflo_type: 'news',
      tiflo_id: 'news-1',
      tiflo_url: 'https://example.com/a',
      tiflo_title: 'Título'
    }),
    { type: 'news', id: 'news-1', url: 'https://example.com/a', title: 'Título' }
  );
  for (const url of ['javascript:alert(1)', 'file:///tmp/a', 'intent://x']) {
    assert.deepEqual(
      normalizeNotificationDestination({ tiflo_type: 'news', tiflo_id: 'news-1', tiflo_url: url }),
      { type: 'news', id: 'news-1', url: '', title: '' }
    );
  }
  assert.deepEqual(normalizeNotificationDestination({ tiflo_type: 'news' }), { type: 'general' });
});

test('video accepts only a valid YouTube id or YouTube URL', () => {
  assert.deepEqual(
    normalizeNotificationDestination({ tiflo_type: 'video', tiflo_id: 'qYvoYsQZNbQ', tiflo_title: 'Vídeo' }),
    { type: 'video', id: 'qYvoYsQZNbQ', url: '', title: 'Vídeo' }
  );
  assert.equal(
    normalizeNotificationDestination({ tiflo_type: 'video', tiflo_url: 'https://www.youtube.com/watch?v=qYvoYsQZNbQ' }).id,
    'qYvoYsQZNbQ'
  );
  assert.deepEqual(normalizeNotificationDestination({ tiflo_type: 'video', tiflo_id: 'short' }), { type: 'general' });
});

test('resource accepts a stable id without requiring a URL while download still requires a safe URL', () => {
  assert.deepEqual(
    normalizeNotificationDestination({ tiflo_type: 'resource', tiflo_id: 'r1' }),
    { type: 'resource', id: 'r1', url: '', title: '' }
  );
  assert.deepEqual(
    normalizeNotificationDestination({ tiflo_type: 'resource', tiflo_id: 'r1', tiflo_url: 'https://example.com/r' }),
    { type: 'resource', id: 'r1', url: 'https://example.com/r', title: '' }
  );
  assert.deepEqual(
    normalizeNotificationDestination({ tiflo_type: 'download', tiflo_url: 'https://example.com/a.zip' }),
    { type: 'download', url: 'https://example.com/a.zip', title: '' }
  );
  assert.deepEqual(normalizeNotificationDestination({ tiflo_type: 'resource' }), { type: 'general' });
  assert.deepEqual(normalizeNotificationDestination({ tiflo_type: 'download' }), { type: 'general' });
});

test('oversized or non-string fields are bounded safely', () => {
  assert.deepEqual(
    normalizeNotificationDestination({ tiflo_type: { bad: true }, tiflo_url: 'https://example.com' }),
    { type: 'general' }
  );
  const result = normalizeNotificationDestination({
    tiflo_type: 'news',
    tiflo_url: 'https://example.com/a',
    tiflo_title: 'x'.repeat(500)
  });
  assert.equal(result.title.length, 200);
});

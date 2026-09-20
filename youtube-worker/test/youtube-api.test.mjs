import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolveChannelId,
  getAccountVideoState,
  subscribe,
  like,
  comment
} from '../src/youtube-api.js';

const token = 'access-token';
const videoId = 'abcDEF123_-';

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

test('resolveChannelId queries only the TifloAcosta handle', async () => {
  let seen;
  const channelId = await resolveChannelId(token, async (url, options) => {
    seen = { url: String(url), options };
    return jsonResponse({ items: [{ id: 'CHANNEL_ID' }] });
  });
  assert.equal(channelId, 'CHANNEL_ID');
  assert.equal(seen.url, 'https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=%40tifloacosta');
  assert.equal(seen.options.method, 'GET');
  assert.equal(seen.options.headers.Authorization, `Bearer ${token}`);
});

test('getAccountVideoState returns normalized subscription and rating', async () => {
  const calls = [];
  const state = await getAccountVideoState(token, videoId, async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('/channels?')) return jsonResponse({ items: [{ id: 'CHANNEL_ID' }] });
    if (String(url).includes('/subscriptions?')) return jsonResponse({ items: [{ id: 'sub-1' }] });
    if (String(url).includes('/videos/getRating?')) return jsonResponse({ items: [{ videoId, rating: 'like' }] });
    throw new Error(`unexpected URL ${url}`);
  });
  assert.deepEqual(state, { subscribed: true, rating: 'like' });
  assert.equal(calls[1].url, 'https://www.googleapis.com/youtube/v3/subscriptions?part=id&mine=true&forChannelId=CHANNEL_ID&maxResults=1');
  assert.equal(calls[2].url, `https://www.googleapis.com/youtube/v3/videos/getRating?id=${videoId}`);
});

test('getAccountVideoState normalizes unknown or absent ratings to none', async () => {
  const state = await getAccountVideoState(token, videoId, async url => {
    if (String(url).includes('/channels?')) return jsonResponse({ items: [{ id: 'CHANNEL_ID' }] });
    if (String(url).includes('/subscriptions?')) return jsonResponse({ items: [] });
    return jsonResponse({ items: [{ videoId, rating: 'unspecified-value' }] });
  });
  assert.deepEqual(state, { subscribed: false, rating: 'none' });
});

test('subscribe is idempotent when already subscribed', async () => {
  const calls = [];
  const result = await subscribe(token, async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('/channels?')) return jsonResponse({ items: [{ id: 'CHANNEL_ID' }] });
    if (String(url).includes('/subscriptions?')) return jsonResponse({ items: [{ id: 'sub-1' }] });
    throw new Error('insert must not be called');
  });
  assert.deepEqual(result, { subscribed: true, changed: false });
  assert.equal(calls.length, 2);
});

test('subscribe inserts the TifloAcosta channel when needed', async () => {
  const calls = [];
  const result = await subscribe(token, async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('/channels?')) return jsonResponse({ items: [{ id: 'CHANNEL_ID' }] });
    if (options.method === 'GET') return jsonResponse({ items: [] });
    return jsonResponse({ id: 'new-subscription' });
  });
  assert.deepEqual(result, { subscribed: true, changed: true });
  const insert = calls.at(-1);
  assert.equal(insert.url, 'https://www.googleapis.com/youtube/v3/subscriptions?part=snippet');
  assert.equal(insert.options.method, 'POST');
  assert.deepEqual(JSON.parse(insert.options.body), {
    snippet: { resourceId: { kind: 'youtube#channel', channelId: 'CHANNEL_ID' } }
  });
});

test('like rates only the requested valid video as like', async () => {
  let seen;
  const result = await like(token, videoId, async (url, options) => {
    seen = { url: String(url), options };
    return new Response(null, { status: 204 });
  });
  assert.deepEqual(result, { rating: 'like' });
  assert.equal(seen.url, `https://www.googleapis.com/youtube/v3/videos/rate?id=${videoId}&rating=like`);
  assert.equal(seen.options.method, 'POST');
});

test('comment publishes a top-level comment only after receiving text', async () => {
  let seen;
  const result = await comment(token, videoId, 'Texto del comentario', async (url, options) => {
    seen = { url: String(url), options };
    return jsonResponse({ id: 'thread-1' });
  });
  assert.deepEqual(result, { commented: true });
  assert.equal(seen.url, 'https://www.googleapis.com/youtube/v3/commentThreads?part=snippet');
  assert.equal(seen.options.method, 'POST');
  assert.deepEqual(JSON.parse(seen.options.body), {
    snippet: {
      videoId,
      topLevelComment: { snippet: { textOriginal: 'Texto del comentario' } }
    }
  });
});

test('invalid video IDs are rejected before any request', async () => {
  let called = false;
  const fetchImpl = async () => { called = true; return jsonResponse({}); };
  await assert.rejects(() => like(token, 'not valid', fetchImpl), error => error?.code === 'INVALID_VIDEO_ID');
  await assert.rejects(() => comment(token, 'short', 'hello', fetchImpl), error => error?.code === 'INVALID_VIDEO_ID');
  assert.equal(called, false);
});

test('YouTube errors are normalized without exposing response bodies', async () => {
  await assert.rejects(
    () => comment(token, videoId, 'hello', async () => jsonResponse({
      error: { message: 'private Google body', errors: [{ reason: 'commentsDisabled' }] }
    }, 403)),
    error => error?.code === 'COMMENTS_DISABLED' && error?.status === 403 && !String(error).includes('private Google body')
  );
  await assert.rejects(
    () => like(token, videoId, async () => jsonResponse({ error: { message: 'secret detail' } }, 401)),
    error => error?.code === 'AUTH_REVOKED' && error?.status === 401 && !String(error).includes('secret detail')
  );
});

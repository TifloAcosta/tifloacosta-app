import assert from 'node:assert/strict';
import test from 'node:test';
import { searchFreesound } from '../src/sounds.js';

const goodPayload = {
  count: 1,
  results: [{
    id: 42,
    name: 'Bell.wav',
    username: 'ana',
    license: 'Creative Commons 0',
    duration: 1.25,
    type: 'wav',
    filesize: 123456,
    tags: ['bell'],
    previews: { 'preview-hq-mp3': 'https://cdn.example/bell.mp3' }
  }]
};

const goodFetch = async () => new Response(JSON.stringify(goodPayload), {
  status: 200,
  headers: { 'content-type': 'application/json' }
});

test('maps Freesound metadata without download OAuth', async () => {
  const r = await searchFreesound({ query:'bell', category:'', page:1 }, { FREESOUND_API_KEY:'secret' }, goodFetch);
  assert.equal(r.status, 'ok');
  assert.equal(r.provider, 'freesound');
  assert.equal(r.items[0].pageUrl, 'https://freesound.org/s/42/');
  assert.equal(r.items[0].previewUrl, 'https://cdn.example/bell.mp3');
  assert.equal(r.items[0].downloadUrl, null);
  assert.equal(r.items[0].size, 123456);
  assert.equal(r.items[0].duration, 1.25);
});

test('uses server-side token authentication and requested metadata fields', async () => {
  let requestedUrl;
  let requestedOptions;
  const fetchImpl = async (url, options) => {
    requestedUrl = new URL(url);
    requestedOptions = options;
    return goodFetch();
  };
  await searchFreesound({ query:'bell', category:'notifications', page:2 }, { FREESOUND_API_KEY:'secret' }, fetchImpl);
  assert.equal(requestedUrl.origin + requestedUrl.pathname, 'https://freesound.org/apiv2/search/');
  assert.equal(requestedUrl.searchParams.get('query'), 'bell');
  assert.equal(requestedUrl.searchParams.get('page'), '2');
  assert.equal(requestedUrl.searchParams.get('page_size'), '20');
  assert.match(requestedUrl.searchParams.get('fields') || '', /previews/);
  assert.equal(requestedOptions.headers.Authorization, 'Token secret');
  assert.equal(requestedUrl.searchParams.has('token'), false);
});

test('missing key is recoverable and not leaked', async () => {
  const r = await searchFreesound({ query:'bell', category:'', page:1 }, {}, async () => { throw new Error('not called'); });
  assert.equal(r.code, 'provider_unavailable');
  assert.doesNotMatch(JSON.stringify(r), /FREESOUND_API_KEY|secret/i);
});

for (const status of [401, 429, 500]) {
  test(`upstream ${status} becomes provider_unavailable`, async () => {
    const fetchImpl = async () => new Response('{}', { status });
    const r = await searchFreesound({ query:'bell', category:'', page:1 }, { FREESOUND_API_KEY:'secret' }, fetchImpl);
    assert.equal(r.code, 'provider_unavailable');
  });
}

test('empty request is invalid_search', async () => {
  const r = await searchFreesound({ query:'', category:'', page:1 }, { FREESOUND_API_KEY:'secret' }, goodFetch);
  assert.equal(r.code, 'invalid_search');
});

test('page is clamped to positive integer', async () => {
  let requested;
  const fetchImpl = async url => {
    requested = new URL(url);
    return goodFetch();
  };
  await searchFreesound({ query:'bell', category:'', page:-8 }, { FREESOUND_API_KEY:'secret' }, fetchImpl);
  assert.equal(requested.searchParams.get('page'), '1');
});

test('malformed JSON and timeout are recoverable', async () => {
  const malformed = await searchFreesound(
    { query:'bell', category:'', page:1 },
    { FREESOUND_API_KEY:'secret' },
    async () => new Response('{', { status:200, headers:{'content-type':'application/json'} })
  );
  assert.equal(malformed.code, 'provider_unavailable');

  const timeoutError = Object.assign(new Error('aborted'), { name:'AbortError' });
  const timedOut = await searchFreesound(
    { query:'bell', category:'', page:1 },
    { FREESOUND_API_KEY:'secret' },
    async () => { throw timeoutError; }
  );
  assert.equal(timedOut.code, 'provider_unavailable');
});

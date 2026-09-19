import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeUrl,
  classifyUrl,
  resolveLocal,
  formatBytes,
  createAnalyzerClient
} from '../src/core/downloads.mjs';

test('normalizeUrl accepts only http and https URLs', () => {
  assert.equal(normalizeUrl(''), null);
  assert.equal(normalizeUrl('not a url'), null);
  assert.equal(normalizeUrl('ftp://example.com/a.zip'), null);
  assert.equal(normalizeUrl('javascript:alert(1)'), null);
  assert.equal(normalizeUrl('https://example.com/a.zip').href, 'https://example.com/a.zip');
});

test('classifyUrl identifies supported local providers and general web pages', () => {
  assert.equal(classifyUrl('https://drive.google.com/file/d/ABC123/view').provider, 'google-drive');
  assert.equal(classifyUrl('https://www.dropbox.com/s/demo/file.zip?dl=0').provider, 'dropbox');
  assert.equal(classifyUrl('https://example.com/file.pdf').provider, 'direct');
  assert.equal(classifyUrl('https://example.com/page').provider, 'web');
  assert.equal(classifyUrl('ftp://example.com/file.zip').provider, 'invalid');
});

test('Google Drive file links resolve locally to the official download URL', () => {
  const result = resolveLocal('https://drive.google.com/file/d/ABC123/view');
  assert.equal(result.kind, 'result');
  assert.equal(result.provider, 'google-drive');
  assert.equal(result.items.length, 1);
  const url = new URL(result.items[0].url);
  assert.equal(url.origin + url.pathname, 'https://drive.google.com/uc');
  assert.equal(url.searchParams.get('export'), 'download');
  assert.equal(url.searchParams.get('id'), 'ABC123');
  assert.equal(result.items[0].size, null);
});

test('Dropbox links force dl=1 without losing the filename', () => {
  const result = resolveLocal('https://www.dropbox.com/s/demo/file.zip?dl=0');
  assert.equal(result.kind, 'result');
  const url = new URL(result.items[0].url);
  assert.equal(url.searchParams.get('dl'), '1');
  assert.equal(result.items[0].name, 'file.zip');
  assert.equal(result.items[0].type, 'zip');
});

test('direct files resolve locally and keep unknown size as null', () => {
  const result = resolveLocal('https://example.com/files/manual.pdf');
  assert.equal(result.kind, 'result');
  assert.equal(result.items[0].name, 'manual.pdf');
  assert.equal(result.items[0].type, 'pdf');
  assert.equal(result.items[0].size, null);
});

test('formatBytes never turns missing or invalid sizes into zero', () => {
  assert.equal(formatBytes(null), '');
  assert.equal(formatBytes(undefined), '');
  assert.equal(formatBytes(''), '');
  assert.equal(formatBytes(-1), '');
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1024), '1.00 KB');
});

test('analyzer client posts only the normalized URL and returns coded Worker errors intact', async () => {
  const calls = [];
  const client = createAnalyzerClient({
    endpoint: 'https://download.tifloacosta.com/analyze',
    fetchFn: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: false,
        status: 422,
        async json() {
          return { status: 'error', code: 'authentication_required', message: 'Sign in required' };
        }
      };
    }
  });

  const payload = await client.analyze('https://example.com/page');
  assert.equal(payload.code, 'authentication_required');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://download.tifloacosta.com/analyze');
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].options.body), { url: 'https://example.com/page' });
});

test('analyzer client maps invalid JSON and generic HTTP failure without leaking response text', async () => {
  const invalidJson = createAnalyzerClient({
    endpoint: 'https://download.tifloacosta.com/analyze',
    fetchFn: async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad json'); } })
  });
  await assert.rejects(() => invalidJson.analyze('https://example.com/page'), error => error.code === 'bad_response');

  const genericFailure = createAnalyzerClient({
    endpoint: 'https://download.tifloacosta.com/analyze',
    fetchFn: async () => ({ ok: false, status: 500, json: async () => ({ status: 'error' }) })
  });
  await assert.rejects(() => genericFailure.analyze('https://example.com/page'), error => error.code === 'service_unavailable');
});

test('analyzer client maps AbortError to timeout', async () => {
  const client = createAnalyzerClient({
    endpoint: 'https://download.tifloacosta.com/analyze',
    fetchFn: async () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      throw error;
    }
  });
  await assert.rejects(() => client.analyze('https://example.com/page'), error => error.code === 'timeout');
});

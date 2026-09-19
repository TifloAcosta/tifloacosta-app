import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import worker from '../src/index.js';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('worker enforces POST/OPTIONS, CORS, manual redirects and bounded HTML analysis', async () => {
  const source = await read('src/index.js');
  assert.match(source, /request\.method === 'OPTIONS'/);
  assert.match(source, /request\.method !== 'POST'/);
  assert.match(source, /https:\/\/tifloacosta\.com/);
  assert.match(source, /https:\/\/tifloacosta\.github\.io/);
  assert.match(source, /redirect:\s*'manual'/);
  assert.match(source, /MAX_REDIRECTS\s*=\s*5/);
  assert.match(source, /REQUEST_TIMEOUT_MS\s*=\s*8000/);
  assert.match(source, /MAX_HTML_BYTES\s*=\s*1_000_000/);
  assert.match(source, /HTMLRewriter/);
  assert.match(source, /MAX_CANDIDATES\s*=\s*200/);
});

test('Capacitor HTTPS localhost origin is allowed without wildcard CORS', async () => {
  const request = new Request('https://download.tifloacosta.com/analyze', {
    method: 'OPTIONS',
    headers: { Origin: 'https://localhost' }
  });
  const response = await worker.fetch(request, {});
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://localhost');
});

test('unknown origins remain rejected', async () => {
  const request = new Request('https://download.tifloacosta.com/analyze', {
    method: 'OPTIONS',
    headers: { Origin: 'https://evil.example' }
  });
  const response = await worker.fetch(request, {});
  assert.equal(response.status, 403);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});

test('GET /health returns an explicit browser-readable service status', async () => {
  const request = new Request('https://download.tifloacosta.com/health', {
    method: 'GET'
  });
  const response = await worker.fetch(request, {});
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.deepEqual(await response.json(), {
    status: 'ok',
    service: 'tifloacosta-download-analyzer'
  });
});

test('worker validates every redirect and never proxies complete files', async () => {
  const source = await read('src/index.js');
  assert.match(source, /safeRedirectTarget/);
  assert.match(source, /content-disposition/);
  assert.match(source, /nameFromHeaders/);
  assert.doesNotMatch(source, /return\s+response\s*;/);
});

test('worker distinguishes authentication from blocked automated access', async () => {
  const source = await read('src/index.js');
  assert.match(source, /response\.status === 401/);
  assert.match(source, /response\.status === 403/);
  assert.match(source, /access_denied/);
});

test('worker probes file sizes without trying every candidate on huge pages', async () => {
  const source = await read('src/index.js');
  assert.match(source, /MAX_SIZE_PROBES\s*=\s*20/);
  assert.match(source, /method:\s*'HEAD'/);
  assert.match(source, /content-length/);
  assert.match(source, /enrichCandidateSizes/);
});

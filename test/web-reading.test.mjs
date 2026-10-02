import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('web home exposes Leer con TifloAcosta as an accessible routed section', async () => {
  const html = await read('index.html');
  assert.ok(html.includes('id="home-open-reading" href="#reading"'));
  assert.ok(html.includes('id="reading-section"'));
  assert.ok(html.includes('aria-labelledby="reading-heading"'));
  assert.ok(html.includes("reading: document.getElementById('reading-section')"));
  assert.ok(html.includes('id="reading-heading"'));
  assert.ok(html.includes('data-home-back'));
});

test('web reader loads after the shared bridge and before the main app', async () => {
  const html = await read('index.html');
  const sharedIndex = html.indexOf('shared-web.js?v=1.0');
  const readerIndex = html.indexOf('web-reading.js?v=1.0');
  const appIndex = html.indexOf('app.js?v=2.2');
  assert.ok(sharedIndex >= 0);
  assert.ok(readerIndex > sharedIndex);
  assert.ok(appIndex > readerIndex);
});

test('web reader reuses the shared semantic reader search and speech layers', async () => {
  const source = await read('web-reading.js');
  for (const token of [
    'TIFLO_SHARED',
    'parseTextDocument',
    'parseHtmlDocument',
    'createReadingSession',
    'createReadingSearchIndex',
    'createWebReadingSpeechAdapter',
    'createSharedReadingSpeechController',
    'listWebTtsVoices'
  ]) {
    assert.ok(source.includes(token), `Missing shared reader token: ${token}`);
  }
});

test('web reader accepts only local TXT and HTML in its first platform slice', async () => {
  const [html, source] = await Promise.all([read('index.html'), read('web-reading.js')]);
  assert.ok(html.includes('accept=".txt,.html,.htm,text/plain,text/html"'));
  assert.ok(source.includes("lower.endsWith('.txt')"));
  assert.ok(source.includes("lower.endsWith('.html')"));
  assert.ok(source.includes("lower.endsWith('.htm')"));
  assert.ok(source.includes("code: 'unsupported'"));
});

test('PWA shell caches and refreshes the web reader script', async () => {
  const worker = await read('sw.js');
  assert.ok(worker.includes('tifloacosta-app-v2-27-reader'));
  assert.ok(worker.includes("'./web-reading.js?v=1.0'"));
  assert.ok(worker.includes("url.pathname.endsWith('/web-reading.js')"));
  assert.ok(worker.includes("freshScript(url, './web-reading.js?v=1.0', request)"));
});

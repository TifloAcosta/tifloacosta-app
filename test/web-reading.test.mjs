import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('web home exposes Leer con TifloAcosta as an accessible routed section', async () => {
  const html = await read('index.html');
  assert.match(html, /id="home-open-reading"[^>]*href="#reading"/);
  assert.match(html, /id="reading-section"[^>]*aria-labelledby="reading-heading"/);
  assert.match(html, /reading:s*document.getElementById('reading-section')/);
  assert.match(html, /id="reading-heading"/);
  assert.match(html, /data-home-back/);
});

test('web reader loads after the shared bridge and before the main app', async () => {
  const html = await read('index.html');
  assert.match(html, /shared-web.js?v=1.0[sS]*web-reading.js?v=1.0[sS]*app.js?v=2.2/);
});

test('web reader reuses the shared semantic reader search and speech layers', async () => {
  const source = await read('web-reading.js');
  assert.match(source, /TIFLO_SHARED/);
  assert.match(source, /parseTextDocument/);
  assert.match(source, /parseHtmlDocument/);
  assert.match(source, /createReadingSession/);
  assert.match(source, /createReadingSearchIndex/);
  assert.match(source, /createWebReadingSpeechAdapter/);
  assert.match(source, /createSharedReadingSpeechController/);
  assert.match(source, /listWebTtsVoices/);
});

test('web reader accepts only local TXT and HTML in its first platform slice', async () => {
  const [html, source] = await Promise.all([read('index.html'), read('web-reading.js')]);
  assert.match(html, /accept=".txt,.html,.htm,text/plain,text/html"/);
  assert.match(source, /lower.endsWith('.txt')/);
  assert.match(source, /lower.endsWith('.html')/);
  assert.match(source, /lower.endsWith('.htm')/);
  assert.match(source, /code:s*'unsupported'/);
});

test('PWA shell caches and refreshes the web reader script', async () => {
  const worker = await read('sw.js');
  assert.match(worker, /tifloacosta-app-v2-27-reader/);
  assert.match(worker, /'./web-reading.js?v=1.0'/);
  assert.match(worker, /url.pathname.endsWith('/web-reading.js')/);
  assert.match(worker, /freshScript(url,s*'./web-reading.js?v=1.0'/);
});

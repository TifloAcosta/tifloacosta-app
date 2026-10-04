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

test('web reader loads from the shared module before the main app', async () => {
  const html = await read('index.html');
  const sharedIndex = html.indexOf("import * as shared from './shared/web-entry.mjs?v=");
  const readerIndex = html.indexOf("await import('./web-reading.js?v=");
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

test('web reader accepts common document formats with heavy engines loaded on demand', async () => {
  const [html, source] = await Promise.all([read('index.html'), read('web-reading.js')]);
  for (const extension of ['.txt','.html','.htm','.pdf','.docx','.epub','.odt','.rtf','.md','.markdown','.fb2','.png','.jpg','.jpeg','.webp']) {
    assert.ok(html.includes(extension), `Missing accepted format ${extension}`);
  }
  assert.ok(source.includes("lower.endsWith('.txt')"));
  assert.ok(source.includes("lower.endsWith('.html')"));
  assert.ok(source.includes("lower.endsWith('.pdf')"));
  assert.ok(source.includes("lower.endsWith('.docx')"));
  assert.ok(source.includes("lower.endsWith('.epub')"));
  assert.ok(source.includes("lower.endsWith('.odt')"));
  assert.ok(source.includes("lower.endsWith('.rtf')"));
  assert.ok(source.includes("lower.endsWith('.fb2')"));
  assert.ok(source.includes("loadPdfBundle"));
  assert.ok(source.includes("web-pdf.js?v=1.0"));
  assert.ok(source.includes("extractPdfText"));
  assert.ok(source.includes("parsePdfDocument"));
  assert.ok(source.includes("code: 'unsupported'"));
});

test('PWA shell caches and refreshes the web reader script', async () => {
  const worker = await read('sw.js');
  assert.match(worker, /const CACHE = 'tifloacosta-app-v[^']+'/);
  assert.match(worker, /'\.\/web-reading\.js\?v=[^']+'/);
  assert.ok(worker.includes("url.pathname.endsWith('/web-reading.js')"));
  assert.match(worker, /freshScript\(url, '\.\/web-reading\.js\?v=[^']+', request\)/);
});


test('web reader exposes explicit OCR for scanned PDFs and common image files', async () => {
  const [html, source, pdfAdapter] = await Promise.all([
    read('index.html'),
    read('web-reading.js'),
    read('shared/web-pdf-adapter.mjs')
  ]);
  assert.ok(html.includes('id="reading-ocr"'));
  assert.ok(source.includes('runPdfOcr'));
  assert.ok(source.includes('tesseract.js@7.0.0'));
  assert.ok(source.includes('tesseract.js-core@6.1.2'));
  assert.ok(source.includes('tessdata.projectnaptha.com/4.0.0'));
  assert.ok(source.includes('pendingPdfFile'));
  assert.ok(source.includes('pendingImageFile'));
  assert.ok(source.includes('isImageFile'));
  assert.ok(pdfAdapter.includes('recognizePage'));
  assert.ok(pdfAdapter.includes("source = text ? 'embedded' : 'empty'"));
  assert.ok(pdfAdapter.includes("source = text ? 'ocr' : 'empty'"));
});

test('PDF.js is built as a separate on-demand bundle with a local worker', async () => {
  const [pkg, build] = await Promise.all([
    read('mobile/package.json'),
    read('mobile/scripts/build-shared-web.mjs')
  ]);
  assert.ok(pkg.includes('"pdfjs-dist": "6.3.289"'));
  assert.ok(build.includes("globalName: 'TIFLO_PDF'"));
  assert.ok(build.includes('web-pdf.js'));
  assert.ok(build.includes('pdf.worker.min.mjs'));
  assert.ok(build.includes('nodePaths: [mobileNodeModules]'));
});

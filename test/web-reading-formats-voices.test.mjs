import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('web reader exposes common document and image formats', async () => {
  const [html, source] = await Promise.all([read('index.html'), read('web-reading.js')]);
  for (const extension of ['.docx','.pptx','.xlsx','.epub','.odt','.rtf','.md','.markdown','.fb2','.png','.jpg','.jpeg','.webp']) {
    assert.ok(html.includes(extension), `Missing accepted extension ${extension}`);
  }
  for (const token of [
    'parseDocxArchive',
    'parsePptxArchive',
    'parseXlsxArchive',
    'parseEpubArchive',
    'parseOdtArchive',
    'parseRtfDocument',
    'parseMarkdownDocument',
    'parseFb2Document',
    'loadZipBundle',
    'isImageFile'
  ]) {
    assert.ok(source.includes(token), `Missing format handler ${token}`);
  }
  assert.ok(source.includes("code:'legacy-doc'") || source.includes("code: 'legacy-doc'"));
});

test('structured web format adapters cover DOCX PPTX XLSX EPUB ODT RTF Markdown and FB2', async () => {
  const source = await read('shared/web-reading-format-adapters.mjs');
  for (const token of [
    'parseDocxArchive',
    'parseEpubArchive',
    'parseOdtArchive',
    'parseRtfDocument',
    'parseMarkdownDocument',
    'parseFb2Document'
  ]) {
    assert.ok(source.includes(`export function ${token}`) || source.includes(`export async function ${token}`));
  }
  assert.ok(source.includes("word/document.xml"));
  const office = await read('shared/office-openxml-adapters.mjs');
  assert.ok(office.includes('parsePptxArchive'));
  assert.ok(office.includes('parseXlsxArchive'));
  assert.ok(office.includes("ppt/presentation.xml"));
  assert.ok(office.includes("xl/workbook.xml"));
  assert.ok(office.includes('Speaker notes') || office.includes('Notas del presentador'));
  assert.ok(office.includes('Headers') || office.includes('Encabezados'));
  assert.ok(source.includes("META-INF/container.xml"));
  assert.ok(source.includes("content.xml"));
});

test('web OCR accepts images as well as scanned PDFs', async () => {
  const source = await read('web-reading.js');
  assert.ok(source.includes('pendingImageFile'));
  assert.ok(source.includes("['image/png','image/jpeg','image/webp']"));
  assert.ok(source.includes('worker.recognize(file)'));
});

test('web reader exposes external voice providers separately from browser voices', async () => {
  const [html, source, catalog] = await Promise.all([
    read('index.html'),
    read('web-reading.js'),
    read('shared/reading-voice-catalog.mjs')
  ]);
  assert.ok(html.includes('id="reading-external-voices"'));
  assert.ok(source.includes('WEB_EXTERNAL_VOICE_PROVIDERS'));
  assert.ok(source.includes('confirmExternalProvider'));
  for (const provider of ['Acapela Voices','Acapela My-Own-Voice','Code Factory TTS']) {
    assert.ok(catalog.includes(provider), `Missing voice provider ${provider}`);
  }
});


test('web reader filters browser and external voices by language', async () => {
  const [source, catalog, html, worker] = await Promise.all([
    read('web-reading.js'),
    read('shared/reading-voice-catalog.mjs'),
    read('index.html'),
    read('sw.js')
  ]);
  for (const token of [
    'reading-voice-language',
    'reading-external-voice-language',
    'voicesForLanguage',
    'populateLanguageFilter',
    'voiceLanguage',
    'externalVoiceLanguage'
  ]) assert.ok(source.includes(token), `Missing language filter feature ${token}`);
  assert.ok(source.includes('reading-document-voice-language'));
  assert.ok(catalog.includes('languages:'));
  assert.match(html, /web-reading\.js\?v=3\.4/);
  assert.match(worker, /web-reading\.js\?v=3\.4/);
  assert.match(worker, /tifloacosta-app-v2-38-language-filtered-voices/);
});


test('PowerPoint images without alt text remain visible to accessible reading', async () => {
  const source = await read('shared/office-openxml-adapters.mjs');
  assert.ok(source.includes('imageMissing'));
  assert.ok(source.includes('Imagen sin descripción disponible'));
  assert.ok(source.includes('Image without an available description'));
  assert.match(source, /images\.push\(description \|\| copy\.imageMissing\)/);
});

test('web reader exposes explicit previous and next controls for the selected navigation unit', async () => {
  const source = await read('web-reading.js');
  for (const token of ['Previous ${label}', 'Next ${label}', 'Anterior: ${label}', 'Siguiente: ${label}', "previousUnit.addEventListener('click'", "nextUnit.addEventListener('click'"]) {
    assert.ok(source.includes(token), `Missing navigation control ${token}`);
  }
});

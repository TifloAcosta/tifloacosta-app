import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import {
  addReturnControl,
  readerUrl,
  addOpenUrlToCatalog
} from '../scripts/migrate-readers.mjs';

const APP_HOME = 'https://tifloacosta.com/';

function assertReturnControls(html, title = 'reader') {
  const headingIndex = html.search(/<h1\b/i);
  const firstReturn = html.indexOf(`href="${APP_HOME}"`);
  const lastReturn = html.lastIndexOf(`href="${APP_HOME}"`);
  assert.ok(firstReturn >= 0, `Reader has no return control: ${title}`);
  assert.ok(firstReturn < headingIndex, `Reader return control is not before the main heading: ${title}`);
  assert.ok(lastReturn > headingIndex, `Reader has no final return control: ${title}`);
  assert.ok(lastReturn > firstReturn, `Reader needs separate start and end return controls: ${title}`);
}

function assertLocalizedReturnLabel(html, lang, title) {
  if (lang === 'es') {
    assert.ok(html.includes('Volver a la pantalla principal de TifloAcosta App'), `Reader has the wrong return label: ${title}`);
    return;
  }
  const englishLabel = /Back to (?:the )?TifloAcosta App (?:home|main) screen|Back to TifloAcosta App/;
  assert.match(html, englishLabel, `Reader has the wrong return label: ${title}`);
}

test('Spanish reader has explicit return controls at the start and end', () => {
  const source = '<!doctype html><html lang="es"><head><title>Prueba</title></head><body><h1>Documento</h1></body></html>';
  const result = addReturnControl(source, 'es');

  assertReturnControls(result, 'Spanish test reader');
  assert.match(result, /Volver a la pantalla principal de TifloAcosta App/);
  assert.match(result, /href="https:\/\/tifloacosta\.com\/"/);
});

test('English reader uses an accessible English return label', () => {
  const source = '<html lang="en"><body><h1>Document</h1></body></html>';
  const result = addReturnControl(source, 'en');
  assertLocalizedReturnLabel(result, 'en', 'English test reader');
});

test('readerUrl uses the language folder and Drive id', () => {
  assert.equal(
    readerUrl('es', 'abc_123'),
    'https://tifloacosta.com/docs/es/reader-abc_123.html'
  );
});

test('addOpenUrlToCatalog updates only the requested resource', () => {
  const source = `window.TIFLO_RESOURCES = [
  {
    "id": "es-one",
    "lang": "es",
    "url": "https://drive.google.com/file/d/one/view",
    "new": false
  },
  {
    "id": "es-two",
    "lang": "es",
    "url": "https://drive.google.com/file/d/two/view",
    "new": false
  }
];`;

  const result = addOpenUrlToCatalog(source, 'es-two', 'https://example.test/reader-two.html');
  assert.doesNotMatch(result.slice(0, result.indexOf('"id": "es-two"')), /openUrl/);
  assert.match(result, /"id": "es-two"[\s\S]*"openUrl": "https:\/\/example\.test\/reader-two\.html"/);
});

test('every catalog resource has a direct accessible reader with a return control', async () => {
  const source = await readFile(new URL('../data.js', import.meta.url), 'utf8');
  const context = { window: {} };
  vm.runInNewContext(source, context);
  const resources = context.window.TIFLO_RESOURCES;
  const missing = resources.filter(item => !item.openUrl).map(item => item.title);
  assert.equal(missing.length, 0, `Resources missing openUrl: ${missing.join(', ')}`);

  for (const item of resources) {
    assert.ok(item.openUrl.startsWith(APP_HOME), `Unexpected reader URL for ${item.title}: ${item.openUrl}`);
    const relative = item.openUrl.slice(APP_HOME.length).split('?')[0];
    const html = await readFile(new URL(`../${relative}`, import.meta.url), 'utf8');
    assertReturnControls(html, item.title);
    assertLocalizedReturnLabel(html, item.lang, item.title);
  }
});

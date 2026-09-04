import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import {
  addReturnControl,
  readerUrl,
  addOpenUrlToCatalog
} from '../scripts/migrate-readers.mjs';

test('Spanish reader starts with an explicit return control', () => {
  const source = '<!doctype html><html lang="es"><head><title>Prueba</title></head><body><h1>Documento</h1></body></html>';
  const result = addReturnControl(source, 'es');
  const body = result.slice(result.indexOf('<body'));
  const buttonIndex = body.indexOf('role="button"');
  const headingIndex = body.indexOf('<h1>');

  assert.ok(buttonIndex >= 0);
  assert.ok(buttonIndex < headingIndex);
  assert.match(result, /Volver a la pantalla principal de TifloAcosta App/);
  assert.match(result, /href="https:\/\/tifloacosta\.github\.io\/tifloacosta-app\/"/);
});

test('English reader uses the English return label', () => {
  const source = '<html lang="en"><body><h1>Document</h1></body></html>';
  const result = addReturnControl(source, 'en');
  assert.match(result, /Back to the TifloAcosta App main screen/);
});

test('readerUrl uses the language folder and Drive id', () => {
  assert.equal(
    readerUrl('es', 'abc_123'),
    'https://tifloacosta.github.io/tifloacosta-app/docs/es/reader-abc_123.html'
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

test('every Spanish resource has a direct reader URL', async () => {
  const source = await readFile(new URL('../data.js', import.meta.url), 'utf8');
  const context = { window: {} };
  vm.runInNewContext(source, context);
  const spanish = context.window.TIFLO_RESOURCES.filter(item => item.lang === 'es');
  const missing = spanish.filter(item => !item.openUrl).map(item => item.title);
  assert.deepEqual(missing, []);
});

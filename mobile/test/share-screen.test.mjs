import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { text } from '../src/core/i18n.mjs';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('share decisions keep one clear primary action and bounded error choices', async () => {
  const { actionsForClassification, errorActions } = await import('../src/screens/share.mjs');
  assert.deepEqual(actionsForClassification({ kind: 'youtube' }).map(item => item.id), ['play']);
  assert.deepEqual(actionsForClassification({ kind: 'download' }).map(item => item.id), ['downloads']);
  assert.deepEqual(actionsForClassification({ kind: 'web' }).map(item => item.id), ['read']);
  assert.deepEqual(actionsForClassification({ kind: 'text' }).map(item => item.id), ['search']);
  assert.deepEqual(errorActions('unreliable').map(item => item.id), ['downloads', 'cancel']);
  assert.deepEqual(errorActions('timeout').map(item => item.id), ['retry', 'cancel']);
  assert.ok(errorActions('unknown').length <= 4);
});

test('share screen contract is screen-reader friendly and never injects remote HTML', async () => {
  const source = await read('src/screens/share.mjs');
  assert.match(source, /dataset\.screenHeading|data-screen-heading/);
  assert.match(source, /setAttribute\(['"]role['"],\s*['"]status['"]\)/);
  assert.match(source, /setAttribute\(['"]aria-live['"],\s*['"]polite['"]\)/);
  assert.match(source, /setAttribute\(['"]aria-atomic['"],\s*['"]true['"]\)/);
  assert.match(source, /textContent/);
  assert.doesNotMatch(source, /\.innerHTML\s*=/);
  assert.doesNotMatch(source, />\s*(?:OK|Continue|Aceptar|Continuar)\s*</i);
});

test('share copy exists in Spanish and English for every operational state', () => {
  const keys = [
    'screen.share', 'share.receivedYoutube', 'share.receivedWeb', 'share.receivedDownload', 'share.receivedText',
    'share.play', 'share.read', 'share.downloads', 'share.search', 'share.multiFound', 'share.preparing',
    'share.retry', 'share.cancel', 'share.backPage', 'share.unreliable', 'share.timeout', 'share.unreachable',
    'share.unsupportedType', 'share.tooLarge', 'share.tooManyRedirects', 'share.httpError', 'share.invalid',
    'share.source', 'share.chooseLink', 'share.loadingHeading'
  ];
  for (const lang of ['es', 'en']) {
    for (const key of keys) assert.notEqual(text(lang, key), key, `Missing ${lang} ${key}`);
  }
});

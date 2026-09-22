import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { text } from '../src/core/i18n.mjs';

const read = async path => {
  try {
    return await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  } catch {
    return '';
  }
};

test('share decisions expose one clear primary action and bounded error choices', async () => {
  const share = await import('../src/screens/share.mjs');
  assert.deepEqual(share.actionsForClassification({ kind: 'youtube' }).map(item => item.id), ['play']);
  assert.deepEqual(share.actionsForClassification({ kind: 'download' }).map(item => item.id), ['downloads']);
  assert.deepEqual(share.actionsForClassification({ kind: 'web' }).map(item => item.id), ['read']);
  assert.deepEqual(share.actionsForClassification({ kind: 'text' }).map(item => item.id), ['search']);
  assert.deepEqual(share.errorActions('unreliable').map(item => item.id), ['downloads', 'cancel']);
  assert.deepEqual(share.errorActions('timeout').map(item => item.id), ['retry', 'cancel']);
});

test('share screen reuses the common loader and semantic reader instead of duplicating extraction', async () => {
  const source = await read('src/screens/share.mjs');
  assert.match(source, /import\s*\{\s*loadReadableTarget\s*\}\s*from\s*['"]\.\.\/core\/readable-loader\.mjs['"]/);
  assert.match(source, /import\s*\{\s*renderReadableContent\s*\}\s*from\s*['"]\.\/reader\.mjs['"]/);
  assert.match(source, /loadReadableTarget\(\{/);
  assert.match(source, /renderReadableContent\(\{/);
  assert.doesNotMatch(source, /extractReadablePage/);
  assert.doesNotMatch(source, /innerHTML\s*=/);
});

test('share navigation keeps temporary readable history and multi-link return context', async () => {
  const share = await import('../src/screens/share.mjs');
  assert.equal(share.destinationReturnView({ view: 'readable' }), 'readable');
  assert.equal(share.destinationReturnView({ view: 'multi-url' }), 'multi-url');
  assert.equal(share.destinationReturnView({ view: 'received' }), 'received');
  assert.equal(share.backTargetForState({
    view: 'readable',
    readableHistory: [{ url: 'https://one.test/' }, { url: 'https://two.test/' }],
    urls: ['https://one.test/'],
    selectedUrl: 'https://two.test/'
  }), 'readable-previous');
  assert.equal(share.backTargetForState({
    view: 'error',
    error: { returnView: 'multi-url' },
    readableHistory: [],
    urls: ['https://a.test/', 'https://b.test/'],
    selectedUrl: 'https://a.test/'
  }), 'multi-url');
});

test('share screen exposes accessible status and bilingual operational copy', async () => {
  const source = await read('src/screens/share.mjs');
  assert.match(source, /dataset\.screenHeading/);
  assert.match(source, /setAttribute\(['"]role['"],\s*['"]status['"]\)/);
  assert.match(source, /setAttribute\(['"]aria-live['"],\s*['"]polite['"]\)/);
  assert.match(source, /setAttribute\(['"]aria-atomic['"],\s*['"]true['"]\)/);

  const keys = [
    'screen.share', 'share.receivedYoutube', 'share.receivedWeb', 'share.receivedDownload', 'share.receivedText',
    'share.play', 'share.read', 'share.downloads', 'share.search', 'share.multiFound', 'share.chooseLink',
    'share.preparing', 'share.retry', 'share.cancel', 'share.returnToApp', 'share.backPage', 'share.backLinks',
    'share.unreliable', 'share.timeout', 'share.unreachable', 'share.unsupportedType', 'share.tooLarge',
    'share.tooManyRedirects', 'share.httpError', 'share.invalid', 'share.source', 'share.loadingHeading', 'share.errorHeading'
  ];
  for (const lang of ['es', 'en']) {
    for (const key of keys) assert.notEqual(text(lang, key), key, `Missing ${lang} ${key}`);
  }
});

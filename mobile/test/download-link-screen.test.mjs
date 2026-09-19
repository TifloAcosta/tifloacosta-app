import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { text } from '../src/core/i18n.mjs';

const source = await readFile(new URL('../src/screens/download-link.mjs', import.meta.url), 'utf8');

test('download-from-link screen uses accessible native-mobile structure', () => {
  assert.match(source, /addScreenHeader\(/);
  assert.match(source, /input\.type\s*=\s*'url'/);
  assert.match(source, /label\.htmlFor\s*=\s*input\.id/);
  assert.match(source, /aria-live['"],\s*['"]polite/);
  assert.match(source, /aria-atomic['"],\s*['"]true/);
  assert.doesNotMatch(source, /autofocus/i);
});

test('download-from-link screen uses native save and external browser actions', () => {
  assert.match(source, /nativeActions\.saveFile/);
  assert.match(source, /nativeActions\.openExternal/);
  assert.match(source, /resolveLocal/);
  assert.match(source, /analyzer\.analyze/);
  assert.match(source, /authentication_required/);
  assert.match(source, /access_denied/);
  assert.match(source, /downloadsLink\.retry/);
});

test('download-from-link screen exposes bilingual operational states', () => {
  const keys = [
    'downloadsLink.intro', 'downloadsLink.label', 'downloadsLink.analyze', 'downloadsLink.analyzing',
    'downloadsLink.invalid', 'downloadsLink.resultsHeading', 'downloadsLink.filesFound', 'downloadsLink.save',
    'downloadsLink.saved', 'downloadsLink.unknownSize', 'downloadsLink.unknownType',
    'downloadsLink.authenticationRequired', 'downloadsLink.blocked', 'downloadsLink.externalNotice',
    'downloadsLink.openExternal', 'downloadsLink.retry', 'downloadsLink.timeout', 'downloadsLink.unreachable',
    'downloadsLink.noFiles', 'downloadsLink.unsupported', 'downloadsLink.unavailable',
    'downloadsLink.saveFailed', 'downloadsLink.defaultFilename'
  ];
  for (const lang of ['es', 'en']) {
    for (const key of keys) assert.notEqual(text(lang, key), key, `Missing ${lang} ${key}`);
  }
});

test('save action uses a safe filename, MIME type and never renders without an item URL', () => {
  assert.match(source, /if\s*\(!item\?\.url\)\s*return/);
  assert.match(source, /filename:\s*item\.name\s*\|\|\s*t\('downloadsLink\.defaultFilename'\)/);
  assert.match(source, /mimeType:\s*mimeFromType\(item\.type\)/);
});

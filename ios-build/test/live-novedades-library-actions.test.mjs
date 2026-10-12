import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL('../../' + path, import.meta.url), 'utf8');

test('iOS packs the complete dated Novedades feed with its secure native public-file allowlist', async () => {
  const [preparer, native] = await Promise.all([
    read('ios-build/prepare-web.mjs'),
    read('ios-build/native/TifloYouTubeViewController.swift')
  ]);
  assert.match(preparer, /networkFirst\('mobile-content\.json'\)/);
  assert.match(preparer, /new Map\(\(Array\.isArray\(data\)/);
  assert.match(preparer, /feed\.resources/);
  assert.match(preparer, /new: true/);
  assert.match(preparer, /renderNews\(\)/);
  assert.match(native, /"mobile-content\.json"/);
  assert.match(preparer, /void refreshIosResourceCatalog\(\)/);
});

test('iOS library displays per-document actions and requires deletion confirmation', async () => {
  const source = await read('web-reading.js');
  assert.match(source, /reading-library-details-toggle/);
  assert.match(source, /detailsToggle\.setAttribute\('aria-controls', details\.id\)/);
  assert.match(source, /detailsToggle\.addEventListener\('click'/);
  assert.match(source, /card\.append\(title, detailsToggle, details\)/);
  assert.match(source, /confirmDelete\.addEventListener\('click'/);
  assert.match(source, /confirmation\.hidden = false/);
  assert.match(source, /estimateBookTimes\(book\)/);
  assert.match(source, /detailsToggle\.focus/);
});

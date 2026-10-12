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

test('iOS ships its local expandable bilingual guide in the primary home navigation', async () => {
  const [index, prepare, guide] = await Promise.all([
    read('index.html'),
    read('ios-build/prepare-web.mjs'),
    read('ios-build/ios-guide.js')
  ]);
  assert.match(index, /id="home-open-guide"/);
  assert.match(index, /id="guide-view"/);
  assert.match(index, /guide: document\.getElementById\('guide-view'\)/);
  assert.ok(index.indexOf('home-open-guide') < index.indexOf('home-blocks'));
  assert.match(prepare, /ios-guide\.js/);
  assert.match(guide, /const GUIDE =/);
  assert.match(guide, /document\.createElement\('details'\)/);
  assert.match(guide, /document\.createElement\('summary'\)/);
  assert.match(guide, /TifloLector: voces y ajustes|TifloLector: voices and settings/);
  assert.doesNotMatch(guide, /innerHTML/);
});

test('iOS offers refresh status, CDN cache bypass and official home-screen icon generation', async () => {
  const [index, workflow, prepare, native, refresh] = await Promise.all([
    read('index.html'),
    read('.github/workflows/ios-testflight.yml'),
    read('ios-build/prepare-web.mjs'),
    read('ios-build/native/TifloYouTubeViewController.swift'),
    read('ios-build/ios-new-content-refresh.js')
  ]);
  assert.match(index, /id="news-refresh-button"/);
  assert.match(index, /id="news-refresh-status" role="status" aria-live="polite"/);
  assert.match(refresh, /tiflo-refresh-novedades-request/);
  assert.match(refresh, /tiflo-refresh-novedades-result/);
  assert.match(prepare, /tiflo-refresh-novedades-request/);
  assert.match(prepare, /ios-new-content-refresh\.js/);
  assert.match(native, /"mobile-content\.json"/);
  assert.match(native, /"\?refresh="/);
  assert.match(workflow, /swift make-app-icon\.swift/);
  assert.match(workflow, /tifloacosta-icon-512\.png/);
  assert.match(workflow, /AppIcon-512@2x\.png/);
});

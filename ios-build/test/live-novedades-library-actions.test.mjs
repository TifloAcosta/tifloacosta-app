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
  assert.match(source, /reading-library-more-actions/);
  assert.match(source, /reading-library-more-panel/);
  assert.match(source, /reading-library-delete/);
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

test('iOS recovers dated Novedades independently if primary data.js is blocked', async () => {
  const [prepare, refresh] = await Promise.all([
    read('ios-build/prepare-web.mjs'),
    read('ios-build/ios-new-content-refresh.js')
  ]);
  assert.match(prepare, /const independentNewsRecovery = \[/);
  assert.match(prepare, /Mobile news feed unavailable/);
  assert.match(prepare, /Invalid resource catalog/);
  assert.match(prepare, /source: 'mobile-feed'/);
  assert.match(prepare, /renderFavoritesScreen\(\)/);
  assert.match(prepare, /tiflo-resources-updated/);
  assert.match(prepare, /ok: false/);
  assert.match(refresh, /source === 'mobile-feed'/);
  assert.match(refresh, /Novedades cargadas/);
});

test('TifloLector iOS uses one document/image importer without duplicated OCR entry', async () => {
  const [index, parity] = await Promise.all([
    read('index.html'),
    read('ios-build/ios-parity.js')
  ]);
  assert.match(index, /id="reading-file" type="file"/);
  assert.match(index, /image\/png,image\/jpeg,image\/webp/);
  assert.match(index, /id="reading-ocr" type="button" hidden/);
  assert.doesNotMatch(index, /id="reading-paste"/);
  assert.doesNotMatch(parity, /ios-ocr-import/);
  assert.doesNotMatch(parity, /OCR: abrir imagen o PDF escaneado/);
  assert.match(parity, /Images and scanned PDFs already use the main document import control/);
});

test('TifloLector iOS integrates the complete reading queue within the library filter', async () => {
  const [index, reader, guide] = await Promise.all([
    read('index.html'),
    read('web-reading.js'),
    read('ios-build/ios-guide.js')
  ]);
  for (const value of ['all', 'recent', 'in-reading', 'not-read', 'read', 'queue']) {
    assert.match(index, new RegExp('<option value="' + value + '">'));
  }
  assert.match(index, /id="reading-library-queue-panel" hidden/);
  assert.doesNotMatch(index, /data-reading-view="reading-queue-web"/);
  assert.doesNotMatch(index, /id="reading-queue-web"/);
  assert.match(reader, /libraryQueuePanel\.hidden = !queueView/);
  assert.match(reader, /els\.libraryList\.hidden = queueView/);
  assert.match(reader, /sort: view === 'recent' \? 'imported' : 'lastRead'/);
  assert.match(reader, /status,/);
  assert.match(reader, /els\.libraryFilter\?\.addEventListener\('change'/);
  assert.match(reader, /await renderQueue\(\)/);
  assert.match(reader, /libraryClient\.moveQueueItem/);
  assert.match(reader, /libraryClient\.removeFromQueue/);
  assert.match(guide, /Mi biblioteca permanece a la vista/);
  assert.match(guide, /Recently imported/);
});

test('iOS TifloLector starts with import, collapsed reading settings and visible library', async () => {
  const [index, reader, parity] = await Promise.all([
    read('index.html'), read('web-reading.js'), read('ios-build/ios-parity.js')
  ]);
  const section = index.slice(index.indexOf('<section id="reading-section"'), index.indexOf('<section id="news-view"'));
  assert.ok(section.indexOf('id="reading-file"') < section.indexOf('id="reading-settings-disclosure"'));
  assert.ok(section.indexOf('id="reading-settings-disclosure"') < section.indexOf('id="reading-library-web"'));
  assert.match(section, /<section id="reading-library-web" class="panel" aria-labelledby="reading-library-heading">/);
  assert.doesNotMatch(section, /id="reading-start-heading"|id="reading-management-web"|id="reading-prepare"|id="reading-paste"|id="reading-intro"|id="reading-library-refresh"/);
  assert.doesNotMatch(section, /data-reading-view="reading-library-web"/);
  assert.match(section, /<details id="reading-settings-disclosure"/);
  assert.ok(section.indexOf('data-reading-view="reading-audio-view"') < section.indexOf('data-reading-view="reading-visual-view"'));
  assert.ok(section.indexOf('data-reading-view="reading-visual-view"') < section.indexOf('id="reading-general-settings"'));
  const general = section.slice(section.indexOf('id="reading-general-settings"'), section.indexOf('id="reading-settings-status"'));
  assert.match(general, /id="reading-formats-disclosure"/);
  assert.match(general, /id="reading-formats-list"/);
  assert.match(general, /id="reading-default-navigation"/);
  assert.ok(section.indexOf('id="reading-library-list"') < section.indexOf('data-reading-view="reading-marks-web"'));
  assert.match(section, /<option value="all">Todos los documentos<\/option>/);
  assert.doesNotMatch(reader, /els\.prepare|els\.paste|function prepareReading\(/);
  assert.match(reader, /readerReturnBookId = String\(id\)/);
  assert.match(reader, /title\.focus\(\{ preventScroll: true \}\)/);
  assert.doesNotMatch(parity, /ios-reading-settings-disclosure|ios-reading-default-unit/);
  assert.match(parity, /tifloWebReadingSettingsV1/);
});

test('iOS guide accurately describes the compact reader navigation and existing OCR', async () => {
  const guide = await read('ios-build/ios-guide.js');
  assert.match(guide, /Mi biblioteca permanece a la vista/);
  assert.match(guide, /cuadro para pegar textos/);
  assert.match(guide, /General puedes establecer una única unidad de avance/);
  assert.match(guide, /My library is visible by default/);
  assert.match(guide, /Bookmarks button follows the titles/);
  assert.match(guide, /gestos verticales personalizados de VoiceOver/);
});

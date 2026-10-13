import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const html = read('index.html');
const reader = read('web-reading.js');

test('reader library has pagination that follows filter/search state', () => {
  for (const id of [
    'reading-library-filter','reading-library-query','reading-library-pager',
    'reading-library-page-status','reading-library-prev-page','reading-library-next-page'
  ]) assert.ok(html.includes('id="' + id + '"'), 'Missing ' + id);
  assert.match(reader, /let libraryPage = 1/);
  assert.match(reader, /page: libraryPage, pageSize, query, status/);
  assert.match(reader, /sort: isRecentView \? 'imported' : 'lastRead'/);
  assert.match(reader, /filteredQueue\.slice\(\(libraryPage - 1\) \* pageSize, libraryPage \* pageSize\)/);
  assert.match(reader, /libraryPage = 1; void renderLibrary\(\)/);
  assert.match(reader, /token !== libraryRenderToken/);
  assert.match(reader, /libraryPage >= pages/);
});

test('book marks restore all types supported by the native reader without data migration', () => {
  for (const type of ['bookmark','important','review','quote']) {
    assert.ok(html.includes('option value="' + type + '"'), 'Missing mark type ' + type);
  }
  assert.ok(html.includes('id="reading-marks-add"'));
  assert.match(reader, /async function addBookmark\(type = 'bookmark'\)/);
  assert.match(reader, /libraryClient\.listMarks\(currentBookId\)/);
  assert.match(reader, /returnToReadingMainFromSubview\(\);\s*enterReaderOnlyView\(\)/);
  assert.match(reader, /void addBookmark\(els\.marksType\?\.value \|\| 'bookmark'\)/);
  const client = read('shared/reading-library-client.mjs');
  const storage = read('shared/web-reading-library-adapter.mjs');
  assert.ok(client.includes("'important', 'review', 'quote'"));
  assert.ok(storage.includes("'important', 'review', 'quote'"));
});

test('all structural navigation options are available as a default and per document', () => {
  const ios = read('ios-build/ios-parity.js');
  for (const key of ['heading','mainHeading','listItem','quote','tableCell']) {
    assert.ok(html.includes('option value="' + key + '"'));
    assert.ok(reader.includes("['" + key + "'"));
    assert.ok(ios.includes("'" + key + "'"));
  }
  assert.match(reader, /shared\.adjacentWebReadingStructure\(/);
  assert.match(reader, /No hay más elementos de ese tipo en esa dirección/);
});

test('publication remains manually guarded pending DAISY and native VoiceOver actions', () => {
  const workflow = read('.github/workflows/ios-testflight.yml');
  const prepare = read('ios-build/prepare-web.mjs');
  assert.match(workflow, /on:\s*\n\s+workflow_dispatch:/);
  // Only the explicit, isolated internal canary branch may launch a beta.
  assert.match(workflow, /push:\s*\n\s+branches: \[release\/ios-tiflolector-interno-20261013\]/);
  assert.doesNotMatch(workflow.slice(0, workflow.indexOf('permissions:')), /branches: \[(?!release\/ios-tiflolector-interno-20261013)/);
  assert.match(prepare, /BLOQUEO PREVENTIVO iOS/);
  assert.match(prepare, /TifloReadingAccessibilityPlugin\.swift/);
});

test('MP3 retains accessible ten-second controls without stale document actions', () => {
  assert.match(reader, /function setReaderAudioOnlyMode\(audioOnly\)/);
  assert.match(reader, /els\.previous\.hidden = !audioOnly/);
  assert.match(reader, /els\.next\.hidden = !audioOnly/);
  assert.match(reader, /node\.dataset\.readerPreviousHidden/);
  assert.match(reader, /setReaderAudioOnlyMode\(true\)/);
  assert.match(reader, /setReaderAudioOnlyMode\(false\)/);
  assert.match(reader, /activeAudio\.currentTime = Math\.max\(0, activeAudio\.currentTime - 10\)/);
  assert.match(reader, /activeAudio\.currentTime = Math\.min\(/);
  assert.match(reader, /No se pudo iniciar la reproducción del audio/);
});

test('navigation does not silently fall back to wrong units when helper is missing', () => {
  assert.match(reader, /typeof shared\.adjacentWebReadingStructure !== 'function'/);
  assert.match(reader, /La posición no se ha modificado/);
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('web reading library adapter uses IndexedDB stores for books marks settings and derived content', async () => {
  const source = await read('shared/web-reading-library-adapter.mjs');
  assert.ok(source.includes("DB_NAME = 'tifloacosta-reading-web'"));
  for (const store of ['books', 'marks', 'settings', 'derived']) {
    assert.ok(source.includes(`createObjectStore('${store}'`), `Missing IndexedDB store ${store}`);
  }
  for (const method of [
    'importDocument',
    'listBooks',
    'openBook',
    'saveProgress',
    'deleteBook',
    'listQueue',
    'addToQueue',
    'removeFromQueue',
    'moveQueueItem',
    'listMarks',
    'addMark',
    'deleteMark',
    'getReadingSettings',
    'setReadingSetting',
    'saveDerivedContent'
  ]) {
    assert.ok(source.includes(method), `Missing web library method ${method}`);
  }
});

test('web reader connects persistent storage through the shared reading library client', async () => {
  const source = await read('web-reading.js');
  assert.ok(source.includes('createWebReadingLibraryAdapter'));
  assert.ok(source.includes('createReadingLibraryClient'));
  assert.ok(source.includes('libraryAdapter.importDocument'));
  assert.ok(source.includes('libraryClient.listBooks'));
  assert.ok(source.includes('libraryClient.openBook'));
  assert.ok(source.includes('libraryClient.saveProgress'));
  assert.ok(source.includes('libraryClient.deleteBook'));
});

test('web reader exposes accessible local-library controls', async () => {
  const html = await read('index.html');
  for (const id of [
    'reading-save',
    'reading-library-web',
    'reading-library-heading',
    'reading-library-refresh',
    'reading-library-status',
    'reading-library-list'
  ]) {
    assert.ok(html.includes(`id="${id}"`), `Missing web library control ${id}`);
  }
  assert.ok(html.includes('aria-live="polite"'));
});

test('privacy policy explains that TifloReader documents stay local in the browser', async () => {
  const [home, policy] = await Promise.all([read('index.html'), read('privacidad/index.html')]);
  assert.ok(home.includes('los documentos que decidas guardar'));
  assert.ok(policy.includes('biblioteca web de <strong>TifloLector</strong>'));
  assert.ok(policy.includes('no se envían a una base de datos de TifloAcosta'));
  assert.ok(policy.includes('web TifloReader library'));
  assert.ok(policy.includes('stored locally in the browser'));
});


test('web reader exposes bookmark and queue controls backed by the shared library client', async () => {
  const [html, source] = await Promise.all([read('index.html'), read('web-reading.js')]);
  for (const id of [
    'reading-bookmark',
    'reading-queue-toggle',
    'reading-queue-web',
    'reading-queue-list',
    'reading-marks-web',
    'reading-marks-list'
  ]) {
    assert.ok(html.includes(`id="${id}"`), `Missing reading control ${id}`);
  }
  for (const token of [
    'libraryClient.addMark',
    'libraryClient.listMarks',
    'libraryClient.deleteMark',
    'libraryClient.listQueue',
    'libraryClient.addToQueue',
    'libraryClient.removeFromQueue',
    'libraryClient.moveQueueItem'
  ]) {
    assert.ok(source.includes(token), `Missing shared library operation ${token}`);
  }
  assert.ok(source.includes('Nada se abrirá automáticamente.'));
  assert.ok(source.includes('Nothing opens automatically.'));
});

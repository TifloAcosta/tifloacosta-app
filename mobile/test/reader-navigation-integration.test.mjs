import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('links kept by the normal reader re-enter the common loader and dispatch by final type', async () => {
  const app = await read('src/app.mjs');
  assert.match(app, /function openReaderLink\(url, originId = ''\)[\s\S]{0,120}loadReaderUrl\(url, \{ originId \}\)/);
  assert.match(app, /async function loadReaderUrl/);
  assert.match(app, /loadReadableTarget\(\{/);
  assert.match(app, /result\.kind === 'youtube'[\s\S]{0,160}openDirectVideo/);
  assert.match(app, /result\.kind === 'download'[\s\S]{0,180}openNormalDownload/);
  assert.match(app, /result\.kind === 'readable'[\s\S]{0,160}readerSession\.push\(result\.page\)/);
});

test('reader responses are generation guarded so stale async loads cannot replace newer navigation', async () => {
  const app = await read('src/app.mjs');
  assert.match(app, /const request = readerSession\.beginRequest\(\)/);
  assert.match(app, /if \(!readerSession\.isCurrentRequest\(request\)\) return false/);
  assert.match(app, /if \(!readerSession\.isCurrentRequest\(request\)\) return;/);
});

test('Back inside the normal reader consumes internal history before leaving the reader route', async () => {
  const reader = await read('src/screens/reader.mjs');
  assert.match(reader, /if \(current\.pages\.length > 1\)[\s\S]{0,200}session\.pop\(\)/);
  assert.match(reader, /return router\.back\(\)/);

  const app = await read('src/app.mjs');
  assert.match(app, /router\.current\(\)\?\.name === 'reader'[\s\S]{0,100}readerController\?\.back/);
});

test('video and download destinations opened from a reader preserve the activating link id as router origin', async () => {
  const app = await read('src/app.mjs');
  assert.match(app, /openDirectVideo\(result\.classification, originId\)/);
  assert.match(app, /openNormalDownload\(result\.classification\?\.url \|\| url, originId\)/);
  assert.match(app, /router\.navigate\('direct-video', \{ originId: originId \|\| null \}\)/);
  assert.match(app, /router\.navigate\('downloads-link', \{ originId: originId \|\| null \}\)/);
});

test('a failed nested reader link is announced while the current readable page remains available', async () => {
  const reader = await read('src/screens/reader.mjs');
  assert.match(reader, /if \(state\.error && page\)[\s\S]{0,700}setAttribute\('role', 'status'\)/);
  assert.match(reader, /if \(state\.error && page\)[\s\S]{0,700}t\('reader\.error'\)/);
  assert.match(reader, /if \(state\.error && page\)[\s\S]{0,900}t\('reader\.retry'\)/);
});

test('retry after a nested reader failure targets the failed URL, not the page already on screen', async () => {
  const reader = await read('src/screens/reader.mjs');
  assert.match(reader, /retry\.addEventListener\('click', \(\) => onRetry\(state\.error\?\.url \|\| state\.url\)\)/);

  const app = await read('src/app.mjs');
  assert.match(app, /onRetry: target => \{ void loadReaderUrl\(target \|\| readerSession\.snapshot\(\)\.error\?\.url \|\| readerSession\.snapshot\(\)\.url\); \}/);
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('shared screen header groups Back and H1 in one reusable spaced header', async () => {
  const source = await read('src/screens/shared.mjs');

  assert.match(source, /document\.createElement\('header'\)/);
  assert.match(source, /header\.className = 'screen-header'/);
  assert.match(source, /header\.append\(back, heading\)/);
  assert.match(source, /root\.append\(header\)/);
  assert.match(source, /return \{ back, heading, header \}/);
});

test('shared screen heading keeps the existing TalkBack focus target and Back behavior', async () => {
  const source = await read('src/screens/shared.mjs');

  assert.match(source, /heading\.dataset\.screenHeading = ''/);
  assert.match(source, /heading\.tabIndex = -1/);
  assert.match(source, /back\.addEventListener\('click', \(\) => router\.back\(\)\)/);
  assert.doesNotMatch(source, /autofocus/i);
});

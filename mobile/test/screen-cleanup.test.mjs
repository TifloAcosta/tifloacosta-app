import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');

test('composition root runs the previous screen cleanup before rendering a new route', () => {
  assert.match(source, /activeScreenCleanup/);
  assert.match(source, /setScreenCleanup/);
  assert.match(source, /activeScreenCleanup\?\.\(\)/);
});

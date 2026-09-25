import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/screens/update.mjs', import.meta.url), 'utf8');

test('update screen exposes the existing focus-heading convention', () => {
  assert.match(source, /createElement\('h1'\)/);
  assert.match(source, /dataset\.screenHeading/);
  assert.match(source, /tabIndex = -1/);
});

test('update screen has explicit update and later actions in Spanish', () => {
  assert.match(source, /data-action/);
  assert.match(source, /Actualizar ahora/);
  assert.match(source, /Más tarde/);
});

test('update screen also contains English labels', () => {
  assert.match(source, /Update now/);
  assert.match(source, /Later/);
});

test('immediate mode omits the later button', () => {
  assert.match(source, /state\.mode !== 'immediate'/);
});

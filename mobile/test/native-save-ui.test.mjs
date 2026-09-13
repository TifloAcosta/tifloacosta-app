import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('library exposes a text-labelled native save action for each resource', async () => {
  const source = await readFile(new URL('../src/screens/library.mjs', import.meta.url), 'utf8');
  assert.match(source, /t\('saveFile'\)/);
  assert.match(source, /item\.downloadUrl \|\| item\.url/);
  assert.match(source, /saveFile\(/);
});

test('app registers the local SaveFile plugin and injects the save service', async () => {
  const source = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  assert.match(source, /registerPlugin\('SaveFile'\)/);
  assert.match(source, /saveRemoteFile/);
  assert.match(source, /\n\s*saveFile,\n/);
});

test('save action has Spanish and English text', async () => {
  const source = await readFile(new URL('../src/core/i18n.mjs', import.meta.url), 'utf8');
  assert.match(source, /saveFile: 'Guardar archivo'/);
  assert.match(source, /saveFile: 'Save file'/);
});

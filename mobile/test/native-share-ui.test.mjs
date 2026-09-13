import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { text } from '../src/core/i18n.mjs';

test('share action has explicit bilingual labels', () => {
  assert.equal(text('es', 'share'), 'Compartir');
  assert.equal(text('en', 'share'), 'Share');
});

test('share service is passed to the content screens', async () => {
  const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  assert.match(app, /createShareService/);
  assert.match(app, /share:\s*shareService/);
});

for (const screen of ['library', 'videos', 'actualidad']) {
  test(`${screen} exposes a text share action`, async () => {
    const source = await readFile(new URL(`../src/screens/${screen}.mjs`, import.meta.url), 'utf8');
    assert.match(source, /t\('share'\)/);
    assert.match(source, /share\.shareLink/);
  });
}
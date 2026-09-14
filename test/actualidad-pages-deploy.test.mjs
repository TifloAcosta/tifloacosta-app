import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflow = await readFile(new URL('../.github/workflows/jekyll-gh-pages.yml', import.meta.url), 'utf8');

test('general Pages deployment synchronizes Actualidad before building the site', () => {
  const syncIndex = workflow.indexOf('node scripts/sync-actualidad.mjs');
  const buildIndex = workflow.indexOf('actions/jekyll-build-pages@v1');

  assert.notEqual(syncIndex, -1, 'The general Pages workflow must synchronize Actualidad.');
  assert.notEqual(buildIndex, -1, 'The Jekyll build step must remain present.');
  assert.ok(syncIndex < buildIndex, 'Actualidad must be synchronized before the Jekyll site is built.');
});

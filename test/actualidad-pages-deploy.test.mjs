import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

const generalPages = await read('.github/workflows/jekyll-gh-pages.yml');
const actualidadSync = await read('.github/workflows/sync-actualidad.yml');

test('general Pages deployment synchronizes Actualidad before building the site', () => {
  const syncIndex = generalPages.indexOf('node scripts/sync-actualidad.mjs');
  const buildIndex = generalPages.indexOf('actions/jekyll-build-pages@v1');

  assert.notEqual(syncIndex, -1, 'The general Pages workflow must synchronize Actualidad.');
  assert.notEqual(buildIndex, -1, 'The Jekyll build step must remain present.');
  assert.ok(syncIndex < buildIndex, 'Actualidad must be synchronized before the Jekyll site is built.');
});

test('dedicated Actualidad deployment synchronizes before detecting changes and deploying', () => {
  const syncIndex = actualidadSync.indexOf('node scripts/sync-actualidad.mjs');
  const changeIndex = actualidadSync.indexOf('Detect Actualidad changes');
  const deployIndex = actualidadSync.indexOf('actions/deploy-pages@v4');

  assert.notEqual(syncIndex, -1, 'The dedicated workflow must synchronize Actualidad.');
  assert.notEqual(changeIndex, -1, 'The dedicated workflow must detect the synchronized JSON change.');
  assert.notEqual(deployIndex, -1, 'The dedicated workflow must keep its Pages deployment step.');
  assert.ok(syncIndex < changeIndex, 'Synchronization must happen before change detection.');
  assert.ok(changeIndex < deployIndex, 'Only the synchronized result may reach Pages deployment.');
});

test('both deployment paths use the same synchronization script', () => {
  const command = 'node scripts/sync-actualidad.mjs';
  assert.equal((generalPages.match(new RegExp(command.replaceAll('.', '\\.'), 'g')) || []).length, 1);
  assert.equal((actualidadSync.match(new RegExp(command.replaceAll('.', '\\.'), 'g')) || []).length >= 2, true);
});

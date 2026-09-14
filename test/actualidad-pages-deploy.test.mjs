import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

const generalPages = await read('.github/workflows/jekyll-gh-pages.yml');
const actualidadSync = await read('.github/workflows/sync-actualidad.yml');

test('general Pages deployment synchronizes all Actualidad catalogs before building the site', () => {
  const newsIndex = generalPages.indexOf('node scripts/sync-actualidad.mjs');
  const appsIndex = generalPages.indexOf('node scripts/sync-actualidad-apps.mjs');
  const mediaIndex = generalPages.indexOf('node scripts/sync-actualidad-media.mjs');
  const buildIndex = generalPages.indexOf('actions/jekyll-build-pages@v1');

  assert.notEqual(newsIndex, -1);
  assert.notEqual(appsIndex, -1);
  assert.notEqual(mediaIndex, -1, 'The general Pages workflow must synchronize Multimedia.');
  assert.notEqual(buildIndex, -1);
  assert.ok(newsIndex < appsIndex && appsIndex < mediaIndex && mediaIndex < buildIndex);
});

test('dedicated Actualidad deployment synchronizes multimedia before detecting changes and deploying', () => {
  const mediaIndex = actualidadSync.indexOf('node scripts/sync-actualidad-media.mjs');
  const changeIndex = actualidadSync.indexOf('Detect Actualidad changes');
  const deployIndex = actualidadSync.indexOf('actions/deploy-pages@v4');

  assert.notEqual(mediaIndex, -1, 'The dedicated workflow must synchronize Multimedia.');
  assert.notEqual(changeIndex, -1);
  assert.notEqual(deployIndex, -1);
  assert.ok(mediaIndex < changeIndex);
  assert.ok(changeIndex < deployIndex);
  assert.match(actualidadSync, /git status --porcelain -- actualidad\.json actualidad-apps\.json actualidad-media\.json/);
  assert.match(actualidadSync, /git add actualidad\.json actualidad-apps\.json actualidad-media\.json/);
});

test('multimedia synchronization receives the existing YouTube secret without hardcoding it', () => {
  assert.match(generalPages, /YOUTUBE_API_KEY: \$\{\{ secrets\.YOUTUBE_API_KEY \}\}/);
  assert.match(actualidadSync, /YOUTUBE_API_KEY: \$\{\{ secrets\.YOUTUBE_API_KEY \}\}/);
  assert.doesNotMatch(generalPages, /AIza[0-9A-Za-z_-]+/);
  assert.doesNotMatch(actualidadSync, /AIza[0-9A-Za-z_-]+/);
});

test('Actualidad source validation triggers on multimedia configuration and synchronizer changes', () => {
  for (const pattern of [
    /- 'actualidad-core\.js'/,
    /- 'actualidad-media-sources\.json'/,
    /- 'actualidad-media-editorial\.json'/,
    /- 'scripts\/sync-actualidad-media\.mjs'/
  ]) assert.match(actualidadSync, pattern);
});

test('both deployment paths preserve the written Actualidad synchronization race protection', () => {
  const command = 'node scripts/sync-actualidad.mjs';
  assert.equal((generalPages.match(new RegExp(command.replaceAll('.', '\\.'), 'g')) || []).length, 1);
  assert.equal((actualidadSync.match(new RegExp(command.replaceAll('.', '\\.'), 'g')) || []).length >= 2, true);
});

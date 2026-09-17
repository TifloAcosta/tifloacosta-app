import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const require = createRequire(import.meta.url);
const core = require('../actualidad-core.js');

test('navigation state isolates home subsections from global chrome', () => {
  assert.equal(typeof core.resolveIsolatedView, 'function');
  assert.deepEqual(core.resolveIsolatedView('home', '#resources'), {
    view: 'resources-view',
    parent: 'home',
    chromeVisible: false
  });
  assert.deepEqual(core.resolveIsolatedView('home', '#home'), {
    view: 'home',
    parent: null,
    chromeVisible: true
  });
});

test('navigation state treats Actualidad sections and media subsections as separate screens', () => {
  assert.equal(typeof core.resolveIsolatedView, 'function');
  assert.deepEqual(core.resolveIsolatedView('actualidad', '#apps-browser'), {
    view: 'apps-browser',
    parent: 'actualidad-home',
    chromeVisible: false
  });
  assert.deepEqual(core.resolveIsolatedView('actualidad', '#media-technology'), {
    view: 'media-technology',
    parent: 'media-browser',
    chromeVisible: false
  });
  assert.deepEqual(core.resolveIsolatedView('actualidad', ''), {
    view: 'actualidad-home',
    parent: null,
    chromeVisible: false
  });
});

test('video catalogue hides global page chrome because it is already a dedicated screen', async () => {
  const source = await readFile(new URL('../videos-core.js', import.meta.url), 'utf8');
  assert.match(source, /hideDedicatedPageChrome/);
  assert.match(source, /\.site-header/);
  assert.match(source, /\.site-footer/);
  assert.match(source, /\.skip-link/);
});

test('nested media views hide the parent-level Actualidad back controls', async () => {
  const source = await readFile(new URL('../actualidad-core.js', import.meta.url), 'utf8');
  assert.match(source, /mediaRootBackControls/);
  assert.match(source, /wrapper\.hidden\s*=\s*!mediaRoot/);
});

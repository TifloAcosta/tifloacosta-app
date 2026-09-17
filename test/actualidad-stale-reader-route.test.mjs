import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const core = require('../actualidad-core.js');

test('stale news-reader hash falls back to visible news instead of a blank screen', () => {
  assert.deepEqual(core.resolveIsolatedView('actualidad', '#news-reader'), {
    view: 'news-browser',
    parent: 'actualidad-home',
    chromeVisible: false
  });
});

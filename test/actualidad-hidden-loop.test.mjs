import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const core = require('../actualidad-core.js');

test('Actualidad visibility updates do not rewrite an unchanged hidden state', () => {
  assert.equal(typeof core.setElementHidden, 'function');

  let hidden = true;
  let writes = 0;
  const element = {
    get hidden() {
      return hidden;
    },
    set hidden(value) {
      writes += 1;
      hidden = Boolean(value);
    }
  };

  core.setElementHidden(element, true);
  assert.equal(writes, 0, 'an unchanged hidden state must not be written again');

  core.setElementHidden(element, false);
  assert.equal(writes, 1, 'a real visibility change must be written once');

  core.setElementHidden(element, false);
  assert.equal(writes, 1, 'repeating the same visible state must stay idempotent');
});

// Regression target: repeated writes to hidden must not be able to retrigger the observer indefinitely in Safari/WebKit.

import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseUpdateMode } from '../src/core/update-policy.mjs';

test('priority 5 can use immediate when Play allows it', () => {
  assert.equal(chooseUpdateMode({ available: true, priority: 5, immediateAllowed: true, flexibleAllowed: true }), 'immediate');
});

test('ordinary update prefers flexible', () => {
  assert.equal(chooseUpdateMode({ available: true, priority: 2, flexibleAllowed: true }), 'flexible');
});

test('unavailable update produces none', () => {
  assert.equal(chooseUpdateMode({ available: false }), 'none');
});

test('priorities below 5 never force an immediate update', () => {
  for (const priority of [0, 1, 2, 3, 4]) {
    assert.equal(
      chooseUpdateMode({ available: true, priority, flexibleAllowed: false, immediateAllowed: true }),
      'none'
    );
  }
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { createRouter } from '../src/core/router.mjs';
import { focusScreenHeading, restoreOriginFocus } from '../src/core/focus.mjs';

test('back returns to previous route and preserves origin id', () => {
  const renders = [];
  const restored = [];
  const router = createRouter({
    render: route => renders.push(route),
    focusScreenHeading: () => {},
    restoreOriginFocus: originId => restored.push(originId)
  });
  router.start('home');
  router.navigate('search');
  router.navigate('library', { originId: 'result-resource-r1' });
  assert.equal(router.back(), true);
  assert.equal(router.current().name, 'search');
  assert.equal(renders.at(-1).name, 'search');
  assert.deepEqual(restored, ['result-resource-r1']);
});

test('back at root is silent', () => {
  let renders = 0;
  const router = createRouter({
    render: () => { renders += 1; },
    focusScreenHeading: () => {},
    restoreOriginFocus: () => {}
  });
  router.start('home');
  assert.equal(router.back(), false);
  assert.equal(renders, 1);
});

test('focus helpers target heading and origin without timers', () => {
  let headingFocused = false;
  let originFocused = false;
  const root = {
    querySelector(selector) {
      if (selector === '[data-screen-heading]') return { focus: () => { headingFocused = true; } };
      if (selector === '#result-resource-r1') return { focus: () => { originFocused = true; } };
      return null;
    }
  };
  globalThis.CSS = { escape: value => value };
  assert.equal(focusScreenHeading(root), true);
  assert.equal(restoreOriginFocus(root, 'result-resource-r1'), true);
  assert.equal(restoreOriginFocus(root, 'missing'), false);
  assert.equal(headingFocused, true);
  assert.equal(originFocused, true);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { createRouter } from '../src/core/router.mjs';
import { focusScreenHeading, restoreOriginFocus } from '../src/core/focus.mjs';

test('router starts on one screen and focuses its heading', () => {
  const renders = [];
  let headingFocuses = 0;
  const router = createRouter({
    render: route => renders.push(route),
    focusScreenHeading: () => { headingFocuses += 1; },
    restoreOriginFocus: () => {}
  });

  router.start('home');

  assert.deepEqual(router.current(), { name: 'home', originId: null });
  assert.deepEqual(renders, [{ name: 'home', originId: null }]);
  assert.equal(headingFocuses, 1);
});

test('navigate pushes a screen and back restores the origin on the previous screen', () => {
  const renders = [];
  const restored = [];
  let headingFocuses = 0;
  const router = createRouter({
    render: route => renders.push(route),
    focusScreenHeading: () => { headingFocuses += 1; },
    restoreOriginFocus: originId => restored.push(originId)
  });

  router.start('home');
  router.navigate('search', { originId: 'home-search' });
  router.navigate('library', { originId: 'result-resource-r1' });

  assert.deepEqual(router.current(), { name: 'library', originId: 'result-resource-r1' });
  assert.equal(headingFocuses, 3);

  assert.equal(router.back(), true);
  assert.deepEqual(router.current(), { name: 'search', originId: 'home-search' });
  assert.deepEqual(renders.at(-1), { name: 'search', originId: 'home-search' });
  assert.deepEqual(restored, ['result-resource-r1']);
});

test('back at home returns false without rendering or moving focus', () => {
  let renders = 0;
  let headingFocuses = 0;
  let restorations = 0;
  const router = createRouter({
    render: () => { renders += 1; },
    focusScreenHeading: () => { headingFocuses += 1; },
    restoreOriginFocus: () => { restorations += 1; }
  });

  router.start('home');
  assert.equal(router.back(), false);
  assert.equal(renders, 1);
  assert.equal(headingFocuses, 1);
  assert.equal(restorations, 0);
});

test('focusScreenHeading focuses the screen heading when present', () => {
  let focused = false;
  const heading = { focus: () => { focused = true; } };
  const root = {
    querySelector: selector => selector === '[data-screen-heading]' ? heading : null
  };

  assert.equal(focusScreenHeading(root), true);
  assert.equal(focused, true);
});

test('focusScreenHeading safely returns false when heading is missing', () => {
  const root = { querySelector: () => null };
  assert.equal(focusScreenHeading(root), false);
});

test('restoreOriginFocus focuses the requested control and handles missing controls', () => {
  let focused = false;
  const target = { focus: () => { focused = true; } };
  const root = {
    querySelector: selector => selector === '#result-resource-r1' ? target : null
  };

  assert.equal(restoreOriginFocus(root, 'result-resource-r1'), true);
  assert.equal(focused, true);
  assert.equal(restoreOriginFocus(root, 'missing-control'), false);
  assert.equal(restoreOriginFocus(root, ''), false);
});

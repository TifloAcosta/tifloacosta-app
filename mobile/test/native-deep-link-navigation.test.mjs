import assert from 'node:assert/strict';
import test from 'node:test';
import { createRouter } from '../src/core/router.mjs';

test('external entry returns to TifloAcosta home before leaving', () => {
  const renders = [];
  const router = createRouter({
    render: route => renders.push(route),
    focusScreenHeading: () => {},
    restoreOriginFocus: () => {}
  });

  router.start('home');
  router.navigate('videos');
  router.enterExternal('library');

  assert.equal(router.current().name, 'library');
  assert.equal(router.back(), true);
  assert.equal(router.current().name, 'home');
  assert.equal(renders.at(-1).name, 'home');
  assert.equal(router.back(), false);
});
import assert from 'node:assert/strict';
import test from 'node:test';
import { backgroundRefreshMode } from '../src/core/background-refresh.mjs';

test('background refresh rerenders when only the screen heading has focus', () => {
  const heading = { dataset: { screenHeading: '' } };
  const body = {};
  const root = {};

  assert.equal(backgroundRefreshMode({ activeElement: heading, body, root }), 'render-restore-heading');
});

test('background refresh rerenders silently when focus is not inside screen content', () => {
  const body = {};
  const root = {};

  assert.equal(backgroundRefreshMode({ activeElement: body, body, root }), 'render');
  assert.equal(backgroundRefreshMode({ activeElement: root, body, root }), 'render');
  assert.equal(backgroundRefreshMode({ activeElement: null, body, root }), 'render');
});

test('background refresh defers while another control has focus', () => {
  const activeControl = { dataset: {} };
  const body = {};
  const root = {};

  assert.equal(backgroundRefreshMode({ activeElement: activeControl, body, root }), 'defer');
});

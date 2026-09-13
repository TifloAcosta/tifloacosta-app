import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTifloAcostaUrl } from '../src/native/deep-links.mjs';

test('public TifloAcosta links map to app routes', () => {
  assert.equal(parseTifloAcostaUrl('https://tifloacosta.com/actualidad').route, 'actualidad');
  assert.equal(parseTifloAcostaUrl('https://tifloacosta.com/library').route, 'library');
  assert.equal(parseTifloAcostaUrl('https://tifloacosta.com/').route, 'home');
  assert.equal(parseTifloAcostaUrl('https://tifloacosta.com/configuracion').route, 'settings');
});

test('development scheme uses the same route parser', () => {
  assert.equal(parseTifloAcostaUrl('tifloacosta://actualidad').route, 'actualidad');
  assert.equal(parseTifloAcostaUrl('tifloacosta://library').route, 'library');
});

test('unknown TifloAcosta paths land safely on home', () => {
  assert.equal(parseTifloAcostaUrl('https://tifloacosta.com/algo-que-no-existe').route, 'home');
});

test('foreign links are not treated as internal deep links', () => {
  assert.equal(parseTifloAcostaUrl('https://example.com/actualidad'), null);
});

test('invalid URLs are ignored safely', () => {
  assert.equal(parseTifloAcostaUrl('not a url'), null);
});
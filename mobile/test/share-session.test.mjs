import assert from 'node:assert/strict';
import test from 'node:test';
import { createShareSession } from '../src/core/share-session.mjs';

test('new begin replaces every field from an older shared session and advances generation', () => {
  const session = createShareSession();
  session.begin({ text: 'https://first.example', urls: ['https://first.example/'] });
  const firstGeneration = session.snapshot().generation;
  session.selectUrl('https://first.example/');
  session.setClassification({ kind: 'web', url: 'https://first.example/' });
  session.pushReadable({ url: 'https://first.example/', title: 'First', blocks: [] });
  session.setView('readable');
  session.begin({ text: 'second', urls: [] });
  const state = session.snapshot();
  assert.equal(state.text, 'second');
  assert.deepEqual(state.urls, []);
  assert.equal(state.selectedUrl, '');
  assert.equal(state.classification, null);
  assert.deepEqual(state.readableHistory, []);
  assert.equal(state.view, 'received');
  assert.ok(state.generation > firstGeneration);
});

test('begin advances generation even when the shared text is identical', () => {
  const session = createShareSession();
  session.begin({ text: 'same', urls: [] });
  const first = session.snapshot().generation;
  session.begin({ text: 'same', urls: [] });
  assert.equal(session.snapshot().generation, first + 1);
});

test('readable history backs up one page at a time', () => {
  const session = createShareSession();
  session.begin({ text: 'x', urls: ['https://one.example/'] });
  session.pushReadable({ url: 'https://one.example/', title: 'One', blocks: [] });
  session.pushReadable({ url: 'https://two.example/', title: 'Two', blocks: [] });
  const current = session.popReadable();
  assert.equal(current.url, 'https://one.example/');
  assert.equal(session.snapshot().readableHistory.length, 1);
});

test('snapshot returns copies that cannot mutate session state', () => {
  const session = createShareSession();
  session.begin({ text: 'x', urls: ['https://one.example/'] });
  const state = session.snapshot();
  state.urls.push('https://evil.example/');
  assert.deepEqual(session.snapshot().urls, ['https://one.example/']);
});

test('clear removes shared state and advances generation to invalidate stale async work', () => {
  const session = createShareSession();
  session.begin({ text: 'x', urls: [] });
  const before = session.snapshot().generation;
  session.clear();
  const state = session.snapshot();
  assert.equal(state.active, false);
  assert.equal(state.text, '');
  assert.equal(state.generation, before + 1);
});

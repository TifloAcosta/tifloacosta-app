import assert from 'node:assert/strict';
import test from 'node:test';
import { createReaderSession } from '../src/core/reader-session.mjs';

test('reader keeps a temporary page stack and backs up one page at a time', () => {
  const session = createReaderSession();
  session.begin({ url: 'https://one.test', title: 'One', allowOriginalFallback: true });
  session.push({ url: 'https://one.test', title: 'One', blocks: [] });
  session.push({ url: 'https://two.test', title: 'Two', blocks: [] });
  assert.equal(session.snapshot().pages.length, 2);
  assert.equal(session.pop().url, 'https://one.test');
  assert.equal(session.snapshot().pages.length, 1);
});

test('starting a new reader entry invalidates an older pending request', () => {
  const session = createReaderSession();
  session.begin({ url: 'https://one.test', title: 'One', allowOriginalFallback: true });
  const oldRequest = session.beginRequest();
  assert.equal(session.isCurrentRequest(oldRequest), true);
  session.begin({ url: 'https://two.test', title: 'Two', allowOriginalFallback: true });
  assert.equal(session.isCurrentRequest(oldRequest), false);
});

test('a newer request inside the same reader entry invalidates the previous request', () => {
  const session = createReaderSession();
  session.begin({ url: 'https://one.test', title: 'One' });
  const first = session.beginRequest();
  const second = session.beginRequest();
  assert.equal(session.isCurrentRequest(first), false);
  assert.equal(session.isCurrentRequest(second), true);
});

test('reader snapshots cannot mutate stored page blocks', () => {
  const session = createReaderSession();
  session.begin({ url: 'https://one.test', title: 'One' });
  session.push({ url: 'https://one.test', title: 'One', blocks: [{ type: 'paragraph', parts: [{ type: 'text', text: 'Safe' }] }] });
  const state = session.snapshot();
  state.pages[0].blocks[0].parts[0].text = 'Mutated';
  assert.equal(session.snapshot().pages[0].blocks[0].parts[0].text, 'Safe');
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Actualidad receives new IDs and a visit callback', async () => {
  const source = await read('src/screens/actualidad.mjs');
  assert.match(source, /newIds\s*=\s*new Set\(\)/);
  assert.match(source, /onVisited\s*=\s*null/);
  assert.match(source, /newIds\.has/);
  assert.match(source, /onVisited\?\.\(items\)/);
});

test('new state is exposed as readable text rather than visual-only decoration', async () => {
  const [screen, i18n] = await Promise.all([
    read('src/screens/actualidad.mjs'),
    read('src/core/i18n.mjs')
  ]);
  assert.match(screen, /actualidad\.newLabel/);
  assert.match(screen, /actualidad\.newCount/);
  assert.match(i18n, /newLabel:\s*'Nuevo'/);
  assert.match(i18n, /newLabel:\s*'New'/);
  assert.doesNotMatch(screen, /aria-hidden=["']true["'].*new/si);
});

test('app compares every resolved news catalog and clears markers after Actualidad visit', async () => {
  const source = await read('src/app.mjs');
  assert.match(source, /createNewsSeenStore/);
  assert.match(source, /currentNewNewsIds/);
  assert.match(source, /newsSeenStore\.compare\(currentContent\.news\)/);
  assert.match(source, /newsSeenStore\.markSeen/);
  assert.match(source, /currentNewNewsIds\s*=\s*new Set\(\)/);
  assert.match(source, /newIds:\s*currentNewNewsIds/);
});

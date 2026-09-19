import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { text } from '../src/core/i18n.mjs';
import { createPreviewController } from '../src/screens/sound-search.mjs';

const source = await readFile(new URL('../src/screens/sound-search.mjs', import.meta.url), 'utf8');

test('preview controller keeps one active audio and stops it on cleanup', () => {
  const calls = [];
  const a = { pause: () => calls.push('a') };
  const b = { pause: () => calls.push('b') };
  const previews = createPreviewController();
  previews.activate(a);
  previews.activate(b);
  previews.stop();
  assert.deepEqual(calls, ['a', 'b']);
});

test('sound-search screen uses accessible search and preview controls', () => {
  assert.match(source, /addScreenHeader\(/);
  assert.match(source, /queryInput\.type\s*=\s*'search'/);
  assert.match(source, /queryLabel\.htmlFor\s*=\s*queryInput\.id/);
  assert.match(source, /categoryLabel\.htmlFor\s*=\s*categorySelect\.id/);
  assert.match(source, /aria-live['"],\s*['"]polite/);
  assert.match(source, /document\.createElement\('audio'\)/);
  assert.match(source, /audio\.preload\s*=\s*'none'/);
  assert.doesNotMatch(source, /autoplay\s*=\s*true|\.autoplay\s*=/i);
  assert.match(source, /nativeActions\.openExternal/);
  assert.match(source, /setScreenCleanup/);
});

test('sound-search operational copy exists in Spanish and English', () => {
  const keys = [
    'soundSearch.intro', 'soundSearch.query', 'soundSearch.category', 'soundSearch.allCategories',
    'soundSearch.search', 'soundSearch.searching', 'soundSearch.needCriteria', 'soundSearch.results',
    'soundSearch.noResults', 'soundSearch.unavailable', 'soundSearch.duration', 'soundSearch.format',
    'soundSearch.size', 'soundSearch.license', 'soundSearch.author', 'soundSearch.source',
    'soundSearch.listen', 'soundSearch.openOriginal', 'soundSearch.externalHeading',
    'soundSearch.externalIntro', 'soundSearch.openBank'
  ];
  for (const lang of ['es', 'en']) {
    for (const key of keys) assert.notEqual(text(lang, key), key, `Missing ${lang} ${key}`);
  }
});

test('external banks stay available independently of internal provider results', () => {
  assert.match(source, /Mixkit/);
  assert.match(source, /https:\/\/mixkit\.co\/free-sound-effects\//);
  assert.match(source, /Pixabay/);
  assert.match(source, /https:\/\/pixabay\.com\/sound-effects\//);
  assert.match(source, /provider_unavailable/);
});

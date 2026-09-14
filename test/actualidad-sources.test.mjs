import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sources = JSON.parse(await readFile(new URL('../actualidad-sources.json', import.meta.url), 'utf8'));
const byId = new Map(sources.map(source => [source.id, source]));

test('AppleVis app and blog feeds have distinct visible source names', () => {
  assert.equal(byId.get('applevis-apps')?.name, 'AppleVis Apps');
  assert.equal(byId.get('applevis-blog')?.name, 'AppleVis Blog');
});

test('approved Spanish Actualidad sources are enabled with dated feed endpoints', () => {
  for (const id of ['tecnoconocimiento-accesible', 'accytec', 'nvda-es']) {
    const source = byId.get(id);
    assert.ok(source, `${id} must be configured`);
    assert.equal(source.enabled, true);
    assert.equal(source.lang, 'es');
    assert.match(source.feedUrl, /^https:\/\//);
    assert.ok(Array.isArray(source.categories) && source.categories.length > 0);
  }
});

test('Apple Newsroom accessibility is an English source with mandatory Spanish coverage', () => {
  const source = byId.get('apple-newsroom-accessibility');
  assert.ok(source, 'Apple Newsroom accessibility must be configured');
  assert.equal(source.enabled, true);
  assert.equal(source.lang, 'en');
  assert.equal(source.editorialClass, 'official-accessibility');
  assert.equal(source.translationPolicy, 'always-es');
  assert.ok(Array.isArray(source.includeKeywords) && source.includeKeywords.includes('accessibility'));
  assert.match(source.feedUrl, /^https:\/\/www\.apple\.com\/newsroom\//);
});

test('Apple Spain Newsroom mirrors official accessibility coverage when Apple publishes Spanish content', () => {
  const source = byId.get('apple-newsroom-accessibility-es');
  assert.ok(source, 'Apple Spain accessibility Newsroom must be configured');
  assert.equal(source.enabled, true);
  assert.equal(source.lang, 'es');
  assert.equal(source.editorialClass, 'official-accessibility');
  assert.equal(source.translationPolicy, 'official-spanish-first');
  assert.ok(Array.isArray(source.includeKeywords) && source.includeKeywords.includes('accesibilidad'));
  assert.equal(source.feedUrl, 'https://www.apple.com/es/newsroom/rss-feed.rss');
});

test('approved English general technology written sources prioritize the clean TifloAcosta reader', () => {
  for (const id of ['ars-technica', 'the-verge', 'engadget', 'techcrunch', '9to5mac']) {
    const source = byId.get(id);
    assert.ok(source, `${id} must be configured`);
    assert.equal(source.enabled, true, `${id} is enabled`);
    assert.equal(source.lang, 'en', `${id} is English`);
    assert.equal(source.editorialClass, 'generalist', `${id} is generalist`);
    assert.equal(source.adaptationPolicy, 'clean-reader', `${id} prioritizes clean-reader adaptations`);
    assert.ok(Number(source.maxItems) <= 4, `${id} is source-limited`);
    assert.match(source.feedUrl, /^https:\/\//);
  }
});

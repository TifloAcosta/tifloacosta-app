import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Actualidad filters the feed to the selected interface language', async () => {
  const source = await read('src/screens/actualidad.mjs');
  assert.match(source, /preferences/);
  assert.match(source, /item\.lang\s*===\s*preferences\.lang/);
});

test('Actualidad presents title, medium, then localized publication date and time', async () => {
  const source = await read('src/screens/actualidad.mjs');
  const titleIndex = source.indexOf('item.title');
  const sourceIndex = source.indexOf('item.sourceName');
  const dateIndex = source.indexOf('item.publishedAt');

  assert.ok(titleIndex >= 0, 'title must be rendered');
  assert.ok(sourceIndex > titleIndex, 'medium must be rendered after the title');
  assert.ok(dateIndex > sourceIndex, 'publication date/time must be rendered after the medium');
  assert.match(source, /Intl\.DateTimeFormat/);
  assert.match(source, /dateStyle/);
  assert.match(source, /timeStyle/);
  assert.doesNotMatch(source, /timeZone\s*:/, 'device timezone must be used by default');
});

test('Actualidad sorts by publication timestamp descending without featured-rank priority', async () => {
  const source = await read('src/screens/actualidad.mjs');
  assert.match(source, /new Date\(b\.publishedAt\).*new Date\(a\.publishedAt\)/s);
  assert.doesNotMatch(source, /featuredRank/);
});

test('Actualidad includes explicit readable labels for medium and publication time in both languages', async () => {
  const i18n = await read('src/core/i18n.mjs');
  assert.match(i18n, /source:\s*'Medio'/);
  assert.match(i18n, /published:\s*'Publicado'/);
  assert.match(i18n, /source:\s*'Source'/);
  assert.match(i18n, /published:\s*'Published'/);
});

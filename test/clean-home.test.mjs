import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('home exposes a closed launcher instead of block contents', async () => {
  const html = await read('index.html');
  assert.match(html, /id="home-blocks"/);
  assert.match(html, /id="home-open-actualidad"[^>]*href="actualidad\.html"/);
  assert.match(html, /id="home-open-resources"/);
  assert.match(html, /id="home-open-news"/);
  assert.match(html, /id="home-open-videos"[^>]*href="videos\.html"/);
  assert.match(html, /id="home-open-book"/);
  assert.match(html, /id="home-open-contact"/);
  assert.match(html, /id="home-open-privacy"/);
  assert.match(html, /id="home-open-config"/);
});

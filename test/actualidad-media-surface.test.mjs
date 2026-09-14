import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('Actualidad exposes a semantic Listen and watch area with two clearly separated sections', async () => {
  const html = await read('actualidad.html');
  assert.match(html, /id="section-media-link"[^>]*href="#media-browser"/);
  assert.match(html, /<section[^>]*id="media-browser"[^>]*aria-labelledby="media-heading"/);
  assert.match(html, /<h2[^>]*id="media-heading"/);
  assert.match(html, /<section[^>]*id="media-accessibility"[^>]*aria-labelledby="media-accessibility-heading"/);
  assert.match(html, /<h3[^>]*id="media-accessibility-heading"/);
  assert.match(html, /<section[^>]*id="media-technology"[^>]*aria-labelledby="media-technology-heading"/);
  assert.match(html, /<h3[^>]*id="media-technology-heading"/);
  assert.match(html, /id="media-technology-intro"/);
  assert.match(html, /id="media-status"[^>]*aria-live="polite"/);
  assert.match(html, /actualidad-media\.js/);
});

test('multimedia loads independently from news and apps without autoplay', async () => {
  const js = await read('actualidad-media.js');
  assert.match(js, /fetch\(['"]actualidad-media\.json['"]/);
  assert.equal((js.match(/fetch\(['"]actualidad-media\.json['"]/g) || []).length, 1);
  assert.doesNotMatch(js, /autoplay=1|\.play\(\)/);
});

test('multimedia rendering uses source section as authoritative and keeps external source access', async () => {
  const js = await read('actualidad-media.js');
  assert.match(js, /item\.section === 'technology'/);
  assert.match(js, /item\.section === 'accessibility'/);
  assert.match(js, /mediaOriginal/);
  assert.match(js, /originalLanguage/);
});

test('opening a news reader hides multimedia and returning restores all browsers', async () => {
  const js = await read('actualidad-media.js');
  assert.match(js, /readerObserver/);
  assert.match(js, /mediaBrowser\.hidden = !reader\.hidden/);
});

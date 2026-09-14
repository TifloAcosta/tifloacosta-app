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

test('multimedia rendering keeps source section authoritative and external source access', async () => {
  const js = await read('actualidad-media.js');
  assert.match(js, /items\.filter\(item => item\.section === section/);
  assert.match(js, /renderSection\('accessibility'/);
  assert.match(js, /renderSection\('technology'/);
  assert.match(js, /mediaOriginal/);
  assert.match(js, /originalLanguage/);
});

test('multimedia uses a localized editorial title and summary when available', async () => {
  const js = await read('actualidad-media.js');
  assert.match(js, /item\.locales\?\.\[currentLanguage\(\)\]/);
  assert.match(js, /localized\.title \|\| item\.title/);
  assert.match(js, /localized\.summary \|\| item\.summary/);
});

test('multimedia follows the interface language and crosses languages only for adapted editorial items', async () => {
  const js = await read('actualidad-media.js');
  assert.match(js, /function mediaVisibleInLanguage\(item, lang\)/);
  assert.match(js, /item\.originalLanguage === lang/);
  assert.match(js, /item\.editorialState === 'adapted'/);
  assert.match(js, /item\.locales\?\.\[lang\]/);
  assert.match(js, /mediaVisibleInLanguage\(item, currentLanguage\(\)\)/);
});

test('audio uses native controls without a redundant play toggle', async () => {
  const js = await read('actualidad-media.js');
  assert.match(js, /item\.type === 'audio' && item\.mediaUrl/);
  assert.doesNotMatch(js, /\(item\.type === 'video' && item\.embedUrl\) \|\| \(item\.type === 'audio' && item\.mediaUrl\)/);
});

test('opening a news reader hides multimedia and returning restores all browsers', async () => {
  const js = await read('actualidad-media.js');
  assert.match(js, /readerObserver/);
  assert.match(js, /mediaBrowser\.hidden = !reader\.hidden/);
});

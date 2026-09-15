import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

const expectButton = (html, id) => {
  assert.match(html, new RegExp(`<button[^>]*id=["']${id}["'][^>]*>`, 'i'), `${id} should be a native button`);
  assert.doesNotMatch(html, new RegExp(`<a[^>]*id=["']${id}["']`, 'i'), `${id} should not be an anchor`);
};

test('home launcher uses native buttons for app navigation', async () => {
  const html = await read('index.html');
  for (const id of [
    'home-open-actualidad',
    'home-open-resources',
    'home-open-news',
    'home-open-videos',
    'home-open-book',
    'home-open-contact',
    'home-open-privacy',
    'home-open-config',
    'actualidad-home-open',
    'videos-home-open'
  ]) expectButton(html, id);

  assert.match(html, /<a[^>]*id=["']youtube-home-channel["'][^>]*href=["']https:\/\//i);
  assert.match(html, /<a[^>]*id=["']book-buy-print["'][^>]*href=["']https:\/\//i);
});

test('actualidad section navigation uses buttons while source destinations remain links', async () => {
  const html = await read('actualidad.html');
  for (const id of [
    'home-link-top',
    'section-news-link',
    'section-apps-link',
    'section-media-link',
    'media-accessibility-link',
    'media-technology-link',
    'home-link-bottom'
  ]) expectButton(html, id);

  assert.match(html, /<a[^>]*id=["']reader-original["'][^>]*target=["']_blank["']/i);
});

test('video screen uses native buttons to return inside the app and keeps YouTube as links', async () => {
  const html = await read('videos.html');
  expectButton(html, 'back-home');
  expectButton(html, 'back-home-bottom');

  assert.match(html, /<a[^>]*id=["']youtube-channel["'][^>]*href=["']https:\/\//i);
  assert.match(html, /<a[^>]*id=["']video-player-youtube["'][^>]*href=["']https:\/\//i);
});

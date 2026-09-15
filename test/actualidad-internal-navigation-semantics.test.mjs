import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('all app surfaces load the internal navigation semantics upgrader', async () => {
  const [home, actualidad, videos] = await Promise.all([
    read('index.html'),
    read('actualidad.html'),
    read('videos.html')
  ]);

  for (const html of [home, actualidad, videos]) {
    assert.match(html, /<script src="navigation-semantics\.js\?v=1\.0"><\/script>/);
  }
});

test('internal navigation is upgraded to native buttons at runtime', async () => {
  const js = await read('navigation-semantics.js');

  assert.match(js, /document\.createElement\(['"]button['"]\)/);
  assert.match(js, /button\.type\s*=\s*['"]button['"]/);
  assert.match(js, /link\.replaceWith\(button\)/);
  assert.match(js, /#home-blocks a\.button-link/);
  assert.match(js, /a\[data-home-back\]/);
  assert.match(js, /#actualidad-sections a\.button-link/);
  assert.match(js, /#media-sections a\.button-link/);
  assert.match(js, /#back-home/);
  assert.match(js, /#back-home-bottom/);
});

test('real content and external destinations remain links', async () => {
  const [home, actualidad, videos] = await Promise.all([
    read('index.html'),
    read('actualidad.html'),
    read('videos.html')
  ]);

  assert.match(home, /<a[^>]*id="youtube-home-channel"[^>]*href="https:\/\//i);
  assert.match(home, /<a[^>]*id="book-buy-print"[^>]*href="https:\/\//i);
  assert.match(actualidad, /<a[^>]*id="reader-original"[^>]*target="_blank"/i);
  assert.match(videos, /<a[^>]*id="youtube-channel"[^>]*href="https:\/\//i);
  assert.match(videos, /<a[^>]*id="video-player-youtube"[^>]*href="https:\/\//i);
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('Novedades mezcla recursos y vídeos sin incluir Actualidad y abre vídeos dentro de la app', async () => {
  const [appCore, newsVideos, videosCore, deepLink] = await Promise.all([
    read('app-core.js'),
    read('news-videos.js'),
    read('videos-core.js'),
    read('video-deeplink.js')
  ]);

  assert.match(appCore, /news-videos\.js/);
  assert.match(newsVideos, /fetch\('videos\.json'/);
  assert.match(newsVideos, /selectNewsItems/);
  assert.match(newsVideos, /videos\.html\?video=/);
  assert.doesNotMatch(newsVideos, /actualidad\.json/);
  assert.match(videosCore, /video-deeplink\.js/);
  assert.match(deepLink, /URLSearchParams/);
  assert.match(deepLink, /data-video-id/);
});

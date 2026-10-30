import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');

test('el catálogo permite actuar sobre cada vídeo sin abrir el reproductor', () => {
  const js = read('videos.js'), html = read('videos.html');
  assert.match(js, /options\.setAttribute\('aria-expanded', 'false'\)/);
  assert.match(js, /options\.setAttribute\('aria-controls', moreId\)/);
  assert.match(js, /more\.setAttribute\('role', 'group'\)/);
  assert.match(js, /external\.href = videoLink/);
  assert.match(js, /navigator\.share\(\{ title: video\.title \|\| '', url: videoLink \}\)/);
  assert.match(js, /navigator\.clipboard\?\.writeText/);
  assert.match(js, /feedback\.setAttribute\('role', 'status'\)/);
  assert.match(js, /more\.hidden = !opening/);
  assert.match(html, /id="video-results-help"/);
  assert.match(js, /optionsFor: title =>/);
  assert.match(js, /shareFailed:/);
});

test('las páginas y la búsqueda devuelven el foco a una posición útil', () => {
  const js = read('videos.js'), yt = read('youtube-accessible.js');
  assert.match(js, /els\.resultsHeading\.focus\(\)/);
  assert.match(yt, /title\.tabIndex = -1/);
  assert.match(yt, /if \(append && firstAdded\) firstAdded\.focus\(\)/);
  assert.match(yt, /firstAdded = card\.querySelector\('h3'\)/);
  assert.match(read('videos.html'), /aria-controls="youtube-accessible-results"/);
});

test('el reproductor conserva sus controles existentes y la caché publica la versión nueva', () => {
  const js = read('videos.js'), html = read('videos.html'), sw = read('sw.js');
  for (const id of ['video-player-rewind','video-player-forward','video-player-toggle','video-player-position','video-player-close']) assert.ok(html.includes('id="'+id+'"'));
  assert.match(js, /const SEEK_SECONDS = 30/);
  assert.match(js, /if \(trigger\) trigger\.focus\(\)/);
  assert.match(html, /videos\.js\?v=2\.6/);
  assert.match(html, /youtube-accessible\.js\?v=1\.1/);
  assert.match(sw, /'\.\/videos\.js\?v=2\.6'/);
  assert.match(sw, /'\.\/youtube-accessible\.js\?v=1\.1'/);
});

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

test('launcher and actualidad navigation keep visible spacing between blocks', async () => {
  const [css, actualidad] = await Promise.all([read('styles.css'), read('actualidad.html')]);
  assert.match(actualidad, /id="actualidad-sections" class="resource-actions"/);
  assert.match(actualidad, /id="media-sections" class="resource-actions"/);
  assert.match(css, /#home-blocks \.resource-actions,\s*#actualidad-sections,\s*#media-sections\s*\{[^}]*display:grid;[^}]*gap:1rem;[^}]*\}/s);
  assert.match(css, /#actualidad-sections\s*\{[^}]*margin-block:1\.5rem;[^}]*\}/s);
  assert.match(css, /#home-blocks \.resource-actions \.button-link,\s*#actualidad-sections \.button-link,\s*#media-sections \.button-link\s*\{[^}]*width:100%;[^}]*\}/s);
});

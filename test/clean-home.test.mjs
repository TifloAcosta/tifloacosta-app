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

test('content collections fill available width without rigid empty columns', async () => {
  const css = await read('styles.css');
  assert.match(css, /\.resource-list,\.video-list\s*\{[^}]*display:flex;[^}]*flex-wrap:wrap;[^}]*gap:1rem;[^}]*\}/s);
  assert.match(css, /\.resource-card,\.video-card\s*\{[^}]*flex:1 1 20rem;[^}]*min-width:0;[^}]*\}/s);
  assert.match(css, /\.settings-form\s*\{[^}]*display:flex;[^}]*flex-wrap:wrap;[^}]*gap:1rem;[^}]*\}/s);
  assert.match(css, /\.settings-form \.settings-group\s*\{[^}]*flex:1 1 20rem;[^}]*\}/s);
  assert.match(css, /\.settings-form \.settings-actions,\.settings-form \.settings-status\s*\{[^}]*flex:1 1 100%;[^}]*\}/s);
  assert.doesNotMatch(css, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

test('global page frame remains proportional when browser zoom changes', async () => {
  const css = await read('styles.css');
  assert.match(css, /\.wrap\s*\{[^}]*width:94vw;[^}]*margin-inline:auto;[^}]*\}/s);
  assert.doesNotMatch(css, /\.wrap\s*\{[^}]*62rem/);
});

test('Actualidad cards use a fluid multi-column layout instead of one oversized column', async () => {
  const css = await read('styles.css');
  assert.match(css, /\.news-list\s*\{[^}]*display:grid;[^}]*grid-template-columns:repeat\(auto-fit,minmax\(min\(100%,28rem\),1fr\)\);[^}]*gap:\.8rem;[^}]*\}/s);
  assert.match(css, /\.news-item\s*\{[^}]*min-width:0;[^}]*\}/s);
});

test('Actualidad text can use the full width of each news card and reader block', async () => {
  const css = await read('styles.css');
  assert.match(css, /\.news-item p,\s*#news-reader p\s*\{[^}]*max-width:none;[^}]*\}/s);
});

test('configuration keeps clear vertical separation between its main control blocks', async () => {
  const css = await read('styles.css');
  assert.match(css, /#config-section > h3\s*\{[^}]*margin-top:1\.75rem;[^}]*\}/s);
});

test('one global search is promoted to the home screen and video search is hidden', async () => {
  const [source, css] = await Promise.all([read('search-accessibility.js'), read('styles.css')]);
  assert.match(source, /insertAdjacentElement\('afterend',\s*searchSection\)/);
  assert.match(source, /videoSearchForm\.hidden\s*=\s*true/);
  assert.match(source, /controlsHeading\.textContent\s*=\s*copy\.controlsHeading/);
  assert.match(css, /#video-results-section\s*\{[^}]*margin-top:1\.75rem;[^}]*\}/s);
});

test('resource categories are progressively enhanced to an explicit expandable control for screen readers', async () => {
  const [html, source] = await Promise.all([read('index.html'), read('search-accessibility.js')]);
  assert.match(html, /<select id="category">/);
  assert.match(source, /function enhanceResourceCategories\(\)/);
  assert.match(source, /categoryToggle\.setAttribute\('aria-expanded'/);
  assert.match(source, /categoryOptions\.hidden/);
  assert.match(source, /select\.dispatchEvent\(new Event\('change'/);
});

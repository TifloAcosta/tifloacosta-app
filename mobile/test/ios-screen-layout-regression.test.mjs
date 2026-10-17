import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('collapsed iOS controls stay hidden even when their class uses grid or flex', async () => {
  const css = await read('src/styles.css');
  assert.match(css, /\[hidden\]:not\(\[hidden="until-found"\]\)\s*\{\s*display:\s*none\s*!important;/);
  assert.match(css, /\.reading-book-controls\s*\{[\s\S]*?display:\s*grid;/);
  assert.match(css, /\.reading-library-pagination\s*\{[\s\S]*?display:\s*grid;/);
  assert.match(css, /\.search-form,[\s\S]*?\.reading-library-search\s*\{[\s\S]*?display:\s*grid;/);
  assert.match(css, /\.home-menu,[\s\S]*?\.content-list,[\s\S]*?\.result-list\s*\{[\s\S]*?display:\s*grid;/);
});

test('screens, imported book titles and controls cannot widen beyond iPhone viewport', async () => {
  const [css, brand] = await Promise.all([read('src/styles.css'), read('src/brand-refresh.css')]);
  assert.match(brand, /#app\s*\{\s*width:\s*min\(calc\(100% - 2rem\), 60rem\)/);
  assert.match(brand, /padding-block-start:\s*var\(--safe-top\)/);
  assert.match(css, /#app section,[\s\S]*?#app form,[\s\S]*?min-inline-size:\s*0;[\s\S]*?max-inline-size:\s*100%;/);
  assert.match(css, /input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\)/);
  assert.match(css, /\.reading-library-title,[\s\S]*?\.reading-reader,[\s\S]*?overflow-wrap:\s*anywhere;/);
});

test('lists do not double the space between cards', async () => {
  const css = await read('src/styles.css');
  assert.match(css, /\.content-list > \.content-card \+ \.content-card,[\s\S]*?\.result-list > \.result-card \+ \.result-card\s*\{\s*margin-block-start:\s*0;/);
});

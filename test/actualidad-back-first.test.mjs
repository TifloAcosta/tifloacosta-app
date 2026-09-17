import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('Actualidad focuses the top Back control before headings in every interior view', async () => {
  const source = await read('actualidad-core.js');

  assert.match(source, /function focusTopBackControl\(section\)/);
  assert.match(source, /section\.querySelector\('\[data-isolated-back="top"\] button'\)/);
  assert.match(source, /'news-browser':\s*news/);
  assert.match(source, /'apps-browser':\s*apps/);
  assert.match(source, /'media-browser':\s*media/);
  assert.match(source, /'media-accessibility':\s*mediaAccessibility/);
  assert.match(source, /'media-technology':\s*mediaTechnology/);
  assert.match(source, /focusTopBackControl\(focusSections\[state\.view\]\)/);
});

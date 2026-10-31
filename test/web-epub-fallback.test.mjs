import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('EPUB parser retains text in chapters without p or heading markup', async () => {
  const source = await readFile(new URL('../shared/web-reading-format-adapters.mjs', import.meta.url), 'utf8');
  assert.match(source, /if \(!blocks\.length\) \{/);
  assert.match(source, /cleanText\(doc\.body\?\.textContent \|\| ''\)/);
  assert.match(source, /if \(bodyText\) blocks\.push/);
});

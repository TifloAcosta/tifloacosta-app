import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('composition root registers every approved route and shell stays semantic', async () => {
  const source = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  const html = await readFile(new URL('../src/index.html', import.meta.url), 'utf8');
  for (const route of ['home','actualidad','search','library','favorites','videos','book','podcast','contact','settings']) {
    assert.ok(source.includes(`'${route}'`), `missing route ${route}`);
  }
  assert.doesNotMatch(html, /autofocus/i);
  assert.doesNotMatch(html, /aria-role|role="main"/i);
  assert.equal((html.match(/<main\b/g) || []).length, 1);
});

test('composition root delegates screen markup to screen modules', async () => {
  const source = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /innerHTML\s*=|createElement\(['"]h1|createElement\(['"]button/);
});

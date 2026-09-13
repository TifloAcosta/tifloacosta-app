import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('app provides one external-link service to screens', async () => {
  const source = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  assert.match(source, /createExternalLinkService/);
  assert.match(source, /external:\s*externalLinkService/);
});

for (const screen of ['contact', 'podcast', 'book', 'videos']) {
  test(`${screen} routes external activation through the native service`, async () => {
    const source = await readFile(new URL(`../src/screens/${screen}.mjs`, import.meta.url), 'utf8');
    assert.match(source, /external\.open/);
    assert.match(source, /preventDefault\(\)/);
  });
}
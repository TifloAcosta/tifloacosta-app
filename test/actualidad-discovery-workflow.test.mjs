import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflow = await readFile(new URL('../.github/workflows/sync-actualidad.yml', import.meta.url), 'utf8');

test('Actualidad branch validation checks discovery sources such as BuscaApps', () => {
  assert.match(workflow, /actualidad-discovery-sources\.json/);
  assert.match(workflow, /scripts\/validate-actualidad-discovery\.mjs/);
  assert.match(workflow, /node scripts\/validate-actualidad-discovery\.mjs/);
});

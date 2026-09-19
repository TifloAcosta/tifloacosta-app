import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('main hourly sync wires the OpenAI secret only into the Actualidad synchronization step', async () => {
  const workflow = await read('.github/workflows/sync-actualidad.yml');
  assert.match(workflow, /- name: Synchronize Actualidad\s+env:\s+OPENAI_API_KEY: \$\{\{ secrets\.OPENAI_API_KEY \}\}\s+run: node scripts\/sync-actualidad\.mjs/);
  assert.equal((workflow.match(/OPENAI_API_KEY:/g) || []).length, 1);
});

test('automatic editorial and state files are detected and committed by the hourly workflow', async () => {
  const workflow = await read('.github/workflows/sync-actualidad.yml');
  assert.match(workflow, /git status --porcelain -- [^\n]*actualidad-editorial\.json[^\n]*actualidad-auto-state\.json/);
  assert.match(workflow, /git add [^\n]*actualidad-editorial\.json[^\n]*actualidad-auto-state\.json/);
});

test('automatic adaptation configuration and tests trigger branch validation', async () => {
  const workflow = await read('.github/workflows/sync-actualidad.yml');
  for (const expected of [
    'actualidad-auto-config.json',
    'actualidad-auto-state.json',
    'docs/actualidad-editorial-guidelines.md',
    'test/actualidad-auto-*.test.mjs',
    'test/openai-actualidad-client.test.mjs'
  ]) assert.match(workflow, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

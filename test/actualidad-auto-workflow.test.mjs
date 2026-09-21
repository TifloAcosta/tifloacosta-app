import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('main hourly news sync does not require an OpenAI API key', async () => {
  const workflow = await read('.github/workflows/sync-actualidad.yml');
  const syncScript = await read('scripts/sync-actualidad.mjs');
  assert.doesNotMatch(workflow, /OPENAI_API_KEY/);
  assert.doesNotMatch(syncScript, /OPENAI_API_KEY|createActualidadAIClient/);
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

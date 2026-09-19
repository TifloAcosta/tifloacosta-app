import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflow = await readFile(new URL('../../.github/workflows/bootstrap-mobile-android.yml', import.meta.url), 'utf8');

test('mobile workflow is not tied to the old foundation branch', () => {
  assert.doesNotMatch(workflow, /ref:\s*feature\/mobile-capacitor-foundation/);
  assert.doesNotMatch(workflow, /HEAD:feature\/mobile-capacitor-foundation/);
});

test('mobile workflow validates without committing back to the repository', () => {
  assert.match(workflow, /actions\/checkout@v5/);
  assert.doesNotMatch(workflow, /git commit -m/);
  assert.doesNotMatch(workflow, /git push origin/);
});

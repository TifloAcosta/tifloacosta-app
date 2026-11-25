import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { waitForPagesArtifact } from '../scripts/wait-pages-artifact.mjs';

test('Pages waits for the specific uploaded artifact, with bounded retries', async () => {
  const pending = [[], [{ id: 12, name: 'github-pages' }], [{ id: 16, name: 'github-pages', expired: true }],
    [{ id: 16, name: 'github-pages', expired: false }]];
  const delays = [];
  await waitForPagesArtifact({ id: '16', list: async () => pending.shift(), pause: async ms => delays.push(ms) });
  assert.deepEqual(delays, [2000, 4000, 8000]);
  await assert.rejects(waitForPagesArtifact({ id: '16', list: async () => [], attempts: 2, pause: async () => {} }),
    /retry limit/);
});

test('both publication jobs guard the production branch and verify artifact visibility', async () => {
  for (const workflow of ['sync-actualidad', 'sync-youtube']) {
    const content = await readFile(new URL(`../.github/workflows/${workflow}.yml`, import.meta.url), 'utf8');
    assert.match(content, /sync-and-deploy:\s+if: github.ref == 'refs\/heads\/main'/);
    assert.match(content, /upload-pages-artifact[\s\S]*?wait-pages-artifact\.mjs[\s\S]*?deploy-pages/);
  }
});

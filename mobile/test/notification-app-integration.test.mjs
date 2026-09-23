import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('production app never wires notifications to a null adapter', async () => {
  const source = await read('src/app.mjs');
  assert.doesNotMatch(source, /createNotificationService\(null\)/);
  assert.match(source, /createOneSignalNotifications/);
});

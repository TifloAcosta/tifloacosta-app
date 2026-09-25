import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Android update controller checks on resume and suppresses duplicate prompts', async () => {
  const source = await read('android/app/src/main/java/com/tifloacosta/app/TifloUpdatePromptController.java');
  assert.match(source, /void checkForUpdate\(\)/);
  assert.match(source, /lastPromptedVersionCode/);
  assert.match(source, /dismissedVersionCode/);
  assert.match(source, /AppUpdateType\.FLEXIBLE/);
  assert.match(source, /AppUpdateType\.IMMEDIATE/);
  assert.match(source, /updatePriority\(\)\s*==\s*5/);
});

test('update prompt uses explicit accessible actions and no timeout', async () => {
  const source = await read('android/app/src/main/java/com/tifloacosta/app/TifloUpdatePromptController.java');
  assert.match(source, /setTitle\(R\.string\.update_available_title\)/);
  assert.match(source, /setPositiveButton\(R\.string\.update_now/);
  assert.match(source, /setNegativeButton\(R\.string\.update_later/);
  assert.doesNotMatch(source, /Handler|postDelayed|Timer/);
});

test('MainActivity wires update checks into lifecycle', async () => {
  const source = await read('android/app/src/main/java/com/tifloacosta/app/MainActivity.java');
  assert.match(source, /TifloUpdatePromptController/);
  assert.match(source, /updatePromptController\.checkForUpdate\(\)/);
  assert.match(source, /updatePromptController\.start\(\)/);
  assert.match(source, /updatePromptController\.stop\(\)/);
});

test('update copy is available in Spanish and English Android resources', async () => {
  const es = await read('android/app/src/main/res/values/strings.xml');
  const en = await read('android/app/src/main/res/values-en/strings.xml');
  for (const key of ['update_available_title', 'update_available_message', 'update_now', 'update_later', 'update_ready_title', 'update_complete']) {
    assert.match(es, new RegExp(`name="${key}"`));
    assert.match(en, new RegExp(`name="${key}"`));
  }
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = async path => {
  try {
    return await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  } catch {
    return '';
  }
};

test('background tts bridge exposes persistent session controls while preserving voice enumeration', async () => {
  const plugin = await read('android/app/src/main/java/com/tifloacosta/app/TifloReadingTtsPlugin.java');
  assert.match(plugin, /@CapacitorPlugin\(name\s*=\s*"TifloReadingTts"\)/);
  for (const method of [
    'listTtsVoices',
    'beginTtsSession',
    'appendTtsUnits',
    'commitTtsSession',
    'playTts',
    'pauseTts',
    'seekTts',
    'getTtsState',
    'stopTts'
  ]) {
    assert.match(plugin, new RegExp(`public\\s+void\\s+${method}\\s*\\(PluginCall\\s+call\\)`), `Missing ${method}`);
  }
});

test('background tts session store is private, chunkable and atomic', async () => {
  const [store, unit] = await Promise.all([
    read('android/app/src/main/java/com/tifloacosta/app/reading/ReadingTtsSessionStore.java'),
    read('android/app/src/main/java/com/tifloacosta/app/reading/ReadingTtsUnit.java')
  ]);

  assert.match(unit, /class\s+ReadingTtsUnit/);
  assert.match(store, /class\s+ReadingTtsSessionStore/);
  assert.match(store, /void\s+begin\s*\(/);
  assert.match(store, /void\s+append\s*\(/);
  assert.match(store, /void\s+commit\s*\(/);
  assert.match(store, /Session\s+load\s*\(/);
  assert.match(store, /void\s+delete\s*\(/);
  assert.match(store, /\.tmp/);
  assert.match(store, /renameTo|Files\.move/);
});

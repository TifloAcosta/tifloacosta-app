import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('portable reading backup is registered as a dedicated Android bridge', async () => {
  const [activity, plugin, nativeBridge] = await Promise.all([
    read('android/app/src/main/java/com/tifloacosta/app/MainActivity.java'),
    read('android/app/src/main/java/com/tifloacosta/app/TifloReadingBackupPlugin.java'),
    read('src/native/reading-backup-plugin.mjs')
  ]);

  assert.match(activity, /registerPlugin\(TifloReadingBackupPlugin\.class\)/);
  assert.match(plugin, /@CapacitorPlugin\(name\s*=\s*"TifloReadingBackup"\)/);
  assert.match(plugin, /ReadingBackupService/);
  assert.match(plugin, /Intent\.ACTION_CREATE_DOCUMENT/);
  assert.match(plugin, /Intent\.ACTION_OPEN_DOCUMENT/);
  assert.match(plugin, /exportReadingBackup/);
  assert.match(plugin, /pickReadingRestore/);
  assert.match(plugin, /applyReadingRestore/);
  assert.match(plugin, /ReadingRestorePlan/);
  assert.match(nativeBridge, /registerPlugin\(['"]TifloReadingBackup['"]\)/);
});

test('reading backup client exposes normalized export plan and restore operations', async () => {
  const [nativeBridge, client] = await Promise.all([
    read('src/native/reading-backup-plugin.mjs'),
    read('src/core/reading-backup-client.mjs')
  ]);

  for (const method of ['exportReadingBackup', 'pickReadingRestore', 'applyReadingRestore']) {
    assert.ok(nativeBridge.includes(method), `Native reading backup bridge is missing ${method}`);
    assert.ok(client.includes(method), `Reading backup client is missing ${method}`);
  }
  assert.match(client, /positionConflicts/);
  assert.match(client, /keep-current/);
  assert.match(client, /use-backup/);
});

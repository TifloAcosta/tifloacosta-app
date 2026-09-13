import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Android saver uses the Storage Access Framework without broad storage permission', async () => {
  const plugin = await readFile(new URL('../android/app/src/main/java/com/tifloacosta/app/SaveFilePlugin.java', import.meta.url), 'utf8');
  const manifest = await readFile(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
  assert.match(plugin, /ACTION_CREATE_DOCUMENT/);
  assert.match(plugin, /CATEGORY_OPENABLE/);
  assert.match(plugin, /openOutputStream/);
  assert.doesNotMatch(manifest, /READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE|MANAGE_EXTERNAL_STORAGE/);
});

test('iOS saver presents the system document picker for exporting', async () => {
  const plugin = await readFile(new URL('../ios/App/App/SaveFilePlugin.swift', import.meta.url), 'utf8');
  assert.match(plugin, /UIDocumentPickerViewController\(forExporting:/);
  assert.match(plugin, /CAPBridgedPlugin/);
  assert.match(plugin, /saved/);
});
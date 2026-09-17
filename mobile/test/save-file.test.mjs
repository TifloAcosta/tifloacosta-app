import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createNativeActions } from '../src/core/native-actions.mjs';

const readRepo = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('saveFile delegates to the native save plugin without requesting storage permissions', async () => {
  const calls = [];
  const savePlugin = {
    saveUrl(options) {
      calls.push(options);
      return Promise.resolve({ saved: true });
    }
  };
  const actions = createNativeActions({ savePlugin });
  const result = await actions.saveFile({
    url: 'https://tifloacosta.com/documents/guia.pdf',
    filename: 'guia.pdf',
    mimeType: 'application/pdf'
  });
  assert.equal(result, true);
  assert.deepEqual(calls, [{
    url: 'https://tifloacosta.com/documents/guia.pdf',
    filename: 'guia.pdf',
    mimeType: 'application/pdf'
  }]);
});

test('Android save plugin uses ACTION_CREATE_DOCUMENT and no broad storage permission', async () => {
  const [plugin, activity, manifest] = await Promise.all([
    readRepo('android/app/src/main/java/com/tifloacosta/app/TifloSavePlugin.java'),
    readRepo('android/app/src/main/java/com/tifloacosta/app/MainActivity.java'),
    readRepo('android/app/src/main/AndroidManifest.xml')
  ]);
  assert.match(plugin, /Intent\.ACTION_CREATE_DOCUMENT/);
  assert.match(plugin, /@ActivityCallback/);
  assert.match(plugin, /@CapacitorPlugin\(name\s*=\s*"TifloSave"\)/);
  assert.match(activity, /registerPlugin\(TifloSavePlugin\.class\)/);
  assert.doesNotMatch(manifest, /READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE|MANAGE_EXTERNAL_STORAGE/);
});

test('resource screens expose a text download control through native save action', async () => {
  const library = await readFile(new URL('../src/screens/library.mjs', import.meta.url), 'utf8');
  assert.match(library, /nativeActions\?\.saveFile/);
  assert.match(library, /library\.download/);
  assert.doesNotMatch(library, /autofocus/i);
});

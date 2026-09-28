import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const librarySource = await readFile(new URL('../src/screens/library.mjs', import.meta.url), 'utf8');
const nativeActionsSource = await readFile(new URL('../src/core/native-actions.mjs', import.meta.url), 'utf8');
const shareBridgeSource = await readFile(new URL('../src/native/share-plugin.mjs', import.meta.url), 'utf8');
const androidShareSource = await readFile(
  new URL('../android/app/src/main/java/com/tifloacosta/app/TifloSharePlugin.java', import.meta.url),
  'utf8'
);

test('Recursos shares the resolved document as a file instead of sharing its web URL', () => {
  assert.match(librarySource, /nativeActions\?\.shareFile\(\{[\s\S]*url:\s*targetUrl/);
  assert.doesNotMatch(librarySource, /url:\s*shareUrl/);
});

test('native actions route resource file sharing through TifloShare', () => {
  assert.match(nativeActionsSource, /async function shareFile/);
  assert.match(nativeActionsSource, /tifloSharePlugin\?\.shareFile/);
  assert.match(shareBridgeSource, /async function shareFile/);
  assert.match(shareBridgeSource, /plugin\?\.shareFile/);
});

test('Android sends a cached content URI attachment with temporary read permission', () => {
  assert.match(androidShareSource, /public void shareFile\(PluginCall call\)/);
  assert.match(androidShareSource, /FileProvider\.getUriForFile/);
  assert.match(androidShareSource, /Intent\.EXTRA_STREAM/);
  assert.match(androidShareSource, /FLAG_GRANT_READ_URI_PERMISSION/);
});

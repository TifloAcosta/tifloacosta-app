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

const REQUIRED_DOCUMENT_MIMES = [
  'text/plain',
  'text/html',
  'application/pdf',
  'application/epub+zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
  'application/x-zip-compressed'
];

const REQUIRED_AUDIO_MIMES = [
  'audio/mpeg',
  'audio/mp4',
  'audio/aac',
  'audio/ogg',
  'audio/opus',
  'audio/flac',
  'audio/wav'
];

function assertMime(source, mime, label) {
  assert.match(source, new RegExp(mime.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('/', '\\/')), `${label} missing ${mime}`);
}

test('reading picker exposes every approved v1 document/container family and audio family', async () => {
  const [groupPlugin, wrapper] = await Promise.all([
    read('android/app/src/main/java/com/tifloacosta/app/TifloReadingAudioGroupPlugin.java'),
    read('src/native/reading-library-plugin.mjs')
  ]);

  assert.match(wrapper, /registerPlugin\(['"]TifloReadingAudioGroup['"]\)/);
  assert.match(wrapper, /safeCall\(groupPlugin,\s*['"]pickDocuments['"]/);
  assert.match(groupPlugin, /Intent\.ACTION_OPEN_DOCUMENT/);
  assert.match(groupPlugin, /Intent\.EXTRA_ALLOW_MULTIPLE/);
  for (const mime of REQUIRED_DOCUMENT_MIMES) assertMime(groupPlugin, mime, 'Picker');
  for (const mime of REQUIRED_AUDIO_MIMES) assertMime(groupPlugin, mime, 'Picker');
});

test('reading share target advertises every approved v1 document/container family and audio family without broad storage permissions', async () => {
  const manifest = await read('android/app/src/main/AndroidManifest.xml');

  assert.match(manifest, /android\.intent\.action\.SEND/);
  assert.match(manifest, /android\.intent\.action\.SEND_MULTIPLE/);
  for (const mime of REQUIRED_DOCUMENT_MIMES) assertMime(manifest, mime, 'Share target');
  for (const mime of REQUIRED_AUDIO_MIMES) assertMime(manifest, mime, 'Share target');
  assert.doesNotMatch(manifest, /READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE|MANAGE_EXTERNAL_STORAGE|READ_MEDIA_/);
});

test('reading multi-selection keeps ordinary documents independent and asks before grouping multiple audio files', async () => {
  const [groupPlugin, activity] = await Promise.all([
    read('android/app/src/main/java/com/tifloacosta/app/TifloReadingAudioGroupPlugin.java'),
    read('android/app/src/main/java/com/tifloacosta/app/MainActivity.java')
  ]);

  assert.match(activity, /registerPlugin\(TifloReadingAudioGroupPlugin\.class\)/);
  assert.match(groupPlugin, /uris\.size\(\)\s*>\s*1\s*&&\s*allAudio\(uris\)/);
  assert.match(groupPlugin, /audioChoiceRequired/);
  assert.match(groupPlugin, /public void resolveAudioSelection\(PluginCall call\)/);
  assert.match(groupPlugin, /"grouped"\.equals\(mode\)[\s\S]*importAudioGroup\(uris\)/);
  assert.match(groupPlugin, /"independent"\.equals\(mode\)/);
  assert.match(groupPlugin, /private JSObject importUris\(List<Uri> uris, boolean cancelled\)[\s\S]*for \(Uri uri : uris\)[\s\S]*importer\.importOne\(source, input\)/);
});

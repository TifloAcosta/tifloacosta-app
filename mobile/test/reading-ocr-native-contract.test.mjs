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

test('native OCR recognizes one PDF page at a time with the five supported scripts', async () => {
  const [gradle, service, plugin, activity] = await Promise.all([
    read('android/app/build.gradle'),
    read('android/app/src/main/java/com/tifloacosta/app/reading/ReadingOcrService.java'),
    read('android/app/src/main/java/com/tifloacosta/app/TifloReadingOcrPlugin.java'),
    read('android/app/src/main/java/com/tifloacosta/app/MainActivity.java')
  ]);

  for (const artifact of [
    'play-services-mlkit-text-recognition:19.0.1',
    'play-services-mlkit-text-recognition-chinese:16.0.1',
    'play-services-mlkit-text-recognition-devanagari:16.0.1',
    'play-services-mlkit-text-recognition-japanese:16.0.1',
    'play-services-mlkit-text-recognition-korean:16.0.1'
  ]) assert.match(gradle, new RegExp(artifact.replace(/[.]/g, '\\.')));

  assert.match(service, /ReadingPdfPageRenderer/);
  assert.match(service, /latin/);
  assert.match(service, /chinese/);
  assert.match(service, /devanagari/);
  assert.match(service, /japanese/);
  assert.match(service, /korean/);
  for (const status of ['ok', 'empty', 'model-unavailable', 'unsupported-script', 'error']) {
    assert.match(service, new RegExp(status));
  }
  assert.match(service, /TextRecognition\.getClient/);
  assert.match(service, /recognizer\.close\s*\(/);
  assert.match(service, /bitmap\.recycle\s*\(/);

  assert.match(plugin, /@CapacitorPlugin\(name\s*=\s*"TifloReadingOcr"\)/);
  assert.match(plugin, /public\s+void\s+recognizePdfPage\s*\(PluginCall\s+call\)/);
  assert.match(plugin, /getBridge\(\)\.execute/);
  assert.match(plugin, /result\.put\("pageIndex"/);
  assert.match(plugin, /result\.put\("text"/);
  assert.match(plugin, /result\.put\("blocks"/);
  assert.match(plugin, /result\.put\("status"/);
  assert.match(activity, /registerPlugin\(TifloReadingOcrPlugin\.class\)/);
});

test('shared reading bridge exposes OCR without inventing a successful fallback', async () => {
  const wrapper = await read('src/native/reading-library-plugin.mjs');

  assert.match(wrapper, /registerPlugin\('TifloReadingOcr'\)/);
  assert.match(wrapper, /recognizePdfPage/);
  assert.match(wrapper, /status:\s*'error'/);
  assert.doesNotMatch(wrapper, /status:\s*'ok'[\s\S]{0,160}fallback/i);
});

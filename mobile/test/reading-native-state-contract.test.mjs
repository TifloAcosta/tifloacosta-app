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

test('reading native bridge exposes precise progress in books and saves block sentence and anchor together', async () => {
  const plugin = await read('android/app/src/main/java/com/tifloacosta/app/TifloReadingPlugin.java');

  assert.match(plugin, /book\.put\("unitIndex",\s*record\.getUnitIndex\(\)\)/);
  assert.match(plugin, /book\.put\("anchorText",\s*record\.getAnchorText\(\)/);
  assert.match(plugin, /call\.getInt\("unitIndex"/);
  assert.match(plugin, /call\.getString\("anchorText"/);
  assert.match(plugin, /database\.updateProgress\(\s*id,\s*blockIndex,\s*unitIndex,\s*anchorText,/s);
});

test('reading native bridge exposes marks and inherited settings through the same library database', async () => {
  const plugin = await read('android/app/src/main/java/com/tifloacosta/app/TifloReadingPlugin.java');

  for (const method of [
    'listMarks',
    'addMark',
    'deleteMark',
    'getReadingSettings',
    'setReadingSetting',
    'resetBookReadingSettings'
  ]) {
    assert.match(plugin, new RegExp(`public\\s+void\\s+${method}\\s*\\(PluginCall\\s+call\\)`), `Missing ${method}`);
  }
  assert.match(plugin, /new ReadingMarkRecord\(/);
  assert.match(plugin, /database\.insertMark\(/);
  assert.match(plugin, /database\.listMarks\(/);
  assert.match(plugin, /database\.deleteMark\(/);
  assert.match(plugin, /new ReadingSettingsRecord\(/);
  assert.match(plugin, /database\.getReadingSetting\(/);
  assert.match(plugin, /database\.setReadingSetting\(/);
  assert.match(plugin, /database\.resetBookReadingSettings\(/);
});

test('reading native marks accept only the four approved types and settings use an explicit key allowlist', async () => {
  const plugin = await read('android/app/src/main/java/com/tifloacosta/app/TifloReadingPlugin.java');

  for (const type of ['bookmark', 'important', 'review', 'quote']) {
    assert.match(plugin, new RegExp(`"${type}"`));
  }
  for (const key of [
    'speech.rate', 'speech.voice', 'visual.textSize', 'visual.fontFamily', 'visual.fontWeight',
    'visual.lineSpacing', 'visual.paragraphSpacing', 'visual.readingWidth', 'visual.foreground',
    'visual.background', 'visual.highContrast', 'visual.theme'
  ]) {
    assert.match(plugin, new RegExp(key.replace('.', '\\.')));
  }
  assert.match(plugin, /SUPPORTED_READING_SETTING_KEYS/);
});

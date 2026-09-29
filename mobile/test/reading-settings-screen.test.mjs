import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('reading settings load inherited values voices and apply effective speech settings', async () => {
  const screen = await read('src/screens/reading-settings.mjs');

  assert.match(screen, /client\.getReadingSettings\(/);
  assert.match(screen, /client\.listTtsVoices\(/);
  assert.match(screen, /resolveReadingSettings/);
  assert.match(screen, /speech\.setVoice\(/);
  assert.match(screen, /speech\.setRate\(/);
});

test('per-book voice rate and visual changes are persisted immediately as overrides', async () => {
  const screen = await read('src/screens/reading-settings.mjs');

  assert.match(screen, /client\.setReadingSetting\(/);
  assert.match(screen, /scope:\s*['"]book['"]/);
  for (const key of [
    'speech.voice', 'speech.rate', 'visual.textSize', 'visual.fontFamily', 'visual.fontWeight',
    'visual.lineSpacing', 'visual.paragraphSpacing', 'visual.readingWidth', 'visual.foreground',
    'visual.background', 'visual.highContrast', 'visual.theme'
  ]) {
    assert.ok(screen.includes(key), `Missing setting ${key}`);
  }
});

test('voice and visual panels provide visible status feedback and explicit return controls', async () => {
  const [screen, i18n] = await Promise.all([
    read('src/screens/reading-settings.mjs'),
    read('src/core/i18n.mjs')
  ]);

  assert.match(screen, /voiceStatus/);
  assert.match(screen, /visualStatus/);
  assert.match(screen, /readingBook\.returnToReading/);
  assert.match(screen, /returnFocus/);
  for (const label of ['Volver a la lectura', 'Return to reading']) {
    assert.ok(i18n.includes(label), `Missing return-to-reading translation: ${label}`);
  }
});

test('voice settings provide get-more-voices notice, external navigation and refresh on resume', async () => {
  const [screen, plugin, client, i18n] = await Promise.all([
    read('src/screens/reading-settings.mjs'),
    read('src/native/reading-library-plugin.mjs'),
    read('src/core/reading-library-client.mjs'),
    read('src/core/i18n.mjs')
  ]);

  assert.match(plugin, /openTtsVoiceInstaller/);
  assert.match(client, /openTtsVoiceInstaller/);
  assert.match(screen, /readingBook\.getMoreVoices/);
  assert.match(screen, /readingBook\.voiceInstallerNotice/);
  assert.match(screen, /client\.openTtsVoiceInstaller\(/);
  assert.match(screen, /['"]resume['"]/);
  assert.match(screen, /client\.listTtsVoices\(/);
  assert.match(screen, /voiceSelect\.value/);
  assert.match(screen, /lastInvoker/);
  for (const label of ['Conseguir más voces', 'Get more voices']) {
    assert.ok(i18n.includes(label), `Missing get-more-voices translation: ${label}`);
  }
});

test('reset removes only this book overrides and reapplies inherited values', async () => {
  const screen = await read('src/screens/reading-settings.mjs');

  assert.match(screen, /client\.resetBookReadingSettings\(bookId\)/);
  assert.match(screen, /readingBook\.resetBookSettings/);
  assert.match(screen, /await\s+loadSettings\(\)/);
});

test('visual settings are scoped to reader container through CSS custom properties including text and background colors', async () => {
  const [screen, styles] = await Promise.all([
    read('src/screens/reading-settings.mjs'),
    read('src/styles.css')
  ]);

  assert.match(screen, /readerContainer\.style\.setProperty/);
  assert.match(screen, /--reading-foreground/);
  assert.match(screen, /--reading-background/);
  assert.match(styles, /--reading-text-scale/);
  assert.match(styles, /--reading-line-spacing/);
  assert.match(styles, /--reading-paragraph-spacing/);
  assert.match(styles, /--reading-width/);
  assert.match(styles, /--reading-foreground/);
  assert.match(styles, /--reading-background/);
  assert.doesNotMatch(styles, /\.reading-reader[^}]*height:\s*\d+px/s);
});

test('voice and visual settings behave as modal TalkBack dialogs and restore focus to their opener', async () => {
  const screen = await read('src/screens/reading-settings.mjs');

  assert.match(screen, /setAttribute\(['"]role['"],\s*['"]dialog['"]\)/);
  assert.match(screen, /setAttribute\(['"]aria-modal['"],\s*['"]true['"]\)/);
  assert.match(screen, /lastInvoker/);
  assert.match(screen, /document\.activeElement/);
  assert.match(screen, /lastInvoker\?\.focus\(\)/);
  assert.match(screen, /event\.key\s*===\s*['"]Tab['"]/);
  assert.match(screen, /focusableElements/);
});

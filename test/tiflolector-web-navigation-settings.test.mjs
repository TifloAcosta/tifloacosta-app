import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('TifloLector exposes clear top-level menus with focusable panels', async () => {
  const html = await read('index.html');
  for (const id of [
    'reading-settings-toggle',
    'reading-library-toggle',
    'reading-queue-menu-toggle',
    'reading-marks-menu-toggle'
  ]) assert.ok(html.includes(`id="${id}"`), `Missing ${id}`);
  for (const id of [
    'reading-settings-heading',
    'reading-library-heading',
    'reading-queue-heading',
    'reading-marks-heading'
  ]) assert.match(html, new RegExp(`id="${id}"[^>]*tabindex="-1"`));
  assert.ok(html.includes('>TifloLector</'));
  assert.ok(html.includes('aria-controls="reading-settings-web"'));
});

test('TifloLector keeps voice, TTS and visual settings discoverable before opening a document', async () => {
  const html = await read('index.html');
  for (const id of [
    'reading-voice',
    'reading-rate',
    'reading-audio-speed',
    'reading-text-size',
    'reading-font-family',
    'reading-font-weight',
    'reading-line-spacing',
    'reading-paragraph-spacing',
    'reading-width',
    'reading-theme',
    'reading-high-contrast'
  ]) assert.ok(html.includes(`id="${id}"`), `Missing ${id}`);
});

test('TifloLector panel toggles manage aria-expanded and move focus', async () => {
  const source = await read('web-reading.js');
  assert.ok(source.includes("button.setAttribute('aria-expanded', String(opening))"));
  assert.ok(source.includes('heading?.focus?.()'));
  assert.ok(source.includes('WEB_READING_SETTINGS_KEY'));
  assert.ok(source.includes("heading: 'TifloLector'"));
});


test('TifloLector separates general settings into audio, visual and more-voices menus', async () => {
  const source = await read('web-reading.js');
  for (const token of [
    'reading-audio-settings',
    'reading-visual-settings',
    'reading-more-voices-settings',
    'Modo lector de pantalla',
    'Iniciar automáticamente la lectura TTS'
  ]) assert.ok(source.includes(token), `Missing ${token}`);
});

test('TifloLector exposes per-document voice, rate, bookmark and semantic navigation', async () => {
  const source = await read('web-reading.js');
  for (const token of [
    'reading-navigation-unit',
    'reading-document-voice',
    'reading-document-rate',
    'Añadir marca',
    "['block','Bloque','Block']",
    "['paragraph','Párrafo','Paragraph']",
    "['sentence','Frase','Sentence']",
    'speechController?.moveTo?.'
  ]) assert.ok(source.includes(token), `Missing ${token}`);
  assert.ok(source.includes("new Intl.Segmenter(language(), { granularity:'sentence' })"));
});

test('automatic speech is opt-in and disabled by screen-reader mode', async () => {
  const source = await read('web-reading.js');
  assert.ok(source.includes("playbackPrefs.autoPlay === true && playbackPrefs.screenReaderMode === false"));
  assert.ok(source.includes("if (mode.checked) auto.checked = false"));
  assert.ok(source.includes("if (auto.checked) mode.checked = false"));
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('TifloLector exposes clear top-level menus with isolated focusable subviews', async () => {
  const html = await read('index.html');
  for (const target of [
    'reading-audio-view',
    'reading-visual-view',
    'reading-voices-view',
    'reading-library-web',
    'reading-queue-web',
    'reading-marks-web'
  ]) assert.ok(html.includes(`data-reading-view="${target}"`), `Missing launcher for ${target}`);
  for (const id of [
    'reading-settings-heading',
    'reading-library-heading',
    'reading-queue-heading',
    'reading-marks-heading'
  ]) assert.match(html, new RegExp(`id="${id}"[^>]*tabindex="-1"`));
  assert.ok(html.includes('>TifloLector</'));
  assert.ok(html.includes('class="panel reading-subview"'));
  assert.ok(html.includes('data-reading-back'));
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

test('TifloLector isolated subviews hide the main view and move focus', async () => {
  const html = await read('index.html');
  assert.ok(html.includes("mainChildren.forEach(node => { node.hidden = true; });"));
  assert.ok(html.includes("subviews.forEach(view => { view.hidden = view !== target; });"));
  assert.ok(html.includes("queueMicrotask(() => heading?.focus());"));
  const source = await read('web-reading.js');
  assert.ok(source.includes('WEB_READING_SETTINGS_KEY'));
  assert.ok(source.includes("heading: 'TifloLector'"));
});


test('TifloLector separates general settings into audio, visual and more-voices menus', async () => {
  const [html, source] = await Promise.all([read('index.html'), read('web-reading.js')]);
  for (const token of [
    'reading-audio-settings',
    'reading-visual-settings',
    'reading-more-voices-settings'
  ]) assert.ok(html.includes(token), `Missing ${token}`);
  for (const token of [
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


test('TifloLector document view keeps progress, audio, visual and more-actions controls separated', async () => {
  const source = await read('web-reading.js');
  for (const token of [
    'reading-document-progress',
    'reading-document-progress-percent',
    'Audio y voz',
    'Presentación visual',
    'Más acciones',
    'Temporizador de lectura',
    'Transcurrido: aproximadamente',
    'Restante: aproximadamente',
    'for (let value = 0; value <= 100; value += 10)'
  ]) assert.ok(source.includes(token), `Missing final document control: ${token}`);
  assert.ok(source.includes("movable.forEach(node => morePanel.append(node));"));
  assert.ok(source.includes("resetVisual.addEventListener('click', restoreDocumentVisualFromGeneral)"));
});


test('TifloLector library title details expose progress times grouped controls and 10 percent jumps', async () => {
  const source = await read('web-reading.js');
  for (const token of [
    'reading-library-progress-',
    'Tiempo realizado y tiempo faltante',
    'Abrir en posición',
    'Audio y voz',
    'Presentación visual',
    'Más acciones',
    'for (let value = 0; value <= 100; value += 10)',
    "scope:'book'",
    'openSavedBook(book.id, Number(jump.value) || 0)'
  ]) assert.ok(source.includes(token), `Missing library final layout token: ${token}`);
});

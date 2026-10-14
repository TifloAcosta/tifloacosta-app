import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('TifloLector exposes clear top-level menus with isolated focusable subviews', async () => {
  const html = await read('index.html');
  for (const target of [
    'reading-audio-view',
    'reading-visual-view',
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


test('TifloLector keeps more voices inside Audio and voice instead of a top-level menu', async () => {
  const [html, source] = await Promise.all([read('index.html'), read('web-reading.js')]);
  for (const token of [
    'reading-audio-settings',
    'reading-visual-settings',
    'reading-more-voices-settings'
  ]) assert.ok(html.includes(token), `Missing ${token}`);
  for (const token of [
    'reading-playback-mode',
    'Inicio de lectura al abrir un documento',
    'Manual: iniciar al pulsar Reproducir',
    'Automático: iniciar al abrir'
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
  assert.ok(source.includes("mode.value = stored.autoPlay === true && stored.screenReaderMode === false ? 'automatic' : 'manual'"));
  assert.ok(source.includes("mode.addEventListener('change', saveWebSettings)"));
  assert.ok(source.includes("screenReaderMode: els.playbackMode ? els.playbackMode.value === 'manual'"));
  assert.ok(source.includes("autoPlay: els.playbackMode ? els.playbackMode.value === 'automatic'"));
});


test('TifloLector document view prioritizes playback and keeps compact progress with secondary jumps in More actions', async () => {
  const source = await read('web-reading.js');
  for (const token of [
    'reading-document-progress',
    'reading-document-progress-percent',
    'Audio y voz',
    'Presentación visual',
    'Más acciones',
    'Temporizador de lectura',
    '% leído. Quedan aproximadamente',
    'for (let value = 0; value <= 100; value += 10)',
    'mainControls.after(section)',
    'morePanel.append(moreHeading, progressLabel, progressSelect, timerLabel, timerSelect)'
  ]) assert.ok(source.includes(token), `Missing final document control: ${token}`);
  assert.ok(source.includes("movable.forEach(node => morePanel.append(node));"));
  assert.ok(source.includes("resetVisual.addEventListener('click', restoreDocumentVisualFromGeneral)"));
});


test('TifloLector library presents titles as direct reading entry points without an intermediate details card', async () => {
  const source = await read('web-reading.js');
  assert.ok(source.includes("title.addEventListener('click', () =>"));
  assert.ok(source.includes('void openSavedBook(book.id);'));
  assert.ok(source.includes('card.append(title);'));
  assert.ok(!source.includes('card.append(title, detailsToggle, details);'));
});


test('reader-only mode hides global skip link and site header then restores them on exit', async () => {
  const source = await read('web-reading.js');
  assert.ok(source.includes("document.querySelector('.skip-link')"));
  assert.ok(source.includes("document.querySelector('.site-header')"));
  assert.ok(source.includes('readerChromeState.set(node, node.hidden)'));
  assert.ok(source.includes('node.hidden = true'));
  assert.ok(source.includes('node.hidden = wasHidden'));
});

test('more voices is nested inside Audio and voice with no separate launcher', async () => {
  const html = await read('index.html');
  assert.ok(html.includes('id="reading-more-voices-settings"'));
  assert.ok(html.includes('<h4 id="reading-more-voices-settings-heading">Buscar más voces</h4>'));
  assert.ok(!html.includes('data-reading-view="reading-voices-view"'));
  assert.ok(!html.includes('id="reading-voices-view"'));
});


test('TifloLector separates settings and preserves VoiceOver focus through nested returns', async () => {
  const html = await read('index.html');
  assert.match(html, /id="reading-settings-summary"[^>]*data-reading-view="reading-settings-web"/);
  assert.match(html, /id="reading-settings-web"[^>]*class="panel reading-subview" hidden/);
  assert.match(html, /data-reading-view="reading-general-view"/);
  assert.match(html, /id="reading-general-view"[^>]*hidden/);
  assert.ok(!html.includes('Tipos de ajustes'));
  assert.ok(!html.includes('id="reading-audio-settings-heading"'));
  assert.ok(!html.includes('id="reading-visual-settings-heading"'));
  assert.match(html, /readingViewStack\.push\(/);
  assert.match(html, /const previous = readingViewStack\.pop\(\)/);
  assert.match(html, /previous\?\.opener\?\.isConnected/);
  assert.match(html, /mainHiddenState/);
  assert.match(html, /id="reading-settings-status"[^>]*hidden/);
  const native = await read('ios-build/ios-reader-selects.js');
  for (const id of ['reading-default-navigation','reading-playback-mode','reading-voice-language','reading-document-voice-language'])
    assert.ok(native.includes("'" + id + "'"), 'Missing adjustable VoiceOver control: ' + id);
});

test('every TifloLector submenu has one final Cerrar and restores VoiceOver focus', async () => {
  const html = await read('index.html');
  const pairs = [
    ['reading-settings-web', 'reading-general-view'],
    ['reading-general-view', 'reading-audio-view'],
    ['reading-audio-view', 'reading-visual-view'],
    ['reading-visual-view', 'reading-library-web'],
    ['reading-queue-web', 'reading-marks-web'],
    ['reading-marks-web', null]
  ];
  for (const [view, next] of pairs) {
    const start = html.indexOf('<section id="' + view + '"');
    const endMarker = next
      ? '<section id="' + next + '"'
      : '<p><a class="button-link back-link" href="#home"';
    const end = html.indexOf(endMarker, start + 1);
    assert.ok(start >= 0 && end > start, 'Missing subview boundary: ' + view);
    const contents = html.slice(start, end);
    assert.equal((contents.match(/data-reading-close>Cerrar<\/button>/g) || []).length, 1,
      'One Cerrar per subview: ' + view);
    assert.match(contents, /data-reading-close>Cerrar<\/button>\s*<\/section>\s*$/,
      'Cerrar should be at the bottom: ' + view);
    assert.ok(!contents.includes('data-reading-back'), 'No redundant Volver: ' + view);
  }
  assert.equal((html.match(/data-reading-close>Cerrar<\/button>/g) || []).length, 6);
  assert.ok(!html.includes('data-reading-back'));
  assert.match(html, /function closeReadingSubview\(\)/);
  assert.match(html, /readingViewStack\.push\(/);
  assert.match(html, /const previous = readingViewStack\.pop\(\)/);
  assert.match(html, /previous\?\.opener\?\.isConnected/);
  assert.match(html, /queueMicrotask\(\(\) => focusTarget\?\.focus\(\)\)/);
});

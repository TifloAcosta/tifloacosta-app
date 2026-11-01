import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

test('TifloLector exposes exactly one playback button, including when playing MP3', () => {
  const html = read('index.html');
  const source = read('web-reading.js');
  assert.match(html, /id="reading-play"/);
  assert.doesNotMatch(html, /id="reading-pause"/);
  assert.doesNotMatch(source, /els\.pause/);
  assert.match(source, /updatePlaybackLabel\(playing\)/);
  assert.match(source, /const playing = activeAudio \?/);
});

test('MP3 individual imports route to an audio decoder instead of a text parser', () => {
  const html = read('index.html');
  const source = read('web-reading.js');
  assert.match(html, /\.mp3,audio\/mpeg/);
  assert.match(source, /await useMp3File\(file\)/);
  assert.match(source, /URL\.createObjectURL\(file\)/);
  assert.match(source, /new Audio\(audioObjectUrl\)/);
  assert.match(source, /reading-audio-seek/);
  assert.match(source, /audio\.currentTime \/ duration \* 100/);
});

test('web book percentage weighs actual words and never counts a first block as read', () => {
  const source = read('web-reading.js');
  const start = source.indexOf('  function countReadingWords(');
  const end = source.indexOf('  function renderPosition()', start);
  assert.ok(start > 0 && end > start);
  const model = { blocks: [
    { text: 'Introduction' },
    { text: 'body '.repeat(499).trim() }
  ] };
  const helpers = vm.runInNewContext(`(() => {
    let documentModel = ${JSON.stringify(model)};
    ${source.slice(start, end)}
    return { wholeBookPercent, blockIndexForPercent };
  })()`);
  assert.equal(helpers.wholeBookPercent(0), 0);
  const afterHeading = helpers.wholeBookPercent(1);
  assert.ok(afterHeading > 0 && afterHeading < 1);
  assert.equal(helpers.blockIndexForPercent(30), 1);
  assert.equal(helpers.blockIndexForPercent(0), 0);
});

test('service worker refreshes the same MP3-capable runtime as HTML', () => {
  const html = read('index.html');
  const worker = read('sw.js');
  const htmlVersion = html.match(/web-reading\.js\?v=(\d+\.\d+)/)?.[1];
  const workerVersion = worker.match(/web-reading\.js\?v=(\d+\.\d+)/)?.[1];
  assert.ok(htmlVersion, 'HTML must identify the reader runtime version');
  assert.equal(workerVersion, htmlVersion, 'Service worker must refresh the HTML reader runtime version');
});

test('DAISY track extraction is lazy and does not preload the full audiolibro', () => {
  const source = read('web-reading.js');
  assert.match(source, /const tracks = book\.audioFiles\.filter/);
  assert.match(source, /const blob = await entry\.async\('blob'\)/);
  assert.match(source, /async function choose\(nextIndex, autoplay=false\)/);
  assert.match(source, /URL\.revokeObjectURL\(oldUrl\)/);
  assert.doesNotMatch(source, /tracks\.push\(\{ path, url:URL\.createObjectURL/);
});

test('DAISY import communicates analysis, saving and track preparation', () => {
  const source = read('web-reading.js');
  assert.match(source, /Analizando el archivo DAISY comprimido/);
  assert.match(source, /Guardando el DAISY en Mi biblioteca/);
  assert.match(source, /DAISY guardado\. Preparando las pistas de audio/);
});

test('media imported before a playback error remains reported as saved', () => {
  const source = read('web-reading.js');
  assert.match(source, /let mediaSaved = false/);
  assert.match(source, /if \(mediaSaved\)/);
  assert.match(source, /Archivo guardado en Mi biblioteca, pero no se pudo preparar el audio/);
  assert.match(source, /announceAudioImportResult\(false/);
});

test('successful media storage is acknowledged even when library UI refresh fails', () => {
  const source = read('web-reading.js');
  const start = source.indexOf('  async function storeImportedAudio(');
  const end = source.indexOf('  async function importSelectedFile(', start);
  const method = source.slice(start, end);
  assert.ok(method.indexOf('announceAudioImportResult(true, format)') < method.indexOf('await renderLibrary()'));
  assert.match(method, /try \{ await renderLibrary\(\); \}/);
});

test('large DAISY ZIP is persisted before archive extraction and uses Blob input', () => {
  const source = read('web-reading.js');
  assert.match(source, /JSZip\.loadAsync\(file\)/);
  assert.doesNotMatch(source, /JSZip\.loadAsync\(await file\.arrayBuffer\(\)\)/);
  const importer = source.slice(source.indexOf('  async function importSelectedFile('), source.indexOf('  async function importSelectedFile(') + 4600);
  assert.ok(importer.indexOf("storeImportedAudio(file, 'daisy-audio')") < importer.indexOf('const prepared = await documentFromFile(file)'));
});

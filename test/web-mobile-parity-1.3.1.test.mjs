import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readRoot = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const readMobile = path => readFile(new URL(`../mobile/${path}`, import.meta.url), 'utf8');

test('YouTube sync preserves a full description with public links for details', async () => {
  const [sync, build] = await Promise.all([
    readRoot('scripts/sync-youtube.mjs'),
    readRoot('scripts/build-mobile-content.mjs')
  ]);
  assert.match(sync, /fullDescription/);
  assert.match(build, /fullDescription/);
});

test('YouTube workflow regenerates web and Android content together and runs after this sync code changes', async () => {
  const workflow = await readRoot('.github/workflows/sync-youtube.yml');
  assert.match(workflow, /node scripts\/sync-youtube\.mjs/);
  assert.match(workflow, /node scripts\/build-mobile-content\.mjs/);
  assert.match(workflow, /git status --porcelain -- videos\.json mobile-content\.json/);
  assert.match(workflow, /git add videos\.json mobile-content\.json/);
  assert.match(workflow, /push:\s*\n\s*branches:\s*\[main\][\s\S]*scripts\/sync-youtube\.mjs/);
});

test('Android accessible player includes an adjustable position control and public video details', async () => {
  const [player, i18n] = await Promise.all([
    readMobile('src/screens/video-player.mjs'),
    readMobile('src/core/i18n.mjs')
  ]);
  assert.match(player, /type\s*=\s*['"]range['"]/);
  assert.match(player, /getDuration/);
  assert.match(player, /ariaValueText|aria-valuetext|setAttribute\(['"]aria-valuetext/);
  assert.match(player, /fullDescription/);
  assert.match(player, /https?:\\\/\\\//);
  assert.match(i18n, /details:\s*['"](?:Ver detalles del vídeo|Show video details)['"]/);
  assert.match(i18n, /position:\s*['"](?:Posición del vídeo|Video position)['"]/);
});

test('web player exposes the same adjustable position and independent details controls', async () => {
  const [html, script] = await Promise.all([
    readRoot('videos.html'),
    readRoot('videos.js')
  ]);
  assert.match(html, /id=['"]video-player-position['"]/);
  assert.match(html, /type=['"]range['"]/);
  assert.match(html, /id=['"]video-details['"]/);
  assert.match(html, /id=['"]video-details-panel['"]/);
  assert.match(script, /playerPosition/);
  assert.match(script, /getDuration/);
  assert.match(script, /fullDescription/);
  assert.match(script, /createElement\(['"]a['"]\)/);
});

test('web resources mirror Android platform filters with accessible generated controls', async () => {
  const app = await readRoot('app.js');
  for (const id of ['resource-platform-all', 'resource-platform-android', 'resource-platform-iphone', 'resource-platform-windows']) {
    assert.match(app, new RegExp(id));
  }
  assert.match(app, /resourceMatchesPlatform/);
  assert.match(app, /aria-pressed/);
  assert.match(app, /\bjieshuo\b/);
  assert.match(app, /\bjaws\b/);
  assert.match(app, /\bnvda\b/);
});

test('web global search clear returns focus to the search field like Android', async () => {
  const search = await readRoot('search-accessibility.js');
  assert.match(search, /function clearSearch\(\)[\s\S]*search\.value = ''[\s\S]*search\.focus\(\)/);
});

test('web Downloads mirrors Android explanation and both available actions', async () => {
  const [hub, core] = await Promise.all([
    readRoot('downloads-hub.js'),
    readRoot('app-core.js')
  ]);
  assert.match(hub, /descargables disponibles/);
  assert.match(hub, /downloads-open-link/);
  assert.match(hub, /downloads-open-sounds/);
  assert.match(core, /downloads-hub\.js/);
  assert.match(core, /sound-search\.js/);
});

test('temporary Android Actualidad language diagnostic is not left in the release interface', async () => {
  const actualidad = await readMobile('src/screens/actualidad.mjs');
  assert.doesNotMatch(actualidad, /activeLanguage|contentLanguage|Idioma:/i);
});
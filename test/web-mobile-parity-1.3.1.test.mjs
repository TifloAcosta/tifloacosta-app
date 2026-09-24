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
  assert.match(i18n, /videos\.details/);
  assert.match(i18n, /videos\.position/);
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

test('web resources mirror Android platform filters', async () => {
  const [html, app] = await Promise.all([
    readRoot('index.html'),
    readRoot('app.js')
  ]);
  for (const id of ['resource-platform-all', 'resource-platform-android', 'resource-platform-iphone', 'resource-platform-windows']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(app, /resourceMatchesPlatform|matchesPlatform/);
  assert.match(app, /aria-pressed/);
});

test('temporary Android Actualidad language diagnostic is not left in the release interface', async () => {
  const actualidad = await readMobile('src/screens/actualidad.mjs');
  assert.doesNotMatch(actualidad, /activeLanguage|contentLanguage|Idioma:/i);
});

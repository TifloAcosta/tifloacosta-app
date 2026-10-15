import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const file = path => readFileSync(resolve(root, path), 'utf8');

test('El catálogo de respaldo iOS presenta un único foco por vídeo', () => {
  const ui = file('ios-video-ui.js');
  assert.match(ui, /function describeChannelVideos\(\)/);
  assert.match(ui, /querySelectorAll\('\.video-card'\)/);
  assert.match(ui, /play\.textContent = videoTitle/);
  assert.match(ui, /play\.setAttribute\('aria-label'/);
  assert.match(ui, /title\.hidden = true/);
  assert.match(ui, /metadata\.setAttribute\('aria-hidden', 'true'\)/);
  assert.match(ui, /MutationObserver\(describeChannelVideos\)/);
});

test('Una entrada a videos.html vuelve a intentar abrir el listado nativo con VoiceOver', () => {
  const bridge = file('ios-appwide-native-actions.js');
  assert.match(bridge, /function recoverNativeVideosPage\(\)/);
  assert.match(bridge, /endsWith\('\/videos\.html'\)/);
  assert.match(bridge, /getVoiceOverStatus\(\)/);
  assert.match(bridge, /showNativeVideoSection\(\{ videos, theme: videoTheme\(\) \}\)/);
  assert.match(bridge, /location\.assign\('index\.html'\)/);
});

test('No se modifica la página de vídeos pública ni el listado de Android', () => {
  const ui = file('ios-video-ui.js');
  assert.match(ui, /iOS only/);
  assert.match(ui, /ios-video-row-action/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = file => readFileSync(new URL('../Sources/' + file, import.meta.url), 'utf8');
const visual = source('TifloVisual.swift');
const screens = source('NativeScreens.swift');
const player = source('NativeYouTubePlayer.swift');

test('Los selectores tienen fondo, borde y valor destacado, manteniendo el control ajustable', () => {
  const adjustable = screens.split('struct NativeAdjustableChoice: View {')[1]
    .split('struct NativeResourcesScreen: View {')[0];
  assert.match(adjustable, /TifloVisual\\.selectorSurface/);
  assert.match(adjustable, /TifloVisual\\.selectorBorder/);
  assert.match(adjustable, /arrow\\.up\\.arrow\\.down\\.circle\\.fill/);
  assert.match(adjustable, /\\.buttonStyle\\(\\.plain\\)/);
  assert.match(adjustable, /\\.accessibilityElement\\(children: \\.ignore\\)/);
  assert.match(adjustable, /\\.accessibilityValue/);
  assert.match(adjustable, /\\.accessibilityAdjustableAction/);
  assert.match(adjustable, /case \\.increment: advance\\(1\\)/);
  assert.match(adjustable, /case \\.decrement: advance\\(-1\\)/);
  assert.match(visual, /contrastLight: 0xFFFFFF, contrastDark: 0x000000/);
  assert.match(visual, /static let selectorSurface/);
  assert.match(visual, /static let selectorBorder/);
});

test('Las miniaturas son decorativas y no cambian los controles de VoiceOver', () => {
  assert.match(player, /var thumbnailURL: URL/);
  assert.match(player, /i\\.ytimg\\.com\\/vi\\//);
  const thumbnail = screens.split('private struct NativeYouTubeThumbnail: View {')[1]
    .split('private struct NativeYouTubeVideoRow: View {')[0];
  assert.match(thumbnail, /AsyncImage\\(url: video\\.thumbnailURL\\)/);
  assert.match(thumbnail, /\\.accessibilityHidden\\(true\\)/);
  assert.match(thumbnail, /case \\.empty, \\.failure/);
  const videoRow = screens.split('private struct NativeYouTubeVideoRow: View {')[1]
    .split('private struct NativeYouTubeCommentScreen: View {')[0];
  assert.match(videoRow, /NativeYouTubeThumbnail\\(video: video\\)/);
  assert.match(videoRow, /dynamicTypeSize\\.isAccessibilitySize/);
  assert.match(videoRow, /\\.accessibilityElement\\(children: \\.ignore\\)/);
  assert.match(videoRow, /NativeYouTubeTitleActions/);
  assert.match(videoRow, /Button \\{ onPlay\\(video\\) \\}/);
});

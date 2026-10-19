import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = file => readFileSync(new URL('../Sources/' + file, import.meta.url), 'utf8');
const visual = source('TifloVisual.swift');
const screens = source('NativeScreens.swift');
const player = source('NativeYouTubePlayer.swift');

test('Los selectores tienen estilo propio sin perder la interacción de VoiceOver', () => {
  const adjustable = screens.split('struct NativeAdjustableChoice: View {')[1]
    .split('struct NativeResourcesScreen: View {')[0];
  for (const token of [
    'TifloVisual.selectorSurface', 'TifloVisual.selectorBorder',
    'arrow.up.arrow.down.circle.fill', '.buttonStyle(.plain)',
    '.accessibilityElement(children: .ignore)',
    '.accessibilityValue', '.accessibilityAdjustableAction',
    'case .increment: advance(1)', 'case .decrement: advance(-1)'
  ]) assert.ok(adjustable.includes(token), token);
  for (const token of ['static let selectorSurface', 'static let selectorBorder',
                       'contrastLight: 0xFFFFFF, contrastDark: 0x000000'])
    assert.ok(visual.includes(token), token);
});

test('Las miniaturas no añaden elementos a VoiceOver y funcionan con letra grande', () => {
  assert.ok(player.includes('var thumbnailURL: URL'));
  assert.ok(player.includes('https://i.ytimg.com/vi/'));
  const thumbnail = screens.split('private struct NativeYouTubeThumbnail: View {')[1]
    .split('private struct NativeYouTubeVideoRow: View {')[0];
  for (const token of [
    'AsyncImage(url: video.thumbnailURL)', '.accessibilityHidden(true)',
    'case .empty, .failure', 'Image(systemName: "play.rectangle.fill")'
  ]) assert.ok(thumbnail.includes(token), token);
  const row = screens.split('private struct NativeYouTubeVideoRow: View {')[1]
    .split('private struct NativeYouTubeCommentScreen: View {')[0];
  for (const token of [
    'NativeYouTubeThumbnail(video: video)', 'dynamicTypeSize.isAccessibilitySize',
    '.accessibilityElement(children: .ignore)', 'NativeYouTubeTitleActions',
    'Button { onPlay(video) }'
  ]) assert.ok(row.includes(token), token);
});

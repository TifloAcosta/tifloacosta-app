import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = file => readFileSync(path.join(root, 'Sources', file), 'utf8');

test('Vídeos comienza con un buscador universal, sin buscador duplicado del canal', () => {
  const screens = source('NativeScreens.swift');
  const section = screens.split('struct NativeVideosScreen: View {')[1].split('// Actualidad con filtros')[0];
  assert.match(section, /Section\("YouTube accesible"\)/);
  assert.match(section, /TextField\("Buscar en todo YouTube"/);
  assert.match(section, /Button\("Buscar en YouTube"\)/);
  assert.match(section, /Section\("Resultados de YouTube"\)/);
  assert.match(section, /Button\("Mostrar diez resultados más"\)/);
  assert.match(section, /Section\("Vídeos del canal TifloAcosta"\)/);
  assert.match(section, /Button\("Mostrar diez más"\)/);
  assert.match(section, /NativeAdjustableChoice\(\s*title: "Orden"/);
  assert.doesNotMatch(section, /\.searchable\(/);
  assert.doesNotMatch(section, /Buscar en los vídeos del canal/);
  assert.match(section, /\.sheet\(item: \$selectedVideo\)/);
});

test('Todo título del canal o de resultados abre el mismo reproductor accesible', () => {
  const screens = source('NativeScreens.swift');
  const favorites = source('NativeFavorites.swift');
  assert.match(screens, /NativeYouTubeVideo\(catalog: item\)/);
  assert.match(screens, /youtubeSearch\.videos/);
  assert.match(screens, /\.accessibilityAction\(named: Text\("Reproducir"\)\)/);
  const row = screens.split('private struct NativeYouTubeVideoRow: View {')[1]
    .split('private struct NativeYouTubeCommentScreen: View {')[0];
  assert.match(row, /Button\s*\{\s*onPlay\(video\)\s*\}/);
  assert.doesNotMatch(row, /\.accessibilityElement\(children: \.ignore\)/);
  assert.match(row, /\.accessibilityAction\(\.default\)\s*\{\s*onPlay\(video\)/);
  const favoriteVideo = favorites.split('case .video:')[1].split('\n                    }')[0];
  assert.doesNotMatch(favoriteVideo, /\.accessibilityElement\(children: \.ignore\)/);
  assert.match(favoriteVideo, /\.accessibilityAction\(\.default\)/);
  assert.match(favorites, /NativeYouTubeVideo\(catalog: entry\.item\)/);
  assert.match(favorites, /NativeYouTubePlayerScreen\(video: video\)/);
});

test('Buscar por API oficial existente, sin clave dentro de iOS ni búsqueda solo local', () => {
  const player = source('NativeYouTubePlayer.swift');
  assert.match(player, /youtube-auth\.tifloacosta\.com\/search/);
  assert.match(player, /URLSession\.shared\.data\(for: request\)/);
  assert.match(player, /forHTTPHeaderField: "Origin"/);
  assert.match(player, /URLQueryItem\(name: "pageToken"/);
  assert.match(player, /if loadMore && nextPageToken\.isEmpty \{ return \}/);
  assert.doesNotMatch(player, /YOUTUBE_API_KEY|GOOGLE_CLIENT_SECRET/);
});

test('YouTube usa exclusivamente iframe oficial y mandos nativos VoiceOver', () => {
  const player = source('NativeYouTubePlayer.swift');
  assert.match(player, /WKWebView/);
  assert.match(player, /youtube\.com\/iframe_api/);
  assert.match(player, /<div id="player"><\/div>/);
  assert.doesNotMatch(player, /<iframe id="player"/);
  assert.match(player, /view\.isAccessibilityElement\s*=\s*false/);
  assert.match(player, /view\.accessibilityElementsHidden\s*=\s*true/);
  assert.match(player, /NativeYouTubeOfficialPlayer\(videoID: video\.id, engine: engine\)[\s\S]{0,220}\.accessibilityHidden\(true\)/);
  assert.match(player, /onYouTubeIframeAPIReady/);
  // Reproductor creado con la API IFrame y sus controles nativos SwiftUI.
  assert.match(player, /playerVars:\{playsinline:1,controls:1,enablejsapi:1,autoplay:0/);
  assert.match(player, /configuration\.mediaTypesRequiringUserActionForPlayback\s*=\s*\[\]/);
  assert.match(player, /import AVFoundation/);
  assert.match(player, /session\.setCategory\(\.playback, mode: \.moviePlayback, options: \[\.mixWithOthers\]\)/);
  assert.match(player, /coordinator\.restoreAudioConfiguration\(\)/);
  assert.match(player, /height: 225/);
  assert.match(player, /Text\(engine\.playing \? "Pausar" : "Reproducir"\)/);
  assert.match(player, /dynamicTypeSize\.isAccessibilitySize/);
  assert.match(player, /VStackLayout\(alignment: \.leading, spacing: 8\)/);
  assert.match(player, /Retroceder 30 segundos/);
  assert.match(player, /Avanzar 30 segundos/);
  assert.match(player, /\.accessibilityAdjustableAction/);
  assert.match(player, /changePosition\(10\)/);
  assert.match(player, /changePosition\(-10\)/);
  assert.match(player, /engine\.stop\(\); dismiss\(\)/);
  assert.doesNotMatch(player, /CAPBridgeViewController|import Capacitor/);
});

test('Ninguna otra pantalla iOS carga WebView ni reintroduce interfaz híbrida', () => {
  for (const file of readdirSync(path.join(root, 'Sources')).filter(name => name.endsWith('.swift'))) {
    if (file === 'NativeYouTubePlayer.swift') continue;
    assert.doesNotMatch(source(file), /WKWebView|CAPBridgeViewController|import Capacitor/, file);
  }
  const build = readFileSync(new URL('../../.github/workflows/ios-native-swiftui-build.yml', import.meta.url), 'utf8');
  const release = readFileSync(new URL('../../.github/workflows/ios-native-testflight-upload.yml', import.meta.url), 'utf8');
  for (const workflow of [build, release]) {
    assert.match(workflow, /! -name 'NativeYouTubePlayer\.swift'/);
    assert.match(workflow, /CAPBridgeViewController\|import Capacitor/);
  }
});

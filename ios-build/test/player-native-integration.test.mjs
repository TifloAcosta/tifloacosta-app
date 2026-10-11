import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const player = readFileSync(resolve(root, 'native/TifloYouTubeViewController.swift'), 'utf8');
const packager = readFileSync(resolve(root, 'prepare-web.mjs'), 'utf8');

test('el reproductor iOS expone los controles nativos a VoiceOver', () => {
  assert.match(player, /closeButton\.setTitle\(spanish \? "Cerrar y volver"/);
  assert.match(player, /playbackButton\.setTitle\(spanish \? "Reproducir vídeo"/);
  assert.match(player, /detailsButton\.setTitle\(spanish \? "Ver detalles"/);
  assert.match(player, /func accessibilityPerformMagicTap\(\) -> Bool/);
  assert.match(player, /func togglePlayback\(\)/);
  assert.match(player, /func toggleDetails\(\)/);
  assert.match(player, /sendPlayerCommand\(playerState == 1/);
  assert.doesNotMatch(player, /webView\.resumeAllMediaPlayback/);
  assert.match(player, /titleLabel\.accessibilityTraits\.insert\(\.header\)/);
});

test('las acciones nativas no sustituyen el motor de YouTube ni alteran la sesión de audio', () => {
  assert.match(player, /tiflo-youtube-player/);
  assert.match(player, /webView\.loadHTMLString\(html, baseURL: baseURL\)/);
  assert.match(player, /https:\/\/www\.youtube\.com\/watch\?v=/);
  assert.match(player, /setCategory\(\.playback, options: \[\.mixWithOthers\]\)/);
  assert.match(player, /setCategory\(category, options: options\)/);
  assert.match(player, /override func viewWillDisappear/);
  assert.match(player, /audioMix\.restore\(\)/);
});

test('Vídeos y Actualidad transmiten metadatos al componente iOS', () => {
  assert.match(packager, /void native\.open\(\{ videoId: nativeId, title:/);
  assert.match(packager, /description: String\(video\.fullDescription/);
  assert.match(packager, /void plugin\.open\(\{ videoId, title: String\(item\.title/);
  assert.match(packager, /channel: String\(item\.sourceName/);
});

test('el cierre del reproductor espera a salir para restaurar el foco en el enlace original', () => {
  assert.match(player, /controller\.onClose = \{ call\.resolve\(\) \}/);
  assert.match(player, /dismiss\(animated: true, completion: completion\)/);
});

test('VoiceOver puede recorrer toda la pantalla y el iframe mantiene el tamaño mínimo', () => {
  assert.match(player, /let scroll = UIScrollView\(\)/);
  assert.match(player, /scroll\.contentLayoutGuide/);
  assert.match(player, /scroll\.frameLayoutGuide/);
  assert.match(player, /webView\.heightAnchor\.constraint\(greaterThanOrEqualToConstant: 225\)/);
  assert.match(player, /header, titleLabel, audioCompatibilityButton, controls, statusLabel, detailsPanel, accountControls, webView/);
});

test('el ajuste de audio se activa solo durante el reproductor y ofrece alternativa accesible', () => {
  assert.match(player, /Self\.audioMixPreference \?\? UIAccessibility\.isVoiceOverRunning/);
  assert.match(player, /override func viewWillAppear/);
  assert.match(player, /override func viewWillDisappear/);
  assert.match(player, /Audio compatible con VoiceOver: activado/);
  assert.match(player, /Audio compatible con VoiceOver: desactivado/);
});

test('TifloReproductor usa la API oficial de YouTube para desplazarse y consultar el tiempo', () => {
  const html = readFileSync(resolve(root, 'native/tiflo-youtube-player.html'), 'utf8');
  assert.match(html, /https:\/\/www\.youtube\.com\/iframe_api/);
  assert.match(html, /new YT\.Player\('player'/);
  assert.match(html, /player\.playVideo\(\)/);
  assert.match(html, /player\.pauseVideo\(\)/);
  assert.match(html, /player\.seekTo\(/);
  assert.match(html, /player\.getCurrentTime\(\)/);
  assert.match(html, /player\.getDuration\(\)/);
  assert.match(html, /onAutoplayBlocked/);
  assert.match(html, /onError/);
  assert.match(html, /enablejsapi: 1/);
  assert.match(player, /private let rewindButton = UIButton/);
  assert.match(player, /private let forwardButton = UIButton/);
  assert.match(player, /private let positionSlider = UISlider/);
  assert.match(player, /Retroceder 30 segundos/);
  assert.match(player, /Avanzar 30 segundos/);
  assert.match(player, /positionSlider\.isContinuous = false/);
  assert.match(player, /positionSlider\.accessibilityValue/);
  assert.match(player, /WKScriptMessageHandler/);
  assert.match(player, /message\.frameInfo\.isMainFrame/);
  assert.match(player, /removeScriptMessageHandler\(forName: "tifloPlayer"\)/);
  assert.doesNotMatch(player, /setAllMediaPlaybackSuspended/);
  assert.doesNotMatch(player, /resumeAllMediaPlayback/);
});

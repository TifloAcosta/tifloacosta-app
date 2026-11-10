import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const library = source('NativeYouTubePersonalLibrary.swift');
const screens = source('NativeScreens.swift');
const player = source('NativeYouTubePlayer.swift');

test('Ver después guarda metadatos públicos sin cuenta Google', () => {
  assert.match(library, /private let key = "native-youtube-personal-library-v1"/);
  assert.match(library, /func toggleWatchLater\(/);
  assert.match(library, /JSONEncoder\(\)\.encode\(videos\)/);
  assert.match(screens, /Section\("Ver después"\)/);
  assert.match(screens, /Section\("Continuar viendo"\)/);
  assert.match(screens, /Guardar para ver después/);
  assert.match(screens, /personalVideos\.toggleWatchLater\(video\)/);
});

test('Progreso del vídeo se retoma y descarta el punto al terminar', () => {
  assert.match(library, /func rememberPlayback\(/);
  assert.match(library, /seconds >= duration - 10 \? 0/);
  assert.match(library, /func clearProgress\(/);
  assert.match(player, /func seek\(toSeconds seconds: Double\)/);
  assert.match(player, /\.onChange\(of: engine\.ready\)/);
  assert.match(player, /engine\.seek\(toSeconds: seconds\)/);
  assert.match(player, /personalLibrary\.rememberPlayback\(video, seconds: engine\.currentTime/);
});

test('El rotor permite guardar en Ver después sin abrir el vídeo', () => {
  assert.match(screens, /\.accessibilityAction\(named: Text\(personalVideos\.isWatchLater/);
  assert.match(screens, /NativeYouTubeTitleActions/);
});

test('Canales seguidos locales accesibles sin exigir Google', () => {
  assert.match(library, /struct NativeSavedYouTubeChannel: Codable, Identifiable/);
  assert.match(library, /native-youtube-followed-channels-v1/);
  assert.match(library, /func toggleFollowed\(/);
  assert.match(library, /func isFollowing\(/);
  assert.match(screens, /Section\("Canales seguidos sin cuenta Google"\)/);
  assert.match(screens, /Seguir canal sin cuenta Google/);
  assert.match(screens, /personalVideos\.toggleFollowed\(channel\)/);
});

test('Novedades reúne los vídeos de canales seguidos por fecha, en grupos de diez', () => {
  assert.match(screens, /private struct NativeYouTubeFollowedUpdatesScreen: View/);
  assert.match(screens, /NavigationLink\("Ver últimos vídeos de mis canales"\)/);
  assert.match(screens, /searches\.values\.flatMap\(\\?\.videos\)/);
  assert.match(screens, /left > right/);
  assert.match(screens, /visibleCount = 10/);
  assert.match(screens, /Button\("Cargar 10 más"\)/);
  assert.match(screens, /loadMore: true/);
});

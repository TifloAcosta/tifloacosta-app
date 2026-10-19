import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL('../Sources/' + file, import.meta.url), 'utf8');
const screens = read('NativeScreens.swift');
const player = read('NativeYouTubePlayer.swift');
const account = read('NativeYouTubeAccount.swift');

test('A single native YouTube search announces the field only once', () => {
  const screen = screens.split('struct NativeVideosScreen: View {')[1].split('// Una sola definición de gestos')[0];
  assert.match(screen, /TextField\("Buscar en todo YouTube"/);
  assert.doesNotMatch(screen, /\.accessibilityLabel\("Buscar en todo YouTube"\)/);
  assert.match(screen, /NativeAdjustableChoice\(\s*title: "Tipo de resultados"/);
  assert.match(screen, /"Todos", "Vídeos", "Canales"/);
  assert.match(screen, /"En directo", "Con subtítulos"/);
  assert.match(screen, /menos de cuatro minutos/);
});

test('VoiceOver offers direct actions without requiring the video player', () => {
  for (const action of ['Reproducir', 'Abrir en YouTube', 'Compartir', 'Me gusta',
    'Quitar Me gusta', 'Suscribirse al canal', 'Cancelar suscripción al canal',
    'Comentar', 'Iniciar sesión con Google']) {
    assert.ok(screens.includes('.accessibilityAction(named: Text("' + action + '"))'), action);
  }
  assert.match(screens, /NativeYouTubeTitleActions/);
  assert.match(screens, /account\.publishComment\(commentText, videoID: video\.id\)/);
  assert.match(screens, /NativeYouTubeVideoRow\(/);
  assert.match(screens, /\.sheet\(item: \$commentingOnVideo\)/);
});

test('Channel and subscription browsing stay native, paginated and use the accessible player', () => {
  assert.match(screens, /NativeYouTubeSubscriptionsScreen/);
  assert.match(screens, /NativeYouTubeChannelVideosScreen/);
  assert.match(screens, /account\.loadSubscriptions\(loadMore: true\)/);
  assert.match(screens, /Button\("Mostrar diez canales más"\)/);
  assert.match(screens, /Button\("Mostrar diez vídeos más"\)/);
  assert.match(screens, /NativeYouTubePlayerScreen\(video: video\)/);
  assert.match(player, /appendingPathComponent\("channel-videos"\)/);
  assert.match(player, /URLQueryItem\(name: "filter"/);
  assert.match(player, /@Published private\(set\) var channels/);
  assert.match(player, /NativeYouTubeSubscriptionPage: Decodable/);
  assert.match(account, /func loadSubscriptions\(loadMore: Bool = false\)/);
  assert.match(account, /call\(\s*"subscriptions"/);
  assert.match(account, /func signIn\(videoID: String = ""\)/);
});

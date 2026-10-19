import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
const account = root('ios-app-native/Sources/NativeYouTubeAccount.swift');
const player = root('ios-app-native/Sources/NativeYouTubePlayer.swift');
const app = root('ios-app-native/Sources/TifloAcostaNativeApp.swift');
const configuration = root('ios-app-native/project.yml');
const plist = root('ios-app-native/Sources/Info.plist');
const worker = root('youtube-worker/src/index.js');

test('Google usa navegador seguro ASWebAuthenticationSession, PKCE y Keychain en iOS', () => {
  assert.match(account, /ASWebAuthenticationSession/);
  assert.match(account, /callbackURLScheme: "tifloacosta"/);
  assert.match(account, /SecRandomCopyBytes/);
  assert.match(account, /SHA256\.hash/);
  assert.match(account, /kSecAttrAccessibleWhenUnlockedThisDeviceOnly/);
  assert.match(account, /SecItemCopyMatching/);
  assert.match(account, /SecItemDelete/);
  assert.match(account, /auth\/native\/start/);
  assert.match(account, /auth\/native\/exchange/);
  assert.match(worker, /nativeChallenge/);
  assert.match(worker, /kind: 'ios-session'/);
  assert.match(plist, /CFBundleURLSchemes/);
  assert.match(plist, /<string>tifloacosta<\/string>/);
  assert.match(configuration, /INFOPLIST_FILE: Sources\/Info\.plist/);
  assert.doesNotMatch(account, /GOOGLE_CLIENT_SECRET|YOUTUBE_SESSION_SECRET|UIWebView|WKWebView/);
});

test('El reproductor permite interactuar con YouTube y control VoiceOver con la sesión real', () => {
  assert.match(app, /@StateObject private var youtubeAccount = NativeYouTubeAccountStore\(\)/);
  assert.match(app, /\.environmentObject\(youtubeAccount\)/);
  assert.match(player, /@EnvironmentObject private var account: NativeYouTubeAccountStore/);
  for (const expected of ['Iniciar sesión con Google', 'Cancelar suscripción al canal',
    'Suscribirse al canal', 'Quitar Me gusta', 'Me gusta', 'Comentar',
    'Publicar comentario', 'Cancelar comentario', 'Cerrar sesión de YouTube']) {
    assert.ok(player.includes(expected), expected);
  }
  assert.match(player, /await account\.publishComment\(commentText, videoID: video\.id\)/);
  assert.match(player, /account\.loadState\(videoID: video\.id\)/);
  assert.match(player, /\.accessibilityLabel\("Escribir comentario en YouTube"\)/);
  assert.match(account, /"unsubscribe"/);
  assert.match(account, /"unlike"/);
});

test('Acciones protegidas requieren sesión y el Worker no devuelve contraseñas ni refresh token', () => {
  assert.match(worker, /nativeCredential\(request\)/);
  assert.match(worker, /decoded\?\.kind !== 'ios-session'/);
  assert.match(worker, /decoded\?\.kind !== 'ios-ticket'/);
  assert.match(worker, /if \(!native\) assertCsrf\(request, session\)/);
  assert.match(worker, /path.*unsubscribe|unsubscribe.*includes\(url\.pathname\)/s);
  assert.match(worker, /unlike/);
  assert.doesNotMatch(worker, /json\(\{.*refreshToken:/);
});

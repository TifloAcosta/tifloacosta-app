import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const account = read('native/TifloYouTubeAuth.swift');
const ui = read('native/TifloYouTubeAccountControls.swift');
const player = read('native/TifloYouTubeViewController.swift');
const installer = read('install-native-video.mjs');

test('el acceso Google usa ASWebAuthenticationSession y llavero local, no WKWebView ni JS', () => {
  assert.match(account, /ASWebAuthenticationSession\(url: startURL, callbackURLScheme: "tifloacosta"\)/);
  assert.match(account, /pkceChallenge|SHA256\.hash/);
  assert.match(account, /SecRandomCopyBytes/);
  assert.match(account, /SecItemAdd/);
  assert.match(account, /kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly/);
  assert.match(account, /send\(path: "\/native\/redeem"/);
  assert.doesNotMatch(account, /evaluateJavaScript/);
  assert.doesNotMatch(account, /localStorage/);
});

test('el paquete iOS registra esquema, autenticación y acciones en Swift compilable', () => {
  assert.match(installer, /TifloYouTubeAuth\.swift/);
  assert.match(installer, /TifloYouTubeAccountControls\.swift/);
  assert.match(installer, /Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string tifloacosta/);
  assert.match(player, /CAPPluginMethod\(name: "signIn"/);
  assert.match(player, /CAPPluginMethod\(name: "accountState"/);
  assert.match(player, /CAPPluginMethod\(name: "accountAction"/);
  assert.match(player, /TifloYouTubeAccountControls\(/);
});

test('la interfaz VoiceOver mantiene reproducción libre y editor explícito', () => {
  assert.match(ui, /Conectar mi cuenta de YouTube/);
  assert.match(ui, /Me gusta este vídeo/);
  assert.match(ui, /Suscribirme al canal/);
  assert.match(ui, /Escribir un comentario/);
  assert.match(ui, /Publicar comentario/);
  assert.match(ui, /Cancelar comentario/);
  assert.match(ui, /Desconectar cuenta de YouTube/);
  assert.match(ui, /Puedes ver el vídeo sin iniciar sesión/);
  assert.match(ui, /UIAccessibility\.post\(notification: \.announcement/);
  assert.match(ui, /guard !message\.isEmpty/);
  assert.doesNotMatch(ui, /password|refreshToken/);
});

test('acciones de cuenta accesibles sin segundo desplazamiento y con retorno del foco', () => {
  assert.match(ui, /private let accountPanel = UIStackView\(\)/);
  assert.doesNotMatch(ui, /private let accountScroller = UIScrollView/);
  assert.match(ui, /UIAccessibility\.post\(notification: \.layoutChanged, argument: self\.accountStatus\)/);
  assert.match(ui, /UIAccessibility\.post\(notification: \.layoutChanged, argument: commentButton\)/);
  assert.match(ui, /UIAccessibility\.post\(notification: \.layoutChanged, argument: signInButton\)/);
});

test('la app exige servidor YouTube compatible antes de presentar Google', () => {
  assert.match(account, /send\(path: "\/native\/capabilities", method: "GET"/);
  assert.match(account, /data\["nativeAuth"\] as\? Bool/);
  assert.match(account, /data\["protocol"\] as\? Int/);
  assert.match(account, /guard ready && protocolVersion == 1/);
  assert.match(account, /self\.beginSignIn\(from: presenter, completion: completion\)/);
});

test('VoiceOver explica errores concretos de la cuenta sin exponer el servidor', () => {
  for (const code of [
    'SESSION_EXPIRED', 'COMMENTS_DISABLED', 'INELIGIBLE_ACCOUNT',
    'INSUFFICIENT_PERMISSIONS', 'QUOTA_EXCEEDED', 'RATE_LIMITED',
    'VIDEO_NOT_FOUND', 'YOUTUBE_FORBIDDEN', 'COMMENT_TOO_LONG'
  ]) {
    assert.ok(account.includes('"' + code + '"'), code);
  }
  assert.match(ui, /spokenError\(error, spanish: self\.spanish\)/);
});

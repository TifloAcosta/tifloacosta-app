import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL('../Sources/' + file, import.meta.url), 'utf8');
const store = read('NativeYouTubePlayer.swift');
const screen = read('NativeScreens.swift');

test('YouTube search errors are separated by source rather than all called a connectivity outage', () => {
  assert.match(store, /if error is DecodingError/);
  assert.match(store, /case \.cannotFindHost, \.dnsLookupFailed:/);
  assert.match(store, /case \.timedOut, \.cannotConnectToHost:/);
  assert.match(store, /case \.secureConnectionFailed, \.serverCertificateUntrusted/);
  assert.match(store, /case \.notConnectedToInternet, \.dataNotAllowed, \.networkConnectionLost:/);
  assert.match(store, /if code == "QUOTA_EXCEEDED"/);
  assert.match(store, /if code == "RATE_LIMITED" \|\| status == 429/);
  assert.match(store, /if code == "ORIGIN_NOT_ALLOWED" \|\| status == 403/);
  assert.doesNotMatch(store, /\?\? "No se pudo conectar con la búsqueda de YouTube\."/);
});

test('a search error exposes retry and a safe official YouTube escape without auto-opening', () => {
  assert.match(store, /@Published private\(set\) var searchFailed = false/);
  assert.match(screen, /if youtubeSearch\.searchFailed \{/);
  assert.match(screen, /Button\("Reintentar búsqueda"\) \{ search\(\) \}/);
  assert.match(screen, /Button\("Buscar directamente en YouTube"\)/);
  assert.match(screen, /URLComponents\(string: "https:\/\/www\.youtube\.com\/results"\)/);
  assert.match(screen, /URLQueryItem\(name: "search_query", value: term\)/);
  assert.match(screen, /if let url = target\.url \{ openURL\(url\) \}/);
});

test('all supported languages translate the new diagnosis and recovery controls', () => {
  const required = [
    'El iPhone no encuentra el servidor de búsqueda de YouTube.',
    'El servicio de YouTube respondió, pero sus datos no pudieron interpretarse.',
    'Reintentar búsqueda', 'Buscar directamente en YouTube'
  ];
  for (const lang of ['en', 'pt', 'fr', 'it', 'de']) {
    const catalog = read(lang + '.lproj/Localizable.strings');
    for (const item of required) {
      assert.ok(catalog.includes('"' + item + '" = '), lang + ': ' + item);
    }
  }
});

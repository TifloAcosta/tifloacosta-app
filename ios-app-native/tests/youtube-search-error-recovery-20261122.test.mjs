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
  assert.match(screen, /Button\("Reintentar búsqueda"\) \{/);
  assert.match(screen, /search\(loadMore: retryMore\)/);
  assert.match(screen, /Button\("Buscar directamente en YouTube"\)/);
  assert.match(screen, /URLComponents\(string: "https:\/\/www\.youtube\.com\/results"\)/);
  assert.match(screen, /URLQueryItem\(name: "search_query", value: term\)/);
  assert.match(screen, /if let url = target\.url \{ openURL\(url\) \}/);
});

test('transient transport and server errors retry only once without resubmitting on quota', () => {
  assert.match(store, /private func fetchWithOneTransientRetry/);
  assert.match(store, /\[502, 503, 504\]\.contains\(response\.statusCode\)/);
  assert.match(store, /error\.code == \.timedOut/);
  assert.match(store, /error\.code == \.networkConnectionLost/);
  assert.match(store, /error\.code == \.cannotConnectToHost/);
  assert.match(store, /let \(data, response\) = try await fetchWithOneTransientRetry\(request\)/);
  assert.equal(store.split('return try await URLSession.shared.data(for: request)').length - 1, 2);
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

test('new YouTube searches clear stale results and paginated retries preserve earlier rows', () => {
  assert.match(store, /if !loadMore && channelID == nil && cleanQuery\.count < 2/);
  assert.match(store, /hasSearched = false[\s\S]{0,200}searchFailed = false[\s\S]{0,200}videos = \[\]/);
  assert.match(store, /var videoIDs = Set\(videos\.map\(\\\.id\)\)/);
  assert.match(store, /videoIDs\.insert\(video\.id\)\.inserted/);
  assert.match(store, /channelIDs\.insert\(channel\.id\)\.inserted/);
  assert.match(store, /playlistIDs\.insert\(playlist\.id\)\.inserted/);
  assert.match(store, /nextPageToken = page\.nextPageToken == requestedPageToken/);
  assert.match(store, /searchFailed = false/);
});

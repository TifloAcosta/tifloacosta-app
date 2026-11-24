import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL('../Sources/' + file, import.meta.url), 'utf8');
const screen = read('NativeAccessibleCinema.swift');
const browser = read('NativeCinemaDriveBrowser.swift');
const storage = read('NativeCloudStorage.swift');
const auth = read('NativeCloudAccount.swift');
const library = read('NativeAccessibleCinemaLibrary.swift');

test('Audesc España and Audesc Latino reuse one authorized Drive explorer', () => {
  assert.match(screen, /\["audesc-es", "audesc-latino"\]\.contains\(source\.id\)/);
  assert.match(screen, /NativeCinemaDriveBrowser\(\s*sourceID: source\.id/);
  assert.match(browser, /NativeCloudAccountStore\.shared/);
  assert.match(browser, /NativeCloudStorage\(provider: \.googleDrive, accessToken: token\)/);
  assert.match(auth, /https:\/\/www\.googleapis\.com\/auth\/drive\.file/);
  assert.doesNotMatch(browser, /https:\/\/drive\.google\.com\/drive\/folders\/[A-Za-z0-9_-]+/);
});

test('folder selection is explicit and local; browsing paginates subfolders and can be refreshed', () => {
  assert.match(browser, /accounts\.selectGoogleDriveFiles\(\)/);
  assert.match(browser, /selected\.first\(where: \\.isFolder\)/);
  assert.match(browser, /UserDefaults\.standard\.set\(folder\.id, forKey: storedFolderKey\)/);
  assert.match(browser, /storage\.listFolder\(id: folder\.id, cursor: reset \? nil : nextCursor\)/);
  assert.match(browser, /files\.append\(contentsOf: page\.items\)/);
  assert.match(browser, /Button\(MusicLocalized\.message\("Abrir carpeta: "\) \+ item\.name\)/);
  assert.match(browser, /Button\("Volver a la carpeta anterior"\)/);
  assert.match(browser, /Button\("Actualizar esta carpeta"\)/);
  assert.match(browser, /Vuelve a elegir la carpeta para autorizar el acceso/);
});

test('cinema download supports bounded long audio and video without changing the music download limit', () => {
  assert.match(storage, /static let maximumAudioBytes = 250 \* 1_024 \* 1_024/);
  assert.match(storage, /func downloadCinema\(_ item: NativeCloudItem/);
  assert.match(storage, /limit: 2_000_000_000/);
  assert.match(storage, /"flac", "mp4", "m4v", "mov"/);
  assert.match(storage, /func download\(_ item: NativeCloudItem, allowsCellular: Bool = true\)/);
  assert.match(storage, /limit: Int64\(Self\.maximumAudioBytes\)/);
  assert.match(storage, /guard size > 0, size <= limit/);
  assert.match(storage, /request\.allowsCellularAccess = allowsCellular/);
});

test('cinema reuses AVPlayer and system background controls for transient cloud media', () => {
  assert.match(library, /func openTemporaryFile\(/);
  assert.match(library, /currentCloudReference = reference/);
  assert.match(library, /player = AVPlayer\(url: file\)/);
  assert.match(library, /beginProgressTracking\(library: library\)/);
  assert.match(library, /cleanUpTemporaryPlayback\(\)/);
  assert.match(library, /NativeRemotePlaybackOwner\.claim\(\.cinema\)/);
  assert.match(browser, /player\.toggle\(library: personalLibrary\)/);
  assert.match(browser, /player\.seek\(by: -30, library: personalLibrary\)/);
  assert.match(browser, /player\.pauseAndSave\(library: personalLibrary\)/);
  assert.match(browser, /NativeCinemaVideoSurface\(player: video\)/);
});

test('preview playback is transparent about the full temporary download and never imports silently', () => {
  assert.match(browser, /Descargar temporalmente y reproducir:/);
  assert.match(browser, /La reproducción comenzará al terminar/);
  assert.match(browser, /No se ha importado a tu colección personal/);
  assert.doesNotMatch(browser, /importAudio\(/);
  assert.doesNotMatch(browser, /try\s+personalLibrary\.import/);
  assert.match(browser, /try await storage\.downloadCinema\(item, allowsCellular: allowCellularDownloads\)/);
  assert.match(browser, /guard network\.canDownload\(allowCellular: allowCellularDownloads\)/);
  assert.match(browser, /\.accessibilityAddTraits\(\.updatesFrequently\)/);
});

test('source selection is not confused with automatic public-catalogue authorization', () => {
  assert.match(storage, /not progressive streaming/);
  assert.match(browser, /No fallback to broad Drive scopes/);
  assert.match(browser, /No se pudo leer esta carpeta con los permisos actuales/);
  assert.doesNotMatch(browser, /drive\.readonly|auth\/drive"|"api[_-]?key"/i);
  assert.doesNotMatch(browser, /"https:\/\/www\.googleapis\.com\/drive\/v3/);
});

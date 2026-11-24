import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = f => readFileSync(new URL('../Sources/' + f, import.meta.url), 'utf8');
const settings = read('Info.plist');
const publicDrive = read('NativeCinemaPublicDrive.swift');
const publisher = read('NativeCinemaPublishedDriveBrowser.swift');
const player = read('NativeAccessibleCinemaLibrary.swift');
const loader = read('NativeCinemaDriveResourceLoader.swift');
const home = read('NativeAccessibleCinema.swift');

test('Audesc Spain/Latino public roots are source-approved and public mode is gated', () => {
  assert.match(settings, /<key>TifloCinemaAudescSpainFolderID<\/key><string>[A-Za-z0-9_-]{20,}<\/string>/);
  assert.match(settings, /<key>TifloCinemaAudescLatinoFolderID<\/key><string>[A-Za-z0-9_-]{20,}<\/string>/);
  assert.match(settings, /<key>TifloCinemaPublicDriveAPIKey<\/key><string><\/string>/);
  assert.match(publicDrive, /static var configuredKey: String\?/);
  assert.match(publicDrive, /key\.hasPrefix\("AIza"\)/);
  assert.match(home, /NativeCinemaPublicDrive\.configuredKey != nil/);
  assert.match(home, /NativeCinemaDriveBrowser/);
});

test('official FOAL shortcuts resolve only to Google Drive folders', () => {
  assert.match(publicDrive, /case "foal-films": address = "https:\/\/bit\.ly\/2yMtJrk"/);
  assert.match(publicDrive, /case "foal-game-of-thrones": address = "https:\/\/bit\.ly\/3bND3dg"/);
  assert.match(publicDrive, /target\.host == "drive\.google\.com"/);
  assert.match(publicDrive, /NativeCinemaFOALRedirects/);
  assert.match(home, /NativeCinemaPublishedDriveBrowser/);
  assert.match(home, /https:\/\/bit\.ly\/2yMtJrk/);
  assert.match(home, /https:\/\/bit\.ly\/3bND3dg/);
});

test('public directory is read-only, does not mix OAuth, and supports pagination and resource keys', () => {
  assert.match(publicDrive, /func listFolder\(/);
  assert.match(publicDrive, /nextPageToken,files\(id,name,mimeType,size,resourceKey\)/);
  assert.match(publicDrive, /"pageSize", value: "100"/);
  assert.match(publicDrive, /"includeItemsFromAllDrives", value: "true"/);
  assert.match(publicDrive, /"X-Goog-Drive-Resource-Keys"/);
  assert.match(publicDrive, /"X-Ios-Bundle-Identifier"/);
  assert.doesNotMatch(publicDrive, /Bearer |refreshToken|CloudOAuthGoogleClientID/);
  assert.doesNotMatch(publicDrive, /www\.dropbox\.com|https:\/\/drive\.google\.com\/uc/);
  assert.match(publicDrive, /throw NativeCinemaPublicDriveError\.denied/);
  assert.match(publicDrive, /return NativeCinemaPublicDrivePage/);
});

test('listing refreshes on demand and does not persist expired premieres', () => {
  assert.match(publisher, /\.task \{ if path\.isEmpty \{ await openRoot\(\) \} \}/);
  assert.match(publisher, /Button\("Actualizar esta carpeta"\)/);
  assert.match(publisher, /entries = page\.entries/);
  assert.match(publisher, /cursor = page\.nextCursor/);
  assert.match(publisher, /Butto[n]\("Cargar más archivos de esta carpeta"\)/);
  assert.doesNotMatch(publisher, /FileManager\.default\.copyItem|catalogo\.json|JSONEncoder/);
});

test('AVFoundation progressive streaming uses documented byte ranges and a restricted iOS key', () => {
  assert.match(loader, /AVAssetResourceLoaderDelegate/);
  assert.match(loader, /asset\.resourceLoader\.setDelegate\(self, queue: loaderQueue\)/);
  assert.match(loader, /request\.setValue\("bytes=\\\(offset\)-\\\(offset \+ length - 1\)"/);
  assert.match(loader, /"X-Ios-Bundle-Identifier"/);
  assert.match(loader, /"X-Goog-Drive-Resource-Keys"/);
  assert.match(loader, /http\.statusCode == 206/);
  assert.match(loader, /information\.isByteRangeAccessSupported = true/);
  assert.match(loader, /dataRequest\?\.respond\(with: chunk\)/);
  assert.match(loader, /func resourceLoader\(_ resourceLoader: AVAssetResourceLoader,/);
  assert.doesNotMatch(loader, /AVURLAssetHTTPHeaderFieldsKey|Authorization", forHTTPHeaderField|drive\.readonly/);
  assert.match(player, /private var publicDriveLoader: NativeCinemaDriveResourceLoader\?/);
  assert.match(player, /publicDriveLoader\?\.cancel\(\)/);
  assert.match(publisher, /NativeCinemaDriveResourceLoader\(/);
});

test('fallback downloads are bounded, never imported to the personal library, with resume', () => {
  assert.match(publicDrive, /static let sizeLimit: Int64 = 2_000_000_000/);
  assert.match(publicDrive, /allowsCellularAccess = allowsCellular/);
  assert.match(publicDrive, /URLSessionConfiguration\.ephemeral/);
  assert.match(publicDrive, /func download\(/);
  assert.match(publisher, /func downloadAndPlay\(/);
  assert.match(publisher, /try player\.openTemporaryFile\(/);
  assert.match(player, /cinema\.cloud\.position\./);
  assert.doesNotMatch(publisher, /library\.importAudio|saveInPersonalLibrary/);
});

test('the new public directory text is translated into every supported language', () => {
  const required = [
    'Biblioteca de audiodescripción', 'Obras disponibles',
    'No hay obras compatibles en esta carpeta.',
    'El catálogo público de Google Drive necesita terminar su configuración.',
    'Reproducir: ', 'No se ha podido recuperar la carpeta oficial de FOAL.',
    'Explorar catálogo audiodescrito',
    'Los catálogos públicos se actualizan desde Google Drive cuando la conexión pública está configurada. También puedes elegir carpetas autorizadas con tu propia cuenta.'
  ];
  for (const lang of ['en', 'pt', 'fr', 'it', 'de']) {
    const dictionary = read(lang + '.lproj/Localizable.strings');
    for (const key of required) {
      assert.ok(dictionary.includes('"' + key + '" = '), lang + ' missing ' + key);
    }
  }
});

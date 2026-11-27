import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const home = read('NativeScreens.swift'), contact = read('NativeContact.swift');
const downloads = read('NativeDownloads.swift'), drive = read('NativeDownloadLink.swift');
const transfer = read('NativeDriveTransfer.swift');

test('Mi libro se abre desde Contacto y no aparece en Inicio', () => {
  assert.ok(!home.includes('case libro = "Mi libro"'));
  assert.ok(contact.includes('NativeBookScreen()'));
  assert.ok(contact.includes('Section("Mi libro")'));
});

test('Analizar enlace reconoce Google Drive y Docs', () => {
  assert.ok(downloads.includes('Analizar enlace'));
  assert.ok(downloads.includes('await store.analyze(address)'));
  assert.ok(downloads.includes('request.httpMethod = "HEAD"'));
  assert.ok(drive.includes('https://drive.google.com/uc'));
  assert.ok(drive.includes('resourcekey'));
  assert.ok(drive.includes('format", value: "pdf"'));
  assert.ok(drive.includes('unsupportedFolder'));
});

test('Descargas presenta errores de servidor sin guardar páginas de Google', () => {
  assert.ok(drive.includes('case 401, 403: throw NativeDownloadLinkError.accessDenied'));
  assert.ok(drive.includes('case 404, 410: throw NativeDownloadLinkError.notFound'));
  assert.ok(drive.includes('contentType.contains("text/html")'));
  assert.ok(downloads.includes('verifyResponse(response, for: item)'));
  assert.ok(downloads.includes('store.canDownload'));
  assert.ok(downloads.includes('Abrir enlace original'));
});

test('Mis descargas conserva importar, compartir y eliminar accesibles', () => {
  assert.ok(downloads.includes('Section("Mis descargas")'));
  assert.ok(downloads.includes('await library.importFile(from: file.url)'));
  for (const label of ['Importar en TifloLector','Compartir','Eliminar']) {
    assert.ok(downloads.includes('.accessibilityAction(named: Text("' + label + '"))'));
  }
  assert.ok(downloads.includes('confirmationDialog('));
});

test('Descargas gestiona la confirmación de Drive y no guarda una página HTML', () => {
  assert.match(downloads, /NativeDriveTransfer\.download\(item\)/);
  assert.match(transfer, /https:\/\/drive\.usercontent\.google\.com\/download/);
  assert.match(transfer, /confirmationURL\(temporary, response: response, item: item\)/);
  assert.match(transfer, /verifyResponse\(confirmedResponse, for: item\)/);
  assert.match(transfer, /size <= 1024 \* 1024/);
  assert.match(transfer, /"at", "authuser"/);
  assert.match(transfer, /URLQueryItem\(name: "confirm", value: "t"\)/);
  assert.match(transfer, /validHost\(components\.host\)/);
  assert.match(transfer, /components\.scheme == "https"/);
  assert.match(transfer, /query\.first\(where: \{ \$0\.name == "id" \}\)\?\.value == expectedID/);
});


test('download instructions precede the address and are localized with matching action names', () => {
  const screen = readFileSync(new URL('../Sources/NativeDownloads.swift', import.meta.url), 'utf8');
  const keys = ["Esta sección permite descargar archivos mediante enlaces directos de Internet o de servicios en la nube, como Google Drive, siempre que permitan su descarga.","Copia el enlace, pulsa «Pegar enlace», después «Analizar enlace» y, si está disponible, «Descargar en TifloAcosta».","En «Mis descargas» podrás importar los archivos en TifloLector, compartirlos o eliminarlos.","El límite es de 100 MB por archivo. No admite carpetas completas ni vídeos de YouTube.","Descargar en TifloAcosta","Descargando en TifloAcosta"];
  const intro = screen.slice(screen.indexOf('Section("Descargar desde un enlace")'), screen.indexOf('TextField("Enlace HTTPS"'));
  for (const key of keys.slice(0, 4)) assert.ok(intro.includes(JSON.stringify(key)), key);
  assert.ok(intro.includes('.accessibilityElement(children: .combine)'));
  for (const lang of ['en', 'fr', 'de', 'it', 'pt']) {
    const catalog = readFileSync(new URL('../Sources/' + lang + '.lproj/Localizable.strings', import.meta.url), 'utf8');
    for (const key of keys) assert.ok(catalog.includes(JSON.stringify(key) + ' = '), lang + ': ' + key);
  }
});

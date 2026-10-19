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
  assert.ok(downloads.includes('library.importDocuments(from: [file.url])'));
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
  assert.match(transfer, /size <= 512 \* 1024/);
  assert.match(transfer, /validHost\(components\.host\)/);
  assert.match(transfer, /components\.scheme == "https"/);
  assert.match(transfer, /query\.first\(where: \{ \$0\.name == "id" \}\)\?\.value == expectedID/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const settings = source('NativeUpdatesSettings.swift');
const theme = source('TifloVisual.swift');
const app = source('TifloAcostaNativeApp.swift');
const downloads = source('NativeDownloads.swift');
const transfer = source('NativeDriveTransfer.swift');

test('Configuración conserva las cuatro opciones visuales de la web', () => {
  assert.match(settings, /DisclosureGroup\("Ajustes visuales", isExpanded: \$showVisualSettings\)/);
  assert.match(settings, /@State private var showVisualSettings = false/);
  for (const title of ['Tamaño del texto', 'Color y contraste', 'Espaciado', 'Legibilidad']) {
    assert.ok(settings.includes('Text("' + title + '")'), title);
  }
  for (const key of ['native-ios-color-scheme','native-ios-text-size','native-ios-line-spacing','native-ios-strong-text']) {
    assert.ok(settings.includes('@AppStorage("' + key + '")'), key);
  }
  for (const choice of ['Predeterminado','Grande','Muy grande','Máximo','Seguir el sistema','Alto contraste claro','Alto contraste oscuro','Normal','Cómoda','Amplia','Usar texto reforzado','Restablecer ajustes visuales']) {
    assert.ok(settings.includes(choice), choice);
  }
});

test('Las preferencias se aplican en raíz, sin reducir el tamaño del sistema', () => {
  assert.match(app, /\.tifloVisualPreferences\(\)/);
  assert.match(theme, /@Environment\(\\.dynamicTypeSize\)/);
  assert.match(theme, /max\(systemTextSize, minimum\)/);
  assert.match(theme, /\.lineSpacing\(/);
  assert.match(theme, /\.fontWeight\(strongText/);
  assert.match(theme, /contrastLight: 0x000000, contrastDark: 0xFFFFFF/);
  assert.match(theme, /native-ios-color-scheme/);
});

test('Descargar en TifloAcosta guarda localmente y permite importar o compartir', () => {
  assert.match(downloads, /"Descargar en TifloAcosta"/);
  assert.match(downloads, /FileManager\.default\.copyItem\(at: temporary, to: destination\)/);
  assert.match(downloads, /Section\("Mis descargas"\)/);
  assert.match(downloads, /library\.importDocuments\(from: \[file\.url\]\)/);
  assert.match(downloads, /NativeShare\.present\(url: file\.url\)/);
  assert.match(downloads, /NativeDriveTransfer\.download\(item\)/);
});

test('Google Drive prueba los dos puntos de descarga antes de informar de rechazo', () => {
  assert.match(transfer, /drive\.usercontent\.google\.com\/download/);
  assert.match(transfer, /case \.accessDenied, \.notFound:/);
  assert.match(transfer, /case \.accessDenied, \.notFound:[\s\S]*?continue/);
  assert.match(transfer, /verifyResponse\(confirmedResponse, for: item\)/);
});

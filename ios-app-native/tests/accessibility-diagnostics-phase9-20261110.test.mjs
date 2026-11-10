import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const report = read('NativeAccessibilityReport.swift');
const settings = read('NativeUpdatesSettings.swift');

test('El diagnóstico contiene solo metadatos técnicos mínimos', () => {
  assert.match(report, /CFBundleShortVersionString/);
  assert.match(report, /CFBundleVersion/);
  assert.match(report, /UIDevice\.current\.systemVersion/);
  assert.match(report, /UIDevice\.current\.model/);
  assert.match(report, /UIAccessibility\.isVoiceOverRunning/);
  assert.doesNotMatch(report.replace(/^\s*\/\/\/.*$/gm, ''), /UserDefaults|URLSession|documents\.|apiKey|password|filePath/);
});

test('Comunicación de incidencias exige texto e intervención expresa', () => {
  assert.match(report, /TextEditor\(text: \$description\)/);
  assert.match(report, /TextEditor\(text: \$steps\)/);
  assert.match(report, /Toggle\("Incluir diagnóstico básico"/);
  assert.match(report, /ShareLink\(item: reportText/);
  assert.match(report, /\.disabled\(!canShare\)/);
  assert.match(report, /UIPasteboard\.general\.string = reportText/);
  assert.match(report, /No se envía automáticamente/);
  assert.match(settings, /NavigationLink\("Comunicar incidencia de accesibilidad"\)/);
});

test('Correo de asistencia usa mailto y nunca envía por cuenta propia', () => {
  assert.match(report, /components\.scheme = "mailto"/);
  assert.match(report, /components\.path = "tifloacosta@gmail.com"/);
  assert.match(report, /URLQueryItem\(name: "body", value: reportText\)/);
  assert.match(report, /Link\(destination: supportMailURL\)/);
  assert.doesNotMatch(report, /MFMailComposeViewController|URLSession\.shared\.upload|sendMail/);
});

test('Diagnóstico opcional incluye estado accesible y sincronización sin texto privado', () => {
  assert.match(report, /UIAccessibility\.isReduceMotionEnabled/);
  assert.match(report, /UIAccessibility\.isBoldTextEnabled/);
  assert.match(report, /@EnvironmentObject private var catalog: NativeCatalogStore/);
  assert.match(report, /catalog\.lastUpdated\?\.formatted/);
  assert.match(report, /catalog\.resources\.count/);
  assert.match(report, /catalog\.videos\.count/);
  assert.match(report, /catalog\.news\.count/);
  assert.match(report, /if includeDiagnostics/);
  assert.match(report, /catalogSummary: catalogSummary/);
});

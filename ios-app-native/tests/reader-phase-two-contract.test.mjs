import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const swift = (name) => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const reader = swift('NativeTifloLector.swift');
const formats = swift('NativeReaderFormats.swift');
const office = swift('NativeOfficeText.swift');
const settings = swift('NativeReaderSettings.swift');
const plist = swift('Info.plist');

test('la voz informa el progreso real por palabra sin avanzar al pausar', () => {
  assert.match(reader, /willSpeakRangeOfSpeechString/);
  assert.match(reader, /guard let self, self.isPlaying/);
  assert.match(reader, /onReceive\(speech\.\$textPercent\)/);
  assert.match(reader, /baseUTF16:/);
  assert.match(reader, /startTextSpeech\(\)/);
});

test('salto al porcentaje retoma voz por la nueva posición y conserva pausa', () => {
  assert.match(reader, /else if speech\.isPlaying \|\| speech\.isPaused/);
  assert.match(reader, /if wasPaused \{ speech\.pause\(\) \}/);
  assert.match(reader, /speech\.seek\(to: value\)/);
  assert.match(reader, /Avanzar 30 segundos/);
});

test('progreso y temporizador accesibles por documento', () => {
  assert.match(reader, /Tiempo restante estimado/);
  assert.match(reader, /Tiempo realizado/);
  assert.match(reader, /Apagado automático/);
  assert.match(reader, /sleep\(after: 0\)/);
  assert.match(reader, /Añadir marca/);
});

test('modos de navegación incluyendo páginas y encabezados', () => {
  assert.match(reader, /pageStarts/);
  assert.match(reader, /headingStarts/);
  assert.match(settings, /"Página", "Encabezado"/);
});

test('Office mantiene secuencia de diapositivas y textos compartidos de Excel', () => {
  assert.match(office, /slide\[0-9\]/);
  assert.match(office, /SharedStringsReader/);
  assert.match(office, /WorksheetReader/);
  assert.match(office, /Fila/);
  assert.match(formats, /NativeOfficeText\.slides/);
  assert.match(formats, /NativeOfficeText\.spreadsheet/);
});

test('PDF muestra identificadores de página, sin afirmar soporte para binarios antiguos', () => {
  assert.match(formats, /Página/);
  assert.match(formats, /PPS y PPT antiguas todavía no están admitidas/);
  assert.match(formats, /XLS antiguos todavía no están admitidos/);
});

test('se declara reproducción de audio en segundo plano', () => {
  assert.match(plist, /<key>UIBackgroundModes<\/key><array><string>audio<\/string><\/array>/);
});

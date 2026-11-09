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

test('la navegación accesible del lector salta de cinco en cinco por ciento', () => {
  assert.match(reader, /Avanzar cinco por ciento/);
  assert.match(reader, /Retroceder cinco por ciento/);
  assert.match(reader, /currentPercent \+ 5/);
  assert.match(reader, /currentPercent - 5/);
  assert.doesNotMatch(reader, /Avanzar diez por ciento|Retroceder diez por ciento/);
});

test('Botón Reproducir ofrece gestos de un minuto y mantiene doble toque', () => {
  assert.match(reader, /\.accessibilityAdjustableAction \{ direction in/);
  assert.match(reader, /case \.increment: skipReading\(1\)/);
  assert.match(reader, /case \.decrement: skipReading\(-1\)/);
  assert.match(reader, /speech\.skip\(seconds: TimeInterval\(direction \* 60\)\)/);
  assert.match(reader, /speech\.isPlaying \? pausePlayback\(\) : play\(\)/);
});
test('Toque mágico solo controla la reproducción actual', () => {
  assert.match(reader, /\.accessibilityAction\(\.magicTap\)/);
  assert.match(reader, /if speech\.isPlaying \{ pausePlayback\(\) \}/);
  assert.match(reader, /else if speech\.isPaused \{ play\(\) \}/);
});
test('Marcas incluyen contexto y borrado anuncia el título exacto', () => {
  assert.match(reader, /private func bookmarkDescription\(at percent: Int\)/);
  assert.match(reader, /Button\(bookmarkDescription\(at: percent\)\)/);
  assert.match(reader, /Vas a eliminar «\\\(doc\.title\)»/);
});

test('Navegación y marcas son accesibles junto a los controles principales', () => {
  assert.match(reader, /title: "Modo de navegación"/);
  assert.match(reader, /choices: \["Bloque", "Párrafo", "Frase", "Página", "Encabezado"\]/);
  assert.match(reader, /Button\("Unidad anterior"\) \{ moveUnit\(-1\) \}/);
  assert.match(reader, /Button\("Unidad siguiente"\) \{ moveUnit\(1\) \}/);
  assert.match(reader, /Button\("Marcas guardadas"\) \{ showSavedMarks = true \}/);
});

test('el temporizador no se reinicia al pasar a otra pista y se cancela al pausar', () => {
  assert.match(reader, /@State private var sleepDeadline: Date\?/);
  assert.match(reader, /func sleep\(afterSeconds seconds: TimeInterval\)/);
  assert.match(reader, /try await Task\.sleep\(for: \.seconds\(seconds\)\)/);
  assert.match(reader, /sleepDeadline = Date\(\)\.addingTimeInterval/);
  assert.match(reader, /speech\.sleep\(afterSeconds: seconds\)/);
  assert.match(reader, /applySleepTimer\(reset: true\)/);
  assert.match(reader, /sleepDeadline = nil/);
});

test('La posición exacta del texto se guarda y recupera sin romper bibliotecas anteriores', () => {
  assert.match(reader, /var lastTextOffset: Int\? = nil/);
  assert.match(reader, /func saveTextPosition\(_ document: NativeReadingDocument, offset: Int\)/);
  assert.match(reader, /library\.saveTextPosition\(document, offset: readingOffset\)/);
  assert.match(reader, /latest\.lastTextOffset \?\?/);
  assert.match(reader, /startPercent == nil \? \(latest\.lastTextOffset/);
  assert.match(reader, /try JSONEncoder\(\)\.encode\(documents\)\.write\(to: Self\.storageURL, options: \.atomic\)/);
});

test('DAISY conserva encabezados NCC vinculados a SMIL en los metadatos del libro', () => {
  assert.match(formats, /ncc\.html/);
  assert.match(formats, /NativeDaisyNavigationPoint\(title: title, level: level, track: track,/);
  assert.match(formats, /daisyNavigation: daisyNavigation/);
  assert.match(reader, /var daisyNavigation: \[NativeDaisyNavigationPoint\]\? = nil/);
  assert.match(reader, /daisyNavigation: payload\.daisyNavigation/);
  assert.match(reader, /Section\("Navegación DAISY por encabezados"\)/);
  assert.match(reader, /Button\("Nivel/);
});

test('TTS mantiene progreso exacto en caracteres con aviso por palabra', () => {
  assert.match(reader, /@Published private\(set\) var textCharacterOffset = 0/);
  assert.match(reader, /self\.previousCharacterCount \+= self\.spokenText\.distance/);
  assert.match(reader, /self\.textCharacterOffset = self\.baseCharacters \+ self\.previousCharacterCount/);
  assert.match(reader, /baseCharacters: readingOffset/);
  assert.match(reader, /\.onReceive\(speech\.\$textCharacterOffset\)/);
  assert.match(reader, /readingOffset = max\(0, min\(textLayout\.totalCharacters, offset\)\)/);
});

test('El índice DAISY respeta fragmentos SMIL y tiempos dentro de las pistas', () => {
  assert.match(formats, /private static func daisyAudio\(in xml: String, fragment: String\?\)/);
  assert.match(formats, /private static func smilSeconds\(_ clock: String\)/);
  assert.match(formats, /attribute\("clipBegin", in: tag\)/);
  assert.match(formats, /seconds: target\.seconds/);
  assert.match(reader, /var seconds: TimeInterval\? = nil/);
  assert.match(reader, /func seek\(toSeconds seconds: TimeInterval\)/);
  assert.match(reader, /speech\.seek\(toSeconds: seconds\)/);
  assert.match(reader, /jumpToDaisy\(point\)/);
});

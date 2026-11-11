import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const reader = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');
const settings = readFileSync(new URL('../Sources/NativeReaderSettings.swift', import.meta.url), 'utf8');

test('La biblioteca presenta Importar y documentos antes de opciones secundarias', () => {
  const screen = reader.slice(reader.indexOf('struct NativeReaderLibraryScreen: View'),
                              reader.indexOf('private struct NativeReaderTextLayout'));
  const positions = [
    'Button("Importar", systemImage:',
    'Section("Mi biblioteca")',
    'Section("Filtrar y ordenar")',
    'Section("Carpetas")',
    'Section("Más opciones")'
  ].map(item => screen.indexOf(item));
  assert.ok(positions.every(value => value >= 0), 'Faltan secciones');
  assert.ok(positions.every((value, index) => !index || value > positions[index - 1]),
            'La biblioteca debe preceder a filtros, carpetas y ajustes');
});

test('Pausas Normal Mayor Expresiva y Personalizadas ofrecen ajustes reales por signo', () => {
  assert.match(settings, /choices: \["Normal", "Mayor", "Expresiva", "Personalizadas"\]/);
  assert.match(settings, /private let choices = \(0\.\.\.30\)\.map/);
  for (const name of ['comma', 'semicolon', 'colon', 'sentence', 'paragraph']) {
    assert.match(settings, new RegExp('native-reading-pause-' + name));
  }
  assert.match(settings, /NativeReaderPauseProfile/);
  assert.match(reader, /NativeReaderPauseProfile\.segments\(Self\.textForSpeech\(text\)\)/);
  assert.match(reader, /utterance\.postUtteranceDelay =/);
  assert.match(reader, /utteranceOffsets\[identifier\] = utf16Offset/);
  assert.match(reader, /self\.lastSpeechUtterance == ObjectIdentifier\(utterance\)/);
});

test('Lectura por fragmentos ignora eventos de una reproducción ya cancelada', () => {
  assert.match(reader, /guard let segmentBase = self\.utteranceOffsets\[ObjectIdentifier\(utterance\)\] else/);
  assert.match(reader, /utteranceOffsets\.removeAll\(\)/);
  assert.match(reader, /lastSpeechUtterance = identifier/);
});

test('La reproducción del sistema respeta cada pausa sin encolar todo el documento', () => {
  assert.match(reader, /private var speechQueue:/);
  assert.match(reader, /private func speakNextSystemSegment\(after delay:/);
  assert.match(reader, /Task\.sleep\(for: \.seconds\(delay\)\)/);
  assert.match(reader, /speechQueue\.append\(\(utterance: utterance, delay: segment\.delay\)\)/);
  assert.match(reader, /speakNextSystemSegment\(after: completedDelay\)/);
  assert.match(reader, /synthesizer\.stopSpeaking\(at: \.immediate\)/);
  assert.match(reader, /speechDelayTask\?\.cancel\(\)/);
  assert.match(reader, /if systemSpeechNeedsRestart && !isGeneratedSpeech && player == nil/);
});

test('El gesto mágico funciona tanto en el botón principal como en el lector', () => {
  assert.equal((reader.match(/\.accessibilityAction\(\.magicTap\)/g) || []).length, 1);
  assert.match(reader, /if speech\.isPlaying \{ pausePlayback\(\) \}/);
  assert.match(reader, /else if speech\.isPaused \{\s*speech\.resume\(\)/);
});

test('El detalle de biblioteca se puede seleccionar en tres niveles', () => {
  assert.match(reader, /Información de cada documento con VoiceOver/);
  assert.match(reader, /Título, porcentaje y formato/);
  assert.match(reader, /Título, porcentaje, formato y carpeta/);
  assert.match(reader, /if voiceOverDetailIndex == 1 \{ return formatLabel \}/);
});

test('Pausar TTS corta el motor y reanuda desde el cursor almacenado', () => {
  assert.match(reader, /systemSpeechNeedsRestart = !speechQueue\.isEmpty/);
  assert.match(reader, /let resumeUTF16 = max\(0, min\(previousUTF16/);
  assert.match(reader, /let resumeCharacters = max\(0, min\(previousCharacterCount/);
  assert.match(reader, /play\(remainder, speed: resumedSpeed, pitch: resumedPitch/);
  assert.match(reader, /&& speechQueue\.isEmpty \{/);
  assert.match(reader, /\.accessibilityAction\(\.magicTap\) \{\s*if speech\.isPlaying \{ pausePlayback\(\) \}/);
});

test('La voz ignora marcadores estructurales de EPUB conservando las posiciones', () => {
  assert.match(reader, /private static func textForSpeech\(_ source: String\) -> String/);
  assert.match(reader, /NSRegularExpression\(pattern: #/);
  assert.match(reader, /String\(repeating: " ", count: match\.range\.length\)/);
  assert.match(reader, /NativeReaderPauseProfile\.segments\(Self\.textForSpeech\(text\)\)/);
});


test('Motor predeterminado y voz Gemini están dentro de Audio', () => {
  assert.match(settings, /"Motor de lectura predeterminado" : "Motor de lectura de esta obra"/);
  assert.match(settings, /"Voz Gemini predeterminada" : "Voz Gemini de esta obra"/);
  assert.doesNotMatch(reader, /title: "Motor de lectura",/);
  assert.match(reader, /Button\("Audio"\) \{ showAudioSettings = true \}/);
});

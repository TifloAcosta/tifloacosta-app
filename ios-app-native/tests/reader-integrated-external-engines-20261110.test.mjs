import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../Sources/' + p, import.meta.url), 'utf8');
const reader = read('NativeTifloLector.swift');
const settings = read('NativeReaderSettings.swift');

test('Gemini y Phonon siguen disponibles para lectura directa, no solo exportación', () => {
  assert.match(reader, /func playGemini\(/);
  assert.match(reader, /func playPhonon\(/);
  assert.match(reader, /NativeGeminiSpeech\.generate\(segment, voice:/);
  assert.match(reader, /NativePhononRuntime\.generate\(text: segment, voice:/);
  assert.match(reader, /title: "Motor de lectura"/);
  assert.match(reader, /choices: \["Voces del sistema", "Gemini", "Phonon"\]/);
  assert.match(reader, /if readingEngine == 1/);
  assert.match(reader, /if readingEngine == 2/);
  assert.match(settings, /NavigationLink\("Motores externos"\)/);
});

test('Audio generado conserva cursor textual y navegación por tiempo estimado', () => {
  assert.match(reader, /var isGeneratedSpeech: Bool/);
  assert.match(reader, /self\.textCharacterOffset = self\.generatedBaseCharacters \+ self\.generatedCharacters/);
  assert.match(reader, /if speech\.hasAudio && !speech\.isGeneratedSpeech/);
  assert.match(reader, /guard \(!speech\.hasAudio \|\| speech\.isGeneratedSpeech\), speech\.isPlaying/);
  assert.match(reader, /geminiGeneration \+= 1/);
  assert.match(reader, /geminiTask\?\.cancel\(\)/);
});

test('El toque mágico no ejecuta dos veces la orden', () => {
  assert.equal((reader.match(/\.accessibilityAction\(\.magicTap\)/g) || []).length, 1);
});

test('Reanudar un motor externo quita primero la pausa y luego genera el fragmento', () => {
  const start = reader.indexOf('    func resume() {');
  const end = reader.indexOf('    func refresh() {', start);
  assert.ok(start >= 0 && end > start);
  const resume = reader.slice(start, end);
  const clearPause = resume.indexOf('isPaused = false');
  const continueGenerated = resume.indexOf('playNextGeminiSegment()');
  assert.ok(clearPause >= 0 && continueGenerated > clearPause,
    'Gemini y Phonon no deben intentar generar un segmento mientras siguen en pausa');
  assert.match(reader, /guard isGeneratedSpeech, !isPaused, geminiSegments\.indices/);
});

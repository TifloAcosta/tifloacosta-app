import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const screen = read('NativeAccessibleCinema.swift');
const library = read('NativeAccessibleCinemaLibrary.swift');

test('cinema imports private audio and video without requiring a ZIP or vendor account', () => {
  assert.match(screen, /Section\("Mi colección personal"\)/);
  assert.match(screen, /Button\("Importar audio o vídeo desde Archivos"\)/);
  assert.match(screen, /allowedContentTypes: \[\.audio, \.movie\]/);
  assert.match(screen, /allowsMultipleSelection: true/);
  assert.match(library, /url\.startAccessingSecurityScopedResource\(\)/);
  assert.match(library, /FileManager\.default\.copyItem\(at: url, to: destination\)/);
  assert.match(library, /"TifloCinemaPersonal"/);
});

test('cinema persists book identity, language, type and exact playback position', () => {
  assert.match(library, /struct NativeCinemaLocalItem: Codable, Hashable, Identifiable/);
  assert.match(library, /var lastSeconds: Double/);
  assert.match(library, /func savePosition\(_ seconds: Double, for id: UUID\)/);
  assert.match(library, /lastSeconds: 0/);
  assert.match(library, /player\?\.seek\(to: CMTime\(seconds: restored, preferredTimescale: 600\)\)/);
  assert.match(screen, /personalPlayer\.pauseAndSave\(library: personalLibrary\)/);
});

test('playback supports pause, seek, resume and explicit deletion without changing VoiceOver', () => {
  assert.match(screen, /Button\(personalPlayer\.playing \? "Pausar reproducción" : "Reanudar reproducción"\)/);
  assert.match(screen, /Retroceder treinta segundos/);
  assert.match(screen, /Avanzar treinta segundos/);
  assert.match(screen, /\.confirmationDialog\(/);
  assert.match(screen, /Button\("Eliminar archivo personal", role: \.destructive\)/);
  assert.match(library, /private var player: AVPlayer\?/);
  assert.doesNotMatch(library, /outputVolume|MPVolumeView|voiceOver/);
});

test('import checks permitted local types, size and link safety', () => {
  assert.match(library, /private static let allowedExtensions/);
  assert.match(library, /properties\.isSymbolicLink != true/);
  assert.match(library, /maximumFileSize: Int64 = 2_000_000_000/);
  assert.match(library, /try bytes\.write\(to: Self\.indexURL, options: \.atomic\)/);
});

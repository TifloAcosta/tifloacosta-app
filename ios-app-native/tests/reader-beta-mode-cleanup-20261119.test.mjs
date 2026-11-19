import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const settings = source('NativeReaderSettings.swift');
const general = source('NativeUpdatesSettings.swift');
const shortcuts = source('NativeAppShortcuts.swift');
const home = source('NativeScreens.swift');
const contact = source('NativeContact.swift');
const credentials = source('NativeReaderExternalVoiceCredentials.swift');
const reader = source('NativeTifloLector.swift');

test('only the active reading mode displays its own controls', () => {
  const modes = settings.split('struct NativeReaderSettingsScreen: View {')[1];
  assert.match(modes, /if presentationMode == 0\s*\{/);
  assert.match(modes, /NativeReaderAudioControls\(\)/);
  assert.match(modes, /else if presentationMode == 1\s*\{/);
  assert.match(modes, /NativeReaderVisualControls\(\)/);
  assert.match(modes, /else\s*\{\s*NativeReaderBrailleControls\(\)/);
  assert.doesNotMatch(modes, /NavigationLink\("Lectura con línea braille"\)/);
  assert.doesNotMatch(modes, /NavigationLink\("Audio y voces"\)/);
  assert.doesNotMatch(modes, /NavigationLink\("Ajustes visuales"\)/);
  assert.match(modes, /NavigationLink\("Motores externos"\)/);
});

test('voice selection filters unavailable engines and hides system voices when Gemini selected', () => {
  assert.match(settings, /NativeVoiceCredentialStore\.hasKey\("gemini"\)/);
  assert.match(settings, /native-reader-gemini-validated/);
  assert.match(credentials, /geminiValidated = true/);
  assert.match(credentials, /geminiValidated = false/);
  assert.match(settings, /NativePhononRuntime\.isUsable/);
  assert.match(settings, /availableEngines/);
  assert.match(settings, /if chosenEngine == 0\s*\{/);
  const system = settings.split('if chosenEngine == 0 {')[1]?.split('NativeReaderPunctuationControls()')[0] ?? '';
  assert.match(system, /title: "Velocidad de voz"/);
  assert.match(system, /title: "Tono de lectura"/);
  assert.match(settings, /title: "Mostrar voces"/);
  assert.match(settings, /Button\("Cómo instalar más voces del sistema"\)/);
});

test('Gemini readiness verifies real TTS audio, not just access to the model list', () => {
  const check = credentials.split('private func checkGeminiConnection() async {')[1]
    ?.split('    var body: some View')[0] ?? '';
  assert.match(check, /NativeGeminiSpeech\.generate\("Prueba de voz", voice: "Kore"\)/);
  assert.doesNotMatch(check, /\/v1beta\/models"/);
  assert.match(check, /geminiValidated = true/);
  assert.match(check, /geminiValidated = false/);
});

test('VoiceOver library detail lives only in the library', () => {
  assert.doesNotMatch(general, /NativeAdjustableChoice\(\s*title: "Detalle de VoiceOver"/);
});

test('Mi Música is a Siri shortcut and X is in Contacto', () => {
  assert.match(shortcuts, /struct NativeOpenMusicIntent: AppIntent/);
  assert.match(shortcuts, /NativeShortcutRoute\.request\("miMusica"\)/);
  assert.match(home, /case "miMusica": destination = \.miMusica/);
  assert.match(contact, /NativeContactLink\(title: "TifloAcosta en X"/);
});

test('library actions offer conversion only for text and complete DAISY sharing', () => {
  assert.match(reader, /\.accessibilityActions\s*\{/);
  assert.match(reader, /if !document\.body\.isEmpty\s*\{/);
  assert.match(reader, /Button\("Compartir documento"\)/);
  assert.match(reader, /private func shareDocumentFromLibrary\(_ document: NativeReadingDocument\)/);
  assert.match(reader, /Button\("Convertir a audio o DAISY"\)/);
  assert.match(reader, /\.navigationTitle\("Convertir a audio o DAISY"\)/);
  assert.match(reader, /Button\(audioExportBusy \? "Generando…" : "Convertir y guardar"\)/);
  assert.match(reader, /availableExportEngines/);
  assert.match(reader, /availableExportEngines\.map \{ \$0\.title \}/);
});

test('a DAISY originally stored with .daisy extension shares a complete ZIP copy', () => {
  assert.match(reader, /func shareableOriginalURL\(for document: NativeReadingDocument\) throws -> URL/);
  assert.match(reader, /Archive\(url: original, accessMode: \.read\)/);
  assert.match(reader, /appendingPathComponent\("[^"]*"\)/);
  assert.match(reader, /try FileManager\.default\.copyItem\(at: original, to: destination\)/);
  assert.match(reader, /try library\.shareableOriginalURL\(for: document\)/);
});

test('playback button explicitly retains VoiceOver focus after a user activation', () => {
  assert.match(reader, /private func activatePlaybackButton\(\)/);
  assert.match(reader, /Button\(speech\.isPlaying \? "Pausar" : "Reproducir"\)\s*\{\s*activatePlaybackButton\(\)/);
  assert.match(reader, /playbackButtonFocused = true/);
});

test('pausing captures the live spoken character offset before saving the position', () => {
  const pause = reader.split('private func pausePlayback() {')[1]?.split('private func registerRemotePlaybackCommands')[0] ?? '';
  const liveOffset = pause.indexOf('speech.textCharacterOffset');
  const pauseSpeech = pause.indexOf('speech.pause()');
  const persist = pause.indexOf('persistPosition()');
  assert.ok(liveOffset >= 0 && pauseSpeech > liveOffset && persist > pauseSpeech);
});

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

test('braille provides a real per-reader focus preference instead of repeated help text', () => {
  assert.match(settings, /@AppStorage\("native-reader-braille-initial-text-focus"\) private var brailleFocusText = true/);
  assert.match(settings, /Toggle\("Foco inicial en el texto", isOn: \$brailleFocusText\)/);
  assert.match(reader, /@AppStorage\("native-reader-braille-initial-text-focus"\) private var brailleFocusText = true/);
  assert.match(reader, /presentationMode != 2 \|\| brailleFocusText/);
});

test('repeated book rows and text fragments have no redundant VoiceOver hints', () => {
  const fragment = reader.split('private func readerFragment(at index: Int) -> some View {')[1]
    ?.split('private var readingContent: some View')[0] ?? '';
  assert.doesNotMatch(fragment, /\.accessibilityHint\("Acciones disponibles: Crear marca/);
  const playback = reader.split('private var playbackRow: some View {')[1]
    ?.split('private var trackButtons: some View')[0] ?? '';
  assert.doesNotMatch(playback, /\.accessibilityHint\("Doble toque para reproducir o pausar/);
  const libraryRows = reader.split('Section("Mi biblioteca")')[1]
    ?.split('Section("Filtrar y ordenar")')[0] ?? '';
  assert.doesNotMatch(libraryRows, /\.accessibilityHint\("Doble toque para abrir\. Hay acciones de accesibilidad/);
  assert.match(fragment, /\.accessibilityAction\(named: Text\("Crear marca"\)\)/);
});

test('voice configuration uses labelled controls without permanent instructional paragraphs', () => {
  assert.doesNotMatch(settings, /Text\("Ajusta cada signo con deslizamientos arriba o abajo/);
  assert.doesNotMatch(settings, /Text\("Las pausas se aplican a la lectura con voces del sistema/);
  assert.doesNotMatch(settings, /Text\("El tono modifica la voz sintetizada/);
  assert.match(settings, /title: "Pausas por puntuación"/);
  assert.match(settings, /title: "Pausa después de coma"/);
});

test('voice selection filters unavailable engines and hides system voices when Gemini selected', () => {
  assert.match(settings, /NativeVoiceCredentialStore\.hasKey\("gemini"\)/);
  assert.match(settings, /native-reader-gemini-validated/);
  assert.match(credentials, /geminiValidated = true/);
  assert.match(credentials, /geminiValidated = false/);
  assert.match(settings, /NativePhononRuntime\.isUsable/);
  assert.match(settings, /availableEngines/);
  assert.match(settings, /if chosenEngine == 0\s*\{/);
  const system = settings.split('if chosenEngine == 0 {')[1]?.split('if allowVoiceDownloads')[0] ?? '';
  assert.match(system, /NativeReaderVoiceCustomizationControls\(voiceIdentifier: selectedVoiceID\)/);
  assert.match(settings, /title: "Velocidad de voz"/);
  assert.match(settings, /title: "Tono de lectura"/);
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

test('last word callbacks arriving after pause still update the saved cursor', () => {
  const delegate = reader.split('progressDelegate.onWord =')[1]?.split('progressDelegate.onFinish =')[0] ?? '';
  assert.match(delegate, /self\.isPlaying \|\| self\.isPaused/);
  const receive = reader.split('.onReceive(speech.$textCharacterOffset) { offset in')[1]
    ?.split('.onReceive(Timer.publish')[0] ?? '';
  assert.match(receive, /speech\.isPlaying \|\| speech\.isPaused/);
  assert.match(receive, /if speech\.isPaused \{ persistPosition\(\) \}/);
});

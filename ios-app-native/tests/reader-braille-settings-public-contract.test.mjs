import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL('../Sources/' + file, import.meta.url), 'utf8');
const settings = read('NativeReaderSettings.swift');
const reader = read('NativeTifloLector.swift');

test('braille has controls for TifloLector and directs system-only options to VoiceOver', () => {
  assert.match(settings, /struct NativeReaderBrailleControls: View/);
  assert.match(settings, /Unidad de navegación en braille/);
  assert.match(settings, /Configurar línea braille en VoiceOver/);
  assert.match(settings, /@AppStorage\("native-reader-reading-mode"\)/);
});

test('braille shortcut targets VoiceOver Braille rather than TifloAcosta app settings', () => {
  const controls = settings.split('struct NativeReaderBrailleControls: View {')[1]?.split('struct NativeReaderSettingsScreen: View {')[0] ?? '';
  assert.match(controls, /prefs:root=ACCESSIBILITY&path=VOICEOVER_TITLE\/BRAILLE_TITLE/);
  assert.match(controls, /App-prefs:root=ACCESSIBILITY&path=VOICEOVER_TITLE\/BRAILLE_TITLE/);
  assert.match(controls, /openVoiceOverBrailleSettings\(\)/);
  assert.match(controls, /showManualBrailleSettingsHelp/);
  assert.doesNotMatch(controls, /UIApplication\.openSettingsURLString/);
});

test('reading mode uses one focus toggle and only displays braille controls in braille mode', () => {
  assert.match(settings, /Toggle\("Foco inicial en Reproducir", isOn: automaticReadingBinding\)/);
  assert.match(settings, /get: \{ readingMode == 1 \}/);
  assert.match(settings, /set: \{ readingMode = \$0 \? 1 : 0 \}/);
  const readingModeScreen = settings.slice(settings.indexOf('NavigationLink("Modo de lectura")'));
  assert.match(readingModeScreen, /else\s*\{\s*NativeReaderBrailleControls\(\)/);
  assert.doesNotMatch(readingModeScreen, /NavigationLink\("Lectura con línea braille"\)/);
});

test('the actual document title exposes conversion as a VoiceOver action', () => {
  assert.match(reader, /ToolbarItem\(placement: \.principal\)/);
  assert.match(reader, /accessibilityAction\(named: Text\("Convertir a audio o DAISY"\)\)/);
  assert.match(reader, /accessibilityAction\(named: Text\("Compartir"\)\)/);
  assert.match(reader, /private func shareCurrentDocument\(\)/);
});

test('opening preference focuses play or text without automatic speech', () => {
  assert.match(settings, /Toggle\("Foco inicial en Reproducir", isOn: automaticReadingBinding\)/);
  assert.match(reader, /@AccessibilityFocusState private var playbackButtonFocused: Bool/);
  assert.match(reader, /\.accessibilityFocused\(\$playbackButtonFocused\)/);
  assert.match(reader, /if presentationMode == 0 && readingMode == 1 \{ playbackButtonFocused = true \}/);
  assert.doesNotMatch(reader, /startAutomaticReadingAfterOpening\(/);
});

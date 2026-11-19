import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = name => readFileSync(new URL(`../Sources/${name}`, import.meta.url), 'utf8');

test('voice drafts can be heard without affecting saved profiles or other voices', () => {
  const settings = source('NativeReaderSettings.swift');
  assert.match(settings, /struct NativeReaderVoiceCustomizationControls: View/);
  assert.match(settings, /@State private var draft/);
  assert.match(settings, /Button\("Escuchar muestra"\)/);
  assert.match(settings, /preview\.listen\(voiceIdentifier: voiceIdentifier, profile: draft\)/);
  assert.match(settings, /Button\("Guardar cambios de esta voz"\)/);
  assert.match(settings, /NativeReaderVoiceProfileStore\.save\(draft, for: voiceIdentifier\)/);
  assert.match(settings, /Button\("Descartar cambios"\)/);
  assert.match(settings, /Button\("Restablecer voz natural"\)/);
});

test('voice preferences are keyed by voice identity and default to natural speech', () => {
  const settings = source('NativeReaderSettings.swift');
  assert.match(settings, /enum NativeReaderVoiceProfileStore/);
  assert.match(settings, /native-reader-voice-profile-/);
  assert.match(settings, /static let natural/);
  assert.match(settings, /static func remove\(for voiceIdentifier: String\)/);
  assert.match(settings, /NativeReaderVoiceCustomizationControls\(voiceIdentifier: selectedVoiceID\)/);
});

test('saved voice profile reaches text reading and punctuation but not other engines', () => {
  const reader = source('NativeTifloLector.swift');
  assert.match(reader, /NativeReaderVoiceProfileStore\.load\(for: effectiveVoiceID\)/);
  assert.match(reader, /NativeReaderVoiceProfileStore\.load\(for: chosenVoiceID\)/);
  assert.match(reader, /NativeReaderPauseProfile\.segments\(Self\.textForSpeech\(text\), voiceIdentifier: voiceIdentifier\)/);
  assert.match(reader, /speech\.updateLiveSystemSettings/);
});

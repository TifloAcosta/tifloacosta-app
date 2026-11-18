import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const root = new URL('../Sources/', import.meta.url);
const settings = readFileSync(new URL('NativeReaderSettings.swift', root), 'utf8');
const reader = readFileSync(new URL('NativeTifloLector.swift', root), 'utf8');

test('el lector no presenta ni ejecuta Azure: solo usa síntesis de voz de iOS', () => {
  assert.doesNotMatch(settings, /Azure|NativeSpeechProviderChoice|MicrosoftSpeech/i);
  assert.doesNotMatch(reader, /Azure|MicrosoftSpeech|speechProvider|native-reading-speech-provider/i);
  assert.match(reader, /AVSpeechSynthesisVoice\(identifier: effectiveVoiceID\)/);
});

test('la integración experimental de Azure ya no forma parte del código nativo', () => {
  assert.equal(existsSync(new URL('NativeMicrosoftSpeech.swift', root)), false);
});

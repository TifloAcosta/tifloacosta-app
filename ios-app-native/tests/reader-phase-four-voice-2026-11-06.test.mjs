import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const swift = readFileSync(new URL('../Sources/NativeReaderSettings.swift', import.meta.url), 'utf8');

test('voice list opens only on demand, supports preview and closes on selection', () => {
  assert.match(swift, /Button\("Voz"\) \{ showVoicePicker = true \}/);
  assert.match(swift, /\.sheet\(isPresented: \$showVoicePicker\)/);
  assert.match(swift, /private func preview\(_ voice: AVSpeechSynthesisVoice\?\)/);
  assert.match(swift, /previewSynthesizer\.speak\(utterance\)/);
  assert.match(swift, /showVoicePicker = false/);
  assert.match(swift, /\.onDisappear \{ previewSynthesizer\.stopSpeaking/);
});
test('document-specific voice settings keep their own persisted binding', () => {
  assert.match(swift, /voiceSelection: Binding\(/);
  assert.match(swift, /library\.updatePreferences\(document\) \{ \$0\.voiceID = value \}/);
});

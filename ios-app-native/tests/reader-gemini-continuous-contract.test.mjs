import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');

test('Gemini runs only after explicit engine selection and protects API key', () => {
  assert.match(src, /title: "Motor"/);
  assert.match(src, /choices: \["Sistema", "Gemini"\]/);
  assert.match(src, /readingEngine == 1/);
  assert.match(src, /NativeVoiceCredentialStore\.hasKey\("gemini"\)/);
  assert.match(src, /Gemini envía fragmentos del documento a Google/);
});
test('Gemini segments follow actual AVAudioPlayer completion and cancel on stop', () => {
  assert.match(src, /func playGemini\(/);
  assert.match(src, /private func playNextGeminiSegment\(/);
  assert.match(src, /self\.geminiSegmentIndex \+= 1/);
  assert.match(src, /self\.geminiCursorUTF16 \+=/);
  assert.match(src, /geminiTask\?\.cancel\(\)/);
  assert.match(src, /generation == self\.geminiGeneration/);
  assert.match(src, /if isGemini/);
});
test('Text percentage seek never seeks into generated ephemeral Gemini audio', () => {
  assert.match(src, /if speech\.hasAudio && !speech\.isGemini/);
  assert.match(src, /speech\.playGemini\(remainder/);
});

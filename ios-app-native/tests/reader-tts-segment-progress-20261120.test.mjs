import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');
const finish = source.slice(source.indexOf('progressDelegate.onFinish ='), source.indexOf('synthesizer.delegate = progressDelegate'));

test('terminar una frase consolida el cursor absoluto antes de pasar a la siguiente', () => {
  assert.match(finish, /segmentBase\s*\+\s*completedText\.utf16\.count/);
  assert.match(finish, /self\.previousUTF16\s*=\s*completedUTF16/);
  assert.match(finish, /self\.previousCharacterCount\s*=\s*self\.spokenText\.distance\(/);
  assert.ok(finish.indexOf('self.previousUTF16 = completedUTF16') < finish.indexOf('self.speechQueueIndex += 1'));
});

test('reanudar emplea la posición de carácter confirmada y no el inicio del párrafo', () => {
  const resume = source.slice(source.indexOf('    func resume() {'), source.indexOf('    func refresh() {'));
  assert.match(resume, /spokenText\.dropFirst\(resumeCharacters\)/);
  assert.match(resume, /baseCharacters\s*\+\s*resumeCharacters/);
});

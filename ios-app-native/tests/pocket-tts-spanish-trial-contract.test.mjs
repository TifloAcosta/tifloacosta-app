import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const settings = readFileSync(new URL('../Sources/NativeReaderExternalVoiceCredentials.swift', import.meta.url), 'utf8');
const project = readFileSync(new URL('../project.yml', import.meta.url), 'utf8');

test('rejected Pocket TTS trial and dependency are excluded from public iOS target', () => {
  assert.doesNotMatch(settings, /Pocket TTS/);
  assert.doesNotMatch(project, /FluidAudio/);
  assert.equal(existsSync(new URL('../Sources/NativePocketTtsTrial.swift', import.meta.url)), false);
});

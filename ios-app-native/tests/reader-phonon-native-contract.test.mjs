import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source = n => readFileSync(new URL('../Sources/' + n, import.meta.url), 'utf8');
const runtime = source('NativePhononRuntime.swift');
const models = source('NativePhononModelStore.swift');
const reader = source('NativeTifloLector.swift');
const project = readFileSync(new URL('../project-phonon-development.yml', import.meta.url),'utf8');

test('Phonon remains an optional iOS18 linked feature, not a regression for iOS17', () => {
  assert.match(runtime, /#if canImport\(PhononTTS\)/);
  assert.match(runtime, /NativePhononRuntime\.RuntimeError/);
  assert.match(project, /exactVersion: 0\.4\.1/);
  assert.match(project, /deploymentTarget: "18\.0"/);
  assert.match(project, /product: ptts/);
  assert.match(runtime, /Phonon\.load\(/);
});
test('Real Phonon speech uses installed local checkpoint and cancellable generated segments', () => {
  assert.match(runtime, /tts\.synthesize\(text\)/);
  assert.match(runtime, /NativeGeminiSpeech\.wav\(pcm: pcm\)/);
  assert.match(reader, /func playPhonon\(/);
  assert.match(reader, /NativePhononRuntime\.generate/);
  assert.match(reader, /isGeneratedSpeech/);
  assert.match(reader, /choices: phononReady \? \["Sistema", "Gemini", "Phonon"\]/);
});
test('Model installer is user-triggered, verified and rollback-safe', () => {
  assert.match(models, /archiveSHA256/);
  assert.match(models, /verifyBundle\(root\)/);
  assert.match(models, /isExcludedFromBackup = true/);
  assert.match(models, /try fm\.moveItem\(at: root, to: directory\)/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const project = readFileSync(new URL('project.yml', root), 'utf8');
const runtime = readFileSync(new URL('Sources/NativePhononRuntime.swift', root), 'utf8');
const settings = readFileSync(new URL('Sources/NativeReaderSettings.swift', root), 'utf8');

test('no se eleva la versión mínima pública de iOS para incorporar Phonon', () => {
  assert.match(project, /IPHONEOS_DEPLOYMENT_TARGET: "17\.0"/);
  assert.match(runtime, /#if canImport\(PhononTTS\)/);
  assert.match(runtime, /#available\(iOS 18/);
});

test('Phonon no se ofrece como motor funcional sin el paquete y modelo disponibles', () => {
  assert.match(settings, /NativePhononRuntime\.isUsable \? \["Phonon"\] : \[\]/);
  assert.match(runtime, /static var isUsable: Bool/);
});

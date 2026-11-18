import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../Sources/', import.meta.url);
const settings = readFileSync(new URL('NativeReaderSettings.swift', root), 'utf8');
const setup = readFileSync(new URL('NativePhononSetup.swift', root), 'utf8');
const runtime = readFileSync(new URL('NativePhononRuntime.swift', root), 'utf8');

test('Phonon está visible como opción informativa incluso si todavía no se puede ejecutar', () => {
  assert.match(settings, /NavigationLink\("Phonon: compatibilidad e instalación"\)/);
  assert.match(settings, /NativePhononSetupScreen\(\)/);
  assert.match(setup, /iOS 18 o posterior/);
});

test('la descarga sólo se ofrece cuando la biblioteca Phonon está incluida', () => {
  assert.match(runtime, /static var isIncluded: Bool/);
  assert.match(setup, /if NativePhononRuntime\.isIncluded/);
  assert.match(setup, /NativePhononModelStore\.downloadAndInstall\(\)/);
});

test('el modelo permite eliminarse con confirmación y escuchar una muestra', () => {
  assert.match(setup, /Button\("Escuchar muestra Phonon"\)/);
  assert.match(setup, /Button\("Eliminar modelo Phonon"/);
  assert.match(setup, /NativePhononModelStore\.remove\(\)/);
});

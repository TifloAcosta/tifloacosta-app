import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = name => readFileSync(new URL(`../Sources/${name}`, import.meta.url), 'utf8');

test('AppShortcutsBuilder items are separate statements, not comma-separated array values', () => {
  const file = source('NativeAppShortcuts.swift');
  assert.doesNotMatch(file, /systemImageName: "play\.rectangle"\s*\),/);
});

test('MusicKit catch does not assign an error message to the caught immutable error', () => {
  const file = source('NativeAppleMusic.swift');
  assert.doesNotMatch(file, /catch\s*\{\s*error\s*=/);
  assert.match(file, /self\.error = "No se pudo reanudar Apple Music\."/);
});

test('MusicKit authorization uses a conditional block whose execution can continue', () => {
  const file = source('NativeAppleMusic.swift');
  assert.doesNotMatch(file, /guard authorized, canPlayCatalog else\s*\{\s*await connect\(\)/);
  assert.match(file, /if !authorized \|\| !canPlayCatalog\s*\{\s*await connect\(\)/);
});

test('Jamendo catch updates the player error property, not the caught error', () => {
  const file = source('NativeJamendoMusic.swift');
  assert.doesNotMatch(file, /catch\s*\{\s*error\s*=/);
  assert.match(file, /catch\s*\{\s*self\.error = MusicLocalized\.format\("No se pudo recuperar la canción guardada de Jamendo\."\)/);
});

test('equalizer backup general gains have an explicit Float array type for Swift compiler', () => {
  const file = source('NativeMusicPlayer.swift');
  assert.match(file, /let generalGains: \[Float\]/);
  assert.doesNotMatch(file, /let generalGains = \(UserDefaults\.standard\.array/);
});

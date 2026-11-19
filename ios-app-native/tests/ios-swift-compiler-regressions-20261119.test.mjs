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

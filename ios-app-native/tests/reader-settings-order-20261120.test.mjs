import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const settings = readFileSync(new URL('../Sources/NativeReaderSettings.swift', import.meta.url), 'utf8');

test('TifloLector settings prioritize reading mode, external engines and bookmarks', () => {
  const screen = settings.slice(settings.indexOf('struct NativeReaderSettingsScreen'));
  const labels = ['Modo de lectura', 'Motores externos', 'Creación rápida de marcas'];
  const positions = labels.map(label => screen.indexOf('NavigationLink("' + label + '")'));
  assert.ok(positions.every(position => position >= 0));
  assert.ok(positions[0] < positions[1] && positions[1] < positions[2]);
});

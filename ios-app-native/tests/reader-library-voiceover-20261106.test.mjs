import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const reader = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');

test('voiceover sort label says zeta rather than abbreviations', () => {
  assert.match(reader, /Título de zeta a a/);
  assert.match(reader, /Título de a a zeta/);
  assert.doesNotMatch(reader, /Título Z a A/);
});
test('the most recently opened book is recorded persistently and filterable', () => {
  assert.match(reader, /var lastOpenedAt: Date\? = nil/);
  assert.match(reader, /func markOpened\(_ document: NativeReadingDocument\)/);
  assert.match(reader, /documents\[i\]\.lastOpenedAt = \.now/);
  assert.match(reader, /case 11:/);
  assert.match(reader, /Último abierto/);
  assert.match(reader, /\.onAppear \{ library\.markOpened\(document\) \}/);
});
test('folder controls are all in one section, with creation after the folders', () => {
  const start = reader.indexOf('Section("Carpetas") {');
  const end = reader.indexOf('Section("Mi biblioteca") {', start);
  assert.ok(start > 0 && end > start);
  const section = reader.slice(start, end);
  assert.doesNotMatch(section, /NativeAdjustableChoice/);
  assert.match(section, /ForEach\(library\.folders/);
  assert.match(section, /Crear nueva carpeta/);
  assert.ok(section.indexOf('ForEach(library.folders') < section.indexOf('Crear nueva carpeta'));
});
test('each library book exposes persisted reading percentage to VoiceOver', () => {
  assert.match(reader, /library\.latest\(document\)\.lastPercent \?\? 0/);
  assert.match(reader, /por ciento leído/);
  assert.match(reader, /\.accessibilityLabel\("\\\(document\.title\),/);
});

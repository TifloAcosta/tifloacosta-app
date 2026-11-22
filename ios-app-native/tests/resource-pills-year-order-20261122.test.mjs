import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const screen = readFileSync(new URL('../Sources/NativeScreens.swift', import.meta.url), 'utf8');
const catalogue = JSON.parse(readFileSync(
  new URL('../../mobile-content.json', import.meta.url), 'utf8'));
const pills = catalogue.resources.filter(item =>
  item.category === 'Píldoras' || item.category === 'Pills');

test('native Resources groups Píldoras by descending year and keeps the row actions', () => {
  assert.match(screen, /private var pillsYears: \[Int\]/);
  assert.match(screen, /Array\(Set\(filtered\.compactMap \{ pillsYear\(for: \$0\) \}\)\)\.sorted\(by: >\)/);
  assert.match(screen, /ForEach\(pillsYears, id: \\.self\)/);
  assert.match(screen, /ForEach\(pillsForYear\(year\)\)/);
  assert.match(screen, /ForEach\(pillsWithoutYear\)/);
  assert.match(screen, /\.accessibilityAction\(named: Text\("Leer"\)\)/);
  assert.match(screen, /\.accessibilityAction\(named: Text\("Guardar"\)\)/);
  assert.match(screen, /\.accessibilityAction\(named: Text\("Descargar"\)\)/);
  assert.match(screen, /\.accessibilityAction\(named: Text\("Compartir"\)\)/);
});

test('published catalog has years 2024, 2025 and 2026 and date keys for older issues', () => {
  const byYear = new Map();
  for (const item of pills) {
    const match = [item.id, item.url || '', item.openUrl || '']
      .map(value => value.match(/(?:^|\D)(20\d{2})(?:\D|$)/))
      .find(Boolean);
    if (!match) continue; // one legacy English title uses an opaque ID
    const year = Number(match[1]);
    byYear.set(year, (byYear.get(year) || 0) + 1);
  }
  assert.deepEqual([...byYear.keys()].sort((a,b) => b-a), [2026, 2025, 2024]);
  assert.ok(pills.some(item => /pildoras-2025-12-29/.test(item.id)));
  assert.ok(pills.some(item => /pildoras-2024-03-09/.test(item.id)));
  assert.ok(pills.some(item => /pildoras-2026-25/.test(item.id)));
});

test('opaque translated edition has an unambiguous 2026 counterpart', () => {
  const legacy = pills.find(item => item.title === 'Tech Pills 21');
  const counterpart = pills.find(item => item.title === 'Píldoras 21');
  assert.ok(legacy);
  assert.ok(counterpart);
  assert.match(counterpart.id, /2026-21$/);
  assert.match(screen, /candidates\.count == 1 \? candidates\.first : nil/);
});

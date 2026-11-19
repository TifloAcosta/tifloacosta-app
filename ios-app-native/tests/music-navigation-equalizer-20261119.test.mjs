import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const music = readFileSync(new URL('../Sources/NativeMyMusic.swift', import.meta.url), 'utf8');

test('Mi Música shows playable content first, then organization and settings controls', () => {
  const body = music.slice(music.indexOf('    var body: some View {', music.indexOf('struct NativeMyMusicScreen')), music.indexOf('.navigationTitle("Mi Música")'));
  assert.ok(body.indexOf('Section("Reproductor")') < body.indexOf('Section("Mi biblioteca")'));
  assert.ok(body.indexOf('Section("Mi biblioteca")') < body.indexOf('Menu("Organizar mi música")'));
  assert.match(body, /NavigationLink\("Ajustes de Mi Música"\)/);
  assert.match(body, /NavigationLink\("Plataformas musicales"\)/);
  assert.doesNotMatch(body, /Section\("Ecualizador"\)/);
  assert.doesNotMatch(body, /Section\("Copias de seguridad"\)/);
});

test('organize menu contains import and creation actions without duplicate top level controls', () => {
  const menu = music.match(/Menu\("Organizar mi música"\) \{([\s\S]*?)\n            \}/)?.[1] ?? '';
  for (const label of ['Importar canciones','Importar carpeta desde Archivos o nube','Crear carpeta','Crear lista de reproducción','Crear carpeta inteligente']) {
    assert.ok(menu.includes(`Button("${label}")`), label);
  }
});

test('equalizer uses one VoiceOver adjustable control per preset and band', () => {
  assert.match(music, /NativeAdjustableChoice\(\s*title: "Perfil de ecualización"/);
  assert.match(music, /selectedIndex: equalizerPresetChoice/);
  assert.match(music, /selectedIndex: equalizerBandChoice\(index\)/);
  assert.ok(!music.includes('Button("Reducir'));
  assert.ok(!music.includes('Button("Aumentar'));
});

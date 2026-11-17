import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (name) => readFileSync(new URL(name, root), 'utf8');

test('Mi Música has an independent iOS navigation destination and an accessible import action', () => {
  const home = read('ios-app-native/Sources/NativeScreens.swift');
  const music = read('ios-app-native/Sources/NativeMyMusic.swift');
  assert.match(home, /case miMusica = "Mi Música"/);
  assert.match(home, /case \.miMusica: NativeMyMusicScreen\(\)/);
  assert.match(music, /fileImporter\(/);
  assert.match(music, /Importar canciones/);
  assert.match(music, /navigationTitle\("Mi Música"\)/);
  assert.match(music, /Crear carpeta/);
  assert.match(music, /Buscar canciones/);
  assert.match(music, /Eliminar de la biblioteca/);
});

test('Mi Música has an independent Android navigation destination and document picker', () => {
  const home = read('android-native-prototype/app/src/main/java/com/tifloacosta/nativeprototype/NativePrototypeActivity.kt');
  const music = read('android-native-prototype/app/src/main/java/com/tifloacosta/nativeprototype/NativeMyMusic.kt');
  assert.match(home, /const val MUSIC =/);
  assert.match(home, /NativeMyMusic\(/);
  assert.match(music, /ActivityResultContracts\.OpenMultipleDocuments/);
  assert.match(music, /Mi Música/);
  assert.match(music, /Importar canciones/);
  assert.match(music, /Crear carpeta/);
  assert.match(music, /Buscar canciones/);
});

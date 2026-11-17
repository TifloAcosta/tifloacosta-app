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
  const iosPlayer = read('ios-app-native/Sources/NativeMusicPlayer.swift');
  assert.match(iosPlayer, /AVAudioEngine/);
  assert.match(iosPlayer, /AVAudioPlayerNode/);
  assert.match(iosPlayer, /AVAudioUnitEQ\(numberOfBands: 5\)/);
  assert.match(iosPlayer, /scheduleSegment/);
  assert.match(music, /Canción siguiente/);
  assert.match(music, /Avanzar 15 segundos/);
  assert.match(music, /Temporizador de 15 minutos/);
  assert.match(music, /Reproducción aleatoria/);
  assert.match(music, /Repetición/);
  assert.match(music, /Ecualizador/);
  assert.match(music, /Guardar perfil para esta canción/);
  assert.match(music, /Guardar como perfil general/);
  assert.match(music, /Quitar perfil de esta canción/);
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
  assert.match(read('android-native-prototype/app/src/main/java/com/tifloacosta/nativeprototype/NativeMusicPlayer.kt'), /MediaPlayer/);
  assert.match(music, /Canción siguiente/);
  assert.match(music, /Avanzar 15 segundos/);
  assert.match(music, /Temporizador de 15 minutos/);
  assert.match(music, /Reproducción aleatoria/);
  assert.match(music, /Repetición/);
  assert.match(read('android-native-prototype/app/src/main/java/com/tifloacosta/nativeprototype/NativeMusicEqualizer.kt'), /Equalizer\(0, sessionId\)/);
  assert.match(read('android-native-prototype/app/src/main/java/com/tifloacosta/nativeprototype/NativeMusicEqualizer.kt'), /setBandLevel/);
  assert.match(music, /Ecualizador/);
  assert.match(music, /Guardar perfil para esta canción/);
  assert.match(music, /Guardar como perfil general/);
  assert.match(music, /Quitar perfil de esta canción/);
});

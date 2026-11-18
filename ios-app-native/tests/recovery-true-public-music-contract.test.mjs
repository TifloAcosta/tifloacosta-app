import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const src = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');

test('La base pública mantiene la portada simplificada, los seis idiomas y el control de pausa', () => {
  const home = src('NativeScreens.swift');
  const settings = src('NativeUpdatesSettings.swift');
  const reader = src('NativeTifloLector.swift');
  assert.match(home, /allCases\.filter \{ \$0 != \.privacidad && \$0 != \.contacto && \$0 != \.recibidos \}/);
  assert.match(settings, /choices: NativeAppLanguage\.names/);
  assert.match(settings, /title: "Detalle de VoiceOver"/);
  assert.match(reader, /systemSpeechNeedsRestart/);
  assert.match(reader, /synthesizer\.stopSpeaking\(at: \.immediate\)/);
  assert.match(reader, /private var documentSearchHits/);
});

test('Mi Música se integra sin sustituir las pantallas de TifloLector', () => {
  const home = src('NativeScreens.swift');
  assert.match(home, /case miMusica = "Mi Música"/);
  assert.match(home, /case \.miMusica: NativeMyMusicScreen\(\)/);
  assert.ok(existsSync(new URL('../Sources/NativeMyMusic.swift', import.meta.url)));
  assert.ok(existsSync(new URL('../Sources/NativeMusicPlayer.swift', import.meta.url)));
  assert.match(src('NativeMyMusic.swift'), /struct NativeMyMusicScreen: View/);
  assert.match(src('NativeMusicPlayer.swift'), /final class NativeMusicPlayer: ObservableObject/);
});

test('Tras exportar DAISY se puede rechazar compartir y volver a la biblioteca', () => {
  const reader = src('NativeTifloLector.swift');
  const completed = reader.slice(reader.indexOf('.alert("Conversión completada. Archivo guardado en la biblioteca"'), reader.indexOf('.confirmationDialog("Acciones del documento"'));
  assert.match(completed, /Button\("Compartir"\)/);
  assert.match(completed, /Button\("No compartir y volver a la biblioteca", role: \.cancel\)/);
  assert.match(completed, /persistPosition\(\)/);
  assert.match(completed, /dismiss\(\)/);
});

test('Las listas de YouTube pasan al siguiente vídeo al terminar, conservando las funciones públicas', () => {
  const player = src('NativeYouTubePlayer.swift');
  const home = src('NativeScreens.swift');
  assert.match(player, /completedSequence/);
  assert.match(player, /state == 0 && previousState != 0/);
  assert.match(player, /playlist\.indices\.contains\(next\)/);
  assert.match(player, /engine\.loadVideo\(id: currentVideo\.id\)/);
  assert.match(player, /onChange\(of: engine\.completedSequence/);
  assert.match(player, /personalLibrary\.rememberPlayback/);
  assert.match(home, /NativeYouTubePlayerScreen\(video: video, playlist: youtubeSearch\.videos\)/);
});

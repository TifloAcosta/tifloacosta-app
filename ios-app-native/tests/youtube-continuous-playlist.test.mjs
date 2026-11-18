import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const player = readFileSync(new URL('../Sources/NativeYouTubePlayer.swift', import.meta.url), 'utf8');
const screens = readFileSync(new URL('../Sources/NativeScreens.swift', import.meta.url), 'utf8');

test('el reproductor reconoce el final real del vídeo sin repetir el evento de fin', () => {
  assert.match(player, /completedSequence/);
  assert.match(player, /state == 0 && previousState != 0/);
});

test('se carga y reproduce el siguiente elemento de una lista, sin avanzar al terminarla', () => {
  assert.match(player, /playlist\.indices\.contains\(next\)/);
  assert.match(player, /engine\.loadVideo\(id: currentVideo\.id\)/);
  assert.match(player, /\.onChange\(of: engine\.completedSequence\)/);
});

test('las listas de vídeos de un canal pasan su orden al reproductor', () => {
  assert.match(screens, /NativeYouTubePlayerScreen\(video: video, playlist: youtubeSearch\.videos\)/);
});

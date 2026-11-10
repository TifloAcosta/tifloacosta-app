import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const player = source('NativePodcasts.swift');
const library = source('NativePodcastLibrary.swift');

test('La biblioteca conserva el avance y distingue episodios terminados', () => {
  assert.match(library, /struct NativePodcastPlaybackProgress: Codable, Identifiable/);
  assert.match(library, /native-podcast-playback-progress-v1/);
  assert.match(library, /func progress\(for episode: NativePodcastEpisode\)/);
  assert.match(library, /func remember\(_ episode: NativePodcastEpisode/);
  assert.match(library, /location >= 5 && location < duration - 10/);
  assert.match(library, /func clearProgress\(for episode: NativePodcastEpisode\)/);
  assert.match(library, /private let followedKey = "native-podcast-followed-v1"/);
  assert.match(library, /private let favoriteKey = "native-podcast-favorites-v1"/);
});

test('El reproductor reanuda y avanza al terminar mediante notificación nativa', () => {
  assert.match(player, /func select\(_ episode: NativePodcastEpisode,/);
  assert.match(player, /at seconds: Double = 0/);
  assert.match(player, /followedBy episodes: \[NativePodcastEpisode\]/);
  assert.match(player, /\.AVPlayerItemDidPlayToEndTime/);
  assert.match(player, /self\.select\(next, followedBy: Array\(self\.nextEpisodes\.dropFirst\(\)\)\)/);
  assert.match(player, /NotificationCenter\.default\.removeObserver\(endObserver\)/);
});

test('Pantalla de Pódcast expone continuar escuchando y reproducción continua accesibles', () => {
  assert.match(player, /Section\("Continuar escuchando"\)/);
  assert.match(player, /Toggle\("Reproducir el siguiente episodio automáticamente"/);
  assert.match(player, /native-podcast-continuous-playback/);
  assert.ok(player.includes('Button("Continuar: '));
  assert.match(player, /saveCurrentPosition\(\)/);
  assert.match(player, /playEpisode\(episode, collection: store\.episodes\)/);
  assert.match(player, /playEpisode\(episode, collection: followedEpisodes\)/);
});

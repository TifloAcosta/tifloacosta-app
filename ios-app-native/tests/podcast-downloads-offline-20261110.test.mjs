import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const downloads = read('NativePodcastDownloads.swift');
const podcasts = read('NativePodcasts.swift');

test('Descargas guardadas en almacenamiento privado y con tamaño límite', () => {
  assert.match(downloads, /struct NativeDownloadedPodcastEpisode: Codable, Identifiable/);
  assert.match(downloads, /native-podcast-downloads-v1/);
  assert.match(downloads, /applicationSupportDirectory/);
  assert.match(downloads, /URLSession\.shared\.download\(for: request\)/);
  assert.match(downloads, /size <= 500_000_000/);
  assert.match(downloads, /SHA256\.hash/);
  assert.match(downloads, /func delete\(_ item: NativeDownloadedPodcastEpisode\)/);
  assert.match(downloads, /func localURL\(for id: String\)/);
});

test('Reproducción continua y episodio individual prefieren audio descargado', () => {
  assert.match(podcasts, /var resolveAudioURL: \(\(NativePodcastEpisode\) -> URL\?\)\?/);
  assert.match(podcasts, /resolveAudioURL\?\(episode\) \?\? episode\.audioURL/);
  assert.match(podcasts, /player\.resolveAudioURL = \{ episode in/);
  assert.match(podcasts, /downloads\.localURL\(for: episode\.id\)/);
  assert.match(podcasts, /player\.select\(episode, at: library\.progress\(for: episode\)/);
  assert.match(podcasts, /Section\("Episodios descargados"\)/);
  assert.match(podcasts, /Button\("Eliminar descarga:/);
  assert.match(podcasts, /Button\("Descargar:/);
});

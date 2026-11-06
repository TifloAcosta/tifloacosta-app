import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ios = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');

test('phase 6: reading state, bookmarks and navigation remain available', () => {
  const reader = ios('NativeTifloLector.swift');
  assert.match(reader, /func addBookmark\(/);
  assert.match(reader, /func addAudioBookmark\(/);
  assert.match(reader, /NativeGeminiSpeech/);
  assert.match(reader, /NativePhononRuntime/);
});

test('phase 6: podcast subscriptions are persistent and episodes playable', () => {
  const library = ios('NativePodcastLibrary.swift');
  const screen = ios('NativePodcasts.swift');
  assert.match(library, /func importOPML\(/);
  assert.match(library, /savedEpisodes/);
  assert.match(library, /recordFeedCheck/);
  assert.match(screen, /Reproducir favorito/);
  assert.match(screen, /Consultar episodios/);
});

test('phase 6: YouTube account remains optional and supports subscription paging', () => {
  const account = ios('NativeYouTubeAccount.swift');
  assert.match(account, /func signOut\(/);
  assert.match(account, /func loadSubscriptions\(/);
  assert.match(account, /subscriptionsNextPageToken/);
  assert.match(account, /kSecAttrAccessibleWhenUnlockedThisDeviceOnly/);
});

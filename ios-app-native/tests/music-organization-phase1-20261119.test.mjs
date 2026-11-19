import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = file => readFileSync(new URL(`../Sources/${file}`, import.meta.url), 'utf8');

test('smart folders support title, artist, genre, import date and play count rules', () => {
  const music = source('NativeMyMusic.swift');
  const ruleDeclaration = music.match(/private enum MusicSmartRuleKind:[^\n]*\n\s*case ([^\n]+)/)?.[1] ?? '';
  for (const kind of ['title', 'artist', 'genre', 'importDate', 'playCount']) {
    assert.ok(ruleDeclaration.split(/,\s*/).includes(kind), `${kind} must be a smart folder rule`);
  }
  assert.match(music, /func matchingTracks\(for smart: MusicSmartFolder\)/);
  assert.match(music, /switch smart\.ruleKind/);
});

test('smart folder rules and track metadata are backward compatible with existing library JSON', () => {
  const music = source('NativeMyMusic.swift');
  assert.match(music, /var rule: String\? = nil/);
  assert.match(music, /var genre: String\? = nil/);
  assert.match(music, /var importedAt: Date\? = nil/);
  assert.match(music, /var playCount: Int\? = nil/);
  assert.match(music, /func recordPlay\(for url: URL\)/);
});

test('playlist entries can move up and down without moving or deleting originals', () => {
  const music = source('NativeMyMusic.swift');
  assert.match(music, /func movePlaylistEntry\(playlistID: UUID, entryID: UUID, by offset: Int\)/);
  assert.match(music, /orderedEntries\.swapAt\(position, destination\)/);
  assert.match(music, /library\.movePlaylistEntry\(playlistID: playlist\.id, entryID: entry\.id, by: -1\)/);
  assert.match(music, /library\.movePlaylistEntry\(playlistID: playlist\.id, entryID: entry\.id, by: 1\)/);
});

test('smart folder UI exposes a rule selector and metadata editing for genre', () => {
  const music = source('NativeMyMusic.swift');
  assert.match(music, /Picker\("Criterio de carpeta inteligente"/);
  assert.match(music, /Button\("Editar género"\)/);
});

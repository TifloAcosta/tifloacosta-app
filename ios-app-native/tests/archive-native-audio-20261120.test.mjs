import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const archive = readFileSync(new URL('../Sources/NativeInternetArchiveMusic.swift', import.meta.url), 'utf8');
const radio = readFileSync(new URL('../Sources/NativeRadioBrowser.swift', import.meta.url), 'utf8');

test('Internet Archive includes native audio candidates including FLAC, not Shorten', () => {
  const playable = archive.slice(archive.indexOf('var playable: Bool'), archive.indexOf('let files: [AudioFile]?'));
  for (const ext of ['mp3', 'm4a', 'aac', 'wav', 'aif', 'aiff', 'caf', 'flac']) {
    assert.ok(playable.includes('"' + ext + '"'), ext + ' missing');
  }
  assert.ok(!playable.includes('"shn"'), 'Shorten is not a native codec');
});

test('streaming failures are observable rather than showing Playing for unsupported streams', () => {
  const player = radio.slice(radio.indexOf('class NativeRadioPlayer'), radio.indexOf('struct MusicPlaylistDestination'));
  assert.match(player, /NSKeyValueObservation/);
  assert.ok(player.includes('observe(\\.status'));
  assert.match(player, /\.failed/);
});

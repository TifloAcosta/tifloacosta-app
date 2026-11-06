import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const reader = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');

test('iOS saves an exact text offset while decoding legacy percentage-only documents', () => {
  assert.match(reader, /var lastTextOffset: Int\? = nil/);
  assert.match(reader, /func savePosition\(_ document: NativeReadingDocument, percent: Int, textOffset: Int\)/);
  assert.match(reader, /latest\.lastTextOffset \?\?/);
  assert.match(reader, /library\.savePosition\(document, percent: currentPercent, textOffset: readingOffset\)/);
});

test('iOS reports bookmark save errors instead of announcing unconfirmed success', () => {
  assert.match(reader, /func addBookmark\(_ document: NativeReadingDocument, at percent: Int\) -> Bool/);
  assert.match(reader, /func addAudioBookmark\(_ document: NativeReadingDocument, track: Int, percent: Int\) -> Bool/);
  assert.match(reader, /No se pudo guardar la marca/);
  assert.match(reader, /documents\[i\]\.markedPositions = previous/);
  assert.match(reader, /documents\[i\]\.audioBookmarks = previous/);
});

test('iOS timer is not reset when an audio playlist automatically advances', () => {
  const changedTrack = reader.match(/onTrackChanged: \{ next in([\s\S]*?)\n\s*\},/);
  assert.ok(changedTrack);
  assert.doesNotMatch(changedTrack[1], /applySleepTimer\(/);
  assert.match(reader, /onChange\(of: sleepIndex\)/);
  assert.match(reader, /self\?\.stop\(\)/);
});

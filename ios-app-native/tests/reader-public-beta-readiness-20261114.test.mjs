import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sources = new URL('../Sources/', import.meta.url);
const reader = readFileSync(new URL('NativeTifloLector.swift', sources), 'utf8');
const voices = readFileSync(new URL('NativeReaderExternalVoiceCredentials.swift', sources), 'utf8');

test('temporary Pocket TTS trial is absent from published voice settings', () => {
  assert.doesNotMatch(voices, /NavigationLink\("Pocket TTS/);
});

test('reader controls and settings precede uninterrupted text', () => {
  const chrome = reader.slice(reader.indexOf('private var readerChrome:'), reader.indexOf('private var readerWithSheets:'));
  const positions = ['quickControls', 'readerFooterControls', 'translatedReadingContent'].map(s => chrome.indexOf(s));
  assert.ok(positions.every(n => n >= 0));
  assert.ok(positions[0] < positions[1] && positions[1] < positions[2]);
});

test('a saved DAISY can be shared as the full original ZIP', () => {
  assert.match(reader, /Compartir libro DAISY completo \(ZIP\)/);
});

test('opening playback is manual and the selected focus is applied', () => {
  assert.doesNotMatch(reader, /if readingMode == 1 \{ play\(\) \}/);
  assert.doesNotMatch(reader, /startAutomaticReadingAfterOpening/);
  assert.match(reader, /if readingMode == 1 \{ playbackButtonFocused = true \}/);
});

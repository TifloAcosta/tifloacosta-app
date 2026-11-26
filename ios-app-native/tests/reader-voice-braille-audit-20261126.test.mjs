import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = n => readFileSync(new URL('../Sources/' + n, import.meta.url), 'utf8');
const reader = read('NativeTifloLector.swift');
const braille = read('NativeReaderContinuousBrailleText.swift');
test('voice settings never mutate utterances submitted to the synthesizer', () => {
  assert.match(reader, /NativeReaderSpeechQueueWindow\.editableStart\(current: speechQueueIndex,\s+alreadyQueued: speechEnqueuedThroughIndex/);
  assert.match(reader, /generatedTotalCharacters = baseCharacters \+ text\.count/);
  assert.match(reader, /length: self\.generatedTotalCharacters, offset: self\.textCharacterOffset/);
});
test('interruption does not reclaim audio after user pause or another playback owner', () => {
  assert.match(reader, /readerIsVisible && NativeRemotePlaybackOwner\.current == \.reader/);
  assert.match(reader, /private func pausePlayback\(\) \{\s+interruptedWhilePlaying = false/);
  assert.match(reader, /private func returnToBeginning\(\) \{\s+interruptedWhilePlaying = false/);
});
test('typography changes preserve the braille selection under callback suppression', () => {
  assert.ok(braille.indexOf('restoring = true') < braille.indexOf('view.font = requestedFont'));
  assert.match(braille, /if !textChanged && !explicitPositionChange/);
  assert.match(braille, /view.selectedRange = previousSelection/);
});

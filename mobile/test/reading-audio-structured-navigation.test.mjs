import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const audio = readFileSync(new URL('../src/screens/reading-audio.mjs', import.meta.url), 'utf8');
const daisy = readFileSync(new URL('../android/app/src/main/java/com/tifloacosta/app/reading/ReadingDaisyAdapter.java', import.meta.url), 'utf8');

test('multi-file audio can jump to a selected numbered or named track', () => {
  assert.match(audio, /trackJumpLabel\.hidden = audioTracks\.length < 2/);
  assert.match(audio, /track\?\.title \|\| track\?\.label/);
  assert.match(audio, /jumpToAudioMark\(\{ mediaTrackIndex: target, mediaPositionMs: 0 \}\)/);
});

test('DAISY adapter already extracts heading levels; playback layer still requires mapping those targets to audio positions', () => {
  assert.match(daisy, /for \(int level = 1; level <= 6; level\+\+\)/);
  assert.match(daisy, /ReadingStructuredDocument\.NavigationItem/);
});

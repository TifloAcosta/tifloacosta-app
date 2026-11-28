import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const reader = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');
const part = (start, end) => reader.split(start)[1]?.split(end)[0] ?? '';

test('recorded audio rate changes in place, never changes generated speech or starts paused audio', () => {
  const update = part('func updateLiveRecordedAudioSpeed(', 'var recordedAudioPlaybackRate:');
  assert.match(update, /guard !isGeneratedSpeech, let player, speed\.isFinite/);
  assert.match(update, /Float\(max\(0\.5, min\(2\.0, speed\)\)\)/);
  assert.match(update, /playlistSpeed = Double\(rate\)/);
  assert.match(update, /player\.enableRate = true/);
  assert.match(update, /player\.rate = rate/);
  assert.match(update, /scheduleDaisyBoundary\(\)/);
  assert.doesNotMatch(update, /player\.(play|pause|stop)\(|currentTime\s*=|startAudio\(/);
});
test('settings and resume propagate recorded rate; DAISY boundaries use current rate', () => {
  const refresh = part('private func refreshLiveReadingSettings() {', 'private func applySleepTimer(');
  assert.match(refresh, /if !tracks\.isEmpty \{\s*speech\.updateLiveRecordedAudioSpeed\(speed\)/);
  assert.match(refresh, /speech\.updateLiveSystemSettings\(/);
  assert.match(refresh, /speech\.updateLiveGeneratedVolume\(\)/);
  assert.match(reader, /\.onChange\(of: effectiveSpeedIndex\)/);
  assert.match(reader, /if speech\.isPaused \{\s*if !tracks\.isEmpty \{ speech\.updateLiveRecordedAudioSpeed\(speed\) \}\s*speech\.resume\(\)/);
  const boundary = part('private func scheduleDaisyBoundary() {', 'private func advanceDaisyClip()');
  assert.match(boundary, /daisyBoundaryTask\?\.cancel\(\)/);
  assert.match(boundary, /player\.isPlaying/);
  assert.match(boundary, /remaining \/ Double\(max\(0\.5, player\.rate\)\)/);
  assert.match(reader, /startAudio\(playlistURLs\[clip\.track\], speed: playlistSpeed/);
  assert.match(reader, /startAudio\(self\.playlistURLs\[next\], speed: self\.playlistSpeed/);
});

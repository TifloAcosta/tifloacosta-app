import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const reader = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');
const settings = readFileSync(new URL('../Sources/NativeReaderSettings.swift', import.meta.url), 'utf8');

test('active system speech updates queued voice configuration at the next sentence', () => {
  assert.match(reader, /func updateLiveSystemSettings\(/);
  assert.match(reader, /\.onReceive\(library\.\$documents\)/);
  assert.match(reader, /UserDefaults\.didChangeNotification/);
  assert.match(reader, /speech\.updateLiveSystemSettings\(/);
});

test('normal punctuation retains sentence boundaries for live changes', () => {
  assert.doesNotMatch(settings, /guard settings\.integer\(forKey: "native-reading-pause-style"\) != 0 else \{\s*return \[Segment\(text: text, delay: 0\)\]/);
});

test('tone can be restored to the native 1.0 multiplier while paused', () => {
  assert.match(reader, /utterance\.pitchMultiplier = max\(0\.5, min\(2, pitch\)\)/);
  assert.match(reader, /updateLiveSystemSettings\([\s\S]*?pitch: Float/);
});

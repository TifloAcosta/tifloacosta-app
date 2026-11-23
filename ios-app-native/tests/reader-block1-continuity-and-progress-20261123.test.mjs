import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const reader = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');
const queue = readFileSync(new URL('../Sources/NativeReaderSpeechQueueWindow.swift', import.meta.url), 'utf8');
const progress = readFileSync(new URL('../Sources/NativeReaderProgress.swift', import.meta.url), 'utf8');
const between = (start, end) => reader.split(start)[1]?.split(end)[0] ?? '';

test('locked-screen TTS has a bounded native queue and no obsolete one-shot restart', () => {
  assert.match(queue, /lookahead: Int = 8/);
  const play = between('func play(_ text: String,', 'private func geminiChunks(');
  assert.match(play, /utterance\.postUtteranceDelay = segment\.delay/);
  assert.match(play, /enqueueSystemLookahead\(\)/);
  assert.doesNotMatch(play, /Task\.sleep/);
  const resume = between('func resume() {', 'func refresh() {');
  assert.match(resume, /enqueueSystemLookahead\(\)/);
  assert.doesNotMatch(reader, /speakNextSystemSegment\(\)/);
});

test('reader persists the checkpoint on background without stopping the speech engine', () => {
  const background = between('.onChange(of: scenePhase)', '.onReceive(Timer.publish(every: 1,');
  assert.match(background, /phase == \.background/);
  assert.match(background, /checkpointLiveTextPosition\(\)/);
  assert.match(background, /persistPosition\(\)/);
  assert.doesNotMatch(background, /speech\.stop\(|stopPlayback\(|setActive\(false\)/);
});

test('last completed text offset persists even after isPlaying was cleared', () => {
  const receive = between('.onReceive(speech.$textCharacterOffset)', '.onChange(of: scenePhase)');
  assert.match(receive, /clamped == textLayout\.totalCharacters/);
  assert.match(receive, /NativeReaderProgress\.textPercent/);
  assert.match(receive, /persistPosition\(\)/);
  assert.match(progress, /if clamped == length \{ return 100 \}/);
  const jump = between('private func jump(to offset: Int,', 'private func activateCurrentLink()');
  assert.match(jump, /NativeReaderProgress\.textPercent/);
});

test('rapid VoiceOver fragment traversal coalesces persistence; exit flushes position', () => {
  const helper = between('private func scheduleManualPositionSave()', 'private func move(to percent: Int)');
  assert.match(helper, /delayedManualPositionSave\?\.cancel\(\)/);
  assert.match(helper, /milliseconds\(650\)/);
  assert.match(helper, /persistPosition\(\)/);
  const focus = between('.onChange(of: focusedFragment)', '.task {');
  assert.match(focus, /scheduleManualPositionSave\(\)/);
  const exit = between('.onDisappear {\n            readerIsVisible = false', '.accessibilityAction(.magicTap)');
  assert.match(exit, /delayedManualPositionSave\?\.cancel\(\)/);
  assert.match(exit, /persistPosition\(\)/);
});

test('one-touch return to start stops narration and saves the first track/text offset', () => {
  const reset = between('private func returnToBeginning()', 'private var playbackRow');
  for (const expression of [
    /speech\.stop\(\)/,
    /readingOffset = 0/,
    /currentPercent = 0/,
    /trackIndex = 0/,
    /pendingDaisyAudioSeconds = 0/,
    /persistPosition\(\)/
  ]) assert.match(reset, expression);
  assert.doesNotMatch(reset, /startTextSpeech\(|speech\.resume\(|playTrack\(/);
});

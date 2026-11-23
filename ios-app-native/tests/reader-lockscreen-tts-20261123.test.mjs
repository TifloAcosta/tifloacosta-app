import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = n => readFileSync(new URL('../Sources/'+n,import.meta.url),'utf8');
const reader=read('NativeTifloLector.swift');
const info=read('Info.plist');
const queue=read('NativeReaderSpeechQueueWindow.swift');
const workflow=readFileSync(new URL('../../.github/workflows/ios-next-beta-validation.yml',import.meta.url),'utf8');

test('TTS remains available for playback with the iPhone locked', () => {
  assert.match(info, /<key>UIBackgroundModes<\/key><array><string>audio<\/string><\/array>/);
  const start=reader.split('    func play(_ text: String, speed: Double')[1]?.split('    private func geminiChunks(')[0]??'';
  assert.match(start,/setCategory\([.]playback, mode: [.]spokenAudio\)/);
  assert.match(start,/utterance[.]postUtteranceDelay = segment[.]delay/);
  assert.match(start,/enqueueSystemLookahead\(\)/);
});

test('native AVSpeech queue stays one or more utterances ahead without app timers', () => {
  const helper=reader.split('private func enqueueSystemLookahead()')[1]?.split('func updateLiveSystemSettings(')[0]??'';
  assert.match(helper,/NativeReaderSpeechQueueWindow[.]pending\(/);
  assert.match(helper,/synthesizer[.]speak\(speechQueue\[index\][.]utterance\)/);
  assert.match(helper,/speechEnqueuedThroughIndex = index \+ 1/);
  assert.doesNotMatch(helper,/Task[.]sleep|speechDelayTask/);
  assert.match(queue,/lookahead: Int = 8/);
  assert.match(queue,/max\(2, lookahead\)/);
  const callback=reader.split('progressDelegate.onFinish =')[1]?.split('synthesizer.delegate = progressDelegate')[0]??'';
  assert.match(callback,/self[.]speechQueueIndex \+= 1/);
  assert.match(callback,/self[.]enqueueSystemLookahead\(\)/);
  assert.doesNotMatch(callback,/speakNextSystemSegment|Task[.]sleep/);
});

test('system speech pause and exact restart still work with a queued window', () => {
  const pause=reader.split('    func pause() {')[1]?.split('    func resume() {')[0]??'';
  const resume=reader.split('    func resume() {')[1]?.split('    func refresh() {')[0]??'';
  assert.match(pause,/systemSpeechNeedsRestart = !speechQueue[.]isEmpty/);
  assert.match(pause,/synthesizer[.]stopSpeaking\(at: [.]immediate\)/);
  assert.match(resume,/spokenText[.]dropFirst\(resumeCharacters\)/);
  assert.match(resume,/play\(remainder, speed: resumedSpeed/);
  assert.match(reader,/speechEnqueuedThroughIndex = 0/);
});

test('native Swift test checks queue bounds and avoids double enqueue',()=>{
  assert.match(workflow,/reader-speech-queue-background-smoke[.]swift/);
  assert.match(workflow,/NativeReaderSpeechQueueWindow[.]swift/);
});

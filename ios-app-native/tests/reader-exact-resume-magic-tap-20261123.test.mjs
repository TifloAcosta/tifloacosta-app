import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');
const inBetween = (start, end) => source.split(start)[1]?.split(end)[0] ?? '';

test('AVSpeech cursor checkpoints the beginning of the active word, not its unspoken end', () => {
  const callback = inBetween('progressDelegate.onWord =', 'progressDelegate.onFinish =');
  assert.match(callback, /self\.isPlaying, !self\.isPaused/);
  assert.match(callback, /self\.speechQueue\.indices\.contains\(self\.speechQueueIndex\)/);
  assert.match(callback, /ObjectIdentifier\(self\.speechQueue\[self\.speechQueueIndex\]\.utterance\)/);
  assert.match(callback, /let utf16Start = max\(0, min\(self\.spokenText\.utf16\.count,/);
  assert.match(callback, /segmentBase \+ range\.location\)/);
  assert.doesNotMatch(callback, /range\.location \+ range\.length/);
  assert.match(callback, /self\.previousUTF16 = utf16Start/);
  assert.match(callback, /self\.textCharacterOffset = self\.baseCharacters \+ self\.previousCharacterCount/);
});

test('finishing an utterance remains the only way to advance its last word completely', () => {
  const callback = inBetween('progressDelegate.onFinish =', 'synthesizer.delegate = progressDelegate');
  assert.match(callback, /self\.isPlaying, !self\.isPaused/);
  assert.match(callback, /segmentBase \+ completedText\.utf16\.count/);
  assert.match(callback, /self\.previousUTF16 = completedUTF16/);
});

test('pause prevents delayed word callbacks from overwriting the last safe checkpoint', () => {
  const pause = inBetween('    func pause() {', '    func resume() {');
  const setPaused = pause.indexOf('isPaused = true');
  const stop = pause.indexOf('synthesizer.stopSpeaking(at: .immediate)');
  assert.ok(setPaused >= 0 && stop > setPaused);
  assert.match(pause, /systemSpeechNeedsRestart = !speechQueue\.isEmpty/);
  const resume = inBetween('    func resume() {', '    func refresh() {');
  assert.match(resume, /String\(spokenText\.dropFirst\(resumeCharacters\)\)/);
  assert.match(resume, /baseCharacters \+ resumeCharacters/);
  assert.match(resume, /play\(remainder, speed:/);
});

test('button, Magic Tap and remote play-pause use the same toggle', () => {
  assert.match(source, /private func toggleReaderPlayback\(\) \{/);
  assert.match(source, /private func activatePlaybackButton\(\) \{\s*toggleReaderPlayback\(\)/);
  assert.match(source, /\.accessibilityAction\(\.magicTap\) \{ toggleReaderPlayback\(\) \}/);
  const remote = inBetween('let toggleToken = remoteCommandCenter.togglePlayPauseCommand.addTarget', 'remoteCommandTokens =');
  assert.match(remote, /toggleReaderPlayback\(\)/);
});

test('all stop paths save the live text cursor, not the stale reader fragment', () => {
  const helper = inBetween('    private func checkpointLiveTextPosition() {', '    private func pausePlayback() {');
  assert.match(helper, /speech[.]isPlaying [|][|] speech[.]isPaused/);
  assert.match(helper, /speech[.]textCharacterOffset/);
  assert.match(helper, /readingOffset = max[(]0, min[(]textLayout[.]totalCharacters/);
  assert.doesNotMatch(helper, /focusedFragment|lastReaderFragment/);

  const stop = inBetween('    private func stopPlayback() {', '    private func changeTrack(');
  assert.match(stop, /checkpointLiveTextPosition[(][)]\s*persistPosition[(][)]\s*speech[.]stop[(][)]/);
  const sleep = inBetween('    private func applySleepTimer(reset: Bool = false) {', '    private func playTrack()');
  assert.match(sleep, /speech[.]onSleepExpired = \{\s*checkpointLiveTextPosition[(][)]\s*persistPosition[(][)]/);
  const disappearance = inBetween('        .onDisappear {\n            unregisterRemotePlaybackCommands()', '        .accessibilityAction(.magicTap)');
  assert.match(disappearance, /checkpointLiveTextPosition[(][)]\s*persistPosition[(][)]\s*speech[.]onSleepExpired = nil\s*speech[.]stop[(][)]/);
});

test('pause and view disappearance persist character offsets, not paragraph or rounded percent', () => {
  const pause = inBetween('private func pausePlayback() {', 'private func registerRemotePlaybackCommands()');
  assert.match(pause, /checkpointLiveTextPosition\(\)/);
  assert.match(pause, /speech\.pause\(\)/);
  assert.match(pause, /persistPosition\(\)/);
  const readerBody = inBetween('    var body: some View {\n        readerWithSheets', '.accessibilityAction(.magicTap)');
  const helper = inBetween('    private func checkpointLiveTextPosition() {', '    private func pausePlayback() {');
  assert.match(helper, /tracks[.]isEmpty && [(]speech[.]isPlaying [|][|] speech[.]isPaused[)]/);
  assert.match(helper, /speech[.]textCharacterOffset/);
  assert.match(readerBody, /checkpointLiveTextPosition[(][)]/);
  assert.match(readerBody, /persistPosition[(][)]/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const reader = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');

test('pause button routes through immediate speech interruption, not word-boundary pause', () => {
  assert.match(reader, /Button\(speech\.isPlaying \? "Pausar" : "Reproducir"\)/);
  assert.match(reader, /private func pausePlayback\(\)/);
  const pausing = reader.slice(reader.indexOf('    func pause() {'),reader.indexOf('    func resume() {'));
  assert.match(pausing, /synthesizer\.stopSpeaking\(at: \.immediate\)/);
  assert.doesNotMatch(pausing, /pauseSpeaking\(at: \.word\)/);
});
test('resume system TTS from spoken cursor while retaining style and voice', () => {
  const resume = reader.slice(reader.indexOf('    func resume() {'),reader.indexOf('    func refresh() {'));
  assert.match(resume, /textUTF16Offset - speechSourceBaseUTF16/);
  assert.match(resume, /play\(remaining, speed: speechRate, pitch: speechPitch/);
  assert.match(resume, /totalUTF16: total, readingStyle: speechReadingStyle/);
  assert.match(reader, /finalUtteranceID = nil/);
});
test('export formats stay inline, accessible and do not navigate away', () => {
  const sheet = reader.slice(reader.indexOf('    private var exportAudioSheet:'),reader.indexOf('    private var readerBase:'));
  assert.match(sheet, /NativeReaderExportFormatControls\(/);
  assert.doesNotMatch(sheet, /Picker\("Formato"/);
  const selection = reader.slice(reader.indexOf('private struct NativeReaderExportFormatControls'),reader.indexOf('struct NativeReadingScreen'));
  assert.match(selection, /ForEach\(NativeGeminiAudioExport\.Format\.allCases\)/);
  assert.match(selection, /selection = format/);
  assert.doesNotMatch(selection, /dismiss\(\)/);
  assert.match(selection, /\.accessibilityValue\(selection == format \? "Seleccionado" : "No seleccionado"\)/);
});

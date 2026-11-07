import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = file => readFileSync(new URL('../Sources/' + file, import.meta.url), 'utf8');
const exportCode = source('NativeGeminiAudioExport.swift');
const reader = source('NativeTifloLector.swift');

test('format selector offers only actual supported native codecs', () => {
  assert.match(reader, /NativeReaderExportFormatControls\(/);
  assert.match(exportCode, /case m4a = "M4A"/);
  assert.match(exportCode, /case wav = "WAV"/);
  assert.match(exportCode, /case mp3 = "MP3"/);
  assert.match(reader, /audioExportFormat: NativeGeminiAudioExport.Format = \.mp3/);
  assert.match(exportCode, /case mp3 = "MP3"/);
  assert.match(exportCode, /MP3Encoder\(options: MP3EncoderOptions/);
  assert.match(exportCode, /session\.generateXingHeader\(\)/);
  assert.match(exportCode, /case m4a = "M4A"/);
  assert.match(exportCode, /case wav = "WAV"/);
});
test('M4A contains AAC audio produced by AVFoundation, not a renamed WAV', () => {
  assert.match(exportCode, /AVAssetExportSession/);
  assert.match(exportCode, /AVAssetExportPresetAppleM4A/);
  assert.match(exportCode, /session\.outputFileType = \.m4a/);
  assert.match(exportCode, /session\.status == \.completed/);
});

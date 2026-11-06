import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = file => readFileSync(new URL('../Sources/' + file, import.meta.url), 'utf8');
const exportCode = source('NativeGeminiAudioExport.swift');
const reader = source('NativeTifloLector.swift');

test('format selector offers only actual supported native codecs', () => {
  assert.match(reader, /Picker\("Formato", selection: \$audioExportFormat\)/);
  assert.match(reader, /Text\("M4A"\)/);
  assert.match(reader, /Text\("WAV"\)/);
  assert.match(reader, /MP3 estará disponible cuando se incorpore el codificador/);
  assert.match(exportCode, /case m4a = "M4A"/);
  assert.match(exportCode, /case wav = "WAV"/);
});
test('M4A contains AAC audio produced by AVFoundation, not a renamed WAV', () => {
  assert.match(exportCode, /AVAssetExportSession/);
  assert.match(exportCode, /AVAssetExportPresetAppleM4A/);
  assert.match(exportCode, /session\.outputFileType = \.m4a/);
  assert.match(exportCode, /session\.status == \.completed/);
});

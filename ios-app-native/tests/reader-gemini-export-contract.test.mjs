import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = n => readFileSync(new URL('../Sources/' + n, import.meta.url), 'utf8');
const exportSource = source('NativeGeminiAudioExport.swift');
const reader = source('NativeTifloLector.swift');

test('Gemini quota limit does not apply to local engines', () => {
    assert.match(exportSource, /maximumCharacters = 60_000/);
    assert.match(exportSource, /chunkSize = 1_200/);
    assert.match(exportSource, /engine == \.gemini && text.count > maximumCharacters/);
    assert.match(exportSource, /chunks\(text, engine: engine\)/);
    assert.match(exportSource, /result\.append\(String\(rest\[\.\.<split\]\)\)/);
    assert.match(exportSource, /rest = rest\[split\.\.\.\]/);
});
test('Long audio export writes PCM in bounded chunks to a temporary WAV file', () => {
    assert.match(exportSource, /static func pcm\(_ wav: Data\)/);
    assert.match(exportSource, /name == "data"/);
    assert.match(exportSource, /try output\.write\(contentsOf: bytes\)/);
    assert.match(exportSource, /writeWAVHeader\(output, pcmBytes: totalBytes\)/);
    assert.match(exportSource, /private static func encodeMP3\(wavFile:/);
    assert.doesNotMatch(exportSource, /var pcmData = Data\(\)/);
    assert.match(exportSource, /UUID\(\)\.uuidString/);
    assert.match(exportSource, /Task\.checkCancellation\(\)/);
});
test('Open document offers accessible export flow with progress, cancel, share', () => {
    assert.match(reader, /Button\("Exportar audio"\)/);
    assert.match(reader, /Button\("Generar"\)/);
    assert.match(reader, /Button\("Cancelar", role: \.cancel\)/);
    assert.match(reader, /Button\("Compartir"\) \{ NativeShare\.present\(url: result\) \}/);
});

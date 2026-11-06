import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = n => readFileSync(new URL('../Sources/' + n, import.meta.url), 'utf8');
const exportSource = source('NativeGeminiAudioExport.swift');
const reader = source('NativeTifloLector.swift');

test('No text is silently truncated: export splits into bounded sequential pieces', () => {
    assert.match(exportSource, /maximumCharacters = 60_000/);
    assert.match(exportSource, /chunkSize = 1_200/);
    assert.match(exportSource, /guard text\.count <= maximumCharacters else \{ throw ExportError\.tooLong \}/);
    assert.match(exportSource, /result\.append\(String\(rest\[\.\.<split\]\)\)/);
    assert.match(exportSource, /rest = rest\[split\.\.\.\]/);
    assert.match(exportSource, /for \(index, segment\) in segments\.enumerated\(\)/);
    assert.match(exportSource, /Task\.checkCancellation\(\)/);
});
test('Audio export merges PCM payload once with WAV header and avoids broken files', () => {
    assert.match(exportSource, /static func pcm\(_ wav: Data\)/);
    assert.match(exportSource, /name == "data"/);
    assert.match(exportSource, /NativeGeminiSpeech\.wav\(pcm: pcmData\)\.write\(to: file, options: \.atomic\)/);
    assert.match(exportSource, /UUID\(\)\.uuidString/);
});
test('Open document offers accessible export flow with progress, cancel, share', () => {
    assert.match(reader, /Button\("Exportar audio"\)/);
    assert.match(reader, /Button\("Generar"\)/);
    assert.match(reader, /Button\("Cancelar", role: \.cancel\)/);
    assert.match(reader, /Button\("Compartir"\) \{ NativeShare\.present\(url: result\) \}/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const audio = read('NativeGeminiAudioExport.swift');
const daisy = read('NativeGeminiDaisyExport.swift');
const verify = read('NativeDaisyPackageVerifier.swift');
const reader = read('NativeTifloLector.swift');

test('retains original DAISY 3 full text and offers separate DAISY 2.02 audio profile', () => {
  assert.match(audio, /case daisy = "DAISY"/);
  assert.match(audio, /case daisyVoiceDream = "DAISY 2\.02 \(audio\)"/);
  assert.match(audio, /if format == \.daisy \|\| format == \.daisyVoiceDream/);
  assert.match(audio, /audioOnly202: format == \.daisyVoiceDream/);
  assert.match(reader, /choices: NativeGeminiAudioExport\.Format\.allCases\.map\(\\\.rawValue\)/);
  assert.match(reader, /audioExportFormat == \.daisyVoiceDream/);
  assert.match(reader, /DAISY 2\.02 de audio: conserva la voz grabada/);
  assert.match(reader, /case \.daisyVoiceDream: formatLabel = "DAISY 2\.02 audio"/);
});

test('DAISY 2.02 uses original synthesized voice and reuses the MP3 clips', () => {
  assert.match(daisy, /NativeGeminiAudioExport\.synthesize\(\s*spoken, voice: voice/);
  assert.match(daisy, /audioOnlyChapters\[audioOnlyChapters\.count - 1\]\.clips\.append/);
  assert.match(daisy, /if audioOnly202 \{\s*return try packageAudioOnly202/);
  assert.match(daisy, /ncc:multimediaType" content="audioNCC"/);
  assert.match(daisy, /dc:format" content="Daisy 2\.02"/);
  assert.match(daisy, /<html xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/);
  assert.match(daisy, /<smil>/);
  assert.match(daisy, /<text id="text\\\(index \+ 1\\\)" src="ncc\.html#nav/);
  assert.match(daisy, /clip-begin=\\?"npt=0\.000s/);
  assert.match(daisy, /clip-end=\\?"npt=/);
  assert.match(daisy, /archive\.addEntry\(with: "ncc\.html"/);
  assert.match(daisy, /archive\.addEntry\(with: "audio\.smil"/);
  assert.match(daisy, /try NativeDaisyPackageVerifier\.validateAudioOnly202\(output\)/);
});

test('audio-only validator checks complete ZIP, navigation and original MP3 frames', () => {
  assert.match(verify, /static func validateAudioOnly202\(_ url: URL\) throws/);
  assert.match(verify, /Set\(audioRefs\) == Set\(audioHeaders\.keys\)/);
  assert.match(verify, /chapterIDs\.allSatisfy/);
  assert.match(verify, /smilTextIDs\.allSatisfy/);
  assert.match(verify, /audioEnds\.allSatisfy/);
  assert.match(verify, /!entries\.contains\("book\.xml"\)/);
  assert.match(verify, /0xff && \(\$0\.1 & 0xe0\) == 0xe0/);
  assert.match(daisy, /if !verified \{ try\? FileManager\.default\.removeItem\(at: output\) \}/);
  assert.match(daisy, /let dtbook = """/); // DAISY 3 remains available.
  assert.match(daisy, /try NativeDaisyPackageVerifier\.validate\(output\)/);
});

test('DAISY 2.02 labels and explanation are translated into every published language', () => {
  for (const language of ['en', 'pt', 'fr', 'it', 'de']) {
    const catalog = read(language + '.lproj/Localizable.strings');
    assert.match(catalog, /^"DAISY 2\.02 \(audio\)" = /m, language);
    assert.match(catalog, /^"DAISY 2\.02 de audio: conserva la voz grabada/m, language);
  }
});

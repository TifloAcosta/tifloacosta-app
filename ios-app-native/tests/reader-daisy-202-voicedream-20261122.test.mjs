import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const audio = read('NativeGeminiAudioExport.swift');
const daisy = read('NativeGeminiDaisyExport.swift');
const verify = read('NativeDaisyPackageVerifier.swift');
const layout = read('NativeDaisy202AudioLayout.swift');
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
  assert.match(layout, /ncc:multimediaType" content="audioNCC"/);
  assert.match(layout, /dc:format" content="Daisy 2\.02"/);
  assert.match(layout, /<html xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/);
  assert.match(layout, /<smil>/);
  assert.match(layout, /ncc\.html#nav/);
  assert.match(layout, /clip-begin=\\?"npt=0\.000s/);
  assert.match(layout, /clip-end=\\?"npt=/);
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

test('DAISY 2.02 uses direct SMIL par per audio clip and validates links and metadata', () => {
  assert.match(daisy, /NativeDaisy202AudioLayout[.]render[(]/);
  assert.match(daisy, /audioOnlyChapters\[audioOnlyChapters[.]count - 1\][.]title = heading/);
  assert.match(layout, /for [(]chapter, item[)] in chapters[.]enumerated[(][)]/);
  assert.match(layout, /for [(]index, clip[)] in item[.]clips[.]enumerated[(][)]/);
  assert.match(layout, /index == 0 \? "section/);
  assert.match(layout, /<par id=/);
  assert.match(layout, /endsync="last"/);
  assert.match(layout, /<text id=/);
  assert.match(layout, /<audio id=/);
  assert.match(layout, /ncc:tocItems/);
  assert.match(layout, /ncc:files/);
  assert.match(verify, /parBlocks[.]count == audioRefs[.]count/);
  assert.match(verify, /smilTextIDs[.]count == audioRefs[.]count/);
  assert.match(verify, /chapterStarts == chapterStarts[.]sorted[(][)]/);
  assert.match(verify, /nccFileCount[.]first[.]flatMap[(]Int[.]init[)] == entries[.]count/);
  assert.match(verify, /nccChapterCount[.]first[.]flatMap[(]Int[.]init[)] == chapterIDs[.]count/);
  assert.match(verify, /audioBegins[.]allSatisfy/);
});

test('the Xcode workflow executes the real DAISY 2.02 XML renderer smoke test', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/ios-next-beta-validation.yml', import.meta.url), 'utf8');
  assert.match(workflow, /Validar DAISY 2[.]02 de audio con Swift y XML real/);
  assert.match(workflow, /NativeDaisy202AudioLayout[.]swift/);
  assert.match(workflow, /daisy-202-layout-smoke[.]swift/);
});

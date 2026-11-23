import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const swift = file => readFileSync(new URL('../Sources/' + file, import.meta.url), 'utf8');
const exportAudio = swift('NativeGeminiAudioExport.swift');
const daisy = swift('NativeGeminiDaisyExport.swift');
const reader = swift('NativeTifloLector.swift');
const verifier = swift('NativeDaisyPackageVerifier.swift');

test('Voice Dream MP3 ZIP is a separate option; DAISY 3 and 2.02 are retained', () => {
  assert.match(exportAudio, /case daisy = "DAISY"/);
  assert.match(exportAudio, /case daisyVoiceDream = "DAISY 2[.]02 [(]audio[)]"/);
  assert.match(exportAudio, /case voiceDreamMP3Zip = "Audiolibro para Voice Dream [(]ZIP de MP3[)]"/);
  assert.match(exportAudio, /format == [. ]voiceDreamMP3Zip/);
  assert.match(exportAudio, /mp3AudiobookZip: format == [. ]voiceDreamMP3Zip/);
  assert.match(daisy, /if mp3AudiobookZip \{/);
  assert.match(daisy, /if audioOnly202 \{/);
  assert.match(reader, /case [. ]voiceDreamMP3Zip: formatLabel = "Voice Dream MP3 ZIP"/);
  assert.match(reader, /audioExportFormat == [. ]voiceDreamMP3Zip/);
});

test('newly generated MP3 audiobook uses numbered tracks and never resynthesizes after generation', () => {
  const body = daisy.slice(daisy.indexOf('private static func packageMP3Audiobook('),
                           daisy.indexOf('static func generate(text:'));
  assert.ok(body.length > 200);
  assert.match(body, /Set[(]clips[)][.]count == clips[.]count/);
  assert.match(body, /String[(]format: "%04d[.]mp3", index \+ 1[)]/);
  assert.match(body, /manager[.]moveItem[(]at: source, to: target[)]/);
  assert.match(body, /archive[.]addEntry[(]with: filename, relativeTo: working/);
  assert.match(body, /Task[.]checkCancellation/);
  assert.match(body, /if !verified \{ try[?] manager[.]removeItem[(]at: output[)] \}/);
  assert.doesNotMatch(body, /synthesize[(]|encodeMP3[(]|NativeGeminiAudioExport[.]mp3[(]/);
  assert.match(daisy, /clips: audioOnlyChapters[.]flatMap \{ \$0[.]clips \}[.]map \{ \$0[.]file \}/);
});

test('MP3 already present in a document is repackaged without TTS, DAISY original stays separate', () => {
  assert.match(reader, /func exportVoiceDreamMP3[(]_ document: NativeReadingDocument[)] throws -> URL/);
  assert.match(reader, /try exportAudioTracks[(]document, mp3OnlyForVoiceDream: true[)]/);
  assert.match(reader, /mp3OnlyForVoiceDream\s*[?]\s*ext == "mp3"/);
  assert.match(reader, /String[(]format: "%04d[.]mp3", index \+ 1[)]/);
  assert.match(reader, /manager[.]copyItem[(]at: source, to: staging[.]appendingPathComponent[(]filename[)][)]/);
  assert.match(reader, /Button[(]"Audiolibro para Voice Dream [(]ZIP de MP3[)]"[)]/);
  assert.match(reader, /NativeShare[.]present[(]url: try library[.]exportVoiceDreamMP3[(]document[)][)]/);
  assert.match(reader, /Button[(]"Compartir DAISY original"[)]/);
  assert.match(reader, /Button[(]"Exportar audio existente [(]pistas en ZIP[)]"[)]/);
  const packaging = reader.slice(reader.indexOf('func exportVoiceDreamMP3('),
                                 reader.indexOf('/// Exportación íntegra:'));
  assert.doesNotMatch(packaging, /synthesize[(]|NativeGeminiSpeech[.]generate/);
});

test('both MP3 ZIP exporters verify real archive entries before sharing', () => {
  assert.match(daisy, /try NativeDaisyPackageVerifier[.]validateVoiceDreamMP3Zip[(]output[)]/);
  assert.match(reader, /try NativeDaisyPackageVerifier[.]validateVoiceDreamMP3Zip[(]output[)]/);
  assert.match(reader, /try[?] manager[.]removeItem[(]at: outputDirectory[)]/);
  assert.match(verifier, /static func validateVoiceDreamMP3Zip[(]_ url: URL[)] throws/);
  assert.match(verifier, /Archive[(]url: url, accessMode: [.]read[)]/);
  assert.match(verifier, /entry[.]type == [.]file/);
  assert.match(verifier, /filenames[.]insert[(]entry[.]path[)][.]inserted/);
  assert.match(verifier, /entry[.]path[.]range[(]of:/);
  assert.ok(verifier.includes('[0-9]{4}'));
  assert.match(verifier, /filenames[.]sorted[(][)]/);
  assert.match(verifier, /ordered[.]enumerated[(][)][.]allSatisfy/);
  assert.match(verifier, /String[(]format: "%04d[.]mp3", \$0[.]offset \+ 1[)]/);
  assert.match(verifier, /750_000_000 - totalBytes/);
  assert.match(verifier, /filenames[.]count < 4_000/);
  assert.match(verifier, /archive[.]extract[(]entry[)]/);
  assert.match(verifier, /var mp3Probe = NativeMP3HeaderProbe[(][)]/);
  assert.match(verifier, /mp3Probe[.]consume[(]part[)]/);
  assert.match(verifier, /mp3Probe[.]hasMPEGFrame/);
  const probeSource = swift('NativeMP3HeaderProbe.swift');
  assert.match(probeSource, /frameOffset = 10 \+ size \+ footer/);
  assert.match(probeSource, /frameHeader[.]count == 4/);
  const workflow = readFileSync(new URL('../../.github/workflows/ios-next-beta-validation.yml', import.meta.url), 'utf8');
  assert.match(workflow, /mp3-header-probe-smoke[.]swift/);
  assert.match(verifier, /try Task[.]checkCancellation[(][)]/);
});

test('the MP3 ZIP option and its caution are available in all five translations', () => {
  const keys = [
    'Audiolibro para Voice Dream (ZIP de MP3)',
    'ZIP de MP3 numerados: conserva la voz sintetizada en esta conversión, sin incluir texto ni estructura DAISY. La compatibilidad con Voice Dream requiere prueba en el dispositivo.',
    'No se pudo exportar el ZIP de MP3: %@',
    'El ZIP de MP3 está incompleto o contiene pistas no válidas.'
  ];
  for (const language of ['en', 'pt', 'fr', 'it', 'de']) {
    const lines = swift(language + '.lproj/Localizable.strings');
    for (const key of keys) {
      assert.ok(lines.includes('"' + key + '" = "'), language + ': ' + key);
    }
  }
});

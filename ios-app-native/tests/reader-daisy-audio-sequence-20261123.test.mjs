import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const order = read('NativeDaisyAudioOrder.swift');
const formats = read('NativeReaderFormats.swift');
const reader = read('NativeTifloLector.swift');
const workflow = readFileSync(new URL('../../.github/workflows/ios-next-beta-validation.yml', import.meta.url), 'utf8');

test('DAISY reading order uses NCC links, NCX navPoints and each SMIL audio source', () => {
  assert.match(order, /nccReferences\(text\)/);
  assert.match(order, /NativeDaisyNCX[.]parse\(data\)/);
  assert.match(order, /sources\[smil\] = smilSources\(data\)/);
  assert.match(order, /for anchor in anchors/);
  assert.match(order, /boundaries\[anchor\.smil/);
  assert.match(order, /orderedSources\(in: directory/);
  assert.match(order, /NativeDaisySMILAudioDelegate/);
  assert.match(order, /XMLParser\(data: data\)/);
  assert.match(order, /orderedSMIL[.]append\(path\)/);
  assert.match(order, /orderedAudio[.]append\(path\)/);
  assert.match(order, /for path in audioPaths where seenAudio[.]insert/);
  assert.match(order, /matches[.]count == 1/);
});

test('DAISY track index is created in navigation order before mapping SMIL to tracks', () => {
  const discover = formats.indexOf('let discoveredAudioFiles = all.filter');
  const ordered = formats.indexOf('let audioFiles = isDaisy');
  const map = formats.indexOf('NativeDaisyAudioOrder.navigationAudio(');
  const stored = formats.indexOf('for path in audioFiles {');
  assert.ok(discover >= 0 && ordered > discover && map > ordered && stored > map);
  assert.match(formats, /NativeDaisyAudioOrder[.]orderedAudioFiles/);
  assert.match(formats, /daisyNavigation: daisyNavigation/);
  assert.match(formats, /NativeDaisyAudioOrder[.]resolvedMember/);
  assert.match(formats, /NativeDaisyAudioOrder[.]navigationAudio/);
});

test('exporting existing audio preserves every original track, handles FLAC, and creates stable numbered ZIP', () => {
  const exportCode = reader.split('func exportAudioTracks(_ document: NativeReadingDocument) throws -> URL {')[1]
    ?.split('func exportBackup() throws -> URL')[0] ?? '';
  assert.match(exportCode, /for \(index, path\) in paths[.]enumerated\(\)/);
  assert.match(exportCode, /"flac"/);
  assert.match(exportCode, /FileManager[.]default/);
  assert.match(exportCode, /manager[.]copyItem\(at: source, to:/);
  assert.match(exportCode, /String\(format: "Pista-%04d", index \+ 1\)/);
  assert.match(exportCode, /zipItem\(at: staging, to: output, shouldKeepParent: false\)/);
  assert.doesNotMatch(exportCode, /AVSpeechSynthesizer|\.encode\(|speech[.]play/);
});

test('original DAISY, extracted tracks and voice conversion are three distinct accessible actions', () => {
  const actions = reader.split('private var documentActions: some View {')[1]
    ?.split('private var bookmarksSheetContent: some View {')[0] ?? '';
  assert.ok(actions.includes('Button("Compartir DAISY original")'));
  assert.ok(actions.includes('Button("Exportar audio existente (pistas en ZIP)")'));
  assert.ok(actions.includes('Button("Convertir texto a MP3 o DAISY con voz")'));
  assert.match(actions, /if !latest[.]body[.]isEmpty/);
  assert.match(actions, /else if !tracks[.]isEmpty/);
  assert.match(actions, /library[.]exportAudioTracks\(document\)/);
  assert.match(actions, /shareCurrentDocument\(\)/);
});

test('all DAISY action names have five language translations', () => {
  const keys = ['Compartir DAISY original', 'Exportar audio existente (pistas en ZIP)',
    'Convertir texto a MP3 o DAISY con voz'];
  for (const language of ['en','pt','fr','it','de']) {
    const catalog = read(language + '.lproj/Localizable.strings');
    for(const key of keys) assert.ok(catalog.includes('"' + key + '" = '),
                                    language + ' missing: ' + key);
  }
});

test('CI executes real Swift DAISY ordering fixtures before compiling the app', () => {
  assert.match(workflow, /Comprobar el orden DAISY con Swift real/);
  assert.match(workflow, /NativeDaisyAudioOrder[.]swift/);
  assert.match(workflow, /daisy-audio-order-smoke[.]swift/);
  assert.match(workflow, /daisy-audio-order-check/);
});

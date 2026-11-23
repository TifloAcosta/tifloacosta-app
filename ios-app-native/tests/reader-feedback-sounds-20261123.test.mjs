import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const reader = source('NativeTifloLector.swift');
const settings = source('NativeReaderSettings.swift');
const feedback = source('NativeReaderFeedback.swift');
const section = (code, start, end) => code.split(start)[1]?.split(end)[0] ?? '';

test('bookmarks sound different on success, duplicate and error, after actual persistence', () => {
  const mark = section(reader, 'private func addBookmark() {', 'private func exportGeneratedAudio()');
  for (const [result, outcome] of [
    ['saved', 'saved'], ['alreadyExists', 'duplicate'],
    ['documentUnavailable', 'error'], ['failed', 'error']
  ]) {
    const block = section(mark, 'case .' + result + ':', 'case .');
    assert.ok(block.includes('NativeReaderFeedback.confirm(.' + outcome + ')'),
      'result '+result+' must use '+outcome+' cue');
  }
  assert.ok(mark.includes('result = library.addTextBookmark(document, offset: readingOffset)'));
  assert.ok(mark.includes('result = library.addAudioBookmark(document, track: trackIndex'));
  assert.ok(mark.includes('NativeReaderFeedback.spokenAnnouncementsEnabled'));
  assert.ok(mark.includes('UIAccessibility.post(notification: .announcement, argument: actionMessage)'));
});

test('VoiceOver-selected paragraph bookmark leaves the current reading cursor untouched', () => {
  const context = section(reader, 'private func bookmarkFromContextMenu(at fragment: Int) {',
                                  'private func restoreManualReadingFocus');
  assert.ok(context.includes('textLayout.fragmentStarts[fragment]'));
  assert.ok(context.includes('let previousOffset = readingOffset'));
  assert.ok(context.includes('let previousPercent = currentPercent'));
  assert.ok(context.indexOf('addBookmark()') < context.indexOf('readingOffset = previousOffset'));
  assert.ok(context.includes('currentPercent = previousPercent'));
  assert.doesNotMatch(context, /pausePlayback\(\)|speech\.resume\(\)|Task\.sleep/);
});

test('three simple persistent controls, no audio session disruption, no focus changes', () => {
  const keys = ['native-reader-sounds-enabled','native-reader-spoken-feedback-enabled',
                'native-reader-haptics-enabled'];
  for (const key of keys) {
    assert.ok(feedback.includes(key));
    assert.ok(feedback.includes('@AppStorage("' + key + '")'));
  }
  assert.ok(settings.includes('NavigationLink("Sonidos y avisos")'));
  assert.ok(settings.includes('NativeReaderFeedbackControls()'));
  assert.ok(feedback.includes('Toggle("Sonidos de TifloLector"'));
  assert.ok(feedback.includes('Toggle("Avisos hablados"'));
  assert.ok(feedback.includes('Toggle("Vibración en avisos"'));
  assert.ok(feedback.includes('AVAudioPlayer(data: cueData(for: outcome))'));
  assert.ok(feedback.includes('Array("RIFF".utf8)'));
  assert.ok(feedback.includes('Array("WAVEfmt ".utf8)'));
  assert.ok(feedback.includes('Array("data".utf8)'));
  assert.doesNotMatch(feedback, /setCategory\(|setActive\(|\.accessibilityFocused\(/);
});

test('batch importing has an optional final cue, not an intrusive sound per file', () => {
  const imports = section(reader, '.fileImporter(\n            isPresented: $importPresented,',
                                   '.fileImporter(isPresented: $restorePresented');
  assert.ok(imports.includes('NativeReaderFeedback.confirm(.imported)'));
  assert.ok(imports.includes('NativeReaderFeedback.confirm(.error)'));
  const filesProgress = section(imports, 'importSelectedFiles(from: urls) { message in',
                                '}\n                        importFilesStatus =');
  const folderProgress = section(imports, 'importFolder(from: folder) { message in',
                                '}\n                        importFolderStatus =');
  assert.doesNotMatch(filesProgress, /NativeReaderFeedback[.]confirm/);
  assert.doesNotMatch(folderProgress, /NativeReaderFeedback[.]confirm/);
});

test('shared-file batches use one end cue and retain the text status', () => {
  const inbox = source('NativeShareInbox.swift');
  const importer = section(inbox, 'func importPendingReaderContent(into library:',
                            'func complete(_ item:');
  assert.ok(importer.includes('importedCount > 0 || !failures.isEmpty'));
  assert.ok(importer.includes('NativeReaderFeedback.confirm(failures.isEmpty ? .imported : .error)'));
  assert.ok(importer.includes('NativeReaderFeedback.spokenAnnouncementsEnabled'));
  assert.ok(importer.includes('importSummary = MusicLocalized.format('));
});

test('sound and announcement labels are translated into all five additional languages', () => {
  const keys = ['Sonidos y avisos', 'Confirmaciones de TifloLector',
    'Sonidos de TifloLector','Avisos hablados','Vibración en avisos'];
  for (const language of ['en','pt','fr','it','de']) {
    const strings = source(language + '.lproj/Localizable.strings');
    for (const key of keys) {
      assert.ok(strings.includes('"' + key + '" = '), language + ': ' + key);
    }
  }
});

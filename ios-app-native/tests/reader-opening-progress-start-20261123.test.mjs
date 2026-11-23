import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url),'utf8');
const progress = readFileSync(new URL('../Sources/NativeReaderProgress.swift', import.meta.url),'utf8');
const workflow = readFileSync(new URL('../../.github/workflows/ios-next-beta-validation.yml', import.meta.url),'utf8');
const between = (a,b) => src.split(a)[1]?.split(b)[0] ?? '';

test('reader requests delayed focus only while visible and in voice mode', () => {
  const open = between('    var body: some View {\n        readerWithSheets','        .onChange(of: sleepIndex)');
  assert.match(open,/readerIsVisible = true/);
  assert.match(open,/Task[.]sleep[(]for: [.]milliseconds[(]300[)][)]/);
  assert.match(open,/guard !Task[.]isCancelled, readerIsVisible/);
  assert.match(open,/playbackButtonFocused = true/);
  const disappear = between('        .onDisappear {\n            readerIsVisible = false','        .accessibilityAction(.magicTap)');
  assert.match(disappear,/unregisterRemotePlaybackCommands/);
});

test('text reaches 100% only at exact end, with executable Swift test', () => {
  assert.match(progress,/if clamped == length \{ return 100 \}/);
  assert.match(progress,/min[(]99, Int[(]Double[(]clamped[)]/);
  assert.match(src,/NativeReaderProgress[.]textPercent[(]length: textLength, offset: value[)]/);
  assert.match(src,/NativeReaderProgress[.]textPercent[(]\s*length: textLayout[.]totalCharacters, offset: offset[)]/);
  assert.match(workflow,/reader-progress-smoke[.]swift/);
});

test('library progress labels audio by track and distinguishes legacy percentages', () => {
  const label = between('    private func documentRowLabel(', '    private var shownDocuments:');
  assert.match(label,/saved[.]trackPaths/);
  assert.match(label,/Pista %d de %d, %d por ciento de esta pista[.]/);
  assert.match(label,/saved[.]lastTextOffset/);
  assert.match(label,/Progreso guardado: %d por ciento[.]/);
});

test('one-button jump to beginning does not start playback or discard bookmarks', () => {
  const helper = between('    private func returnToBeginning() {','    private var playbackRow: some View');
  for (const s of ['speech.stop()','readingOffset = 0','trackIndex = 0','currentPercent = 0',
                   'pendingDaisyAudioSeconds = 0','didRestoreAudioPosition = true','persistPosition()']) {
    assert.ok(helper.includes(s),s);
  }
  assert.doesNotMatch(helper,/playTrack[(]|startTextSpeech[(]|speech[.]resume[(]/);
  const row = between('    private var playbackRow: some View','    @ViewBuilder\n    private var trackButtons');
  assert.match(row,/Button[(]"Volver al principio"[)] \{ returnToBeginning[(][)] \}/);
});

test('reader labels have five translations', () => {
  const keys = ['Volver al principio','Posición inicial. Pulsa Reproducir para comenzar.',
    'Pista %d de %d, %d por ciento de esta pista.','Progreso guardado: %d por ciento.',
    'Sitúa la lectura al principio sin reproducir.'];
  for(const lang of ['en','pt','fr','it','de']) {
    const contents = readFileSync(new URL('../Sources/'+lang+'.lproj/Localizable.strings',import.meta.url),'utf8');
    for(const key of keys) assert.ok(contents.includes('"'+key+'" = "'), lang+': '+key);
  }
});

test('opening a document saves only its timestamp, without re-encoding the book collection', () => {
  const mark = between('    func markOpened(_ document: NativeReadingDocument) {','    func toggleFavorite(');
  assert.match(mark,/UserDefaults[.]standard[.]set[(]Date[(][)]/);
  assert.doesNotMatch(mark,/try[?]? save[(][)]|documents\[index\][.]lastOpenedAt/);
  const snapshot = between('    private func documentsForPersistence() -> [NativeReadingDocument] {','    private static var storageURL');
  assert.match(snapshot,/copy[.]lastOpenedAt = lastOpenedAt[(]for: document[)]/);
  const backup = between('    func exportBackup() throws -> URL {','    func restoreBackup(');
  assert.match(backup,/encoder[.]encode[(]documentsForPersistence[(][)][)]/);
  const persistence = between('    private func save() throws {','struct NativeReaderLibraryScreen: View');
  assert.match(persistence,/JSONEncoder[(][)][.]encode[(]documentsForPersistence[(][)][)]/);
});

test('recently opened sort and shortcut use the persisted lightweight timestamp', () => {
  assert.match(src,/case 5: items[.]sort/);
  const sort = between('        case 5: items.sort {', '        default: items.sort');
  assert.match(sort,/library[.]lastOpenedAt[(]for: [$]0[)]/);
  const shortcut = between('    private func resumeRequestedBook() {','    private func play(_ document:');
  assert.match(shortcut,/library[.]lastOpenedAt[(]for: [$]0[)]/);
  assert.match(shortcut,/library[.]lastOpenedAt[(]for: [$]1[)]/);
  assert.match(src,/func latest[(]_ document: NativeReadingDocument[)] -> NativeReadingDocument/);
});


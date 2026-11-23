import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const swift = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');
const part = (start, end) => swift.split(start)[1]?.split(end)[0] ?? '';

test('button and accessible action use the same bookmark routine as the shortcut', () => {
  assert.match(swift, /Button\("Añadir marca"\) \{ addBookmarkFromReaderSelection\(\) \}/);
  assert.match(swift, /NativeQuickBookmarkBridge\.saveActiveReader = \{ addBookmark\(\) \}/);
  const button = part('private func addBookmarkFromReaderSelection() {', 'private func bookmarkFromContextMenu');
  assert.match(button, /addBookmark\(\)/);
  assert.doesNotMatch(button, /lastReaderFragment|focusedFragment|bookmarkFromContextMenu/);
});

test('both bookmark formats report real persistence and restore old data after a failed write', () => {
  for (const [begin, end] of [
    ['func addTextBookmark(_ document:', 'func removeTextBookmark(_ document:'],
    ['func addAudioBookmark(_ document:', 'func removeAudioBookmark(_ document:']
  ]) {
    const functionBody = part(begin, end);
    assert.match(functionBody, /NativeBookmarkSaveResult/);
    assert.match(functionBody, /return \.alreadyExists/);
    assert.match(functionBody, /return \.documentUnavailable/);
    assert.match(functionBody, /try save\(\)/);
    assert.match(functionBody, /return \.saved/);
    assert.match(functionBody, /return \.failed/);
    assert.match(functionBody, /documents\[i\]\.\w+Bookmarks = previous/);
    assert.doesNotMatch(functionBody, /try\? save\(\)/);
  }
});

test('VoiceOver confirms only actual saves and reports duplicates and errors', () => {
  const functionBody = part('private func addBookmark() {', 'private func exportGeneratedAudio()');
  assert.match(functionBody, /switch result/);
  for (const code of ['.saved', '.alreadyExists', '.failed', '.documentUnavailable']) {
    assert.ok(functionBody.includes('case ' + code + ':'), 'missing ' + code);
  }
  assert.match(functionBody, /NativeReaderFeedback[.]confirm[(][.]saved[)]/);
  assert.match(functionBody, /NativeReaderFeedback[.]spokenAnnouncementsEnabled/);
  assert.match(functionBody, /UIAccessibility[.]post[(]notification: [. ]announcement, argument: actionMessage[)]/);
  assert.match(functionBody, /Ya existe una marca en esta posición/);
  assert.match(functionBody, /No se pudo guardar la marca/);
});

test('new confirmation messages exist in all five translated string catalogs', () => {
  const keys = [
    'Ya existe una marca en esta posición.',
    'No se pudo crear la marca: documento no disponible.',
    'No se pudo guardar la marca. Inténtalo de nuevo.'
  ];
  for (const lang of ['en', 'pt', 'fr', 'it', 'de']) {
    const file = readFileSync(new URL('../Sources/' + lang + '.lproj/Localizable.strings', import.meta.url), 'utf8');
    for (const key of keys) assert.ok(file.includes('"' + key + '" = '), lang + ': ' + key);
  }
});

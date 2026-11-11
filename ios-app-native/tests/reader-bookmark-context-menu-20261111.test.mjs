import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const swift = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');

test('Texto de lectura presenta menú contextual con Crear marca sin menú de selección competidor', () => {
  const start = swift.indexOf('private func readerFragment(at index: Int)');
  const end = swift.indexOf('private var readingContent', start);
  const fragment = swift.slice(start, end);
  assert.match(fragment, /\.contextMenu \{/);
  assert.match(fragment, /Button\("Crear marca", systemImage: "bookmark"\)/);
  assert.doesNotMatch(fragment, /\.textSelection\(\.enabled\)/);
  assert.doesNotMatch(fragment, /\} preview: \{/);
  assert.doesNotMatch(fragment, /LongPressGesture\(minimumDuration: 2\.0\)/);
});

test('Crear marca conserva posición y reanuda si estaba reproduciendo', () => {
  const start = swift.indexOf('private func bookmarkFromContextMenu()');
  const end = swift.indexOf('private func readerFragment(', start);
  const action = swift.slice(start, end);
  assert.match(action, /let wasPlaying = speech\.isPlaying/);
  assert.match(action, /if wasPlaying \{ pausePlayback\(\) \}/);
  assert.match(action, /addBookmark\(\)/);
  assert.match(action, /if speech\.isPaused \{ speech\.resume\(\); applySleepTimer\(\) \}/);
  assert.match(swift, /Button\("Añadir marca"\) \{ addBookmark\(\) \}/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const swift = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');

test('Doble toque sostenido sobre el texto crea marca directamente sin menú competidor', () => {
  const start = swift.indexOf('private func readerFragment(at index: Int)');
  const end = swift.indexOf('private var readingContent', start);
  const fragment = swift.slice(start, end);
  assert.match(fragment, /\.onLongPressGesture\(minimumDuration: 0\.7\)/);
  assert.match(fragment, /bookmarkFromContextMenu\(at: index\)/);
  assert.doesNotMatch(fragment, /\.contextMenu \{/);
  assert.doesNotMatch(fragment, /\.textSelection\(\.enabled\)/);
  assert.doesNotMatch(fragment, /\} preview: \{/);
  assert.doesNotMatch(fragment, /LongPressGesture\(minimumDuration: 2\.0\)/);
});

test('Crear marca conserva posición y reanuda si estaba reproduciendo', () => {
  const start = swift.indexOf('private func bookmarkFromContextMenu(at fragment: Int)');
  const end = swift.indexOf('private func readerFragment(', start);
  const action = swift.slice(start, end);
  assert.match(action, /let wasPlaying = speech\.isPlaying/);
  assert.match(action, /if wasPlaying \{ pausePlayback\(\) \}/);
  assert.match(action, /addBookmark\(\)/);
  assert.match(action, /textLayout\.fragmentStarts\[fragment\]/);
  assert.match(action, /guard textLayout\.fragmentStarts\.indices\.contains\(fragment\) else \{ return \}/);
  assert.doesNotMatch(action, /!speech\.isPaused/);
  assert.match(action, /if speech\.isPaused \{ speech\.resume\(\); applySleepTimer\(\) \}/);
  assert.match(swift, /Button\("Añadir marca"\) \{ addBookmark\(\) \}/);
  assert.match(swift, /accessibilityAction\(named: Text\("Crear marca"\)\)/);
  assert.match(swift, /bookmarkFromContextMenu\(at: index\)/);
});

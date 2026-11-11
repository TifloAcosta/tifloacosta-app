import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const swift = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');

test('La zona de lectura dispone de menú contextual solo para crear una marca', () => {
  const start = swift.indexOf('private func readerFragment(at index: Int)');
  const end = swift.indexOf('private var readingContent', start);
  const text = swift.slice(start, end);
  assert.match(text, /\.contextMenu \{/);
  assert.match(text, /Button\("Crear marca"\)/);
  assert.doesNotMatch(text, /Button\("Buscar/);
  assert.doesNotMatch(text, /LongPressGesture\(minimumDuration: 2\.0\)/);
});

test('La apertura pausa y el cierre respeta el estado de reproducción anterior', () => {
  assert.match(swift, /private func bookmarkMenuOpened\(\)/);
  assert.match(swift, /bookmarkMenuWasPlaying = speech\.isPlaying/);
  assert.match(swift, /if speech\.isPlaying \{ pausePlayback\(\) \}/);
  assert.match(swift, /if shouldResume \{/);
  assert.match(swift, /if speech\.isPaused \{ speech\.resume\(\); applySleepTimer\(\) \}/);
  assert.match(swift, /Button\("Añadir marca"\) \{ addBookmark\(\) \}/);
});

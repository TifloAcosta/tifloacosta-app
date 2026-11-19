import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const reader = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');
const shares = readFileSync(new URL('../Sources/NativeScreens.swift', import.meta.url), 'utf8');

test('multi-selection shares only the currently visible selected books', () => {
  assert.match(reader, /Button\("Compartir seleccionados"/);
  assert.match(reader, /shownDocuments\.filter \{ visibleSelection\.contains\(\$0\.id\) \}/);
  assert.match(reader, /\.disabled\(visibleSelection\.isEmpty\)/);
});

test('multi-share uses original files and explicitly reports reconstructed text', () => {
  assert.match(reader, /func sharingURLs\(for documents: \[NativeReadingDocument\]\) throws/);
  assert.match(reader, /originalURL\(for: document\)/);
  assert.match(reader, /appendingPathExtension\("txt"\)/);
  assert.match(reader, /textFallbackCount/);
  assert.match(reader, /showShareFallbackWarning/);
  assert.match(reader, /exportAudioTracks\(document\)/);
});

test('one native share sheet receives all selected file URLs', () => {
  assert.match(shares, /static func present\(urls: \[URL\]\)/);
  assert.match(shares, /UIActivityViewController\(activityItems: urls/);
});

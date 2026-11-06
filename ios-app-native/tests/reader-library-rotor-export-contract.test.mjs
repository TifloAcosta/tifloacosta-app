import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const code = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');

test('books offer Exportar audio as a VoiceOver rotor action', () => {
  const library = code.slice(code.indexOf('struct NativeReaderLibraryScreen: View'), code.indexOf('private struct NativeReaderNavigationPoint'));
  assert.match(library, /\.accessibilityAction\(named: Text\("Exportar audio"\)\) \{ documentToExport = document \}/);
  assert.match(library, /\.navigationDestination\(item: \$documentToExport\)/);
});
test('rotor shortcut selects the book and opens the same audio and DAISY settings', () => {
  assert.match(code, /var startWithAudioExport = false/);
  assert.match(code, /if startWithAudioExport \{ showAudioExport = true \}/);
  assert.match(code, /\.sheet\(isPresented: \$showAudioExport\) \{ exportAudioSheet \}/);
  assert.match(code, /Text\("DAISY"\)\.tag\(NativeGeminiAudioExport\.Format\.daisy\)/);
});

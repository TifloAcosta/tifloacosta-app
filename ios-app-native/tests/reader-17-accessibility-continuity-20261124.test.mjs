import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../Sources/' + path, import.meta.url), 'utf8');
const reader = read('NativeTifloLector.swift');
const braille = read('NativeReaderContinuousBrailleText.swift');
const settings = read('NativeReaderSettings.swift');

test('braille and speech seek through cached grapheme boundaries', () => {
  assert.match(braille, /offsets\.utf16Offset\(for: offset\)/);
  assert.match(braille, /offsets\.characterOffset\(forUTF16: view\.selectedRange\.location\)/);
  assert.doesNotMatch(braille, /substring\(to:|\.prefix\(offset\)/);
  assert.match(reader, /spokenOffsets\.characterOffset\(forUTF16: utf16Start\)/);
  assert.match(reader, /spokenOffsets\.characterOffset\(forUTF16: completedUTF16\)/);
  assert.match(reader, /guard settings != liveSystemSettings else \{ return \}/);
});

test('opening focus follows the lifetime of the reader and skips the conversion sheet', () => {
  assert.match(reader, /\.task\(id: readerIsVisible\) \{\s*guard readerIsVisible, !didApplyOpeningMode,[\s\S]*?!startWithConversion, UIAccessibility\.isVoiceOverRunning/);
  assert.match(reader, /accessibilityAction\(named: Text\("Volver al principio"\)\) \{ returnToBeginning\(\) \}/);
});

test('DAISY uses its clip sequence from the library and preserves the initial clip boundary', () => {
  const library = reader.split('private func play(_ document: NativeReadingDocument)')[1]
    .split('private func shareDocumentFromLibrary')[0];
  assert.match(library, /try speech\.playDaisySequence[\s\S]*?else \{\s*try speech\.playPlaylist/);
  assert.match(reader, /if latest\.daisyClips\?\.isEmpty != false \{\s*speech\.seek\(toSeconds: targetSeconds\)/);
});

test('braille settings guidance and precise progress labels exist in all six languages', () => {
  const keys = ['Ajustes de braille de VoiceOver', 'Muestra la ruta para llegar a los ajustes de braille.',
    'Volver al principio', 'Pista %d de %d, %d por ciento de esta pista.'];
  for (const lang of ['es', 'en', 'pt', 'fr', 'it', 'de']) {
    const catalog = lang === 'es' ? settings + reader : read(lang + '.lproj/Localizable.strings');
    for (const key of keys) {
      assert.ok(catalog.includes('"' + key + '"' + (lang === 'es' ? '' : ' = ')), lang + ': ' + key);
    }
  }
});

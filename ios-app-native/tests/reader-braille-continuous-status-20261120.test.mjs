import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = file => readFileSync(new URL('../Sources/' + file, import.meta.url), 'utf8');

test('Braille settings explicitly announce that reading is continuous', () => {
  const settings = read('NativeReaderSettings.swift');
  const controls = settings.slice(settings.indexOf('struct NativeReaderBrailleControls'), settings.indexOf('struct NativeReaderSettingsScreen'));
  assert.match(controls, /Text\("Lectura braille continua activada"\)/);
  assert.match(read('NativeTifloLector.swift'), /NativeReaderContinuousBrailleText\(/);
});

test('Continuous braille status is translated into the five additional languages', () => {
  for (const language of ['en', 'pt', 'fr', 'it', 'de']) {
    assert.ok(read(language + '.lproj/Localizable.strings').includes('"Lectura braille continua activada" = '), language);
  }
});

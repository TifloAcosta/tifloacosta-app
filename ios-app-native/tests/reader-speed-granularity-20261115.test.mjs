import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const settings=readFileSync(new URL('../Sources/NativeReaderSettings.swift',import.meta.url),'utf8');
const reader=readFileSync(new URL('../Sources/NativeTifloLector.swift',import.meta.url),'utf8');
test('Velocidad TTS ajustable en pasos de 0,05 y compatible con preferencias antiguas',()=>{
  assert.match(settings,/enum NativeReaderSpeedOptions/);
  assert.match(settings,/\(15\.\.\.30\)\.map \{ Double\(\$0\) \/ 20\.0 \}/);
  assert.match(settings,/legacyRates: \[Double\] = \[0\.75, 0\.9, 1\.0, 1\.25, 1\.5\]/);
  assert.match(settings,/storedIndex\(for choice: Int\)/);
  assert.match(settings,/selectedIndex: speedChoiceBinding/);
  assert.doesNotMatch(reader,/private let speeds: \[Double\]/);
  assert.match(reader,/NativeReaderSpeedOptions\.rate\(for: chosenSpeed\)/);
  assert.match(reader,/NativeReaderSpeedOptions\.rate\(for: effectiveSpeedIndex\)/);
});
test('La unidad de avance es ajustable directamente, sin pantalla duplicada',()=>{
  assert.doesNotMatch(settings,/NavigationLink\("Navegación y avances"\)/);
  assert.match(settings,/if presentationMode != 2 \{/);
  assert.match(settings,/title: "Unidad de avance"/);
});

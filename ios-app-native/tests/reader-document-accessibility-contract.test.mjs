import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const reader = read('NativeTifloLector.swift');
const settings = read('NativeReaderSettings.swift');

test('The open document exposes usable Audio and Visual controls', () => {
  assert.match(reader, /Button\("Audio"\) \{ showAudioSettings = true \}/);
  assert.match(reader, /Button\("Visual"\) \{ showVisualSettings = true \}/);
  assert.match(reader, /NativeReaderAudioSettingsScreen\(\)/);
  assert.match(reader, /NativeReaderVisualSettingsScreen\(\)/);
  assert.match(settings, /NativeReaderAudioControls\(\)/);
  assert.match(settings, /NativeReaderVisualControls\(\)/);
  assert.doesNotMatch(reader, /Menu\("Acciones"\)/);
  assert.match(reader, /confirmationDialog\("Acciones del documento"/);
});

test('Sleep timer is first-level and scoped to the open document', () => {
  assert.match(reader, /@State private var sleepIndex = 0/);
  assert.match(reader, /title: "Apagado automático"/);
  assert.match(reader, /onChange\(of: sleepIndex\)/);
  assert.match(reader, /speech\.sleep\(after: speech\.isPlaying/);
  assert.doesNotMatch(settings, /title: "Apagado automático"/);
  assert.doesNotMatch(reader, /@AppStorage\("native-reader-sleep-index"\)/);
});

test('Long text is lazily segmented and VoiceOver is not force-recentered', () => {
  assert.match(reader, /private struct NativeReaderTextLayout/);
  assert.match(reader, /LazyVStack\(alignment: \.leading/);
  assert.match(reader, /ForEach\(textLayout\.fragments\.indices/);
  assert.match(reader, /programmaticFocusRequest/);
  assert.match(reader, /if let index, programmaticFocusRequest/);
  assert.doesNotMatch(reader, /Text\(latest\.body\)/);
  assert.doesNotMatch(reader, /Text\(document\.body\)/);
});

test('Audio polling never rewinds on each 2-percent progress increment', () => {
  assert.match(reader, /private var positionBinding: Binding<Int>/);
  assert.match(reader, /if speech\.hasAudio \{ speech\.seek\(to: value\) \}/);
  assert.match(reader, /if abs\(updated - lastSavedPercent\) >= 5/);
  assert.doesNotMatch(reader, /\.onChange\(of: currentPercent\)/);
});

test('Reader document actions remain real and VoiceOver-usable', () => {
  for (const action of [
    'Añadir marca', 'Exportar texto', 'Traducir fragmento actual',
    'Unidad anterior', 'Unidad siguiente', 'Avanzar diez por ciento'
  ]) assert.ok(reader.includes(action), 'Missing action ' + action);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sources = [
  'NativeDownloads.swift', 'NativePodcasts.swift', 'NativeMediaInline.swift',
  'NativeUsageGuide.swift', 'NativeScreens.swift', 'NativeFavorites.swift',
  'NativeUpdatesSettings.swift', 'NativeMedia.swift', 'NativeTifloLector.swift',
  'NativeContact.swift', 'NativeNews.swift'
];

test('navigable rows do not recite generic VoiceOver gestures and rotor actions', () => {
  for (const path of sources) {
    const source = readFileSync(new URL('../Sources/' + path, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /\.accessibilityHint\((?:Text\(LocalizedStringKey\()?"Doble toque para/,
      `Generic double-tap instruction remains in ${path}`);
    assert.doesNotMatch(source, /\.accessibilityHint\("[^"\n]*(?:Acciones:|Acción:|Otras acciones:)/,
      `Rotor actions are recited in ${path}`);
  }
});

test('Mi Música automatic backups use one adjustable setting instead of three buttons and a status row', () => {
  const music = readFileSync(new URL('../Sources/NativeMyMusic.swift', import.meta.url), 'utf8');
  assert.match(music, /NativeAdjustableChoice\(\s*title: "Copia automática"/);
  assert.match(music, /library\.setAutomaticBackup\(days: \[0, 7, 30\]\[index\]\)/);
  assert.doesNotMatch(music, /Button\("Desactivar copia automática"\)/);
  assert.doesNotMatch(music, /Button\("Cada 7 días"\)/);
  assert.doesNotMatch(music, /Button\("Cada 30 días"\)/);
  assert.doesNotMatch(music, /Text\("Copia automática:/);
});

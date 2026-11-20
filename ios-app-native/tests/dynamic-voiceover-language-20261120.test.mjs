import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (name) => readFileSync(new URL(`../Sources/${name}`, import.meta.url), 'utf8');

test('Frequently used dynamic VoiceOver descriptions are translated rather than hardcoded Spanish', () => {
  const screens = [
    'NativeCloudGooglePickerScreen.swift',
    'NativeFavorites.swift',
    'NativeUpdatesSettings.swift',
    'NativeScreens.swift',
    'NativeOnDemandTranslation.swift',
  ];
  for (const screen of screens) {
    const text = source(screen);
    const rawDynamicLabel = /\.accessibility(?:Label|Hint)\("[^"\n]*\\\(/g;
    assert.doesNotMatch(text, rawDynamicLabel, `${screen} contains a dynamic untranslated label`);
  }
  assert.doesNotMatch(source('NativeCloudGooglePickerScreen.swift'), /argument: "Importado \\\(/);
  assert.doesNotMatch(source('NativeCloudGooglePickerScreen.swift'), /argument: "\\\(selection.count\) elementos/);
});

test('All supported translations include contextual screen reader templates', () => {
  const templates = [
    '%d elementos seleccionados en Google Drive',
    'Traducción en curso, %d de %d fragmentos terminados',
    '%@, recurso favorito', '%@, noticia favorita', '%@, vídeo favorito',
    '%@. Recurso de TifloAcosta', '%@. Vídeo del canal TifloAcosta',
    '%@. Canal de YouTube', 'Retoma el vídeo desde el segundo %d.',
    '%@. Canal: %@. %@', 'Publicado: %@',
    '%d por ciento', '%@ de %@', '%@, %@',
  ];
  for (const language of ['en', 'pt', 'fr', 'it', 'de']) {
    const catalog = source(`${language}.lproj/Localizable.strings`);
    for (const template of templates) assert.ok(catalog.includes(`"${template}" = `), `${language}: ${template}`);
  }
});

test('Progress values and selection announcements follow the selected app language', () => {
  for (const file of ['NativeYouTubePlayer.swift','NativePodcasts.swift','NativeTifloLector.swift']) {
    const swift = source(file);
    assert.doesNotMatch(swift, /\.accessibilityValue\("[^"\n]*\\\(/, file);
  }
  const reader = source('NativeTifloLector.swift');
  assert.doesNotMatch(reader, /\.accessibilityLabel\("\\\(NativeAppLanguage\.message/);
  const settings = source('NativeUpdatesSettings.swift');
  assert.match(settings, /MusicLocalized\.format\("Ajustes visuales restablecidos\."\)/);
});

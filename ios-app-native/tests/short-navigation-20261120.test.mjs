import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (name) => readFileSync(new URL(`../Sources/${name}`, import.meta.url), 'utf8');

test('Empty news filters do not add an instructional stop to VoiceOver navigation', () => {
  assert.doesNotMatch(source('NativeNews.swift'), /Text\("Selecciona una categoría o escribe una búsqueda para consultar noticias\."\)/);
});

test('Google Drive presents selected-file controls only when there are files to act on', () => {
  const picker = source('NativeCloudGooglePickerScreen.swift');
  assert.match(picker, /if !selection\.isEmpty \{\s*Section\("Archivos seleccionados"\)/);
  assert.doesNotMatch(picker, /Text\("Selecciona archivos de audio en Google Drive para importarlos\."\)/);
});

test('Video progress uses its native adjustable action without a redundant spoken gesture tutorial', () => {
  const player = source('NativeYouTubePlayer.swift');
  assert.match(player, /\.accessibilityAdjustableAction \{ direction in/);
  assert.doesNotMatch(player, /\.accessibilityHint\("Desliza arriba para avanzar diez por ciento/);
});

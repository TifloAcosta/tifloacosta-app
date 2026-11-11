import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const screens = readFileSync(new URL('../Sources/NativeScreens.swift', import.meta.url), 'utf8');

test('Novedades mezclan canales por fecha ISO real antes de paginar', () => {
  assert.match(screens, /private static func publicationDate\(_ text: String\?\) -> Date\?/);
  assert.match(screens, /ISO8601DateFormatter\(\)/);
  assert.match(screens, /Self\.publicationDate\(\$0\.publishedAt\)/);
  assert.match(screens, /Self\.publicationDate\(\$1\.publishedAt\)/);
  const gather = screens.slice(screens.indexOf('private func gather()'), screens.indexOf('private func load(loadMore:', screens.indexOf('private func gather()')));
  assert.match(gather, /\.sorted/);
  assert.match(screens, /collected\.prefix\(visibleCount\)/);
});

test('VoiceOver recibe fecha publicada desde el título del vídeo', () => {
  assert.match(screens, /accessibilityLabel\("\\?\(video\.title\)/);
  assert.match(screens, /Fecha de publicación no disponible/);
  assert.match(screens, /Publicado:/);
});

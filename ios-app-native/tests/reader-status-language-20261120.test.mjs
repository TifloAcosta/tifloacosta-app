import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (name) => readFileSync(new URL(`../Sources/${name}`, import.meta.url), 'utf8');
const reader = source('NativeTifloLector.swift');

test('Reader shortcut, playback and sharing notices are formatted in the selected language', () => {
  const phrases = [
    'Todavía no hay un libro abierto anteriormente para continuar.',
    'Continuando %@ desde la posición guardada.',
    'Apagado automático completado.',
    'No se encuentra la pista de audio.',
    'No hay un archivo disponible para compartir.',
  ];
  for (const phrase of phrases) {
    const bare = phrase.replace('%@', '\\(');
    assert.ok(reader.includes(`MusicLocalized.message("${phrase}")`) || reader.includes(`MusicLocalized.format("${phrase}"`), phrase);
    assert.doesNotMatch(reader, new RegExp('(?:shortcutMessage|actionMessage) = "' + bare.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('Reader status announcements have translations in five additional languages', () => {
  const phrases = [
    'Todavía no hay un libro abierto anteriormente para continuar.',
    'Continuando %@ desde la posición guardada.',
    'Apagado automático completado.',
    'No se encuentra la pista de audio.',
    'No hay un archivo disponible para compartir.',
  ];
  for (const lang of ['en','pt','fr','it','de']) {
    const content = source(`${lang}.lproj/Localizable.strings`);
    for (const key of phrases) assert.ok(content.includes(`"${key}" = `), `${lang}: ${key}`);
  }
});

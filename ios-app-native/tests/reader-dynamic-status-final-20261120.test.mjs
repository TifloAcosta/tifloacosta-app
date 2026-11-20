import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (name) => readFileSync(new URL(`../Sources/${name}`, import.meta.url), 'utf8');

test('Reader navigation and playback states never assign raw Spanish messages', () => {
  const content = read('NativeTifloLector.swift');
  assert.doesNotMatch(content, /actionMessage\s*=\s*"[^"\n]+"/);
  assert.doesNotMatch(content, /actionMessage\s*=\s*"[^"\n]+"\s*\+/);
});

test('Every reader dynamic status format is available in all five translated languages', () => {
  const formats = [
    'Configura la clave Gemini en Motores externos.',
    'Generando el primer fragmento con Gemini. La reproducción comenzará cuando Google devuelva el audio.',
    'Instala el motor y modelo Phonon en Motores externos.',
    'Faltan archivos de audio de esta obra.',
    'No se pudo reproducir: %@',
    'La pista indicada no está disponible.',
    'Selecciona Enlaces en Modo de navegación.',
    'Destino: %@',
    'No hay un enlace disponible en esta posición.',
    'No hay más enlaces en esa dirección.',
    'Enlace: %@',
    'No hay más elementos de ese tipo en esa dirección.',
    'No hay más marcas en esa dirección.',
    'Posición: %d por ciento.',
    'No se pudo exportar: %@',
    'No se pudo compartir: %@',
    'No se pudieron compartir todas las pistas: %@',
  ];
  for (const language of ['en','pt','fr','it','de']) {
    const content = read(`${language}.lproj/Localizable.strings`);
    for (const key of formats) assert.ok(content.includes(`"${key}" = `), `${language}: ${key}`);
  }
});

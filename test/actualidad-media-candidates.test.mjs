import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const text = fs.readFileSync('docs/actualidad-multimedia-candidates.md', 'utf8');
const names = [
  'Actualidad Accesible',
  'Comunidad Tiflotec',
  'ACCYTEC',
  'Android a Ciegas',
  'JAWS con Windows',
  'Juan Roca Suárez',
  'Juanjo Montiel',
  'La Manzana Azteca',
  'Mi Android Accesible',
  'Sin Ver Cómo',
  'TifloDigitales',
  'AliBlueBox',
  'iManu Mx',
  'MarcianoTech',
  'Topes de Gama',
  'Me llaman Geek',
  'ChicaGeek',
  'TuAppleMundo',
  'iSenaCode',
  'Xataka TV',
  'Migue Baena IA',
  'Urban Tecno',
  'Artsloudi',
  'Arroba Sonora',
  'VARELALIA Podcast',
  'SucDePoma',
  'Gafotas, Cegatos y sus Aparatos',
  'Tiflo Audio',
  'Podcast Ilumina'
];

for (const name of names) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.match(text, new RegExp(escaped), `${name} is inventoried`);
}
assert.match(text, /La Manzana Azteca[\s\S]*Automation: program-within-source/);
assert.match(text, /Artsloudi[\s\S]*Status: candidate/);

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const baseSearch = require('../search-accessibility.js');
const contextual = require('../contextual-search.js');

const search = contextual.enhanceSearchApi({ ...baseSearch });

const sources = {
  resources: [
    {
      id: 'calls',
      lang: 'es',
      title: 'Cuando el iPhone deja de sonar',
      category: 'iPhone',
      searchText: 'Modos de concentración, volumen, timbre y notificaciones en llamadas entrantes',
      openUrl: 'calls.html'
    },
    {
      id: 'dictation',
      lang: 'es',
      title: 'Dictado en Windows con puntuación automática',
      category: 'Windows',
      searchText: 'Escribir historias mediante la voz y añadir signos de puntuación',
      openUrl: 'dictation.html'
    },
    {
      id: 'storage',
      lang: 'es',
      title: 'Files de Google, una buena escoba para el almacenamiento de Android',
      category: 'Android',
      searchText: 'Liberar almacenamiento y borrar archivos innecesarios',
      openUrl: 'storage.html'
    },
    {
      id: 'call-en',
      lang: 'en',
      title: 'Fix missing call sounds on iPhone',
      category: 'iPhone',
      searchText: 'Focus modes ringtone volume notifications incoming calls',
      openUrl: 'calls-en.html'
    }
  ],
  videos: [],
  stories: [],
  apps: [],
  media: [],
  videoIndex: { videos: {} }
};

test('contextual search understands a symptom instead of requiring literal words', () => {
  const results = search.searchAcrossSources(sources, 'no me suenan las llamadas', 'es');
  assert.equal(results[0]?.id, 'calls');
});

test('contextual search understands dictation intent with punctuation', () => {
  const results = search.searchAcrossSources(sources, 'quiero dictar historias y que ponga los puntos', 'es');
  assert.equal(results[0]?.id, 'dictation');
});

test('contextual search understands freeing space on Android', () => {
  const results = search.searchAcrossSources(sources, 'como limpio espacio en android', 'es');
  assert.equal(results[0]?.id, 'storage');
});

test('contextual search works in English too', () => {
  const results = search.searchAcrossSources(sources, 'my phone does not ring when someone calls', 'en');
  assert.equal(results[0]?.id, 'call-en');
});

test('literal searches remain precise', () => {
  const results = search.searchAcrossSources(sources, 'Android', 'es');
  assert.deepEqual(results.map(item => item.id), ['storage']);
});

test('the contextual enhancer loads after the existing global search', () => {
  const source = readFileSync(new URL('../app-core.js', import.meta.url), 'utf8');
  const baseIndex = source.indexOf("appendScript('search-accessibility.js?v=1.1'");
  const contextualIndex = source.indexOf("appendScript('contextual-search.js?v=1.0'");
  assert.ok(baseIndex >= 0);
  assert.ok(contextualIndex > baseIndex);
});

test('the home page still contains a single search input', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const searchInputs = html.match(/<input[^>]+id="search"/g) || [];
  assert.equal(searchInputs.length, 1);
});

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const search = require('../search-accessibility.js');

test('global search finds matching content across all TifloAcosta sources', () => {
  const sources = {
    resources: [
      { id:'r-es', lang:'es', title:'Guía de cámara accesible', category:'iPhone', openUrl:'docs/camara.html' },
      { id:'r-en', lang:'en', title:'Accessible camera guide', category:'iPhone', openUrl:'docs/camera.html' }
    ],
    videos: [
      { id:'abcdefghijk', title:'La cámara del iPhone con VoiceOver', description:'Fotografía accesible' }
    ],
    stories: [
      { id:'n1', lang:'es', title:'Nueva cámara accesible', summary:'Mejoras con VoiceOver', sourceName:'TifloAcosta', originalUrl:'https://example.com/noticia' }
    ],
    apps: [
      { id:'a1', lang:'es', title:'Cámara Fácil', summary:'App accesible para hacer fotos', platform:'iOS', originalUrl:'https://example.com/app' }
    ],
    media: [
      { id:'m1', originalLanguage:'es', title:'Podcast sobre cámara y accesibilidad', summary:'Consejos prácticos', sourceName:'Podcast', originalUrl:'https://example.com/audio' }
    ],
    videoIndex: { videos: {} }
  };

  const results = search.searchAcrossSources(sources, 'camara', 'es');
  assert.deepEqual(new Set(results.map(item => item.kind)), new Set(['resource', 'video', 'news', 'app', 'media']));
  assert.equal(results.some(item => item.id === 'r-en'), false);
});

test('global search uses supplemental video metadata and ignores accents', () => {
  const sources = {
    resources: [],
    videos: [{ id:'abcdefghijk', title:'VoiceOver: esa voz es nueva', description:'Nuevas voces' }],
    stories: [],
    apps: [],
    media: [],
    videoIndex: { videos: { abcdefghijk: { keywords:['Runa TTS', 'síntesis de voz'] } } }
  };

  const results = search.searchAcrossSources(sources, 'sintesis runa', 'es');
  assert.deepEqual(results.map(item => item.id), ['abcdefghijk']);
  assert.equal(results[0].href, 'videos.html?video=abcdefghijk');
});

test('blank global search returns no results', () => {
  assert.deepEqual(search.searchAcrossSources({ resources:[] }, '   ', 'es'), []);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inspectContentParity, assertContentParity } from '../shared/content-parity.mjs';
import { readContentInputs } from '../scripts/validate-content-parity.mjs';

const generated = '2026-10-30T12:00:00.000Z';
const resource = {id:'r1',lang:'es',title:'Guía',category:'iPhone',url:'https://tifloacosta.com/r1',new:true,newsDate:'2026-10-29T12:00:00Z'};
const video = {id:'abcdefghijk',title:'Vídeo',publishedAt:'2026-10-29T12:00:00Z',url:'https://www.youtube.com/watch?v=abcdefghijk'};
const sample = () => ({
  resources: [resource], videos: [video],
  feed: {schemaVersion:1,generatedAt:generated,
    resources:[{kind:'resource',id:'r1',lang:'es',title:'Guía',category:'iPhone',url:'https://tifloacosta.com/r1',openUrl:'https://tifloacosta.com/r1',isNew:true,newsDate:'2026-10-29T12:00:00Z'}],
    videos:[{kind:'video',id:'abcdefghijk',title:'Vídeo',publishedAt:'2026-10-29T12:00:00Z',url:'https://www.youtube.com/watch?v=abcdefghijk'}],
    news:[{kind:'news',id:'n1:es',sourceId:'n1',lang:'es',publishedAt:'2026-10-29T12:00:00Z',sourceName:'Medio',originalUrl:'https://medio.es/n1'}]
  }
});

test('un catálogo equivalente no modifica fuentes ni datos', () => {
  const payload=sample();
  assert.deepEqual(assertContentParity(payload),{resources:1,videos:1,news:1});
  assert.equal(payload.resources[0].new,true);
});
test('se bloquea una novedad perdida o con enlace alterado', () => {
  const p=sample();
  p.feed.resources[0].isNew=false;
  p.feed.resources[0].openUrl='https://otro.ejemplo/no';
  assert.match(inspectContentParity(p).join('\n'),/Novedad no coincide/);
  assert.match(inspectContentParity(p).join('\n'),/Enlace de apertura/);
});
test('se bloquean entradas duplicadas, noticias sin fuente y fechas inventadas', () => {
  const p=sample();
  p.feed.videos.push({...p.feed.videos[0]});
  p.feed.news[0].publishedAt='ayer';
  p.feed.news[0].sourceName='';
  const errors=inspectContentParity(p).join('\n');
  assert.match(errors,/duplicado/);
  assert.match(errors,/fecha real/);
  assert.match(errors,/fuente original/);
});
test('catálogo actual: todos los recursos y vídeos públicos están en el feed de las apps', async () => {
  const p=await readContentInputs();
  assertContentParity(p);
});
test('las apps nativas iOS y Android mantienen el mismo contrato sin HTML', async () => {
  const paths=[
    'ios-app-native/Sources/NativeCatalogStore.swift',
    'android-native-prototype/app/src/main/java/com/tifloacosta/nativeprototype/Catalog.kt',
    'mobile/src/core/content-store.mjs'
  ];
  const files=await Promise.all(paths.map(path=>readFile(new URL('../'+path, import.meta.url),'utf8')));
  for (const file of files) {
    assert.match(file,/https:\/\/tifloacosta\.com\/mobile-content\.json/);
    assert.match(file,/schemaVersion/);
  }
});

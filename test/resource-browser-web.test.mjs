import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const core = require('../resource-browser-core.js');
const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');

test('filtra recursos sin alterar el catálogo ni los favoritos existentes', () => {
  const items=[
    { id:'1',title:'Curso de Braille',searchText:'talkback',newsDate:'2026-10-22T00:00:00Z' },
    { id:'2',title:'Guía de iPhone',searchText:'voz',newsDate:'2026-10-23T00:00:00Z' },
    { id:'3',title:'Manuales',searchText:'accesibilidad',newsDate:'2026-10-21T00:00:00Z' }
  ];
  assert.deepEqual(core.filterAndSort(items,'braille','title','es').map(i=>i.id),['1']);
  assert.deepEqual(core.filterAndSort(items,'voz','title','es').map(i=>i.id),['2']);
  assert.deepEqual(core.filterAndSort(items,'','recent','es').map(i=>i.id),['2','1','3']);
  assert.deepEqual(items.map(i=>i.id),['1','2','3']);
});

test('Novedades contiene exclusivamente publicaciones propias con fechas ordenadas', () => {
  const items=[
    { id:'a',lang:'es',title:'Primera',new:true,newsDate:'2026-10-20',url:'https://tifloacosta.com/a' },
    { id:'b',lang:'en',title:'English',new:true,newsDate:'2026-10-23',url:'https://tifloacosta.com/b' },
    { id:'c',lang:'es',title:'Anterior',new:false,newsDate:'2026-10-23',url:'https://tifloacosta.com/c' },
    { id:'d',lang:'es',title:'Última',new:true,newsDate:'2026-10-25',url:'https://tifloacosta.com/d' }
  ];
  assert.deepEqual(core.latestPublications(items,'es').map(i=>i.id),['d','a']);
  assert.deepEqual(core.latestPublications(items,'en').map(i=>i.id),['b']);
});

test('Recursos dispone de controles nativos y Novedades puede mostrar más de tres', () => {
  const h=read('index.html'),a=read('app.js'),sw=read('sw.js');
  for(const id of ['resource-filter','resource-sort','resource-controls','resource-change-category','resource-selected-category','news-load-more','news-intro']) assert.match(h,new RegExp('id="'+id+'"'));
  assert.match(h,/id="resource-filter" type="search"/);
  assert.match(h,/id="resource-sort"/);
  assert.match(h,/id="news-load-more" type="button" hidden/);
  assert.match(a,/resourceBrowser\.filterAndSort\(selected,els\.resourceFilter\.value/);
  assert.match(a,/resourceBrowser\.latestPublications\(data,lang\)/);
  assert.match(a,/shownPublications\+=10/);
  assert.match(a,/els\.resourceFilter\.addEventListener\('input'/);
  assert.match(a,/els\.resourceSort\.addEventListener\('change'/);
  assert.match(sw,/'\.\/resource-browser-core\.js\?v=1\.0'/);
  assert.match(sw,/'\.\/app\.js\?v=2\.7'/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = new URL('../Sources/', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const entries = s => [...s.matchAll(/^"((?:\\.|[^"\\])*)"\s*=\s*"((?:\\.|[^"\\])*)";\s*$/gm)].map(m=>[m[1],m[2]]);
const languages = ['en','fr','de','it','pt'];
const numbers = s => [...s.replace(/%(?:\d+\$)?[-+0-9.]*[a-z@]+/g,'').matchAll(/\d+/g)].map(x=>x[0]).sort().join(',');
test('catalogs preserve numerical literals and contain no duplicate keys', () => {
  for (const lang of languages) {
    const rows = entries(read(lang+'.lproj/Localizable.strings'));
    assert.equal(rows.length,new Map(rows).size,lang+' duplicate keys');
    for (const [key,value] of rows) assert.equal(numbers(value),numbers(key),lang+': '+key);
  }
});
test('instructions refer to the actual localized control labels', () => {
  const guide=read('NativeUsageGuide.swift');
  assert.ok(!guide.includes('guardar en TifloReader'));
  for (const lang of languages) {
    const app=new Map(entries(read(lang+'.lproj/Localizable.strings')));
    for (const key of ['Encabezado: %@. Pulsa Reproducir para escuchar.','%@: %@. Pulsa Reproducir para escuchar.','Posición inicial. Pulsa Reproducir para comenzar.']) {
      assert.ok(app.get(key)?.includes(app.get('Reproducir')),lang+': '+key);
    }
    assert.ok(app.get('Pega un enlace HTTPS válido y pulsa Analizar enlace.')?.includes(app.get('Analizar enlace')),lang+' link analysis');
    assert.ok(app.get('Eliminar de Recibidos')?.includes(app.get('Recibidos')),lang+' received');
    const help=lang==='en'?null:new Map(entries(read(lang+'.lproj/Guide.strings')));
    assert.ok((help?.get('guide.8.paragraph.2')??guide).toLowerCase().includes(app.get('Listas de reproducción').toLowerCase()),lang+' playlists');
    assert.ok((help?.get('guide.8.paragraph.3')??guide).includes(app.get('Detalles del vídeo')),lang+' video details');
  }
});

test('reading-mode descriptions name the actual localized modes and play control', () => {
  const key='Voz: el foco puede comenzar en Reproducir. Visual: lectura manual del texto. Braille: lectura manual del mismo texto con la línea braille conectada a VoiceOver. Los tres modos conservan posición y marcas.';
  for (const lang of languages) {
    const app=new Map(entries(read(lang+'.lproj/Localizable.strings')));
    for (const label of ['Voz','Visual','Braille','Reproducir']) {
      assert.ok(app.get(key)?.includes(app.get(label)),lang+': '+label);
    }
  }
});
test('all guide paragraphs and titles exist in the six languages', () => {
  const guide=read('NativeUsageGuide.swift');
  const sections=[...guide.matchAll(/id: "(\d+)",\s*spanishTitle: "([^"]+)",\s*englishTitle: "([^"]+)",\s*spanishParagraphs: \[([\s\S]*?)\],\s*englishParagraphs: \[([\s\S]*?)\]/g)];
  assert.equal(sections.length,14);
  const expected=[];
  for(const [,id,,,es,en] of sections){
    const count=s=>s.split('\n').filter(l=>l.trim().startsWith('"')).length;
    assert.equal(count(es),count(en),id);
    expected.push('guide.'+id+'.title');
    for(let i=1;i<=count(es);i++)expected.push('guide.'+id+'.paragraph.'+i);
  }
  for(const lang of languages.filter(l=>l!=='en')){
    const rows=entries(read(lang+'.lproj/Guide.strings'));
    const help=new Map(rows);
    assert.equal(rows.length,help.size,lang+' duplicate keys');
    assert.equal(help.size,expected.length,lang+' guide size');
    for(const key of expected)assert.ok(help.get(key)?.trim(),lang+': '+key);
  }
});

test('semantic review preserves localized engine and playback control references', () => {
  for (const lang of languages) {
    const app = new Map(entries(read(lang+'.lproj/Localizable.strings')));
    for (const [key,value] of app) {
      if(key.includes('Motores externos')) assert.ok(value.includes(app.get('Motores externos')),lang+': '+key);
    }
    for (const key of ['Foco inicial en Reproducir','Activado: al abrir el documento, el foco se sitúa en Reproducir. Desactivado: el foco se sitúa en el texto. La voz solo comienza cuando pulsas Reproducir.']) {
      assert.ok(app.get(key)?.includes(app.get('Reproducir')),lang+': '+key);
    }
  }
  const fr = new Map(entries(read('../ShareExtension/Localizations/fr.lproj/Localizable.strings')));
  const hint = fr.get('Audio recibido. Elige Guardar en TifloLector o Guardar en Mi música. Si cierras, quedará pendiente en Recibidos.');
  for(const key of ['Guardar en TifloLector','Guardar en Mi música']) assert.ok(hint?.includes(fr.get(key)),key);
});

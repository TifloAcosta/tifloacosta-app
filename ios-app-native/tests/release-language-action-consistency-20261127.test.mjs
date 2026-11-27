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

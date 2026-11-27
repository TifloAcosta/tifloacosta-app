import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = new URL('../Sources/', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const dict = path => new Map([...read(path).matchAll(/^"((?:\\.|[^"\\])*)"\s*=\s*"((?:\\.|[^"\\])*)";\s*$/gm)].map(m=>[m[1],m[2]]));
test('guide titles match the actual localized section labels, and radio favorite actions are translated', () => {
  const guide=read('NativeUsageGuide.swift');
  const sections=[...guide.matchAll(/id: "(\d+)",\s*spanishTitle: "([^"]+)",\s*englishTitle: "([^"]+)"/g)];
  assert.equal(sections.length,14);
  for(const lang of ['en','fr','de','it','pt']){
    const app=dict(lang+'.lproj/Localizable.strings');
    const help=lang==='en'?null:dict(lang+'.lproj/Guide.strings');
    for(const [,id,spanish,english] of sections){
      assert.equal(help?help.get('guide.'+id+'.title'):english,app.get(spanish),lang+': '+spanish);
    }
    assert.ok(app.has('Guardar favorita'));
    assert.ok(app.has('Quitar de favoritas'));
  }
  assert.ok(read('NativeRadioBrowser.swift').includes('Text(MusicLocalized.message(favorites.contains(where: { $0.id == station.id })'));
  assert.ok(read('NativeAccessibilityReport.swift').includes('catalog.lastUpdated?.formatted(.dateTime'));
});

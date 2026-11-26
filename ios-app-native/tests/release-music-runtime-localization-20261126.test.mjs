import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../Sources/'+p,import.meta.url),'utf8');
test('music backup and repeat modes resolve dynamic messages in the app language',()=>{
const source=read('NativeMyMusic.swift');
for(const key of ["No se pudo preparar el respaldo: %@","No se pudo guardar el destino elegido: %@","No se pudo restablecer el destino interno: %@","No se pudo guardar la copia automática: %@","No se pudo restaurar el índice: %@","No se pudo crear la copia con audio: %@","No se pudo restaurar la copia con audio: %@","Organización restaurada. Canciones sin audio local: %d. Tendrás que importarlas para reproducirlas.","desactivada","toda la lista","una canción"]) {
assert.ok(source.includes('MusicLocalized.message("'+key+'")')||source.includes('MusicLocalized.format("'+key+'"'),key);
for(const lang of ['en','pt','fr','it','de']) assert.ok(read(lang+'.lproj/Localizable.strings').includes('"'+key+'" = '),lang+': '+key);
}
assert.ok(source.includes('MusicLocalized.message(folder.ruleKind.label)'));
});

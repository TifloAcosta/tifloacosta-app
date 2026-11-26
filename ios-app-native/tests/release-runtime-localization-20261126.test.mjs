import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../Sources/'+p,import.meta.url),'utf8');
test('runtime library errors, cloud errors and reading progress use the selected app language',()=>{
 const source=['NativeReaderExternalCatalogs.swift','NativeCloudStorage.swift','NativeTifloLector.swift'].map(read).join('\n');
 for(const key of ["Introduce una dirección HTTPS válida de un catálogo OPDS.","No se ha podido interpretar este catálogo como OPDS 1 o 2.","La biblioteca ha devuelto una respuesta no válida.","El catálogo o el archivo supera el tamaño máximo permitido.","Esta obra no ofrece una descarga directa en un formato que TifloLector pueda leer.","Introduce un nombre válido y una biblioteca que no figure ya en la lista.","Conecta tu cuenta antes de explorar archivos.","La autorización de la nube ha caducado o no permite acceder a este archivo.","No se pudo conectar con el servicio. Comprueba tu conexión.","El archivo ya no está disponible en esa ubicación.","El servicio de nube devolvió una respuesta no reconocida.","El archivo supera el límite de importación de 250 MB.","Selecciona un archivo musical compatible.","Posición %d","Leído %d por ciento. Falta %d por ciento.","Pista %d de %d. Escuchado %d por ciento de esta pista; falta %d por ciento.","La duración de audio se mostrará al iniciar la pista.","Tiempo realizado %@. Tiempo restante %@.","Voz reproducida %@. Tiempo restante estimado %@."]) {
   assert.ok(source.includes('MusicLocalized.message("'+key+'")') || source.includes('MusicLocalized.format("'+key+'"'),key);
   for(const lang of ['en','pt','fr','it','de']) assert.ok(read(lang+'.lproj/Localizable.strings').includes('"'+key+'" = '),lang+': '+key);
 }
});

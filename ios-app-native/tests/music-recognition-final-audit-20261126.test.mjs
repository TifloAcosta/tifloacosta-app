import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = n => readFileSync(new URL('../Sources/'+n,import.meta.url),'utf8');
const music = read('NativeMyMusic.swift');
const recognition = read('NativeMusicRecognition.swift');
test('recognition protects account changes and edits during asynchronous lookup',()=>{
  assert.match(recognition,/guard try NativeAcoustIDKeychain.read\(\.active\) == user/);
  assert.match(music,/recognizingTrackIDs.insert\(id\).inserted/);
  assert.match(music,/hasEditedTrackInformation == current.hasEditedTrackInformation/);
  assert.match(music,/UserDefaults.standard.bool\(forKey: "mi-musica-acoustid-auto"\)/);
});
test('recognition reports partial progress and cancellation in all languages',()=>{
  assert.match(music,/identifyBatch\(ids, onProgress:/);
  assert.match(music,/recognitionMatched, recognitionTotal, recognitionFailed/);
  assert.match(music,/ProgressView\(value: Double\(recognitionCompleted\)/);
  for(const lang of ['en','de','fr','it','pt']) {
    const strings=read(lang+'.lproj/Localizable.strings');
    for(const key of ["Identificación cancelada.","La cuenta de AcoustID debe volver a vincularse.","No se pudo completar la identificación.","Procesadas: %d de %d."]) assert.ok(strings.includes('"'+key+'" = '),lang+': '+key);
  }
});

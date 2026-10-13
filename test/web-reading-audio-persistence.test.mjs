import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createWebReadingLibraryAdapter } from '../shared/web-reading-library-adapter.mjs';

// Minimal asynchronous IndexedDB double: native writes retain old records
// and a new media store is added without clearing documents or marks.
function memoryDatabase(existing = {}) {
  const stores = new Map(Object.entries(existing).map(([name, rows]) =>
    [name, new Map(rows.map(row => [row.id ?? row.key, row]))]));
  const database = {
    objectStoreNames: { contains: name => stores.has(name) },
    createObjectStore(name) {
      if (!stores.has(name)) stores.set(name, new Map());
    },
    transaction(name) {
      const transaction = {
        oncomplete: null,
        onerror: null,
        onabort: null,
        objectStore(storeName) {
          const data = stores.get(storeName);
          if (!data) throw new Error('missing store ' + storeName);
          return {
            get(key) {
              const request = {};
              queueMicrotask(() => {
                request.result = data.get(key);
                request.onsuccess?.();
                queueMicrotask(() => transaction.oncomplete?.());
              });
              return request;
            },
            getAll() {
              const request = {};
              queueMicrotask(() => {
                request.result = [...data.values()];
                request.onsuccess?.();
                queueMicrotask(() => transaction.oncomplete?.());
              });
              return request;
            },
            put(value) {
              data.set(value.id ?? value.key, value);
              queueMicrotask(() => transaction.oncomplete?.());
            },
            delete(key) {
              data.delete(key);
              queueMicrotask(() => transaction.oncomplete?.());
            }
          };
        }
      };
      return transaction;
    }
  };
  return {
    stores,
    open(name, version) {
      assert.equal(name, 'tifloacosta-reading-web');
      assert.equal(version, 2, 'Additive migration must increment the same DB version');
      const request = {};
      queueMicrotask(() => {
        request.result = database;
        request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    }
  };
}

test('MP3 binary survives reload, saves precise position, exports and deletes without losing old books', async () => {
  const db = memoryDatabase({
    books: [{ id: 'old-book', title: 'Documento antiguo', format: 'txt', content: 'Texto', state: 'not-read' }],
    marks: [{ id: 'old-mark', bookId: 'old-book', type: 'bookmark' }],
    settings: [{ key: 'global', values: { 'speech.rate': '1.25' } }],
    derived: []
  });
  const adapter = createWebReadingLibraryAdapter({ indexedDB: db, now: () => 2000 });
  const original = new Blob([Uint8Array.from([73, 68, 51, 3, 4, 0, 0, 0])], { type: 'audio/mpeg' });
  const saved = await adapter.importAudioFile({ file: original, title: 'Audiolibro.mp3', language: 'es' });
  assert.equal(saved.format, 'audio');
  assert.equal(saved.sizeBytes, original.size);
  const opened = await adapter.openAudioFile(saved.id);
  assert.equal(opened.blob.size, original.size);
  assert.deepEqual(new Uint8Array(await opened.blob.arrayBuffer()), new Uint8Array(await original.arrayBuffer()));
  assert.equal((await adapter.openBook('old-book')).content, 'Texto');
  assert.equal((await adapter.listMarks({ bookId: 'old-book' })).length, 1);
  assert.equal((await adapter.getReadingSettings()).global['speech.rate'], '1.25');
  const bookmark = await adapter.addMark({
    bookId: saved.id, type: 'bookmark', mediaTrackIndex: 0,
    mediaPositionMs: 45000, reference: '0:45', excerpt: 'Audiolibro.mp3'
  });
  assert.equal(bookmark.added, true);
  const audioBookmarks = await adapter.listMarks({ bookId: saved.id });
  assert.equal(audioBookmarks.length, 1);
  assert.equal(audioBookmarks[0].mediaPositionMs, 45000);

  assert.deepEqual(await adapter.saveProgress({
    id: saved.id, mediaTrackIndex: 0, mediaPositionMs: 123456,
    percent: 17.25, state: 'in-reading'
  }), { saved: true });

  const reloaded = createWebReadingLibraryAdapter({ indexedDB: db });
  const resume = await reloaded.openAudioFile(saved.id);
  assert.equal(resume.book.mediaPositionMs, 123456);
  assert.equal(resume.book.percent, 17.25);
  assert.equal((await reloaded.listBooks()).total, 2);
  assert.deepEqual(await reloaded.deleteBook(saved.id), { deleted: true });
  assert.equal(await reloaded.openAudioFile(saved.id), null);
  assert.equal(db.stores.get('media').size, 0);
  assert.equal((await reloaded.listMarks({ bookId: saved.id })).length, 0);
  assert.equal((await reloaded.openBook('old-book')).content, 'Texto');
});

test('audio storage rejects empty blobs without inserting unplayable books', async () => {
  const db = memoryDatabase();
  const adapter = createWebReadingLibraryAdapter({ indexedDB: db });
  assert.equal(await adapter.importAudioFile({ file: new Blob([]) }), null);
  assert.equal(await adapter.openAudioFile('missing'), null);
  assert.equal((await adapter.listBooks()).total, 0);
});

test('packaged reader supports direct MP3 reopening and precise bookmark-free resume without a new picker', async () => {
  const [web, html, store, build] = await Promise.all([
    readFile(new URL('../web-reading.js', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../shared/web-reading-library-adapter.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../ios-build/prepare-web.mjs', import.meta.url), 'utf8')
  ]);
  assert.match(html, /id="reading-file"[^>]+\.mp3/);
  for (const symbol of ['importAudioFile', 'openAudioFile', 'persistPosition', 'mediaPositionMs',
    'restoreAudioPosition', 'await useMp3File(savedAudio.blob', 'downloadExport(savedAudio.blob',
    'reading-audio-marks-controls', 'Marcar posición del audio', 'mark.mediaPositionMs']) {
    assert.ok(web.includes(symbol), 'Missing audio path ' + symbol);
  }
  assert.match(store, /DB_VERSION = 2/);
  assert.match(store, /createObjectStore\('media'/);
  assert.match(store, /await remove\('media', bookId\)/);
  assert.match(build, /BLOQUEO PREVENTIVO iOS/);
});


test('DAISY compressed archive survives relaunch with exact SMIL index/time and without losing original documents', async () => {
  const db = memoryDatabase({
    books:[{id:'old-document',title:'Anterior',format:'txt',content:'No borrar'}],
    marks:[{id:'old-mark',bookId:'old-document',type:'bookmark'}],
    derived:[{key:'old-translation',bookId:'old-document',content:'Hola'}],
    settings:[{key:'general',value:'persist'}]
  });
  const first = createWebReadingLibraryAdapter({ indexedDB: db, now:()=>5000 });
  const compressed = new Blob([Uint8Array.from([80,75,3,4,1,2,3,4])], {type:'application/zip'});
  const stored = await first.importDaisyArchive({file:compressed,title:'Un DAISY',language:'es',format:'daisy2.02'});
  assert.equal(stored.format, 'daisy2.02');
  assert.equal(stored.sizeBytes, 8);
  assert.equal((await first.openBook(stored.id)).content, '');
  assert.deepEqual(await first.saveProgress({
    id:stored.id,mediaTrackIndex:4,mediaPositionMs:188250,percent:37.5,state:'in-reading'
  }),{saved:true});
  const mark = await first.addMark({
    bookId:stored.id,type:'bookmark',mediaTrackIndex:4,mediaPositionMs:188250,
    reference:'Segmento 5, 3:08'
  });
  assert.equal(mark.added,true);
  const second = createWebReadingLibraryAdapter({ indexedDB:db });
  const opened = await second.openDaisyArchive(stored.id);
  assert.equal(opened.book.mediaTrackIndex,4);
  assert.equal(opened.book.mediaPositionMs,188250);
  assert.equal(opened.book.percent,37.5);
  assert.deepEqual(new Uint8Array(await opened.blob.arrayBuffer()),
    new Uint8Array(await compressed.arrayBuffer()));
  assert.equal((await second.listMarks({bookId:stored.id}))[0].mediaTrackIndex,4);
  assert.equal((await second.openBook('old-document')).content,'No borrar');
  assert.equal(db.stores.get('derived').size,1);
  assert.deepEqual(await second.deleteBook(stored.id), {deleted:true});
  assert.equal(await second.openDaisyArchive(stored.id),null);
  assert.equal((await second.listMarks({bookId:stored.id})).length,0);
  assert.equal((await second.openBook('old-document')).content,'No borrar');
  assert.equal(db.stores.get('derived').size,1);
});



test('editable notes preserve existing highlights, marks and old documents after reopening', async () => {
  const db = memoryDatabase({
    books:[{id:'book-1',title:'Libro previo',format:'txt',content:'Párrafo de prueba'}],
    marks:[{id:'old-highlight',bookId:'book-1',type:'important',blockIndex:0,excerpt:'Párrafo de prueba'}],
    derived:[],settings:[]
  });
  const first = createWebReadingLibraryAdapter({indexedDB:db});
  const created = await first.addMark({
    bookId:'book-1',type:'review',blockIndex:0,reference:'Bloque 1',note:'Recordar el pasaje'
  });
  assert.equal(created.added,true);
  assert.equal(created.mark.note,'Recordar el pasaje');
  const revised = await first.updateMark({
    id:created.mark.id,bookId:'book-1',note:'Nota corregida, sin alterar el original'
  });
  assert.equal(revised.updated,true);
  assert.equal((await first.updateMark({
    id:created.mark.id,bookId:'otro-libro',note:'Acceso indebido'
  })).updated,false);
  const afterReload = createWebReadingLibraryAdapter({indexedDB:db});
  const marks = await afterReload.listMarks({bookId:'book-1'});
  assert.equal(marks.length,2);
  assert.equal(marks.find(mark=>mark.id===created.mark.id).note,
    'Nota corregida, sin alterar el original');
  assert.equal(marks.find(mark=>mark.id==='old-highlight').type,'important');
  assert.equal((await afterReload.openBook('book-1')).content,'Párrafo de prueba');
});

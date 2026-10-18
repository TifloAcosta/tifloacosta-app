import test from 'node:test';
import assert from 'node:assert/strict';
import { createIosLegacyReadingBridge } from '../src/core/ios-legacy-reading.mjs';

function picker(filename = 'ejemplo.txt') {
  return {
    pickDocument: async () => ({
      cancelled: false, name: filename, uri: 'file:///private/tmp/' + filename
    })
  };
}

function fromBlob(blob, onFetch = () => {}) {
  return async url => {
    onFetch(url);
    return { ok: true, blob: async () => blob };
  };
}

test('constructing the iOS adapter never reads, deletes or copies existing library data', () => {
  const operations = [];
  const library = new Proxy({}, {
    get(_object, key) {
      operations.push(key);
      return () => { throw Error('unexpected database call'); };
    }
  });
  createIosLegacyReadingBridge({ library });
  assert.deepEqual(operations, []);
});

test('iOS bridge preserves exact legacy book IDs and delegates stored marks, queue and settings', async () => {
  const calls = [];
  const library = {
    listBooks: async options => {
      calls.push(['listBooks', options]);
      return { items: [{ id: 'web-book-legacy', title: 'Mi libro' }], total: 1, page: 1, pageSize: 10 };
    },
    openBook: async id => {
      calls.push(['openBook', id]);
      return { book: { id, title: 'Mi libro', format: 'txt' }, content: 'Contenido guardado' };
    },
    listQueue: async () => [{ id: 'web-book-legacy', queueIndex: 0 }],
    listMarks: async ({ bookId }) => [{ id: 'web-mark-1', bookId }],
    getReadingSettings: async ({ bookId }) => ({ global: { 'speech.rate': '1.2' }, book: { bookId } }),
    saveProgress: async progress => { calls.push(['saveProgress', progress]); return { saved: true }; }
  };
  const bridge = createIosLegacyReadingBridge({ library });
  assert.equal((await bridge.listBooks({ page: 1 })).items[0].id, 'web-book-legacy');
  assert.equal((await bridge.openBook('web-book-legacy')).content, 'Contenido guardado');
  assert.equal((await bridge.listQueue())[0].id, 'web-book-legacy');
  assert.equal((await bridge.listMarks({ bookId: 'web-book-legacy' }))[0].id, 'web-mark-1');
  assert.equal((await bridge.getReadingSettings({ bookId: 'web-book-legacy' })).global['speech.rate'], '1.2');
  await bridge.saveProgress({ id: 'web-book-legacy', percent: 55 });
  assert.deepEqual(calls.at(-1), ['saveProgress', { id: 'web-book-legacy', percent: 55 }]);
});

test('iPhone Files imports TXT into original storage, preserving its full text', async () => {
  let imported = null;
  const bridge = createIosLegacyReadingBridge({
    library: {
      importDocument: async payload => {
        imported = payload;
        return { id: 'web-book-new', title: payload.title, format: payload.format };
      }
    },
    accessibility: picker('Mi documento.txt'),
    capacitor: { convertFileSrc: uri => 'capacitor://localhost/local/' + encodeURIComponent(uri) },
    readFile: fromBlob(new Blob(['Primera línea\nSegunda línea'], { type: 'text/plain' }))
  });
  const batch = await bridge.pickDocuments();
  assert.equal(batch.imported[0].id, 'web-book-new');
  assert.equal(imported.title, 'Mi documento');
  assert.equal(imported.format, 'txt');
  assert.equal(imported.content, 'Primera línea\nSegunda línea');
});

test('iOS MP3 stores Blob bytes through original media database without string conversion', async () => {
  let imported = null;
  const bridge = createIosLegacyReadingBridge({
    library: {
      importAudioFile: async payload => {
        imported = payload;
        return { id: 'web-audio-existing-format', title: payload.title, format: 'audio' };
      }
    },
    accessibility: picker('Grabación.mp3'),
    capacitor: { convertFileSrc: uri => uri },
    readFile: fromBlob(new Blob([new Uint8Array([0, 255, 4, 254])]))
  });
  const batch = await bridge.pickDocuments();
  assert.equal(batch.imported[0].format, 'audio');
  assert.equal(imported.file.type, 'audio/mpeg');
  assert.deepEqual([...new Uint8Array(await imported.file.arrayBuffer())], [0, 255, 4, 254]);
});

test('unsupported EPUB is rejected before any read, never acknowledged or silently saved', async () => {
  let fileRead = false;
  let fileWritten = false;
  const bridge = createIosLegacyReadingBridge({
    library: { importDocument: async () => { fileWritten = true; } },
    accessibility: picker('Libro.epub'),
    capacitor: { convertFileSrc: uri => uri },
    readFile: async () => { fileRead = true; throw Error('unreachable'); }
  });
  const batch = await bridge.pickDocuments();
  assert.deepEqual(batch.imported, []);
  assert.equal(batch.rejected[0].name, 'Libro.epub');
  assert.equal(fileRead, false);
  assert.equal(fileWritten, false);
});

test('cancelled iOS Files sheet does not import, delete or create books', async () => {
  const bridge = createIosLegacyReadingBridge({
    library: { importDocument: () => { throw Error('must not import'); } },
    accessibility: { pickDocument: async () => ({ cancelled: true }) },
    capacitor: { convertFileSrc: uri => uri }
  });
  const batch = await bridge.pickDocuments();
  assert.equal(batch.cancelled, true);
  assert.deepEqual(batch.imported, []);
  assert.deepEqual(batch.rejected, []);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createIosLegacyReadingBridge } from '../src/core/ios-legacy-reading.mjs';
import { createReadingLibraryClient } from '../../shared/reading-library-client.mjs';

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
      },
      openBook: async id => ({ book: { id }, content: imported.content })
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
      },
      openBook: async id => ({ book: { id }, content: '' }),
      openAudioFile: async id => ({ book: { id }, blob: imported.file })
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

test('invalid EPUB is rejected after inspection without creating a book', async () => {
  let fileWritten = false;
  const bridge = createIosLegacyReadingBridge({
    library: { importBinaryDocument: async () => { fileWritten = true; } },
    accessibility: picker('Libro.epub'),
    capacitor: { convertFileSrc: uri => uri },
    readFile: fromBlob(new Blob(['invalid epub archive'])),
    decodeArchive: async () => { throw Object.assign(Error('invalid'), { code: 'invalid-epub' }); }
  });
  const batch = await bridge.pickDocuments();
  assert.deepEqual(batch.imported, []);
  assert.equal(batch.rejected[0].name, 'Libro.epub');
  assert.equal(fileWritten, false);
});

test('iOS EPUB keeps original ZIP bytes and exposes decoded chapters to the reader', async () => {
  const original = new Blob([new Uint8Array([0x50, 0x4b, 0x03, 0x04, 65])]);
  let stored;
  const library = {
    importBinaryDocument: async value => {
      stored = value;
      return { id: 'web-binary-epub', title: value.title, format: 'epub' };
    },
    openBook: async id => ({ book: { id, format: 'epub', title: 'Libro' }, content: stored.content }),
    openBinaryDocument: async id => ({ book: { id }, blob: stored.file })
  };
  const bridge = createIosLegacyReadingBridge({
    library, accessibility: picker('Libro.epub'), capacitor: { convertFileSrc: uri => uri },
    readFile: fromBlob(original),
    decodeArchive: async () => ({ format: 'epub', title: 'Libro', language: 'es',
      content: JSON.stringify({ blocks: [{ type: 'paragraph', text: 'Capítulo primero' }] }) })
  });
  const batch = await bridge.pickDocuments();
  assert.equal(batch.imported[0].id, 'web-binary-epub');
  assert.equal(JSON.parse((await bridge.openBook(batch.imported[0].id)).content).blocks[0].text, 'Capítulo primero');
  assert.deepEqual([...new Uint8Array(await stored.file.arrayBuffer())],
    [...new Uint8Array(await original.arrayBuffer())]);
});

test('PDF scan retains all pages and offers OCR without changing prior records', async () => {
  const pdf = new Blob(['%PDF-1.7\\nresto']);
  let saved;
  const bridge = createIosLegacyReadingBridge({
    library: {
      importBinaryDocument: async value => { saved = value; return { id: 'web-pdf-1', format: 'pdf', title: 'Escaneado' }; },
      openBook: async id => ({ book: { id, format: 'pdf', title: 'Escaneado' }, content: '' }),
      openBinaryDocument: async id => ({ book: { id }, blob: saved.file })
    },
    accessibility: { ...picker('Escaneado.pdf'),
      recognizePdfPage: async payload => ({ status: 'ok', text: 'Texto reconocido', blocks: ['Texto reconocido'] }) },
    capacitor: { convertFileSrc: uri => uri }, readFile: fromBlob(pdf),
    decodePdf: async () => ({ pdfNoText: true, pageCount: 3 })
  });
  const batch = await bridge.pickDocuments();
  assert.equal(batch.imported[0].id, 'web-pdf-1');
  const opened = await bridge.openBook('web-pdf-1');
  assert.equal(opened.pdfNoText, true);
  assert.equal(opened.pageCount, 3);
  const recognized = await bridge.recognizePdfPage({ bookId: 'web-pdf-1', pageIndex: 1 });
  assert.equal(recognized.status, 'ok');
  assert.equal(recognized.text, 'Texto reconocido');
});

test('DAISY archive is persisted with bytes intact and reopens as structured reading text', async () => {
  const archive = new Blob([new Uint8Array([80, 75, 3, 4, 88])]);
  let stored;
  const decodeArchive = async () => ({ format: 'daisy2.02', title: 'Audio y texto',
    content: JSON.stringify({ blocks: [{ type: 'heading', text: 'Capítulo 1' }], containsAudio: true }) });
  const bridge = createIosLegacyReadingBridge({
    library: {
      importDaisyArchive: async value => { stored = value; return { id: 'web-daisy-1', title: value.title, format: value.format }; },
      openBook: async id => ({ book: { id, title: 'Audio y texto', format: 'daisy2.02' }, content: '' }),
      openDaisyArchive: async id => ({ book: { id }, blob: stored.file })
    },
    accessibility: picker('Libro.zip'), capacitor: { convertFileSrc: uri => uri },
    readFile: fromBlob(archive), decodeArchive
  });
  const batch = await bridge.pickDocuments();
  assert.equal(batch.imported[0].format, 'daisy2.02');
  assert.equal(stored.format, 'daisy2.02');
  const opened = await bridge.openBook('web-daisy-1');
  assert.equal(JSON.parse(opened.content).blocks[0].text, 'Capítulo 1');
});

test('binary EPUB with damaged stored bytes is not acknowledged', async () => {
  const good = new Blob([new Uint8Array([80, 75, 11, 12])]);
  const bad = new Blob([new Uint8Array([80, 75, 11, 99])]);
  const bridge = createIosLegacyReadingBridge({
    library: {
      importBinaryDocument: async () => ({ id: 'web-damaged', format: 'epub' }),
      openBook: async id => ({ book: { id, format: 'epub' }, content: '{}' }),
      openBinaryDocument: async id => ({ book: { id }, blob: bad })
    },
    accessibility: picker('Novela.epub'), capacitor: { convertFileSrc: uri => uri },
    readFile: fromBlob(good),
    decodeArchive: async () => ({ format: 'epub', content: '{"blocks":[{"text":"X"}]}' })
  });
  const result = await bridge.pickDocuments();
  assert.equal(result.imported.length, 0);
  assert.match(result.rejected[0].reason, /readback-integrity-failed/);
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


test('existing iOS PDF text remains readable through new mobile PDF page contract without storage changes', async () => {
  const operations = [];
  const legacy = {
    openBook: async id => {
      operations.push(['openBook', id]);
      return { book: { id, format: 'pdf', title: 'PDF antiguo', percent: 57,
        author: 'Autor', language: 'es' }, content: 'Página inicial' + String.fromCharCode(12) + 'Página final' };
    }
  };
  const client = createReadingLibraryClient(createIosLegacyReadingBridge({ library: legacy }));
  const result = await client.openBook('web-book-pdf-old');
  assert.equal(result.book.id, 'web-book-pdf-old');
  assert.equal(result.book.percent, 57);
  assert.equal(result.pdf.pageCount, 2);
  assert.equal(result.pdf.orderReliable, false);
  assert.deepEqual(result.pdf.pages, [
    { number: 1, text: 'Página inicial' },
    { number: 2, text: 'Página final' }
  ]);
  assert.deepEqual(operations, [['openBook', 'web-book-pdf-old']]);
});

test('empty legacy PDF does not masquerade as successfully extracted text or change data', async () => {
  const client = createReadingLibraryClient(createIosLegacyReadingBridge({
    library: { openBook: async id => ({ book: { id, format: 'pdf', title: 'Escaneado' }, content: '' }) }
  }));
  const opened = await client.openBook('web-book-pdf-scan');
  assert.equal(opened.book.id, 'web-book-pdf-scan');
  assert.equal(opened.pdfNoText, true);
  assert.equal(opened.pageCount, 0);
});

test('iOS Files never claims a successful text import when readback differs', async () => {
  const bridge = createIosLegacyReadingBridge({
    library: {
      importDocument: async () => ({ id: 'web-book-truncated' }),
      openBook: async id => ({ book: { id }, content: 'Texto fallido' })
    },
    accessibility: picker('Documento.txt'),
    capacitor: { convertFileSrc: uri => uri },
    readFile: fromBlob(new Blob(['Texto original']))
  });
  const batch = await bridge.pickDocuments();
  assert.equal(batch.imported.length, 0);
  assert.equal(batch.rejected[0].name, 'Documento.txt');
});

test('iOS Files detects corrupt MP3 even when readback size matches', async () => {
  const original = new Blob([new Uint8Array([10, 20, 30, 40])]);
  const damaged = new Blob([new Uint8Array([10, 99, 30, 40])]);
  const bridge = createIosLegacyReadingBridge({
    library: {
      importAudioFile: async () => ({ id: 'web-audio-damaged' }),
      openBook: async id => ({ book: { id } }),
      openAudioFile: async id => ({ book: { id }, blob: damaged })
    },
    accessibility: picker('Grabación.mp3'),
    capacitor: { convertFileSrc: uri => uri },
    readFile: fromBlob(original)
  });
  const batch = await bridge.pickDocuments();
  assert.deepEqual(batch.imported, []);
  assert.equal(batch.rejected[0].name, 'Grabación.mp3');
});

test('iOS Files cannot claim success when the imported book cannot be reopened', async () => {
  const bridge = createIosLegacyReadingBridge({
    library: {
      importDocument: async () => ({ id: 'web-book-incomplete' }),
      openBook: async () => null
    },
    accessibility: picker('Anotaciones.txt'),
    capacitor: { convertFileSrc: uri => uri },
    readFile: fromBlob(new Blob(['Conservar']))
  });
  const batch = await bridge.pickDocuments();
  assert.deepEqual(batch.imported, []);
  assert.equal(batch.rejected.length, 1);
});

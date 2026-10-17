import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../ios-share-inbox.js', import.meta.url), 'utf8');
const prep = readFileSync(new URL('../prepare-web.mjs', import.meta.url), 'utf8');

function createHarness({ contents, saveOK = true, confirmation = true, fetchedMime = '', fetchFails = false, openFails = false, videoTitle = '' } = {}) {
  const create = (tag = 'div') => {
    const element = {
      tag, id: '', hidden: false, children: [], className: '', textContent: '',
      disabled: false, handlers: {}, attributes: {},
      setAttribute(k, v) { this.attributes[k] = v; },
      getAttribute(k) { return this.attributes[k]; },
      addEventListener(k, fn) { this.handlers[k] = fn; },
      append(...nodes) { this.children.push(...nodes); },
      replaceChildren(...nodes) { this.children = nodes; },
      focus() {}, before() {}, after() {}
    };
    return element;
  };
  const screen = create('section');
  const heading = create('h2');
  const list = create('div');
  const status = create('p');
  const reader = create('section');
  reader.hidden = true;
  const nodes = {
    'ios-received-section': screen,
    'ios-received-heading': heading,
    'ios-received-list': list,
    'ios-received-status': status,
    'reading-section': reader
  };
  const document = {
    readyState: 'complete',
    documentElement: { lang: 'es' },
    createElement: create,
    addEventListener() {},
    getElementById(id) { return nodes[id] || null; }
  };
  const files = contents || [{
    id: '123e4567-e89b-12d3-a456-426614174001',
    kind: 'file', name: 'Libro.epub', preview: '', createdAt: '2026-10-17T10:00:00Z'
  }];
  const events = [];
  let savedFile = null;
  const bytes = Buffer.from('file bytes');
  const native = {
    async pending() { return { items: files.slice() }; },
    async openItem({ id }) {
      events.push('open');
      if (openFails) throw new Error('No se puede preparar el archivo');
      const item = files.find(value => value.id === id);
      return {
        id, kind: item.kind, name: item.name,
        uri: 'file:///received', contentType: item.contentType || '', value: item.preview || ''
      };
    },
    async acknowledge({ id }) {
      events.push('ack');
      const index = files.findIndex(item => item.id === id);
      if (index >= 0) files.splice(index, 1);
      return { acknowledged: true };
    },
    async openURL() { events.push('web'); return { opened: true }; },
    async readItemChunk({ offset }) {
      events.push('chunk');
      const part = bytes.subarray(offset);
      return { data: part.toString('base64'), nextOffset: bytes.length,
        size: bytes.length, done: true, contentType: fetchedMime };
    },
    async resolveYouTubeTitle() { return { title: videoTitle }; }
  };
  const youtube = {
    async open() { events.push('youtube'); }
  };
  const location = {
    _hash: '',
    get hash() { return this._hash; },
    set hash(value) {
      this._hash = value;
      reader.hidden = value !== '#reading';
    }
  };
  const window = {
    Capacitor: {
      Plugins: { TifloShareInbox: native, TifloYouTube: youtube },
      convertFileSrc: () => 'https://local.example/received'
    },
    confirm() { events.push('confirm'); return confirmation; },
    TifloIOSBookActions: {
      async readSharedFile() { events.push('read'); return { opened: true }; },
      async importSharedFile(file) {
        savedFile = file;
        events.push('save');
        return saveOK ? { saved: true, id: 'persisted-id' } : { saved: false };
      }
    },
    addEventListener() {}
  };
  runInNewContext(source, {
    window, document, location, URL, File, Blob, Event, atob,
    MutationObserver: class { observe() {} disconnect() {} },
    fetch: async () => {
      if (fetchFails) throw new Error('Failed to fetch local file');
      return { ok: true, blob: async () => new Blob(['file bytes'], { type: fetchedMime }) };
    },
    setTimeout: () => 1, clearTimeout() {}
  });
  async function settle() {
    for (let index = 0; index < 5; index++) await new Promise(resolve => setImmediate(resolve));
  }
  async function tap(label) {
    await settle();
    const cards = list.children.filter(node => node.className === 'ios-received-item');
    assert.ok(cards.length, 'Recibidos debe mostrar al menos un elemento');
    const controls = cards[0].children[0].children[1].children;
    const button = controls.find(node => node.textContent === label);
    assert.ok(button, 'Acción no encontrada: ' + label);
    button.handlers.click();
    await settle();
  }
  return { window, location, files, events, list, status, settle, tap, savedFile: () => savedFile };
}

test('Clasificación: audio no es enlace, EPUB no es vídeo, YouTube no es TXT', () => {
  const h = createHarness();
  const route = h.window.TifloIOSShareInbox;
  assert.equal(route.kindOf({ kind: 'file', name: 'audio.mp3' }), 'audio');
  assert.equal(route.kindOf({ kind: 'file', name: 'audiolibro.m4a' }), 'audio');
  assert.equal(route.kindOf({ kind: 'file', name: 'Libro.epub',
    preview: 'https://youtu.be/dQw4w9WgXcQ' }), 'document');
  assert.equal(route.kindOf({ kind: 'text', preview: 'https://youtu.be/dQw4w9WgXcQ' }), 'youtube');
  assert.equal(route.kindOf({ kind: 'text', preview: 'Una nota' }), 'text');
  assert.equal(route.youtubeId('https://youtube.com.falso.org/watch?v=dQw4w9WgXcQ'), '');
});

test('EPUB: Leer no guarda ni elimina y navega al lector existente', async () => {
  const h = createHarness();
  await h.tap('Leer ahora');
  assert.deepEqual(h.events, ['open', 'read']);
  assert.equal(h.files.length, 1);
  assert.equal(h.location.hash, '#reading');
});

test('EPUB: guardar exige ID confirmado y después retira el recibido', async () => {
  const h = createHarness();
  await h.tap('Guardar en biblioteca');
  assert.deepEqual(h.events, ['open', 'save', 'ack']);
  assert.equal(h.files.length, 0);
});

test('EPUB: fallar importación conserva el original para reintentar', async () => {
  const h = createHarness({ saveOK: false });
  await h.tap('Guardar en biblioteca');
  assert.deepEqual(h.events, ['open', 'save']);
  assert.equal(h.files.length, 1);
  assert.match(h.status.textContent, /conserva|permanece|original/i);
});

test('Audio: Escuchar utiliza lector existente sin importar ni borrar', async () => {
  const h = createHarness({ contents: [{
    id: '123e4567-e89b-12d3-a456-426614174001',
    kind: 'file', name: 'Grabacion.mp3', createdAt: '2026-10-17T10:00:00Z'
  }] });
  await h.tap('Escuchar');
  assert.deepEqual(h.events, ['open', 'read']);
  assert.equal(h.files.length, 1);
});

test('MP3 real compartido: conserva audio/mpeg aunque la ruta local anuncie binario genérico', async () => {
  const h = createHarness({ fetchedMime: 'application/octet-stream', contents: [{
    id: '123e4567-e89b-12d3-a456-426614174001',
    kind: 'file', name: 'Potaje en audio.mp3',
    contentType: 'application/octet-stream', createdAt: '2026-10-17T10:00:00Z'
  }] });
  await h.tap('Guardar audio en biblioteca');
  assert.equal(h.savedFile()?.name, 'Potaje en audio.mp3');
  assert.equal(h.savedFile()?.type, 'audio/mpeg');
  assert.deepEqual(h.events, ['open', 'save', 'ack']);
  assert.equal(h.files.length, 0);
});

test('MP3: sin guardado verificable el original permanece en Recibidos', async () => {
  const h = createHarness({ saveOK: false, fetchedMime: 'application/octet-stream', contents: [{
    id: '123e4567-e89b-12d3-a456-426614174001',
    kind: 'file', name: 'Prueba.mp3', createdAt: '2026-10-17T10:00:00Z'
  }] });
  await h.tap('Guardar audio en biblioteca');
  assert.equal(h.savedFile()?.type, 'audio/mpeg');
  assert.deepEqual(h.events, ['open', 'save']);
  assert.equal(h.files.length, 1);
});

test('MP3 existente: el puente nativo recupera los bytes cuando WKWebView rechaza file://', async () => {
  const h = createHarness({ fetchFails: true, contents: [{
    id: '123e4567-e89b-12d3-a456-426614174001',
    kind: 'file', name: 'Grabación original.mp3',
    createdAt: '2026-10-17T10:00:00Z'
  }] });
  await h.tap('Guardar audio en biblioteca');
  assert.equal(h.savedFile()?.type, 'audio/mpeg');
  assert.equal(h.savedFile()?.size, Buffer.byteLength('file bytes'));
  assert.deepEqual(h.events, ['open', 'chunk', 'save', 'ack']);
  assert.equal(h.files.length, 0);
});

test('MP3 ya recibido: si falla copiar a temporal, se lee App Group por fragmentos', async () => {
  const h = createHarness({ openFails: true, contents: [{
    id: '123e4567-e89b-12d3-a456-426614174001',
    kind: 'file', name: 'Audio de prueba.mp3',
    createdAt: '2026-10-17T10:00:00Z'
  }] });
  await h.tap('Guardar audio en biblioteca');
  assert.deepEqual(h.events, ['open', 'chunk', 'save', 'ack']);
  assert.equal(h.savedFile()?.name, 'Audio de prueba.mp3');
  assert.equal(h.savedFile()?.type, 'audio/mpeg');
  assert.equal(h.files.length, 0);
});

test('YouTube: el identificador sigue visible si no se obtiene un título público', async () => {
  const h = createHarness({ contents: [{
    id: '123e4567-e89b-12d3-a456-426614174001',
    kind: 'url', name: 'Enlace',
    preview: 'https://youtu.be/dQw4w9WgXcQ', createdAt: '2026-10-17T10:00:00Z'
  }] });
  await h.settle();
  const summary = h.list.children.find(node => node.className === 'ios-received-item')?.children[0].children[0];
  assert.match(summary.textContent, /dQw4w9WgXcQ/);
});

test('YouTube: se puede resolver un título público sin afectar la reproducción', async () => {
  const h = createHarness({ videoTitle: 'Título original del vídeo', contents: [{
    id: '123e4567-e89b-12d3-a456-426614174001',
    kind: 'url', name: 'Enlace',
    preview: 'https://youtu.be/dQw4w9WgXcQ', createdAt: '2026-10-17T10:00:00Z'
  }] });
  await h.settle();
  await h.tap('Reproducir vídeo');
  assert.deepEqual(h.events, ['open', 'youtube']);
});

test('El EPUB almacena el título del paquete OPF, no el nombre temporal epub', () => {
  assert.match(prep, /prepared\.format === 'epub' && String\(prepared\.model\?\.title/);
  assert.match(source, /META-INF\/container\.xml/);
  assert.match(source, /getElementsByTagNameNS\('\*', 'title'\)/);
});

test('Audio distinto de MP3: no declara guardado compatible sin soporte real', async () => {
  const h = createHarness({ contents: [{
    id: '123e4567-e89b-12d3-a456-426614174001',
    kind: 'file', name: 'Nota.m4a', createdAt: '2026-10-17T10:00:00Z'
  }] });
  await h.tap('Guardar audio en biblioteca');
  assert.equal(h.savedFile(), null);
  assert.equal(h.files.length, 1);
  assert.match(h.status.textContent, /aún no se puede guardar/i);
});

test('La confirmación de guardado MP3 comprueba los bytes reales además del libro', () => {
  assert.match(prep, /libraryAdapter\?\.openAudioFile\?\.\(id\)/);
  assert.match(prep, /stored\.blob\.size !== file\.size/);
});

test('YouTube: se reproduce en controlador y el enlace sigue disponible', async () => {
  const h = createHarness({ contents: [{
    id: '123e4567-e89b-12d3-a456-426614174001',
    kind: 'url', name: 'Vídeo', preview: 'https://youtu.be/dQw4w9WgXcQ',
    createdAt: '2026-10-17T10:00:00Z'
  }] });
  await h.tap('Reproducir vídeo');
  assert.deepEqual(h.events, ['open', 'youtube']);
  assert.equal(h.files.length, 1);
});

test('Eliminar requiere confirmación y no borra si se cancela', async () => {
  const h = createHarness({ confirmation: false });
  await h.tap('Eliminar de Recibidos');
  assert.deepEqual(h.events, ['confirm']);
  assert.equal(h.files.length, 1);
});

test('El empaquetado añade solo una sección iOS y mantiene origen web intacto', () => {
  assert.match(prep, /id="ios-received-section"/);
  assert.match(prep, /href="#received"/);
  assert.match(prep, /received: document\.getElementById\('ios-received-section'\)/);
  assert.doesNotMatch(source, /home\.before\(homeRegion\.root\)/);
  assert.match(prep, /saveImported: false/);
  const ext = readFileSync(new URL('../share-extension/ShareViewController.swift', import.meta.url), 'utf8');
  assert.match(ext, /address\.isFileURL/);
  assert.match(ext, /provider\.hasItemConformingToTypeIdentifier\(UTType\.fileURL\.identifier\)/);
  assert.match(ext, /"m4a", "aac", "wav"/);
});

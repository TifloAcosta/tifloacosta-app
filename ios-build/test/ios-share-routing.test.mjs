import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const src = readFileSync(new URL('../ios-share-inbox.js', import.meta.url), 'utf8');

function fakeElement() {
  return {
    hidden: false, id: '', nextElementSibling: null,
    classList: {add() {}},
    setAttribute() {}, append() {}, after() {}, before() {},
    addEventListener() {}, replaceChildren() {}, focus() {},
    querySelector() { return null; },
    getClientRects() { return [1]; }
  };
}
function router() {
  const section = fakeElement();
  const home = fakeElement();
  const window = { Capacitor: {}, addEventListener() {} };
  const document = {
    documentElement: {lang:'es'},
    readyState: 'loading',
    createElement: fakeElement,
    addEventListener() {},
    getElementById(id) {
      return id === 'reading-section' ? section
        : id === 'home-blocks' ? home : null;
    }
  };
  runInNewContext(src, {window, document, URL, setTimeout() {}});
  return window.TifloIOSShareInbox;
}

test('YouTube de WhatsApp se reconoce como vídeo, no como documento TXT', () => {
  const route = router();
  for (const value of [
    'https://youtu.be/dQw4w9WgXcQ?si=test',
    'Mira esto: https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=15s',
    'https://m.youtube.com/shorts/dQw4w9WgXcQ',
    'https://www.youtube.com/live/dQw4w9WgXcQ?feature=share',
    'https://music.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'
  ]) {
    assert.equal(route.youtubeId(value), 'dQw4w9WgXcQ');
    assert.equal(route.kindOf({kind:'text', preview:value}), 'youtube');
  }
});

test('No se confunden dominios falsos, identificadores incompletos ni archivos EPUB', () => {
  const route = router();
  assert.equal(route.youtubeId('https://youtube.com.ejemplo.org/watch?v=dQw4w9WgXcQ'), '');
  assert.equal(route.youtubeId('https://www.youtube.com/watch?v=short'), '');
  assert.equal(route.kindOf({kind:'file', name:'libro.epub', preview:''}), 'document');
  assert.equal(route.kindOf({kind:'file', name:'video.epub', preview:'https://youtu.be/dQw4w9WgXcQ'}), 'document');
});

test('Un enlace web genérico abre su destino y un texto común va al lector', () => {
  const route = router();
  const link = {kind:'url', preview:'https://example.org/resource?x=1'};
  assert.equal(route.kindOf(link), 'link');
  assert.equal(route.externalURL('Consulta https://example.org/resource?x=1.'), 'https://example.org/resource?x=1');
  assert.equal(route.kindOf({kind:'text', preview:'Un párrafo ordinario sin direcciones'}), 'document');
});

test('El controlador nativo expone vista previa local y apertura HTTP segura', () => {
  const host = readFileSync(new URL('../native/TifloShareInboxPlugin.swift', import.meta.url), 'utf8');
  assert.match(host, /"preview": String\(\(info\["value"\] \?\? ""\)\.prefix\(2000\)\)/);
  assert.match(host, /@objc public func openURL/);
  assert.match(host, /UIApplication\.shared\.open\(url, options: \[:\]\)/);
  assert.match(host, /url\.user == nil, url\.password == nil/);
});

function sharedFileHarness({canSave = true} = {}) {
  const created = [];
  const element = () => {
    const node = {
      hidden: false, id: '', children: [], textContent: '', handlers: {},
      classNames: [], nextElementSibling: null,
      classList: {add(name) { node.classNames.push(name); }},
      setAttribute() {}, after() {}, before() {}, focus() {},
      append(...items) { node.children.push(...items); },
      replaceChildren(...items) { node.children = items; },
      addEventListener(event, fn) { node.handlers[event] = fn; },
      querySelector(name) { return name === 'nav' ? nav : null; }
    };
    created.push(node);
    return node;
  };
  const nav = element();
  const reader = element();
  reader.hidden = true;
  const home = element();
  const importAnchor = element();
  const readingDocument = element();
  readingDocument.hidden = true;
  const map = {
    'reading-section': reader, 'home-blocks': home,
    'ios-reading-import': importAnchor,
    'reading-reader': readingDocument
  };
  const document = {
    readyState: 'complete', documentElement: {lang:'es'},
    createElement: element, addEventListener() {},
    getElementById(id) { return map[id] || null; }
  };
  const files = [
    {id:'123e4567-e89b-12d3-a456-426614174001',name:'Contenido.epub',
      kind:'file', preview:''}
  ];
  let imports = 0;
  let opens = 0;
  let acknowledgements = 0;
  let done;
  const completion = new Promise(resolve => { done = resolve; });
  const native = {
    async pending() { return {items:files.slice()}; },
    async openItem() { return {kind:'file', name:'Contenido.epub', uri:'file:///epub'}; },
    async acknowledge({id}) {
      acknowledgements++;
      const i = files.findIndex(x => x.id === id);
      if (i >= 0) files.splice(i,1);
      done();
    }
  };
  const location = {
    _hash:'',
    get hash() { return this._hash; },
    set hash(next) { this._hash = next; reader.hidden = next !== '#reading'; }
  };
  const window = {
    Capacitor: {Plugins:{TifloShareInbox:native},
      convertFileSrc: uri => 'https://local.example/epub'},
    TifloIOSBookActions: {
      async openBook() { opens++; return true; },
      async importSharedFile() {
        imports++;
        if (canSave !== true) done();
        return canSave === true
          ? {saved:true, id:'new-saved-epub'}
          : canSave === 'unverified'
            ? true
            : {saved:false, reason:'readback-failed'};
      },
      hasSavedBook() { return canSave; }
    },
    addEventListener() {}, dispatchEvent() {}
  };
  runInNewContext(src, {
    window, document, location, URL, Event, Blob, File, MutationObserver: class {
      observe() {} disconnect() {}
    },
    fetch: async () => ({ok:true, blob:async () => new Blob(['EPUB sample'])}),
    setTimeout() {return 1;}, clearTimeout() {}
  });
  const region = created.find(x => x.id === 'ios-shared-received');
  return {
    async tap(choice = 'save') {
      // The arrival panel has two contextual actions, but the home layout
      // never contains the full list of old incoming documents.
      await new Promise(resolve => setImmediate(resolve));
      const control = region.children[1].children[choice === 'read' ? 0 : 1];
      assert.ok(control, 'La portada debe mostrar una acción del EPUB recibido');
      assert.match(control.textContent, choice === 'read' ? /Leer ahora/ : /Guardar en biblioteca/);
      control.handlers.click();
      await completion;
      await new Promise(resolve => setImmediate(resolve));
      return {control};
    },
    state() {return {imports, opens, acknowledgements, remaining:files.length, hash:location.hash};},
    reader, region
  };
}

test('un toque en portada navega, importa EPUB y confirma guardado antes de retirar el pendiente', async () => {
  const app = sharedFileHarness();
  await app.tap();
  assert.deepEqual(app.state(), {
    imports:1, opens:0, acknowledgements:1, remaining:0, hash:'#reading'
  });
  assert.ok(app.region.classNames.includes('ios-share-inbox'));
});

test('si falla el guardado EPUB, conserva la entrada en la bandeja y no confirma éxito', async () => {
  const app = sharedFileHarness({canSave:false});
  await app.tap();
  assert.deepEqual(app.state(), {
    imports:1, opens:0, acknowledgements:0, remaining:1, hash:'#reading'
  });
});

test('el retorno antiguo de importación sin ID verificable no elimina el EPUB', async () => {
  const app = sharedFileHarness({canSave:'unverified'});
  await app.tap();
  assert.deepEqual(app.state(), {
    imports:1, opens:0, acknowledgements:0, remaining:1, hash:'#reading'
  });
});

test('el puente iOS comprueba lectura real del libro después de importar', () => {
  const packer = readFileSync(new URL('../prepare-web.mjs', import.meta.url), 'utf8');
  assert.match(packer, /const imported = await importSelectedFile\(\)/);
  assert.match(packer, /const persisted = await libraryClient\.openBook\(id\)/);
  assert.match(packer, /return \{ saved:true, id \}/);
});


test('la lectura inmediata de EPUB abre el libro tras confirmar persistencia', async () => {
  const app = sharedFileHarness();
  await app.tap('read');
  assert.deepEqual(app.state(), {
    imports:1, opens:1, acknowledgements:1, remaining:0, hash:'#reading'
  });
});

test('el contenido nuevo se presenta fuera de la navegación permanente', () => {
  assert.match(src, /home\.before\(homeRegion\.root\)/);
  assert.doesNotMatch(src, /nav\.before\(homeRegion\.root\)/);
  assert.match(src, /const newest = items\.at\(-1\)/);
  assert.match(src, /homeRegion\.list\.append\(buttonFor\(newest, mode, 'home', 'read'\)\)/);
});

test('un enlace compartido ofrece el analizador existente sin eliminar prematuramente el original', () => {
  assert.match(src, /location\.hash = '#downloads-link'/);
  assert.match(src, /form\.dispatchEvent\(new Event\('submit'/);
  assert.match(src, /if \(choice === 'analyze'\)/);
  assert.match(src, /Do not delete the source before the user has completed the download/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const src = readFileSync(new URL('../ios-share-inbox.js', import.meta.url), 'utf8');

function fakeElement() {
  return {
    hidden: false, id: '', nextElementSibling: null,
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

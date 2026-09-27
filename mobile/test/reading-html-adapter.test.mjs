import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { parseHtmlDocument } from '../src/core/reading-html-adapter.mjs';

const textNode = textContent => ({ nodeType: 3, textContent });
const element = (tagName, attributes = {}, childNodes = []) => ({
  nodeType: 1,
  tagName: tagName.toUpperCase(),
  childNodes,
  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(attributes, name)
      ? attributes[name]
      : null;
  }
});
const documentWith = (...childNodes) => ({
  body: element('body', {}, childNodes)
});

test('reading html adapter: preserves readable semantic structures as plain data', () => {
  const detachedDocument = documentWith(
    element('h2', {}, [textNode('Sección')]),
    element('p', {}, [
      textNode('Texto con '),
      element('img', { alt: 'imagen descrita' }),
      textNode('.')
    ]),
    element('ul', {}, [
      element('li', {}, [textNode('Elemento de lista.')])
    ]),
    element('blockquote', {}, [textNode('Una cita.')]),
    element('table', {}, [
      element('tr', {}, [
        element('th', {}, [textNode('Cabecera')]),
        element('td', {}, [textNode('Dato')])
      ])
    ])
  );

  const document = parseHtmlDocument('<html>ignorado por la prueba</html>', {
    title: 'HTML',
    language: 'es',
    parseDocument: () => detachedDocument
  });

  assert.equal(document.title, 'HTML');
  assert.equal(document.language, 'es');
  assert.deepEqual(document.blocks.map(block => ({
    id: block.id,
    type: block.type,
    text: block.text,
    ...(block.level ? { level: block.level } : {})
  })), [
    { id: 'h-1', type: 'heading', text: 'Sección', level: 2 },
    { id: 'p-1', type: 'paragraph', text: 'Texto con imagen descrita.' },
    { id: 'li-1', type: 'list-item', text: 'Elemento de lista.' },
    { id: 'q-1', type: 'quote', text: 'Una cita.' },
    { id: 'tc-1', type: 'table-cell', text: 'Cabecera' },
    { id: 'tc-2', type: 'table-cell', text: 'Dato' }
  ]);
  assert.deepEqual(document.blocks[1].sentences, ['Texto con imagen descrita.']);
});

test('reading html adapter: drops executable embedded and form content while keeping only non-empty image alt text', () => {
  const detachedDocument = documentWith(
    element('script', {}, [textNode('malicioso script')]),
    element('style', {}, [textNode('malicioso style')]),
    element('template', {}, [textNode('malicioso template')]),
    element('object', {}, [textNode('malicioso object')]),
    element('embed', {}, [textNode('malicioso embed')]),
    element('iframe', {}, [textNode('malicioso iframe')]),
    element('button', {}, [textNode('No leer botón')]),
    element('select', {}, [element('option', {}, [textNode('No leer opción')])]),
    element('textarea', {}, [textNode('No leer textarea')]),
    element('input', { value: 'No leer input' }),
    element('p', { onclick: 'malicioso()' }, [
      textNode('Contenido seguro '),
      element('img', { alt: 'descripción útil', onerror: 'malicioso()' }),
      element('img', { alt: '   ' }),
      textNode('.')
    ])
  );

  const document = parseHtmlDocument('<p onclick="malicioso()">contenido</p>', {
    language: 'es',
    parseDocument: () => detachedDocument
  });

  assert.deepEqual(document.blocks.map(block => block.text), [
    'Contenido seguro descripción útil.'
  ]);
  assert.doesNotMatch(JSON.stringify(document), /malicioso|No leer/u);
});

test('reading html adapter: source contract never injects source HTML into a live document', async () => {
  const source = await readFile(
    new URL('../src/core/reading-html-adapter.mjs', import.meta.url),
    'utf8'
  );

  assert.doesNotMatch(source, /\.innerHTML\s*=/u);
  assert.doesNotMatch(source, /\.outerHTML\s*=/u);
  assert.doesNotMatch(source, /insertAdjacentHTML\s*\(/u);
});

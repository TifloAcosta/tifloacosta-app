import assert from 'node:assert/strict';
import test from 'node:test';
import { HOME_ITEMS, renderHome } from '../src/screens/home.mjs';

function fakeDocument() {
  return {
    createElement(tag) {
      return {
        tagName: tag.toUpperCase(),
        children: [],
        dataset: {},
        append(...children) { this.children.push(...children); },
        addEventListener() {},
        setAttribute() {}
      };
    }
  };
}

test('home keeps the approved first-level destinations in a stable order', () => {
  assert.deepEqual(HOME_ITEMS, [
    'search',
    'actualidad',
    'library',
    'reading-library',
    'downloads',
    'favorites',
    'videos',
    'book',
    'podcast',
    'contact',
    'settings'
  ]);
});

test('home renders dedicated buttons for every approved destination', () => {
  const previousDocument = globalThis.document;
  globalThis.document = fakeDocument();
  try {
    const root = {
      children: [],
      replaceChildren() { this.children = []; },
      append(...children) { this.children.push(...children); }
    };
    renderHome({
      root,
      router: { navigate() {} },
      content: { resources: [] },
      preferences: { lang: 'es' },
      t: key => key
    });
    const nav = root.children.find(node => node.tagName === 'NAV');
    assert.ok(nav);
    assert.equal(nav.children.length, HOME_ITEMS.length);
    assert.deepEqual(nav.children.map(button => button.id), HOME_ITEMS.map(key => `home-${key}`));
  } finally {
    globalThis.document = previousDocument;
  }
});

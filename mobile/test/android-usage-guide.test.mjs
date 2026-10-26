import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { HOME_ITEMS } from '../src/screens/home.mjs';
import { renderUsageGuide, USAGE_GUIDE_SECTIONS } from '../src/screens/usage-guide.mjs';
import { text } from '../src/core/i18n.mjs';

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.handlers = new Map();
    this.textContent = '';
  }
  replaceChildren(...children) { this.children = children; }
  append(...children) { this.children.push(...children); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  addEventListener(type, handler) { this.handlers.set(type, handler); }
  click() { this.handlers.get('click')?.(); }
}
function walk(element) {
  return [element, ...element.children.flatMap(walk)];
}
function withFakeDocument(run) {
  const previous = globalThis.document;
  globalThis.document = { createElement: name => new FakeElement(name) };
  try { run(); } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
}

test('guide preserves every prior home destination and adds a new accessible entry', () => {
  assert.deepEqual(HOME_ITEMS.slice(0, 3), ['search', 'new-content', 'usage-guide']);
  for (const name of ['actualidad', 'library', 'reading-library', 'downloads', 'favorites', 'videos', 'book', 'podcast', 'contact', 'privacy', 'settings']) {
    assert.ok(HOME_ITEMS.includes(name), name);
  }
  assert.equal(text('es', 'home.usage-guide'), 'Guía de uso');
  assert.equal(text('en', 'home.usage-guide'), 'User guide');
});

test('twelve guide topics are unique and translated with complete instructions', () => {
  assert.equal(USAGE_GUIDE_SECTIONS.length, 12);
  assert.equal(new Set(USAGE_GUIDE_SECTIONS.map(section => section.id)).size, 12);
  for (const section of USAGE_GUIDE_SECTIONS) {
    assert.match(section.id, /^[a-z]+$/);
    for (const lang of ['es', 'en']) {
      assert.ok(section.title[lang]?.length > 3);
      assert.ok(section.paragraphs[lang].length >= 2);
      assert.ok(section.paragraphs[lang].every(p => p.length > 35));
    }
  }
});

test('index has one heading and twelve topic buttons that preserve origin focus ID', () => {
  withFakeDocument(() => {
    const root = new FakeElement('main');
    const navigations = [];
    const router = {
      back() {},
      navigate(name, options) { navigations.push({ name, options }); }
    };
    renderUsageGuide({ root, router, preferences: { lang: 'es' }, t: key => text('es', key) });
    const nodes = walk(root);
    assert.equal(nodes.filter(n => n.tagName === 'h1').length, 1);
    const nav = nodes.find(n => n.tagName === 'nav');
    assert.equal(nav.attributes['aria-label'], 'Guía de uso');
    assert.equal(nav.children.length, 12);
    assert.equal(nav.children[0].id, 'usage-guide-topic-actualidad');
    nav.children[0].click();
    assert.deepEqual(navigations, [{ name: 'usage-guide/actualidad', options: { originId: 'usage-guide-topic-actualidad' } }]);
  });
});

test('detail screens show only their selected topic with the chosen language', () => {
  withFakeDocument(() => {
    const topic = USAGE_GUIDE_SECTIONS.find(s => s.id === 'podcast');
    for (const lang of ['es', 'en']) {
      const root = new FakeElement('main');
      renderUsageGuide({
        root, router: { back() {} }, sectionId: 'podcast',
        preferences: { lang }, t: key => text(lang, key)
      });
      const nodes = walk(root);
      assert.equal(nodes.find(n => n.tagName === 'h1').textContent, topic.title[lang]);
      assert.deepEqual(nodes.filter(n => n.tagName === 'p').map(n => n.textContent), topic.paragraphs[lang]);
      assert.equal(nodes.filter(n => n.tagName === 'nav').length, 0);
      const back = nodes.find(n => n.tagName === 'button');
      assert.equal(back.textContent, text(lang, 'nav.back'));
    }
  });
});

test('guide uses existing router and never touches native services or storage', async () => {
  const [app, guide] = await Promise.all([
    readFile(new URL('../src/app.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../src/screens/usage-guide.mjs', import.meta.url), 'utf8')
  ]);
  assert.ok(app.includes("case 'usage-guide': renderUsageGuide(context); break;"));
  assert.ok(app.includes("route.name.startsWith('usage-guide/')"));
  assert.ok(guide.includes("addScreenHeader(root"));
  assert.ok(guide.includes("originId: button.id"));
  for (const sensitive of ['localStorage', 'SQLite', 'OneSignal', 'GoogleAuth', 'fetch(']) {
    assert.equal(guide.includes(sensitive), false, sensitive);
  }
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const script = readFileSync(resolve(root, 'ios-reader-selects.js'), 'utf8');
const localization = readFileSync(resolve(root, 'configure-ios-compliance.rb'), 'utf8');

test('iOS importer preserves native Files access and a localized VoiceOver button', () => {
  let imported = 0;
  const observers = [];
  const inserted = [];
  class HTMLInputElement {
    constructor() {
      this.type = 'file';
      this.hidden = false;
      this.style = {};
      this.tabIndex = 0;
      this.attributes = new Map([['accept', '.txt,.pdf']]);
    }
    removeAttribute(key) { this.attributes.delete(key); }
    setAttribute(key, value) { this.attributes.set(key, value); }
    click() { imported += 1; }
  }
  class HTMLSelectElement {}
  const input = new HTMLInputElement();
  const label = { hidden: false, insertAdjacentElement(position, child) { inserted.push({ position, child }); } };
  const section = {
    querySelector(selector) {
      if (selector === '#reading-file') return input;
      if (selector === 'label[for="reading-file"]') return label;
      return null;
    },
    querySelectorAll() { return []; }
  };
  const rootElement = { lang: 'es' };
  const doc = {
    documentElement: rootElement,
    getElementById(id) { return id === 'reading-section' ? section : null; },
    createElement(tag) {
      assert.equal(tag, 'button');
      return {
        listeners: {},
        addEventListener(name, fn) { this.listeners[name] = fn; }
      };
    },
    addEventListener() {}
  };
  class MutationObserver {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe() {}
  }
  runInNewContext(script, {
    document: doc, window: { addEventListener() {} },
    HTMLInputElement, HTMLSelectElement, MutationObserver
  });
  assert.equal(inserted.length, 1);
  const button = inserted[0].child;
  assert.equal(button.textContent, 'Importar documento o imagen');
  assert.equal(input.attributes.has('accept'), false, 'no native Files filter');
  assert.equal(input.hidden, true);
  assert.equal(label.hidden, true);
  assert.equal(input.attributes.get('aria-hidden'), 'true');
  button.listeners.click();
  assert.equal(imported, 1, 'native picker receives a user gesture');
  rootElement.lang = 'en';
  observers[0].callback();
  assert.equal(button.textContent, 'Import document or image');
});

test('native iOS project declares Spanish and English rather than defaulting to English', () => {
  assert.match(localization, /CFBundleDevelopmentRegion', 'es'/);
  assert.match(localization, /CFBundleLocalizations:0 string es/);
  assert.match(localization, /CFBundleLocalizations:1 string en/);
  assert.match(localization, /development_region = 'es'/);
});

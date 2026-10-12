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

test('ZIP and audio imports report precise status instead of a misleading browser error', () => {
  const reader = readFileSync(resolve(root, '../web-reading.js'), 'utf8');
  assert.match(reader, /code: 'zip-empty'/);
  assert.match(reader, /code: 'zip-multiple'/);
  assert.match(reader, /code: 'invalid-zip'/);
  assert.match(reader, /code: 'audio-unsupported'/);
  assert.match(reader, /importName: extractedName/);
  assert.match(reader, /El ZIP contiene varios documentos/);
  assert.match(reader, /La importación de audio todavía no está disponible/);
});

test('iOS native actions target the focused document, not the entire WKWebView', () => {
  const native = readFileSync(resolve(root, 'native/TifloReadingDocumentActionsPlugin.swift'), 'utf8');
  const bridge = readFileSync(resolve(root, 'ios-reader-actions.js'), 'utf8');
  const installer = readFileSync(resolve(root, 'install-native-video.mjs'), 'utf8');
  const wrapper = readFileSync(resolve(root, 'prepare-web.mjs'), 'utf8');
  const player = readFileSync(resolve(root, 'native/TifloYouTubeViewController.swift'), 'utf8');
  assert.match(native, /UIAccessibility.focusedElement\(using: \.notificationVoiceOver\)/);
  assert.match(native, /element.accessibilityCustomActions = \[/);
  assert.doesNotMatch(native, /webView\?\.accessibilityCustomActions/);
  assert.match(native, /self\.reset\(\)/);
  assert.match(bridge, /reading-library-title/);
  assert.match(bridge, /reading-library-delete/);
  assert.match(bridge, /if \(action === 'details'\) return/);
  assert.match(installer, /documentActionsBody/);
  assert.match(wrapper, /ios-reader-actions\.js/);
  assert.match(player, /registerPluginInstance\(TifloReadingDocumentActionsPlugin\(\)\)/);
});

test('native iOS project declares Spanish and English rather than defaulting to English', () => {
  assert.match(localization, /CFBundleDevelopmentRegion', 'es'/);
  assert.match(localization, /CFBundleLocalizations:0 string es/);
  assert.match(localization, /CFBundleLocalizations:1 string en/);
  assert.match(localization, /development_region = 'es'/);
});

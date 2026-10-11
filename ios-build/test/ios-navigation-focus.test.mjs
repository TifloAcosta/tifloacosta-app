import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const script = readFileSync(resolve(import.meta.dirname, '../ios-parity.js'), 'utf8');

function createHomeHarness({ hash = '', stored = {} } = {}) {
  const values = new Map(Object.entries(stored));
  const handlers = {};
  const timers = [];
  const button = {
    focused: 0,
    scrolled: 0,
    closest() { return null; },
    focus() { this.focused += 1; },
    scrollIntoView() { this.scrolled += 1; }
  };
  const menu = {
    addEventListener(name, callback) { handlers['menu-' + name] = callback; }
  };
  const location = { hash };
  const document = {
    readyState: 'complete',
    documentElement: { lang: 'es' },
    getElementById(id) {
      if (id === 'home-blocks') return menu;
      if (id === 'home-open-actualidad' || id === 'home-open-resources') return button;
      return null;
    },
    querySelector() { return null; }
  };
  const sessionStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
  const window = {
    location,
    sessionStorage,
    addEventListener(name, callback) {
      const previous = handlers[name];
      handlers[name] = previous
        ? (...args) => { previous(...args); callback(...args); }
        : callback;
    }
  };
  runInNewContext(script, {
    document, window, requestAnimationFrame: callback => callback(),
    setTimeout: callback => { timers.push(callback); }
  });
  return { button, handlers, location, values, timers };
}

test('Volver desde una sección del inicio recupera el botón de origen', () => {
  const app = createHomeHarness({
    hash: '#resources', stored: { 'tiflo-last-home-entry': 'home-open-resources' }
  });
  app.location.hash = '#home';
  app.handlers.hashchange();
  for (const callback of app.timers) callback();
  assert.ok(app.button.focused > 0);
  assert.ok(app.button.scrolled > 0);
});

test('Volver de Actualidad después de una navegación de página recupera su enlace', () => {
  const app = createHomeHarness({
    stored: {
      'tiflo-last-home-entry': 'home-open-actualidad',
      'tiflo-ios-restore-home-origin': '1'
    }
  });
  for (const callback of app.timers) callback();
  assert.ok(app.button.focused > 0);
  assert.equal(app.values.has('tiflo-ios-restore-home-origin'), false);
});

test('La pantalla de inicio normal no cambia de foco sin una acción Atrás', () => {
  const app = createHomeHarness({
    stored: { 'tiflo-last-home-entry': 'home-open-actualidad' }
  });
  assert.equal(app.button.focused, 0);
  assert.equal(app.timers.length, 0);
});

test('Abrir Actualidad guarda la restauración para el retorno desde otra página', () => {
  const app = createHomeHarness({ stored: { 'tiflo-last-home-entry': 'home-open-actualidad' } });
  const entry = {
    getAttribute(name) { return name === 'href' ? 'actualidad.html' : ''; }
  };
  app.handlers['menu-click']({ target: { closest() { return entry; } } });
  assert.equal(app.values.get('tiflo-ios-restore-home-origin'), '1');
});

function createActualidadHarness(hash) {
  const handlers = {};
  const timers = [];
  const targets = Object.fromEntries([
    'section-news-link', 'section-media-link',
    'media-accessibility-link', 'media-technology-link'
  ].map(id => [id, {
    focused: 0,
    scrolled: 0,
    closest() { return null; },
    focus() { this.focused += 1; },
    scrollIntoView() { this.scrolled += 1; }
  }]));
  const location = { hash };
  const document = {
    readyState: 'complete',
    documentElement: { lang: 'es' },
    getElementById(id) {
      return id === 'actualidad-sections' ? {} : targets[id] ?? null;
    },
    querySelector() { return null; }
  };
  const window = {
    location,
    addEventListener(name, handler) { handlers[name] = handler; }
  };
  runInNewContext(script, {
    window, document, requestAnimationFrame: callback => callback(),
    setTimeout: callback => { timers.push(callback); }
  });
  return { handlers, location, targets, timers };
}

test('Atrás de Noticias en Actualidad devuelve VoiceOver a Noticias, no al encabezado', () => {
  const app = createActualidadHarness('#news-browser');
  app.location.hash = '#actualidad-home';
  app.handlers.hashchange();
  for (const callback of app.timers) callback();
  assert.ok(app.targets['section-news-link'].focused > 0);
  assert.ok(app.targets['section-news-link'].scrolled > 0);
});

test('Atrás de una categoría multimedia retorna a su control de origen', () => {
  const app = createActualidadHarness('#media-technology');
  app.location.hash = '#media-browser';
  app.handlers.hashchange();
  for (const callback of app.timers) callback();
  assert.ok(app.targets['media-technology-link'].focused > 0);
  assert.equal(app.targets['media-accessibility-link'].focused, 0);
});

test('Entrar en una sección no restaura un foco anterior', () => {
  const app = createActualidadHarness('#actualidad-home');
  app.location.hash = '#media-browser';
  app.handlers.hashchange();
  for (const callback of app.timers) callback();
  assert.equal(app.targets['section-media-link'].focused, 0);
});

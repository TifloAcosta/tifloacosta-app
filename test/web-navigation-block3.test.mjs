import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');

test('un solo controlador gobierna el foco y las pantallas internas', () => {
  const html = read('index.html');
  const core = read('actualidad-core.js');
  assert.doesNotMatch(html, /function showHomeView\(/);
  assert.match(core, /window\.addEventListener\('hashchange',\s*\(\)\s*=>\s*applyIsolation\(true\)\)/);
  assert.match(core, /setHidden\(searchShell, !home\)/);
  assert.match(core, /book: 'home-open-contact'/);
});

test('la portada ofrece etiquetas de navegación y de idioma en español e inglés', () => {
  const html = read('index.html');
  assert.match(html, /id="language-switch" role="group" aria-label="Idioma de la web"/);
  assert.match(html, /id="home-sections-nav" aria-label="Secciones de la web de TifloAcosta"/);
  assert.match(html, /languageSwitch:'Website language'/);
  assert.match(html, /document\.getElementById\('home-sections-nav'\)\.setAttribute\('aria-label', text\.navigation\)/);
  assert.match(html, /document\.getElementById\('language-switch'\)\.setAttribute\('aria-label', text\.languageSwitch\)/);
  assert.match(html, /id="home-open-contact" href="#contact"/);
});

test('los botones de regreso duplicados se eliminan después de convertir enlaces', () => {
  const core = read('actualidad-core.js');
  assert.match(core, /section\?\.querySelectorAll\('\[data-home-back\]'\)/);
  assert.match(core, /controls\.slice\(1\)\.forEach\(control => control\.closest\('p'\)\?\.remove\(\)\)/);
  assert.match(core, /'reading-section', 'news-view', 'contact-section'/);
});

test('el navegador recibe una versión nueva del controlador', () => {
  const html = read('index.html');
  const actualidad = read('actualidad.html');
  const sw = read('sw.js');
  assert.match(html, /actualidad-core\.js\?v=1\.8/);
  assert.match(actualidad, /actualidad-core\.js\?v=1\.8/);
  assert.match(sw, /'\.\/actualidad-core\.js\?v=1\.8'/);
});

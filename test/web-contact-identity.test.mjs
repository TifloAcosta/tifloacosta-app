import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');

test('Contacto contiene las aplicaciones y el libro sin duplicarlos en portada', () => {
  const html = read('index.html');
  assert.doesNotMatch(html, /id="home-open-book"/);
  assert.match(html, /id="contact-app-android" href="https:\/\/play\.google\.com\/store\/apps\/details\?id=com\.tifloacosta\.app"/);
  assert.match(html, /id="contact-app-ios-status"/);
  assert.doesNotMatch(html, /id="contact-app-ios"[^>]*href=/);
  const contact = html.slice(html.indexOf('id="contact-section"'), html.indexOf('id="privacy-section"'));
  assert.match(contact, /id="contact-apps-section"/);
  assert.match(contact, /id="book-section"/);
  assert.match(contact, /id="book-buy-kindle"/);
  assert.match(contact, /id="book-cover"/);
  assert.doesNotMatch(contact, /id="book-section"[^>]* hidden/);
  assert.match(html, /book: document\.getElementById\('contact-section'\)/);
  assert.match(html, /key === 'book' \? 'book-heading'/);
});

test('Título de la web e idioma no se confunden con la app nativa', () => {
  const html = read('index.html'), script = read('app.js'), manifest=JSON.parse(read('manifest.webmanifest'));
  assert.match(html, /<h1 id="app-heading">TifloAcosta<\/h1>/);
  assert.doesNotMatch(html, /<title>TifloAcosta App/);
  assert.equal(manifest.name, 'TifloAcosta web');
  assert.match(script, /contactApps: \{ heading: 'Aplicaciones oficiales'/);
  assert.match(script, /contactApps: \{ heading: 'Official apps'/);
  assert.match(script, /els\.contactAppIosStatus\.textContent=c\.contactApps\.ios/);
  assert.match(script, /no la aplicación nativa de iOS/);
  assert.match(script, /not the native iOS app/);
});

test('Los enlaces anteriores al libro permanecen funcionales', () => {
  const html = read('index.html');
  assert.match(html, /book: document\.getElementById\('contact-section'\)/);
  assert.match(html, /const headingId = key === 'book' \? 'book-heading'/);
  assert.match(html, /id="book-buy-print"/);
  assert.match(html, /id="book-buy-kindle"/);
});

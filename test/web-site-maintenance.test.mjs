import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const pages = ['index.html', 'actualidad.html', 'videos.html', 'podcast.html', 'sounds.html', 'offline.html'];

for (const page of pages) {
  test(`${page}: navegación accesible básica y recursos locales existentes`, () => {
    const html = readFileSync(resolve(root, page), 'utf8');
    assert.match(html, /<html\b[^>]*\blang="es"/i, 'Debe declararse el idioma de la página');
    assert.match(html, /<main\b[^>]*\bid="main"/i, 'Debe existir el contenido principal');
    assert.match(html, /<a\b(?=[^>]*\bclass="skip-link")(?=[^>]*\bhref="#main")[^>]*>/i,
      'Debe existir un enlace para saltar al contenido principal');

    for (const match of html.matchAll(/\b(?:href|src|poster)="([^"]+)"/g)) {
      const url = match[1];
      if (!url || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(url)) continue;
      const cleanPath = url.split(/[?#]/, 1)[0].replace(/^\.?\//, '');
      if (!cleanPath) continue;
      const target = cleanPath.endsWith('/') ? `${cleanPath}index.html` : cleanPath;
      assert.ok(existsSync(resolve(root, target)),
        `${page}: el recurso local ${url} debe existir (${target})`);
    }
  });
}

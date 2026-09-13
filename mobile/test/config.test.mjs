import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Capacitor config uses the official TifloAcosta identity', async () => {
  const config = JSON.parse(await readFile(new URL('../capacitor.config.json', import.meta.url), 'utf8'));
  assert.equal(config.appId, 'com.tifloacosta.app');
  assert.equal(config.appName, 'TifloAcosta');
  assert.equal(config.webDir, 'src');
});

test('mobile shell is minimal, semantic and does not autofocus', async () => {
  const html = await readFile(new URL('../src/index.html', import.meta.url), 'utf8');
  assert.match(html, /<html lang="es">/);
  assert.match(html, /href="#app"/);
  assert.equal((html.match(/<main\b/g) || []).length, 1);
  assert.match(html, /<main id="app" tabindex="-1"><\/main>/);
  assert.match(html, /<script type="module" src="\.\/app\.mjs"><\/script>/);
  assert.doesNotMatch(html, /autofocus/i);
});

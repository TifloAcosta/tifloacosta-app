import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const policyPath = new URL('../privacidad/index.html', import.meta.url);
const homePath = new URL('../index.html', import.meta.url);

test('privacy policy page exposes the required accessible and privacy information', async () => {
  const html = await readFile(policyPath, 'utf8');
  assert.match(html, /<title>Política de privacidad — TifloAcosta<\/title>/);
  assert.match(html, /<h1[^>]*>Política de privacidad<\/h1>/);
  assert.match(html, /OneSignal/i);
  assert.match(html, /GoatCounter/i);
  assert.match(html, /tifloacosta@gmail\.com/i);
  assert.match(html, /Conservación y eliminación/i);
  assert.match(html, /Cómo solicitar la eliminación de datos/i);
  assert.match(html, /Eliminación de datos TifloAcosta/i);
  assert.match(html, /30 días/i);
  assert.match(html, /8 horas/i);
  assert.match(html, /18 meses/i);
  assert.match(html, /href="\.\.\/index\.html"/);
  assert.match(html, /lang="en"/);
});

test('privacy policy explains Google and YouTube authorization', async () => {
  const html = await readFile(policyPath, 'utf8');
  assert.match(html, /Google/i);
  assert.match(html, /YouTube/i);
  assert.match(html, /youtube\.force-ssl/i);
  assert.match(html, /suscrib/i);
  assert.match(html, /Me gusta/i);
  assert.match(html, /coment/i);
  assert.match(html, /token/i);
  assert.match(html, /contraseña/i);
  assert.match(html, /Cerrar sesión/i);
  assert.match(html, /sell|vend/i);
});

test('home page links directly to the full privacy policy', async () => {
  const html = await readFile(homePath, 'utf8');
  assert.match(html, /href="privacidad\/"/i);
});

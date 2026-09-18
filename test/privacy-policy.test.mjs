import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const path = new URL('../privacidad/index.html', import.meta.url);

test('privacy policy page exposes the required accessible and privacy information', async () => {
  const html = await readFile(path, 'utf8');
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

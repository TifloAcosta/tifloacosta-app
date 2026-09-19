import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('app core loads the iPhone downloads bridge after the main downloads UI', async () => {
  const source = await read('app-core.js');
  const ui = source.indexOf("appendScript('downloads.js?v=1.1'");
  const bridge = source.indexOf("appendScript('downloads-iphone-bridge.js?v=1.0'");
  assert.ok(ui >= 0);
  assert.ok(bridge > ui);
});

test('iPhone bridge announces paste and activation and dispatches one explicit submit', async () => {
  const source = await read('downloads-iphone-bridge.js');
  assert.match(source, /Enlace recibido/);
  assert.match(source, /Botón Analizar activado/);
  assert.match(source, /Validando enlace/);
  assert.match(source, /button\.addEventListener\('click'/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.match(source, /form\.dispatchEvent\(new Event\('submit'/);
  assert.match(source, /role.*status|setAttribute\('role',\s*'status'\)/s);
});

test('service worker precaches the bridge with a fresh cache generation', async () => {
  const source = await read('sw.js');
  assert.match(source, /tifloacosta-app-v2-14-iphone-diagnostics/);
  assert.match(source, /downloads-iphone-bridge\.js\?v=1\.0/);
});

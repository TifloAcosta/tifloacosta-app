import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

function navigationBlock() {
  const start = sw.indexOf("if (request.mode === 'navigate')");
  assert.notEqual(start, -1, 'Debe existir el tratamiento de navegaciones del service worker');
  const end = sw.indexOf("\n    return;\n  }", start);
  assert.notEqual(end, -1, 'Debe poder aislarse el bloque de navegación');
  return sw.slice(start, end + 16);
}

test('cada navegación se guarda con su propia URL y no sobrescribe la portada', () => {
  const block = navigationBlock();
  assert.doesNotMatch(block, /cache\.put\(['"]\.\/index\.html['"],\s*copy\)/);
  assert.match(block, /cache\.put\(request,\s*copy\)/);
  assert.match(block, /caches\.match\(request\)/);
});

test('el arranque tiene un tiempo máximo antes de usar la copia local', () => {
  assert.match(sw, /const NAVIGATION_TIMEOUT_MS\s*=\s*\d+;/);
  const block = navigationBlock();
  assert.match(block, /navigationFetchWithTimeout\(request\)/);
});

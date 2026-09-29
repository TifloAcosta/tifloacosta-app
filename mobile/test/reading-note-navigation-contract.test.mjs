import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('structured links remain actionable and internal notes return to the exact source position', async () => {
  const screen = await read('src/screens/reading-book.mjs');

  assert.match(screen, /block\.links/);
  assert.match(screen, /linksForCurrentUnit/);
  assert.match(screen, /targetBlockIndexForHref/);
  assert.match(screen, /noteReturnPosition/);
  assert.match(screen, /returnFromInternalLink/);
  assert.match(screen, /moveToPosition\(\{\s*blockIndex:\s*targetBlockIndex,\s*unitIndex:\s*0\s*\}\)/);

  for (const label of [
    'Enlace del documento',
    'Volver al punto de origen',
    'Document link',
    'Return to source'
  ]) {
    assert.ok(screen.includes(label), `Missing note navigation label: ${label}`);
  }
});

test('external document links require an accessible warning before leaving TifloAcosta', async () => {
  const screen = await read('src/screens/reading-book.mjs');

  assert.match(screen, /externalLinkDialog/);
  assert.match(screen, /setAttribute\(['"]role['"],\s*['"]dialog['"]\)/);
  assert.match(screen, /setAttribute\(['"]aria-modal['"],\s*['"]true['"]\)/);
  assert.match(screen, /openExternalLinkWarning/);
  assert.match(screen, /nativeActions\?\.openExternal/);
  assert.match(screen, /pendingExternalUrl/);
  assert.match(screen, /externalLinkInvoker/);

  for (const label of [
    'Este enlace abre contenido fuera de TifloAcosta.',
    'This link opens content outside TifloAcosta.',
    'Abrir enlace externo',
    'Open external link',
    'Cancelar',
    'Cancel'
  ]) {
    assert.ok(screen.includes(label), `Missing external-link warning label: ${label}`);
  }
});

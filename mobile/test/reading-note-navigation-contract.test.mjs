import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('structured links remain actionable and internal notes return to the exact source position', async () => {
  const [screen, i18n] = await Promise.all([
    read('src/screens/reading-book.mjs'),
    read('src/core/i18n.mjs')
  ]);

  assert.match(screen, /block\.links/);
  assert.match(screen, /linksForCurrentUnit/);
  assert.match(screen, /targetBlockIndexForHref/);
  assert.match(screen, /noteReturnPosition/);
  assert.match(screen, /returnFromInternalLink/);
  assert.match(screen, /moveToPosition\(\{\s*blockIndex:\s*targetBlockIndex,\s*unitIndex:\s*0\s*\}\)/);
  assert.match(screen, /noopener noreferrer/);

  for (const label of [
    'Enlace del documento',
    'Volver al punto de origen',
    'Document link',
    'Return to source'
  ]) {
    assert.ok(i18n.includes(label), `Missing note navigation translation: ${label}`);
  }
});

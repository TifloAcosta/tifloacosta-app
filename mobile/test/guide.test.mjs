import assert from 'node:assert/strict';
import test from 'node:test';
import { GUIDE } from '../src/screens/guide.mjs';

test('guide has meaningful, localized chapters and accurate coverage', () => {
  for (const lang of ['es', 'en']) {
    const guide = GUIDE[lang];
    assert.ok(guide.introduction.length > 80);
    assert.ok(guide.sections.length >= 15);
    assert.ok(guide.sections.every(([heading, paragraphs]) =>
      heading && paragraphs.length && paragraphs.every(text => text.length > 25)
    ));
  }
  const spanish = GUIDE.es.sections.map(([title, paragraphs]) => title + paragraphs.join(' ')).join(' ');
  assert.match(spanish, /buscador|Buscar/);
  assert.match(spanish, /TifloLector/);
  assert.match(spanish, /VoiceOver/);
  assert.match(spanish, /OCR/);
  assert.match(spanish, /Novedades/);
  assert.match(spanish, /Podcast/);
  assert.match(spanish, /temporizador|voz|ajustes/i);
});

test('guide is a screen-reader-friendly text guide, without HTML injection', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../src/screens/guide.mjs', import.meta.url), 'utf8');
  assert.match(source, /document\.createElement\('details'\)/);
  assert.match(source, /document\.createElement\('summary'\)/);
  assert.match(source, /document\.createElement\('h2'\)/);
  assert.match(source, /addScreenHeader\(/);
  assert.doesNotMatch(source, /innerHTML|autofocus/);
});

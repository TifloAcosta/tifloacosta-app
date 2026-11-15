import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('Google Play release includes localized notes for all six interface languages', async () => {
  const request = JSON.parse(await readFile(new URL('../release/request.json', import.meta.url), 'utf8'));
  const publisher = await readFile(new URL('../scripts/google-play-release.mjs', import.meta.url), 'utf8');
  for (const [language, locale] of Object.entries({
    es: 'es-ES', en: 'en-US', pt: 'pt-PT', fr: 'fr-FR', it: 'it-IT', de: 'de-DE'
  })) {
    assert.ok(typeof request.notes[language] === 'string' && request.notes[language].trim(),
      `Missing release notes for ${language}`);
    assert.ok(request.notes[language].length <= 500, `Release notes too long for ${language}`);
    assert.match(publisher, new RegExp(`language: '${locale}', text: notes\\.${language}\\b`));
  }
});

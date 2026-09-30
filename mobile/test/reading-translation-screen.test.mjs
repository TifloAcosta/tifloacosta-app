import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('translation panel exposes accessible source target model and progress controls', () => {
  const panel = read('src/screens/reading-translation-panel.mjs');

  assert.match(panel, /createReadingTranslationJob/);
  assert.match(panel, /identifyLanguage/);
  assert.match(panel, /listTranslationLanguages/);
  assert.match(panel, /downloadTranslationModel/);
  assert.match(panel, /sourceLabel\.htmlFor = sourceSelect\.id/);
  assert.match(panel, /targetLabel\.htmlFor = targetSelect\.id/);
  assert.match(panel, /setAttribute\('role', 'status'\)/);
  assert.match(panel, /setAttribute\('aria-live', 'polite'\)/);
  assert.match(panel, /translateButton/);
  assert.match(panel, /downloadButton/);
  assert.match(panel, /cancelButton/);
  assert.match(panel, /resumeButton/);
});

test('translation panel performs bounded resumable work without autoplay', () => {
  const panel = read('src/screens/reading-translation-panel.mjs');

  assert.match(panel, /job\.resumeNext\(\)/);
  assert.match(panel, /cancelRequested/);
  assert.match(panel, /status === 'complete'/);
  assert.match(panel, /onTranslationReady/);
  assert.doesNotMatch(panel, /\.play\(\)/);
});

test('reading screen integrates translation and keeps original source position when switching views', () => {
  const screen = read('src/screens/reading-book.mjs');

  assert.match(screen, /createReadingTranslationPanel/);
  assert.match(screen, /translateButton/);
  assert.match(screen, /Original/);
  assert.match(screen, /Traducción/);
  assert.match(screen, /translationDocument/);
  assert.match(screen, /sourceDocumentModel/);
  assert.match(screen, /currentPosition/);
  assert.match(screen, /onTranslationReady/);
});

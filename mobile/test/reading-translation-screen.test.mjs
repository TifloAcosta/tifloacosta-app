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

test('reader mounts translation controls after speech is created', () => {
  const screen = read('src/screens/reading-book.mjs');

  assert.match(screen, /speech = createReadingSpeechController/);
  assert.match(screen, /translationControls = createReadingTranslationControls/);
  assert.ok(
    screen.indexOf('speech = createReadingSpeechController')
      < screen.indexOf('translationControls = createReadingTranslationControls'),
    'translation controls must receive an already-created speech controller'
  );
  assert.match(screen, /root: moreActions/);
  assert.match(screen, /speech,/);
});

test('translated view preserves the source semantic position and never autoplays', () => {
  const [controls, speech] = [
    read('src/screens/reading-translation-controls.mjs'),
    read('src/core/reading-speech.mjs')
  ];

  assert.match(controls, /sourceDocumentModel/);
  assert.match(controls, /translationDocument/);
  assert.match(controls, /Original/);
  assert.match(controls, /Traducción/);
  assert.match(controls, /speech\?\.setDocument\?\.\(translationDocument\)/);
  assert.match(controls, /speech\?\.setDocument\?\.\(sourceDocumentModel\)/);
  assert.match(controls, /data-reading-unit=|data-reading-unit/);
  assert.match(speech, /initialPosition: snapshot\.position/);
  assert.doesNotMatch(controls, /\.play\(\)/);
});

test('translated view selects a compatible temporary voice without saving it', () => {
  const controls = read('src/screens/reading-translation-controls.mjs');

  assert.match(controls, /matchingVoice/);
  assert.match(controls, /const target = languageBase\(targetLanguage\)/);
  assert.match(controls, /languageBase\(voice\?\.locale\)\s*===\s*target/);
  assert.match(controls, /speech\?\.setVoice\?\.\(targetVoiceId\)/);
  assert.match(controls, /speech\?\.setVoice\?\.\(originalVoiceId\)/);
  assert.doesNotMatch(controls, /setReadingSetting/);
});

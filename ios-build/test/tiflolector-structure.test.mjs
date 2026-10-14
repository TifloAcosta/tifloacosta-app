// Source-level regression checks. These are NOT a substitute for iOS device tests.
// This suite deliberately leaves native VoiceOver actions and DAISY acceptance OPEN.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = resolve(import.meta.dirname, '../..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const web = read('web-reading.js');
const html = read('index.html');
const ios = read('ios-build/ios-reader-native.js');
const native = read('ios-build/native/TifloYouTubeViewController.swift');
const workflow = read('.github/workflows/ios-testflight.yml');

test('iOS production only publishes on manual dispatch or an explicit release-marker commit', () => {
  assert.match(workflow, /on:\s*\n\s+workflow_dispatch:/);
  const triggers = workflow.slice(0, workflow.indexOf('permissions:'));
  assert.match(triggers, /push:\s*\n\s+branches: \[preparacion-ios\]/);
  assert.match(triggers, /'ios-build\/solicitud-testflight-20261014\.txt'/);
  assert.doesNotMatch(triggers, /'web-reading\.js'/);
});

test('reader import accepts MP3 and the play/pause button is one control', () => {
  assert.match(html, /id="reading-file"[^>]+\.mp3/);
  assert.match(web, /await useMp3File\(file\)/);
  assert.match(web, /els\.play\.textContent = label/);
  assert.match(web, /activeAudio \? !activeAudio\.paused/);
});

test('library renders document title AND the settings/actions panel', () => {
  assert.match(web, /detailsToggle\.addEventListener\('click'/);
  assert.match(web, /detailsToggle\.setAttribute\('aria-controls', details\.id\)/);
  assert.match(web, /detailsToggle\.setAttribute\('aria-expanded', String\(opening\)\)/);
  assert.match(web, /card\.append\(title, detailsToggle, details\)/);
  assert.match(web, /remove\.addEventListener\('click', \(\) => \{ void deleteSavedBook\(book\.id\); \}\)/);
});

test('reading settings are collapsed initially; paste is not an active entry point', () => {
  assert.match(html, /<details id="reading-settings-disclosure"/);
  assert.doesNotMatch(html, /<details id="reading-settings-disclosure"[^>]+open(?:\s|>)/);
  assert.match(html, /<div hidden aria-hidden="true">\s*<label id="reading-paste-label"/);
});

test('iOS native speech and translation are registered and bridged', () => {
  assert.match(native, /registerPluginInstance\(TifloReadingTtsPlugin\(\)\)/);
  assert.match(native, /registerPluginInstance\(TifloReadingLanguagePlugin\(\)\)/);
  assert.match(ios, /TifloReadingTts/);
  assert.match(ios, /TifloReadingLanguage/);
});


test('My library is always a visible reader section with search and status filters', () => {
  assert.match(html, /<section id="reading-library-web" class="panel" aria-labelledby="reading-library-heading">/);
  assert.doesNotMatch(html, /<section id="reading-library-web"[^>]*hidden/);
  for (const id of ['reading-library-filter','reading-library-query','reading-library-list']) {
    assert.ok(html.includes('id="' + id + '"'));
  }
  assert.match(web, /els\.libraryFilter\?\.addEventListener\('change'/);
  assert.match(web, /els\.libraryQuery\?\.addEventListener\('input'/);
  assert.match(web, /sort: isRecentView \? 'imported' : 'lastRead'/);
  assert.doesNotMatch(html, /id="reading-management-web"/);
});

test('document management requires confirmation and supports rename with focus return', () => {
  assert.match(web, /globalThis\.confirm\?\.\(question\) !== true/);
  assert.match(web, /libraryClient\.updateBookMetadata\(\{ \.\.\.book, title: updatedTitle \}\)/);
  assert.match(web, /document\.getElementById\(title\.id\)\?\.focus/);
});

test('the accessible guide is reachable before navigation and remains available offline', () => {
  const guide = read('tifloacosta-guide.js');
  const worker = read('sw.js');
  assert.match(html, /id="home-open-guide" href="#guide"/);
  assert.match(html, /guide: document\.getElementById\('guide-view'\)/);
  assert.ok(html.indexOf('id="home-open-guide"') < html.indexOf('id="home-blocks"'));
  assert.match(html, /src="tifloacosta-guide\.js"/);
  assert.match(guide, /guide-chapters/);
  assert.match(guide, /VoiceOver/);
  assert.match(worker, /tifloacosta-guide\.js/);
});

test('iOS preserves pronunciation rules without changing document text or weakening package gate', () => {
  const prepare = read('ios-build/prepare-web.mjs');
  const speech = read('shared/web-reading-pronunciation.mjs');
  assert.match(html, /id="reading-pronunciation-settings"/);
  assert.match(web, /createPronunciationSpeechAdapter\(speechAdapter/);
  assert.match(web, /PRONUNCIATION_STORAGE_KEY/);
  assert.match(speech, /export function applyPronunciationEntries/);
  assert.match(prepare, /setupPronunciationDictionary\(\)/);
  assert.match(prepare, /BLOQUEO PREVENTIVO iOS/);
});

test('iOS packages its own local ZIP engine instead of fetching CDN JSZip', () => {
  const pkg = JSON.parse(read('ios-build/package.json'));
  const prepare = read('ios-build/prepare-web.mjs');
  const patch = read('ios-build/patch-reading-native.mjs');
  assert.equal(pkg.dependencies.jszip, '3.10.1');
  assert.match(prepare, /node_modules\/jszip\/dist\/jszip\.min\.js/);
  assert.match(prepare, /ios-jszip\.min\.js/);
  assert.match(patch, /script\.src = 'ios-jszip\.min\.js'/);
  assert.match(web, /loadZipBundle\(\)/);
});

test('the iOS bundler rejects accidental loss of restored reader features', () => {
  const prepare = read('ios-build/prepare-web.mjs');
  for (const token of [
    'reading-library-filter', 'reading-library-query', 'reading-library-pager',
    'reading-marks-new-type', 'shared.adjacentWebReadingStructure(',
    'setReaderAudioOnlyMode(true)', 'setReaderAudioOnlyMode(false)',
    'card.append(title, detailsToggle, details)', 'tifloacosta-guide.js'
  ]) assert.ok(prepare.includes(token), 'Missing package safeguard: ' + token);
  assert.match(prepare, /readerSection\.includes\('id="reading-pause"'\)/);
  assert.match(prepare, /BLOQUEO PREVENTIVO iOS/);
});

// Still blocked by prepare-web.mjs and issue #170:
// * DAISY ZIP import / SMIL navigation;
// * UIAccessibilityCustomAction on each VoiceOver-focused document title;
// * real iPhone verification of MP3, OCR, translation, progress and retained data.

test('iOS Importar abre Archivos directamente y cada título dispone de acciones nativas sin botón previo', () => {
  const bridge = read('ios-build/ios-reader-native.js');
  const accessibility = read('ios-build/native/TifloReadingAccessibilityPlugin.swift');
  const parity = read('ios-build/ios-parity.js');
  assert.match(bridge, /trigger\.textContent = iosText\('Importar', 'Import'\)/);
  assert.match(bridge, /const picked = await plugin\.pickDocument\(\)/);
  assert.match(bridge, /fileInput\.hidden = true/);
  assert.match(accessibility, /UIDocumentPickerViewController\(forOpeningContentTypes: \[UTType\.item\], asCopy: true\)/);
  assert.doesNotMatch(parity, /entry\.id = 'ios-ocr-import'/);
  assert.match(bridge, /list\.addEventListener\('focusin'/);
  assert.match(accessibility, /UIAccessibilityCustomAction\(name: name, target: self, selector: selector\)/);
  assert.match(accessibility, /notifyListeners\("documentAction"/);
  assert.doesNotMatch(web, /button\.id = 'reading-library-native-actions'/);
  assert.match(bridge, /control\.hidden = true/);
  assert.match(web, /globalThis\.confirm\?\.\(question\) !== true/);
});


test('carpetas iOS independientes desde la compilación 400079', () => {
  const folders = read('ios-build/ios-reader-folders.js');
  const prepare = read('ios-build/prepare-web.mjs');
  assert.match(folders, /old\.replaceWith\(opener, folder\)/);
  assert.match(folders, /folder\.append\(menu, audio, visual\)/);
  assert.match(folders, /for \(const el of saved\.keys\(\)\) el\.hidden = true/);
  assert.match(folders, /for \(const \[el, wasHidden\] of saved\)/);
  assert.match(folders, /focus\(opener\)/);
  assert.match(folders, /'ios-reading-general-open'/);
  assert.match(folders, /options\.append\(audio, visual, more\)/);
  assert.match(folders, /general\.replaceWith\(generalButton, generalFolder\)/);
  assert.match(folders, /installDocumentFolders\(\)/);
  assert.match(folders, /lectura preparada\|reading ready/);
  assert.match(folders, /labelUnannouncedControls/);
  assert.ok(prepare.includes('ios-reader-folders.js'));
});

test('UIKit reconoce la etiqueta VoiceOver exacta sin imponer activación adicional', () => {
  const swift = read('ios-build/native/TifloReadingAccessibilityPlugin.swift');
  const bridge = read('ios-build/ios-reader-native.js');
  assert.match(swift, /UIAccessibility\.elementFocusedNotification/);
  assert.match(swift, /accessibilityTraits\.contains\(\.button\)/);
  assert.match(swift, /normalized == expected/);
  assert.match(bridge, /plainLabel: title\.textContent/);
  assert.match(bridge, /registerLibraryTitles\(\{ documents \}\)/);
});

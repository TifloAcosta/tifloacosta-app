import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const read = path => readFileSync(resolve(import.meta.dirname, '../..', path), 'utf8');

test('el paquete iOS mantiene la identificación de compilación sin mostrársela a VoiceOver', () => {
  const prep = read('ios-build/prepare-web.mjs');
  assert.match(prep, /tiflo-build-identity\.json/);
  assert.match(prep, /'    label\.hidden = true;'/);
  assert.doesNotMatch(prep, /'    label\.hidden = false;'/);
});

test('la presentación iOS suprime ruido, conserva funciones y cierra los submenús', () => {
  const script = read('ios-build/ios-reader-minimal.js');
  const prep = read('ios-build/prepare-web.mjs');
  for (const id of [
    'reading-build-identity', 'reading-intro', 'reading-start-heading',
    'reading-settings-heading', 'reading-library-intro',
    'reading-audio-view', 'reading-visual-view',
    'reading-queue-web', 'reading-marks-web'
  ]) assert.ok(script.includes(id), 'Sin limpieza iOS para: ' + id);
  assert.match(script, /tr\('Ajustes', 'Settings'\)/);
  assert.match(script, /tr\('Cerrar', 'Close'\)/);
  assert.match(script, /MutationObserver\(reconcile\)/);
  assert.match(prep, /await cp\(join\(root, 'ios-build\/ios-reader-minimal\.js'\)/);
  assert.match(prep, /src=\"ios-reader-minimal\.js\"/);
});

test('no se incorpora un segundo menú de ajustes al abrir un documento', () => {
  const parity = read('ios-build/ios-parity.js');
  assert.doesNotMatch(parity, /more\.before\(wrapper\)/);
  assert.match(parity, /installDocumentControls\(\)/);
  const reader = read('web-reading.js');
  assert.match(reader, /readingSettingsMenu\.append\(readingSettingsSummary, audioButton, visualButton, generalSettings\)/);
});

test('VoiceOver expone controles ajustables para valores continuos y opciones únicas', () => {
  const script = read('ios-build/ios-reader-selects.js');
  for (const id of [
    'reading-navigation-unit', 'reading-document-progress-percent',
    'reading-default-navigation', 'reading-library-filter', 'reading-voice',
    'reading-voice-language', 'reading-text-size', 'reading-font-family',
    'reading-font-weight', 'reading-line-spacing', 'reading-paragraph-spacing',
    'reading-width', 'reading-theme', 'reading-document-voice',
    'reading-document-voice-language', 'reading-document-text-size',
    'reading-document-font-family', 'reading-document-font-weight',
    'reading-document-line-spacing', 'reading-document-paragraph-spacing',
    'reading-document-width', 'reading-document-theme',
    'reading-daisy-chapter-select', 'reading-marks-new-type'
  ]) assert.ok(script.includes("'" + id + "'"), 'Falta ajuste por gestos: ' + id);
  assert.match(script, /if \(adjustableIds\.has\(select\.id\)\)/);
  assert.match(script, /aria-valuetext/);
  assert.match(script, /slider\.addEventListener\('input', selectBySlider\)/);
  assert.match(script, /select\.dispatchEvent\(new Event\('change', \{ bubbles: true \}\)\)/);
});

test('la importación directa y acciones VoiceOver por documento no retroceden', () => {
  const bridge = read('ios-build/ios-reader-native.js');
  const swift = read('ios-build/native/TifloReadingAccessibilityPlugin.swift');
  const web = read('web-reading.js');
  const html = read('index.html');
  const prep = read('ios-build/prepare-web.mjs');
  assert.match(bridge, /const picked = await plugin\.pickDocument\(\)/);
  assert.match(bridge, /fileInput\.hidden = true/);
  assert.match(bridge, /registerVisibleTitles\(\)/);
  assert.match(swift, /UIAccessibilityCustomAction\(name: name, target: self, selector: selector\)/);
  assert.match(web, /setupPronunciationDictionary\(\)/);
  assert.match(web, /shared\.parseDaisyArchive\(/);
  assert.match(web, /await useMp3File\(file\)/);
  assert.match(html, /id="reading-marks-new-type"/);
  assert.match(prep, /BLOQUEO PREVENTIVO iOS/);
});

test('iOS conserva General global cerrado y elimina el General redundante del libro', () => {
  const minimal = read('ios-build/ios-reader-minimal.js');
  assert.match(minimal, /dataset\.iosCloseGeneral/);
  assert.match(minimal, /dataset\.iosCloseSettings/);
  assert.match(minimal, /querySelector\('details\.reading-settings-disclosure'\)\?\.remove\(\)/);
  assert.match(minimal, /ios-reading-document-controls-toggle/);
  assert.match(minimal, /tr\('Controles', 'Controls'\)/);
  assert.match(minimal, /reading-document-progress-percent/);
  assert.match(minimal, /reading-document-timer/);
});

test('acciones de biblioteca vinculadas al foco REAL de UIKit sin activación previa', () => {
  const bridge = read('ios-build/ios-reader-native.js');
  const swift = read('ios-build/native/TifloReadingAccessibilityPlugin.swift');
  assert.match(bridge, /registerLibraryTitles\(\{ documents, nativeRowsOnFocus: true \}\)/);
  assert.match(bridge, /title\?\.closest\('\.reading-library-title-card'\)/);
  assert.match(swift, /UIAccessibility\.elementFocusedNotification/);
  assert.match(swift, /func updateFocusedLibraryTitle/);
  assert.match(swift, /func registerLibraryTitles/);
});

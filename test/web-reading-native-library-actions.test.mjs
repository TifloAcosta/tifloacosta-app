import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('iOS library title is a native VoiceOver element, not a view-wide WKWebView action', async () => {
  const swift = await read('ios-build/native/TifloReadingAccessibilityPlugin.swift');
  const controller = await read('ios-build/native/TifloYouTubeViewController.swift');
  const installer = await read('ios-build/install-native-video.mjs');
  assert.match(swift, /final class ReadingLibraryActionCell: UITableViewCell/);
  assert.match(swift, /cell\.accessibilityCustomActions = \[/);
  assert.match(swift, /UIAccessibilityCustomAction\(name: open,/);
  assert.match(swift, /UIAccessibilityCustomAction\(name: read,/);
  assert.match(swift, /UIAccessibilityCustomAction\(name: details,/);
  assert.match(swift, /UIAccessibilityCustomAction\(name: delete,/);
  assert.match(swift, /accessibilityHint = english/);
  assert.match(swift, /notifyListeners\("readingLibraryAction"/);
  assert.match(controller, /registerPluginInstance\(TifloReadingAccessibilityPlugin\(\)\)/);
  assert.match(installer, /TifloReadingAccessibilityPlugin\.swift/);
  assert.match(installer, /accessibilityBody/);
});

test('native library actions use existing reading, details and confirmed deletion', async () => {
  const [web, native] = await Promise.all([read('web-reading.js'), read('ios-build/ios-reader-native.js')]);
  assert.match(native, /get hasNativeLibraryActions\(\)/);
  assert.match(native, /presentLibrary: options => accessibleLibrary/);
  assert.match(native, /onLibraryAction: callback => accessibleLibrary/);
  assert.match(web, /function ensureNativeLibraryActions\(items = \[\]\)/);
  assert.match(web, /native\.presentLibrary\(\{ items: pages, language: language\(\) \}\)/);
  assert.match(web, /native\.onLibraryAction\?\.\(event =>/);
  assert.match(web, /if \(action === 'open' \|\| action === 'read'\)/);
  assert.match(web, /await openSavedBook\(id\)/);
  assert.match(web, /if \(action === 'read' && \(currentBookId === id\)\) await play\(\)/);
  assert.match(web, /await deleteSavedBook\(id\)/);
  assert.match(web, /querySelector\('\.reading-library-details-toggle'\)/);
  assert.match(web, /ensureNativeLibraryActions\(page\.items\)/);
  assert.match(web, /Abrir biblioteca con acciones de VoiceOver/);
});

test('unsigned test compilation never grants permission to distribute iOS build', async () => {
  const [prepare, check, publish] = await Promise.all([
    read('ios-build/prepare-web.mjs'),
    read('.github/workflows/ios-check.yml'),
    read('.github/workflows/ios-testflight.yml')
  ]);
  assert.match(prepare, /process\.env\.TIFLO_IOS_AUDIT_UNSIGNED !== '1'/);
  assert.match(prepare, /BLOQUEO PREVENTIVO iOS/);
  assert.match(check, /TIFLO_IOS_AUDIT_UNSIGNED: '1'/);
  assert.doesNotMatch(publish, /TIFLO_IOS_AUDIT_UNSIGNED/);
});

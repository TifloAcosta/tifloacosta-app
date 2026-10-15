import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const plugin = read('ios-build/native/TifloReadingAccessibilityPlugin.swift');
const controller = read('ios-build/native/TifloNativeActionListController.swift');
const installer = read('ios-build/install-native-video.mjs');
const bridge = read('ios-build/ios-reader-native.js');
const website = read('web-reading.js');
const packager = read('ios-build/prepare-web.mjs');
const appwide = read('ios-build/ios-appwide-native-actions.js');

test('native UIKit actions belong to the focused row, not the WKWebView container', () => {
  assert.match(controller, /UITableViewController/);
  assert.match(controller, /cell\.accessibilityCustomActions = rowActionHandlers\[indexPath\.row\]/);
  assert.match(controller, /cell\.accessibilityLabel = entry\.title/);
  assert.match(controller, /initialItemId: String\?/);
  assert.match(controller, /scrollToRow\(at: indexPath/);
  assert.match(controller, /UIAccessibility\.post\(notification: \.screenChanged/);
});

test('production iOS build includes the native controller and its Capacitor bridge', () => {
  assert.match(installer, /native\/TifloNativeActionListController\.swift/);
  assert.match(installer, /accessibilityBody \+ '\\n\\n' \+ nativeListBody/);
  assert.match(plugin, /CAPPluginMethod\(name: "showNativeActionList"/);
  assert.match(plugin, /func presentNativeActionList\(/);
  assert.match(plugin, /navigation\.modalPresentationStyle = \.fullScreen/);
});

test('app-wide native action lists open upon section entry, without a pilot button', () => {
  assert.match(plugin, /self\.autoNativeLibraryEnabled = call\.getBool\("nativeRowsOnFocus"\) \?\? false/);
  assert.match(plugin, /if autoNativeLibraryEnabled \{/);
  assert.match(plugin, /preferredFocusId: id/);
  assert.match(appwide, /showNativeActionList/);
  assert.match(appwide, /getVoiceOverStatus/);
  assert.match(bridge, /registerLibraryTitles\(\{ documents, nativeRowsOnFocus: false \}\)/);
  assert.doesNotMatch(bridge, /installNativeActionPilot|ios-voiceover-native-action-pilot|Probar acciones nativas de VoiceOver/);
  assert.doesNotMatch(website, /ios-voiceover-native-action-pilot/);
});

test('actions are tied to document identity and reuse existing app capabilities', () => {
  assert.match(bridge, /addListener\('nativeListAction'/);
  assert.match(bridge, /getElementById\(id\)/);
  assert.match(bridge, /TifloIOSBookActions/);
  for (const key of ['open', 'continue', 'translate', 'queue', 'info', 'move', 'export', 'rename', 'delete']) {
    assert.ok(bridge.includes(`action === '${key}'`), key);
  }
  assert.match(bridge, /reading-translation-target/);
  assert.match(bridge, /nativeListClosed/);
});

test('focus re-entrance is prevented and the existing HTML library remains a fallback', () => {
  assert.match(plugin, /guard !nativePilotPresented else \{ return \}/);
  assert.match(plugin, /suppressAutoNativeTitleId == id/);
  assert.match(plugin, /presentingAutoNativeTitleId == id/);
  assert.match(plugin, /suppressAutoNativeTitleId = preferredFocusId \?\? ""/);
  assert.match(bridge, /installLibraryNativeActions\(\)/);
  assert.match(bridge, /installNativeFilesImport\(\)/);
  assert.match(website, /card\.append\(title, detailsToggle, details\)/);
});

test('the real document operations are injected only into the packaged iOS reader', () => {
  assert.match(packager, /window\.TifloIOSBookActions =/);
  assert.match(packager, /card\.dataset\.iosBookId = String\(book\.id\)/);
  assert.match(packager, /deleteBook: id => deleteSavedBook\(id\)/);
  assert.match(packager, /renameBook: id =>/);
  assert.match(packager, /queueBook: async id =>/);
  assert.match(packager, /return Boolean\(deleted\)/);
  assert.doesNotMatch(website, /window\.TifloIOSBookActions =/);
});

test('every principal actionable iOS collection has an explicit native route', () => {
  for (const selector of [
    'video-list', 'podcast-episodes', 'reading-library-list',
    'resource-results', 'favorites-list', 'news-list',
    'apps-list', 'media-accessibility-list', 'media-technology-list',
    'reading-queue-list', 'reading-marks-list'
  ]) assert.ok(appwide.includes(selector), selector);
  assert.match(controller, /contextMenuConfigurationForRowAt/);
  assert.match(controller, /UIAction\(/);
  assert.match(packager, /ios-appwide-native-actions\.js/);
  assert.match(plugin, /CAPPluginMethod\(name: "getVoiceOverStatus"/);
  assert.match(appwide, /nativeListAction/);
  assert.match(appwide, /VoiceOver/);
  assert.doesNotMatch(appwide, /Probar acciones nativas de VoiceOver/);
});

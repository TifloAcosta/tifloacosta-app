import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const plugin = read('ios-build/native/TifloReadingAccessibilityPlugin.swift');
const controller = read('ios-build/native/TifloNativeActionListController.swift');
const installer = read('ios-build/install-native-video.mjs');
const bridge = read('ios-build/ios-reader-native.js');
const website = read('web-reading.js');

test('native rotor actions belong to the actual VoiceOver-focused UIKit cell', () => {
  assert.match(controller, /UITableViewController/);
  assert.match(controller, /cell\.accessibilityCustomActions = rowActionHandlers\[indexPath\.row\]/);
  assert.match(controller, /cell\.accessibilityLabel = entry\.title/);
  assert.match(controller, /UIAccessibilityCustomAction\(/);
  assert.match(controller, /accessibilityTraits = \[\.button\]/);
});

test('signed-app preparation includes source and registers pilot method', () => {
  assert.match(installer, /native\/TifloNativeActionListController\.swift/);
  assert.match(installer, /nativeListBody/);
  assert.match(installer, /accessibilityBody \+ '\\n\\n' \+ nativeListBody/);
  assert.match(plugin, /CAPPluginMethod\(name: "showNativeActionList"/);
  assert.match(plugin, /controller\.onSelected =/);
  assert.match(plugin, /navigation\.modalPresentationStyle = \.fullScreen/);
});

test('pilot is opt-in, only in the iOS bundle, with unmodified web reader', () => {
  assert.match(bridge, /function installNativeActionPilot\(/);
  assert.match(bridge, /ios-voiceover-native-action-pilot/);
  assert.match(bridge, /plugin\.showNativeActionList\(/);
  assert.match(bridge, /installLibraryNativeActions\(\)/);
  assert.match(bridge, /installNativeFilesImport\(\)/);
  assert.doesNotMatch(website, /ios-voiceover-native-action-pilot/);
});

test('native action selected on a specific row is routed to existing app controls', () => {
  assert.match(bridge, /pilotedIds\.has\(id\)/);
  assert.match(bridge, /TifloIOSBookActions/);
  for (const a of ['open', 'continue', 'queue', 'info', 'move', 'export', 'rename', 'delete']) {
    assert.ok(bridge.includes(`selected === '${a}'`), a);
  }
  assert.match(bridge, /nativeListClosed/);
  assert.match(plugin, /nativeListAction/);
});

test('current HTML document actions stay available as a fallback', () => {
  assert.match(bridge, /plugin\.registerLibraryTitles\(\{ documents \}\)/);
  assert.match(bridge, /nativeDocumentListenerInstalled/);
  assert.match(website, /card\.append\(title, detailsToggle, details\)/);
});

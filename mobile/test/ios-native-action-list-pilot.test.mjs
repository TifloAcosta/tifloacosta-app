import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const library = readFileSync(new URL('../src/screens/reading-library.mjs', import.meta.url), 'utf8');
const bridge = readFileSync(new URL('../ios-native/ios/Sources/TifloReadingIos/TifloReadingAccessibilityPlugin.swift', import.meta.url), 'utf8');
const nativeList = readFileSync(new URL('../ios-native/ios/Sources/TifloReadingIos/TifloNativeActionListController.swift', import.meta.url), 'utf8');

test('pilot uses real native, per-row VoiceOver custom actions, not WebView actions', () => {
  assert.match(nativeList, /class TifloNativeActionListController: UITableViewController/);
  assert.match(nativeList, /cell\.accessibilityCustomActions = rowActionHandlers\[indexPath\.row\]/);
  assert.match(nativeList, /UIAccessibilityCustomAction\(/);
  assert.match(nativeList, /accessibilityLabel = entry\.title/);
  assert.match(nativeList, /UIAccessibility\.post\(notification: \.screenChanged/);
  assert.match(bridge, /CAPPluginMethod\(name: "showNativeActionList"/);
  assert.match(bridge, /navigation\.modalPresentationStyle = \.fullScreen/);
  assert.match(bridge, /presenter\.present\(navigation/);
});

test('pilot stays iOS-only, opt-in, and preserves existing library functionality', () => {
  assert.match(library, /Capacitor\.getPlatform\(\) === 'ios'/);
  assert.match(library, /reading-library-native-pilot/);
  assert.match(library, /showNativeActionList\(/);
  assert.match(library, /article\.append\(actionsToggle, details\)/);
  assert.match(library, /list\.append\(renderBook\(item\)\)/);
  assert.match(library, /NativeDocumentAccessibility\.clearDocumentActions\(\)/);
});

test('native list routes only known current document actions to existing JS handlers', () => {
  assert.match(library, /nativePilotItemIds\.has\(id\)/);
  assert.match(library, /nativeActionsByDocument\.get\(id\)\?\.\(action\)/);
  assert.match(bridge, /let allowed = Set\(\["open", "details", "rename", "delete"/);
  assert.match(nativeList, /\$0\.id == "open"/);
  assert.match(bridge, /nativeListClosed/);
});

test('deletion remains behind the original JS confirmation', () => {
  assert.match(library, /const confirm = makeButton/);
  assert.match(library, /deleteButton\.click\(\)/);
  assert.match(library, /client\.deleteBook\(item\.id\)/);
});

test('pilot can be disabled by reverting this branch; no automatic takeover', () => {
  assert.doesNotMatch(library, /showNativeActionList\([^\n]*\)\s*;\s*\/\/\s*auto/);
  assert.match(library, /nativePilotButton = makeButton\(/);
});

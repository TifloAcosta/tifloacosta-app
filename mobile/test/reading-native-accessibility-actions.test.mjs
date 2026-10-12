import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const library = readFileSync(new URL('../src/screens/reading-library.mjs', import.meta.url), 'utf8');
const native = readFileSync(new URL('../ios-native/ios/Sources/TifloReadingIos/TifloReadingAccessibilityPlugin.swift', import.meta.url), 'utf8');

test('documents retain direct opening and explicit HTML actions as an accessible fallback', () => {
  assert.match(library, /const title = makeButton\(/);
  assert.match(library, /'reading-library-actions-toggle'/);
  assert.match(library, /article\.append\(actionsToggle, details\)/);
});

test('UIKit custom actions have a matching document-level bridge and require an active document', () => {
  assert.match(native, /UIAccessibilityCustomAction\(name: name, target: self, selector: selector\)/);
  assert.match(native, /guard !documentId\.isEmpty/);
  for (const action of ['open', 'details', 'rename', 'delete']) {
    assert.ok(native.includes('emit("' + action + '")'), action);
    assert.ok(library.includes("action === '" + action + "'"), action);
  }
});

test('delete still requires a second explicit confirmation', () => {
  assert.match(library, /const deleteButton = makeButton/);
  assert.match(library, /const confirm = makeButton/);
  assert.match(library, /deleteButton\.click\(\)/);
});

test('native actions are cleared when the library is refreshed', () => {
  assert.match(library, /NativeDocumentAccessibility\.clearDocumentActions\(\)/);
});

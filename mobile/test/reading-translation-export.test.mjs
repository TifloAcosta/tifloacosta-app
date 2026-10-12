import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const panel = readFileSync(new URL('../src/screens/reading-translation-panel.mjs', import.meta.url), 'utf8');
const native = readFileSync(new URL('../ios-native/ios/Sources/TifloReadingIos/TifloReadingExportPlugin.swift', import.meta.url), 'utf8');

test('export is exposed only for completed translated documents', () => {
  assert.match(panel, /exportButton\.hidden = !complete \|\| !state\.document\?\.blocks\?\.length/);
  assert.match(panel, /state\?\.status !== 'complete'/);
  assert.match(panel, /state\.document\.blocks\.map/);
});

test('export uses iOS native share sheet and allows saving a UTF-8 TXT file', () => {
  assert.match(native, /UIActivityViewController/);
  assert.match(native, /encoding: \.utf8/);
  assert.match(panel, /NativeExport\.shareTextFile/);
  assert.match(panel, /exportButton\.addEventListener\('click'/);
});

test('translation continues using existing persisted derived content', () => {
  assert.match(panel, /getDerivedContent/);
  assert.match(panel, /saveDerivedContent/);
});

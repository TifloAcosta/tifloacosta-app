import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const reader = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');
const sheet = reader.slice(reader.indexOf('private var audioExportSheet: some View'), reader.indexOf('private func exportText()'));

test('export format engine and voice are VoiceOver adjustable', () => {
  for (const title of ['Formato', 'Motor', 'Voz']) {
    assert.match(sheet, new RegExp(`NativeAdjustableChoice\\(\\s*title: "${title}"`));
  }
  assert.doesNotMatch(sheet, /Picker\(/);
});

test('DAISY document language is adjustable', () => {
  assert.match(sheet, /NativeAdjustableChoice\(\s*title: "Idioma del contenido"/);
});

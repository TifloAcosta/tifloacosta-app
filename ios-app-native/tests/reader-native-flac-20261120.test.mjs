import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const reader = readFileSync(new URL('../Sources/NativeReaderFormats.swift', import.meta.url), 'utf8');

test('TifloLector also accepts FLAC through the Apple-native media import path', () => {
  const supported = reader.slice(reader.indexOf('private static let audioExtensions'), reader.indexOf('private static let textExtensions'));
  assert.match(supported, /"flac"/);
  assert.match(reader, /audioExtensions\.contains\(ext\)/);
});

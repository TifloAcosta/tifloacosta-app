import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../Sources/NativeInternetArchiveMusic.swift', import.meta.url), 'utf8');
const screen = source.slice(source.indexOf('private struct NativeArchiveRecordingScreen'), source.indexOf('struct NativeInternetArchiveScreen'));

test('Archive recording screen exposes AVPlayer failures to VoiceOver', () => {
  assert.match(screen, /if let error = player\.error \{ Text\(error\) \}/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const formats=readFileSync(new URL('../Sources/NativeReaderFormats.swift',import.meta.url),'utf8');
const reader=readFileSync(new URL('../Sources/NativeTifloLector.swift',import.meta.url),'utf8');
const share=readFileSync(new URL('../ShareExtension/ShareViewController.swift',import.meta.url),'utf8');

test('native video containers are imported without pretending they are audio',()=>{
  assert.match(formats,/videoExtensions: Set<String>/);
  for(const ext of ['mp4','m4v','mov']) assert.ok(formats.includes('"'+ext+'"'),ext);
  assert.match(formats,/audioExtensions\.contains\(ext\) \|\| videoExtensions\.contains\(ext\)/);
});
test('TifloLector routes video to AVKit and persists actual playback seconds',()=>{
  assert.match(reader,/import AVKit/);
  assert.match(reader,/struct NativeReaderVideoScreen: View/);
  assert.match(reader,/VideoPlayer\(player:/);
  assert.match(reader,/NativeReaderFormats\.isVideo\(document\)/);
  assert.match(reader,/library\.saveAudioPosition\(document, track: 0,/);
});
test('iOS sharing accepts Apple-native movie containers',()=>{
  for(const ext of ['mp4','m4v','mov']) assert.ok(share.includes('"'+ext+'"'),ext);
});

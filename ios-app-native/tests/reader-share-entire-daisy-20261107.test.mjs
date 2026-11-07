import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../Sources/NativeTifloLector.swift',import.meta.url),'utf8');
test('DAISY complete-share uses original ZIP or DAISY not extracted audio track',()=>{
  assert.match(source,/Button\("Compartir DAISY completo"\)/);
  assert.match(source,/NativeReaderFormats\.originalURL\(for: latest\)/);
  assert.match(source,/sharePackageURL = complete/);
  assert.match(source,/Button\("Compartir primera pista de audio, MP3"\)/);
  assert.match(source,/sharePackageURL = url/);
});
test('a real ShareLink allows users to export the entire original file',()=>{
  assert.match(source,/\.sheet\(isPresented: Binding\(/);
  assert.match(source,/ShareLink\(item: file\)/);
  assert.match(source,/Compartir archivo fuera de TifloAcosta/);
});

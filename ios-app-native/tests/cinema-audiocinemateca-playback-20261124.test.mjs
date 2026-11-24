import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = f => readFileSync(new URL('../Sources/'+f, import.meta.url),'utf8');
const catalogue=read('NativeAudiocinematecaCatalogue.swift');
const loader=read('NativeAudiocinematecaResourceLoader.swift');
const player=read('NativeAccessibleCinemaLibrary.swift');
const browser=read('NativeAudiocinematecaBrowser.swift');
test('catalogue retains provider parts and episodes and rejects foreign origins',()=>{
  for(const field of ['peliculas','series','documentales','cortometrajes','enlaces','capitulos','enlace']) assert.ok(catalogue.includes('"'+field+'"'));
  assert.match(catalogue,/url\.host == "audiocinemateca\.com"/);
  assert.match(catalogue,/url\.user == nil, url\.password == nil/);
  assert.match(browser,/NativeAudiocinematecaPlaybackRow/);
});
test('authenticated streaming refuses redirects and checks bounded byte ranges',()=>{
  assert.match(loader,/completionHandler\(nil\)/);
  assert.match(loader,/http\.statusCode == 206/);
  assert.match(loader,/first == offset/);
  assert.match(loader,/Int64\(data\.count\) < length/);
  assert.match(loader,/NativeAudiocinematecaCredentials\.load\(\)/);
  assert.match(player,/audiocinematecaLoader\?\.cancel\(\)/);
  assert.match(player,/func openAudiocinematecaStream/);
  assert.match(browser,/player\.openAudiocinematecaStream/);
});
test('versioned cache is private and removed on account logout',()=>{
  const cache=read('NativeAudiocinematecaCache.swift');
  assert.match(cache,/cache\.version == version/);
  assert.match(cache,/completeFileProtection/);
  assert.match(read('NativeAudiocinematecaAccount.swift'),/NativeAudiocinematecaCache\.clear\(\)/);
});

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
  assert.match(browser,/player\.openAudiocinematecaPart/);
});
test('versioned cache is private and removed on account logout',()=>{
  const cache=read('NativeAudiocinematecaCache.swift');
  assert.match(cache,/cache\.version == version/);
  assert.match(cache,/completeFileProtection/);
  assert.match(read('NativeAudiocinematecaAccount.swift'),/NativeAudiocinematecaCache\.clear\(\)/);
});

test('retry creates a fresh authenticated stream with the same position reference',()=>{
  assert.match(browser,/Button\("Volver a intentar"\)\s*\{\s*startPlayback\(\)/);
  assert.match(browser,/Button\(label\)\s*\{\s*startPlayback\(\)/);
  const action=browser.slice(browser.indexOf('private func startPlayback()'));
  assert.match(action,/player\.openAudiocinematecaPart\(entry: entry, part: part, followedBy: remaining/);
  const shared = player.slice(player.indexOf('func openAudiocinematecaPart'), player.indexOf('private func cleanUpTemporaryPlayback'));
  assert.match(shared,/NativeAudiocinematecaResourceLoader\(url: part.url/);
  assert.match(shared,/openAudiocinematecaStream/);
  assert.match(shared,/reference: NativeAudiocinematecaPlaybackRow.reference\(entry: entry, part: part\)/);
  assert.doesNotMatch(read('NativeAudiocinematecaAccount.swift'),/Acceso al catálogo pendiente de validación/);
});

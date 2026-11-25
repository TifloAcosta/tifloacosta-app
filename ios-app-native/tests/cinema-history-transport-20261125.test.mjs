import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=n=>readFileSync(new URL('../Sources/'+n, import.meta.url),'utf8');
test('seek completion is scoped to player and token, with event based ending',()=>{
 const s=read('NativeAccessibleCinemaLibrary.swift');
 for(const token of ['self.seekToken == token','self.player === player','pendingRestore == nil && seekToken == nil','AVPlayerItemDidPlayToEndTime','timeControlStatus','movieQueue']) assert.ok(s.includes(token),token);
});
test('history records opaque IDs and resolves against current provider catalogue',()=>{
 const s=read('NativeCinemaHistory.swift');
 for(const token of ['SHA256.hash','completeFileProtectionUntilFirstUserAuthentication','NativeTapeTerritoryCatalogue.fetchFilms','NativeMoviesForTheBlindWork.fetchWorks','searchPublished','NativeAudiocinematecaCache.shared.refresh']) assert.ok(s.includes(token),token);
 assert.ok(read('NativeAccessibleCinema.swift').includes('Continuar viendo o escuchando'));
 assert.ok(read('NativeAudiocinematecaAccount.swift').includes('removeSource("audiocinemateca")'));
});

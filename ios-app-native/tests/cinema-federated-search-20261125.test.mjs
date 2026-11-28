import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = n => readFileSync(new URL('../Sources/'+n, import.meta.url),'utf8');
test('explicit cancellable federated search uses provider parsers and selected filters',()=>{
 const main=read('NativeAccessibleCinema.swift');
 for(const token of ['.task(id: submittedSearch)','NativeTapeTerritoryCatalogue.fetchFilms()','NativeMoviesForTheBlindWork.fetchWorks()','sourceID: sourceID, query: term, kind: selectedKind, refresh: refresh','if spanishFilter &&','submittedSearch == request','NativeAudiocinematecaCache.shared.refresh']) assert.ok(main.includes(token),token);
});
test('public Drive search stays within configured roots, paginates and reports partial coverage',()=>{
 const source=read('NativeCinemaPublicDrive.swift');
 for(const token of ['Self.publisherRoot(for: sourceID)','while state.offset < state.queue.count','try Task.checkCancellation()','ancestors: Array(pending.path.dropLast())','state.failed','storeComplete(state, sourceID: sourceID)']) assert.ok(source.includes(token),token);
 assert.ok(read('NativeCinemaPublishedDriveBrowser.swift').includes('resolveSearchHit(hit)'));
});
test('genre uses provider metadata and catalogue receives filters',()=>{
 assert.ok(read('NativeAudiocinematecaBrowser.swift').includes('entry.genre == genre'));
 assert.ok(read('NativeAccessibleCinema.swift').includes('kind: selectedKind, language: selectedLanguage'));
});

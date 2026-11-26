import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=f=>readFileSync(new URL('../Sources/'+f,import.meta.url),'utf8');
test('RAI uses official described collections and current type filter',()=>{
 const s=read('NativeRaiPlaySoundScreen.swift');
 for(const id of ['a910d15a-ac26-42da-b970-0e4f1b46c0f0','333aeffb-471a-429d-9b88-8f5b4c9e50d9','69f5b569-e19e-41d0-afe9-17a9b2861946','f93943af-3ab2-4bc8-b6bf-c288ccd4f755']) assert.ok(s.includes(id));
 assert.match(read('NativeAccessibleCinema.swift'),/NativeRaiPlaySoundScreen\(kind: selectedKind\)/);
 assert.match(read('NativeAccessibleCinema.swift'),/NativeCinemaProviderScreen\(source: source, selectedKind: selectedKind, selectedLanguage: selectedLanguage, query: searchText\)/);
 assert.doesNotMatch(s,/AVPlayer|URLSession/);
});

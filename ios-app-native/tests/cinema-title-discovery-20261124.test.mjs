import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=f=>readFileSync(new URL('../Sources/'+f,import.meta.url),'utf8');
test('title discovery is separate from playback and links to official directories',()=>{
 const s=read('NativeAccessibleCinema.swift');
 const section=s.slice(s.indexOf('Section("Dónde ver una película")'),s.indexOf('Section("Mi colección personal")'));
 assert.match(section,/https:\/\/adp\.acb\.org\/adp-search/);
 assert.match(section,/https:\/\/audiodescription\.culture\.gouv\.fr\//);
 assert.match(section,/is_free=1/);
 assert.match(section,/selectedLanguage == \.english/);
 assert.match(section,/selectedLanguage == \.french/);
 assert.doesNotMatch(section,/AVPlayer|URLSession/);
 for(const lang of ['en','fr','it','de','pt']) for(const key of ['Dónde ver una película','Películas gratuitas']) assert.ok(read(lang+'.lproj/Localizable.strings').includes('"'+key+'" = '));
});

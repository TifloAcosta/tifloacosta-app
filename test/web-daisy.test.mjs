import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseDaisyArchive } from '../shared/web-daisy-archive.mjs';
function fakeZip(entries) {
 const files=Object.fromEntries(Object.keys(entries).map(key=>[key,{dir:false}]));
 return {files,file:key=>entries[key] === undefined ? null : {async:async()=>entries[key]}};
}
test('DAISY 2 NCC preserves SMIL chapter order and text content',async()=>{
 const book=await parseDaisyArchive(fakeZip({
  'ncc.html':'<a href="chapter2.smil">Second</a><a href="chapter1.smil">First</a>',
  'chapter1.smil':'<smil><text src="one.html#p1"/></smil>',
  'chapter2.smil':'<smil><text src="two.html#p1"/><audio src="sound.mp3"/></smil>',
  'one.html':'<body><p>First chapter.</p></body>',
  'two.html':'<body><p>Second chapter.</p></body>',
  'sound.mp3':'audio'
 }));
 assert.equal(book.hasText,true);
 assert.equal(book.hasAudio,true);
 assert.deepEqual(book.sections.map(s=>s.path),['two.html','one.html']);
 assert.deepEqual(book.audioFiles,['sound.mp3']);
});
test('DAISY rejects unrelated ZIP archives and unsafe external references',async()=>{
 await assert.rejects(()=>parseDaisyArchive(fakeZip({'a.txt':'hello'})),/daisy-signature-missing/);
 const book=await parseDaisyArchive(fakeZip({'ncc.html':'<a href="index.smil">One</a>',
 'index.smil':'<smil><text src="https://remote.example/a.html"/><text src="page.html"/></smil>',
 'page.html':'<body>Local content</body>'}));
 assert.equal(book.sections.length,1);
 assert.equal(book.text,'Local content');
});

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

test('DAISY audio-only archive exposes ordered audio tracks',async()=>{
 const book=await parseDaisyArchive(fakeZip({
  'ncc.html':'<a href="first.smil">One</a><a href="second.smil">Two</a>',
  'first.smil':'<smil><audio src="audio/1.mp3"/></smil>',
  'second.smil':'<smil><audio src="audio/2.mp3"/></smil>',
  'audio/1.mp3':'one','audio/2.mp3':'two'
 }));
 assert.equal(book.hasText,false);
 assert.equal(book.hasAudio,true);
 assert.deepEqual(book.audioFiles,['audio/1.mp3','audio/2.mp3']);
});
test('web reader provides audio playlist and preserves existing playback controls',async()=>{
 const source=await readFile(new URL('../web-reading.js',import.meta.url),'utf8');
 assert.match(source,/async function useDaisyAudio/);
 assert.match(source,/audio\.addEventListener\('ended'/);
 assert.match(source,/prepared\.format === 'daisy-audio'/);
 assert.match(source,/ensureAudioTools\(\)\.append\(controller\)/);
});

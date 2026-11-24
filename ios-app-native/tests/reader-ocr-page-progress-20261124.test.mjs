import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../Sources/'+name,import.meta.url),'utf8');
test('PDF and image processing reports page progress and releases temporary image memory',()=>{
 const s=read('NativeReaderFormats.swift');
 assert.ok(s.includes('onPage?(index + 1, pdf.pageCount)'));
 assert.ok(s.includes('onPage?(1, 1)'));
 assert.ok(s.includes('autoreleasepool { try ocrPDFPage'));
});
test('selected files and folders use asynchronous OCR with rollback',()=>{
 const s=read('NativeTifloLector.swift');
 for(const key of ['Task.detached(priority: .userInitiated)', 'try await importWithPageProgress(from: file', 'try await importWithPageProgress(from: url', 'documents.removeAll { $0.id == identifier }','NativeReaderFormats.deleteOriginal(for: identifier)']) assert.ok(s.includes(key),key);
 for(const lang of ['en','fr','de','it','pt']) assert.ok(read(lang+'.lproj/Localizable.strings').includes('"Procesando página %d de %d: %@" ='));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src=new URL('../Sources/',import.meta.url);
const reader=readFileSync(new URL('NativeTifloLector.swift',src),'utf8');
const formats=readFileSync(new URL('NativeReaderFormats.swift',src),'utf8');

test('import preserves exact original file bytes, separately from readable text',()=>{
 assert.match(reader,/var originalFilePath: String\? = nil/);
 assert.match(reader,/NativeReaderFormats\.storeOriginal\(/);
 assert.match(reader,/originalFilePath: originalFilePath/);
 assert.match(formats,/FileManager\.default\.copyItem\(at: source, to: destination\)/);
 assert.match(formats,/ReaderOriginals/);
});
test('original is shared only when a real saved file exists',()=>{
 assert.match(formats,/static func originalURL\(for document: NativeReadingDocument\) -> URL\?/);
 assert.match(formats,/FileManager\.default\.fileExists\(atPath: url\.path\)/);
 assert.match(reader,/Button\("Compartir documento original"\)/);
 assert.match(reader,/\.disabled\(NativeReaderFormats\.originalURL\(for: latest\) == nil\)/);
 assert.match(reader,/NativeShare\.present\(url: url\)/);
});
test('extracted text remains a separate TXT action and legacy library stays decodable',()=>{
 assert.match(reader,/Button\("Exportar texto extraído \(TXT\)"\)/);
 assert.match(reader,/latest\.body\.write\(to: url/);
 assert.match(reader,/puede haberse importado antes de incorporar esta función/);
 assert.match(formats,/for directory in \["ReaderMedia", "ReaderOriginals"\]/);
});

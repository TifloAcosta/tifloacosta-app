import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../Sources/NativeReaderFormats.swift',import.meta.url),'utf8');
test('archive enumeration bounds rejected entries and directories before filtering',()=>{
 assert.match(source,/for entry in archive \{[\s\S]{0,400}scannedEntries \+= 1[\s\S]{0,100}guard scannedEntries <= 8000/);
 assert.match(source,/entries <= 4000/);
 assert.match(source,/entry\.uncompressedSize <= UInt64\(sizeLimit - total\)/);
});

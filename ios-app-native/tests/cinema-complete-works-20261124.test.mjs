import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../Sources/NativeMoviesForTheBlind.swift',import.meta.url),'utf8');
test('multipart films require every numbered part and a consistent declared total',()=>{
 assert.ok(source.includes('values.count == total'));
 assert.ok(source.includes('Set(values.map { $0.0 }) == Set(1...total)'));
 assert.ok(source.includes('values.allSatisfy({ $0.1 == total })'));
 assert.ok(source.includes('values.sorted { $0.0 < $1.0 }'));
});

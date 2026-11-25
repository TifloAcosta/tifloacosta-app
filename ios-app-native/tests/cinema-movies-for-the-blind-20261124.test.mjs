import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = f => readFileSync(new URL('../Sources/'+f, import.meta.url),'utf8');
test('Movies for the Blind uses the public RSS and shared player',()=>{
 const source=read('NativeMoviesForTheBlind.swift');
 assert.ok(source.includes('https://media.rss.com/movies-for-the-blind/feed.xml'));
 assert.match(source,/NativeRSSParser\(\)/);
 assert.match(source,/shouldResolveExternalEntities = false/);
 assert.match(source,/NativeCinemaAudioPlayer/);
 assert.match(source,/library\.progress\(for: part\)/);
 assert.match(source,/followedBy: Array\(upcoming\)/);
 assert.match(source,/player\.openMoviePart/);
 assert.match(read('NativeAccessibleCinema.swift'),/NativeMoviesForTheBlindScreen\(\)/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=n=>readFileSync(new URL('../Sources/'+n,import.meta.url),'utf8');
test('search and playlist never revisit a successfully consumed page token',()=>{
 for(const n of ['NativeYouTubePlayer.swift','NativeYouTubePlaylist.swift']){
  const s=read(n);
  assert.match(s,/consumedPageTokens.removeAll\(\)/);
  assert.match(s,/consumedPageTokens.insert\(requestedPageToken\)/);
  assert.match(s,/consumedPageTokens.contains\(page.nextPageToken\)/);
  assert.match(s,/try Task.checkCancellation\(\)\s+let page = try JSONDecoder/);
 }
});
test('closed and externally paused iframe cannot resume or advance from delayed messages',()=>{
 const s=read('NativeYouTubePlayer.swift');
 assert.match(s,/func report\(_ data: \[String: Any\]\) \{\s+guard webView != nil/);
 assert.match(s,/playing = state == 1 && !externallyPaused/);
 assert.match(s,/hasPlayed && error == nil && !externallyPaused/);
 assert.match(s,/func stop\(\) \{\s+externallyPaused = true\s+playing = false/);
});

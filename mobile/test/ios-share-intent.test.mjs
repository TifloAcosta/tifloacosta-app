import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyIosReceived, freshestUnseenReceipt, httpUrlFromReceivedText } from '../src/core/ios-share-intent.mjs';

test('shared TXT and MP3 route to reader, preserving their original filename', () => {
  assert.deepEqual(classifyIosReceived({ kind:'file', name:'Lectura.txt' }), {
    type:'document', canImport:true, filename:'Lectura.txt'
  });
  assert.deepEqual(classifyIosReceived({ kind:'file', name:'Grabación.mp3', contentType:'audio/mpeg' }), {
    type:'audio', canImport:true, filename:'Grabación.mp3'
  });
});
test('EPUB, PDF and DAISY are recognized but never falsely offered as imported', () => {
  for(const name of ['Libro.epub', 'Escaneo.pdf', 'Libro.zip', 'Libro.docx']) {
    const route = classifyIosReceived({ kind:'file', name });
    assert.equal(route.canImport, false);
    assert.equal(route.type, 'document');
  }
});
test('YouTube URL goes to the accessible in-app player rather than external browser', () => {
  const fromWatch = classifyIosReceived({ kind:'url', name:'Enlace', preview:'https://www.youtube.com/watch?v=abcdefghijk' });
  assert.equal(fromWatch.type, 'youtube');
  assert.equal(fromWatch.videoId, 'abcdefghijk');
  assert.equal(fromWatch.url, 'https://www.youtube.com/watch?v=abcdefghijk');
  const shorts = classifyIosReceived({ kind:'text', name:'Texto', preview:'Mira https://youtube.com/shorts/abcdefghijk' });
  assert.equal(shorts.videoId, 'abcdefghijk');
});
test('regular web link is not mistaken for YouTube; text remains text', () => {
  const web = classifyIosReceived({ kind:'url', preview:'https://example.org/documento' });
  assert.deepEqual(web, { type:'web', url:'https://example.org/documento' });
  assert.deepEqual(classifyIosReceived({ kind:'text', preview:'Un párrafo sin enlaces.' }), {
    type:'text', text:'Un párrafo sin enlaces.'
  });
  assert.equal(httpUrlFromReceivedText('hola'), '');
});
test('only recent, unseen receipts trigger contextual foreground navigation', () => {
  const now = Date.parse('2026-10-18T09:00:00.000Z');
  const items = [
    { id:'new', createdAt:new Date(now - 60000).toISOString() },
    { id:'old', createdAt:new Date(now - 3600000).toISOString() }
  ];
  assert.equal(freshestUnseenReceipt(items, { now })?.id, 'new');
  assert.equal(freshestUnseenReceipt(items, { now, lastSeenId:'new' }), null);
  assert.equal(freshestUnseenReceipt(items, { now, maxAgeMs:10000 }), null);
  assert.equal(freshestUnseenReceipt([{ id:'future',createdAt:new Date(now+5000).toISOString() }], {now}), null);
});

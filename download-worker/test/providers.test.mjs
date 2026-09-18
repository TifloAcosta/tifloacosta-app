import assert from 'node:assert/strict';
import test from 'node:test';
import { detectProvider, fileTypeFrom, nameFromHeaders, isLikelyDownloadLink, dedupeCandidates } from '../src/providers.js';

test('detects named providers', () => {
  const cases = [
    ['https://drive.google.com/file/d/x/view','google-drive'], ['https://dropbox.com/s/a','dropbox'],
    ['https://1drv.ms/u/a','onedrive'], ['https://www.icloud.com/iclouddrive/a','icloud-drive'],
    ['https://app.box.com/s/a','box'], ['https://mega.nz/file/a#b','mega'],
    ['https://we.tl/t-a','wetransfer'], ['https://mediafire.com/file/a/x.zip/file','mediafire'],
    ['https://u.pcloud.link/publink/show?code=a','pcloud']
  ];
  for (const [url, expected] of cases) assert.equal(detectProvider(new URL(url)), expected);
});

test('derives file types and names safely', () => {
  assert.equal(fileTypeFrom('manual.pdf','application/pdf'), 'pdf');
  assert.equal(fileTypeFrom('audio','audio/mpeg'), 'mp3');
  const headers = new Headers({ 'content-disposition': 'attachment; filename="guide.docx"' });
  assert.equal(nameFromHeaders(new URL('https://example.com/download'), headers), 'guide.docx');
});

test('recognizes likely download links and deduplicates them', () => {
  const base = new URL('https://example.com/page');
  assert.equal(isLikelyDownloadLink(new URL('/files/a.pdf', base), { download: null }), true);
  assert.equal(isLikelyDownloadLink(new URL('/view', base), { download: 'a.bin' }), true);
  const items = dedupeCandidates([
    { url:'https://example.com/a.pdf', name:'a.pdf' },
    { url:'https://example.com/a.pdf', name:'duplicate.pdf' },
    { url:'https://example.com/b.zip', name:'b.zip' }
  ]);
  assert.equal(items.length, 2);
});

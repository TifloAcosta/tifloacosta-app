import assert from 'node:assert/strict';
import test from 'node:test';
import core from '../downloads-core.js';

test('rejects unsafe schemes', () => {
  assert.equal(core.normalizeUrl('javascript:alert(1)'), null);
  assert.equal(core.normalizeUrl('file:///tmp/a.pdf'), null);
});

test('classifies supported providers', () => {
  const cases = [
    ['https://drive.google.com/file/d/abc123/view', 'google-drive'],
    ['https://www.dropbox.com/scl/fi/abc/file.pdf?rlkey=x&dl=0', 'dropbox'],
    ['https://1drv.ms/u/s!abc', 'onedrive'],
    ['https://www.icloud.com/iclouddrive/abc', 'icloud-drive'],
    ['https://app.box.com/s/abc', 'box'],
    ['https://mega.nz/file/abc#key', 'mega'],
    ['https://we.tl/t-abc', 'wetransfer'],
    ['https://www.mediafire.com/file/abc/test.zip/file', 'mediafire'],
    ['https://u.pcloud.link/publink/show?code=abc', 'pcloud']
  ];
  for (const [url, expected] of cases) assert.equal(core.classifyUrl(url).provider, expected);
});

test('resolves Drive, Dropbox and direct files locally', () => {
  const drive = core.resolveLocal('https://drive.google.com/file/d/abc123/view');
  assert.match(drive.items[0].url, /drive\.google\.com\/uc\?export=download&id=abc123/);
  const dropbox = core.resolveLocal('https://www.dropbox.com/scl/fi/abc/file.pdf?rlkey=x&dl=0');
  assert.equal(new URL(dropbox.items[0].url).searchParams.get('dl'), '1');
  assert.equal(core.resolveLocal('https://example.org/manual.pdf').items[0].type, 'pdf');
});

test('filters without mutating all results', () => {
  const items = [{name:'manual.pdf',type:'pdf'},{name:'audio.mp3',type:'audio'}];
  assert.deepEqual(core.filterResults(items, 'man', 'all').map(x => x.name), ['manual.pdf']);
  assert.equal(items.length, 2);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { daisyClockMs, resolveDaisyZipPath, parseDaisyArchive } from '../shared/web-reading-daisy-adapter.mjs';

test('DAISY ZIP references are resolved only inside the package', () => {
  assert.equal(resolveDaisyZipPath('OEBPS/chapter.smil', 'text/section.xhtml#p1'), 'OEBPS/text/section.xhtml');
  assert.equal(resolveDaisyZipPath('OEBPS/chapter.smil', '../media/voice.mp3#x'), 'media/voice.mp3');
  for (const unsafe of ['../../outside', 'https://evil.example/x', '/absolute.xml', '\\evil', '%2fabsolute', '%5cwindows']) {
    assert.equal(resolveDaisyZipPath('OEBPS/chapter.smil', unsafe), '', unsafe);
  }
});

test('SMIL clip offsets support NPT and clock notation', () => {
  assert.equal(daisyClockMs('npt=01:02:03.5'), 3723500);
  assert.equal(daisyClockMs('00:00:12.25'), 12250);
  assert.equal(daisyClockMs('12.5s'), 12500);
  assert.equal(daisyClockMs('invalid'), 0);
});

test('DAISY reader does not mistake arbitrary ZIPs for supported DAISY books', async () => {
  await assert.rejects(
    parseDaisyArchive({ files: { 'arbitrary.txt': { dir: false } } }),
    error => error?.code === 'not-daisy'
  );
});

test('iOS ZIP importer distinguishes DAISY text from unsupported audio-only DAISY', async () => {
  const [web, html, entry, library, build] = await Promise.all([
    readFile(new URL('../web-reading.js', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../shared/web-entry.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../shared/web-reading-library-adapter.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../ios-build/prepare-web.mjs', import.meta.url), 'utf8')
  ]);
  assert.match(html, /id="reading-file"[^>]+\.zip/);
  assert.match(web, /shared\.parseDaisyArchive/);
  assert.match(web, /format === 'daisy2\.02' \|\| format === 'daisy3'/);
  assert.match(web, /daisy-audio-only/);
  assert.match(web, /audioUnavailable/);
  assert.match(entry, /web-reading-daisy-adapter/);
  assert.match(library, /'daisy2\.02','daisy3'/);
  assert.match(build, /BLOQUEO PREVENTIVO iOS/);
});

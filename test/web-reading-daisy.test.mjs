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

test('DAISY 2.02 NCC and SMIL form a navigable text book without falsely enabling audio', async () => {
  const originalParser = globalThis.DOMParser;
  class FixtureParser {
    parseFromString(source) {
      if (source === 'NCC') return {
        querySelectorAll: () => [{
          tagName: 'H1', textContent: 'Capítulo uno',
          querySelector: () => ({ getAttribute: () => 'chapter.smil#nav1' })
        }]
      };
      if (source === 'SMIL') {
        const textNode = { getAttribute: key => key === 'src' ? 'chapter.html#p1' : null };
        const audioNode = { getAttribute: key => ({
          src: 'chapter.mp3', 'clip-begin': 'npt=5.25s', 'clip-end': 'npt=9.50s'
        })[key] || null };
        const par = { getElementsByTagNameNS: (ns, name) =>
          name === 'text' ? [textNode] : name === 'audio' ? [audioNode] : [] };
        return {
          getElementsByTagNameNS: (ns, name) => name === 'par' ? [par] : [],
          querySelector: () => null
        };
      }
      if (source === 'CHAPTER') return {
        querySelectorAll: () => [{
          tagName: 'H2', textContent: 'Comienzo del capítulo'
        }, { tagName: 'P', textContent: 'Un párrafo de prueba.' }]
      };
      throw new Error('unknown fixture source');
    }
  }
  globalThis.DOMParser = FixtureParser;
  try {
    const files = Object.fromEntries([
      ['ncc.html', 'NCC'], ['chapter.smil', 'SMIL'], ['chapter.html', 'CHAPTER'], ['chapter.mp3', 'AUDIO']
    ].map(([key, source]) => [key, { dir: false, async: async () => source }]));
    const zip = { files, file: name => files[name] || null };
    const result = await parseDaisyArchive(zip, { title: 'Libro DAISY', language: 'es' });
    assert.equal(result.format, 'daisy2.02');
    assert.deepEqual(result.navigation.map(item => item.label), ['Capítulo uno']);
    assert.equal(result.containsAudio, true);
    assert.equal(result.audioClips.length, 1);
    assert.equal(result.audioClips[0].clipBeginMs, 5250);
    assert.equal(result.audioClips[0].clipEndMs, 9500);
    assert.deepEqual(result.blocks.map(item => item.text), ['Comienzo del capítulo', 'Un párrafo de prueba.']);
    assert.deepEqual(result.mediaSyncReferences, [{
      textHref: 'chapter.html', audioHref: 'chapter.mp3',
      clipBeginMs: 5250, clipEndMs: 9500
    }]);
  } finally {
    globalThis.DOMParser = originalParser;
  }
});



test('audio-only DAISY 2.02 uses NCC headings as navigable content and retains clip positions', async () => {
  const parser = { parseFromString(source) {
    if (source === 'ncc') return { querySelectorAll: () => [{
      tagName: 'H1', textContent: 'Primer capítulo',
      querySelector: () => ({ getAttribute: () => 'chapter.smil#sec' })
    }] };
    if (source === 'smil') {
      const audio = { getAttribute: key => ({
        src: 'voice.mp3', 'clip-begin': 'npt=1.5s', 'clip-end': 'npt=15s'
      })[key] || '' };
      const par = {
        getAttribute: key => key === 'id' ? 'sec' : '',
        getElementsByTagNameNS: (ns, name) => name === 'audio' ? [audio] : []
      };
      return { getElementsByTagNameNS: (ns, name) => name === 'par' ? [par] : [],
        querySelector: () => null };
    }
    throw new Error('unexpected');
  }};
  const files = Object.fromEntries([['ncc.html','ncc'],['chapter.smil','smil'],['voice.mp3','raw']]
    .map(([name,value]) => [name,{dir:false,async: async()=>value}]));
  const daisy = await parseDaisyArchive({files,file:name=>files[name]||null},
    {title:'Libro de audio',language:'es',parser});
  assert.equal(daisy.blocks[0].text, 'Primer capítulo');
  assert.equal(daisy.blocks[0].type, 'heading');
  assert.equal(daisy.navigation[0].smilId,'sec');
  assert.deepEqual(daisy.audioClips, [{
    smilPath:'chapter.smil',smilId:'sec',audioHref:'voice.mp3',textHref:'',
    clipBeginMs:1500,clipEndMs:15000
  }]);
});

test('packaged DAISY playback actually loads audio clips and persists SMIL track/time', async () => {
  const [reader, adapter, library] = await Promise.all([
    readFile(new URL('../web-reading.js',import.meta.url),'utf8'),
    readFile(new URL('../shared/web-reading-daisy-adapter.mjs',import.meta.url),'utf8'),
    readFile(new URL('../shared/web-reading-library-adapter.mjs',import.meta.url),'utf8')
  ]);
  assert.match(reader,/async function useDaisyAudioFile\(/);
  assert.match(reader,/async function seekSynchronizedDaisyClip\(/);
  assert.match(reader,/async function playSynchronizedDaisyAudio\(/);
  assert.match(reader,/async function resumeSynchronizedDaisyClip\(/);
  assert.match(reader,/zip\.file\(clip\.audioHref\)/);
  assert.match(reader,/audio\.src = audioObjectUrl/);
  assert.match(reader,/mediaTrackIndex: clipIndex, mediaPositionMs: currentMs/);
  assert.match(reader,/navigation\.id = 'reading-daisy-navigation-controls'/);
  assert.match(reader,/await useDaisyAudioFile\(storedDaisy\.blob/);
  assert.match(reader,/daisyPackage/);
  assert.match(adapter,/const audioClips = \[\]/);
  assert.match(adapter,/if \(!blocks.length && !audioClips.length\)/);
  assert.match(library,/async function importDaisyArchive\(/);
  assert.match(library,/async function openDaisyArchive\(/);
  assert.match(library,/blob: file\.slice\(0, file\.size, 'application\/zip'\)/);
});

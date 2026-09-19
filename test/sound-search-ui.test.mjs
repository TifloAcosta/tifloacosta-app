import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('sound search has labelled controls, live status and stable child route', async () => {
  const source = await read('sound-search.js').catch(() => '');
  for (const id of ['sound-search-section','sound-search-form','sound-query','sound-category','sound-provider','sound-status','sound-results']) {
    assert.match(source, new RegExp(id));
  }
  assert.match(source, /aria-live/);
  assert.match(source, /downloads-sounds/);
  assert.match(source, /window\.location\.hash\s*=\s*'#downloads'/);
});

test('sound search supports bilingual categories and requires term or category', async () => {
  const source = await read('sound-search.js').catch(() => '');
  assert.match(source, /core\.categories/);
  assert.match(source, /core\.validateSearch/);
  assert.match(source, /Escribe algo para buscar o elige una categoría/);
  assert.match(source, /Enter something to search for or choose a category/);
});

test('preview never autoplays and stops previous audio', async () => {
  const source = await read('sound-search.js').catch(() => '');
  assert.doesNotMatch(source, /autoplay\s*=\s*true/);
  assert.match(source, /activeAudio/);
  assert.match(source, /activeAudio\.pause\(\)/);
  assert.match(source, /preload\s*=\s*'none'/);
});

test('sound result actions contain the sound name and safe external navigation', async () => {
  const source = await read('sound-search.js').catch(() => '');
  assert.match(source, /item\.name/);
  assert.match(source, /noopener noreferrer/);
  assert.match(source, /Abrir para descargar/);
  assert.match(source, /Open to download/);
});

test('missing metadata is omitted while known duration, format and size can be rendered', async () => {
  const source = await read('sound-search.js').catch(() => '');
  assert.match(source, /item\.duration\s*!==\s*null/);
  assert.match(source, /item\.format/);
  assert.match(source, /item\.size\s*!==\s*null/);
  assert.match(source, /downloadCore\.formatBytes/);
});

test('provider failure remains recoverable and external sound banks stay visible', async () => {
  const source = await read('sound-search.js').catch(() => '');
  assert.match(source, /externalBanks/);
  assert.match(source, /Mixkit/);
  assert.match(source, /Pixabay/);
  assert.match(source, /No se pudo completar la búsqueda interna/);
  assert.match(source, /The internal search could not be completed/);
});

test('app core loads sound-search modules in dependency order', async () => {
  const source = await read('app-core.js');
  const core = source.indexOf('sound-search-core.js?v=1.0');
  const config = source.indexOf('sound-search-config.js?v=1.0');
  const ui = source.indexOf('sound-search.js?v=1.0');
  assert.ok(core >= 0 && config > core && ui > config);
  assert.match(source, /data-tiflo-sound-core/);
  assert.match(source, /data-tiflo-sound-config/);
  assert.match(source, /data-tiflo-sound-ui/);
});

import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function loadCore() {
  const source = await readFile(new URL('../sound-search-core.js', import.meta.url), 'utf8');
  const context = { window:{} };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.window.TIFLO_SOUND_CORE;
}

test('term or category is required', async () => {
  const core = await loadCore();
  assert.equal(core.validateSearch('', '').ok, false);
  assert.equal(core.validateSearch('campana', '').ok, true);
  assert.equal(core.validateSearch('', 'notifications').ok, true);
});

test('term and category combine for provider queries', async () => {
  const core = await loadCore();
  assert.equal(core.buildProviderQuery('campana', 'notifications'), 'campana notification alert');
});

test('missing metadata stays unknown instead of becoming zero', async () => {
  const core = await loadCore();
  const item = core.normalizeResult({ id:1, name:'Bell', size:null, duration:null }, 'freesound');
  assert.equal(item.size, null);
  assert.equal(item.duration, null);
  assert.equal(item.format, null);
  assert.equal(item.license, null);
  assert.equal(item.previewUrl, null);
});

test('merge deduplicates provider/id and ignores malformed groups', async () => {
  const core = await loadCore();
  const a = core.normalizeResult({ id:1, name:'A' }, 'freesound');
  const b = core.normalizeResult({ id:2, name:'B' }, 'freesound');
  const ids = core.mergeResults([[a,a], null, [b]], 20).map(item => item.id).join(',');
  assert.equal(ids, '1,2');
});

test('duration formatting is compact and screen-reader friendly', async () => {
  const core = await loadCore();
  assert.equal(core.formatDuration(61.2), '1:01');
  assert.equal(core.formatDuration(null), '');
});

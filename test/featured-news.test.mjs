import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const core = require('../app-core.js');
const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('featured news uses an explicit three-item priority per language', async () => {
  const source = await read('data.js');
  const context = { window: {}, document: undefined };
  vm.runInNewContext(source, context);
  const resources = context.window.TIFLO_RESOURCES;

  for (const lang of ['es', 'en']) {
    const configured = core.getFeaturedNewsIds(lang);
    assert.equal(configured.length, 3);

    for (const id of configured) {
      const item = resources.find(resource => resource.id === id);
      assert.ok(item, `Missing configured news item: ${id}`);
      assert.equal(item.lang, lang);
      assert.equal(item.new, true);
    }

    const selected = resources
      .filter(item => item.lang === lang && item.new)
      .sort(core.compareNewsItems)
      .slice(0, 3)
      .map(item => item.id);

    assert.deepEqual([...selected], configured);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const browser = require('../../resource-browser-core.js');
const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const inventory = JSON.parse(read('../resource-audit-recursive-20261126.json'));
const audit = JSON.parse(read('../resource-audit-final-reconciled-20261127.json'));
const resources = JSON.parse(read('../../data.js').replace(/^window\.TIFLO_RESOURCES\s*=\s*/, '').replace(/;\s*$/, ''));
const mobile = JSON.parse(read('../../mobile-content.json')).resources;
const catalog = new Map(resources.map(x => [x.id,x]));
const mobileCatalog = new Map(mobile.map(x => [x.id,x]));
test('all inventoried active source HTML resolves to both catalogs and a local document', () => {
  assert.equal(Object.keys(audit.mappings).length, inventory.documents.length);
  assert.equal(catalog.size, resources.length);
  assert.equal(mobileCatalog.size, mobile.length);
  for (const original of inventory.documents) {
    const id = audit.mappings[original.id];
    const item = catalog.get(id), other = mobileCatalog.get(id);
    assert.ok(item && other, original.id);
    assert.equal(item.lang, original.lang);
    assert.equal(other.lang, original.lang);
    assert.equal(item.url, other.url);
    assert.equal(item.category, other.category);
    assert.deepEqual(item.folderPath || [], other.folderPath || []);
    if (original.path.length > 1 && !['Píldoras','Pills'].includes(original.path[0])) {
      assert.equal(item.category, original.path[0], original.id);
      assert.deepEqual(item.folderPath || [], original.path.slice(1,-1), original.id);
      let path = [];
      const scoped = resources.filter(x => x.lang===original.lang && x.category===item.category);
      for (const folder of item.folderPath || []) {
        assert.ok(browser.folderGroups(scoped,path).folders.some(x=>x.name===folder), original.id);
        path.push(folder);
      }
      assert.ok(browser.folderGroups(scoped,path).direct.some(x=>x.id===item.id), original.id);
      assert.ok(browser.filterAndSort(scoped,[item.category,...path].join(' '),'title',original.lang).some(x=>x.id===item.id), original.id);
    }
    const url = new URL(item.url);
    if(url.hostname==='tifloacosta.com' && url.pathname.startsWith('/docs/')) {
      assert.ok(fs.existsSync(new URL('../..'+url.pathname,import.meta.url)), original.id);
    }
  }
});
test('retired links point to current guides, not duplicate publications', () => {
  assert.equal(audit.archiveGroups.flatMap(x=>x.sources).length,12);
  for (const old of audit.archiveGroups.flatMap(x=>x.sources)) {
    assert.ok(!catalog.has('es-'+old.id),old.id);
    for(const id of old.targets) assert.ok(catalog.has(id)&&mobileCatalog.has(id),id);
  }
});

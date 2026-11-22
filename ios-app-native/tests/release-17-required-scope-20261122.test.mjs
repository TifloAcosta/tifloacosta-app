import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../release-readiness-1.7.json', import.meta.url), 'utf8'));
const workflow = readFileSync(new URL('../../.github/workflows/ios-native-testflight-upload.yml', import.meta.url), 'utf8');
const guardScript = readFileSync(new URL('../scripts/check-release-readiness.mjs', import.meta.url), 'utf8');

test('the approved update retains all 20 changes and mandatory Multicines', () => {
  const ids = manifest.requirements.map(x => x.id);
  assert.equal(manifest.version, '1.7');
  assert.deepEqual(ids, [...Array(20)].map((_, i) => i + 1).concat([22]));
  assert.match(manifest.requirements.at(-1).title, /Multicines Accesibles/);
  assert.ok(manifest.requirements.some(x => /RTF/.test(x.title)));
});

test('internal beta cannot build before all requirements have code', () => {
  const checkout = workflow.indexOf('- uses: actions/checkout@v4');
  const gate = workflow.indexOf('node ios-app-native/scripts/check-release-readiness.mjs');
  const xcode = workflow.indexOf('Seleccionar Xcode 26');
  assert.ok(checkout >= 0 && gate > checkout && xcode > gate);
  assert.match(guardScript, /item.status !== 'implemented'/);
  assert.match(guardScript, /throw Error\('Beta 1\.7 bloqueada/);
});

test('the implementation status inventory is not falsely marked complete', () => {
  assert.equal(manifest.requirements.find(x => x.id === 4).status, 'pending');
  assert.equal(manifest.requirements.find(x => x.id === 20).status, 'partial');
  assert.ok(manifest.requirements.some(x => x.status !== 'implemented'));
  assert.equal(manifest.requirements.find(x => x.id === 22).status, 'partial');
});

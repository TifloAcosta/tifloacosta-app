import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../release-readiness-1.7.json', import.meta.url), 'utf8'));
const workflow = readFileSync(new URL('../../.github/workflows/ios-native-testflight-upload.yml', import.meta.url), 'utf8');
const guardScript = readFileSync(new URL('../scripts/check-release-readiness.mjs', import.meta.url), 'utf8');

test('the approved update preserves earlier requirements and adds the TTS lock-screen regression', () => {
  const ids = manifest.requirements.map(x => x.id);
  assert.equal(manifest.version, '1.7');
  assert.deepEqual(ids, [...Array(20)].map((_, i) => i + 1).concat([22, 23, 24, 25, 26, 27, 28, 29]));
  for (const id of [26, 27, 28, 29]) {
    assert.equal(manifest.requirements.find(x => x.id === id).issue, '#363');
    const requirement = manifest.requirements.find(x => x.id === id);
    assert.ok(['partial', 'implemented'].includes(requirement.status));
    if (requirement.status === 'implemented') {
      assert.ok(requirement.evidence?.some(path => path.startsWith('ios-app-native/')));
      assert.ok(requirement.validation?.trim());
    }
  }
  assert.equal(manifest.requirements.find(x => x.id === 25).issue, '#362');
  assert.equal(manifest.requirements.find(x => x.id === 25).status, 'partial');
  assert.equal(manifest.requirements.find(x => x.id === 24).issue, '#361');
  assert.match(manifest.requirements.find(x => x.id === 22).title, /Multicines Accesibles/);
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
  const volume = manifest.requirements.find(x => x.id === 4);
  assert.equal(volume.status, 'implemented');
  assert.ok(volume.evidence.some(path => path.endsWith('NativeReaderGeneratedVoiceVolume.swift')));
  assert.equal(manifest.requirements.find(x => x.id === 20).status, 'partial');
  assert.ok(manifest.requirements.some(x => x.status !== 'implemented'));
  assert.equal(manifest.requirements.find(x => x.id === 22).status, 'partial');
  assert.equal(manifest.requirements.find(x => x.id === 23).status, 'partial');
});

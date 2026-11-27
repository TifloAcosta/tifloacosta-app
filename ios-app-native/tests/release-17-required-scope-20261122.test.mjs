import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../release-readiness-1.7.json', import.meta.url), 'utf8'));
const workflow = readFileSync(new URL('../../.github/workflows/ios-native-testflight-upload.yml', import.meta.url), 'utf8');
import { evaluateReadiness } from '../scripts/check-release-readiness.mjs';

test('the approved update preserves earlier requirements and adds the TTS lock-screen regression', () => {
  const ids = manifest.requirements.map(x => x.id);
  assert.equal(manifest.version, '1.7');
  assert.deepEqual(ids, [...Array(20)].map((_, i) => i + 1).concat([22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34]));
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
  assert.equal(manifest.requirements.find(x => x.id === 30).issue, '#365');
  assert.equal(manifest.requirements.find(x => x.id === 31).issue, '#352');
  for (const [id, issue] of [[32, '#352'], [33, '#366'], [34, '#367']]) {
    const requirement = manifest.requirements.find(x => x.id === id);
    assert.equal(requirement.issue, issue);
    assert.ok(['partial', 'implemented'].includes(requirement.status));
  }
  assert.match(manifest.requirements.find(x => x.id === 22).title, /Multicines Accesibles/);
  assert.ok(manifest.requirements.some(x => /RTF/.test(x.title)));
});

test('internal upload explicitly invokes the internal gate before Xcode, with evidence check', () => {
  const checkout = workflow.indexOf('- uses: actions/checkout@v4');
  const gate = workflow.indexOf('node ios-app-native/scripts/check-release-readiness.mjs --internal-beta');
  const evidence = workflow.indexOf('Verificar evidencias de auditoría de idiomas');
  const xcode = workflow.indexOf('Seleccionar Xcode 26');
  assert.ok(checkout >= 0 && gate > checkout && evidence > gate && xcode > evidence);
  assert.match(workflow, /fetch-depth: 0/);
});
test('pending language audit blocks beta and public release', () => {
  const m = structuredClone(manifest); m.internalBeta.linguisticAudit.status = 'pending';
  assert.ok(evaluateReadiness(m, 'internal-beta').blockers.some(x => x.startsWith('11:')));
  assert.ok(evaluateReadiness(manifest, 'public').blockers.length > 0);
});
test('only documented physical and external limitations may remain open in internal beta', () => {
  const m = structuredClone(manifest);
  m.requirements.find(x => x.id === 11).status = 'implemented';
  m.internalBeta.linguisticAudit = {status:'validated',validatedCommit:'a'.repeat(40),integrationRun:1,navigationRun:2,reviewEvidence:['test fixture only']};
  const verified = () => true;
  const beta = evaluateReadiness(m,'internal-beta',verified);
  assert.deepEqual(beta.blockers,[]);
  assert.equal(beta.deferred.length,m.requirements.filter(x=>x.status==='partial').length);
  assert.ok(evaluateReadiness(m,'public',verified).blockers.length>0);
  assert.ok(evaluateReadiness(m,'internal-beta',()=>false).blockers.length>0);
  m.requirements.find(x=>x.id===4).status='partial';
  assert.ok(evaluateReadiness(m,'internal-beta',verified).blockers.some(x=>x.startsWith('4:')));
  m.internalBeta.deferred.push({id:4,kind:'device-validation',evidence:['invalid fixture'],reason:'invalid'});
  assert.throws(()=>evaluateReadiness(m,'internal-beta',verified));
});
test('public gate cannot be passed by marking code implemented alone', () => {
  const m=structuredClone(manifest);
  for (const x of m.requirements) x.status='implemented';
  m.internalBeta.linguisticAudit={status:'validated',validatedCommit:'a'.repeat(40),integrationRun:1,navigationRun:2,reviewEvidence:['fixture']};
  assert.ok(evaluateReadiness(m,'public',()=>true).blockers.some(x=>x.includes('Pruebas físicas')));
  m.publicRelease={status:'validated',deviceReviewEvidence:['fixture']};
  assert.deepEqual(evaluateReadiness(m,'public',()=>true).blockers,[]);
  assert.throws(()=>evaluateReadiness(m,'unknown',()=>true));
});

test('the implementation status inventory is not falsely marked complete', () => {
  const volume = manifest.requirements.find(x => x.id === 4);
  assert.equal(volume.status, 'implemented');
  assert.ok(volume.evidence.some(path => path.endsWith('NativeReaderGeneratedVoiceVolume.swift')));
  const brailleCursor = manifest.requirements.find(x => x.id === 20);
  assert.equal(brailleCursor.status, 'implemented');
  assert.ok(brailleCursor.evidence.some(path => path.endsWith('reader-rtf-braille-cursor-stability-20261122.test.mjs')));
  assert.match(brailleCursor.validation, /línea braille/);
  assert.ok(manifest.requirements.some(x => x.status !== 'implemented'));
  assert.equal(manifest.requirements.find(x => x.id === 22).status, 'partial');
  assert.equal(manifest.requirements.find(x => x.id === 23).status, 'partial');
});

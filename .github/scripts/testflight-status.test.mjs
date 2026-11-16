import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeBuild } from './testflight-status.mjs';

test('reports external approval only for approved builds assigned to external group', () => {
  const build={id:'build-1',attributes:{version:'500159',processingState:'VALID',expired:false,uploadedDate:'2026-11-15T10:00:00Z'},relationships:{betaGroups:{data:[{id:'external'}]}}};
  const detail={attributes:{internalBuildState:'IN_BETA_TESTING',externalBuildState:'IN_BETA_TESTING'}};
  const review={attributes:{betaReviewState:'APPROVED'}};
  const groups=[{id:'external',attributes:{name:'Pruebas TifloAcosta',isInternalGroup:false,publicLinkEnabled:true,publicLink:'https://testflight.apple.com/join/espHRGF'}}];
  const result=summarizeBuild(build,detail,review,groups);
  assert.equal(result.externalApproved,true);
  assert.equal(result.externalGroups[0].name,'Pruebas TifloAcosta');
  assert.equal(result.externalGroups[0].publicLink,'https://testflight.apple.com/join/espHRGF');
});

test('pending review is not reported as approved', () => {
  const build={id:'build-2',attributes:{version:'500159',processingState:'VALID',expired:false},relationships:{betaGroups:{data:[{id:'external'}]}}};
  const groups=[{id:'external',attributes:{name:'Pruebas TifloAcosta',isInternalGroup:false}}];
  const result=summarizeBuild(build,{attributes:{externalBuildState:'WAITING_FOR_BETA_REVIEW'}},{attributes:{betaReviewState:'WAITING_FOR_REVIEW'}},groups);
  assert.equal(result.externalApproved,false);
  assert.equal(result.reviewState,'WAITING_FOR_REVIEW');
});

test('approved but unassigned build does not imply external access', () => {
  const build={id:'build-3',attributes:{version:'500159',processingState:'VALID',expired:false},relationships:{betaGroups:{data:[]}}};
  const result=summarizeBuild(build,{attributes:{externalBuildState:'IN_BETA_TESTING'}},{attributes:{betaReviewState:'APPROVED'}},[]);
  assert.equal(result.externalApproved,false);
});

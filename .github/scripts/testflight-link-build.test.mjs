import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLinkApproval, decideLink, buildLinkRequest } from './testflight-link-build.mjs';

test('accepts an explicit approval for a known group and matching filename',()=>{
  const approval={buildNumber:'500160',groupName:'Pruebas TifloAcosta',approved:true,approvedBy:'Tony Acosta'};
  assert.deepEqual(validateLinkApproval('testflight-approvals/500160-external.json',approval),
    {buildNumber:'500160',groupName:'Pruebas TifloAcosta'});
});

test('refuses unapproved requests and wrong filenames',()=>{
  const approval={buildNumber:'500160',groupName:'Pruebas TifloAcosta',approved:false,approvedBy:'Tony Acosta'};
  assert.throws(()=>validateLinkApproval('testflight-approvals/500160-external.json',approval),/aprobación expresa/);
  approval.approved=true;
  assert.throws(()=>validateLinkApproval('testflight-approvals/500159-external.json',approval),/archivo no coincide/);
});

test('does not submit duplicate group links or change an all-builds internal group',()=>{
  const build={attributes:{version:'500160',processingState:'VALID'},relationships:{betaGroups:{data:[{id:'g1'}]}}};
  const group={id:'g1',attributes:{name:'Pruebas TifloAcosta',isInternalGroup:false}};
  assert.equal(decideLink(build,group),'already-linked');
  const internal={id:'g2',attributes:{name:'Probadores TifloAcosta',isInternalGroup:true,hasAccessToAllBuilds:true}};
  assert.equal(decideLink(build,internal),'already-linked');
});

test('refuses an invalid build and prepares the correct Apple linkage payload',()=>{
  const build={id:'b1',attributes:{version:'500160',processingState:'VALID'},relationships:{betaGroups:{data:[]}}};
  const group={id:'g1',attributes:{name:'Pruebas TifloAcosta',isInternalGroup:false}};
  assert.equal(decideLink({...build,attributes:{processingState:'INVALID'}},group),'not-ready');
  assert.equal(decideLink(build,group),'link');
  assert.deepEqual(buildLinkRequest(group),{data:[{type:'betaGroups',id:'g1'}]});
});

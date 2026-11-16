import test from 'node:test';
import assert from 'node:assert/strict';
import { validateUploadApproval, dispatchUpload } from './apple-chat-upload-approval.mjs';

const requestId='11111111-2222-4333-8444-555555555555';
const sha='a'.repeat(40);
const request={requestId,action:'upload-ios-testflight',approved:true,approvedBy:'Tony Acosta',expectedBranch:'main',expectedMainSha:sha};
const path=`testflight-upload-approvals/${requestId}.json`;

test('accepts an exact upload approval for a pinned main commit',()=>{
  assert.deepEqual(validateUploadApproval(path,request),{requestId,expectedMainSha:sha});
});

test('rejects missing consent, mismatched path, wrong branch and invalid SHA',()=>{
  for(const invalid of [{...request,approved:false},{...request,approvedBy:'Another person'},{...request,expectedBranch:'apple-chat-commands'},{...request,expectedMainSha:'bad'},{...request,action:'release-production'}]){
    assert.throws(()=>validateUploadApproval(path,invalid));
  }
  assert.throws(()=>validateUploadApproval('testflight-upload-approvals/other.json',request));
});

test('rejects extra fields that might change the intended operation',()=>{
  assert.throws(()=>validateUploadApproval(path,{...request,ref:'another-branch'}));
});

test('does not dispatch if main changed after approval',async()=>{
  let calls=[];
  const fetchImpl=async(url,options)=>{calls.push({url,options});return {ok:true,status:200,json:async()=>({object:{sha:'b'.repeat(40)}})};};
  await assert.rejects(()=>dispatchUpload({requestId,expectedMainSha:sha},{fetchImpl,repo:'TifloAcosta/tifloacosta-app',token:'test'}),/ha cambiado/);
  assert.equal(calls.length,1);
});

test('dispatches existing upload workflow on main only when SHA matches',async()=>{
  const calls=[];
  const fetchImpl=async(url,options)=>{
    calls.push({url,options});
    if(calls.length===1)return {ok:true,status:200,json:async()=>({object:{sha}})};
    return {ok:true,status:204};
  };
  await dispatchUpload({requestId,expectedMainSha:sha},{fetchImpl,repo:'TifloAcosta/tifloacosta-app',token:'test'});
  assert.equal(calls.length,2);
  assert.match(calls[1].url,/ios-native-testflight-upload\.yml\/dispatches$/);
  assert.deepEqual(JSON.parse(calls[1].options.body),{ref:'main'});
});

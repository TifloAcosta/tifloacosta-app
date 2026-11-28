import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex } from '../scripts/cinema-central-index.mjs';
const folderMime='application/vnd.google-apps.folder';
const root={id:'root_00000000',name:'Root',mimeType:folderMime,resourceKey:'private_key_001'};
const child={id:'child_0000000',name:'Films',mimeType:folderMime,resourceKey:'private_key_002'};
const media={id:'movie_0000000',name:'Late title.mp3',mimeType:'audio/mpeg',size:'1234',resourceKey:'private_key_003'};
test('traverses over 40 pages, resolves folders and removes all secrets from output',async()=>{
  let calls=0;
  const snapshot=await buildIndex({sourceID:'audesc-es',root,listPage:async(folder,path,token)=>{
    calls++;
    if(folder.id===root.id){
      const page=Number(token||0);
      if(page<45)return {files:page===0?[child]:[],nextPageToken:String(page+1)};
      return {files:[]};
    }
    return {files:[media]};
  }});
  assert.equal(calls,47);
  assert.equal(snapshot.complete,true);
  assert.equal(snapshot.hits.length,1);
  assert.equal(snapshot.hits[0].entry.name,media.name);
  assert.equal(snapshot.hits[0].entry.size,1234);
  assert.deepEqual(snapshot.hits[0].path.map(p=>p.id),[root.id,child.id]);
  assert.doesNotMatch(JSON.stringify(snapshot),/resourceKey|private_key|nextPageToken|pageCursor/);
});
test('refuses incomplete, shortcut and repeated pagination; no false complete index',async()=>{
  for(const listPage of [
    async()=>({files:[],incompleteSearch:true}),
    async()=>({files:[{id:'shortcut_0000',name:'Unresolved',mimeType:'application/vnd.google-apps.shortcut'}]}),
    async()=>({files:[],nextPageToken:'repeat'})
  ]) await assert.rejects(buildIndex({sourceID:'audesc-es',root,listPage}));
});
test('does not traverse unapproved sources',async()=>{
  let called=false;
  await assert.rejects(buildIndex({sourceID:'private',root,listPage:async()=>{called=true;return {files:[]}}}));
  assert.equal(called,false);
});

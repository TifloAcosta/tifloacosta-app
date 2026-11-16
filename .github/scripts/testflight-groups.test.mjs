import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeGroups } from './testflight-groups.mjs';

test('reports group type, tester counts and builds without exposing tester information',()=>{
  const groups=[
    {id:'internal',attributes:{name:'Probadores TifloAcosta',isInternalGroup:true,publicLinkEnabled:false,hasAccessToAllBuilds:true}},
    {id:'external',attributes:{name:'Pruebas TifloAcosta',isInternalGroup:false,publicLinkEnabled:true,publicLink:'https://testflight.apple.com/join/example',publicLinkLimit:100}}
  ];
  const memberships=new Map([
    ['internal',{testers:{meta:{paging:{total:1}},data:[{id:'person1',email:'private@example.com'}]},builds:{data:[{id:'b1',attributes:{version:'500159'}}]}}],
    ['external',{testers:{meta:{paging:{total:3}},data:[{id:'person2'}]},builds:{data:[{id:'b1',attributes:{version:'500159'}}]}}]
  ]);
  const result=summarizeGroups(groups,memberships);
  assert.equal(result[0].type,'interno');
  assert.equal(result[0].testers,1);
  assert.equal(result[1].type,'externo');
  assert.equal(result[1].testers,3);
  assert.equal(result[1].publicLink,'https://testflight.apple.com/join/example');
  assert.deepEqual(result[1].builds,['500159']);
  assert.equal(JSON.stringify(result).includes('private@example.com'),false);
});

test('unavailable tester count stays unknown instead of reporting zero',()=>{
  const groups=[{id:'g1',attributes:{name:'Grupo',isInternalGroup:false}}];
  const result=summarizeGroups(groups,new Map([['g1',{testers:{},builds:{data:[]}}]]));
  assert.equal(result[0].testers,null);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareReply, reviewIsUnanswered, validateApprovedRequest, findAppReview } from './appstore-review-reply.mjs';

const review=id=>({
  id, type:'customerReviews', attributes:{title:'Una sugerencia'},
  relationships:{response:{data:null}}
});

test('builds an Apple review reply request for an approved and unanswered review',()=>{
  const id='00000028-b08c-0014-729e-fbd500000000';
  const payload=prepareReply(review(id),'Gracias por tu sugerencia. La tendremos en cuenta.');
  assert.deepEqual(payload,{
    data:{type:'customerReviewResponses',
      attributes:{responseBody:'Gracias por tu sugerencia. La tendremos en cuenta.'},
      relationships:{review:{data:{type:'customerReviews',id}}}}
  });
});

test('refuses to overwrite an existing response even if publication is pending',()=>{
  const item=review('00000028-b08c-0014-729e-fbd500000000');
  item.relationships.response.data={type:'customerReviewResponses',id:'response-1'};
  assert.equal(reviewIsUnanswered(item),false);
  assert.throws(()=>prepareReply(item,'Otra respuesta'),/respuesta registrada/);
});

test('refuses to send when Apple did not supply the response relationship',()=>{
  const item=review('00000028-b08c-0014-729e-fbd500000000');
  delete item.relationships;
  assert.throws(()=>prepareReply(item,'Respuesta'),/no se puede verificar/);
});

test('refuses empty messages and invalid review IDs',()=>{
  const item=review('00000028-b08c-0014-729e-fbd500000000');
  assert.throws(()=>prepareReply(item,'   '),/texto vacío/);
  assert.throws(()=>prepareReply(review('otro'), 'Gracias'),/identificador/);
});

test('accepts an explicitly approved request whose filename matches the review',()=>{
  const id='00000028-b08c-0014-729e-fbd500000000';
  const input={reviewId:id,responseBody:'Gracias por escribirnos.',approvedBy:'Tony Acosta',approved:true};
  assert.deepEqual(validateApprovedRequest('review-approvals/'+id+'.json',input),{
    reviewId:id,responseBody:'Gracias por escribirnos.'
  });
});

test('rejects requests without explicit approval or for another review',()=>{
  const id='00000028-b08c-0014-729e-fbd500000000';
  const input={reviewId:id,responseBody:'Gracias',approvedBy:'Tony Acosta',approved:false};
  assert.throws(()=>validateApprovedRequest('review-approvals/'+id+'.json',input),/aprobación expresa/);
  input.approved=true;
  assert.throws(()=>validateApprovedRequest('review-approvals/otro.json',input),/no corresponde/);
});

test('rejects review IDs that do not belong to the TifloAcosta app',async()=>{
  const get=async()=>({data:[review('00000028-b08c-0014-729e-fbd500000000')],links:{}});
  const found=await findAppReview(get,'app-123','11111111-1111-1111-1111-111111111111');
  assert.equal(found,null);
});

test('finds an app review across Apple pagination',async()=>{
  const id='00000028-b08c-0014-729e-fbd500000000';
  const routes=[];
  const get=async route=>{
    routes.push(route);
    return routes.length===1
      ?{data:[],links:{next:'https://api.appstoreconnect.apple.com/v1/apps/app-123/customerReviews?cursor=next'}}
      :{data:[review(id)],links:{}};
  };
  assert.equal((await findAppReview(get,'app-123',id)).id,id);
  assert.deepEqual(routes,[
    'apps/app-123/customerReviews?limit=200&include=response',
    'apps/app-123/customerReviews?cursor=next'
  ]);
});

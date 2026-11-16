import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareReply, reviewIsUnanswered } from './appstore-review-reply.mjs';

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

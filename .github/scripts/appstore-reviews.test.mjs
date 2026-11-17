import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeReviews, applePaginationPath } from './appstore-reviews.mjs';

test('distinguishes published responses from unanswered reviews', () => {
  const reviews=[
    {id:'r1',attributes:{title:'Muy buena',rating:5,reviewerNickname:'Tony',createdDate:'2026-11-15',territory:'ESP'},relationships:{response:{data:{id:'p1'}}}},
    {id:'r2',attributes:{title:'Sugerencia',rating:4,reviewerNickname:'Adolfo',createdDate:'2026-11-14',territory:'USA'},relationships:{response:{data:null}}}
  ];
  const included=[{type:'customerReviewResponses',id:'p1',attributes:{state:'PUBLISHED',responseBody:'Muchas gracias'}}];
  const result=summarizeReviews(reviews,included);
  assert.equal(result.total,2);
  assert.equal(result.responded,1);
  assert.equal(result.pending,1);
  assert.deepEqual(result.unanswered.map(x=>x.nickname),['Adolfo']);
  assert.deepEqual(result.writtenRatingsByStars, {'1':0,'2':0,'3':0,'4':1,'5':1});
  assert.equal(result.writtenBelowFive,1);
});

test('pending response is not mistaken for a published answer', () => {
  const reviews=[{id:'r1',attributes:{title:'Hola',rating:5},relationships:{response:{data:{id:'p1'}}}}];
  const included=[{type:'customerReviewResponses',id:'p1',attributes:{state:'PENDING'}}];
  const result=summarizeReviews(reviews,included);
  assert.equal(result.responded,0);
  assert.equal(result.awaitingPublication,1);
  assert.equal(result.pending,0);
});

test('rejects pagination URLs outside Apple', () => {
  assert.equal(applePaginationPath('https://api.appstoreconnect.apple.com/v1/apps/a/customerReviews?cursor=xyz'),
    'apps/a/customerReviews?cursor=xyz');
  assert.throws(()=>applePaginationPath('https://example.com/collect?token=abc'),/Origen no permitido/);
});

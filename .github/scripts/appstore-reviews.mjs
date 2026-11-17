// Consulta pública de reseñas y estado de respuestas. Nunca publica respuestas.
import crypto from 'node:crypto';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export function summarizeReviews(reviews, included) {
  const responses=new Map(included.filter(x=>x.type==='customerReviewResponses').map(x=>[x.id,x]));
  const entries=reviews.map(review=>{
    const responseId=review.relationships?.response?.data?.id;
    const response=responseId?responses.get(responseId):null;
    const state=response?.attributes?.state||(responseId?'RESPUESTA_NO_DISPONIBLE':'SIN_RESPUESTA');
    return {
      id:review.id,nickname:review.attributes?.reviewerNickname||'Sin nombre',
      title:review.attributes?.title||'Sin título',body:review.attributes?.body||'',rating:review.attributes?.rating||0,
      createdDate:review.attributes?.createdDate||'',territory:review.attributes?.territory||'',
      responseState:state
    };
  });
  return {
    total:entries.length,
    responded:entries.filter(x=>x.responseState==='PUBLISHED').length,
    awaitingPublication:entries.filter(x=>x.responseState!=='PUBLISHED' && x.responseState!=='SIN_RESPUESTA').length,
    pending:entries.filter(x=>x.responseState==='SIN_RESPUESTA').length,
    unanswered:entries.filter(x=>x.responseState==='SIN_RESPUESTA'),
    entries
  };
}

export function applePaginationPath(url) {
  const next=new URL(url);
  if(next.origin!=='https://api.appstoreconnect.apple.com'||!next.pathname.startsWith('/v1/'))
    throw Error('Origen no permitido en paginación de Apple');
  return next.pathname.slice(4)+next.search;
}

function token() {
  const required=['API_ID','API_ISSUER','API_PRIVATE'];
  const missing=required.filter(x=>!process.env[x]);
  if(missing.length)throw Error('Faltan credenciales de App Store Connect: '+missing.join(', '));
  let key=process.env.API_PRIVATE.trim().replace(/^['"]|['"]$/g,'')
    .replace(/\\r\\n/g,'\n').replace(/\\n/g,'\n');
  if(!key.includes('-----BEGIN')){
    const decoded=Buffer.from(key,'base64').toString('utf8');
    if(decoded.includes('-----BEGIN'))key=decoded;
  }
  const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
  const now=Math.floor(Date.now()/1000);
  const base=encode({alg:'ES256',kid:process.env.API_ID,typ:'JWT'})+'.'+
    encode({iss:process.env.API_ISSUER,iat:now,exp:now+600,aud:'appstoreconnect-v1'});
  return base+'.'+crypto.sign('sha256',Buffer.from(base),{key,dsaEncoding:'ieee-p1363'}).toString('base64url');
}

async function main() {
  const auth=token();
  const get=async path=>{
    const response=await fetch('https://api.appstoreconnect.apple.com/v1/'+path,
      {headers:{Authorization:'Bearer '+auth}});
    const result=await response.json();
    if(!response.ok)throw Error('Apple API HTTP '+response.status+': '+JSON.stringify(result.errors||[]).slice(0,450));
    return result;
  };
  const apps=await get('apps?filter%5BbundleId%5D=com.tifloacosta.app&limit=20');
  const app=apps.data.find(x=>x.attributes?.bundleId==='com.tifloacosta.app');
  if(!app)throw Error('App TifloAcosta no localizada en App Store Connect');
  const reviews=[];
  const included=[];
  let route='apps/'+app.id+'/customerReviews?sort=-createdDate&limit=200&include=response';
  let pages=0;
  while(route){
    if(++pages>20)throw Error('Hay más de 20 páginas de reseñas: consulta incompleta');
    const page=await get(route);
    reviews.push(...(page.data||[]));
    included.push(...(page.included||[]));
    route=page.links?.next?applePaginationPath(page.links.next):null;
  }
  const result=summarizeReviews(reviews,included);
  const lines=[
    '# TifloAcosta — Reseñas de App Store Connect',
    'Reseñas escritas: '+result.total,
    'Respuesta publicada: '+result.responded,
    'Respuesta existente sin confirmar publicación: '+result.awaitingPublication,
    'Sin respuesta: '+result.pending,
    ...result.entries.map(x=>`${x.createdDate.slice(0,10)} | ${x.nickname} | ${x.rating}/5 | ${x.title} | ${x.territory} | ${x.responseState}`),
    '',
    '# Texto íntegro de reseñas sin respuesta',
    ...result.unanswered.map(x=>`Usuario: ${x.nickname} (${x.territory})\nTítulo: ${x.title}\nComentario: ${x.body||'[Sin texto adicional]'}\n`)
  ];
  const output=lines.join('\n');
  console.log(output);
  if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,output+'\n');
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  main().catch(error=>{console.error(error.message);process.exitCode=1;});
}

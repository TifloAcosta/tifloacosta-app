// Prepara respuestas a reseñas, con verificación contra sobrescrituras.
// Sin REPLY_EXECUTE=true, solo valida y muestra que la solicitud sería admisible.
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import { applePaginationPath } from './appstore-reviews.mjs';

export function reviewIsUnanswered(review) {
  if(!review?.relationships || !Object.hasOwn(review.relationships,'response') ||
     !Object.hasOwn(review.relationships.response||{},'data'))
    throw Error('Apple no facilita la relación de respuesta: no se puede verificar');
  return review.relationships.response.data===null;
}

export function prepareReply(review, text) {
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(review?.id||''))
    throw Error('El identificador de reseña no tiene el formato esperado');
  if(typeof text!=='string'||!text.trim())throw Error('No se permite un texto vacío');
  if(!reviewIsUnanswered(review))throw Error('Esta reseña ya tiene una respuesta registrada: no se sobrescribe');
  return {data:{type:'customerReviewResponses',attributes:{responseBody:text.trim()},
    relationships:{review:{data:{type:'customerReviews',id:review.id}}}}};
}

export function validateApprovedRequest(path, request) {
  const match=/^review-approvals\/([0-9a-f-]{36})\.json$/i.exec(path||'');
  if(!match||match[1]!==request?.reviewId)
    throw Error('El archivo de aprobación no corresponde a la reseña');
  if(request.approved!==true||request.approvedBy!=='Tony Acosta')
    throw Error('Falta la aprobación expresa de Tony Acosta');
  if(typeof request.responseBody!=='string'||!request.responseBody.trim())
    throw Error('La respuesta aprobada no puede estar vacía');
  return {reviewId:request.reviewId,responseBody:request.responseBody};
}

export async function findAppReview(get, appId, reviewId) {
  let route='apps/'+encodeURIComponent(appId)+'/customerReviews?limit=200&include=response';
  for(let page=0;route&&page<20;page++){
    const result=await get(route);
    const found=(result.data||[]).find(x=>x.id===reviewId);
    if(found)return found;
    route=result.links?.next?applePaginationPath(result.links.next):null;
  }
  if(route)throw Error('No se pudo recorrer toda la lista de reseñas de TifloAcosta');
  return null;
}

function makeToken() {
  const required=['API_ID','API_ISSUER','API_PRIVATE'];
  const missing=required.filter(k=>!process.env[k]);
  if(missing.length)throw Error('Faltan credenciales protegidas Apple: '+missing.join(', '));
  let key=process.env.API_PRIVATE.trim().replace(/^['"]|['"]$/g,'').replace(/\\r\\n/g,'\n').replace(/\\n/g,'\n');
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
  const approvedFile=process.env.APPROVAL_FILE;
  const approvedRequest=approvedFile?validateApprovedRequest(approvedFile,
    JSON.parse(fs.readFileSync(approvedFile,'utf8'))):null;
  const id=approvedRequest?.reviewId||process.env.REVIEW_ID;
  const responseBody=approvedRequest?.responseBody||process.env.RESPONSE_BODY;
  if(!id||!responseBody)throw Error('Es necesario indicar REVIEW_ID y RESPONSE_BODY');
  const auth=makeToken();
  const api=async(path,options={})=>{
    const r=await fetch('https://api.appstoreconnect.apple.com/v1/'+path,{
      ...options,headers:{Authorization:'Bearer '+auth,'Content-Type':'application/json'}});
    const data=await r.json();
    if(!r.ok)throw Error('Apple API HTTP '+r.status+': '+JSON.stringify(data.errors||[]).slice(0,350));
    return data;
  };
  const apps=await api('apps?filter%5BbundleId%5D=com.tifloacosta.app&limit=20');
  const app=apps.data.find(x=>x.attributes?.bundleId==='com.tifloacosta.app');
  if(!app)throw Error('No se ha encontrado la app TifloAcosta en Apple');
  const review=await findAppReview(api,app.id,id);
  if(!review)throw Error('La reseña indicada no pertenece a TifloAcosta');
  const request=prepareReply(review,responseBody);
  if(process.env.REPLY_EXECUTE!=='true'){
    console.log('SIMULACIÓN CORRECTA: reseña sin respuesta. No se ha enviado nada a Apple.');
    return;
  }
  if(!approvedRequest)throw Error('Los envíos reales requieren un archivo de aprobación válido');
  if(process.env.REPLY_APPROVED!=='YES')throw Error('Falta la aprobación expresa REPLY_APPROVED=YES');
  await api('customerReviewResponses',{method:'POST',body:JSON.stringify(request)});
  console.log('Respuesta enviada a Apple. Su publicación pública puede tardar.');
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  main().catch(err=>{console.error(err.message);process.exitCode=1;});
}

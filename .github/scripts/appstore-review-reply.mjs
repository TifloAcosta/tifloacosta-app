// Prepara respuestas a reseñas, con verificación contra sobrescrituras.
// Sin REPLY_EXECUTE=true, solo valida y muestra que la solicitud sería admisible.
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

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
  const id=process.env.REVIEW_ID;
  const responseBody=process.env.RESPONSE_BODY;
  if(!id||!responseBody)throw Error('Es necesario indicar REVIEW_ID y RESPONSE_BODY');
  const auth=makeToken();
  const api=async(path,options={})=>{
    const r=await fetch('https://api.appstoreconnect.apple.com/v1/'+path,{
      ...options,headers:{Authorization:'Bearer '+auth,'Content-Type':'application/json'}});
    const data=await r.json();
    if(!r.ok)throw Error('Apple API HTTP '+r.status+': '+JSON.stringify(data.errors||[]).slice(0,350));
    return data;
  };
  const result=await api('customerReviews/'+encodeURIComponent(id)+'?include=response');
  const request=prepareReply(result.data,responseBody);
  if(process.env.REPLY_EXECUTE!=='true'){
    console.log('SIMULACIÓN CORRECTA: reseña sin respuesta. No se ha enviado nada a Apple.');
    return;
  }
  if(process.env.REPLY_APPROVED!=='YES')throw Error('Falta la aprobación expresa REPLY_APPROVED=YES');
  await api('customerReviewResponses',{method:'POST',body:JSON.stringify(request)});
  console.log('Respuesta enviada a Apple. Su publicación pública puede tardar.');
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  main().catch(err=>{console.error(err.message);process.exitCode=1;});
}

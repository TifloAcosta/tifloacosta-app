// One-shot Apple Developer capability enablement. It does not create/associate
// group.com.tifloacosta.app: Apple's Developer Portal must assign the container.
import crypto from 'node:crypto';
const keyId=process.env.APPSTORE_API_KEY_ID;
const issuer=process.env.APPSTORE_API_ISSUER_ID;
const raw=String(process.env.APPSTORE_API_PRIVATE_KEY||'').trim().replace(/^["']|["']$/g,'');
const key=raw.includes('-----BEGIN PRIVATE KEY-----')?raw.replace(/\\n/g,'\n'):Buffer.from(raw,'base64').toString('utf8');
if(!keyId||!issuer||!key.includes('-----BEGIN PRIVATE KEY-----'))throw Error('Faltan credenciales de Apple.');
const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const h=enc({alg:'ES256',kid:keyId,typ:'JWT'});
const p=enc({iss:issuer,iat:now,exp:now+850,aud:'appstoreconnect-v1'});
const message=h+'.'+p;
const token=message+'.'+crypto.sign('sha256',Buffer.from(message),{key,dsaEncoding:'ieee-p1363'}).toString('base64url');
async function request(endpoint,method='GET',body=null){
 const res=await fetch('https://api.appstoreconnect.apple.com/v1/'+endpoint,{
  method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:body?JSON.stringify(body):undefined
 });
 const data=await res.json();
 return {ok:res.ok,status:res.status,data};
}
for(const identifier of ['com.tifloacosta.app','com.tifloacosta.app.ShareExtension']){
 const query=await request('bundleIds?filter[identifier]='+encodeURIComponent(identifier));
 if(!query.ok)throw Error('No se puede consultar el identificador '+identifier+' ('+query.status+').');
 const app=query.data.data.find(b=>b.attributes.identifier===identifier);
 if(!app)throw Error('El identificador no existe: '+identifier);
 const body={data:{
  type:'bundleIdCapabilities',
  attributes:{capabilityType:'APP_GROUPS'},
  relationships:{bundleId:{data:{type:'bundleIds',id:app.id}}}
 }};
 const result=await request('bundleIdCapabilities','POST',body);
 if(result.ok){
  console.log(identifier+': capacidad APP_GROUPS activada en Apple.');
 }else if(result.status===409 && (result.data.errors||[]).some(e=>/already|exists|duplicate|in use/i.test([e.title,e.detail,e.code].join(' ')))){
  console.log(identifier+': APP_GROUPS ya estaba activada.');
 }else{
  const code=(result.data.errors||[]).map(e=>e.code||e.title).join(', ').slice(0,150);
  throw Error(identifier+': Apple rechazó la capacidad APP_GROUPS ('+result.status+': '+code+').');
 }
}
console.log('Pendiente: vincular el grupo real group.com.tifloacosta.app a ambos App IDs desde Apple Developer Portal.');

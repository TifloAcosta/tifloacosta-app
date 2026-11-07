// One-shot public App Store submission of the already-tested TestFlight build.
// Does not upload a new binary or disclose Apple credentials.
import crypto from 'node:crypto';
const appBundle='com.tifloacosta.app';
const targetBuild='500123';
const targetVersion='1.1';
const required=['API_ID','API_ISSUER','API_PRIVATE'];
for(const name of required) if(!process.env[name]) throw Error('Falta credencial protegida: '+name);
let privateKey=process.env.API_PRIVATE.trim().replace(/^["']|["']$/g,'')
 .replace(/\\r\\n/g,'\n').replace(/\\n/g,'\n');
if(!privateKey.includes('-----BEGIN')) {
 const candidate=Buffer.from(privateKey,'base64').toString('utf8');
 if(candidate.includes('-----BEGIN')) privateKey=candidate;
}
if(!privateKey.includes('-----BEGIN PRIVATE KEY-----'))throw Error('Clave Apple inválida');
const b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const payload=b64({alg:'ES256',kid:process.env.API_ID,typ:'JWT'})+'.'+
 b64({iss:process.env.API_ISSUER,iat:now,exp:now+1000,aud:'appstoreconnect-v1'});
const jwt=payload+'.'+crypto.sign('sha256',Buffer.from(payload),
 {key:privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
async function api(route,method='GET',body){
 const res=await fetch('https://api.appstoreconnect.apple.com/v1/'+route,{
   method,headers:{Authorization:'Bearer '+jwt,'Content-Type':'application/json'},
   ...(body ? {body:JSON.stringify(body)} : {})
 });
 const raw=await res.text();let data;
 try{data=raw?JSON.parse(raw):{};}catch{data={};}
 if(!res.ok){
  const errors=(data.errors||[]).map(e=>e.detail||e.title||e.code).join(' | ');
  throw Error('Apple HTTP '+res.status+' '+method+' '+route+': '+errors.slice(0,1000));
 }
 return data;
}
const apps=await api('apps?filter%5BbundleId%5D='+appBundle+'&limit=20');
const app=apps.data.find(x=>x.attributes.bundleId===appBundle);
if(!app) throw Error('TifloAcosta no encontrada en la API de Apple');
console.log('Aplicación verificada, App ID '+app.id);
const builds=await api('builds?filter%5Bapp%5D='+app.id+'&sort=-uploadedDate&limit=100');
const build=builds.data.find(x=>String(x.attributes.version)===targetBuild);
if(!build || build.attributes.processingState!=='VALID')
 throw Error('La compilación 500123 todavía no es VALID en Apple');
console.log('Compilación '+targetBuild+' verificada VALID.');

const versions=await api('apps/'+app.id+'/appStoreVersions?filter%5Bplatform%5D=IOS&limit=200');
let version=versions.data.find(x=>x.attributes.versionString===targetVersion);
if(!version){
 const created=await api('appStoreVersions','POST',{data:{
  type:'appStoreVersions',
  attributes:{platform:'IOS',versionString:targetVersion,releaseType:'AFTER_APPROVAL'},
  relationships:{app:{data:{type:'apps',id:app.id}}}
 }});
 version=created.data;
 console.log('Creada versión pública '+targetVersion+'.');
}
const state=version.attributes.appStoreState||version.attributes.appVersionState;
console.log('Versión '+targetVersion+' estado='+state);
if(['WAITING_FOR_REVIEW','IN_REVIEW','PENDING_APPLE_RELEASE','PENDING_DEVELOPER_RELEASE','READY_FOR_DISTRIBUTION','READY_FOR_SALE'].includes(state)){
 console.log('La versión ya fue enviada o publicada. No se vuelve a enviar.');
 process.exit(0);
}
if(!['PREPARE_FOR_SUBMISSION','READY_FOR_REVIEW','REJECTED','DEVELOPER_REJECTED','METADATA_REJECTED'].includes(state))
 throw Error('No se modificará una versión Apple con estado no previsto: '+state);
const attached=await api('appStoreVersions/'+version.id+'/build');
if(attached.data?.id!==build.id){
 await api('appStoreVersions/'+version.id+'/relationships/build','PATCH',{
  data:{type:'builds',id:build.id}
 });
 console.log('Vinculada compilación exacta 500123 a versión 1.1.');
}else console.log('La compilación 500123 ya estaba vinculada.');
// Keep the already-chosen release policy if Apple has fixed it for an existing record.
if(version.attributes.releaseType!=='AFTER_APPROVAL'){
 try{
  await api('appStoreVersions/'+version.id,'PATCH',{data:{
   type:'appStoreVersions',id:version.id,attributes:{releaseType:'AFTER_APPROVAL'}
  }});
  console.log('Publicación automática después de la aprobación configurada.');
 }catch(error){
  console.log('No se pudo actualizar política de publicación: '+error.message);
 }
}
const submissions=await api('apps/'+app.id+'/reviewSubmissions?limit=100');
let submission=submissions.data.find(x=>x.attributes.state==='READY_FOR_REVIEW');
if(!submission){
 const created=await api('reviewSubmissions','POST',{data:{
   type:'reviewSubmissions',relationships:{app:{data:{type:'apps',id:app.id}}}
 }});
 submission=created.data;
 console.log('Creada solicitud de revisión '+submission.id);
}
const items=await api('reviewSubmissions/'+submission.id+'/items?limit=100');
const hasItem=items.data.some(x=>x.relationships?.appStoreVersion?.data?.id===version.id);
if(!hasItem){
 await api('reviewSubmissionItems','POST',{data:{
  type:'reviewSubmissionItems',
  relationships:{
   reviewSubmission:{data:{type:'reviewSubmissions',id:submission.id}},
   appStoreVersion:{data:{type:'appStoreVersions',id:version.id}}
  }
 }});
 console.log('Versión añadida a revisión.');
}
const sent=await api('reviewSubmissions/'+submission.id,'PATCH',{data:{
 type:'reviewSubmissions',id:submission.id,attributes:{submitted:true}
}});
console.log('APPLE REVISION PUBLICA ENVIADA: App 1.1 / build 500123; solicitud '+submission.id+
 '; estado='+sent.data?.attributes?.state);
const check=await api('appStoreVersions/'+version.id);
console.log('Apple confirma estado final='+check.data?.attributes?.appStoreState);

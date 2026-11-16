// Vincula una compilación a un grupo TestFlight existente, solo con aprobación.
import crypto from 'node:crypto';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

export function validateLinkApproval(path,approval) {
  const match=/^testflight-approvals\/(\d{6})-(internal|external)\.json$/.exec(path||'');
  const expected=match?.[2]==='internal'?'Probadores TifloAcosta':'Pruebas TifloAcosta';
  if(!match||match[1]!==approval?.buildNumber||approval.groupName!==expected)
    throw Error('El archivo no coincide con la compilación y el grupo solicitado');
  if(approval.approved!==true||approval.approvedBy!=='Tony Acosta')
    throw Error('Falta la aprobación expresa de Tony Acosta');
  return {buildNumber:approval.buildNumber,groupName:approval.groupName};
}

export function decideLink(build,group) {
  if(build?.attributes?.processingState!=='VALID'||build.attributes?.expired===true)return 'not-ready';
  if(group?.attributes?.isInternalGroup===true&&group.attributes.hasAccessToAllBuilds===true)
    return 'already-linked';
  if((build.relationships?.betaGroups?.data||[]).some(x=>x.id===group.id))return 'already-linked';
  return 'link';
}

export function buildLinkRequest(group) {
  return {data:[{type:'betaGroups',id:group.id}]};
}

function appleToken() {
  const required=['API_ID','API_ISSUER','API_PRIVATE'];
  const missing=required.filter(x=>!process.env[x]);
  if(missing.length)throw Error('Faltan credenciales Apple: '+missing.join(', '));
  let key=process.env.API_PRIVATE.trim().replace(/^['"]|['"]$/g,'')
    .replace(/\\r\\n/g,'\n').replace(/\\n/g,'\n');
  if(!key.includes('-----BEGIN')){
    const decoded=Buffer.from(key,'base64').toString('utf8');
    if(decoded.includes('-----BEGIN'))key=decoded;
  }
  const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
  const now=Math.floor(Date.now()/1000);
  const base=enc({alg:'ES256',kid:process.env.API_ID,typ:'JWT'})+'.'+
    enc({iss:process.env.API_ISSUER,iat:now,exp:now+600,aud:'appstoreconnect-v1'});
  return base+'.'+crypto.sign('sha256',Buffer.from(base),{key,dsaEncoding:'ieee-p1363'}).toString('base64url');
}

async function main() {
  const approvalFile=process.env.APPROVAL_FILE;
  if(!approvalFile)throw Error('Falta el archivo de aprobación');
  const request=validateLinkApproval(approvalFile,JSON.parse(fs.readFileSync(approvalFile,'utf8')));
  const token=appleToken();
  const api=async(route,options={})=>{
    const response=await fetch('https://api.appstoreconnect.apple.com/v1/'+route,{
      ...options,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'}});
    const text=await response.text();
    const result=text?JSON.parse(text):{};
    if(!response.ok)throw Error('Apple API HTTP '+response.status+': '+JSON.stringify(result.errors||[]).slice(0,450));
    return result;
  };
  const apps=await api('apps?filter%5BbundleId%5D=com.tifloacosta.app&limit=20');
  const app=apps.data.find(x=>x.attributes?.bundleId==='com.tifloacosta.app');
  if(!app)throw Error('No aparece TifloAcosta en Apple');
  const [builds,groups]=await Promise.all([
    api('builds?filter%5Bapp%5D='+app.id+'&sort=-uploadedDate&limit=100&include=betaGroups'),
    api('betaGroups?filter%5Bapp%5D='+app.id+'&limit=200')
  ]);
  const build=builds.data.find(x=>x.attributes?.version===request.buildNumber);
  if(!build)throw Error('No se localiza la compilación '+request.buildNumber+' de TifloAcosta');
  const group=groups.data.find(x=>x.attributes?.name===request.groupName);
  if(!group)throw Error('El grupo autorizado no existe en TifloAcosta');
  const action=decideLink(build,group);
  if(action==='not-ready')throw Error('La compilación todavía no está procesada y válida');
  if(action==='already-linked'){
    console.log('Sin cambios: la compilación ya está disponible para el grupo indicado.');
    return;
  }
  if(process.env.LINK_EXECUTE!=='true'){
    console.log('SIMULACIÓN: se podría vincular la compilación '+request.buildNumber+' al grupo '+request.groupName+'.');
    return;
  }
  if(process.env.LINK_APPROVED!=='YES')throw Error('No se ha confirmado la aprobación de la vinculación');
  await api('builds/'+build.id+'/relationships/betaGroups',{
    method:'POST',body:JSON.stringify(buildLinkRequest(group))
  });
  const confirmed=await api('builds/'+build.id+'?include=betaGroups');
  if(!confirmed.data.relationships?.betaGroups?.data?.some(x=>x.id===group.id))
    throw Error('Apple recibió la solicitud, pero aún no se pudo confirmar el vínculo');
  console.log('CONFIRMADO POR APPLE: compilación '+request.buildNumber+' vinculada a '+request.groupName+'.');
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  main().catch(err=>{console.error(err.message);process.exitCode=1;});
}

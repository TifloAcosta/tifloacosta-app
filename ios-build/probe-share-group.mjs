// Secure, read-only App Group capability verification via ephemeral distribution
// profiles. Do NOT output certificates, JWT, profile data, or private keys.
// Profiles are created for inspection and deleted in finally, never uploaded.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const keyId=process.env.APPSTORE_API_KEY_ID;
const issuer=process.env.APPSTORE_API_ISSUER_ID;
const keySource=String(process.env.APPSTORE_API_PRIVATE_KEY||'').trim().replace(/^["']|["']$/g,'');
const key=keySource.includes('-----BEGIN PRIVATE KEY-----')
  ? keySource.replace(/\\r\\n/g,'\n').replace(/\\n/g,'\n')
  : Buffer.from(keySource,'base64').toString('utf8');
if (!keyId || !issuer || !key.includes('-----BEGIN PRIVATE KEY-----')) {
  throw Error('Faltan credenciales App Store Connect.');
}
const enc=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const head=enc({alg:'ES256',kid:keyId,typ:'JWT'});
const claims=enc({iss:issuer,iat:now,exp:now+1100,aud:'appstoreconnect-v1'});
const unsigned=head+'.'+claims;
const signature=crypto.sign('sha256',Buffer.from(unsigned),{key,dsaEncoding:'ieee-p1363'}).toString('base64url');
const auth='Bearer '+unsigned+'.'+signature;
async function api(path,options={}){
  const reply=await fetch('https://api.appstoreconnect.apple.com/v1/'+path,{
    ...options,
    headers:{Authorization:auth,'Content-Type':'application/json',...(options.headers||{})}
  });
  const raw=await reply.text();
  const data=raw?JSON.parse(raw):{};
  if(!reply.ok){
    const codes=(data.errors||[]).map(x=>x.code||x.title).filter(Boolean).join(', ');
    throw Error('Apple API '+reply.status+(codes?': '+codes:''));
  }
  return data;
}
const ids=['com.tifloacosta.app','com.tifloacosta.app.ShareExtension'];
const profiles=[];
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'tiflo-share-permission-'));
let passed=false;
try{
  const certificates=await api('certificates?limit=200');
  const certificate=certificates.data.find(item=>
    ['IOS_DISTRIBUTION','DISTRIBUTION'].includes(item.attributes?.certificateType)
    && item.attributes?.certificateContent
    && (!item.attributes.expirationDate || Date.parse(item.attributes.expirationDate)>Date.now()));
  if(!certificate) throw Error('No hay certificado de distribución vigente para inspeccionar perfiles.');
  for(const identifier of ids){
    const bundles=await api('bundleIds?filter[identifier]='+encodeURIComponent(identifier));
    const bundle=bundles.data.find(item=>item.attributes.identifier===identifier);
    if(!bundle) throw Error('No existe el identificador '+identifier);
    const profileName='TifloAcosta Share Permission Probe '+Date.now()+' '+(profiles.length+1);
    const created=await api('profiles',{method:'POST',body:JSON.stringify({data:{
      type:'profiles',
      attributes:{name:profileName,profileType:'IOS_APP_STORE'},
      relationships:{
        bundleId:{data:{type:'bundleIds',id:bundle.id}},
        certificates:{data:[{type:'certificates',id:certificate.id}]}
      }
    }})});
    profiles.push(created.data.id);
    const content=Buffer.from(created.data.attributes.profileContent,'base64');
    const profilePath=path.join(tmp,'profile.mobileprovision');
    fs.writeFileSync(profilePath,content,{mode:0o600});
    const decoded=execFileSync('security',['cms','-D','-i',profilePath],{maxBuffer:1024*1024*4});
    const python=[
      'import sys,plistlib,json',
      'p=plistlib.loads(sys.stdin.buffer.read())',
      'print(json.dumps(p.get("Entitlements",{}).get("com.apple.security.application-groups",[])))'
    ].join('\n');
    const groups=JSON.parse(execFileSync('python3',['-c',python],{input:decoded,encoding:'utf8'}));
    const ok=Array.isArray(groups)&&groups.includes('group.com.tifloacosta.app');
    if(!ok) passed=false;
    console.log(identifier+': '+(ok?'App Group AUTORIZADO':'App Group NO ASOCIADO')+
      ' en perfil de distribución recién emitido.');
    if(!ok) process.exitCode=2;
    if(!fs.existsSync(path.join(tmp,'started'))) fs.writeFileSync(path.join(tmp,'started'),'');
  }
  passed=process.exitCode!==2;
  console.log(passed?'PERMISOS LISTOS: ambos perfiles admiten Compartir.':
    'ACCIÓN PENDIENTE: asociar group.com.tifloacosta.app a los dos identificadores en Apple Developer.');
}finally{
  for(const id of profiles){
    try{await api('profiles/'+id,{method:'DELETE'});}
    catch(error){console.log('Advertencia: no se pudo eliminar un perfil de prueba temporal ('+String(error.message).slice(0,120)+').');}
  }
  fs.rmSync(tmp,{recursive:true,force:true});
}

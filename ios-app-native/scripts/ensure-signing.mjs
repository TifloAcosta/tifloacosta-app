// Recover a password-protected signing archive; issue a new certificate only
// when there is no reusable archive. Never revoke existing Apple certificates.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const dir=path.join(process.env.RUNNER_TEMP,'ios-signing');
fs.mkdirSync(dir,{recursive:true,mode:0o700});
const p12=path.join(dir,'TifloAcosta.p12');
const password=process.env.P12_PASSWORD;
if(!password||password.length<16)throw Error('Falta la contraseña de la clave de distribución');
const repo=process.env.GITHUB_REPOSITORY;
if(!repo||!process.env.GITHUB_TOKEN)throw Error('GitHub Actions no autorizó recuperar los certificados');
const headers={Authorization:'Bearer '+process.env.GITHUB_TOKEN,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
const artifactName='TifloAcosta-P12-protegido';
const runId=Number(process.env.GITHUB_RUN_ID);
try{
  const response=await fetch('https://api.github.com/repos/'+repo+'/actions/artifacts?per_page=100&name='+encodeURIComponent(artifactName),{headers});
  if(!response.ok)throw Error('GitHub artifacts HTTP '+response.status);
  const list=await response.json();
  const archives=(list.artifacts||[]).filter(a=>a.name===artifactName&&!a.expired&&a.workflow_run?.id!==runId)
    .sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
  for(const artifact of archives){
    try{
      const zipResult=await fetch('https://api.github.com/repos/'+repo+'/actions/artifacts/'+artifact.id+'/zip',{headers});
      if(!zipResult.ok)continue;
      const zipFile=path.join(dir,'signing-artifact.zip');
      fs.writeFileSync(zipFile,Buffer.from(await zipResult.arrayBuffer()),{mode:0o600});
      const decoded=execFileSync('/usr/bin/unzip',['-p',zipFile,'TifloAcosta.p12']);
      fs.rmSync(zipFile,{force:true});
      if(decoded.length<400)continue;
      fs.writeFileSync(p12,decoded,{mode:0o600});
      // Validate the encrypted P12 without printing private-key material.
      const openssl='/opt/homebrew/opt/openssl@3/bin/openssl';
      execFileSync(openssl,['pkcs12','-legacy','-in',p12,'-passin','env:P12_PASSWORD','-noout']);
      fs.appendFileSync(process.env.GITHUB_ENV,'NEW_P12=false\n');
      console.log('Certificado de distribución protegido recuperado de un artefacto vigente.');
      process.exit(0);
    }catch{fs.rmSync(p12,{force:true});}
  }
}catch(error){console.log('No se encontró archivo de firma reutilizable: '+String(error.message).slice(0,140));}
// Generate a new key pair locally and request the public certificate via the
// existing App Store Connect API key. No signing secrets enter Git logs.
const keyPath=path.join(dir,'signing.key');
const csrPath=path.join(dir,'signing.csr');
const certDer=path.join(dir,'signing.cer');
const certPem=path.join(dir,'signing.pem');
execFileSync('/usr/bin/openssl',['req','-new','-newkey','rsa:2048','-nodes',
  '-keyout',keyPath,'-out',csrPath,'-subj','/CN=TifloAcosta Apple Distribution'],
  {stdio:'pipe'});
const enc=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const input=enc({alg:'ES256',kid:process.env.API_ID,typ:'JWT'})+'.'+enc({iss:process.env.API_ISSUER,iat:now,exp:now+1000,aud:'appstoreconnect-v1'});
const signature=crypto.sign('sha256',Buffer.from(input),{key:fs.readFileSync(process.env.ASC_KEY_PATH),dsaEncoding:'ieee-p1363'}).toString('base64url');
const token=input+'.'+signature;
const response=await fetch('https://api.appstoreconnect.apple.com/v1/certificates',{
  method:'POST',
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({data:{type:'certificates',attributes:{
    certificateType:'DISTRIBUTION',csrContent:fs.readFileSync(csrPath,'utf8')
  }}})
});
const result=await response.json();
if(!response.ok)throw Error('Apple no pudo emitir el certificado (HTTP '+response.status+'): '+JSON.stringify(result.errors||[]).slice(0,400));
const binary=result.data?.attributes?.certificateContent;
if(!binary)throw Error('Apple no proporcionó el certificado emitido');
fs.writeFileSync(certDer,Buffer.from(binary,'base64'),{mode:0o600});
execFileSync('/usr/bin/openssl',['x509','-inform','DER','-in',certDer,'-out',certPem],{stdio:'pipe'});
execFileSync('/usr/bin/openssl',['pkcs12','-export','-inkey',keyPath,'-in',certPem,
  '-out',p12,'-passout','env:P12_PASSWORD','-name','TifloAcosta Apple Distribution'],{stdio:'pipe'});
for(const file of [keyPath,csrPath,certDer,certPem])fs.rmSync(file,{force:true});
fs.appendFileSync(process.env.GITHUB_ENV,'NEW_P12=true\n');
console.log('Nuevo certificado emitido por Apple y guardado como P12 protegido.');

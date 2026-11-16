import crypto from 'node:crypto';
const missing=['API_ID','API_ISSUER','API_PRIVATE'].filter(x=>!process.env[x]);
if(missing.length)throw Error('Faltan credenciales Apple: '+missing.join(', '));
let key=process.env.API_PRIVATE.trim().replace(/^['"]|['"]$/g,'').replace(/\\r\\n/g,'\n').replace(/\\n/g,'\n');
if(!key.includes('-----BEGIN')){
  const decoded=Buffer.from(key,'base64').toString('utf8');
  if(decoded.includes('-----BEGIN'))key=decoded;
}
const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const base=encode({alg:'ES256',kid:process.env.API_ID,typ:'JWT'})+'.'+encode({iss:process.env.API_ISSUER,iat:now,exp:now+600,aud:'appstoreconnect-v1'});
const token=base+'.'+crypto.sign('sha256',Buffer.from(base),{key,dsaEncoding:'ieee-p1363'}).toString('base64url');
async function query(route){
  const response=await fetch('https://api.appstoreconnect.apple.com/v1/'+route,{headers:{Authorization:'Bearer '+token}});
  const body=await response.json();
  return {status:response.status,data:body};
}
const apps=await query('apps?filter%5BbundleId%5D=com.tifloacosta.app&limit=20');
if(apps.status!==200)throw Error('No se pudo localizar la app: HTTP '+apps.status);
const app=apps.data.data.find(x=>x.attributes?.bundleId==='com.tifloacosta.app');
if(!app)throw Error('TifloAcosta no encontrada');
const result=await query('apps/'+app.id+'/analyticsReportRequests?limit=100');
const lines=['# Acceso a informes analíticos de TifloAcosta','Consulta HTTP: '+result.status];
if(result.status===200){
  lines.push('Solicitudes de informes existentes: '+(result.data.data||[]).length);
  for(const x of result.data.data||[])lines.push('ID: '+x.id+' | Tipo: '+(x.attributes?.accessType||'no disponible'));
}else{
  lines.push('La clave actual no permite recuperar solicitudes analíticas o Apple devolvió un error.');
  lines.push('Código Apple: '+(result.data.errors?.[0]?.code||'desconocido'));
}
const out=lines.join('\n');
console.log(out);
if(process.env.GITHUB_STEP_SUMMARY)(await import('node:fs')).appendFileSync(process.env.GITHUB_STEP_SUMMARY,out+'\n');

// Auditoría de solo lectura de grupos TestFlight, sin datos personales de testers.
import crypto from 'node:crypto';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export function summarizeGroups(groups, memberships) {
  return groups.map(group=>{
    const info=memberships.get(group.id)||{};
    const a=group.attributes||{};
    return {
      name:a.name||'Sin nombre',type:a.isInternalGroup?'interno':'externo',
      testers:Number.isInteger(info.testers?.meta?.paging?.total)?info.testers.meta.paging.total:null,
      builds:(info.builds?.data||[]).map(x=>x.attributes?.version).filter(Boolean),
      allBuilds:a.hasAccessToAllBuilds===true,
      publicLinkEnabled:a.publicLinkEnabled===true,
      publicLink:a.publicLinkEnabled?a.publicLink||null:null,
      publicLinkLimit:a.publicLinkLimit??null
    };
  });
}

function makeToken() {
  const required=['API_ID','API_ISSUER','API_PRIVATE'];
  const missing=required.filter(x=>!process.env[x]);
  if(missing.length)throw Error('Faltan credenciales de Apple: '+missing.join(', '));
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
  const token=makeToken();
  const get=async route=>{
    const response=await fetch('https://api.appstoreconnect.apple.com/v1/'+route,
      {headers:{Authorization:'Bearer '+token}});
    const result=await response.json();
    if(!response.ok)throw Error('Apple API HTTP '+response.status+': '+JSON.stringify(result.errors||[]).slice(0,450));
    return result;
  };
  const apps=await get('apps?filter%5BbundleId%5D=com.tifloacosta.app&limit=20');
  const app=apps.data.find(x=>x.attributes?.bundleId==='com.tifloacosta.app');
  if(!app)throw Error('No se ha encontrado TifloAcosta en App Store Connect');
  const groupResponse=await get('betaGroups?filter%5Bapp%5D='+app.id+'&limit=200');
  const memberships=new Map();
  for(const group of groupResponse.data){
    const id=encodeURIComponent(group.id);
    const [testers,builds]=await Promise.all([
      get('betaGroups/'+id+'/betaTesters?limit=1'),
      get('betaGroups/'+id+'/builds?limit=100')
    ]);
    memberships.set(group.id,{testers,builds});
  }
  const groups=summarizeGroups(groupResponse.data,memberships);
  const output=[
    '# TifloAcosta — Grupos y acceso a TestFlight',
    'Grupos: '+groups.length,
    ...groups.flatMap(group=>[
      group.name+' ('+group.type+')',
      'Probadores: '+(group.testers??'no disponible'),
      'Compilaciones: '+(group.builds.join(', ')||'ninguna'),
      'Acceso a todas las compilaciones: '+(group.allBuilds?'sí':'no'),
      'Enlace público habilitado: '+(group.publicLinkEnabled?'sí':'no'),
      ...(group.publicLink?['Enlace: '+group.publicLink]:[]),
      ...(group.publicLinkLimit!==null?['Límite de enlace: '+group.publicLinkLimit]:[])
    ])
  ].join('\n');
  console.log(output);
  if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,output+'\n');
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  main().catch(err=>{console.error(err.message);process.exitCode=1;});
}

// Consulta de solo lectura sobre TestFlight. No modifica grupos ni compilaciones.
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';

export function summarizeBuild(build, detail, review, groups) {
  const memberships=new Set((build.relationships?.betaGroups?.data||[]).map(x=>x.id));
  const externalGroups=groups.filter(group=>!group.attributes?.isInternalGroup && memberships.has(group.id))
    .map(group=>({name:group.attributes.name,publicLink:group.attributes.publicLinkEnabled?group.attributes.publicLink||null:null}));
  const reviewState=review?.attributes?.betaReviewState||'SIN_SOLICITUD_O_NO_DISPONIBLE';
  const externalState=detail?.attributes?.externalBuildState||'NO_DISPONIBLE';
  return {
    build:build.attributes?.version,uploadedDate:build.attributes?.uploadedDate||null,
    processingState:build.attributes?.processingState||'DESCONOCIDO',
    expired:build.attributes?.expired===true,
    internalState:detail?.attributes?.internalBuildState||'NO_DISPONIBLE',
    externalState,reviewState,externalGroups,
    externalApproved:reviewState==='APPROVED' && externalState==='IN_BETA_TESTING' &&
      build.attributes?.processingState==='VALID' && !build.attributes?.expired && externalGroups.length>0
  };
}

function makeToken() {
  const required=['API_ID','API_ISSUER','API_PRIVATE'];
  const missing=required.filter(k=>!process.env[k]);
  if(missing.length)throw Error('Faltan credenciales protegidas: '+missing.join(', '));
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

async function run() {
  const token=makeToken();
  const get=async route=>{
    const response=await fetch('https://api.appstoreconnect.apple.com/v1/'+route,
      {headers:{Authorization:'Bearer '+token}});
    const data=await response.json();
    if(!response.ok)throw Error('Apple API HTTP '+response.status+': '+JSON.stringify(data.errors||[]).slice(0,400));
    return data;
  };
  const apps=await get('apps?filter%5BbundleId%5D=com.tifloacosta.app&limit=20');
  const app=apps.data.find(x=>x.attributes?.bundleId==='com.tifloacosta.app');
  if(!app)throw Error('No se encontró TifloAcosta en App Store Connect');
  const [builds,groupList]=await Promise.all([
    get('builds?filter%5Bapp%5D='+app.id+'&sort=-uploadedDate&limit=100&include=betaGroups,buildBetaDetail,preReleaseVersion'),
    get('betaGroups?filter%5Bapp%5D='+app.id+'&limit=200')
  ]);
  const included=builds.included||[];
  const detailMap=new Map(included.filter(x=>x.type==='buildBetaDetails').map(x=>[x.id,x]));
  const versionMap=new Map(included.filter(x=>x.type==='preReleaseVersions').map(x=>[x.id,x.attributes?.version]));
  const requested=process.env.TARGET_BUILD||'500159';
  const build=builds.data.find(x=>String(x.attributes?.version)===requested);
  if(!build)throw Error('No aparece la compilación '+requested+' entre las últimas 100 de Apple');
  const detailId=build.relationships?.buildBetaDetail?.data?.id;
  const detail=detailMap.get(detailId)||(detailId? (await get('buildBetaDetails/'+detailId)).data:null);
  const reviews=await get('betaAppReviewSubmissions?filter%5Bbuild%5D='+build.id+'&limit=20');
  const review=reviews.data.slice().sort((a,b)=>String(b.attributes?.submittedDate||'').localeCompare(String(a.attributes?.submittedDate||'')))[0]||null;
  const result=summarizeBuild(build,detail,review,groupList.data);
  const versionId=build.relationships?.preReleaseVersion?.data?.id;
  result.version=versionMap.get(versionId)||'DESCONOCIDA';
  const summary=[
    '# TifloAcosta — Estado oficial de TestFlight',
    'Versión: '+result.version+'; compilación: '+result.build,
    'Procesamiento Apple: '+result.processingState,
    'Pruebas internas: '+result.internalState,
    'Pruebas externas: '+result.externalState,
    'Revisión externa: '+result.reviewState,
    'Acceso externo confirmado: '+(result.externalApproved?'SÍ':'NO'),
    'Grupos externos vinculados: '+(result.externalGroups.map(x=>x.name).join(', ')||'ninguno'),
    ...result.externalGroups.filter(x=>x.publicLink).map(x=>'Enlace público: '+x.publicLink)
  ].join('\n');
  console.log(summary);
  if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary+'\n');
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  run().catch(error=>{console.error(error.message);process.exitCode=1;});
}

// Read-only App Store Connect release preflight. Never creates or submits versions.
import crypto from 'node:crypto';
import fs from 'node:fs';

const required=['APPSTORE_API_KEY_ID','APPSTORE_API_ISSUER_ID','APPSTORE_API_PRIVATE_KEY'];
for(const key of required) if(!process.env[key]) throw Error('Missing protected App Store API credential: '+key);
function privateKey() {
  let key=process.env.APPSTORE_API_PRIVATE_KEY.trim().replace(/^["']|["']$/g,'')
    .replace(/\\r\\n/g,'\n').replace(/\\n/g,'\n');
  if(!key.includes('-----BEGIN')) {
    const decoded=Buffer.from(key,'base64').toString('utf8');
    if(decoded.includes('-----BEGIN')) key=decoded;
  }
  if(!key.includes('-----BEGIN PRIVATE KEY-----')) throw Error('Invalid Apple private key');
  return key;
}
const encoded=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const payload=encoded({alg:'ES256',kid:process.env.APPSTORE_API_KEY_ID,typ:'JWT'})+'.'+
  encoded({iss:process.env.APPSTORE_API_ISSUER_ID,iat:now,exp:now+600,aud:'appstoreconnect-v1'});
const jwt=payload+'.'+crypto.sign('sha256',Buffer.from(payload),
  {key:privateKey(),dsaEncoding:'ieee-p1363'}).toString('base64url');

async function get(route) {
  const response=await fetch('https://api.appstoreconnect.apple.com/v1/'+route,{
    headers:{Authorization:'Bearer '+jwt,Accept:'application/json'}
  });
  const body=await response.json();
  if(!response.ok)throw Error('Apple GET '+route+' HTTP '+response.status+': '+
    JSON.stringify(body.errors||body).slice(0,1200));
  return body;
}
async function all(route) {
  let next='https://api.appstoreconnect.apple.com/v1/'+route;
  const result=[];
  while(next) {
    const path=next.startsWith('https://api.appstoreconnect.apple.com/v1/') ?
      next.split('/v1/')[1] : null;
    if(!path) throw Error('Untrusted pagination URL');
    const page=await get(path);
    result.push(...page.data);
    next=page.links?.next||null;
    if(result.length>300)throw Error('Unexpected Apple pagination (>300)');
  }
  return result;
}
const apps=await get('apps?filter%5BbundleId%5D=com.tifloacosta.app&limit=20');
const app=apps.data.find(x=>x.attributes?.bundleId==='com.tifloacosta.app');
if(!app)throw Error('TifloAcosta app not found in App Store Connect');
const versions=await all('apps/'+app.id+'/appStoreVersions?filter%5Bplatform%5D=IOS&limit=100');
const infos=await all('apps/'+app.id+'/appInfos?limit=100');
const latestInfo=infos.at(0);
const infoLocales=latestInfo ? await all('appInfos/'+latestInfo.id+'/appInfoLocalizations?limit=200') : [];
const details=[];
for(const version of versions.slice(0,12)) {
  const locales=await all('appStoreVersions/'+version.id+'/appStoreVersionLocalizations?limit=200');
  const buildRelationship=await get('appStoreVersions/'+version.id+'/relationships/build');
  const buildId=buildRelationship?.data?.id;
  let build=null;
  if(buildId) {
    const b=await get('builds/'+buildId);
    build={id:b.data.id,number:b.data.attributes?.version,processingState:b.data.attributes?.processingState};
  }
  details.push({
    versionId:version.id,number:version.attributes?.versionString,
    state:version.attributes?.appVersionState||version.attributes?.appStoreState,
    releaseType:version.attributes?.releaseType,build,
    locales:locales.map(v=>({id:v.id,locale:v.attributes?.locale,
      whatsNewPresent:Boolean(v.attributes?.whatsNew?.trim()),
      whatsNewLength:v.attributes?.whatsNew?.length||0,
      descriptionPresent:Boolean(v.attributes?.description?.trim())}))
  });
}
const builds=await get('builds?filter%5Bapp%5D='+app.id+'&sort=-uploadedDate&limit=12');
const output={
  appId:app.id,
  bundleId:app.attributes?.bundleId,
  appInfoLocales:infoLocales.map(x=>x.attributes?.locale),
  versions:details,
  recentBuilds:builds.data.map(x=>({number:x.attributes?.version,
    processingState:x.attributes?.processingState,uploadedDate:x.attributes?.uploadedDate}))
};
const release=JSON.parse(fs.readFileSync('ios-app-native/release/appstore-1.2.json','utf8'));
if(release.bundleId !== output.bundleId || release.version !== '1.2') throw Error('Release config or bundle mismatch');
if(!release.whatsNew?.[release.primaryLocale]?.trim()) throw Error('Spanish What’s New is missing');
const existingDraft=output.versions.find(x=>x.number===release.version);
if(existingDraft && !['PREPARE_FOR_SUBMISSION','DEVELOPER_REJECTED','REJECTED'].includes(existingDraft.state))
  throw Error('Version '+release.version+' exists in non-editable state '+existingDraft.state);
const uploadedNumbers=output.recentBuilds.map(x=>Number(x.number)).filter(Number.isInteger);
const nextBuild=Math.max(500151,...uploadedNumbers.map(x=>x+1));
if(!Number.isInteger(nextBuild)) throw Error('Invalid next build number');
output.nextBuildNumber=nextBuild;
output.releaseConfig={version:release.version,locale:release.primaryLocale,releaseType:release.releaseType};
if(process.env.GITHUB_ENV) fs.appendFileSync(process.env.GITHUB_ENV,
  'TIFLO_IOS_BUILD_NUMBER='+nextBuild+'\nTIFLO_IOS_MARKETING_VERSION='+release.version+'\n');
const summary=JSON.stringify(output,null,2);
console.log('APPLE_PUBLIC_RELEASE_PREFLIGHT:\n'+summary);
if(process.env.GITHUB_STEP_SUMMARY) {
  const lines=['## TifloAcosta public release preflight','Read-only. No build uploaded or submitted.',
    'App info localizations: '+output.appInfoLocales.join(', ')];
  for(const v of details) lines.push('Version '+v.number+': '+v.state+
    ', build '+(v.build?.number||'none')+
    ', What’s New locales: '+v.locales.filter(l=>l.whatsNewPresent).map(l=>l.locale).join(', '));
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,lines.join('\n')+'\n');
}

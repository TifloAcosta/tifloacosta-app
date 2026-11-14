// Public App Store 1.3 submission. It never assigns a TestFlight tester group.
import crypto from 'node:crypto';
import fs from 'node:fs';
const spec=JSON.parse(fs.readFileSync('ios-app-native/release/appstore-1.3.json','utf8'));
const buildNumber=process.env.TARGET_BUILD;
if(!buildNumber || !/^\d+$/.test(buildNumber))throw Error('Explicit target build is required');
if(spec.version!=='1.3'||spec.bundleId!=='com.tifloacosta.app')throw Error('Wrong release target');
const required=['APPSTORE_API_KEY_ID','APPSTORE_API_ISSUER_ID','APPSTORE_API_PRIVATE_KEY'];
for(const name of required)if(!process.env[name])throw Error('Missing protected Apple key '+name);
let key=process.env.APPSTORE_API_PRIVATE_KEY.trim().replace(/^["']|["']$/g,'')
 .replace(/\\r\\n/g,'\n').replace(/\\n/g,'\n');
if(!key.includes('-----BEGIN'))key=Buffer.from(key,'base64').toString('utf8');
const e=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const message=e({alg:'ES256',kid:process.env.APPSTORE_API_KEY_ID,typ:'JWT'})+'.'+
 e({iss:process.env.APPSTORE_API_ISSUER_ID,iat:now,exp:now+600,aud:'appstoreconnect-v1'});
const token=message+'.'+crypto.sign('sha256',Buffer.from(message),
  {key,dsaEncoding:'ieee-p1363'}).toString('base64url');

async function call(method,route,body) {
 const response=await fetch('https://api.appstoreconnect.apple.com/v1/'+route,{
  method,headers:{Authorization:'Bearer '+token,
   Accept:'application/json','Content-Type':'application/json'},
  ...(body===undefined?{}:{body:JSON.stringify(body)})
 });
 const raw=await response.text();
 let result=null;
 try{result=raw?JSON.parse(raw):null}catch{result={raw:raw.slice(0,300)}}
 if(!response.ok)throw Error('Apple '+method+' '+route+' HTTP '+response.status+': '+
  JSON.stringify(result?.errors||result).slice(0,1500));
 return result;
}
const get=route=>call('GET',route);
const item=(type,id)=>({type,id});
async function list(route) {
 const response=await get(route);
 return response.data||[];
}
const apps=await list('apps?filter%5BbundleId%5D='+spec.bundleId+'&limit=20');
const app=apps.find(x=>x.attributes?.bundleId===spec.bundleId);
if(!app)throw Error('App not found; refusing submission');
const builds=await list('builds?filter%5Bapp%5D='+app.id+'&sort=-uploadedDate&limit=100');
const build=builds.find(x=>x.attributes?.version===buildNumber);
if(!build||build.attributes.processingState!=='VALID')
 throw Error('Target '+buildNumber+' is not valid at Apple. Refusing submission.');
const allVersions=await list('apps/'+app.id+'/appStoreVersions?filter%5Bplatform%5D=IOS&limit=100');
let version=allVersions.find(x=>x.attributes?.versionString===spec.version);
if(version&&!['PREPARE_FOR_SUBMISSION','DEVELOPER_REJECTED','REJECTED'].includes(version.attributes.appVersionState)){
 if(['WAITING_FOR_REVIEW','IN_REVIEW','PENDING_APPLE_RELEASE','READY_FOR_DISTRIBUTION'].includes(version.attributes.appVersionState)){
  console.log('Public version is already in Apple review/distribution: '+version.attributes.appVersionState);
  process.exit(0);
 }
 throw Error('Version exists but cannot be edited: '+version.attributes.appVersionState);
}
if(!version){
 const created=await call('POST','appStoreVersions',{
  data:{type:'appStoreVersions',
   attributes:{platform:'IOS',versionString:spec.version,releaseType:spec.releaseType},
   relationships:{app:{data:item('apps',app.id)}}}
 });
 version=created.data;
 console.log('Created Apple public version '+spec.version+': '+version.id);
}
// Match App Info locales, not device language selection.
const appInfos=await list('apps/'+app.id+'/appInfos?limit=50');
if(!appInfos.length)throw Error('No App Info localization container; stop');
const localesInAppInfo=await list('appInfos/'+appInfos[0].id+'/appInfoLocalizations?limit=100');
const appLocaleCodes=localesInAppInfo.map(x=>x.attributes?.locale).sort();
if(appLocaleCodes.length===0)throw Error('No public metadata locales');
const notesLocaleCodes=Object.keys(spec.whatsNew).sort();
if(JSON.stringify(appLocaleCodes)!==JSON.stringify(notesLocaleCodes))
 throw Error('App Store locales '+appLocaleCodes.join(',')+' do not match prepared What’s New '+notesLocaleCodes.join(','));
const previous=allVersions.find(x=>x.attributes?.versionString==='1.2');
const priorLocals=previous?
  await list('appStoreVersions/'+previous.id+'/appStoreVersionLocalizations?limit=100'):[];
let current=await list('appStoreVersions/'+version.id+'/appStoreVersionLocalizations?limit=100');
for(const locale of appLocaleCodes){
 const whatsNew=spec.whatsNew[locale]?.trim();
 if(!whatsNew||whatsNew.length<50||whatsNew.length>4000)
  throw Error('Missing or invalid What’s New for '+locale);
 const existing=current.find(x=>x.attributes?.locale===locale);
 if(existing){
   await call('PATCH','appStoreVersionLocalizations/'+existing.id,{
    data:{type:'appStoreVersionLocalizations',id:existing.id,attributes:{whatsNew}}
   });
   console.log('Updated release notes '+locale);
 }else{
   const predecessor=priorLocals.find(x=>x.attributes?.locale===locale)?.attributes||{};
   const attributes={
    locale,whatsNew,
    description:predecessor.description,
    keywords:predecessor.keywords,
    supportUrl:predecessor.supportUrl,
    marketingUrl:predecessor.marketingUrl
   };
   for(const name of Object.keys(attributes)) if(attributes[name]==null)delete attributes[name];
   if(!attributes.description||!attributes.supportUrl)
     throw Error('No previous localized description/support URL for '+locale);
   await call('POST','appStoreVersionLocalizations',{
    data:{type:'appStoreVersionLocalizations',attributes,
     relationships:{appStoreVersion:{data:item('appStoreVersions',version.id)}}}
   });
   console.log('Created release localization '+locale);
 }
}
current=await list('appStoreVersions/'+version.id+'/appStoreVersionLocalizations?limit=100');
for(const locale of appLocaleCodes){
 const actual=current.find(x=>x.attributes?.locale===locale)?.attributes;
 if(actual?.whatsNew!==spec.whatsNew[locale].trim())
   throw Error('Release notes not persisted correctly by Apple: '+locale);
 if(!actual?.description?.trim())throw Error('Missing description: '+locale);
}
const buildLink=await get('appStoreVersions/'+version.id+'/relationships/build');
if(buildLink?.data?.id!==build.id){
 await call('PATCH','appStoreVersions/'+version.id+'/relationships/build',{
  data:item('builds',build.id)
 });
}
const confirmed=await get('appStoreVersions/'+version.id+'/relationships/build');
if(confirmed?.data?.id!==build.id)throw Error('Apple did not confirm exact release build');
console.log('Verified Apple version '+spec.version+' with exact build '+buildNumber+' and all release notes.');

// Modern reviewSubmissions API; do not claim publication from uploading alone.
const submission=await call('POST','reviewSubmissions',{
 data:{type:'reviewSubmissions',attributes:{platform:'IOS'},
  relationships:{app:{data:item('apps',app.id)}}}
});
const reviewId=submission.data?.id;
if(!reviewId)throw Error('Review submission creation not confirmed');
console.log('Created review submission '+reviewId);
await call('POST','reviewSubmissionItems',{
 data:{type:'reviewSubmissionItems',
  relationships:{reviewSubmission:{data:item('reviewSubmissions',reviewId)},
  appStoreVersion:{data:item('appStoreVersions',version.id)}}}
});
console.log('Added exact App Store version to review');
await call('PATCH','reviewSubmissions/'+reviewId,{
 data:{type:'reviewSubmissions',id:reviewId,attributes:{submitted:true}}
});
const review=await get('reviewSubmissions/'+reviewId);
const state=review.data?.attributes?.state;
if(!['WAITING_FOR_REVIEW','IN_REVIEW','COMPLETING','COMPLETE'].includes(state))
 throw Error('Review submission was requested, but Apple state is '+state+
  '; verify official status before declaring success');
console.log('APPLE_PUBLIC_REVIEW_SUBMITTED: app='+app.id+', version='+spec.version+
 ', build='+buildNumber+', state='+state+', submission='+reviewId);

// Confirm public build was actually processed by Apple; no TestFlight group changes.
import crypto from 'node:crypto';
for(const key of ['APPSTORE_API_KEY_ID','APPSTORE_API_ISSUER_ID','APPSTORE_API_PRIVATE_KEY','TARGET_BUILD'])
  if(!process.env[key]) throw Error('Missing '+key);
let key=process.env.APPSTORE_API_PRIVATE_KEY.trim().replace(/^["']|["']$/g,'')
  .replace(/\\r\\n/g,'\n').replace(/\\n/g,'\n');
if(!key.includes('-----BEGIN'))key=Buffer.from(key,'base64').toString('utf8');
const e=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const data=e({alg:'ES256',kid:process.env.APPSTORE_API_KEY_ID,typ:'JWT'})+'.'+
  e({iss:process.env.APPSTORE_API_ISSUER_ID,iat:now,exp:now+600,aud:'appstoreconnect-v1'});
const token=data+'.'+crypto.sign('sha256',Buffer.from(data),
  {key,dsaEncoding:'ieee-p1363'}).toString('base64url');
async function get(path) {
  const res=await fetch('https://api.appstoreconnect.apple.com/v1/'+path,{
    headers:{Authorization:'Bearer '+token}});
  const json=await res.json();
  if(!res.ok)throw Error('Apple '+res.status+': '+JSON.stringify(json.errors||[]).slice(0,800));
  return json;
}
const apps=await get('apps?filter%5BbundleId%5D=com.tifloacosta.app&limit=10');
const app=apps.data.find(x=>x.attributes?.bundleId==='com.tifloacosta.app');
if(!app)throw Error('App not found');
for(let attempt=0;attempt<20;attempt++) {
  const result=await get('builds?filter%5Bapp%5D='+app.id+'&sort=-uploadedDate&limit=50');
  const build=result.data.find(x=>x.attributes?.version===process.env.TARGET_BUILD);
  if(build) {
    const state=build.attributes.processingState;
    console.log('Apple build '+process.env.TARGET_BUILD+': '+state+', id='+build.id);
    if(['FAILED','INVALID'].includes(state))throw Error('Apple rejected processing for '+process.env.TARGET_BUILD);
    if(state==='VALID'){
      console.log('PUBLIC_BUILD_VALID='+build.id);
      process.exit(0);
    }
  } else console.log('Build '+process.env.TARGET_BUILD+' not indexed yet');
  if(attempt<19)await new Promise(resolve=>setTimeout(resolve,30000));
}
throw Error('Public build has not reached VALID processing; do not submit this version');

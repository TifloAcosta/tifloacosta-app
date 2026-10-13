// Only the internal TestFlight group is eligible. A successful upload from
// altool is not proof that Apple has processed or distributed the build.
import fs from 'node:fs';
import crypto from 'node:crypto';

const runNumber = Number(process.env.GITHUB_RUN_NUMBER);
const buildNumber = String(300000 + runNumber);
const appId = '6820517829';
const groupName = 'Probadores TifloAcosta';
if (!Number.isInteger(runNumber) || runNumber <= 0 ||
    !process.env.APPSTORE_API_KEY_ID || !process.env.APPSTORE_API_ISSUER_ID ||
    !process.env.ASC_KEY_PATH) {
  throw Error('Missing trusted workflow run number or App Store Connect key configuration');
}
const privateKey = fs.readFileSync(process.env.ASC_KEY_PATH);
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');

function token() {
  const now = Math.floor(Date.now()/1000);
  const input = encode({alg:'ES256',kid:process.env.APPSTORE_API_KEY_ID,typ:'JWT'})+'.'+
    encode({iss:process.env.APPSTORE_API_ISSUER_ID,iat:now,exp:now+900,aud:'appstoreconnect-v1'});
  return input+'.'+crypto.sign('sha256',Buffer.from(input),
    {key:privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
}

async function api(path, options={}) {
  const response = await fetch('https://api.appstoreconnect.apple.com/v1/'+path, {
    ...options, headers:{
      Authorization:'Bearer '+token(),
      'Content-Type':'application/json',
      ...options.headers
    }
  });
  const data = await response.json();
  if (!response.ok) throw Error('Apple HTTP '+response.status+': '+
    JSON.stringify(data.errors||data).slice(0,500));
  return data;
}

const groups = await api('betaGroups?filter%5Bapp%5D='+appId+'&limit=200');
const target = groups.data.find(group => group.attributes.isInternalGroup === true
  && group.attributes.name === groupName);
if (!target) throw Error('Internal beta group unavailable: '+groupName);

let confirmed=false;
for (let attempt=0;attempt<30;attempt++) {
  const response=await api('builds?filter%5Bapp%5D='+appId+
    '&sort=-uploadedDate&limit=50&include=buildBetaDetail,betaGroups');
  const build=response.data.find(item => String(item.attributes.version)===buildNumber);
  if(build) {
    const state=build.attributes.processingState;
    if(state==='FAILED'||state==='INVALID') throw Error('Apple rejected build '+buildNumber);
    if(state==='VALID') {
      const existing=(build.relationships?.betaGroups?.data||[]).map(x=>x.id);
      if(!existing.includes(target.id)) {
        try {
          await api('builds/'+build.id+'/relationships/betaGroups', {
            method:'POST',body:JSON.stringify({data:[{type:'betaGroups',id:target.id}]})
          });
        } catch(error) {
          console.log('Internal group assignment pending: '+error.message);
        }
      }
    }
    const fresh=await api('builds/'+build.id+'?include=buildBetaDetail,betaGroups');
    const groupIds=(fresh.data.relationships?.betaGroups?.data||[]).map(x=>x.id);
    const detailId=fresh.data.relationships?.buildBetaDetail?.data?.id;
    const detail=detailId
      ? (fresh.included?.find(x=>x.type==='buildBetaDetails'&&x.id===detailId)
        || (await api('buildBetaDetails/'+detailId)).data)
      : null;
    const betaState=detail?.attributes?.internalBuildState;
    console.log('Apple build '+buildNumber+': '+state+'; internal '+betaState+
      '; target group '+groupIds.includes(target.id));
    if(state==='VALID' && ['READY_FOR_BETA_TESTING','IN_BETA_TESTING'].includes(betaState)
       && groupIds.includes(target.id)) {
      console.log('APPLE TESTFLIGHT CONFIRMADO: compilación '+buildNumber+
        ' procesada, beta interna habilitada y grupo '+groupName+' asignado.');
      confirmed=true;
      break;
    }
  } else console.log('Apple has not yet processed build '+buildNumber);
  await new Promise(resolve=>setTimeout(resolve,45000));
}
if(!confirmed) throw Error('Apple TestFlight availability has not been confirmed. Do not notify as delivered.');

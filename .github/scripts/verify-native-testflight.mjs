// Verifica en la API de Apple que la beta se puede instalar y vincula,
// si es necesario, la compilación al grupo de probadores internos existente.
// No publica en la App Store ni incorpora probadores externos.
import crypto from 'node:crypto';
const required=['API_ID','API_ISSUER','API_PRIVATE','TARGET_BUILD'];
for(const key of required)if(!process.env[key])throw Error('Falta configuración protegida: '+key);
let privateKey=process.env.API_PRIVATE.trim().replace(/^["']|["']$/g,'')
  .replace(/\\r\\n/g,'\n').replace(/\\n/g,'\n');
if(!privateKey.includes('-----BEGIN')){
  try{const decoded=Buffer.from(privateKey,'base64').toString('utf8');
    if(decoded.includes('-----BEGIN'))privateKey=decoded;}catch{}
}
if(!privateKey.includes('-----BEGIN PRIVATE KEY-----'))throw Error('Clave Apple inválida');
const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const base=encode({alg:'ES256',kid:process.env.API_ID,typ:'JWT'})+'.'+
  encode({iss:process.env.API_ISSUER,iat:now,exp:now+1080,aud:'appstoreconnect-v1'});
const token=base+'.'+crypto.sign('sha256',Buffer.from(base),{
  key:privateKey,dsaEncoding:'ieee-p1363'
}).toString('base64url');
async function api(route,options={}){
  const response=await fetch('https://api.appstoreconnect.apple.com/v1/'+route,{
    ...options,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'}
  });
  const data=await response.json();
  if(!response.ok)throw Error('Apple HTTP '+response.status+': '+
    JSON.stringify(data.errors||[]).slice(0,600));
  return data;
}
const apps=await api('apps?filter%5BbundleId%5D=com.tifloacosta.app&limit=20');
const app=apps.data.find(x=>x.attributes.bundleId==='com.tifloacosta.app');
if(!app)throw Error('App Store Connect no tiene el identificador de TifloAcosta');

const groups=await api('betaGroups?filter%5Bapp%5D='+app.id+'&limit=200');
const group=groups.data.find(x=>x.attributes.name==='Probadores TifloAcosta'
  && x.attributes.isInternalGroup===true);
if(!group)throw Error('No existe el grupo interno Probadores TifloAcosta');

let assigned=false;
for(let attempt=1;attempt<=15;attempt++){
  const list=await api('builds?filter%5Bapp%5D='+app.id+
    '&sort=-uploadedDate&limit=50&include=buildBetaDetail,betaGroups');
  const build=list.data.find(x=>String(x.attributes.version)===process.env.TARGET_BUILD);
  if(build){
    const processing=build.attributes.processingState;
    if(processing==='FAILED'||processing==='INVALID')
      throw Error('Apple ha rechazado el procesamiento de la compilación '+process.env.TARGET_BUILD);
    const linked=(build.relationships?.betaGroups?.data||[]).map(x=>x.id);
    const already=linked.includes(group.id) || group.attributes.hasAccessToAllBuilds===true;
    if(processing==='VALID' && !already && !assigned){
      try{
        await api('betaGroups/'+group.id+'/relationships/builds',{
          method:'POST',body:JSON.stringify({data:[{type:'builds',id:build.id}]})
        });
        assigned=true;
        console.log('Compilación vinculada al grupo interno de TestFlight.');
      }catch(error){
        console.log('Vinculación no confirmada todavía: '+String(error.message).slice(0,300));
      }
    }
    const detailId=build.relationships?.buildBetaDetail?.data?.id;
    const detail=detailId?await api('buildBetaDetails/'+detailId):null;
    const internal=detail?.data?.attributes?.internalBuildState??'PENDIENTE';
    console.log('Apple: compilación '+process.env.TARGET_BUILD+
      '; procesamiento='+processing+'; beta interna='+internal+
      '; grupo='+(already||assigned?'vinculado':'pendiente')+'.');
    if(processing==='VALID' &&
       ['READY_FOR_BETA_TESTING','IN_BETA_TESTING'].includes(internal) &&
       (already||assigned)){
      console.log('TESTFLIGHT LISTO PARA INSTALAR: TifloAcosta iOS '+process.env.TARGET_BUILD);
      process.exit(0);
    }
  }else{
    console.log('Apple todavía está incorporando la compilación '+process.env.TARGET_BUILD+'.');
  }
  if(attempt<15)await new Promise(resolve=>setTimeout(resolve,45000));
}
throw Error('Apple no ha terminado de preparar TestFlight dentro de esta comprobación; la subida sigue vigente.');

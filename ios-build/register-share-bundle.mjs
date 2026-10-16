// Register the Share Extension Bundle ID ahead of Apple Developer App Groups
// configuration. This does not submit, sign, or publish a TestFlight build.
import crypto from 'node:crypto';

const privateSource = String(process.env.APPSTORE_API_PRIVATE_KEY || '').trim().replace(/^["']|["']$/g,'');
const key = privateSource.includes('-----BEGIN PRIVATE KEY-----')
  ? privateSource.replace(/\\r\\n/g,'\n').replace(/\\n/g,'\n')
  : Buffer.from(privateSource, 'base64').toString('utf8');
const keyId = process.env.APPSTORE_API_KEY_ID;
const issuerId = process.env.APPSTORE_API_ISSUER_ID;
if (!keyId || !issuerId || !key.includes('-----BEGIN PRIVATE KEY-----')) {
  throw new Error('Credenciales App Store Connect ausentes o incorrectas.');
}
const encode = x => Buffer.from(JSON.stringify(x)).toString('base64url');
const now = Math.floor(Date.now()/1000);
const header = encode({alg:'ES256',kid:keyId,typ:'JWT'});
const payload = encode({iss:issuerId,iat:now,exp:now+900,aud:'appstoreconnect-v1'});
const source = header+'.'+payload;
const signature = crypto.sign('sha256',Buffer.from(source),{
  key,dsaEncoding:'ieee-p1363'
}).toString('base64url');
const token = source+'.'+signature;
async function apple(path, options={}) {
  const response = await fetch('https://api.appstoreconnect.apple.com/v1/'+path,{
    ...options,
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...(options.headers||{})}
  });
  let result;
  try { result=await response.json(); } catch { result={}; }
  if(!response.ok) {
    const cause = (result.errors||[]).map(e=>e.code||e.title||'').filter(Boolean).join(', ');
    throw new Error('Apple Developer rechazó la operación ('+response.status+
      (cause ? ': '+cause.slice(0,140):'')+').');
  }
  return result;
}
async function bundle(identifier) {
  const search=await apple('bundleIds?filter[identifier]='+encodeURIComponent(identifier)+'&limit=100');
  return search.data?.find(x=>x.attributes?.identifier===identifier)||null;
}
const mainId='com.tifloacosta.app';
const shareId='com.tifloacosta.app.ShareExtension';
const main=await bundle(mainId);
if(!main) throw new Error('Falta App ID de TifloAcosta. No se crea ninguna app nueva.');
let extension=await bundle(shareId);
if (!extension) {
  const result=await apple('bundleIds',{
    method:'POST',body:JSON.stringify({data:{
      type:'bundleIds',
      attributes:{name:'TifloAcosta Compartir',platform:'IOS',identifier:shareId}
    }})
  });
  extension=result.data;
  if(extension?.attributes?.identifier!==shareId) throw new Error('Apple no confirmó identificador de la extensión.');
  console.log('Identificador de extensión creado en Apple Developer.');
} else {
  console.log('Identificador de extensión ya registrado en Apple Developer.');
}
// The public identifier API confirms both IDs. It does NOT confirm the
// assignment of the concrete App Group; Apple Developer Portal must do so.
console.log('Identificadores verificados: '+mainId+' y '+shareId+'.');
console.log('PASO MANUAL: registrar group.com.tifloacosta.app y asociarlo a los dos App IDs en Apple Developer.');
console.log('Este proceso no genera perfiles ni sube ningún IPA.');

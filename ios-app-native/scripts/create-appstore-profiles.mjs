// Crea perfiles de distribución para la app y su Share Extension.
// No modifica identificadores ni revoca certificados previos.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { profileAllowsCloudDocuments } from './icloud-profile-services.mjs';

const required = ['API_ID', 'API_ISSUER', 'ASC_KEY_PATH', 'IOS_TEMP_KEYCHAIN', 'GITHUB_RUN_ID'];
for (const key of required) if (!process.env[key]) throw Error('Falta configuración de firma: ' + key);
const now = Math.floor(Date.now() / 1000);
const b64 = x => Buffer.from(JSON.stringify(x)).toString('base64url');
const encoded = b64({alg:'ES256',kid:process.env.API_ID,typ:'JWT'}) + '.' +
  b64({iss:process.env.API_ISSUER,iat:now,exp:now+1000,aud:'appstoreconnect-v1'});
const key = fs.readFileSync(process.env.ASC_KEY_PATH);
const jwt = encoded + '.' + crypto.sign('sha256',Buffer.from(encoded),{
  key,dsaEncoding:'ieee-p1363'
}).toString('base64url');

async function api(endpoint, options={}) {
  const response = await fetch('https://api.appstoreconnect.apple.com/v1/' + endpoint,{
    ...options,headers:{Authorization:'Bearer '+jwt,'Content-Type':'application/json'}
  });
  const data = await response.json();
  if (!response.ok) throw Error('Apple HTTP '+response.status+': '+
    JSON.stringify(data.errors||[]).slice(0,500));
  return data;
}
const identity = execFileSync('security',['find-identity','-v','-p','codesigning',process.env.IOS_TEMP_KEYCHAIN],{
  encoding:'utf8'
}).match(/([A-F0-9]{40})\s+"/);
if(!identity) throw Error('No se encontró un certificado Apple Distribution válido en el llavero');
const signingSHA=identity[1].toUpperCase();

const certList = await api('certificates?limit=200');
const cert = certList.data.find(entry => {
  try {
    const der = entry.attributes.certificateContent;
    return der && new crypto.X509Certificate(Buffer.from(der,'base64'))
      .fingerprint.replaceAll(':','').toUpperCase() === signingSHA;
  } catch { return false; }
});
if(!cert) throw Error('El certificado local no coincide con uno vigente en Apple Developer');

const bundles=[
  ['com.tifloacosta.app','IOS_PROFILE_APP_NAME','TifloAcosta-App'],
  ['com.tifloacosta.app.ShareExtension','IOS_PROFILE_EXTENSION_NAME','TifloAcosta-Share']
];
const outputDirectory=path.join(process.env.HOME,'Library/MobileDevice/Provisioning Profiles');
fs.mkdirSync(outputDirectory,{recursive:true});
for (const [identifier,envName,slug] of bundles) {
  const found = await api('bundleIds?filter%5Bidentifier%5D='+encodeURIComponent(identifier));
  const bundle=found.data.find(x=>x.attributes.identifier===identifier);
  if(!bundle) throw Error('Falta identificador Apple Developer: '+identifier);
  // El grupo debe estar activado para los DOS App IDs, no solo declarado
  // en entitlements. El perfil firmado es la fuente de verdad.
  let capabilities = await api('bundleIds/'+bundle.id+'/bundleIdCapabilities');
  const hasAppGroups = capabilities.data.some(
    x => x.attributes?.capabilityType === 'APP_GROUPS'
  );
  if (!hasAppGroups) {
    if (process.env.TIFLO_SIGNING_PREFLIGHT === '1') {
      throw Error('Diagnóstico sin cambios de capacidades: falta APP_GROUPS en '+identifier);
    }
    await api('bundleIdCapabilities', {method:'POST',body:JSON.stringify({
      data:{type:'bundleIdCapabilities',attributes:{capabilityType:'APP_GROUPS'},
        relationships:{bundleId:{data:{type:'bundleIds',id:bundle.id}}}}
    })});
    capabilities = await api('bundleIds/'+bundle.id+'/bundleIdCapabilities');
    if (!capabilities.data.some(x => x.attributes?.capabilityType === 'APP_GROUPS')) {
      throw Error('No se habilitó APP_GROUPS en Apple Developer: '+identifier);
    }
  }
  // The main app must have iCloud enabled and its private container associated
  // by an authorized Apple Developer administrator. Do not silently change it.
  if (identifier === 'com.tifloacosta.app' &&
      !capabilities.data.some(x => x.attributes?.capabilityType === 'ICLOUD')) {
    throw Error('Falta habilitar iCloud Documents y asociar iCloud.com.tifloacosta.app en Apple Developer.');
  }
  const reuse=identifier === 'com.tifloacosta.app' && process.env.TIFLO_SIGNING_PREFLIGHT === '1' ? process.env.TIFLO_REUSE_APP_PROFILE : '';
  const name=reuse || slug+'-TestFlight-'+process.env.GITHUB_RUN_ID;
  let created;
  if (reuse) {
    const list=await api('profiles?filter%5Bname%5D='+encodeURIComponent(name));
    const matches=list.data.filter(x=>x.attributes?.name===name);
    if(matches.length!==1) throw Error('No se encontró unívocamente el perfil previo');
    created=await api('profiles/'+matches[0].id);
  } else {
    created=await api('profiles',{method:'POST',body:JSON.stringify({
    data:{type:'profiles',attributes:{name,profileType:'IOS_APP_STORE'},
      relationships:{
        bundleId:{data:{type:'bundleIds',id:bundle.id}},
        certificates:{data:[{type:'certificates',id:cert.id}]}
      }
    }
    })});
  }
  const profile=created.data;
  if(reuse && (profile?.attributes?.profileState !== 'ACTIVE' || profile.attributes.profileType !== 'IOS_APP_STORE'))
    throw Error('El perfil previo ya no está activo para App Store');
  if(!profile?.attributes?.profileContent || !profile.attributes.uuid)
    throw Error('Apple no devolvió el perfil '+identifier);
  const profilePath=path.join(outputDirectory,profile.attributes.uuid+'.mobileprovision');
  fs.writeFileSync(profilePath,
    Buffer.from(profile.attributes.profileContent,'base64'),{mode:0o600});
  const decoded=execFileSync('security',['cms','-D','-i',profilePath]);
  const inspected=JSON.parse(execFileSync('python3',['-c',
    'import plistlib,json,sys,hashlib; p=plistlib.loads(sys.stdin.buffer.read()); print(json.dumps({"entitlements":p.get("Entitlements", {}),"certificates":[hashlib.sha1(c).hexdigest().upper() for c in p.get("DeveloperCertificates", [])]}))'
  ],{input:decoded,encoding:'utf8'}));
  const entitlements=inspected.entitlements;
  if (!inspected.certificates.includes(signingSHA)) throw Error('El perfil no corresponde al certificado recuperado');
  if (entitlements['application-identifier'] !== '3A8G8A62YZ.'+identifier) throw Error('El perfil no corresponde al identificador de app esperado');
  if (reuse) console.log('Perfil principal existente recuperado sin duplicarlo.');
  const allowedGroups=entitlements['com.apple.security.application-groups'] || [];
  if(!allowedGroups.includes('group.com.tifloacosta.app')) {
    throw Error('El perfil Apple de '+identifier+
      ' no autoriza group.com.tifloacosta.app. Debe estar asociado al identificador en Apple Developer antes de subir la app.');
  }
  if (identifier === 'com.tifloacosta.app') {
    for (const entitlement of ['com.apple.developer.icloud-container-identifiers',
      'com.apple.developer.ubiquity-container-identifiers']) {
      if (!(entitlements[entitlement] || []).includes('iCloud.com.tifloacosta.app')) {
        throw Error('El perfil no autoriza el contenedor privado iCloud: '+entitlement);
      }
    }
    if (!profileAllowsCloudDocuments(entitlements['com.apple.developer.icloud-services'])) {
      throw Error('El perfil no autoriza iCloud Documents.');
    }
  }
  console.log('App Group autorizado en perfil de '+identifier);
  fs.appendFileSync(process.env.GITHUB_ENV,envName+'='+name+'\n');
  console.log('Perfil de distribución válido instalado para '+identifier);
}

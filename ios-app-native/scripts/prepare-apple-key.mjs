import fs from 'node:fs';
import path from 'node:path';
for(const name of ['API_ID','API_ISSUER','API_PRIVATE','P12_PASSWORD']) {
 if(!process.env[name]) throw Error('Falta credencial protegida: '+name);
}
let key=process.env.API_PRIVATE.trim().replace(/^["']|["']$/g,'')
  .replace(/\\r\\n/g,'\n').replace(/\\n/g,'\n');
if(!key.includes('-----BEGIN')) {
 try {
  const decoded=Buffer.from(key,'base64').toString('utf8');
  if(decoded.includes('-----BEGIN')) key=decoded;
 } catch {}
}
if(!key.includes('-----BEGIN PRIVATE KEY-----') || !key.includes('-----END PRIVATE KEY-----'))
 throw Error('La clave privada de App Store Connect no tiene formato válido');
const folder=path.join(process.env.HOME,'.appstoreconnect','private_keys');
fs.mkdirSync(folder,{recursive:true,mode:0o700});
const file=path.join(folder,'AuthKey_'+process.env.API_ID+'.p8');
fs.writeFileSync(file,key.trim()+'\n',{mode:0o600});
fs.appendFileSync(process.env.GITHUB_ENV,'ASC_KEY_PATH='+file+'\n');
console.log('Clave API de App Store Connect instalada sin exponer su contenido');

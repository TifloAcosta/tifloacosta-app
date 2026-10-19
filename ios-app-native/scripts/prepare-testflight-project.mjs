// Sólo prepara firma y numeración de la app oficial SwiftUI en el entorno temporal.
// No transforma prototipos ni compila aplicaciones web/Capacitor para iOS.
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve('ios-app-native');
const config = path.join(root,'project.yml');
let yaml=fs.readFileSync(config,'utf8');
for (const name of ['IOS_PROFILE_APP_NAME','IOS_PROFILE_EXTENSION_NAME','GITHUB_RUN_NUMBER']) {
  if(!process.env[name]) throw Error('Falta variable: '+name);
}
const version=String(Math.max(500003,500000+Number(process.env.GITHUB_RUN_NUMBER)));
if(!/^\d+$/.test(version))throw Error('Número de compilación inválido');
function replaceUnique(oldValue,newValue){
  if(yaml.split(oldValue).length!==2)throw Error('No se encuentra unívocamente '+oldValue);
  yaml=yaml.replace(oldValue,newValue);
}
replaceUnique(
  'PRODUCT_BUNDLE_IDENTIFIER: com.tifloacosta.app\n',
  [
    'PRODUCT_BUNDLE_IDENTIFIER: com.tifloacosta.app',
    '        DEVELOPMENT_TEAM: "3A8G8A62YZ"',
    '        CODE_SIGN_STYLE: Manual',
    '        CODE_SIGN_IDENTITY: "Apple Distribution"',
    '        PROVISIONING_PROFILE_SPECIFIER: "'+process.env.IOS_PROFILE_APP_NAME+'"',
    '        CURRENT_PROJECT_VERSION: "'+version+'"',
    '        MARKETING_VERSION: "1.0"',
    '        ASSETCATALOG_COMPILER_APPICON_NAME: "AppIcon"',
    ''
  ].join('\n')
);
replaceUnique(
  'PRODUCT_BUNDLE_IDENTIFIER: com.tifloacosta.app.ShareExtension\n',
  [
    'PRODUCT_BUNDLE_IDENTIFIER: com.tifloacosta.app.ShareExtension',
    '        DEVELOPMENT_TEAM: "3A8G8A62YZ"',
    '        CODE_SIGN_STYLE: Manual',
    '        CODE_SIGN_IDENTITY: "Apple Distribution"',
    '        PROVISIONING_PROFILE_SPECIFIER: "'+process.env.IOS_PROFILE_EXTENSION_NAME+'"',
    '        CURRENT_PROJECT_VERSION: "'+version+'"',
    '        MARKETING_VERSION: "1.0"',
    ''
  ].join('\n')
);
if((yaml.match(/CODE_SIGNING_ALLOWED: NO/g)||[]).length!==2)
 throw Error('No están presentes los dos objetivos firmables');
yaml=yaml.replaceAll('CODE_SIGNING_ALLOWED: NO','CODE_SIGNING_ALLOWED: YES');
fs.writeFileSync(config,yaml);
const assetDir=path.join(root,'Sources','Assets.xcassets','AppIcon.appiconset');
fs.mkdirSync(assetDir,{recursive:true});
fs.writeFileSync(path.join(assetDir,'Contents.json'),JSON.stringify({
  images:[{filename:'AppIcon.png',idiom:'universal',platform:'ios',size:'1024x1024'}],
  info:{author:'xcode',version:1}
},null,2));
fs.appendFileSync(process.env.GITHUB_ENV,'IOS_BUILD_VERSION='+version+'\n');
console.log('Se prepara la distribución de com.tifloacosta.app, compilación '+version);

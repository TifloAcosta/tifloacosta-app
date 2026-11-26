import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const languages=['en','pt','fr','it','de'];
const six=['es',...languages];
const source=path.join(root,'Sources');
const share=path.join(root,'ShareExtension');
function swiftFiles(dir){
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
    const p=path.join(dir,e.name);
    return e.isDirectory()?swiftFiles(p):e.name.endsWith('.swift')?[p]:[];
  });
}
function readDict(file){
  const raw=fs.readFileSync(file,'utf8');
  const map=new Map();
  for(const [,key,value] of raw.matchAll(/^"((?:\\.|[^"\\])*)"\s*=\s*"((?:\\.|[^"\\])*)";\s*$/gm)){
    assert.ok(!map.has(key),file+': duplicate '+key);
    assert.ok(value.trim().length,file+': empty '+key);
    map.set(key,value);
  }
  return map;
}
const main=new Map(languages.map(l=>[l,readDict(path.join(source,l+'.lproj','Localizable.strings'))]));
const ext=new Map(six.map(l=>[l,readDict(path.join(share,'Localizations',l+'.lproj','Localizable.strings'))]));
const sig=value=>[...value.replace(/%%/g,'').matchAll(/%(?:\d+\$)?[-+0 #]*\d*(?:\.\d+)?(?:hh|ll|[hlLzjt])?[@diufFeEgGxXoscpaA]/g)].map(m=>m[0].replace(/%\d+\$/,'%')).sort().join('|');
const line=(s,i)=>s.slice(0,i).split('\n').length;
function collect(files,patterns){
  const found=new Map();
  for(const file of files){
    const s=fs.readFileSync(file,'utf8');
    for(const pattern of patterns){
      for(const match of s.matchAll(pattern)){
        const key=match[1];
        if(!key||key.includes('\\(')||!/[A-Za-zÁÉÍÓÚáéíóúñÑ]/.test(key)) continue;
        if(!found.has(key))found.set(key,path.relative(root,file)+':'+line(s,match.index));
      }
    }
  }
  return found;
}
const literal=/\b(?:MusicLocalized\.(?:message|format)|NativeAppLanguage\.message)\s*\(\s*"((?:\\.|[^"\\])*)"/g;
const sharedLiteral=/\bShareLocale\.(?:message|format)\s*\(\s*"((?:\\.|[^"\\])*)"/g;
const ui=/\b(?:Menu|ProgressView|ContentUnavailableView|ShareLink|GroupBox|ControlGroup|Slider|Stepper|DatePicker|accessibilityValue|accessibilityRotor|accessibilityCustomContent|accessibilityAction\(\s*named:\s*Text|accessibilityLabel|accessibilityHint|Label|Text|Button|Section|Toggle|Picker|NavigationLink|DisclosureGroup|LabeledContent|TextField|SecureField|navigationTitle|alert|confirmationDialog|IntentDescription)\s*\(\s*"((?:\\.|[^"\\])*)"/g;
const intent=/\bLocalizedStringResource\s*=\s*"((?:\\.|[^"\\])*)"/g;
const shortTitle=/\bshortTitle:\s*"((?:\\.|[^"\\])*)"/g;
const properNames=new Set(['ISBN','iOS','TifloAcosta','Google','YouTube']);
function missing(found,dicts,exceptions=new Set()){
  const result=[];
  for(const [key,where] of found){
    if(exceptions.has(key)||/^\d+$/.test(key))continue;
    const absent=[...dicts].filter(([,d])=>!d.has(key)).map(([l])=>l);
    if(absent.length)result.push({key,where,absent});
  }
  return result;
}
const appFiles=swiftFiles(source), extensionFiles=swiftFiles(share);
test('release localization: catalog integrity and interpolation signatures',()=>{
  for(const [name,dicts] of [['app',main],['share',ext]]){
    const baseline=dicts.values().next().value;
    for(const [lang,d] of dicts){
      assert.deepEqual([...baseline.keys()].filter(k=>!d.has(k)),[],name+' '+lang+' missing keys');
      assert.deepEqual([...d.keys()].filter(k=>!baseline.has(k)),[],name+' '+lang+' extra keys');
      for(const [key,value] of d)assert.equal(sig(value),sig(key),name+' '+lang+' placeholder mismatch '+key);
    }
    console.log(name+' catalog: '+baseline.size+' keys in '+dicts.size+' languages');
  }
});
test('release localization: every explicit localized runtime key is present',()=>{
  const keys=collect(appFiles,[literal]), shareKeys=collect(extensionFiles,[sharedLiteral]);
  const gaps=[...missing(keys,main),...missing(shareKeys,ext)];
  console.log('LOCALIZATION_RUNTIME_SCAN '+JSON.stringify({appSwiftFiles:appFiles.length,shareSwiftFiles:extensionFiles.length,appKeys:keys.size,shareKeys:shareKeys.size,missing:gaps}));
  assert.deepEqual(gaps,[],'Runtime translation keys missing');
});
test('release localization: expanded navigation, controls and App Intents inventory',()=>{
  const controls=collect(appFiles,[ui,intent,shortTitle]);
  const gaps=missing(controls,main,properNames);
  console.log('LOCALIZATION_CONTROLS_SCAN '+JSON.stringify({files:appFiles.length,keys:controls.size,missing:gaps}));
  assert.deepEqual(gaps,[],'Missing menu/control/intent translations');
});
test('release localization: report dynamic strings for manual review',()=>{
  const candidates=[];
  const rawPattern=/(?:\breturn|\b(?:message|status|error|errorMessage|statusMessage|notice|feedback|warning|actionMessage|navigationFeedback)\s*=)\s*"[^"\n]*(?:[áéíóúñ¿¡]|\b(?:No se|No hay|Se ha|No puedes|No tienes|El archivo|La biblioteca|No fue|No es|Se han)\b)/;
  for(const file of [...appFiles,...extensionFiles]){
    const lines=fs.readFileSync(file,'utf8').split('\n');
    for(let i=0;i<lines.length;i++){
      const l=lines[i].trim();
      if(rawPattern.test(l)&&!l.startsWith('//'))candidates.push({file:path.relative(root,file),line:i+1,text:l.slice(0,250)});
    }
  }
  console.log('LOCALIZATION_DYNAMIC_REVIEW '+JSON.stringify({count:candidates.length,candidates}));
  // A lexical match can be an internal key, metadata, or real UI copy.
  // This inventory requires manual triage; it is not a translation-quality certificate.
  assert.ok(appFiles.length>100 && extensionFiles.length>0);
});

// Diagnostic only. No artefacts, publication, catalogue files or secrets in logs.
import { readFile } from 'node:fs/promises';
import { buildIndex, makeListPage } from './cinema-central-index.mjs';
const config = JSON.parse(await readFile(process.env.TIFLO_CINEMA_INDEX_CONFIG,'utf8'));
const key = process.env.TIFLO_CINEMA_SERVER_DRIVE_KEY;
if (!key || !/^AIza[A-Za-z0-9_-]{20,}$/.test(key)) {
  console.error('Dedicated Drive server secret is missing or invalid.');
  process.exit(1);
}
let success=true;
let totalBytes=0;
for (const sourceID of ['audesc-es','audesc-latino']) {
  let requests=0, pages=0;
  const started=Date.now();
  try {
    const client=await makeListPage(key,{onRequest:()=>{requests++}});
    const snapshot=await buildIndex({sourceID,root:config[sourceID],listPage:async (...args)=>{
      const result=await client(...args); pages++; return result;
    }});
    const bytes=Buffer.byteLength(JSON.stringify(snapshot));
    const titanic=snapshot.hits.filter(hit=>[hit.entry.name,...hit.path.slice(1).map(p=>p.name)]
      .some(name=>name.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().includes('titanic'))).length;
    if(snapshot.hits.length===0 || bytes>64*1024*1024) throw Error('Empty catalogue or exceeds iOS receiver limit');
    totalBytes+=bytes;
    console.log(JSON.stringify({sourceID,complete:true,records:snapshot.hits.length,pages,requests,bytes,titanicMatches:titanic,elapsedMs:Date.now()-started}));
  } catch(error) {
    success=false;
    // Never echo arbitrary remote responses, identifiers or stack traces.
    const msg=String(error?.message);
    const safe=/^Catalogue access refused: \d{3}$/.test(msg) ? msg :
      ['Incomplete catalogue','Repeated cursor; incomplete catalogue','Unresolved shortcut; publisher scope must be confirmed','Catalogue connection failed','Catalogue temporarily unavailable','Empty catalogue or exceeds iOS receiver limit'].includes(msg) ? msg : 'Catalogue probe failed';
    console.log(JSON.stringify({sourceID,complete:false,pages,requests,error:safe}));
  }
}
console.log(JSON.stringify({bothComplete:success,combinedIndexBytes:success?totalBytes:null,publication:false}));
if(!success) process.exitCode=1;

// Read-only, opt-in central catalogue generator. Never uploads or downloads media.
// Use a dedicated server credential only after publisher approval.
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const allowedSources = new Set(['audesc-es', 'audesc-latino']);
const idOK = id => typeof id === 'string' && /^[A-Za-z0-9_-]{10,200}$/.test(id);
const folderMime = 'application/vnd.google-apps.folder';
const shortcutMime = 'application/vnd.google-apps.shortcut';
const media = /\.(mp3|m4a|m4b|aac|wav|aif|aiff|caf|flac|mp4|m4v|mov)$/i;
const clean = item => ({
  id: item.id, name: item.name, isFolder: item.mimeType === folderMime,
  ...(Number.isSafeInteger(Number(item.size)) && item.size != null ? {size:Number(item.size)} : {})
});

export async function buildIndex({sourceID, root, listPage, now = () => new Date()}) {
  if (!allowedSources.has(sourceID) || !idOK(root?.id) || root.mimeType !== folderMime) throw Error('Invalid approved root');
  const pending = [{path:[root], token:null}];
  const folders = new Set([root.id]), pages = new Set(), hits = new Map();
  for (let offset=0; offset<pending.length; offset++) {
    const {path, token} = pending[offset];
    const folder = path.at(-1);
    const cursor = JSON.stringify([folder.id, token]);
    if (pages.has(cursor)) throw Error('Repeated cursor; incomplete catalogue');
    pages.add(cursor);
    const page = await listPage(folder, path, token);
    if (!Array.isArray(page?.files) || page.incompleteSearch) throw Error('Incomplete catalogue');
    for (const entry of page.files) {
      if (!idOK(entry?.id) || typeof entry.name !== 'string' || !entry.name || entry.name.length >= 500) throw Error('Invalid catalogue entry');
      if (entry.mimeType === shortcutMime) throw Error('Unresolved shortcut; publisher scope must be confirmed');
      if (entry.mimeType === folderMime) {
        if (!folders.has(entry.id)) {
          folders.add(entry.id);
          pending.push({path:[...path,entry],token:null});
        }
      } else if (media.test(entry.name)) {
        hits.set(entry.id,{sourceID,entry:clean(entry),path:path.map(clean)});
      }
    }
    if (page.nextPageToken != null) {
      if (typeof page.nextPageToken !== 'string' || !page.nextPageToken || page.nextPageToken.length >= 2048) throw Error('Invalid cursor');
      pending.push({path,token:page.nextPageToken});
    }
    if (offset >= 255) {
      pending.splice(0,offset+1);
      offset = -1;
    }
  }
  return {schema:1,sourceID,rootID:root.id,generatedAt:now().toISOString(),complete:true,hits:[...hits.values()]};
}

async function makeListPage(key) {
  return async (folder,path,token) => {
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.set('q', "'"+folder.id+"' in parents and trashed = false");
    url.searchParams.set('fields','nextPageToken,incompleteSearch,files(id,name,mimeType,size,resourceKey)');
    url.searchParams.set('pageSize','500');
    url.searchParams.set('supportsAllDrives','true');
    url.searchParams.set('includeItemsFromAllDrives','true');
    if (token) url.searchParams.set('pageToken',token);
    const keys = path.filter(x=>idOK(x.resourceKey)).map(x=>x.id+'/'+x.resourceKey).join(',');
    const headers = {'X-Goog-Api-Key':key,...(keys?{'X-Goog-Drive-Resource-Keys':keys}:{})};
    for (let attempt=0;attempt<3;attempt++) {
      let response;
      try {
        response = await fetch(url,{headers,redirect:'error',signal:AbortSignal.timeout(45000)});
      } catch {
        if(attempt===2) throw Error('Catalogue connection failed');
      }
      if(response?.ok) return await response.json();
      if(response && response.status!==429 && response.status<500) throw Error('Catalogue access refused: '+response.status);
      if(attempt<2) await new Promise(r=>setTimeout(r,1000*2**attempt));
    }
    throw Error('Catalogue temporarily unavailable');
  };
}

async function main() {
  // Explicit configuration must be supplied outside this repository.
  if(process.env.TIFLO_CINEMA_INDEX_AUTHORIZED !== 'yes') throw Error('Publisher central-index approval required');
  const key=process.env.TIFLO_CINEMA_SERVER_DRIVE_KEY;
  if(!key || !process.env.TIFLO_CINEMA_INDEX_CONFIG || !process.env.TIFLO_CINEMA_INDEX_OUTPUT) throw Error('Dedicated server key and approved configuration required');
  const config=JSON.parse(await readFile(process.env.TIFLO_CINEMA_INDEX_CONFIG,'utf8'));
  const output=resolve(process.env.TIFLO_CINEMA_INDEX_OUTPUT);
  // One snapshot per variant, no network publishing. A failed traversal never replaces a good file.
  const listPage=await makeListPage(key);
  for(const sourceID of allowedSources) {
    const root=config[sourceID];
    const snapshot=await buildIndex({sourceID,root,listPage});
    const destination=resolve(output,sourceID+'.json');
    await mkdir(dirname(destination),{recursive:true,mode:0o700});
    const temporary=destination+'.tmp';
    await writeFile(temporary,JSON.stringify(snapshot),{mode:0o600});
    await rename(temporary,destination);
    console.log(sourceID+': '+snapshot.hits.length+' metadata records, complete');
  }
}
if(process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error=>{console.error(error.message);process.exitCode=1;});
}

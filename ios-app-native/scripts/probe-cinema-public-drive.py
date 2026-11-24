#!/usr/bin/env python3
"""Read-only public Drive probe. Never log URLs, keys, names or file IDs."""
import os, plistlib, re, json, urllib.request, urllib.parse, urllib.error
from pathlib import Path
from collections import deque

key = os.environ.get("TIFLO_CINEMA_PUBLIC_DRIVE_API_KEY", "")
if not re.fullmatch(r"AIza[A-Za-z0-9_-]{25,196}", key):
    raise SystemExit("Missing or invalid Drive key")
config = plistlib.loads((Path(__file__).resolve().parents[1]/"Sources/Info.plist").read_bytes())
valid = lambda s: isinstance(s,str) and bool(re.fullmatch(r"[A-Za-z0-9_-]{10,200}",s))
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs): return None
opener = urllib.request.build_opener(NoRedirect())
def request(path, params, keys, media=False):
    url = "https://www.googleapis.com/drive/v3/files"+path+"?"+urllib.parse.urlencode(params)
    headers={"X-Ios-Bundle-Identifier":"com.tifloacosta.app","X-Goog-Api-Key":key}
    if keys: headers["X-Goog-Drive-Resource-Keys"]=",".join(keys)
    if media: headers["Range"]="bytes=0-4095"
    try:
        with opener.open(urllib.request.Request(url,headers=headers),timeout=25) as r:
            if media:
                data=r.read(4097)
                cr=r.headers.get("Content-Range","")
                return r.status, bool(r.status==206 and re.fullmatch(r"bytes 0-[0-9]+/[0-9]+",cr) and 0<len(data)<=4096)
            return r.status,json.loads(r.read(2000000))
    except urllib.error.HTTPError as e: return e.code,None
    except Exception: return 0,None

def probe(label, root, resource):
    if not valid(root):
        print(label+": invalid root"); return False
    q=deque([(root, [root+"/"+resource] if valid(resource) else [],0)])
    visited=set(); media=None; listed=0; failures=0
    while q and len(visited)<25 and not media:
        folder, keys, depth=q.popleft()
        if folder in visited: continue
        visited.add(folder)
        params={"q":f"'{folder}' in parents and trashed = false","fields":"nextPageToken,files(id,mimeType,name,resourceKey)","pageSize":100,"supportsAllDrives":"true","includeItemsFromAllDrives":"true"}
        for _ in range(3):
            status,data=request("",params,keys)
            if status!=200 or not isinstance(data,dict):
                print(f"{label}: list HTTP {status}, depth {depth}"); failures+=1; break
            rows=data.get("files",[]); listed+=len(rows)
            for row in rows:
                fid=row.get("id"); rk=row.get("resourceKey")
                if not valid(fid): continue
                childkeys=keys+([fid+"/"+rk] if valid(rk) else [])
                if row.get("mimeType")=="application/vnd.google-apps.folder" and depth<5:
                    q.append((fid,childkeys,depth+1))
                elif str(row.get("mimeType","")).startswith(("audio/","video/")):
                    media=(fid,childkeys); break
            if media or not data.get("nextPageToken"): break
            params["pageToken"]=data["nextPageToken"]
    print(f"{label}: {listed} entries sampled, {len(visited)} folders, {failures} list failures")
    if not media:
        print(label+": no media in bounded sample"); return False
    status,ok=request("/"+media[0],{"alt":"media"},media[1],True)
    print(f"{label}: media HTTP {status}, bounded range valid={ok}")
    return bool(ok)

results=[]
for label,prefix in [("Audesc ES","TifloCinemaAudescSpain"),("Audesc Latino","TifloCinemaAudescLatino")]:
    results.append(probe(label,config.get(prefix+"FolderID"),config.get(prefix+"ResourceKey")))
raise SystemExit(0 if all(results) else 1)

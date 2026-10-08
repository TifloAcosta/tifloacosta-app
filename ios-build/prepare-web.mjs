import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const output = resolve(import.meta.dirname, 'www');
const allowed = new Set(['.html','.js','.mjs','.css','.json','.webmanifest','.svg','.png','.jpg','.jpeg','.webp','.ico','.gif','.woff','.woff2','.ttf','.txt','.xml','.pdf','.mp3','.mp4','.vtt','.srt','.epub','.zip']);
const skip = new Set(['.git','.github','node_modules','ios-build','test','tests','scripts','.vscode']);
let copied = 0;
async function visit(from, to, depth = 0) {
  if (depth > 12) throw new Error('Profundidad inesperada al preparar archivos web');
  await mkdir(to, { recursive:true });
  for (const entry of await readdir(from, { withFileTypes:true })) {
    if (entry.name.startsWith('.') || skip.has(entry.name)) continue;
    const src = join(from,entry.name), dst = join(to,entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) { await visit(src,dst,depth+1); continue; }
    if (!entry.isFile()) continue;
    if (!allowed.has(extname(entry.name).toLowerCase())) continue;
    await cp(src,dst); copied++;
  }
}
await rm(output,{recursive:true,force:true});
await visit(root,output);
await stat(join(output,'index.html'));
console.log('Archivos preparados para iOS:',copied);

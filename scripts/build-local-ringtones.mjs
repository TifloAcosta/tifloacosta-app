import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const source = path.join(root, '.tone-import');
const mediaRoot = path.join(root, 'media', 'tones');

async function walk(dir) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else out.push(full);
  }
  return out;
}

const all = await walk(source);
const groups = {
  general: all.filter(f => /\.ogg$/i.test(f)),
  nokia: all.filter(f => /\.mp3$/i.test(f)),
  iphone: all.filter(f => /\.m4r$/i.test(f))
};

const expected = { general: 13, nokia: 30, iphone: 80 };
for (const [key, files] of Object.entries(groups)) {
  if (files.length !== expected[key]) {
    throw new Error(`${key}: se esperaban ${expected[key]} archivos y se encontraron ${files.length}`);
  }
}

await fs.rm(mediaRoot, { recursive: true, force: true });
for (const [key, files] of Object.entries(groups)) {
  const destDir = path.join(mediaRoot, key);
  await fs.mkdir(destDir, { recursive: true });
  for (const file of files) {
    await fs.copyFile(file, path.join(destDir, path.basename(file)));
  }
}

const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const href = (group, name) => `../../media/tones/${group}/${encodeURIComponent(name)}`;
const list = (group, files, lang) => files
  .map(f => path.basename(f))
  .sort((a,b)=>a.localeCompare(b, lang))
  .map(name => `<li><a href="${href(group,name)}" download>${esc(name)}</a></li>`)
  .join('\n');

function page(lang) {
  const es = lang === 'es';
  const title = es ? 'Colección de tonos' : 'Ringtone collection';
  const back = es ? 'Volver a TifloAcosta App' : 'Back to TifloAcosta App';
  const intro = es
    ? 'Todos los sonidos de esta colección están alojados directamente en TifloAcosta. Puedes descargarlos sin pasar por servicios externos.'
    : 'All sounds in this collection are hosted directly by TifloAcosta. You can download them without using an external service.';
  const sections = [
    ['general', es ? 'Colección general' : 'General collection', es ? '13 tonos variados.' : '13 assorted ringtones.'],
    ['nokia', es ? 'Tonos Nokia' : 'Nokia ringtones', es ? '30 tonos, avisos y alertas.' : '30 ringtones, notifications and alerts.'],
    ['iphone', es ? 'Tonos instrumentales para iPhone' : 'Instrumental ringtones for iPhone', es ? '80 temas en formato M4R.' : '80 tracks in M4R format.']
  ];
  const body = sections.map(([key,h,desc]) => `<section id="${key}"><h2>${h}</h2><p>${desc}</p><ul>\n${list(key,groups[key],lang)}\n</ul></section>`).join('\n');
  return `<!doctype html>\n<html lang="${lang}">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${title} | TifloAcosta</title>\n<style>body{font-family:Arial,Helvetica,sans-serif;line-height:1.65;max-width:900px;margin:0 auto;padding:1.25rem}h1,h2{line-height:1.25}h2{margin-top:2rem}li{margin:.45rem 0}a:focus{outline:3px solid currentColor;outline-offset:3px}.brand{font-weight:700}</style>\n</head>\n<body>\n<header><p class="brand">TifloAcosta</p><p><a href="../../">${back}</a></p><h1>${title}</h1><p>${intro}</p></header>\n<main>${body}</main>\n<footer><p><a href="../../">${back}</a></p></footer>\n</body>\n</html>`;
}

await fs.writeFile(path.join(root,'docs','es','tonos.html'), page('es'), 'utf8');
await fs.writeFile(path.join(root,'docs','en','ringtones.html'), page('en'), 'utf8');

console.log('Colección local preparada: 13 OGG, 30 MP3 y 80 M4R.');

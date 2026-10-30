// DAISY 2.02 and DAISY 3 archive reader for TifloLector web.
// Text-first extraction with audio inventory. Never executes scripts from books.
const normalize = value => String(value || '').replace(/\\/g, '/').replace(/^\.\//, '');
const strip = value => String(value || '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/\s+/g, ' ').trim();
function resolve(base, href) {
  const raw = String(href || '').split('#')[0].split('?')[0];
  if (!raw || /^(?:[a-z]+:|\/)/i.test(raw)) return '';
  const parts = [...normalize(base).split('/').slice(0,-1), ...raw.split('/')];
  const output = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') { if (!output.length) return ''; output.pop(); }
    else output.push(part);
  }
  return output.join('/');
}
export async function parseDaisyArchive(zip, {title='DAISY', language='es'}={}) {
  const files = Object.keys(zip.files || {}).filter(name => !zip.files[name].dir);
  const find = path => files.find(name => name.toLowerCase() === path.toLowerCase());
  const ncc = files.find(name => /(^|\/)ncc\.html?$/i.test(name));
  const opf = files.find(name => /\.opf$/i.test(name));
  const smils = files.filter(name => /\.smil$/i.test(name));
  if (!ncc && !opf && !smils.length) throw new Error('daisy-signature-missing');
  let ordered = [];
  if (ncc) {
    const markup = await zip.file(ncc).async('string');
    const hrefs = [...markup.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["']/gi)].map(m => resolve(ncc,m[1]));
    for (const name of hrefs) {
      if (/\.smil$/i.test(name) && find(name) && !ordered.includes(find(name))) ordered.push(find(name));
    }
  }
  if (opf) {
    const markup = await zip.file(opf).async('string');
    const itemMap = new Map();
    for (const match of markup.matchAll(/<item\b[^>]*\bid=["']([^"']+)["'][^>]*\bhref=["']([^"']+)["']/gi)) itemMap.set(match[1],resolve(opf,match[2]));
    const spine = [...markup.matchAll(/<itemref\b[^>]*\bidref=["']([^"']+)["']/gi)].map(m=>find(itemMap.get(m[1]))).filter(Boolean);
    if (spine.length) ordered.push(...spine);
  }
  ordered.push(...smils.filter(name=>!ordered.includes(name)));
  const textFiles=[];
  const audioFiles=[];
  const add=(name,arr)=>{const actual=find(name); if(actual&&!arr.includes(actual))arr.push(actual);};
  for (const smil of ordered) {
    const markup=await zip.file(smil).async('string');
    for (const m of markup.matchAll(/<(text|audio)\b[^>]*\bsrc=["']([^"']+)["']/gi)) {
      const target=resolve(smil,m[2]);
      if(m[1].toLowerCase()==='text') add(target,textFiles);
      else add(target,audioFiles);
    }
  }
  if (!textFiles.length) files.filter(name=>/\.(?:html?|xhtml|xml)$/i.test(name)&&!/(?:ncc\.html?|\.smil)$/i.test(name)).forEach(name=>add(name,textFiles));
  const sections=[];
  for (const path of textFiles) {
    if (!/\.(?:html?|xml)$/i.test(path)) continue;
    const markup=await zip.file(path).async('string');
    const body=markup.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || markup;
    const text=strip(body);
    if(text) sections.push({path,text});
  }
  const supportedAudio=audioFiles.filter(name=>/\.(?:mp3|m4a|wav|ogg)$/i.test(name));
  if (!sections.length && !supportedAudio.length) throw new Error('daisy-empty');
  return {title,language,sections,audioFiles:supportedAudio,hasText:sections.length>0,hasAudio:supportedAudio.length>0,text:sections.map(section=>section.text).join('\n\n')};
}

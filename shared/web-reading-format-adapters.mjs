function cleanText(value='') {
  return String(value ?? '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function htmlToBlocks(html, { language='', prefix='doc' }={}) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(String(html || ''), 'text/html');
  const blocks = [];
  let index = 0;
  const selector = 'h1,h2,h3,h4,h5,h6,p,li,blockquote,td,th';
  for (const node of doc.querySelectorAll(selector)) {
    const text = cleanText(node.textContent);
    if (!text) continue;
    let type = 'paragraph';
    let level;
    if (/^H[1-6]$/.test(node.tagName)) {
      type = 'heading';
      level = Number(node.tagName.slice(1));
    } else if (node.tagName === 'LI') type = 'list-item';
    else if (node.tagName === 'BLOCKQUOTE') type = 'quote';
    else if (node.tagName === 'TD' || node.tagName === 'TH') type = 'table-cell';
    const block = { id: `${prefix}-${++index}`, type, text };
    if (level) block.level = level;
    blocks.push(block);
  }
  return { language, blocks };
}

function xmlText(node) {
  return cleanText(node?.textContent || '');
}

function childElements(node, localName) {
  return [...(node?.getElementsByTagNameNS?.('*', localName) || [])];
}

export function parseMarkdownDocument(source='', options={}) {
  const lines = String(source || '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let paragraph = [];
  let index = 0;
  const flush = () => {
    const text = cleanText(paragraph.join(' '));
    paragraph = [];
    if (text) blocks.push({ id:`md-${++index}`, type:'paragraph', text });
  };
  const inline = value => cleanText(String(value)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_~`]+/g, ''));
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flush(); continue; }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flush();
      blocks.push({ id:`md-${++index}`, type:'heading', level:heading[1].length, text:inline(heading[2]) });
      continue;
    }
    const list = line.match(/^\s*(?:[-+*]|\d+[.)])\s+(.+)$/);
    if (list) {
      flush();
      blocks.push({ id:`md-${++index}`, type:'list-item', text:inline(list[1]) });
      continue;
    }
    const quote = line.match(/^\s*>\s?(.*)$/);
    if (quote) {
      flush();
      blocks.push({ id:`md-${++index}`, type:'quote', text:inline(quote[1]) });
      continue;
    }
    paragraph.push(inline(line));
  }
  flush();
  return {
    title: String(options.title || ''),
    author: '',
    language: String(options.language || ''),
    blocks
  };
}

export function parseRtfDocument(source='', options={}) {
  let text = String(source || '');
  text = text.replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex,16)));
  text = text.replace(/\\u(-?\d+)\??/g, (_, value) => {
    const number = Number(value);
    return Number.isFinite(number) ? String.fromCharCode(number < 0 ? number + 65536 : number) : '';
  });
  text = text.replace(/\\par[d]?\b/g, '\n\n');
  text = text.replace(/\\line\b/g, '\n');
  text = text.replace(/\\tab\b/g, '\t');
  text = text.replace(/\\[a-zA-Z]+-?\d* ?/g, '');
  text = text.replace(/[{}]/g, '');
  text = cleanText(text);
  const blocks = text.split(/\n\s*\n+/).map((value, index) => ({
    id:`rtf-${index+1}`, type:'paragraph', text:cleanText(value)
  })).filter(block => block.text);
  return { title:String(options.title || ''), author:'', language:String(options.language || ''), blocks };
}

export function parseFb2Document(source='', options={}) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(String(source || ''), 'application/xml');
  const title = xmlText(doc.querySelector('description title-info book-title')) || String(options.title || '');
  const first = xmlText(doc.querySelector('description title-info author first-name'));
  const last = xmlText(doc.querySelector('description title-info author last-name'));
  const language = xmlText(doc.querySelector('description title-info lang')) || String(options.language || '');
  const blocks = [];
  let index = 0;
  for (const node of doc.querySelectorAll('body title, body subtitle, body p, body poem stanza v')) {
    const text = xmlText(node);
    if (!text) continue;
    const tag = node.localName;
    const type = tag === 'title' || tag === 'subtitle' ? 'heading' : tag === 'v' ? 'quote' : 'paragraph';
    blocks.push({ id:`fb2-${++index}`, type, ...(type==='heading'?{level:tag==='title'?2:3}:{}), text });
  }
  return { title, author:cleanText(`${first} ${last}`), language, blocks };
}

export function parseDocxArchive(zip, options={}) {
  const documentXml = zip.file('word/document.xml');
  if (!documentXml) throw Object.assign(new Error('invalid-docx'), { code:'invalid-docx' });
  return Promise.all([
    documentXml.async('string'),
    zip.file('docProps/core.xml')?.async('string').catch(()=> '') || ''
  ]).then(([xml, core]) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'application/xml');
    const coreDoc = core ? parser.parseFromString(core, 'application/xml') : null;
    const title = xmlText(coreDoc?.getElementsByTagNameNS?.('*','title')?.[0]) || String(options.title || '');
    const author = xmlText(coreDoc?.getElementsByTagNameNS?.('*','creator')?.[0]);
    const blocks = [];
    let index = 0;
    for (const p of childElements(doc, 'p')) {
      const text = cleanText(childElements(p, 't').map(node => node.textContent || '').join(' '));
      if (!text) continue;
      const style = childElements(p, 'pStyle')[0]?.getAttributeNS?.('http://schemas.openxmlformats.org/wordprocessingml/2006/main','val')
        || childElements(p, 'pStyle')[0]?.getAttribute?.('w:val') || '';
      const heading = String(style).match(/heading\s*([1-6])/i);
      blocks.push({
        id:`docx-${++index}`,
        type: heading ? 'heading' : 'paragraph',
        ...(heading ? { level:Number(heading[1]) } : {}),
        text
      });
    }
    return { title, author, language:String(options.language || ''), blocks };
  });
}

export async function parseOdtArchive(zip, options={}) {
  const content = zip.file('content.xml');
  if (!content) throw Object.assign(new Error('invalid-odt'), { code:'invalid-odt' });
  const [xml, meta] = await Promise.all([
    content.async('string'),
    zip.file('meta.xml')?.async('string').catch(()=> '') || ''
  ]);
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  const metaDoc = meta ? parser.parseFromString(meta, 'application/xml') : null;
  const title = xmlText(metaDoc?.getElementsByTagNameNS?.('*','title')?.[0]) || String(options.title || '');
  const author = xmlText(metaDoc?.getElementsByTagNameNS?.('*','creator')?.[0]);
  const blocks = [];
  let index = 0;
  for (const node of [...childElements(doc,'h'), ...childElements(doc,'p')]) {
    const text = xmlText(node);
    if (!text) continue;
    const heading = node.localName === 'h';
    const level = Number(node.getAttributeNS?.('urn:oasis:names:tc:opendocument:xmlns:text:1.0','outline-level') || 1);
    blocks.push({ id:`odt-${++index}`, type:heading?'heading':'paragraph', ...(heading?{level:Math.min(6,Math.max(1,level))}:{}), text });
  }
  return { title, author, language:String(options.language || ''), blocks };
}

export async function parseEpubArchive(zip, options={}) {
  const containerFile = zip.file('META-INF/container.xml');
  if (!containerFile) throw Object.assign(new Error('invalid-epub'), { code:'invalid-epub' });
  const parser = new DOMParser();
  const container = parser.parseFromString(await containerFile.async('string'), 'application/xml');
  const rootfile = container.getElementsByTagNameNS('*','rootfile')[0];
  const opfPath = rootfile?.getAttribute('full-path') || '';
  if (!opfPath) throw Object.assign(new Error('invalid-epub'), { code:'invalid-epub' });
  const opfFile = zip.file(opfPath);
  if (!opfFile) throw Object.assign(new Error('invalid-epub'), { code:'invalid-epub' });
  const opf = parser.parseFromString(await opfFile.async('string'), 'application/xml');
  const base = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const title = xmlText(opf.getElementsByTagNameNS('*','title')[0]) || String(options.title || '');
  const author = xmlText(opf.getElementsByTagNameNS('*','creator')[0]);
  const language = xmlText(opf.getElementsByTagNameNS('*','language')[0]) || String(options.language || '');
  const manifest = new Map();
  for (const item of opf.getElementsByTagNameNS('*','item')) {
    const id = item.getAttribute('id');
    const href = item.getAttribute('href');
    if (id && href) manifest.set(id, href);
  }
  const blocks = [];
  let index = 0;
  for (const itemref of opf.getElementsByTagNameNS('*','itemref')) {
    const href = manifest.get(itemref.getAttribute('idref'));
    if (!href) continue;
    const normalized = new URL(href, 'https://epub.local/' + base).pathname.slice(1);
    const file = zip.file(normalized);
    if (!file) continue;
    const html = await file.async('string');
    const parsed = htmlToBlocks(html, { language, prefix:`epub-${index+1}` });
    for (const block of parsed.blocks) blocks.push({ ...block, id:`epub-${++index}` });
  }
  return { title, author, language, blocks };
}

export function parseHtmlStructured(source='', options={}) {
  const parsed = htmlToBlocks(source, { language:String(options.language || ''), prefix:'html' });
  return { title:String(options.title || ''), author:'', language:parsed.language, blocks:parsed.blocks };
}

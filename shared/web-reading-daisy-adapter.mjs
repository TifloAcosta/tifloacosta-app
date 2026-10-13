// Conservative DAISY 2.02/3 ZIP document importer.
// It recovers embedded *text* and document navigation; it must not pretend to
// implement synchronized DAISY audio playback or SMIL timing.
import { parseHtmlStructured } from './web-reading-format-adapters.mjs';

const BAD_ZIP = 'invalid-daisy';
function fail(code = BAD_ZIP) {
  const error = new Error(code);
  error.code = code;
  throw error;
}
function clean(value) { return String(value ?? '').replace(/\s+/gu, ' ').trim(); }

// Reject traversal and remote URLs before dereferencing any path inside ZIP.
export function resolveDaisyZipPath(baseFile, href) {
  const raw = String(href || '').split(/[?#]/u)[0].trim();
  if (!raw || raw.startsWith('/') || raw.startsWith('\\') ||
      /^[a-z][a-z0-9+.-]*:/iu.test(raw) || raw.includes('\\') ||
      /%2f|%5c/iu.test(raw)) return '';
  let decoded;
  try { decoded = decodeURIComponent(raw); } catch { return ''; }
  if (decoded.startsWith('/') || decoded.includes('\\')) return '';
  const base = String(baseFile || '').split('/').slice(0, -1).filter(Boolean);
  for (const segment of decoded.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (!base.length) return '';
      base.pop();
    } else if (segment.includes('\0')) return '';
    else base.push(segment);
  }
  return base.join('/');
}

export function daisyClockMs(value) {
  const cleanValue = String(value ?? '').trim().replace(/^npt=/iu, '').replace(/s$/iu, '');
  const pieces = cleanValue.split(':');
  if (!pieces.length || pieces.length > 3 || pieces.some(part => !/^\d+(?:\.\d+)?$/u.test(part))) return 0;
  const seconds = pieces.reduce((total, part) => total * 60 + Number(part), 0);
  return Math.max(0, Math.round(seconds * 1000));
}

function elements(node, name) {
  return [...(node?.getElementsByTagNameNS?.('*', name) || [])];
}
function parseXml(parser, data) {
  const document = parser.parseFromString(data, 'application/xml');
  if (elements(document, 'parsererror').length || document.querySelector?.('parsererror')) fail();
  return document;
}
function entryNames(zip) {
  return Object.keys(zip?.files || {}).filter(path => !zip.files[path]?.dir);
}
function findEntry(zip, name) {
  const key = entryNames(zip).find(path => path.toLowerCase() === name.toLowerCase());
  return key ? { path: key, file: zip.file(key) } : null;
}
function mediaPath(base, reference) {
  return resolveDaisyZipPath(base, reference);
}
function navFromNcc(document) {
  const links = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')];
  return links.map(node => ({
    label: clean(node.textContent),
    href: String(node.querySelector('a[href]')?.getAttribute('href') || ''),
    level: Math.max(1, Math.min(6, Number(node.tagName.slice(1)) || 1))
  })).filter(item => item.label && item.href);
}
function navFromNcx(document) {
  return elements(document, 'navPoint').map(node => {
    let level = 1;
    for (let parent = node.parentNode; parent; parent = parent.parentNode) {
      if (parent.localName === 'navPoint') level += 1;
    }
    return {
      label: clean(elements(node, 'navLabel')[0]?.getElementsByTagNameNS('*','text')[0]?.textContent),
      href: String(elements(node, 'content')[0]?.getAttribute('src') || ''),
      level: Math.min(6, level)
    };
  }).filter(item => item.label && item.href);
}
function blocksFromDtbook(document, prefix) {
  const blocks = [];
  for (const node of [...document.getElementsByTagName('*')]) {
    const name = String(node.localName || '').toLowerCase();
    if (!['h1','h2','h3','h4','h5','h6','hd','p','li','blockquote'].includes(name)) continue;
    const value = clean(node.textContent);
    if (!value) continue;
    const heading = /^h[1-6]$/u.test(name) || name === 'hd';
    const level = /^h[1-6]$/u.test(name) ? Number(name.slice(1)) : 2;
    blocks.push({
      id: prefix + '-' + (blocks.length + 1),
      type: heading ? 'heading' : name === 'li' ? 'list-item' : name === 'blockquote' ? 'quote' : 'paragraph',
      ...(heading ? { level } : {}),
      text: value
    });
  }
  return blocks;
}

export async function parseDaisyArchive(zip, options = {}) {
  const entries = entryNames(zip);
  if (!entries.length || entries.length > 5000) fail();
  const ncc = entries.find(name => /(?:^|\/)ncc\.html?$/iu.test(name));
  const ncx = entries.find(name => /\.ncx$/iu.test(name));
  if (!ncc && !ncx) fail('not-daisy');
  const parser = options.parser || new DOMParser();
  const isDaisy2 = Boolean(ncc);
  const navFile = isDaisy2 ? ncc : ncx;
  const navSource = await zip.file(navFile)?.async('string');
  if (!navSource) fail();
  const document = isDaisy2
    ? parser.parseFromString(navSource, 'text/html')
    : parseXml(parser, navSource);
  const navigation = (isDaisy2 ? navFromNcc(document) : navFromNcx(document))
    .map(item => ({
      ...item,
      smilId: String(item.href || '').split('#')[1] || '',
      href: mediaPath(navFile, item.href)
    })).filter(item => item.href);
  if (!navigation.length) fail();
  const smilPaths = [...new Set(navigation.map(item => item.href)
    .filter(path => /\.smil$/iu.test(path)))];
  const textPaths = [];
  const mediaSyncReferences = [];
  const audioClips = [];
  let containsAudio = false;
  for (const smilPath of smilPaths) {
    const source = await findEntry(zip, smilPath)?.file?.async('string');
    if (!source) fail('daisy-missing-resource');
    const smil = parseXml(parser, source);
    for (const pair of elements(smil, 'par')) {
      const textItem = elements(pair, 'text')[0];
      const audioItem = elements(pair, 'audio')[0];
      const sourceText = textItem?.getAttribute('src') || '';
      const sourceAudio = audioItem?.getAttribute('src') || '';
      const textPath = mediaPath(smilPath, sourceText);
      const audioPath = mediaPath(smilPath, sourceAudio);
      if (textPath && !textPaths.includes(textPath)) textPaths.push(textPath);
      if (audioPath) containsAudio = true;
      if (audioPath) {
        if (!/\.(?:mp3|m4a|aac|mp4)$/iu.test(audioPath) || !findEntry(zip, audioPath)) {
          fail('daisy-missing-resource');
        }
        const begin = daisyClockMs(audioItem.getAttribute('clip-begin') || audioItem.getAttribute('clipBegin'));
        const end = daisyClockMs(audioItem.getAttribute('clip-end') || audioItem.getAttribute('clipEnd'));
        if (end && end < begin) fail('invalid-daisy');
        audioClips.push({
          smilPath, smilId: String(pair.getAttribute?.('id') || ''),
          audioHref: audioPath, textHref: textPath, clipBeginMs: begin, clipEndMs: end
        });
      }
      if (textPath && audioPath) mediaSyncReferences.push({
        textHref: textPath, audioHref: audioPath,
        clipBeginMs: daisyClockMs(audioItem.getAttribute('clip-begin') || audioItem.getAttribute('clipBegin')),
        clipEndMs: daisyClockMs(audioItem.getAttribute('clip-end') || audioItem.getAttribute('clipEnd'))
      });
    }
  }
  // DAISY text-only archives can reference an HTML chapter directly from NCC.
  for (const item of navigation) {
    if (/\.(?:x?html?|xml)$/iu.test(item.href) && !textPaths.includes(item.href)) textPaths.push(item.href);
  }
  if (!textPaths.length) {
    for (const name of entries) {
      if (name === navFile) continue;
      if (/\.(?:x?html?|xml)$/iu.test(name) && !/package|container|opf|ncc/iu.test(name)) textPaths.push(name);
    }
  }
  const blocks = [];
  const seenText = new Set();
  for (const path of textPaths.slice(0, 300)) {
    if (seenText.has(path.toLowerCase()) || path === navFile) continue;
    seenText.add(path.toLowerCase());
    const entry = findEntry(zip, path);
    if (!entry?.file) fail('daisy-missing-resource');
    const source = await entry.file.async('string');
    const parsed = /\.xml$/iu.test(path)
      ? blocksFromDtbook(parseXml(parser, source), 'daisy-' + blocks.length)
      : parseHtmlStructured(source, { title: options.title || '', language: options.language || '' }).blocks;
    blocks.push(...parsed.map((block, index) => ({
      ...block, id: 'daisy-' + (blocks.length + index + 1)
    })));
  }
  if (!blocks.length && !audioClips.length) fail('daisy-no-text');
  if (!blocks.length) {
    for (const [index, item] of navigation.entries()) {
      blocks.push({ id: 'daisy-audio-' + index, type: 'heading',
        level: item.level, text: item.label });
    }
  }
  return {
    title: String(options.title || ''),
    language: String(options.language || ''),
    format: isDaisy2 ? 'daisy2.02' : 'daisy3',
    blocks, navigation,
    mediaSyncReferences, audioClips,
    audioUnavailable: false, containsAudio
  };
}

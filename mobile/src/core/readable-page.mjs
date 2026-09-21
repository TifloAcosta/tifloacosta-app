const NOISE_TERMS = [
  'share', 'social', 'related', 'recommend', 'comment', 'newsletter', 'cookie',
  'promo', 'advert', 'affiliate', 'breadcrumb', 'sidebar', 'subscribe'
];

const SOCIAL_HOSTS = [
  'facebook.com', 'twitter.com', 'x.com', 'instagram.com', 'linkedin.com',
  'tiktok.com', 'pinterest.com'
];

const NAMED_ENTITIES = Object.freeze({
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»'
});

function decodeEntities(value = '') {
  return String(value || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi, (match, entity) => {
    const key = entity.toLowerCase();
    if (key.startsWith('#x')) {
      const code = Number.parseInt(key.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (key.startsWith('#')) {
      const code = Number.parseInt(key.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[key] ?? match;
  });
}

function stripTags(value = '') {
  return String(value || '').replace(/<[^>]*>/g, ' ');
}

function cleanText(value = '') {
  return decodeEntities(stripTags(value)).replace(/\s+/g, ' ').trim();
}

function cleanInlineText(value = '') {
  const raw = decodeEntities(stripTags(value));
  if (!raw) return '';
  const leading = /^\s/.test(raw);
  const trailing = /\s$/.test(raw);
  const core = raw.replace(/\s+/g, ' ').trim();
  if (!core) return leading || trailing ? ' ' : '';
  return `${leading ? ' ' : ''}${core}${trailing ? ' ' : ''}`;
}

function sourceFromUrl(value = '') {
  try {
    return new URL(value).hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

function normalizeHttpHref(href, baseUrl) {
  try {
    const url = new URL(String(href || '').trim(), baseUrl);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

function attributeValue(attributes = '', name = '') {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const quoted = String(attributes).match(new RegExp(`\\b${escaped}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i'));
  if (quoted) return decodeEntities(quoted[2]);
  const unquoted = String(attributes).match(new RegExp(`\\b${escaped}\\s*=\\s*([^\\s>]+)`, 'i'));
  return unquoted ? decodeEntities(unquoted[1]) : '';
}

function hostMatches(host, domain) {
  return host === domain || host.endsWith(`.${domain}`);
}

export function isUsefulContentLink({ href = '', text = '', baseUrl = '' } = {}) {
  const url = normalizeHttpHref(href, baseUrl);
  if (!url) return false;
  const label = cleanText(text);
  if (!label) return false;

  const lowerLabel = label.toLocaleLowerCase();
  const lowerUrl = url.toLocaleLowerCase();
  const promotional = [
    'subscribe', 'suscr', 'buy now', 'comprar', 'newsletter', 'advert', 'affiliate',
    'share on', 'compartir en', 'cookie', 'sign up', 'regístrate', 'registrate'
  ];
  if (promotional.some(term => lowerLabel.includes(term) || lowerUrl.includes(term))) return false;

  try {
    const host = new URL(url).hostname.toLowerCase();
    if (SOCIAL_HOSTS.some(domain => hostMatches(host, domain))) return false;
  } catch {
    return false;
  }
  return true;
}

function stripSemanticNoise(html = '') {
  let output = String(html || '');
  const tags = ['script', 'style', 'template', 'noscript', 'nav', 'header', 'footer', 'aside', 'form', 'button', 'svg', 'iframe'];
  for (const tag of tags) {
    const pattern = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, 'gi');
    for (let pass = 0; pass < 3; pass += 1) output = output.replace(pattern, ' ');
  }
  return output;
}

function stripNoisyContainers(html = '') {
  let output = String(html || '');
  const terms = NOISE_TERMS.join('|');
  const pattern = new RegExp(
    `<(div|section|ul|ol|p|li)\\b(?=[^>]*(?:class|id)\\s*=\\s*(["'])[^"']*(?:${terms})[^"']*\\2)[^>]*>[\\s\\S]*?<\\/\\1\\s*>`,
    'gi'
  );
  for (let pass = 0; pass < 4; pass += 1) output = output.replace(pattern, ' ');
  return output;
}

function readableScope(html = '') {
  const cleaned = stripNoisyContainers(stripSemanticNoise(html));
  for (const tag of ['article', 'main', 'body']) {
    const match = cleaned.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}\\s*>`, 'i'));
    if (match) return match[1];
  }
  return cleaned;
}

function extractTitle(html, scope) {
  const h1 = String(scope || '').match(/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/i);
  if (h1) {
    const value = cleanText(h1[1]);
    if (value) return value;
  }
  const title = String(html || '').match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i);
  return title ? cleanText(title[1]) : '';
}

function appendTextPart(parts, value) {
  if (!value) return;
  if (parts.at(-1)?.type === 'text') {
    parts.at(-1).text += value;
  } else {
    parts.push({ type: 'text', text: value });
  }
}

function parseInlineParts(innerHtml, baseUrl) {
  const parts = [];
  const source = String(innerHtml || '');
  const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi;
  let cursor = 0;
  let match;
  while ((match = anchorPattern.exec(source))) {
    appendTextPart(parts, cleanInlineText(source.slice(cursor, match.index)));
    const label = cleanText(match[2]);
    const href = attributeValue(match[1], 'href');
    const url = normalizeHttpHref(href, baseUrl);
    if (url && isUsefulContentLink({ href: url, text: label, baseUrl })) {
      parts.push({ type: 'link', text: label, url });
    } else if (label) {
      appendTextPart(parts, label);
    }
    cursor = anchorPattern.lastIndex;
  }
  appendTextPart(parts, cleanInlineText(source.slice(cursor)));

  return parts
    .map(part => part.type === 'text' ? { ...part, text: part.text.replace(/\s+/g, ' ') } : part)
    .filter(part => part.type === 'link' || part.text.trim());
}

function partsText(parts = []) {
  return parts.map(part => part.text || '').join(' ').replace(/\s+/g, ' ').trim();
}

function isDescriptiveLink(part) {
  if (!part || part.type !== 'link') return false;
  const text = String(part.text || '').trim();
  if (text.length < 4) return false;
  return !/^(click here|read more|more|here|pincha aquí|pincha aqui|leer más|leer mas|más|mas)$/i.test(text);
}

function htmlBlocks(scope, baseUrl) {
  const blocks = [];
  const pattern = /<(h[1-6]|p|li)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi;
  let match;
  let previousSignature = '';
  while ((match = pattern.exec(String(scope || '')))) {
    const tag = match[1].toLowerCase();
    if (tag.startsWith('h')) {
      const text = cleanText(match[2]);
      if (!text) continue;
      const sourceLevel = Number(tag.slice(1));
      const level = sourceLevel <= 2 ? 2 : sourceLevel === 3 ? 3 : 4;
      const signature = `heading:${text}`;
      if (signature === previousSignature) continue;
      blocks.push({ type: 'heading', level, text });
      previousSignature = signature;
      continue;
    }

    const parts = parseInlineParts(match[2], baseUrl);
    const text = partsText(parts);
    if (!text) continue;
    const type = tag === 'li' ? 'list-item' : 'paragraph';
    const signature = `${type}:${text}`;
    if (signature === previousSignature) continue;
    blocks.push({ type, parts });
    previousSignature = signature;
  }
  return blocks;
}

function htmlReliability(title, blocks) {
  if (!title) return false;
  const prose = blocks.filter(block => block.type === 'paragraph' || block.type === 'list-item');
  const substantive = prose.map(block => partsText(block.parts)).filter(text => text.length >= 30);
  const total = substantive.reduce((sum, text) => sum + text.length, 0);
  if (substantive.length >= 2 && total >= 160) return true;

  const usefulLinks = prose.flatMap(block => block.parts || []).filter(isDescriptiveLink);
  return usefulLinks.length >= 2;
}

function plainTextPage({ text, url }) {
  const normalized = String(text || '').replace(/\r\n?/g, '\n').trim();
  const source = sourceFromUrl(url);
  const paragraphs = normalized.split(/\n\s*\n+/).map(value => value.replace(/[\t ]+/g, ' ').trim()).filter(Boolean);
  const firstLine = normalized.split('\n').map(value => value.trim()).find(Boolean) || '';
  const title = firstLine.slice(0, 120) || source;
  const blocks = paragraphs.map(value => ({ type: 'paragraph', parts: [{ type: 'text', text: value }] }));
  const nonWhitespace = normalized.replace(/\s/g, '').length;
  return { reliable: nonWhitespace >= 80, title, source, url, blocks };
}

export function extractReadablePage({ html = '', url = '', contentType = '' } = {}) {
  const baseUrl = normalizeHttpHref(url, url);
  const source = sourceFromUrl(baseUrl || url);
  const mime = String(contentType || '').split(';', 1)[0].trim().toLowerCase();

  if (mime === 'text/plain') {
    return plainTextPage({ text: html, url: baseUrl || url });
  }

  if (mime && mime !== 'text/html' && mime !== 'application/xhtml+xml') {
    return { reliable: false, title: source, source, url: baseUrl || url, blocks: [] };
  }

  const scope = readableScope(html);
  const extractedTitle = extractTitle(html, scope);
  const title = extractedTitle || source;
  const blocks = htmlBlocks(scope, baseUrl || url);
  return {
    reliable: htmlReliability(extractedTitle, blocks),
    title,
    source,
    url: baseUrl || url,
    blocks
  };
}

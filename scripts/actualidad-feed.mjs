import { createHash } from 'node:crypto';

const trackingParams = new Set(['fbclid', 'gclid', 'dclid', 'msclkid']);

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function cleanText(value) {
  return decodeEntities(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractBlocks(xml, tag) {
  const name = escapeRegExp(tag);
  const regex = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, 'gi');
  return [...String(xml || '').matchAll(regex)].map(match => match[1]);
}

function extractTag(block, names) {
  for (const tag of names) {
    const name = escapeRegExp(tag);
    const match = String(block || '').match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
    if (match) return cleanText(match[1]);
  }
  return '';
}

function extractAtomLink(block) {
  const links = [...String(block || '').matchAll(/<link\b([^>]*)\/?\s*>/gi)];
  for (const match of links) {
    const attrs = match[1] || '';
    const href = attrs.match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
    const rel = attrs.match(/rel\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
    if (href && (!rel || rel === 'alternate')) return decodeEntities(href).trim();
  }
  return '';
}

export function canonicalizeUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      const lower = key.toLowerCase();
      if (lower.startsWith('utm_') || trackingParams.has(lower)) url.searchParams.delete(key);
    }
    return url.toString();
  } catch (error) {
    return '';
  }
}

export function stableStoryId(sourceId, canonicalUrl) {
  const source = String(sourceId || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  const hash = createHash('sha256').update(`${source}\n${canonicalUrl}`).digest('hex').slice(0, 16);
  return `${source}-${hash}`;
}

export function parseFeedXml(xml, source = {}) {
  const text = String(xml || '');
  const rssItems = extractBlocks(text, 'item');
  const blocks = rssItems.length ? rssItems : extractBlocks(text, 'entry');
  const atom = rssItems.length === 0;

  return blocks.map(block => ({
    title: extractTag(block, ['title']),
    url: atom ? extractAtomLink(block) : extractTag(block, ['link']),
    publishedAt: extractTag(block, atom ? ['published', 'updated'] : ['pubDate', 'dc:date', 'date']),
    summary: extractTag(block, atom ? ['summary', 'content'] : ['description', 'content:encoded'])
  })).filter(item => item.title && item.url);
}

export function normalizeFeedEntry(entry, source) {
  const originalUrl = canonicalizeUrl(entry?.url);
  const date = new Date(entry?.publishedAt);
  if (!source?.id || !source?.name || !source?.homepage || !['es', 'en'].includes(source?.lang)) return null;
  if (!originalUrl || Number.isNaN(date.getTime()) || !Array.isArray(source.categories) || source.categories.length === 0) return null;

  return {
    id: stableStoryId(source.id, originalUrl),
    lang: source.lang,
    title: cleanText(entry.title),
    sourceId: source.id,
    sourceName: source.name,
    sourceUrl: source.homepage,
    originalUrl,
    publishedAt: date.toISOString(),
    categories: [...new Set(source.categories.filter(Boolean))],
    editorialState: 'source-only',
    summary: cleanText(entry.summary),
    body: '',
    featuredRank: null
  };
}

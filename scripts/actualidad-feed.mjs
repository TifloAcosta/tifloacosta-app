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

function searchableText(value) {
  return cleanText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasAny(text, terms) {
  const padded = ` ${text} `;
  return terms.some(term => padded.includes(` ${term} `));
}

function extractBlocks(xml, tag) {
  const name = escapeRegExp(tag);
  const regex = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, 'gi');
  return [...String(xml || '').matchAll(regex)].map(match => match[1]);
}

function extractRawTag(block, names) {
  for (const tag of names) {
    const name = escapeRegExp(tag);
    const match = String(block || '').match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
    if (match) {
      return String(match[1] || '')
        .replace(/^\s*<!\[CDATA\[/, '')
        .replace(/\]\]>\s*$/, '')
        .trim();
    }
  }
  return '';
}

function extractTag(block, names) {
  const raw = extractRawTag(block, names);
  return raw ? cleanText(raw) : '';
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

function extractHtmlLink(block) {
  const match = String(block || '').match(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/i);
  return match ? decodeEntities(match[1]).trim() : '';
}

function absoluteUrl(value, base) {
  try {
    return new URL(decodeEntities(value).trim(), base).toString();
  } catch (error) {
    return '';
  }
}

function spanishDate(value) {
  const match = String(value || '').match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (!match) return '';
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T12:00:00.000Z`;
}

function stripNoiseContainers(html) {
  let output = String(html || '');
  const semanticNoise = ['script', 'style', 'template', 'noscript', 'nav', 'header', 'footer', 'aside', 'figure', 'form', 'button', 'svg', 'iframe'];
  for (const tag of semanticNoise) {
    const name = escapeRegExp(tag);
    output = output.replace(new RegExp(`<${name}\\b[^>]*>[\\s\\S]*?<\\/${name}>`, 'gi'), ' ');
  }

  const noisyContainer = /<(div|section|ul|ol)\b[^>]*(?:class|id)\s*=\s*["'][^"']*(?:share|social|related|recommend|comment|newsletter|cookie|promo|advert|sidebar|breadcrumb)[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi;
  for (let pass = 0; pass < 3; pass += 1) output = output.replace(noisyContainer, ' ');
  return output;
}

function articleScope(html) {
  const cleaned = stripNoiseContainers(html);
  const article = cleaned.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  if (article) return article[1];
  const main = cleaned.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  return main ? main[1] : cleaned;
}

function jsonLdArticleBody(html) {
  const scripts = [...String(html || '').matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const findBody = value => {
    if (!value) return '';
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findBody(item);
        if (found) return found;
      }
      return '';
    }
    if (typeof value !== 'object') return '';
    if (typeof value.articleBody === 'string' && value.articleBody.trim()) return value.articleBody.trim();
    for (const child of Object.values(value)) {
      const found = findBody(child);
      if (found) return found;
    }
    return '';
  };

  for (const script of scripts) {
    try {
      const body = findBody(JSON.parse(decodeEntities(script[1])));
      if (body) return body;
    } catch (error) { /* malformed metadata is ignored */ }
  }
  return '';
}

export function extractReadableText(html) {
  const text = String(html || '').trim();
  if (!text) return '';

  const scope = articleScope(text);
  const paragraphs = [...scope.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(match => cleanText(match[1]))
    .filter(Boolean);

  if (paragraphs.length) {
    const unique = [];
    for (const paragraph of paragraphs) {
      if (unique[unique.length - 1] !== paragraph) unique.push(paragraph);
    }
    return unique.join('\n\n');
  }

  const structured = jsonLdArticleBody(text);
  if (!structured) return '';
  return decodeEntities(structured)
    .split(/\n\s*\n|\r?\n/)
    .map(value => value.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');
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

  return blocks.map(block => {
    const contentHtml = extractRawTag(block, atom ? ['content'] : ['content:encoded']);
    const summary = extractTag(block, atom ? ['summary'] : ['description']) || cleanText(contentHtml);
    return {
      title: extractTag(block, ['title']),
      url: atom ? extractAtomLink(block) : extractTag(block, ['link']),
      publishedAt: extractTag(block, atom ? ['published', 'updated'] : ['pubDate', 'dc:date', 'date']),
      summary,
      contentHtml
    };
  }).filter(item => item.title && item.url);
}

export function parseCtiNewsHtml(html, source = {}) {
  const text = String(html || '');
  const headings = [...text.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)];
  const entries = [];

  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    const link = heading[1].match(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!link) continue;

    const url = absoluteUrl(link[1], source.homepage || 'https://cti.once.es/');
    if (!url || !/\/noticias\//i.test(new URL(url).pathname)) continue;

    const title = cleanText(link[2]);
    if (!title) continue;

    const start = heading.index + heading[0].length;
    const end = index + 1 < headings.length ? headings[index + 1].index : Math.min(text.length, start + 3000);
    const block = text.slice(start, end);
    const publishedAt = spanishDate(cleanText(block));
    if (!publishedAt) continue;

    const paragraphs = [...block.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
      .map(match => cleanText(match[1]))
      .filter(Boolean);

    entries.push({
      title,
      url,
      publishedAt,
      summary: paragraphs[0] || ''
    });
  }

  return entries;
}

export function parseBuscaAppsHtml(html, source = {}) {
  const text = String(html || '');
  const headings = [...text.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)];
  const entries = [];
  const seen = new Set();
  const base = source.homepage || 'https://www.buscaapps.com/';
  const sourceId = String(source.id || 'buscaapps').trim() || 'buscaapps';

  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    const headingText = cleanText(heading[1]);
    const meta = headingText.match(/^(.+?):?\s*\(([^()]+)\)\s*$/);
    if (!meta) continue;

    const title = meta[1].replace(/:\s*$/, '').trim();
    const platform = meta[2].trim();
    if (!title || !platform) continue;

    const start = heading.index + heading[0].length;
    const end = index + 1 < headings.length ? headings[index + 1].index : Math.min(text.length, start + 4000);
    const block = text.slice(start, end);
    const href = extractHtmlLink(heading[1]) || extractHtmlLink(block);
    const url = canonicalizeUrl(absoluteUrl(href, base));
    if (!url) continue;

    const id = stableStoryId(sourceId, url);
    if (seen.has(id)) continue;
    seen.add(id);

    const summary = [...block.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
      .map(match => cleanText(match[1]))
      .find(Boolean) || '';

    entries.push({ id, title, url, platform, summary });
  }

  return entries;
}

export function detectNewDiscoveryItems(items, seenIds = []) {
  const seen = seenIds instanceof Set
    ? new Set(seenIds)
    : new Set(Array.isArray(seenIds) ? seenIds : []);
  const emitted = new Set();
  const result = [];

  for (const item of Array.isArray(items) ? items : []) {
    const id = String(item?.id || '').trim();
    if (!id || seen.has(id) || emitted.has(id)) continue;
    emitted.add(id);
    result.push(item);
  }

  return result;
}

export function classifyStoryCategories(entry = {}) {
  const title = searchableText(entry.title);
  const text = `${title} ${searchableText(entry.summary)}`.trim();
  const categories = [];
  const add = category => {
    if (!categories.includes(category)) categories.push(category);
  };

  if (hasAny(text, ['apple', 'iphone', 'ipad', 'ios', 'macos', 'macbook', 'voiceover', 'airpod', 'airpods', 'watchos', 'apple watch', 'siri'])) add('apple');
  if (hasAny(text, ['android', 'talkback', 'pixel', 'google play', 'play store', 'samsung galaxy'])) add('android');
  if (hasAny(text, ['windows', 'microsoft', 'edge', 'office', 'outlook'])) add('windows');
  if (hasAny(text, ['jaws', 'freedom scientific', 'vispero'])) add('jaws');
  if (hasAny(text, ['nvda', 'nv access'])) add('nvda');
  if (hasAny(text, ['app', 'apps', 'aplicacion', 'aplicaciones', 'app store', 'google play', 'play store'])) add('apps-accesibles');
  if (hasAny(text, ['programa', 'programas', 'software', 'aplicacion de escritorio', 'desktop app'])) add('programas-accesibles');
  if (hasAny(text, ['gafas inteligentes', 'smart glasses', 'ray ban meta', 'meta ray ban'])) add('gafas-inteligentes');
  if (hasAny(text, ['prototipo', 'prototipos', 'proyecto', 'proyectos', 'investigacion', 'investigaciones', 'estudio', 'estudios', 'prueba piloto'])) add('proyectos-prototipos');
  if (hasAny(text, ['inteligencia artificial', 'artificial intelligence', 'machine learning', 'chatgpt', 'gemini', 'copilot', 'llm', 'ia', 'ai'])) add('ia-accesibilidad');
  if (hasAny(text, ['braille', 'orbit research', 'orbit reader', 'perkins', 'linea braille', 'pantalla braille', 'braille display'])) add('braille');
  if (hasAny(text, ['movilidad', 'orientacion', 'navegacion', 'gps', 'wayfinding', 'baston', 'baliza', 'beacon', 'desplazamiento', 'desplazamientos'])) add('movilidad');
  if (hasAny(text, ['sordociega', 'sordociegas', 'sordociego', 'sordociegos', 'deafblind', 'deaf blind'])) add('sordoceguera');
  if (hasAny(title, ['lanzamiento', 'lanzamientos', 'a la venta', 'nuevo dispositivo', 'nuevo producto'])) add('productos-disponibles');

  return categories;
}

export function normalizeFeedEntry(entry, source) {
  const originalUrl = canonicalizeUrl(entry?.url);
  const date = new Date(entry?.publishedAt);
  if (!source?.id || !source?.name || !source?.homepage || !['es', 'en'].includes(source?.lang)) return null;
  if (!originalUrl || Number.isNaN(date.getTime()) || !Array.isArray(source.categories) || source.categories.length === 0) return null;

  const title = cleanText(entry.title);
  const summary = cleanText(entry.summary);
  const categories = [...new Set([...source.categories.filter(Boolean), ...classifyStoryCategories({ title, summary })])];

  return {
    id: stableStoryId(source.id, originalUrl),
    lang: source.lang,
    title,
    sourceId: source.id,
    sourceName: source.name,
    sourceUrl: source.homepage,
    originalUrl,
    publishedAt: date.toISOString(),
    categories,
    editorialState: 'source-only',
    summary,
    body: extractReadableText(entry?.contentHtml),
    featuredRank: null
  };
}

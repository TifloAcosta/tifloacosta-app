import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const FEED_URL = 'https://anchor.fm/s/5b48ca28/podcast/rss';
const OUTPUT = new URL('../podcast-episodes.json', import.meta.url);
const LIMIT = 30;

function decodeXml(value) {
  return String(value || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(?:amp|lt|gt|quot|apos|#(\d+)|#x([0-9a-f]+));/gi, (match, decimal, hex) => {
      const named = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
      if (named[match.toLowerCase()]) return named[match.toLowerCase()];
      const code = decimal ? Number(decimal) : parseInt(hex, 16);
      return Number.isInteger(code) && code >= 32 && code <= 0x10ffff
        ? String.fromCodePoint(code) : '';
    });
}

function field(xml, name) {
  const match = String(xml).match(new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + name + '\\s*>', 'i'));
  return decodeXml(match?.[1] || '').trim();
}

export function parseRss(xml) {
  if (!/<rss\b/i.test(String(xml || ''))) return [];
  const results = [];
  const seen = new Set();
  for (const match of String(xml).matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item\s*>/gi)) {
    const item = match[1];
    const enclosure = item.match(/<enclosure\b[^>]*>/i)?.[0] || '';
    const rawUrl = enclosure.match(/\burl\s*=\s*(["'])(.*?)\1/i)?.[2];
    const audioUrl = decodeXml(rawUrl || '').trim();
    if (!/^https:\/\//i.test(audioUrl)) continue;
    const title = field(item, 'title').replace(/<[^>]+>/g,'').trim();
    if (!title) continue;
    const id = field(item, 'guid') || audioUrl;
    if (seen.has(id)) continue;
    seen.add(id);
    const dateRaw = field(item,'pubDate');
    const date = Date.parse(dateRaw);
    const description = decodeXml(field(item,'description')).replace(/<[^>]+>/g,' ')
      .replace(/\s+/g,' ').trim().slice(0,650);
    results.push({
      id, title, description,
      published: Number.isFinite(date) ? new Date(date).toISOString() : '',
      audioUrl
    });
    if (results.length >= LIMIT) break;
  }
  return results.sort((a,b) =>
    (Date.parse(b.published || '') || 0) - (Date.parse(a.published || '') || 0)
  );
}

export async function syncPodcast(fetcher = fetch) {
  const response = await fetcher(FEED_URL, {
    headers: { 'User-Agent': 'TifloAcosta-Web-Podcast-Sync/1.0' },
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error('RSS HTTP ' + response.status);
  const episodes = parseRss(await response.text());
  if (!episodes.length) throw new Error('RSS sin episodios válidos');
  const next = JSON.stringify(episodes, null, 2) + '\n';
  let previous = '';
  try { previous = await readFile(OUTPUT, 'utf8'); } catch {}
  if (previous !== next) await writeFile(OUTPUT, next, 'utf8');
  return { count: episodes.length, changed: previous !== next };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  syncPodcast().then(result => {
    console.log('Catálogo de podcast:', result.count, 'episodios;', result.changed ? 'actualizado' : 'sin cambios');
  }).catch(error => {
    // No bloquear la publicación de otras secciones si falla el RSS.
    console.warn('Aviso: no se pudo actualizar Podcast:', error.message);
  });
}

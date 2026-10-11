import { feedEntriesFromXml } from '../scripts/actualidad-media-adapters.mjs';
import { canonicalizeUrl } from '../scripts/actualidad-feed.mjs';

// Enrich the local iOS bundle only; never rewrite the public/Android catalogue.
const normalTitle = text => String(text || '').normalize('NFKC').toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

const validAudioUrl = value => {
  try {
    const url = new URL(String(value || ''));
    return ['https:', 'http:'].includes(url.protocol) ? url.toString() : '';
  } catch { return ''; }
};

function findEpisode(catalogueItem, entries) {
  const itemUrl = canonicalizeUrl(catalogueItem.originalUrl);
  const byUrl = entries.filter(entry =>
    validAudioUrl(entry.mediaUrl) &&
    itemUrl &&
    canonicalizeUrl(entry.originalUrl) === itemUrl);
  if (byUrl.length === 1) return byUrl[0];

  // Some providers use the podcast homepage for every episode; in that case,
  // match the unique title and a nearby publication date, never the source alone.
  const title = normalTitle(catalogueItem.title);
  const time = Date.parse(catalogueItem.publishedAt);
  if (!title || !Number.isFinite(time)) return null;
  const candidates = entries.filter(entry => {
    const published = Date.parse(entry.publishedAt);
    return validAudioUrl(entry.mediaUrl) &&
      normalTitle(entry.title) === title &&
      Number.isFinite(published) &&
      Math.abs(published - time) <= 48 * 60 * 60 * 1000;
  });
  return candidates.length === 1 ? candidates[0] : null;
}

export async function enrichIosMediaCatalog({
  items = [], sources = [], fetchImpl = fetch, timeoutMs = 12000
} = {}) {
  if (!Array.isArray(items) || !Array.isArray(sources)) throw new TypeError('Invalid media catalogue');
  const selected = sources.filter(source =>
    source.enabled && source.type === 'audio' && source.adapter === 'feed' &&
    source.endpoint && items.some(item => item.type === 'audio' && item.sourceId === source.id));
  const lookups = await Promise.all(selected.map(async source => {
    try {
      const response = await fetchImpl(source.endpoint, {
        headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' },
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (!response.ok) throw new Error('RSS HTTP ' + response.status);
      const xml = await response.text();
      if (xml.length > 12_000_000) throw new Error('RSS file is unexpectedly large');
      return { id: source.id, entries: feedEntriesFromXml(xml, source), ok: true };
    } catch (error) {
      return { id: source.id, entries: [], ok: false, reason: String(error?.message || error).slice(0,100) };
    }
  }));

  const feeds = new Map(lookups.map(feed => [feed.id, feed.entries]));
  let enriched = 0;
  const output = items.map(item => {
    if (item.type !== 'audio' || validAudioUrl(item.mediaUrl)) return item;
    const candidate = findEpisode(item, feeds.get(item.sourceId) || []);
    if (!candidate) return item;
    enriched += 1;
    return { ...item, mediaUrl: validAudioUrl(candidate.mediaUrl) };
  });
  const audioCount = output.filter(item => item.type === 'audio').length;
  const playableCount = output.filter(item =>
    item.type === 'audio' && validAudioUrl(item.mediaUrl)).length;
  return {
    items: output,
    stats: {
      audioCount, playableCount, enriched,
      feedsOk: lookups.filter(feed => feed.ok).length,
      feedsFailed: lookups.filter(feed => !feed.ok).map(feed => feed.id)
    }
  };
}

import { canonicalizeUrl } from './actualidad-feed.mjs';

export function normalizeMediaItem(raw, source) {
  const originalUrl = canonicalizeUrl(raw?.originalUrl || raw?.url || '');
  const title = String(raw?.title || '').trim();
  const published = new Date(raw?.publishedAt || '');
  if (!source?.id || !title || !originalUrl || Number.isNaN(published.getTime())) return null;
  return {
    id: String(raw.id || `${source.id}:${originalUrl}`),
    type: source.type === 'video' ? 'video' : 'audio',
    section: source.section === 'technology' ? 'technology' : 'accessibility',
    sourceId: source.id,
    sourceName: source.name,
    sourceUrl: source.homepage,
    originalUrl,
    originalLanguage: source.lang || 'es',
    publishedAt: published.toISOString(),
    title,
    summary: String(raw.summary || '').trim(),
    mediaUrl: String(raw.mediaUrl || '').trim() || null,
    embedUrl: String(raw.embedUrl || '').trim() || null,
    platform: String(raw.platform || source.platform || (source.type === 'video' ? 'youtube' : 'podcast')),
    categories: Array.isArray(raw.categories) ? [...new Set(raw.categories.map(String).filter(Boolean))] : []
  };
}

export function dedupeMediaItems(items = []) {
  const seen = new Set();
  return items.filter(item => {
    const key = canonicalizeUrl(item.originalUrl || '') || String(item.id || '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function retainRecentMedia(items = [], now = new Date(), maxAgeDays = 90) {
  const maxAge = maxAgeDays * 86400000;
  return items.filter(item => {
    const published = new Date(item.publishedAt);
    const age = now - published;
    return !Number.isNaN(published.getTime()) && age >= 0 && age <= maxAge;
  });
}

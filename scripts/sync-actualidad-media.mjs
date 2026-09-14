import fs from 'node:fs';
import sourcesFile from '../actualidad-media-sources.json' with { type: 'json' };
import editorialFile from '../actualidad-media-editorial.json' with { type: 'json' };
import { feedEntriesFromXml, parseTifloAudioHtml, youtubeEntriesFromApi } from './actualidad-media-adapters.mjs';
import { canonicalizeUrl } from './actualidad-feed.mjs';
import { dedupeMediaItems, normalizeMediaItem, retainRecentMedia } from './actualidad-media-core.mjs';

function apiUrl(resource, params) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${resource}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function requireText(response) {
  if (!response?.ok) throw new Error(`HTTP ${response?.status || 'error'}`);
  return response.text();
}

async function requireJson(response) {
  if (!response?.ok) throw new Error(`HTTP ${response?.status || 'error'}`);
  return response.json();
}

function cleanLocale(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const title = String(raw.title || '').trim();
  const summary = String(raw.summary || '').trim();
  if (!title && !summary) return null;
  return { title, summary };
}

export function mergeMediaEditorial(items = [], records = []) {
  const byId = new Map();
  const byUrl = new Map();
  for (const record of Array.isArray(records) ? records : []) {
    const id = String(record?.id || '').trim();
    if (id) byId.set(id, record);
    const url = canonicalizeUrl(record?.originalUrl || '');
    if (url) byUrl.set(url, record);
  }

  const out = [];
  for (const item of Array.isArray(items) ? items : []) {
    const record = byId.get(String(item?.id || '')) || byUrl.get(canonicalizeUrl(item?.originalUrl || ''));
    if (!record) {
      out.push(item);
      continue;
    }
    if (record.state === 'withheld' || record.withheld === true) continue;

    const locales = {};
    const es = cleanLocale(record.locales?.es);
    const en = cleanLocale(record.locales?.en);
    if (es) locales.es = es;
    if (en) locales.en = en;

    const merged = { ...item };
    if (record.state) merged.editorialState = String(record.state);
    if (Object.keys(locales).length) merged.locales = locales;
    const rank = Number(record.featuredRank);
    if (Number.isFinite(rank)) merged.featuredRank = rank;
    out.push(merged);
  }
  return out;
}

export function orderMediaItems(items = []) {
  const pending = [...items].sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')) || String(a.id || '').localeCompare(String(b.id || '')));
  const out = [];
  let lastSource = '';
  let streak = 0;

  while (pending.length) {
    let index = 0;
    if (lastSource && streak >= 2) {
      const alternative = pending.findIndex(item => String(item.sourceId || '') !== lastSource);
      if (alternative >= 0) index = alternative;
    }
    const [next] = pending.splice(index, 1);
    const source = String(next?.sourceId || '');
    if (source && source === lastSource) streak += 1;
    else {
      lastSource = source;
      streak = 1;
    }
    out.push(next);
  }
  return out;
}

export async function fetchMediaSource(source, fetchImpl = fetch, env = process.env) {
  if (source.adapter === 'feed') {
    return feedEntriesFromXml(await requireText(await fetchImpl(source.endpoint)), source);
  }
  if (source.adapter === 'tifloaudio-html') {
    return parseTifloAudioHtml(await requireText(await fetchImpl(source.endpoint || source.homepage)));
  }
  if (source.adapter === 'youtube-handle') {
    const key = env.YOUTUBE_API_KEY;
    if (!key) throw new Error(`YouTube API key unavailable for ${source.id}`);
    const handle = String(source.youtubeHandle || '').trim();
    if (!handle) throw new Error(`YouTube handle unavailable for ${source.id}`);
    const channel = await requireJson(await fetchImpl(apiUrl('channels', {
      part: 'contentDetails', forHandle: handle, key
    })));
    const uploads = channel.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploads) throw new Error(`YouTube handle not resolved: ${handle}`);
    const page = await requireJson(await fetchImpl(apiUrl('playlistItems', {
      part: 'snippet,contentDetails', playlistId: uploads,
      maxResults: Math.min(50, Math.max(1, Number(source.maxItems) || 8)), key
    })));
    return youtubeEntriesFromApi(page);
  }
  throw new Error(`Unsupported multimedia adapter: ${source.adapter}`);
}

export async function buildMediaCatalog({ sources = sourcesFile, fetchImpl = fetch, env = process.env, now = new Date(), editorial = editorialFile } = {}) {
  const enabled = sources.filter(source => source?.enabled);
  const items = [];
  const failures = [];
  let successes = 0;

  for (const source of enabled) {
    try {
      const raw = await fetchMediaSource(source, fetchImpl, env);
      successes += 1;
      for (const entry of raw.slice(0, Math.max(1, Number(source.maxItems) || 8))) {
        const normalized = normalizeMediaItem(entry, source);
        if (normalized) items.push(normalized);
      }
    } catch (error) {
      failures.push({ sourceId: source.id, message: error?.message || String(error) });
    }
  }

  if (enabled.length && successes === 0) throw new Error('All multimedia sources failed');

  const retained = retainRecentMedia(dedupeMediaItems(items), now);
  const merged = mergeMediaEditorial(retained, editorial);
  const ordered = orderMediaItems(merged);
  return { items: ordered, failures };
}

export async function syncMediaCatalog(options = {}) {
  const result = await buildMediaCatalog(options);
  const output = `${JSON.stringify(result.items, null, 2)}\n`;
  let previous = '';
  try { previous = fs.readFileSync('actualidad-media.json', 'utf8'); } catch {}
  const changed = previous !== output;
  if (changed) fs.writeFileSync('actualidad-media.json', output, 'utf8');
  for (const failure of result.failures) console.warn(`Multimedia source unavailable: ${failure.sourceId}: ${failure.message}`);
  console.log(`Actualidad media: ${result.items.length}. Changed: ${changed ? 'yes' : 'no'}.`);
  return { ...result, changed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  syncMediaCatalog().catch(error => {
    console.error(`Multimedia synchronization failed: ${error?.message || error}`);
    process.exit(1);
  });
}

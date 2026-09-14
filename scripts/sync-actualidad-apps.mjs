import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { canonicalizeUrl, parseBuscaAppsHtml, parseFeedXml, stableStoryId } from './actualidad-feed.mjs';

const FETCH_ATTEMPTS = 3;

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizedDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function discoveryApp(item, source) {
  const originalUrl = canonicalizeUrl(item?.url);
  const id = clean(item?.id) || (originalUrl ? stableStoryId(source?.id, originalUrl) : '');
  const title = clean(item?.title);
  const platform = clean(item?.platform);
  if (!id || !title || !originalUrl || !platform || !source?.id || !source?.name) return null;
  return {
    id,
    title,
    sourceId: source.id,
    sourceName: source.name,
    sourceUrl: source.homepage || source.url || '',
    originalUrl,
    lang: source.lang || '',
    platform,
    summary: clean(item.summary),
    publishedAt: null
  };
}

function feedApp(entry, source) {
  const originalUrl = canonicalizeUrl(entry?.url);
  const title = clean(entry?.title);
  const publishedAt = normalizedDate(entry?.publishedAt);
  const platform = clean(source?.appPlatform);
  if (!title || !originalUrl || !publishedAt || !platform || !source?.id || !source?.name) return null;
  return {
    id: stableStoryId(source.id, originalUrl),
    title,
    sourceId: source.id,
    sourceName: source.name,
    sourceUrl: source.homepage || '',
    originalUrl,
    lang: source.lang || '',
    platform,
    summary: clean(entry.summary),
    publishedAt
  };
}

export function buildAppsCatalog({ discoveryItems = [], discoverySource, feedEntries = [], feedSource } = {}) {
  const items = [];
  const seen = new Set();
  const append = item => {
    if (!item || seen.has(item.id)) return;
    seen.add(item.id);
    items.push(item);
  };

  for (const item of discoveryItems) append(discoveryApp(item, discoverySource));
  for (const entry of feedEntries) append(feedApp(entry, feedSource));
  return items;
}

async function fetchText(source, url, accept, fetchFn) {
  let lastError;
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchFn(url, {
        headers: {
          accept,
          'user-agent': 'TifloAcosta-Actualidad/1.0 (+https://tifloacosta.com/)'
        }
      });
      if (!response?.ok) throw new Error(`HTTP ${response?.status || 'error'} for ${source.id}`);
      return await response.text();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error(`Unable to fetch ${source?.id || 'app source'}`);
}

function limited(items, source) {
  const maxItems = Number.isInteger(source?.appMaxItems) && source.appMaxItems > 0 ? source.appMaxItems : 10;
  return items.slice(0, maxItems);
}

export async function syncActualidadApps({ discoverySources = [], feedSources = [], fetchFn = fetch } = {}) {
  const discoveries = discoverySources.filter(source => source?.enabled !== false && source?.appCatalog === true && source?.url);
  const feeds = feedSources.filter(source => source?.enabled !== false && source?.appCatalog === true && source?.feedUrl);
  if (discoveries.length + feeds.length === 0) throw new Error('No enabled app catalog sources');

  const items = [];
  const failedSources = [];

  for (const source of discoveries) {
    try {
      const text = await fetchText(source, source.url, 'text/html, application/xhtml+xml;q=0.9, */*;q=0.5', fetchFn);
      const parsed = source.format === 'buscaapps-html' ? parseBuscaAppsHtml(text, source) : [];
      items.push(...buildAppsCatalog({ discoveryItems: limited(parsed, source), discoverySource: source }));
    } catch (error) {
      failedSources.push(source.id);
    }
  }

  for (const source of feeds) {
    try {
      const text = await fetchText(source, source.feedUrl, 'application/atom+xml, application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.5', fetchFn);
      const parsed = parseFeedXml(text, source);
      items.push(...buildAppsCatalog({ feedEntries: limited(parsed, source), feedSource: source }));
    } catch (error) {
      failedSources.push(source.id);
    }
  }

  const unique = [];
  const seen = new Set();
  for (const item of items) {
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    unique.push(item);
  }

  if (unique.length === 0 && failedSources.length === discoveries.length + feeds.length) {
    throw new Error('All app catalog sources failed');
  }
  return { items: unique, failedSources };
}

async function readJson(url) {
  return JSON.parse(await readFile(url, 'utf8'));
}

async function main() {
  const root = new URL('../', import.meta.url);
  const [discoverySources, feedSources] = await Promise.all([
    readJson(new URL('actualidad-discovery-sources.json', root)),
    readJson(new URL('actualidad-sources.json', root))
  ]);
  const { items, failedSources } = await syncActualidadApps({ discoverySources, feedSources, fetchFn: fetch });
  const outputUrl = new URL('actualidad-apps.json', root);
  const next = `${JSON.stringify(items, null, 2)}\n`;
  let previous = '';
  try { previous = await readFile(outputUrl, 'utf8'); } catch (error) { /* first generation */ }
  if (previous !== next) await writeFile(outputUrl, next, 'utf8');
  if (failedSources.length) console.warn(`Actualidad app sources unavailable: ${failedSources.join(', ')}`);
  console.log(`Actualidad apps: ${items.length}. Changed: ${previous !== next ? 'yes' : 'no'}.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(error => {
    console.error(error?.stack || error);
    process.exitCode = 1;
  });
}

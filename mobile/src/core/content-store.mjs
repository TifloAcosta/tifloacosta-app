const CACHE_KEY = 'tiflo-mobile-content-v1';
const DEFAULT_URL = 'https://tifloacosta.com/mobile-content.json';

function isValidContent(content) {
  return Boolean(
    content &&
    content.schemaVersion === 1 &&
    Array.isArray(content.resources) &&
    Array.isArray(content.videos) &&
    Array.isArray(content.news)
  );
}

function normalizeApp(item = {}) {
  return {
    kind: 'app',
    id: item.id,
    lang: item.lang || '',
    title: item.title || '',
    summary: item.summary || '',
    platform: item.platform || '',
    sourceName: item.sourceName || '',
    originalUrl: item.originalUrl || item.url || '',
    publishedAt: item.publishedAt || ''
  };
}

function normalizeMedia(item = {}) {
  return {
    kind: 'media',
    id: item.id,
    lang: item.lang || item.originalLanguage || '',
    title: item.title || '',
    summary: item.summary || '',
    platform: item.platform || '',
    sourceName: item.sourceName || '',
    originalUrl: item.originalUrl || item.mediaUrl || item.url || '',
    publishedAt: item.publishedAt || ''
  };
}

function siblingUrl(base, filename) {
  try { return new URL(filename, base).href; } catch { return ''; }
}

async function loadOptionalCollection(fetchFn, targetUrl, normalizer) {
  if (!targetUrl) return [];
  try {
    const response = await fetchFn(targetUrl, { cache: 'no-store' });
    if (!response?.ok) return [];
    const values = await response.json();
    return Array.isArray(values) ? values.map(normalizer) : [];
  } catch {
    return [];
  }
}

async function enrichActualidadCollections(content, fetchFn, baseUrl) {
  const enriched = { ...content };
  if (!Array.isArray(enriched.apps)) {
    enriched.apps = await loadOptionalCollection(fetchFn, siblingUrl(baseUrl, 'actualidad-apps.json'), normalizeApp);
  }
  if (!Array.isArray(enriched.media)) {
    enriched.media = await loadOptionalCollection(fetchFn, siblingUrl(baseUrl, 'actualidad-media.json'), normalizeMedia);
  }
  return enriched;
}

function readCached(storage) {
  if (!storage || typeof storage.getItem !== 'function') return null;
  try {
    const raw = storage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isValidContent(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeCached(storage, content) {
  if (!storage || typeof storage.setItem !== 'function') return false;
  try {
    storage.setItem(CACHE_KEY, JSON.stringify(content));
    return true;
  } catch {
    return false;
  }
}

export function createContentStore({ fetchFn = globalThis.fetch, storage = globalThis.localStorage, url = DEFAULT_URL } = {}) {
  if (typeof fetchFn !== 'function') throw new TypeError('fetchFn must be a function');

  let current = null;

  async function load() {
    const cached = readCached(storage);
    try {
      const response = await fetchFn(url, { cache: 'no-store' });
      if (!response?.ok) throw new Error(`Content request failed: ${response?.status || 'unknown'}`);
      const content = await response.json();
      if (!isValidContent(content)) throw new Error('Invalid mobile content schema');
      const enriched = await enrichActualidadCollections(content, fetchFn, url);
      current = enriched;
      writeCached(storage, enriched);
      return { status: 'fresh', content: enriched };
    } catch {
      if (cached) {
        current = cached;
        return { status: 'cached', content: cached };
      }
      current = null;
      return { status: 'empty', content: null };
    }
  }

  function getCurrent() {
    return current;
  }

  return { load, getCurrent };
}

export { CACHE_KEY, DEFAULT_URL, isValidContent };

const CACHE_KEY = 'tiflo-mobile-content-v1';
const DEFAULT_URL = 'https://tifloacosta.com/mobile-content.json';

export function isValidContent(content) {
  return Boolean(
    content &&
    content.schemaVersion === 1 &&
    Array.isArray(content.resources) &&
    Array.isArray(content.videos) &&
    Array.isArray(content.news)
  );
}

function readCached(storage) {
  try {
    const raw = storage?.getItem?.(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isValidContent(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeCached(storage, content) {
  try {
    storage?.setItem?.(CACHE_KEY, JSON.stringify(content));
  } catch {
    // Cache writes are best-effort and must not interrupt the app.
  }
}

export function createContentStore({
  fetchFn = globalThis.fetch,
  storage = globalThis.localStorage,
  url = DEFAULT_URL
} = {}) {
  let current = null;

  return {
    async load() {
      try {
        const response = await fetchFn(url, { cache: 'no-store' });
        if (!response?.ok) throw new Error(`HTTP ${response?.status || 'error'}`);
        const content = await response.json();
        if (!isValidContent(content)) throw new Error('Invalid mobile content schema');
        current = content;
        writeCached(storage, content);
        return { status: 'fresh', content };
      } catch {
        const cached = readCached(storage);
        if (cached) {
          current = cached;
          return { status: 'cached', content: cached };
        }
        current = null;
        return { status: 'empty', content: null };
      }
    },

    getCurrent() {
      return current;
    }
  };
}

export { CACHE_KEY, DEFAULT_URL };

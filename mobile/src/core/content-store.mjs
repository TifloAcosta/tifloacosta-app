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
      current = content;
      writeCached(storage, content);
      return { status: 'fresh', content };
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

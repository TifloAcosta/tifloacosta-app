export const NEWS_SEEN_KEY = 'tiflo-mobile-news-seen-v1';

function stableIds(items) {
  const ids = [];
  const seen = new Set();
  for (const item of Array.isArray(items) ? items : []) {
    const id = String(item?.id || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function createNewsSeenStore(storage = globalThis.localStorage) {
  function readRaw() {
    if (!storage || typeof storage.getItem !== 'function') return null;
    try {
      const raw = storage.getItem(NEWS_SEEN_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? new Set(parsed.map(value => String(value || '').trim()).filter(Boolean))
        : null;
    } catch {
      return null;
    }
  }

  function write(ids) {
    if (!storage || typeof storage.setItem !== 'function') return false;
    try {
      storage.setItem(NEWS_SEEN_KEY, JSON.stringify([...ids]));
      return true;
    } catch {
      return false;
    }
  }

  function compare(items) {
    const current = new Set(stableIds(items));
    const baseline = readRaw();
    if (!baseline) {
      write(current);
      return new Set();
    }
    return new Set([...current].filter(id => !baseline.has(id)));
  }

  function markSeen(items) {
    return write(new Set(stableIds(items)));
  }

  function readBaseline() {
    return readRaw() || new Set();
  }

  return { compare, markSeen, readBaseline };
}

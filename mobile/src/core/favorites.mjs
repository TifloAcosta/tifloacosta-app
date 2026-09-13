const STORAGE_KEY = 'tiflo-mobile-favorites-v1';
const KINDS = new Set(['news', 'resource', 'video']);

function normalizeRef(ref) {
  if (!ref || !KINDS.has(ref.kind)) return null;
  const id = String(ref.id || '').trim();
  if (!id) return null;
  return { kind: ref.kind, id };
}

function keyOf(ref) {
  return `${ref.kind}:${ref.id}`;
}

function read(storage) {
  try {
    const raw = storage?.getItem?.(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const unique = new Map();
    for (const value of parsed) {
      const ref = normalizeRef(value);
      if (ref && !unique.has(keyOf(ref))) unique.set(keyOf(ref), ref);
    }
    return [...unique.values()];
  } catch {
    return [];
  }
}

function write(storage, refs) {
  try {
    storage?.setItem?.(STORAGE_KEY, JSON.stringify(refs));
  } catch {
    // Favorites remain usable for the current session if persistence is blocked.
  }
}

export function createFavoritesStore(storage = globalThis.localStorage) {
  let refs = read(storage);

  return {
    list() {
      return refs.map(ref => ({ ...ref }));
    },

    has(value) {
      const ref = normalizeRef(value);
      if (!ref) return false;
      const key = keyOf(ref);
      return refs.some(item => keyOf(item) === key);
    },

    toggle(value) {
      const ref = normalizeRef(value);
      if (!ref) return false;
      const key = keyOf(ref);
      const index = refs.findIndex(item => keyOf(item) === key);
      if (index >= 0) {
        refs.splice(index, 1);
        write(storage, refs);
        return false;
      }
      refs.push(ref);
      write(storage, refs);
      return true;
    },

    remove(value) {
      const ref = normalizeRef(value);
      if (!ref) return false;
      const key = keyOf(ref);
      const next = refs.filter(item => keyOf(item) !== key);
      if (next.length === refs.length) return false;
      refs = next;
      write(storage, refs);
      return true;
    }
  };
}

export { STORAGE_KEY };

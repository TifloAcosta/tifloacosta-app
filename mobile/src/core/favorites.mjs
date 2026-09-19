export const FAVORITES_KEY = 'tiflo-mobile-favorites-v1';

const SUPPORTED_KINDS = new Set(['resource', 'video', 'news']);

function cleanRef(ref) {
  const kind = String(ref?.kind || '');
  const id = String(ref?.id || '').trim();
  if (!SUPPORTED_KINDS.has(kind) || !id) return null;
  return { kind, id };
}

function refKey(ref) {
  return `${ref.kind}:${ref.id}`;
}

function readStored(storage) {
  try {
    const raw = storage?.getItem?.(FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const seen = new Set();
    const refs = [];
    for (const candidate of parsed) {
      const ref = cleanRef(candidate);
      if (!ref) continue;
      const key = refKey(ref);
      if (seen.has(key)) continue;
      seen.add(key);
      refs.push(ref);
    }
    return refs;
  } catch {
    return [];
  }
}

export function createFavoritesStore(storage) {
  let refs = readStored(storage);

  function persist() {
    try {
      storage?.setItem?.(FAVORITES_KEY, JSON.stringify(refs));
    } catch {
      // Favorites stay usable for the current session even when storage is blocked.
    }
  }

  function list() {
    return refs.map(ref => ({ ...ref }));
  }

  function has(candidate) {
    const ref = cleanRef(candidate);
    return Boolean(ref && refs.some(item => refKey(item) === refKey(ref)));
  }

  function remove(candidate) {
    const ref = cleanRef(candidate);
    if (!ref) return false;
    const key = refKey(ref);
    const next = refs.filter(item => refKey(item) !== key);
    if (next.length === refs.length) return false;
    refs = next;
    persist();
    return true;
  }

  function toggle(candidate) {
    const ref = cleanRef(candidate);
    if (!ref) return false;
    if (has(ref)) {
      remove(ref);
      return false;
    }
    refs = [...refs, ref];
    persist();
    return true;
  }

  return { list, has, toggle, remove };
}

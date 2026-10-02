export const FAVORITES_KEY = 'tiflo-mobile-favorites-v1';

const SUPPORTED_KINDS = new Set(['resource', 'video', 'news']);

function cleanRef(ref, legacyKind = '') {
  if (typeof ref === 'string') {
    const id = ref.trim();
    const kind = String(legacyKind || '');
    if (!SUPPORTED_KINDS.has(kind) || !id) return null;
    return { kind, id };
  }
  const kind = String(ref?.kind || '');
  const id = String(ref?.id || '').trim();
  if (!SUPPORTED_KINDS.has(kind) || !id) return null;
  return { kind, id };
}

function refKey(ref) {
  return `${ref.kind}:${ref.id}`;
}

function readStored(storage, key = FAVORITES_KEY, legacyKind = '') {
  try {
    const raw = storage?.getItem?.(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const seen = new Set();
    const refs = [];
    for (const candidate of parsed) {
      const ref = cleanRef(candidate, legacyKind);
      if (!ref) continue;
      const keyValue = refKey(ref);
      if (seen.has(keyValue)) continue;
      seen.add(keyValue);
      refs.push(ref);
    }
    return refs;
  } catch {
    return [];
  }
}

export function createFavoritesStore(storage, {
  key = FAVORITES_KEY,
  legacyKind = '',
  storageFormat = 'refs'
} = {}) {
  let refs = readStored(storage, key, legacyKind);

  function persist() {
    try {
      const payload = storageFormat === 'ids'
        ? refs.filter(ref => !legacyKind || ref.kind === legacyKind).map(ref => ref.id)
        : refs;
      storage?.setItem?.(key, JSON.stringify(payload));
    } catch {
      // Favorites stay usable for the current session even when storage is blocked.
    }
  }

  function list() {
    return refs.map(ref => ({ ...ref }));
  }

  function has(candidate) {
    const ref = cleanRef(candidate, legacyKind);
    return Boolean(ref && refs.some(item => refKey(item) === refKey(ref)));
  }

  function remove(candidate) {
    const ref = cleanRef(candidate, legacyKind);
    if (!ref) return false;
    const keyValue = refKey(ref);
    const next = refs.filter(item => refKey(item) !== keyValue);
    if (next.length === refs.length) return false;
    refs = next;
    persist();
    return true;
  }

  function toggle(candidate) {
    const ref = cleanRef(candidate, legacyKind);
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

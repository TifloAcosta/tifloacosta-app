const BOOK_STATES = new Set(['not-read', 'in-reading', 'read']);
const BOOK_SORTS = new Set(['title', 'imported', 'lastRead']);

function numberOr(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nonNegativeInteger(value, fallback = 0) {
  return Math.max(0, Math.trunc(numberOr(value, fallback)));
}

function positiveInteger(value, fallback) {
  const number = Math.trunc(numberOr(value, fallback));
  return number > 0 ? number : fallback;
}

function normalizeBook(value) {
  if (!value || typeof value !== 'object') return null;
  const id = String(value.id ?? '').trim();
  if (!id) return null;
  const percent = Math.min(100, Math.max(0, numberOr(value.percent, 0)));
  const state = BOOK_STATES.has(value.state) ? value.state : 'not-read';
  return {
    id,
    title: String(value.title ?? '').trim(),
    format: String(value.format ?? '').trim().toLowerCase(),
    state,
    percent,
    blockIndex: nonNegativeInteger(value.blockIndex, 0),
    importedAt: Math.max(0, numberOr(value.importedAt, 0)),
    lastReadAt: Math.max(0, numberOr(value.lastReadAt, 0)),
    sizeBytes: Math.max(0, numberOr(value.sizeBytes, 0))
  };
}

function normalizeRejected(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    name: String(value.name ?? '').trim(),
    reason: String(value.reason ?? '').trim()
  };
}

function normalizeBatch(value, { cancelledDefault = false } = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    cancelled: source.cancelled === true || (value == null && cancelledDefault),
    imported: (Array.isArray(source.imported) ? source.imported : []).map(normalizeBook).filter(Boolean),
    duplicates: (Array.isArray(source.duplicates) ? source.duplicates : []).map(normalizeBook).filter(Boolean),
    rejected: (Array.isArray(source.rejected) ? source.rejected : []).map(normalizeRejected).filter(Boolean)
  };
}

function normalizeListOptions(options = {}) {
  const status = BOOK_STATES.has(options.status) ? options.status : 'all';
  const sort = BOOK_SORTS.has(options.sort) ? options.sort : 'lastRead';
  return {
    page: positiveInteger(options.page, 1),
    pageSize: positiveInteger(options.pageSize, 10),
    query: String(options.query ?? '').trim(),
    status,
    sort
  };
}

function normalizeList(value, requested) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    items: (Array.isArray(source.items) ? source.items : []).map(normalizeBook).filter(Boolean),
    total: nonNegativeInteger(source.total, 0),
    page: positiveInteger(source.page, requested.page),
    pageSize: positiveInteger(source.pageSize, requested.pageSize),
    pages: nonNegativeInteger(source.pages, 0)
  };
}

function mutationSucceeded(value, key) {
  if (value === true) return true;
  return Boolean(value && typeof value === 'object' && value[key] === true);
}

export function createReadingLibraryClient(plugin = {}) {
  async function pickDocuments() {
    if (!plugin?.pickDocuments) return normalizeBatch(null);
    try {
      return normalizeBatch(await plugin.pickDocuments());
    } catch {
      return normalizeBatch(null);
    }
  }

  async function consumeInitialSharedDocuments() {
    if (!plugin?.consumeInitialSharedDocuments) return normalizeBatch(null);
    try {
      return normalizeBatch(await plugin.consumeInitialSharedDocuments());
    } catch {
      return normalizeBatch(null);
    }
  }

  async function listBooks(options = {}) {
    const requested = normalizeListOptions(options);
    if (!plugin?.listBooks) return normalizeList(null, requested);
    try {
      return normalizeList(await plugin.listBooks(requested), requested);
    } catch {
      return normalizeList(null, requested);
    }
  }

  async function openBook(id) {
    const cleanId = String(id ?? '').trim();
    if (!cleanId || !plugin?.openBook) return null;
    try {
      const result = await plugin.openBook(cleanId);
      if (!result || typeof result !== 'object') return null;
      const book = normalizeBook(result.book);
      if (!book) return null;
      return { book, content: String(result.content ?? '') };
    } catch {
      return null;
    }
  }

  async function saveProgress(progress = {}) {
    if (!plugin?.saveProgress) return false;
    const id = String(progress?.id ?? '').trim();
    if (!id) return false;
    try {
      const result = await plugin.saveProgress({
        id,
        blockIndex: nonNegativeInteger(progress.blockIndex, 0),
        percent: Math.min(100, Math.max(0, numberOr(progress.percent, 0))),
        state: BOOK_STATES.has(progress.state) ? progress.state : 'in-reading'
      });
      return mutationSucceeded(result, 'saved');
    } catch {
      return false;
    }
  }

  async function deleteBook(id) {
    const cleanId = String(id ?? '').trim();
    if (!cleanId || !plugin?.deleteBook) return false;
    try {
      return mutationSucceeded(await plugin.deleteBook(cleanId), 'deleted');
    } catch {
      return false;
    }
  }

  async function getLatestInProgress() {
    if (!plugin?.getLatestInProgress) return null;
    try {
      const result = await plugin.getLatestInProgress();
      return normalizeBook(result?.book ?? result);
    } catch {
      return null;
    }
  }

  async function addListener(eventName, listener) {
    if (!plugin?.addListener || typeof listener !== 'function') return { remove: async () => {} };
    try {
      return await plugin.addListener(eventName, listener);
    } catch {
      return { remove: async () => {} };
    }
  }

  return {
    pickDocuments,
    consumeInitialSharedDocuments,
    listBooks,
    openBook,
    saveProgress,
    deleteBook,
    getLatestInProgress,
    addListener
  };
}

export { normalizeBook as normalizeReadingBook };

const BOOK_STATES = new Set(['not-read', 'in-reading', 'read']);
const BOOK_SORTS = new Set(['title', 'imported', 'lastRead']);
const MARK_TYPES = new Set(['bookmark', 'important', 'review', 'quote']);

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

function clampRate(value) {
  return Math.min(2, Math.max(0.5, numberOr(value, 1)));
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
    unitIndex: nonNegativeInteger(value.unitIndex, 0),
    anchorText: String(value.anchorText ?? '').trim(),
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

function normalizeVoice(value) {
  if (!value || typeof value !== 'object') return null;
  const id = String(value.id ?? '').trim();
  if (!id) return null;
  return {
    id,
    name: String(value.name ?? '').trim(),
    language: String(value.language ?? '').trim().toLowerCase(),
    locale: String(value.locale ?? '').trim(),
    networkRequired: value.networkRequired === true
  };
}

function normalizeMark(value) {
  if (!value || typeof value !== 'object') return null;
  const id = String(value.id ?? '').trim();
  const bookId = String(value.bookId ?? '').trim();
  const type = String(value.type ?? '').trim();
  if (!id || !bookId || !MARK_TYPES.has(type)) return null;
  return {
    id,
    bookId,
    type,
    blockIndex: nonNegativeInteger(value.blockIndex, 0),
    unitIndex: nonNegativeInteger(value.unitIndex, 0),
    excerpt: String(value.excerpt ?? '').trim(),
    reference: String(value.reference ?? '').trim(),
    createdAt: Math.max(0, numberOr(value.createdAt, 0))
  };
}

function plainSettings(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return { ...value };
}

export function createReadingLibraryClient(plugin = {}) {
  async function pickDocuments() {
    if (!plugin?.pickDocuments) return normalizeBatch(null);
    try { return normalizeBatch(await plugin.pickDocuments()); } catch { return normalizeBatch(null); }
  }

  async function consumeInitialSharedDocuments() {
    if (!plugin?.consumeInitialSharedDocuments) return normalizeBatch(null);
    try { return normalizeBatch(await plugin.consumeInitialSharedDocuments()); } catch { return normalizeBatch(null); }
  }

  async function listBooks(options = {}) {
    const requested = normalizeListOptions(options);
    if (!plugin?.listBooks) return normalizeList(null, requested);
    try { return normalizeList(await plugin.listBooks(requested), requested); } catch { return normalizeList(null, requested); }
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
    } catch { return null; }
  }

  async function saveProgress(progress = {}) {
    if (!plugin?.saveProgress) return false;
    const id = String(progress?.id ?? '').trim();
    if (!id) return false;
    try {
      const result = await plugin.saveProgress({
        id,
        blockIndex: nonNegativeInteger(progress.blockIndex, 0),
        unitIndex: nonNegativeInteger(progress.unitIndex, 0),
        anchorText: String(progress.anchorText ?? '').trim(),
        percent: Math.min(100, Math.max(0, numberOr(progress.percent, 0))),
        state: BOOK_STATES.has(progress.state) ? progress.state : 'in-reading'
      });
      return mutationSucceeded(result, 'saved');
    } catch { return false; }
  }

  async function deleteBook(id) {
    const cleanId = String(id ?? '').trim();
    if (!cleanId || !plugin?.deleteBook) return false;
    try { return mutationSucceeded(await plugin.deleteBook(cleanId), 'deleted'); } catch { return false; }
  }

  async function getLatestInProgress() {
    if (!plugin?.getLatestInProgress) return null;
    try {
      const result = await plugin.getLatestInProgress();
      return normalizeBook(result?.book ?? result);
    } catch { return null; }
  }

  async function listTtsVoices() {
    if (!plugin?.listTtsVoices) return [];
    try {
      const result = await plugin.listTtsVoices();
      const values = Array.isArray(result) ? result : Array.isArray(result?.voices) ? result.voices : [];
      return values.map(normalizeVoice).filter(Boolean);
    } catch { return []; }
  }

  async function startTts(options = {}) {
    if (!plugin?.startTts) return false;
    const sessionId = String(options?.sessionId ?? '').trim();
    const utteranceId = String(options?.utteranceId ?? '').trim();
    const text = String(options?.text ?? '').trim();
    if (!sessionId || !utteranceId || !text) return false;
    try {
      return mutationSucceeded(await plugin.startTts({
        sessionId,
        utteranceId,
        text,
        voiceId: String(options?.voiceId ?? '').trim(),
        rate: clampRate(options?.rate)
      }), 'accepted');
    } catch { return false; }
  }

  async function stopTts() {
    if (!plugin?.stopTts) return false;
    try { return mutationSucceeded(await plugin.stopTts(), 'stopped'); } catch { return false; }
  }

  async function listMarks(bookId, type = null) {
    const cleanBookId = String(bookId ?? '').trim();
    if (!cleanBookId || !plugin?.listMarks) return [];
    const cleanType = MARK_TYPES.has(type) ? type : null;
    try {
      const result = await plugin.listMarks({ bookId: cleanBookId, type: cleanType });
      const values = Array.isArray(result) ? result : Array.isArray(result?.items) ? result.items : [];
      return values.map(normalizeMark).filter(Boolean);
    } catch { return []; }
  }

  async function addMark(mark = {}) {
    if (!plugin?.addMark) return null;
    const bookId = String(mark?.bookId ?? '').trim();
    const type = String(mark?.type ?? '').trim();
    if (!bookId || !MARK_TYPES.has(type)) return null;
    const request = {
      bookId,
      type,
      blockIndex: nonNegativeInteger(mark.blockIndex, 0),
      unitIndex: nonNegativeInteger(mark.unitIndex, 0),
      excerpt: String(mark.excerpt ?? '').trim(),
      reference: String(mark.reference ?? '').trim()
    };
    try {
      const result = await plugin.addMark(request);
      if (!mutationSucceeded(result, 'added')) return null;
      return normalizeMark(result?.mark ?? result);
    } catch { return null; }
  }

  async function deleteMark(id) {
    const cleanId = String(id ?? '').trim();
    if (!cleanId || !plugin?.deleteMark) return false;
    try { return mutationSucceeded(await plugin.deleteMark({ id: cleanId }), 'deleted'); } catch { return false; }
  }

  async function getReadingSettings(bookId = '') {
    if (!plugin?.getReadingSettings) return { global: {}, book: {} };
    try {
      const result = await plugin.getReadingSettings({ bookId: String(bookId ?? '').trim() });
      return { global: plainSettings(result?.global), book: plainSettings(result?.book) };
    } catch { return { global: {}, book: {} }; }
  }

  async function setReadingSetting(setting = {}) {
    if (!plugin?.setReadingSetting) return false;
    const scope = setting?.scope === 'book' ? 'book' : setting?.scope === 'global' ? 'global' : '';
    const key = String(setting?.key ?? '').trim();
    const bookId = scope === 'book' ? String(setting?.bookId ?? '').trim() : '';
    if (!scope || !key || (scope === 'book' && !bookId)) return false;
    try {
      return mutationSucceeded(await plugin.setReadingSetting({
        scope,
        bookId,
        key,
        value: String(setting?.value ?? '')
      }), 'saved');
    } catch { return false; }
  }

  async function resetBookReadingSettings(bookId) {
    const cleanBookId = String(bookId ?? '').trim();
    if (!cleanBookId || !plugin?.resetBookReadingSettings) return false;
    try { return mutationSucceeded(await plugin.resetBookReadingSettings({ bookId: cleanBookId }), 'reset'); } catch { return false; }
  }

  async function addListener(eventName, listener) {
    if (!plugin?.addListener || typeof listener !== 'function') return { remove: async () => {} };
    try { return await plugin.addListener(eventName, listener); } catch { return { remove: async () => {} }; }
  }

  return {
    pickDocuments,
    consumeInitialSharedDocuments,
    listBooks,
    openBook,
    saveProgress,
    deleteBook,
    getLatestInProgress,
    listTtsVoices,
    startTts,
    stopTts,
    listMarks,
    addMark,
    deleteMark,
    getReadingSettings,
    setReadingSetting,
    resetBookReadingSettings,
    addListener
  };
}

export { normalizeBook as normalizeReadingBook };
